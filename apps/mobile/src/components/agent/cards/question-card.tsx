import { questionAnswer } from '@beegreat/tool-presentation';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UIComponent } from '@/lib/ui-spec';

import { Card, sharedStyles } from './shared';

export function QuestionCard({
  questions,
  onReply,
}: Extract<UIComponent, { type: 'question' }> & {
  onReply?: (text: string) => void;
}) {
  const theme = useTheme();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [sent, setSent] = useState(false);
  const allOptionQuestionsAnswered =
    questions.length > 1 &&
    questions.every(
      (question, index) => question.options?.length && answers[index],
    );

  const reply = (text: string) => {
    if (!onReply || sent) return;
    setSent(true);
    onReply(text);
  };

  const choose = (questionIndex: number, prompt: string, label: string) => {
    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
    if (questions.length === 1) {
      reply(questionAnswer(prompt, label));
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
                      disabled: !onReply || sent,
                    }}
                    accessibilityLabel={
                      option.description
                        ? `${option.label}. ${option.description}`
                        : option.label
                    }
                    disabled={!onReply || sent}
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
          ) : null}
        </View>
      ))}
      {allOptionQuestionsAnswered ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit answers"
          disabled={!onReply || sent}
          onPress={() =>
            reply(
              questions
                .map((question, index) =>
                  questionAnswer(question.question, answers[index] ?? ''),
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
