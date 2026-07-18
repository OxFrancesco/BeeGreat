import type { Mood } from '@/lib/bee-healthy';

/** Doctor bee mascot shown before a mood is checked in. */
export const BEE_DOCTOR_SOURCE = require('../../../assets/images/bee-doctor.png');

export const MOOD_BEE_SOURCES = {
  awful: require('../../../assets/images/moods/bee-awful.png'),
  bad: require('../../../assets/images/moods/bee-bad.png'),
  okay: require('../../../assets/images/moods/bee-okay.png'),
  good: require('../../../assets/images/moods/bee-good.png'),
  great: require('../../../assets/images/moods/bee-great.png'),
} as const satisfies Record<Mood, number>;
