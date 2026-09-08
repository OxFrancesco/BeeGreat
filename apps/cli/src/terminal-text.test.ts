import { expect, test } from 'bun:test';
import { terminalText } from './terminal-text';
test('untrusted terminal text cannot issue commands or rewrite displayed approval details', () => {
  expect(terminalText('\x1b]52;c;clipboard\x07Send 10 USDC\x1b[2J\r\b to 0x123')).toBe('Send 10 USDC to 0x123');
  expect(terminalText('\x9b2Jhello\x1b]8;;https://bad.test\x1b\\link\x1b]8;;\x1b\\')).toBe('hellolink');
  expect(terminalText('Caffè\n\t10 USDC → 0x123')).toBe('Caffè\n\t10 USDC → 0x123');
});
