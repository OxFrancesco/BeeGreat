import { expect, test } from 'bun:test';
import { renderBeeUiMarkdown, uiComponentSchema } from './beeui';

test('CRM renders contact snapshots in text channels without machine ids', () => {
  const component = uiComponentSchema.parse({ type: 'crm', contacts: [{ id: 'machine-contact-id', name: 'Alex', context: 'Design friend', note: 'Ask about the exhibition', followUpOn: '2026-09-20' }] });
  const result = renderBeeUiMarkdown(component);
  expect(result.markdown).toContain('Follow up: 2026-09-20');
  expect(result.markdown).toContain('Alex');
  expect(result.markdown).not.toContain('machine-contact-id');
  expect(result.links).toEqual([]);
});

test('CRM contract rejects malformed dates and limits card size', () => {
  expect(uiComponentSchema.safeParse({ type: 'crm', contacts: [{ id: 'id', name: 'Alex', followUpOn: 'tomorrow' }] }).success).toBe(false);
  expect(uiComponentSchema.safeParse({ type: 'crm', contacts: Array.from({ length: 31 }, () => ({ id: 'id', name: 'Alex' })) }).success).toBe(false);
  expect(renderBeeUiMarkdown({ type: 'crm', contacts: [] }).markdown).toBe('No contacts found.');
});
