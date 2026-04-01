import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import Aurora from '@/components/Aurora';

const AURORA_STOPS = ['#66ffc4', '#ffce1f', '#ff9029'];

export default function InitialPage() {
  const router = useRouter();
  const borderWidth = useSharedValue(2);
  const borderOpacity = useSharedValue(0.6);
  const scale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    borderWidth: borderWidth.value,
    borderColor: `rgba(255, 255, 255, ${borderOpacity.value})`,
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    borderWidth.value = withSpring(7, { damping: 10, stiffness: 200 });
    borderOpacity.value = withTiming(1, { duration: 150 });
    scale.value = withSpring(0.97, { damping: 15 });
  }

  function handlePressOut() {
    borderWidth.value = withSpring(2, { damping: 12, stiffness: 180 });
    borderOpacity.value = withTiming(0.6, { duration: 200 });
    scale.value = withSpring(1, { damping: 12 });
    setTimeout(() => router.push('/connection'), 120);
  }

  return (
    <View style={styles.container}>
      <Aurora colorStops={AURORA_STOPS} blend={0.59} amplitude={1.0} speed={1.1} />

      <View style={styles.content}>
        <Text style={styles.title}>Infant Security</Text>

        <Animated.View
          style={[styles.button, buttonStyle]}
          // @ts-ignore — web pressable via onPointerDown
          onStartShouldSetResponder={() => true}
          onResponderGrant={handlePressIn}
          onResponderRelease={handlePressOut}
          onResponderTerminate={handlePressOut}>
          <Text style={styles.buttonText}>Connect to Device</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050a10',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
