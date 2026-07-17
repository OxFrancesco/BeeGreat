import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { localDateKey } from '@/lib/bee-healthy';

type LocalDaySnapshot = {
  date: Date;
  localDate: string;
  timeZone: string;
};

function createSnapshot(): LocalDaySnapshot {
  const date = new Date();

  return {
    date,
    localDate: localDateKey(date),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

function millisecondsUntilTomorrow(now = new Date()) {
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    1,
  );

  return Math.max(1, tomorrow.getTime() - now.getTime());
}

/** Keeps calendar-day queries aligned with local midnight and timezone changes. */
export function useCurrentLocalDay() {
  const [snapshot, setSnapshot] = useState(createSnapshot);

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;

    const refresh = () => {
      setSnapshot(createSnapshot());
    };
    const scheduleMidnightRefresh = () => {
      clearTimeout(midnightTimer);
      midnightTimer = setTimeout(() => {
        refresh();
        scheduleMidnightRefresh();
      }, millisecondsUntilTomorrow());
    };

    scheduleMidnightRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        scheduleMidnightRefresh();
      }
    });

    return () => {
      clearTimeout(midnightTimer);
      subscription.remove();
    };
  }, []);

  return snapshot;
}
