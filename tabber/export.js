/**
 * export.js — helpers for print CSS generation and file naming
 */

/**
 * Build the @page CSS block for printing.
 * @param {{ width: number, height: number }} pageSize  — in CSS px
 * @param {boolean} portrait
 * @returns {string}
 */
export function buildPrintCSS(pageSize, portrait) {
  const w   = (pageSize.width  / 96).toFixed(4);
  const h   = (pageSize.height / 96).toFixed(4);
  const ori = portrait ? 'portrait' : 'landscape';
  return [
    `@page {`,
    `  size: ${w}in ${h}in ${ori};`,
    `  margin: 0;`,
    `}`,
    `.page {`,
    `  page-break-after: always;`,
    `  break-after: page;`,
    `}`,
    `.page:last-of-type {`,
    `  page-break-after: avoid;`,
    `  break-after: avoid;`,
    `}`,
  ].join('\n');
}

/**
 * Filename for a PNG export of a given page number.
 * Zero-padded to two digits: tab-page-01.png
 * @param {number} pageNumber  — 1-based
 * @returns {string}
 */
export function pageFilename(pageNumber) {
  return `tab-page-${String(pageNumber).padStart(2, '0')}.png`;
}
