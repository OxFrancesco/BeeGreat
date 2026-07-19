import { formatJournalDate } from '@/lib/bee-healthy';

export function journalShareText(entry: {
  localDate: string;
  title: string;
  body: string;
  tags: string[];
}) {
  return [
    entry.title.trim(),
    formatJournalDate(entry.localDate),
    entry.body.trim(),
    entry.tags.length ? entry.tags.map((tag) => `#${tag.replace(/\s+/g, '')}`).join(' ') : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
