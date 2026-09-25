import { stripVTControlCharacters } from 'node:util';

const displayControls = new RegExp(`[${String.fromCodePoint(0)}-${String.fromCodePoint(8)}${String.fromCodePoint(11)}-${String.fromCodePoint(31)}${String.fromCodePoint(127)}-${String.fromCodePoint(159)}]`, 'g');

/** Strip terminal commands and rewriting controls from untrusted display text. */
export function terminalText(text: string): string {
  return stripVTControlCharacters(text).replace(displayControls, '');
}
