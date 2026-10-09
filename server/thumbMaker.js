import sharp from 'sharp';

/**
 * Fast server-side thumbnails for raster images (libvips). Reading, resizing and writing a JPEG
 * takes a few milliseconds and nothing large crosses the network, so the browser no longer has to
 * download and decode every full-size photo just to draw a card.
 */

export const SHARP_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.tif', '.tiff']);

export function canMakeThumbnail(filePath) {
  const dot = (filePath || '').lastIndexOf('.');
  return dot >= 0 && SHARP_EXTS.has(filePath.slice(dot).toLowerCase());
}

/** Writes a 420px-wide JPEG thumbnail of `inputPath` to `outputPath`. Throws if the image cannot be read. */
export async function makeImageThumbnail(inputPath, outputPath, width = 420) {
  await sharp(inputPath, { failOn: 'none', limitInputPixels: 1_000_000_000, sequentialRead: true })
    .rotate() // honour EXIF orientation
    .resize({ width, withoutEnlargement: true })
    .flatten({ background: '#ffffff' }) // transparent PNG/GIF/WebP onto white, as JPEG has no alpha
    .jpeg({ quality: 85, mozjpeg: false })
    .toFile(outputPath);
}
