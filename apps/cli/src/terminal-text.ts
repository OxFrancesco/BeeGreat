import { stripVTControlCharacters } from 'node:util';

/** Strip terminal commands and rewriting controls from untrusted display text. */
export function terminalText(text: string): string {
  return stripVTControlCharacters(text).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '');
}
