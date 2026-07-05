/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Palette derived from docs/DESIGN_SYSTEM.md */
export const Colors = {
  light: {
    text: '#202020',
    background: '#f9f9f9',
    backgroundElement: '#efefef',
    backgroundSelected: '#e8e8e8',
    textSecondary: '#646464',
    card: '#fcfcfc',
    primary: '#644a40',
    primaryForeground: '#ffffff',
    secondary: '#ffdfb5',
    secondaryForeground: '#582d1d',
    border: '#d8d8d8',
    destructive: '#e54d2e',
  },
  dark: {
    text: '#eeeeee',
    background: '#111111',
    backgroundElement: '#222222',
    backgroundSelected: '#2a2a2a',
    textSecondary: '#b4b4b4',
    card: '#191919',
    primary: '#ffe0c2',
    primaryForeground: '#081a1b',
    secondary: '#393028',
    secondaryForeground: '#ffe0c2',
    border: '#201e18',
    destructive: '#e54d2e',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
