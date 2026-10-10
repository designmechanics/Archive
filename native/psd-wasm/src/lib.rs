//! Reads the merged (flattened) image Photoshop stores at the end of every PSD/PSB, using
//! PhotoCraft's PSD reader, and hands it to JavaScript shrunk to a requested size.
//!
//! Plain C ABI for `wasm32-unknown-unknown` (no wasm-bindgen): JS calls `alloc`, copies the file
//! in, calls `merged`, reads the result through the `out_*` getters, then `free_out`/`dealloc`.
//! Colour stays in the document's own mode (RGB, grey or CMYK ink, 0 = no ink) together with the
//! embedded ICC profile, so the caller can colour-manage it (libvips) instead of PhotoCraft's
//! naive CMYK formula. Indexed and multichannel documents go through PhotoCraft's own RGBA path.

use std::cell::RefCell;

use photocraft_psd::pixels::plane_to_u8;
use photocraft_psd::{ColorMode, PsdFile};

/// Result codes of `merged`.
const OK: i32 = 0;
const ERR_PARSE: i32 = -1;
const ERR_NO_MERGED: i32 = -2; // saved without "Maximize Compatibility": the merged image is blank
const ERR_UNSUPPORTED: i32 = -3;
const ERR_DECODE: i32 = -4;

const KIND_RGB: u32 = 0;
const KIND_GREY: u32 = 1;
const KIND_CMYK: u32 = 2;
const KIND_LAB: u32 = 3; // L 0..255 → 0..100, a/b stored +128 (PhotoCraft has no Lab conversion)

struct Output {
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    bands: u32,
    kind: u32,
    alpha: bool,
    doc_width: u32,
    doc_height: u32,
    icc: Vec<u8>,
}

thread_local! {
    static OUT: RefCell<Option<Output>> = const { RefCell::new(None) };
    /// PhotoCraft's own message for the last failure, for diagnosis
    static ERR: RefCell<String> = const { RefCell::new(String::new()) };
}

