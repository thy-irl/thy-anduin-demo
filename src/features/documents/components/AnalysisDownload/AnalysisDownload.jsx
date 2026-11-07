import React from 'react';
import { Download } from 'lucide-react';
import './AnalysisDownload.css';

export function AnalysisDownload({ analysis, documents }) {
  return (
    <section className="analysis-export" aria-labelledby="analysis-export-title">
      <div className="analysis-export-copy">
        <h2 id="analysis-export-title">Export document analysis</h2>
        <p id="analysis-export-description">
          Download source references, detected headings, extracted terms and text coverage as JSON.
        </p>
      </div>
      <button
        className="button"
        aria-describedby="analysis-export-description"
        onClick={() => {
          const a = document.createElement('a'),
            url = URL.createObjectURL(
              new Blob(
                [
                  JSON.stringify(
                    {
                      context: analysis.context,
                      inventory: analysis.inventory,
                      references: analysis.references,
                      facts: analysis.facts,
                      coverage: analysis.coverage,
                      documents: documents.map((d) => ({
                        id: d.id,
                        name: d.name,
                        version: d.version,
                      })),
                    },
                    null,
                    2,
                  ),
                ],
                { type: 'application/json' },
              ),
            );
          a.href = url;
          a.download = 'preflight-diagnostics.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        <Download size={16} aria-hidden="true" />
        Download JSON
      </button>
    </section>
  );
}
