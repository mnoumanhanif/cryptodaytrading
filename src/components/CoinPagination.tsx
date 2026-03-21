'use client';

// ============================================================
// Reusable pagination control
// Shows prev/next, page number buttons, and a jump-to-page input
// ============================================================

import { useState, useEffect } from 'react';

interface CoinPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Build an array of page numbers (and '…' placeholders) for the button row */
function buildPageItems(current: number, total: number): (number | '…')[] {
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: (number | '…')[] = [1];
  if (current > 4) items.push('…');
  for (
    let p = Math.max(2, current - 2);
    p <= Math.min(total - 1, current + 2);
    p++
  ) {
    items.push(p);
  }
  if (current < total - 3) items.push('…');
  items.push(total);
  return items;
}

export default function CoinPagination({
  currentPage,
  totalPages,
  onPageChange,
}: CoinPaginationProps) {
  const [jumpValue, setJumpValue] = useState(String(currentPage));

  // Sync jump input when external page changes
  useEffect(() => {
    setJumpValue(String(currentPage));
  }, [currentPage]);

  const goTo = (p: number) => {
    const clamped = Math.min(Math.max(p, 1), totalPages);
    if (clamped !== currentPage) onPageChange(clamped);
  };

  const handleJump = () => {
    const p = parseInt(jumpValue, 10);
    if (!isNaN(p)) goTo(p);
  };

  const pageItems = buildPageItems(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      {/* Page buttons row */}
      <div className="flex flex-wrap items-center gap-1">
        {/* First / Prev */}
        <button
          onClick={() => goTo(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="First page"
        >
          «
        </button>
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2.5 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          ‹ Prev
        </button>

        {/* Page number buttons */}
        {pageItems.map((item, idx) =>
          item === '…' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-gray-600 text-xs select-none">
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => goTo(item)}
              className={`min-w-[28px] h-7 text-xs rounded transition-colors ${
                item === currentPage
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              aria-current={item === currentPage ? 'page' : undefined}
            >
              {item}
            </button>
          )
        )}

        {/* Next / Last */}
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2.5 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          Next ›
        </button>
        <button
          onClick={() => goTo(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Last page"
        >
          »
        </button>
      </div>

      {/* Page indicator + jump input */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="font-medium text-gray-300">
          Page {currentPage} of {totalPages}
        </span>
        <span className="text-gray-700">|</span>
        <label htmlFor="page-jump" className="sr-only">
          Jump to page
        </label>
        <span>Go to:</span>
        <input
          id="page-jump"
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJump()}
          className="w-12 bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-white text-center
                     focus:outline-none focus:border-blue-500 [appearance:textfield]
                     [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          onClick={handleJump}
          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          Go
        </button>
      </div>
    </div>
  );
}
