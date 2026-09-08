import { expect, test } from 'bun:test'
import { prepareGoogleArguments } from '../src/shared/google-workspace-arguments'
const directory = '/tmp/test-invocation'
test('rejects environment, symlink, response-file and output paths while preserving staged attachments', () => {
  for (const args of [
    ['gmail', 'drafts', 'create', '--attach', '/proc/self/environ'],
    ['gmail', 'drafts', 'create', '--attach=/tmp/link-to-token'],
    ['gmail', 'drafts', 'create', '--body-file', '/proc/1/environ'],
    ['gmail', 'drafts', 'create', '--signature-file=/etc/passwd'],
    ['gmail', 'drafts', 'create', '--attach', '@paths.txt'],
    ['drive', 'download', 'id', '--out', '/usr/local/bin/gog-agent-safe'],
    ['gmail', 'get', 'id', '--body-html-file=/proc/self/environ'],
  ]) expect(() => prepareGoogleArguments(args, [], directory)).toThrow()
  expect(prepareGoogleArguments(['gmail', 'drafts', 'create', '--body', '--attach=/proc/self/environ', '--attach=note.txt'], [{ name: 'note.txt', contentBase64: btoa('User-approved attachment text') }], directory)).toEqual(['gmail', 'drafts', 'create', '--body=--attach=/proc/self/environ', `--attach=${directory}/note.txt`])
  expect(() => prepareGoogleArguments(['gmail', 'search', 'text'], [{ name: '../environ', contentBase64: '' }], directory)).toThrow('filenames')
})

test('preserves Google boolean flags, date filters and leading-hyphen literal values', () => {
  for (const flag of ['--today', '--tomorrow', '--week']) expect(prepareGoogleArguments(['calendar', 'events', flag], [], directory)).toEqual(['calendar', 'events', flag])
  expect(prepareGoogleArguments(['calendar', 'create', 'primary', '--with-meet'], [], directory)).toEqual(['calendar', 'create', 'primary', '--with-meet'])
  expect(prepareGoogleArguments(['tasks', 'list', 'list-id', '--due-min', '2026-09-10T00:00:00Z'], [], directory)).toContain('--due-min=2026-09-10T00:00:00Z')
  expect(prepareGoogleArguments(['gmail', 'drafts', 'create', '--body=- reminder'], [], directory)).toContain('--body=- reminder')
})

test('uses each command contract and retains aliases without allowing file-reading aliases', () => {
  expect(prepareGoogleArguments(['calendar', 'events', '--location'], [], directory)).toContain('--location')
  expect(prepareGoogleArguments(['calendar', 'create', 'primary', '--location', 'Rome'], [], directory)).toContain('--location=Rome')
  expect(prepareGoogleArguments(['drive', 'ls', '--no-all-drives'], [], directory)).toContain('--no-all-drives')
  expect(prepareGoogleArguments(['gmail', 'search', 'x', '--oldest'], [], directory)).toContain('--oldest')
  expect(() => prepareGoogleArguments(['sheets', 'links', 'set', 'id', 'A1', '--cells-json=@/proc/self/environ'], [], directory)).toThrow()
})
