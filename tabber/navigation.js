/**
 * navigation.js — pure cursor movement helpers
 *
 * All functions take a cursor {staffIdx, colIdx} and a doc {staves, cols}
 * and return a new cursor object. They never mutate.
 *
 * stringIdx is not tracked here — vertical movement is trivial and handled inline.
 */

/**
 * Move cursor one column to the right.
 * Wraps to col 0 of the next staff. Clamps at last col of last staff.
 */
export function cursorMoveRight({ staffIdx, colIdx }, doc) {
  const maxCol   = doc.cols - 1;
  const maxStaff = doc.staves.length - 1;
  if (colIdx < maxCol)     return { staffIdx, colIdx: colIdx + 1 };
  if (staffIdx < maxStaff) return { staffIdx: staffIdx + 1, colIdx: 0 };
  return { staffIdx, colIdx };
}

/**
 * Move cursor one column to the left.
 * Wraps to last col of the previous staff. Clamps at col 0 of staff 0.
 */
export function cursorMoveLeft({ staffIdx, colIdx }, doc) {
  if (colIdx > 0)   return { staffIdx, colIdx: colIdx - 1 };
  if (staffIdx > 0) return { staffIdx: staffIdx - 1, colIdx: doc.cols - 1 };
  return { staffIdx, colIdx };
}

/**
 * Jump to the next barline column in the current staff.
 * If none remain, jump to col 0 of the next staff.
 */
export function cursorJumpNextBar({ staffIdx, colIdx }, doc) {
  const staff = doc.staves[staffIdx];
  const next  = staff.barlines.find(b => b > colIdx);
  if (next !== undefined)                return { staffIdx, colIdx: next };
  if (staffIdx < doc.staves.length - 1) return { staffIdx: staffIdx + 1, colIdx: 0 };
  return { staffIdx, colIdx };
}

/**
 * Jump to the previous barline column.
 * From col 0: wraps to last col of previous staff.
 */
export function cursorJumpPrevBar({ staffIdx, colIdx }, doc) {
  const staff = doc.staves[staffIdx];
  if (colIdx > 0) {
    const prev = [...staff.barlines].reverse().find(b => b < colIdx);
    if (prev !== undefined) return { staffIdx, colIdx: prev };
    return { staffIdx, colIdx: 0 };
  }
  if (staffIdx > 0) return { staffIdx: staffIdx - 1, colIdx: doc.cols - 1 };
  return { staffIdx, colIdx };
}

/**
 * Convert a global staff index to { pageIdx, localStaffIdx }.
 */
export function globalToLocal(globalIdx, perPage) {
  return {
    pageIdx:       Math.floor(globalIdx / perPage),
    localStaffIdx: globalIdx % perPage,
  };
}

/**
 * Convert page index + local staff index to global staff index.
 */
export function localToGlobal(pageIdx, localStaffIdx, perPage) {
  return pageIdx * perPage + localStaffIdx;
}
