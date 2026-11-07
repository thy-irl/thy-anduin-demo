import { saveOriginal } from './originals.js';
export async function pdfLibrary() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}
export async function parseFile(file) {
  if (file.size > 25 * 1024 * 1024)
    throw new Error(`${file.name}: files must be smaller than 25 MB.`);
  const ext = file.name.split('.').pop().toLowerCase(),
    id = crypto.randomUUID();
  let pages = [],
    limitations = [];
  if (ext === 'pdf') {
    const pdfjs = await pdfLibrary(),
      task = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        isEvalSupported: false,
      });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 300) throw new Error('Up to 300 pages per file are supported.');
      for (let n = 1; n <= pdf.numPages; n++) {
        try {
          const page = await pdf.getPage(n),
            content = await page.getTextContent(),
            ops = await page.getOperatorList();
          let text = '',
            lastY = null;
          const lines = [];
          const items = content.items.filter((item) => 'str' in item);
          const rows = [];
          for (const item of items) {
            const y = item.transform[5];
            let row = rows.find((r) => Math.abs(r.y - y) < 3);
            if (!row) {
              row = { y, items: [] };
              rows.push(row);
            }
            row.items.push(item);
          }
          rows.sort((a, b) => b.y - a.y);
          for (const row of rows) {
            row.items.sort((a, b) => a.transform[4] - b.transform[4]);
            if (text) text += '\n';
            for (const item of row.items) {
              const start = text.length;
              text += item.str + ' ';
              lines.push({
                start,
                end: text.length,
                x: item.transform[4],
                y: row.y,
                width: item.width,
                height: item.height,
              });
            }
          }
          text = text.trim();
          const viewport = page.getViewport({ scale: 1 }),
            canvas = document.createElement('canvas');
          canvas.width = 180;
          canvas.height = Math.ceil((180 * viewport.height) / viewport.width);
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          await page.render({
            canvasContext: ctx,
            viewport: page.getViewport({ scale: 180 / viewport.width }),
          }).promise;
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let ink = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 220) ink++;
          const inkRatio = ink / (pixels.length / 4),
            images = ops.fnArray.filter((o) =>
              [
                pdfjs.OPS.paintImageXObject,
                pdfjs.OPS.paintInlineImageXObject,
                pdfjs.OPS.paintImageMaskXObject,
              ].includes(o),
            ).length;
          // Raster ink is a visual signal, never an assumption that each image is a scanned page.
          const sparse = text.replace(/\s/g, '').length < 30,
            blank = sparse && inkRatio < 0.008;
          const status = blank ? 'likely blank' : sparse ? 'OCR required' : 'searchable text';
          pages.push({
            number: n,
            text,
            lines,
            status,
            reason: blank
              ? 'Very little text and near-empty rendered page'
              : sparse
                ? 'Visible marks without sufficient searchable text; OCR not performed'
                : images
                  ? 'Searchable text with images; image text is not checked'
                  : 'Searchable text extracted',
            signals: { inkRatio, images },
            visualGap: images > 0 && !blank,
          });
        } catch (e) {
          pages.push({ number: n, text: '', status: 'extraction error', reason: e.message });
        }
      }
    } finally {
      await task.destroy();
    }
    if (pages.some((p) => p.visualGap))
      limitations.push(
        'Embedded images may contain unextracted text or headings. Inspect original pages; OCR not performed.',
      );
  } else if (ext === 'docx') {
    const { parseDocx } = await import('./docx.js');
    const result = await parseDocx(await file.arrayBuffer());
    pages = result.pages;
    limitations = result.limitations;
  } else if (ext === 'txt')
    pages = (await file.text()).split('\f').map((text, i) => ({
      number: i + 1,
      text,
      status: text.trim() ? 'searchable text' : 'likely blank',
    }));
  else throw new Error('Choose a PDF, DOCX, or TXT file.');
  const doc = {
    id,
    name: file.name,
    type: ext.toUpperCase(),
    size: file.size,
    version: 1,
    pages,
    originalPageCount: pages.length,
    limitations,
  };
  try {
    await saveOriginal(id, file);
    doc.originalKey = id;
  } catch (e) {
    doc.storageWarning = `Original could not be saved (${e.name || e.message}); reattach it to view. Extracted text and notes are retained separately.`;
  }
  return doc;
}
export function failedFile(file, error) {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.name.split('.').pop().toUpperCase(),
    size: file.size,
    version: 1,
    pages: [],
    rejected: true,
    error: error.message,
    limitations: [error.message],
  };
}