fn fail<E: std::fmt::Display>(code: i32) -> impl FnOnce(E) -> i32 {
    move |e| {
        ERR.with(|m| *m.borrow_mut() = e.to_string());
        code
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn err_ptr() -> *const u8 {
    ERR.with(|m| m.borrow().as_ptr())
}
#[unsafe(no_mangle)]
pub extern "C" fn err_len() -> usize {
    ERR.with(|m| m.borrow().len())
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(len);
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// # Safety
/// `ptr`/`len` must come from `alloc`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    unsafe { drop(Vec::from_raw_parts(ptr, 0, len)) }
}

/// Reads the merged image of the PSD in `ptr..ptr+len`, shrunk so its longer side is at most
/// `max_side` (never enlarged). Returns 0 or a negative error code.
///
/// # Safety
/// `ptr`/`len` must describe memory obtained from `alloc` and filled by the caller.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn merged(ptr: *const u8, len: usize, max_side: u32) -> i32 {
    let data = unsafe { std::slice::from_raw_parts(ptr, len) };
    OUT.with(|c| *c.borrow_mut() = None);
    match read(data, max_side.max(1)) {
        Ok(out) => {
            OUT.with(|c| *c.borrow_mut() = Some(out));
            OK
        }
        Err(code) => code,
    }
}

fn read(data: &[u8], max_side: u32) -> Result<Output, i32> {
    ERR.with(|m| m.borrow_mut().clear());
    let file = PsdFile::from_bytes(data).map_err(fail(ERR_PARSE))?;
    if file.has_real_merged_data() == Some(false) {
        return Err(ERR_NO_MERGED);
    }
    let h = &file.header;
    let (w, hh) = (h.width as usize, h.height as usize);
    if w == 0 || hh == 0 {
        return Err(ERR_DECODE);
    }
    let (tw, th) = target_size(w, hh, max_side as usize);
    let icc = file.icc_profile().map(|p| p.to_vec()).unwrap_or_default();

    let (kind, color) = match h.color_mode {
        ColorMode::Rgb => (KIND_RGB, 3),
        ColorMode::Cmyk => (KIND_CMYK, 4),
        ColorMode::Lab => (KIND_LAB, 3),
        ColorMode::Grayscale | ColorMode::Bitmap | ColorMode::Duotone => (KIND_GREY, 1),
        _ => return rgba_path(&file, tw, th, icc),
    };
    let alpha = file.merged_has_alpha();
    let planes_wanted = color + usize::from(alpha);
    if (h.channels as usize) < planes_wanted {
        return Err(ERR_DECODE);
    }

    let raw = file.decode_merged().map_err(fail(ERR_DECODE))?;
    let row_bytes = (w * h.depth as usize).div_ceil(8);
    let plane_len = row_bytes * hh;
    if raw.len() < plane_len * planes_wanted {
        return Err(ERR_DECODE);
    }

    let mut planes = Vec::with_capacity(planes_wanted);
    for i in 0..planes_wanted {
        let full = plane_to_u8(&raw[i * plane_len..(i + 1) * plane_len], h.depth, w, hh).map_err(|_| ERR_DECODE)?;
        let mut small = shrink(&full, w, hh, tw, th);
        if kind == KIND_CMYK && i < 4 {
            // PSD stores CMYK inverted (255 = no ink); libvips expects 0 = no ink
            for v in &mut small {
                *v = 255 - *v;
            }
        }
        planes.push(small);
    }
    drop(raw);

    let bands = planes.len();
    let mut pixels = vec![0u8; tw * th * bands];
    for (b, plane) in planes.iter().enumerate() {
        for (i, v) in plane.iter().enumerate() {
            pixels[i * bands + b] = *v;
        }
    }
    Ok(Output {
        pixels,
        width: tw as u32,
        height: th as u32,
        bands: bands as u32,
        kind,
        alpha,
        doc_width: w as u32,
        doc_height: hh as u32,
        icc,
    })
}

/// Indexed, multichannel and other modes: PhotoCraft's own RGBA conversion, then shrink.
fn rgba_path(file: &PsdFile, tw: usize, th: usize, icc: Vec<u8>) -> Result<Output, i32> {
    let img = file.composite_rgba8().map_err(fail(ERR_UNSUPPORTED))?;
    let (w, hh) = (img.width as usize, img.height as usize);
    let mut planes = Vec::with_capacity(4);
    for b in 0..4 {
        let full: Vec<u8> = img.data.iter().skip(b).step_by(4).copied().collect();
        planes.push(shrink(&full, w, hh, tw, th));
    }
    let mut pixels = vec![0u8; tw * th * 4];
    for (b, plane) in planes.iter().enumerate() {
        for (i, v) in plane.iter().enumerate() {
            pixels[i * 4 + b] = *v;
        }
    }
    Ok(Output {
        pixels,
        width: tw as u32,
        height: th as u32,
        bands: 4,
        kind: KIND_RGB,
        alpha: true,
        doc_width: w as u32,
        doc_height: hh as u32,
        icc,
    })
}

fn target_size(w: usize, h: usize, max_side: usize) -> (usize, usize) {
    let longer = w.max(h);
    if longer <= max_side {
        return (w, h);
    }
    let tw = ((w * max_side) as f64 / longer as f64).round().max(1.0) as usize;
    let th = ((h * max_side) as f64 / longer as f64).round().max(1.0) as usize;
    (tw, th)
}

/// Area-average (box) downscale of one 8-bit plane.
fn shrink(src: &[u8], w: usize, h: usize, tw: usize, th: usize) -> Vec<u8> {
    if tw == w && th == h {
        return src.to_vec();
    }
    let mut out = vec![0u8; tw * th];
    for ty in 0..th {
        let y0 = ty * h / th;
        let y1 = ((ty + 1) * h / th).max(y0 + 1);
        for tx in 0..tw {
            let x0 = tx * w / tw;
            let x1 = ((tx + 1) * w / tw).max(x0 + 1);
            let mut sum = 0u64;
            for y in y0..y1 {
                let row = &src[y * w + x0..y * w + x1];
                sum += row.iter().map(|&v| v as u64).sum::<u64>();
            }
            let n = ((y1 - y0) * (x1 - x0)) as u64;
            out[ty * tw + tx] = ((sum + n / 2) / n) as u8;
        }
    }
    out
}

fn with_out<T: Default>(f: impl FnOnce(&Output) -> T) -> T {
    OUT.with(|c| c.borrow().as_ref().map(f).unwrap_or_default())
}

#[unsafe(no_mangle)]
pub extern "C" fn out_ptr() -> *const u8 {
    OUT.with(|c| c.borrow().as_ref().map(|o| o.pixels.as_ptr()).unwrap_or(std::ptr::null()))
}
#[unsafe(no_mangle)]
pub extern "C" fn out_len() -> usize {
    with_out(|o| o.pixels.len())
}
#[unsafe(no_mangle)]
pub extern "C" fn out_width() -> u32 {
    with_out(|o| o.width)
}
#[unsafe(no_mangle)]
pub extern "C" fn out_height() -> u32 {
    with_out(|o| o.height)
}
#[unsafe(no_mangle)]
pub extern "C" fn out_bands() -> u32 {
    with_out(|o| o.bands)
}
/// 0 = RGB, 1 = grey, 2 = CMYK ink, 3 = Lab
#[unsafe(no_mangle)]
pub extern "C" fn out_kind() -> u32 {
    with_out(|o| o.kind)
}
#[unsafe(no_mangle)]
pub extern "C" fn out_alpha() -> u32 {
    with_out(|o| u32::from(o.alpha))
}
#[unsafe(no_mangle)]
pub extern "C" fn out_doc_width() -> u32 {
    with_out(|o| o.doc_width)
}
#[unsafe(no_mangle)]
pub extern "C" fn out_doc_height() -> u32 {
    with_out(|o| o.doc_height)
}
#[unsafe(no_mangle)]
pub extern "C" fn out_icc_ptr() -> *const u8 {
    OUT.with(|c| c.borrow().as_ref().map(|o| o.icc.as_ptr()).unwrap_or(std::ptr::null()))
}
#[unsafe(no_mangle)]
pub extern "C" fn out_icc_len() -> usize {
    with_out(|o| o.icc.len())
}
#[unsafe(no_mangle)]
pub extern "C" fn free_out() {
    OUT.with(|c| *c.borrow_mut() = None);
}
