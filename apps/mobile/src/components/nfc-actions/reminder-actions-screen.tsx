import type { NfcActionTypeConfig } from './nfc-action-type-screen';
import { NfcActionTypeScreen } from './nfc-action-type-screen';

export function completionCopy(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'completion' : 'completions'}`;
}

const reminderConfig: NfcActionTypeConfig = {
  type: 'reminder',
  noun: 'reminder',
  header: { title: 'Reminders' },
  intro: {
    title: 'Tap the tag when it’s done',
    body: 'Put a tag where the task happens. Every scan counts one completion, from watering the plants to taking out the bins.',
    meta: (reminders) =>
      reminders.length > 0
        ? `${completionCopy(
            reminders.reduce((total, reminder) => total + reminder.completionCount, 0),
          )} across your reminders`
        : null,
  },
  listTitle: 'Your reminders',
  createTitle: 'New reminder',
  defaultLabel: 'Water the plants',
  labelPlaceholder: 'Water the plants',
  labelFieldName: 'Reminder name',
  editorHint: 'The same NFC tag will use the new name—no rewrite needed.',
  icon: {
    symbol: 'checkmark.circle.fill',
    glyph: '✓',
    colors: (theme) => ({
      background: theme.secondary,
      foreground: theme.secondaryForeground,
    }),
  },
  subtitle: (action) => completionCopy(action.completionCount),
  defaultDefinition: { type: 'reminder' },
};

export function ReminderActionsScreen() {
  return <NfcActionTypeScreen config={reminderConfig} />;
}
