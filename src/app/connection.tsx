import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import Aurora from '@/components/Aurora';
import { connect } from '@/services/bleService';

const AURORA_STOPS = ['#66ffc4', '#ffce1f', '#ff9029'];
const TIMEOUT_MS = 60_000;

// ── Animated dot ─────────────────────────────────────────────────────────────

function Dot({ delay }: { delay: number }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.4, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0.5, { duration: 420, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420 }),
          withTiming(0.3, { duration: 420 }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

// ── Connection page ───────────────────────────────────────────────────────────

export default function ConnectionPage() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  const startConnection = useCallback(() => {
    setTimedOut(false);
    setIsConnecting(true);
    abortRef.current = false;

    timerRef.current = setTimeout(() => {
      if (!abortRef.current) setTimedOut(true);
    }, TIMEOUT_MS);

    connect()
      .then(() => {
        if (abortRef.current) return;
        clearTimeout(timerRef.current!);
        router.replace('/home');
      })
      .catch(() => {
        if (abortRef.current) return;
        clearTimeout(timerRef.current!);
        setTimedOut(true);
      });
  }, [router]);

  useEffect(() => {
    startConnection();
    return () => {
      abortRef.current = true;
      clearTimeout(timerRef.current!);
    };
  }, []);

  function handleRetry() {
    startConnection();
  }

  function handleBack() {
    abortRef.current = true;
    clearTimeout(timerRef.current!);
    router.back();
  }

  return (
    <View style={styles.container}>
      <Aurora colorStops={AURORA_STOPS} blend={0.59} amplitude={1.0} speed={1.1} />

      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
        <Text style={styles.backText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Connecting</Text>

        {!timedOut ? (
          <View style={styles.dotsRow}>
            <Dot delay={0} />
            <Dot delay={200} />
            <Dot delay={400} />
          </View>
        ) : (
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.75}>
            <Text style={styles.retryText}>RETRY</Text>
          </TouchableOpacity>
        )}
      </View>

      {timedOut && (
        <Text style={styles.errorMessage}>Connection Failed</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050a10',
  },
  backButton: {
    position: 'absolute',
    top: 52,
    right: 24,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  retryButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  errorMessage: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    color: '#ff4d4d',
    fontSize: 16,
    fontWeight: '600',
  },
});
