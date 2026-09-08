import { questionAnswer } from '@beegreat/tool-presentation';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UIComponent } from '@/lib/ui-spec';

import { Card, sharedStyles } from './shared';

export function QuestionCard({
  questions,
  onReply,
}: Extract<UIComponent, { type: 'question' }> & {
  onReply?: (text: string) => void | Promise<void>;
}) {
  const theme = useTheme();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const allQuestionsAnswered = questions.length > 0 && questions.every((_, index) => answers[index]?.trim());

  const reply = async (text: string) => {
    if (!onReply || sending || sent || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(undefined);
    try {
      await onReply(text);
      setSent(true);
    } catch {
      setError('Could not send your answer. Try again.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const choose = (questionIndex: number, prompt: string, label: string) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync().catch(() => {});
    if (questions.length === 1) {
      void reply(questionAnswer(prompt, label));
      return;
    }
    setAnswers((current) => ({ ...current, [questionIndex]: label }));
  };

  return (
    <Card>
      {questions.map((question, questionIndex) => (
        <View
          key={`${question.header}-${questionIndex}`}
          style={[
            styles.questionPrompt,
            questionIndex > 0 && {
              borderTopColor: theme.border,
              borderTopWidth: StyleSheet.hairlineWidth,
              paddingTop: Spacing.three,
            },
          ]}
          accessibilityRole="summary"
        >
          <ThemedText type="smallBold" themeColor="textSecondary">
            {question.header}
          </ThemedText>
          <ThemedText>{question.question}</ThemedText>
          {question.options?.length ? (
            <View style={styles.questionOptions}>
              {question.options.map((option) => {
                const selected = answers[questionIndex] === option.label;
                return (
                  <Pressable
                    key={option.label}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                      disabled: !onReply || sending || sent,
                    }}
                    accessibilityLabel={
                      option.description
                        ? `${option.label}. ${option.description}`
                        : option.label
                    }
                    disabled={!onReply || sending || sent}
                    onPress={() =>
                      choose(questionIndex, question.question, option.label)
                    }
                    style={({ pressed }) => [
                      styles.questionOption,
                      {
                        backgroundColor: selected
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                      pressed && sharedStyles.taskRowPressed,
                    ]}
                  >
                    <ThemedText type="smallBold">{option.label}</ThemedText>
                    {option.description ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {option.description}
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : <TextInput
            accessibilityLabel={question.question}
            value={answers[questionIndex] ?? ''}
            onChangeText={(value) => setAnswers((current) => ({ ...current, [questionIndex]: value }))}
            editable={!!onReply && !sending && !sent}
            multiline
            style={[styles.questionOption, { color: theme.text, borderColor: theme.border }]}
          />}
        </View>
      ))}
      {allQuestionsAnswered ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit answers"
          disabled={!onReply || sending || sent}
          onPress={() =>
            void reply(
              questions
                .map((question, index) =>
                  questionAnswer(question.question, answers[index]?.trim() ?? ''),
                )
                .join('\n'),
            )
          }
          style={({ pressed }) => [
            styles.questionSubmit,
            { backgroundColor: theme.primary },
            (pressed || sent) && sharedStyles.taskRowPressed,
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{ color: theme.primaryForeground }}
          >
            {sent ? 'Answered' : 'Continue'}
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {sent ? 'Answer sent.' : 'Or type your own answer below.'}
        </ThemedText>
      )}
      {error ? <ThemedText accessibilityRole="alert" themeColor="destructive">{error}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  questionPrompt: {
    gap: Spacing.two,
  },
  questionOptions: {
    gap: Spacing.two,
  },
  questionOption: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    gap: Spacing.half,
  },
  questionSubmit: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
});
