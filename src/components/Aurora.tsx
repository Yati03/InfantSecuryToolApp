import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface AuroraProps {
  colorStops: string[];
  blend: number;
  amplitude: number;
  speed: number;
}

interface BlobProps {
  color: string;
  top: string;
  delay: number;
  amplitude: number;
  duration: number;
}

function AuroraBlob({ color, top, delay, amplitude, duration }: BlobProps) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const drift = amplitude * 80;
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(drift, { duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.15, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - amplitude * 40 }, { scale: scale.value }],
  }));

  return <Animated.View style={[styles.blob, { backgroundColor: color, top: top as any }, animatedStyle]} />;
}

export default function Aurora({ colorStops, blend, amplitude, speed }: AuroraProps) {
  const duration = Math.round(4000 / speed);
  const stops = colorStops.slice(0, 3);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, { opacity: blend }]} pointerEvents="none">
      {stops.map((color, i) => (
        <AuroraBlob
          key={i}
          color={color}
          top={`${15 + i * 28}%`}
          delay={i * Math.round(duration / stops.length)}
          amplitude={amplitude}
          duration={duration}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#050a10',
  },
  blob: {
    position: 'absolute',
    width: '220%',
    height: '45%',
    borderRadius: 9999,
    left: '-60%',
    opacity: 0.55,
  },
});
