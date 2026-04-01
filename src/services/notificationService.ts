import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { SensorData } from './bleService';

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const cooldowns: Record<string, number> = {};

function inCooldown(key: string): boolean {
  const last = cooldowns[key];
  return last !== undefined && Date.now() - last < COOLDOWN_MS;
}

function setCooldown(key: string): void {
  cooldowns[key] = Date.now();
}

async function sendNotification(title: string, body?: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body: body ?? '', sound: true },
    trigger: null,
  });
}

export async function requestNotificationPermissions(): Promise<void> {
  if (Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Notification permission not granted');
  }
}

export function checkAndNotify(data: SensorData): void {
  const { babyTemp, roomTemp, brightness, smoke, humidity, activity } = data;

  if (babyTemp !== null) {
    if (babyTemp < 36 && !inCooldown('babyTempLow')) {
      sendNotification('Température du bébé est trop basse');
      setCooldown('babyTempLow');
    } else if (babyTemp > 37.5 && !inCooldown('babyTempHigh')) {
      sendNotification('Température du bébé est trop haute');
      setCooldown('babyTempHigh');
    }
  }

  if (roomTemp !== null) {
    if (roomTemp < 20 && !inCooldown('roomTempLow')) {
      sendNotification('Température ambiante trop basse');
      setCooldown('roomTempLow');
    } else if (roomTemp > 22.2 && !inCooldown('roomTempHigh')) {
      sendNotification('Température ambiante trop haute');
      setCooldown('roomTempHigh');
    }
  }

  if (brightness === 1 && !inCooldown('light')) {
    sendNotification('La lumière est allumée, vérifies que tout va bien');
    setCooldown('light');
  }

  if (smoke === 1 && !inCooldown('smoke')) {
    sendNotification('Fumée Détectée!');
    setCooldown('smoke');
  }

  if (humidity !== null && humidity > 55 && !inCooldown('humidity')) {
    sendNotification("Humidité est trop haute!");
    setCooldown('humidity');
  }

  if (activity !== null) {
    if (activity > 60 && !inCooldown('activityHigh')) {
      sendNotification("Le bébé a été inactif pendant plus d'une heure!");
      setCooldown('activityHigh');
    } else if (activity > 20 && activity <= 60 && !inCooldown('activityMed')) {
      sendNotification('Le bébé a été inactif pendant au moins 20m!');
      setCooldown('activityMed');
    }
  }
}
