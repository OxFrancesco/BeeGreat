import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dateFromLocalKey, localDateKey } from '@/lib/bee-healthy';

export type JournalMonthDay = {
  localDate: string;
  entryCount: number;
  hasPhoto: boolean;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function JournalCalendar({
  monthStart,
  days,
  selectedDate,
  today,
  onChangeMonth,
  onSelectDate,
}: {
  monthStart: string;
  days?: JournalMonthDay[];
  selectedDate: string | null;
  today: string;
  onChangeMonth: (monthStart: string) => void;
  onSelectDate: (localDate: string | null) => void;
}) {
  const theme = useTheme();
  const monthDate = dateFromLocalKey(monthStart);
  const todayMonth = monthStartForDate(today);
  const nextDisabled = monthStart >= todayMonth;
  const daysByDate = new Map((days ?? []).map((day) => [day.localDate, day]));
  const cells = buildMonthCells(monthStart);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.monthHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={Spacing.two}
          onPress={() => onChangeMonth(shiftMonth(monthStart, -1))}
          style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}
        >
          <SymbolView name="chevron.left" size={15} tintColor={theme.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show every journal entry"
          onPress={() => onSelectDate(null)}
          style={({ pressed }) => [styles.monthTitleButton, pressed && styles.pressed]}
        >
          <ThemedText selectable style={styles.monthTitle}>
            {monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </ThemedText>
          {selectedDate ? (
            <ThemedText type="small" themeColor="textSecondary">
              Clear day
            </ThemedText>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: nextDisabled }}
          disabled={nextDisabled}
          hitSlop={Spacing.two}
          onPress={() => onChangeMonth(shiftMonth(monthStart, 1))}
          style={({ pressed }) => [
            styles.arrowButton,
            nextDisabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView name="chevron.right" size={15} tintColor={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday, index) => (
          <ThemedText
            key={`${weekday}-${index}`}
            style={styles.weekday}
            themeColor="textSecondary"
          >
            {weekday}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((localDate, index) => {
          if (!localDate) return <View key={`empty-${index}`} style={styles.dayCell} />;
          const summary = daysByDate.get(localDate);
          const selected = selectedDate === localDate;
          const isToday = today === localDate;
          const future = localDate > today;
          return (
            <Pressable
              key={localDate}
              accessibilityRole="button"
              accessibilityLabel={`${dateFromLocalKey(localDate).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
              })}${summary ? `, ${summary.entryCount} ${summary.entryCount === 1 ? 'entry' : 'entries'}` : ', no entries'}`}
              accessibilityState={{ selected, disabled: future }}
              disabled={future}
              onPress={() => onSelectDate(selected ? null : localDate)}
              style={({ pressed }) => [
                styles.dayCell,
                selected && { backgroundColor: theme.secondary },
                isToday && !selected && { borderColor: '#E4A72C', borderWidth: 2 },
                future && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText style={styles.dayNumber}>{Number(localDate.slice(-2))}</ThemedText>
              {summary ? (
                <View style={styles.indicatorRow}>
                  {summary.hasPhoto ? (
                    <SymbolView name="photo.fill" size={9} tintColor={theme.primary} />
                  ) : (
                    <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                  )}
                  {summary.entryCount > 1 ? (
                    <ThemedText style={styles.count} themeColor="textSecondary">
                      {summary.entryCount}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function monthStartForDate(localDate: string) {
  return `${localDate.slice(0, 7)}-01`;
}

export function shiftMonth(monthStart: string, amount: number) {
  const date = dateFromLocalKey(monthStart);
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  return monthStartForDate(localDateKey(date));
}

function buildMonthCells(monthStart: string) {
  const first = dateFromLocalKey(monthStart);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      `${monthStart.slice(0, 8)}${String(day).padStart(2, '0')}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  monthHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  arrowButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  monthTitleButton: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 700,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 700,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 13,
    borderCurve: 'continuous',
  },
  dayNumber: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  indicatorRow: {
    height: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  count: {
    fontSize: 9,
    lineHeight: 10,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  disabled: {
    opacity: 0.28,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
