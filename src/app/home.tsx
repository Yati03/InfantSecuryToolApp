import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Aurora from '@/components/Aurora';
import { SensorData, disconnect, onData, onDisconnect } from '@/services/bleService';
import { checkAndNotify, requestNotificationPermissions } from '@/services/notificationService';

const AURORA_STOPS = ['#66ffc4', '#ffce1f', '#ff9029'];

// ── Color helpers ─────────────────────────────────────────────────────────────

function babyTempColor(v: number): string {
  return v > 36 && v < 37.5 ? '#4ade80' : '#f87171';
}

function roomTempColor(v: number): string {
  return v > 20 && v < 22.2 ? '#4ade80' : '#f87171';
}

function brightnessColor(v: number): string {
  return v === 0 ? '#4ade80' : '#f87171';
}

function smokeColor(v: number): string {
  return v === 0 ? '#4ade80' : '#f87171';
}

function humidityColor(v: number): string {
  return v < 55 ? '#4ade80' : '#f87171';
}

function activityColor(v: number): string {
  return v < 20 ? '#4ade80' : '#f87171';
}

// ── Row component ─────────────────────────────────────────────────────────────

function SensorRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{value}</View>
    </View>
  );
}

// ── Home page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<SensorData>({
    babyTemp: null,
    roomTemp: null,
    brightness: null,
    bloodOxygen: null,
    smoke: null,
    humidity: null,
    activity: null,
  });
  const [connectionLost, setConnectionLost] = useState(false);

  useEffect(() => {
    requestNotificationPermissions();

    const unsubData = onData((newData) => {
      setData(newData);
      checkAndNotify(newData);
    });

    const unsubDisconnect = onDisconnect(() => {
      setConnectionLost(true);
    });

    return () => {
      unsubData();
      unsubDisconnect();
    };
  }, []);

  function handleBack() {
    disconnect();
    router.replace('/');
  }

  function fmt(v: number | null, decimals = 1): string {
    return v !== null ? v.toFixed(decimals) : '—';
  }

  const { babyTemp, roomTemp, brightness, bloodOxygen, smoke, humidity, activity } = data;

  return (
    <View style={styles.container}>
      <Aurora colorStops={AURORA_STOPS} blend={0.59} amplitude={1.0} speed={1.1} />

      {/* Connection lost banner */}
      {connectionLost && (
        <View style={styles.lostBanner}>
          <Text style={styles.lostText}>Connection Lost</Text>
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
        <Text style={styles.backText}>✕</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        <Text style={styles.heading}>Home</Text>

        <View style={styles.card}>
          <SensorRow
            label="Baby Temperature"
            value={
              <Text style={[styles.valueText, { color: babyTemp !== null ? babyTempColor(babyTemp) : '#aaa' }]}>
                {fmt(babyTemp)} °C
              </Text>
            }
          />

          <View style={styles.divider} />

          <SensorRow
            label="Room Temperature"
            value={
              <Text style={[styles.valueText, { color: roomTemp !== null ? roomTempColor(roomTemp) : '#aaa' }]}>
                {fmt(roomTemp)} °C
              </Text>
            }
          />

          <View style={styles.divider} />

          <SensorRow
            label="Brightness"
            value={
              <Text style={[styles.valueText, { color: brightness !== null ? brightnessColor(brightness) : '#aaa' }]}>
                {brightness !== null ? (brightness === 1 ? 'ON' : 'OFF') : '—'}
              </Text>
            }
          />

          <View style={styles.divider} />

          <SensorRow
            label="Blood Oxygen Level"
            value={
              <Text style={[styles.valueText, { color: '#ffffff' }]}>
                {bloodOxygen !== null ? `${Math.round(bloodOxygen)} bpm` : '—'}
              </Text>
            }
          />

          <View style={styles.divider} />

          <SensorRow
            label="Smoke Levels"
            value={
              <Text style={[styles.valueText, { color: smoke !== null ? smokeColor(smoke) : '#aaa' }]}>
                {smoke !== null ? (smoke === 1 ? 'Smoke Detected' : 'No Smoke Detected') : '—'}
              </Text>
            }
          />

          <View style={styles.divider} />

          <SensorRow
            label="Humidity"
            value={
              <Text style={[styles.valueText, { color: humidity !== null ? humidityColor(humidity) : '#aaa' }]}>
                {humidity !== null ? `${Math.round(humidity)} %` : '—'}
              </Text>
            }
          />

          <View style={styles.divider} />

          <SensorRow
            label="Activity"
            value={
              <Text style={[styles.valueText, { color: activity !== null ? activityColor(activity) : '#aaa' }]}>
                {activity !== null ? `${Math.round(activity)} m without movements` : '—'}
              </Text>
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050a10',
  },
  lostBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: '#b91c1c',
    paddingTop: 52,
    paddingBottom: 14,
    alignItems: 'center',
  },
  lostText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backButton: {
    position: 'absolute',
    top: 52,
    right: 24,
    zIndex: 30,
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
  scroll: {
    paddingTop: 100,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  rowLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  rowValue: {
    flex: 1,
    alignItems: 'flex-end',
  },
  valueText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
});
