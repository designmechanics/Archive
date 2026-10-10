import fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * The full-size merged image Photoshop saves inside every PSD/PSB, read by PhotoCraft's PSD reader
 * compiled to WebAssembly (`native/psd-wasm`, built into `server/vendor/psd.wasm` by
 * `scripts/build-psd-wasm.mjs`). This is how PhotoCraft opens a PSD; it works for CMYK, grey,
 * 16/32-bit, bitmap, duotone and indexed files, which ag-psd cannot draw.
 *
 * Every call gets a fresh instance, so the (large) WebAssembly memory is dropped afterwards.
 */

const WASM = fileURLToPath(new URL('./vendor/psd.wasm', import.meta.url));
const MAX_FILE_BYTES = 1536 * 1024 * 1024; // 32-bit WebAssembly memory tops out at 4 GB

const ERRORS = {
  [-1]: 'not a readable PSD',
  [-2]: 'no merged image (saved without "Maximize Compatibility")',
  [-3]: 'colour mode not supported',
  [-4]: 'merged image could not be decoded'
};

let modulePromise = null;
const getModule = () => (modulePromise ||= fs.promises.readFile(WASM).then((b) => WebAssembly.compile(b)));

/**
 * Reads the merged image of `filePath`, shrunk so its longer side is at most `maxSide`.
 * Resolves to { pixels: Buffer, width, height, bands, kind: 'rgb'|'grey'|'cmyk'|'lab', alpha,
 * docWidth, docHeight, icc: Buffer|null }. CMYK is ink (0 = none); Lab is L 0..255, a/b +128.
 * Rejects with a plain reason.
 */
export async function readPsdMerged(filePath, maxSide) {
  const { size } = await fs.promises.stat(filePath);
  if (size > MAX_FILE_BYTES) throw new Error('PSD too large to read');
  const data = await fs.promises.readFile(filePath);
  const { exports: x } = await WebAssembly.instantiate(await getModule(), {});
  const ptr = x.alloc(data.length);
  new Uint8Array(x.memory.buffer, ptr, data.length).set(data);
  const status = x.merged(ptr, data.length, maxSide);
  x.dealloc(ptr, data.length);
  if (status !== 0) {
    const detail = Buffer.from(new Uint8Array(x.memory.buffer, x.err_ptr(), x.err_len())).toString('utf8');
    throw new Error((ERRORS[status] || `PSD reader error ${status}`) + (detail ? `: ${detail}` : ''));
  }
  const mem = () => new Uint8Array(x.memory.buffer); // re-read: memory may have grown
  const pixels = Buffer.from(mem().subarray(x.out_ptr(), x.out_ptr() + x.out_len()));
  const iccLen = x.out_icc_len();
  const icc = iccLen ? Buffer.from(mem().subarray(x.out_icc_ptr(), x.out_icc_ptr() + iccLen)) : null;
  const out = {
    pixels,
    width: x.out_width(),
    height: x.out_height(),
    bands: x.out_bands(),
    kind: ['rgb', 'grey', 'cmyk', 'lab'][x.out_kind()] || 'rgb',
    alpha: x.out_alpha() === 1,
    docWidth: x.out_doc_width(),
    docHeight: x.out_doc_height(),
    icc
  };
  x.free_out();
  return out;
}
