import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pageSize = 5, total, itemName, label, onPageChange }) {
  if (!total) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageNumbers =
    pageCount <= 5
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : currentPage <= 3
        ? [1, 2, 3, 'end-gap', pageCount]
        : currentPage >= pageCount - 2
          ? [1, 'start-gap', pageCount - 2, pageCount - 1, pageCount]
          : [1, 'start-gap', currentPage, 'end-gap', pageCount];
  return (
    <nav className="review-pagination" aria-label={label}>
      <div className="review-pagination-summary" role="status">
        <span className="review-pagination-range">
          Showing {start + 1}–{Math.min(start + pageSize, total)} of {total} {itemName}
        </span>
        <span className="review-pagination-position">
          Page {currentPage} of {pageCount}
        </span>
      </div>
      <div className="review-pagination-controls">
        <button
          className="button pagination-step"
          aria-label="Previous"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
          <span>Previous</span>
        </button>
        {pageNumbers.map((number) =>
          typeof number === 'number' ? (
            <button
              key={number}
              className="button pagination-page"
              aria-label={`Page ${number}`}
              aria-current={number === currentPage ? 'page' : undefined}
              onClick={() => onPageChange(number)}
            >
              {number}
            </button>
          ) : (
            <span key={number} className="pagination-gap" aria-hidden="true">
              …
            </span>
          ),
        )}
        <button
          className="button pagination-step"
          aria-label="Next"
          disabled={currentPage === pageCount}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <span>Next</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
