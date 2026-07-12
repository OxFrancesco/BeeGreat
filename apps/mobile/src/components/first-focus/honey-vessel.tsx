import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { MotionDuration, MotionEasing } from "@/constants/motion";
import { Spacing } from "@/constants/theme";

export const MVP_HONEY_CAPACITY = 100;

const VESSEL_SOURCE = require("../../../assets/images/hive-vessel.png");
const MAX_VESSEL_SIZE = 340;

export function HoneyVessel({ balance }: { balance: number }) {
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const vesselSize = Math.min(width - Spacing.three * 2, MAX_VESSEL_SIZE);
  const cavityHeight = vesselSize * 0.52;
  const clampedBalance = Math.min(Math.max(balance, 0), MVP_HONEY_CAPACITY);
  const overflow = Math.max(balance - MVP_HONEY_CAPACITY, 0);
  const fillRatio = clampedBalance / MVP_HONEY_CAPACITY;
  const percentage = Math.round(fillRatio * 100);
  const fillTranslateY = useSharedValue(cavityHeight * (1 - fillRatio));

  useEffect(() => {
    const nextTranslateY = cavityHeight * (1 - fillRatio);
    cancelAnimation(fillTranslateY);
    fillTranslateY.value = reducedMotion
      ? nextTranslateY
      : withTiming(nextTranslateY, {
          duration: MotionDuration.progress,
          easing: MotionEasing.out,
        });
    return () => cancelAnimation(fillTranslateY);
  }, [cavityHeight, fillRatio, fillTranslateY, reducedMotion]);

  const animatedFill = useAnimatedStyle(() => ({
    transform: [{ translateY: fillTranslateY.value }],
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Hive Honey vessel"
      accessibilityValue={{
        min: 0,
        max: MVP_HONEY_CAPACITY,
        now: clampedBalance,
        text:
          overflow > 0
            ? `${balance} Honey, vessel full with ${overflow} Honey in overflow`
            : `${balance} of ${MVP_HONEY_CAPACITY} Honey, ${percentage}% full`,
      }}
      style={styles.container}
    >
      <View style={[styles.vessel, { width: vesselSize, height: vesselSize }]}>
        <View
          pointerEvents="none"
          style={[
            styles.cavity,
            {
              left: vesselSize * 0.235,
              top: vesselSize * 0.315,
              width: vesselSize * 0.53,
              height: cavityHeight,
              borderRadius: vesselSize * 0.16,
            },
          ]}
        >
          <Animated.View style={[styles.honey, { height: cavityHeight }, animatedFill]}>
            <View style={styles.honeySurface} />
            <View style={styles.honeyGlow} />
          </Animated.View>
        </View>
        <Image
          source={VESSEL_SOURCE}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: Spacing.two,
  },
  vessel: {
    position: "relative",
  },
  cavity: {
    position: "absolute",
    overflow: "hidden",
  },
  honey: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "#D88608",
  },
  honeySurface: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#FFC33D",
  },
  honeyGlow: {
    position: "absolute",
    top: 8,
    left: "16%",
    width: "22%",
    height: "72%",
    borderRadius: 999,
    backgroundColor: "rgba(255, 222, 121, 0.28)",
  },
});
