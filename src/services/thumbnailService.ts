import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite asset URL import for web worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker URL
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Generates a high-quality JPEG snapshot (data URL) of the first page of a PDF.
 * @param data ArrayBuffer or Blob containing the PDF binary
 * @param targetWidth Desired thumbnail width in pixels (default 400px)
 */
export async function generatePdfThumbnail(
  data: Blob | ArrayBuffer,
  targetWidth = 400
): Promise<string | null> {
  let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
  try {
    let arrayBuffer: ArrayBuffer;
    if (data instanceof Blob) {
      arrayBuffer = await data.arrayBuffer();
    } else {
      arrayBuffer = data;
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return null;
    }

    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      stopAtErrors: false
    });

    const pdfDoc = await loadingTask.promise;
    if (!pdfDoc || pdfDoc.numPages < 1) {
      return null;
    }

    const page = await pdfDoc.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    const scale = Math.max(0.2, Math.min(3.0, targetWidth / (unscaledViewport.width || targetWidth)));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill clean white background (PDF pages can have transparent background)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      canvas: canvas,
      viewport: viewport
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    // Clean up resources
    try {
      page.cleanup();
      await loadingTask.destroy();
    } catch {}

    return dataUrl;
  } catch (err) {
    console.warn('Failed to generate PDF thumbnail:', err);
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch {}
    }
    return null;
  }
}
