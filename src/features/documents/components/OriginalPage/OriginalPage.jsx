import React, { useEffect, useRef, useState } from 'react';
import { getOriginal } from '../../originals.js';
import { pdfLibrary } from '../../parser.js';

export function OriginalPage({ document: doc, page }) {
  const canvas = useRef(),
    [message, setMessage] = useState('Loading original…');
  useEffect(() => {
    let cancelled = false,
      task,
      render;
    setMessage('Loading original…');
    (async () => {
      try {
        if (doc?.type !== 'PDF') {
          setMessage(
            doc?.type === 'DOCX'
              ? 'DOCX citations are paragraphs/segments; original pagination is unavailable.'
              : 'This text document has no original page layout. Select Text to inspect its source.',
          );
          return;
        }
        const blob = await getOriginal(doc.originalKey);
        if (cancelled) return;
        if (!blob) {
          setMessage(
            doc.storageWarning ||
              'Original unavailable for this legacy record. Reattach the original using the same filename to view it.',
          );
          return;
        }
        const pdfjs = await pdfLibrary();
        if (cancelled) return;
        task = pdfjs.getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
          isEvalSupported: false,
        });
        const pdf = await task.promise;
        const p = await pdf.getPage(page);
        if (cancelled) return;
        const view = p.getViewport({ scale: 1 });
        const scale = Math.min(1.4, 640 / view.width);
        const viewport = p.getViewport({ scale });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        render = p.render({ canvasContext: canvas.current.getContext('2d'), viewport });
        await render.promise;
        if (!cancelled) setMessage('');
      } catch (e) {
        if (!cancelled)
          setMessage(`Original view unavailable: ${e.message}. Reattach the original if needed.`);
      }
    })();
    return () => {
      cancelled = true;
      render?.cancel();
      task?.destroy();
    };
  }, [doc?.originalKey, page]);
  return (
    <div className="original-page">
      <strong>
        {doc?.type === 'PDF'
          ? 'Original layout · Page'
          : 'Original pagination unavailable · Paragraph'}{' '}
        {page}
      </strong>
      {message && <p role="status">{message}</p>}
      <canvas
        ref={canvas}
        aria-label={`Original PDF page ${page}`}
        style={{ display: message ? 'none' : 'block' }}
      />
    </div>
  );
}
