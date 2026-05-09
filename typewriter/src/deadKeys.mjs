// Dead key → bare diacritic character lookup.
// Keyed by e.key value from keydown when the browser reports a dead key.
// The browser sets e.key to strings like "Dead" (generic) or the actual
// composed diacritic. We use the composed char as key since keydown e.key
// for dead keys is the diacritic glyph on most platforms (macOS/Linux).
// On Windows, e.key is literally "Dead"; we handle both.

export const DEAD_KEY_CHAR = {
  // Backtick / grave
  'Dead`':  '\u0060',  // `
  'Dead\u0060': '\u0060',
  '\u0060': '\u0060',

  // Acute accent
  "Dead'":  '\u00b4',  // ´
  '\u00b4': '\u00b4',

  // Circumflex
  'Dead^':  '\u005e',  // ^
  '\u005e': '\u005e',
  'Dead\u02c6': '\u005e',

  // Tilde
  'Dead~':  '\u007e',  // ~
  '\u007e': '\u007e',
  'Dead\u02dc': '\u007e',

  // Diaeresis / umlaut
  'Dead"':  '\u00a8',  // ¨
  '\u00a8': '\u00a8',
  'Dead\u00a8': '\u00a8',

  // Caron / háček
  'Dead\u02c7': '\u02c7',

  // Ring
  'Dead\u02da': '\u02da',

  // Cedilla
  'Dead\u00b8': '\u00b8',

  // Dot above
  'Dead\u02d9': '\u02d9',

  // Double acute
  'Dead\u02dd': '\u02dd',

  // Ogonek
  'Dead\u02db': '\u02db',

  // Greek diacritics
  '\u0384': '\u0384',  // tonos
  '\u0385': '\u0385',  // dialytika tonos
};
