import { useSignInWithApple, useSSO } from '@clerk/clerk-expo';
import { Canvas, Group, ImageSVG, useSVG } from '@shopify/react-native-skia';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingBee } from '@/components/floating-bee';
import { HexButton, Hive } from '@/components/hex-button';
import { MotionDuration } from '@/constants/motion';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { resolveAppleAuthenticationAvailability } from '@/lib/apple-auth-availability';
import { captureMobileFailure } from '@/lib/sentry';

WebBrowser.maybeCompleteAuthSession();

const PRIVACY_URL = 'https://beedocs.pages.dev/privacy';
const TERMS_URL = 'https://beedocs.pages.dev/terms';

// The scene is a 607x1080 page. Skia renders SVGs with absolute root
// dimensions at their native size, so every crop below is drawn through a
// scaled Group and clipped by its Canvas bounds — fully vector at any screen size.
const SVG_WIDTH = 607;
const SVG_HEIGHT = 1080;
/** The branch + hanging hive live in the top ~450 units of the scene. */
const ART_HEIGHT = 450;

export default function SignInScreen() {
  const svg = useSVG(require('../../assets/images/honeypot.svg'));
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [pending, setPending] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAuthenticationAvailable, setAppleAuthenticationAvailable] =
    useState(false);

  useEffect(() => {
    let active = true;

    void resolveAppleAuthenticationAvailability(
      process.env.EXPO_OS ?? 'unknown',
      AppleAuthentication.isAvailableAsync,
    ).then((available) => {
      if (active) setAppleAuthenticationAvailable(available);
    });

    return () => {
      active = false;
    };
  }, []);

  const heroWidth = Math.min(width, MaxContentWidth);
  const scale = heroWidth / SVG_WIDTH;
  const heroHeight = ART_HEIGHT * scale;

  const signInWithGoogle = useCallback(async () => {
    if (pending) return;
    setPending('google');
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (caught) {
      captureMobileFailure(caught, 'auth.sign_in.google');
      setError("Couldn't sign you in with Google. Try again.");
    } finally {
      setPending(null);
    }
  }, [pending, startSSOFlow]);

  const signInWithApple = useCallback(async () => {
    if (pending) return;
    setPending('apple');
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { createdSessionId, setActive } =
        await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
      // Closing Apple's native sheet is an intentional no-op.
    } catch (caught) {
      captureMobileFailure(caught, 'auth.sign_in.apple');
      setError("Couldn't sign you in with Apple. Try again.");
    } finally {
      setPending(null);
    }
  }, [pending, startAppleAuthenticationFlow]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          entering={
            reducedMotion
              ? FadeIn.duration(MotionDuration.enter)
              : FadeInDown.springify().damping(16)
          }
        >
          <Canvas style={{ width: heroWidth, height: heroHeight }}>
            {svg ? (
              <Group transform={[{ scale }]}>
                <ImageSVG svg={svg} x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} />
              </Group>
            ) : null}
          </Canvas>
        </Animated.View>

        <Animated.View
          entering={
            reducedMotion
              ? FadeIn.duration(MotionDuration.enter)
              : FadeIn.delay(200).duration(500)
          }
          style={styles.copy}
        >
          <FloatingBee style={styles.bee} />
          <Text style={styles.wordmark}>BeeGreat</Text>
          <Text style={styles.tagline}>
            One hive for your goals.{'\n'}Talk, plan, and make every day count.
          </Text>
        </Animated.View>

        <Animated.View
          entering={
            reducedMotion
              ? FadeIn.duration(MotionDuration.enter)
              : FadeIn.delay(350).duration(500)
          }
          style={styles.actions}
        >
          {appleAuthenticationAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              accessibilityLabel="Sign in with Apple"
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              cornerRadius={12}
              onPress={() => void signInWithApple()}
              style={styles.appleButton}
            />
          ) : null}
          <HexButton
            label="Sign in with Google"
            busy={pending === 'google'}
            onPress={() => void signInWithGoogle()}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
              style={styles.legalLink}
            >
              Terms of Use
            </Text>{' '}
            and acknowledge our{' '}
            <Text
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
              style={styles.legalLink}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Hive.cream,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.four,
  },
  copy: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  bee: {
    marginBottom: Spacing.three,
  },
  wordmark: {
    fontFamily: Fonts?.rounded,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Hive.cacao,
  },
  tagline: {
    fontFamily: Fonts?.sans,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: Hive.bark,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  appleButton: {
    width: '100%',
    height: 52,
  },
  error: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    textAlign: 'center',
    color: Hive.destructive,
  },
  legal: {
    fontFamily: Fonts?.sans,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: Hive.bark,
    opacity: 0.7,
    paddingHorizontal: Spacing.four,
  },
  legalLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
