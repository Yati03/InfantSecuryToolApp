import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Device, State, Subscription } from 'react-native-ble-plx';

// ── Configure these to match your ESP32-S3 firmware ──────────────────────────
const DEVICE_NAME = 'InfantMonitor';
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const CHAR_UUID = '12345678-1234-1234-1234-123456789abd';
// ─────────────────────────────────────────────────────────────────────────────

export interface SensorData {
  babyTemp: number | null;    // l!float  °C
  roomTemp: number | null;    // E!float  °C
  brightness: number | null;  // B!int    (1=ON, 0=OFF)
  bloodOxygen: number | null; // O!int    bpm
  smoke: number | null;       // S!int    (1=detected, 0=clear)
  humidity: number | null;    // H!int    %
  activity: number | null;    // M!int    minutes without movement
}

type DataCallback = (data: SensorData) => void;
type DisconnectCallback = () => void;

let _manager: BleManager | null = null;
function getManager(): BleManager {
  if (!_manager) _manager = new BleManager();
  return _manager;
}

let connectedDevice: Device | null = null;
let charSubscription: Subscription | null = null;
let dataCallbacks: DataCallback[] = [];
let disconnectCallbacks: DisconnectCallback[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseData(raw: string): SensorData {
  const result: SensorData = {
    babyTemp: null,
    roomTemp: null,
    brightness: null,
    bloodOxygen: null,
    smoke: null,
    humidity: null,
    activity: null,
  };

  // Expected format: "l!23.5;E!21.0;B!1;O!98;S!0;H!45;M!5"
  const parts = raw.trim().split(';');
  for (const part of parts) {
    const [key, value] = part.split('!');
    if (!key || value === undefined) continue;
    const num = parseFloat(value);
    if (isNaN(num)) continue;

    switch (key.trim()) {
      case 'l': result.babyTemp = num; break;
      case 'E': result.roomTemp = num; break;
      case 'B': result.brightness = num; break;
      case 'O': result.bloodOxygen = num; break;
      case 'S': result.smoke = num; break;
      case 'H': result.humidity = num; break;
      case 'M': result.activity = num; break;
    }
  }

  return result;
}

async function waitForPoweredOn(): Promise<void> {
  return new Promise((resolve) => {
    const sub = getManager().onStateChange((state) => {
      if (state === State.PoweredOn) {
        sub.remove();
        resolve();
      }
    }, true);
  });
}

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(result).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function onData(cb: DataCallback): () => void {
  dataCallbacks.push(cb);
  return () => { dataCallbacks = dataCallbacks.filter((c) => c !== cb); };
}

export function onDisconnect(cb: DisconnectCallback): () => void {
  disconnectCallbacks.push(cb);
  return () => { disconnectCallbacks = disconnectCallbacks.filter((c) => c !== cb); };
}

export async function connect(): Promise<void> {
  // BLE is unavailable in browsers — return a promise that never resolves
  // so the dot animation plays until the 60s timeout fires naturally.
  if (Platform.OS === 'web') return new Promise(() => {});

  await waitForPoweredOn();

  const granted = await requestPermissions();
  if (!granted) throw new Error('Bluetooth permissions denied');

  return new Promise((resolve, reject) => {
    getManager().startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
      if (error) {
        reject(error);
        return;
      }

      const name = device?.name ?? device?.localName ?? '';
      if (name !== DEVICE_NAME) return;

      getManager().stopDeviceScan();

      try {
        connectedDevice = await device!.connect();
        await connectedDevice.discoverAllServicesAndCharacteristics();

        connectedDevice.onDisconnected((_err: BleError | null, _dev: Device | null) => {
          charSubscription?.remove();
          charSubscription = null;
          connectedDevice = null;
          disconnectCallbacks.forEach((cb) => cb());
        });

        charSubscription = connectedDevice.monitorCharacteristicForService(
          SERVICE_UUID,
          CHAR_UUID,
          (_err, characteristic) => {
            if (characteristic?.value) {
              const bytes = Buffer.from(characteristic.value, 'base64').toString('utf-8');
              const parsed = parseData(bytes);
              dataCallbacks.forEach((cb) => cb(parsed));
            }
          },
        );

        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function disconnect(): void {
  charSubscription?.remove();
  charSubscription = null;
  connectedDevice?.cancelConnection();
  connectedDevice = null;
}
