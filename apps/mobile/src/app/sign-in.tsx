import { useSSO } from '@clerk/clerk-expo';
import { Canvas, Group, ImageSVG, Path, useSVG } from '@shopify/react-native-skia';
import * as AuthSession from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingBee } from '@/components/floating-bee';
import { makeRoundedPolygonPath } from '@/components/hex-avatar';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

/** Palette lifted from docs/design/Initial-Page.svg */
const Hive = {
  cream: '#FEF6E5',
  honey: '#FAB52A',
  amber: '#D88909',
  cacao: '#482401',
  bark: '#794D20',
  destructive: '#e54d2e',
} as const;

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
  const { width } = useWindowDimensions();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heroWidth = Math.min(width, MaxContentWidth);
  const scale = heroWidth / SVG_WIDTH;
  const heroHeight = ART_HEIGHT * scale;

  const signIn = useCallback(async () => {
    if (pending) return;
    setPending(true);
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
    } catch {
      setError("Couldn't sign you in. Try again.");
    } finally {
      setPending(false);
    }
  }, [pending, startSSOFlow]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeInDown.springify().damping(16)}>
          <Canvas style={{ width: heroWidth, height: heroHeight }}>
            {svg ? (
              <Group transform={[{ scale }]}>
                <ImageSVG svg={svg} x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} />
              </Group>
            ) : null}
          </Canvas>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.copy}>
          <FloatingBee style={styles.bee} />
          <Text style={styles.wordmark}>BeeGreat</Text>
          <Text style={styles.tagline}>
            One hive for your goals.{'\n'}Talk, plan, and make every day count.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(350).duration(500)} style={styles.actions}>
          <HexButton label="Sign in with Google" busy={pending} onPress={signIn} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const BUTTON_HEIGHT = 56;
/** Horizontal run of the angled honeycomb ends (120-degree corners). */
const HEX_END_INSET = BUTTON_HEIGHT / (2 * Math.tan(Math.PI / 3));

/** A wide honeycomb-cell button: flat top and bottom, pointed ends. */
function HexButton({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  const [buttonWidth, setButtonWidth] = useState(0);

  const path = useMemo(() => {
    if (buttonWidth === 0) return null;
    const w = buttonWidth;
    const h = BUTTON_HEIGHT;
    const inset = HEX_END_INSET;
    return makeRoundedPolygonPath(
      [
        { x: 0, y: h / 2 },
        { x: inset, y: 0 },
        { x: w - inset, y: 0 },
        { x: w, y: h / 2 },
        { x: w - inset, y: h },
        { x: inset, y: h },
      ],
      8,
    );
  }, [buttonWidth]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={(event) => setButtonWidth(event.nativeEvent.layout.width)}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      {path ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={path} color={Hive.cacao} />
        </Canvas>
      ) : null}
      {busy ? (
        <ActivityIndicator color={Hive.cream} />
      ) : (
        <Text style={styles.buttonLabel}>{label}</Text>
      )}
    </Pressable>
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
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    height: BUTTON_HEIGHT,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  buttonLabel: {
    fontFamily: Fonts?.rounded,
    fontSize: 17,
    fontWeight: '600',
    color: Hive.cream,
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
});
