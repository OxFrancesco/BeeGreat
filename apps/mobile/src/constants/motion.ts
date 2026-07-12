import { Easing } from 'react-native-reanimated';

export const MotionDuration = {
  pressIn: 100,
  pressOut: 160,
  exit: 150,
  enter: 200,
  progress: 240,
} as const;

export const MotionEasing = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
} as const;

export const MotionScale = {
  pressed: 0.97,
  enter: 0.94,
} as const;
