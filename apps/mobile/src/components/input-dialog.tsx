import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Button = { text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: (text?: string) => unknown };
type Dialog = { title: string; message?: string; buttons: Button[]; initialValue?: string };
type DialogApi = {
  alert: (title: string, message?: string, buttons?: Button[]) => void;
  prompt: (title: string, message: string | undefined, buttons: Button[], type: 'plain-text', initialValue: string) => void;
};
const DialogContext = createContext<DialogApi | null>(null);

export function useInputDialog() {
  const value = use(DialogContext);
  if (!value) throw new Error('InputDialogProvider is missing');
  return value;
}

export function InputDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [text, setText] = useState('');
  const active = useRef<Dialog | null>(null);
  const theme = useTheme();
  const open = useCallback((next: Dialog) => {
    active.current = next;
    setText(next.initialValue ?? '');
    setDialog(next);
  }, []);
  const api = useMemo<DialogApi>(() => ({
    alert(title, message, buttons = [{ text: 'OK' }]) {
      if (process.env.EXPO_OS === 'ios') Alert.alert(title, message, buttons);
      else open({ title, message, buttons });
    },
    prompt(title, message, buttons, type, initialValue) {
      if (process.env.EXPO_OS === 'ios') Alert.prompt(title, message, buttons, type, initialValue);
      else open({ title, message, buttons, initialValue });
    },
  }), [open]);
  function choose(button?: Button) {
    if (!dialog || active.current !== dialog) return;
    active.current = null;
    setDialog(null);
    try {
      void Promise.resolve(button?.onPress?.(text.trim())).catch(() => Alert.alert('Could not save changes', 'Try again.'));
    } catch {
      Alert.alert('Could not save changes', 'Try again.');
    }
  }
  return <DialogContext value={api}>
    {children}
    <Modal transparent visible={dialog !== null} animationType="fade" onRequestClose={() => choose(dialog?.buttons.find((button) => button.style === 'cancel'))}>
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: Spacing.four, backgroundColor: '#00000080' }}>
        <View accessibilityViewIsModal style={{ maxHeight: '85%', backgroundColor: theme.card, padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three }}>
          <ThemedText type="subtitle">{dialog?.title}</ThemedText>
          {dialog?.message ? <ThemedText>{dialog.message}</ThemedText> : null}
          {dialog?.initialValue !== undefined ? <TextInput autoFocus accessibilityLabel={dialog.title} value={text} onChangeText={setText} selectTextOnFocus style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three }} /> : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.one }}>
            {dialog?.buttons.map((button, index) => <Pressable
              key={`${index}-${button.text}`}
              accessibilityRole="button"
              disabled={dialog.initialValue !== undefined && button.style !== 'cancel' && !text.trim()}
              onPress={() => choose(button)}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.two }}
            ><ThemedText themeColor={button.style === 'destructive' ? 'destructive' : 'text'}>{button.text}</ThemedText></Pressable>)}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </DialogContext>;
}
