import { makeThumbnail, renderPsdPreview } from './thumbMaker.js';

/**
 * Thumbnail process (started, recycled and restarted by `thumbProcess.js` with fork). wasm-vips
 * works synchronously, so it runs here instead of in the server, where it would hold up every
 * request. Receives { job, task?, input, output, maxSide? } over IPC (task 'psd-preview' renders a
 * large PSD preview for the viewer), replies { job, result? } or { job, error, note }.
 */

// libvips reports a bad file as 'vips::Error …'. A WebAssembly trap, an abort or running out of
// memory leaves the engine unusable: this process then exits without replying, and the parent
// retries every job it had in a fresh process (otherwise they would all be reported as failed).
const isVipsError = (err) => /^vips::Error/.test(Array.isArray(err) ? err[0] : err?.message || '');
const textOf = (err) => String(Array.isArray(err) ? err.join('\n') : err?.message || err);
const isFatal = (err) =>
  !isVipsError(err) && (err instanceof WebAssembly.RuntimeError || /abort|out of bounds|unreachable|out of memory/i.test(textOf(err)));

// "vips::Error,unable to call thumbnail_buffer\nVipsForeignLoad: buffer is not in a known format" → the last line
const messageOf = (err) => {
  const lines = textOf(err).split('\n').map((l) => l.trim()).filter(Boolean);
  return isVipsError(err) ? lines[lines.length - 1] : lines[0] || 'thumbnail failed';
};

process.on('message', async ({ job, task, input, output, maxSide }) => {
  let reply = { job };
  try {
    if (task === 'psd-preview') reply.result = await renderPsdPreview(input, output, maxSide);
    else await makeThumbnail(input, output);
  } catch (err) {
    if (isFatal(err)) process.exit(1);
    // a picture libvips cannot decode (truncated, corrupt) is not worth a second try in the browser
    reply = { job, error: messageOf(err), note: err?.note || (isVipsError(err) ? 'Image cannot be read' : undefined) };
  }
  if (process.connected) process.send(reply);
});

process.on('disconnect', () => process.exit(0));
