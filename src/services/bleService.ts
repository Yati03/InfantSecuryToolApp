import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Device, State, Subscription } from 'react-native-ble-plx';

// ── Configure these to match your ESP32-S3 firmware ──────────────────────────
const DEVICE_NAME = 'InfantMonitor';
const SERVICE_UUID = 'eafeeb4a-98e9-41ef-b304-1c493eab2e84';
const CHAR_UUID = '10b80e40-fb4c-454a-ba7c-0cc397825fbb';
// ─────────────────────────────────────────────────────────────────────────────

export interface SensorData {
  babyTemp: number | null;    // I!float  °C  (internal)
  roomTemp: number | null;    // E!float  °C  (external)
  brightness: number | null;  // B!int    (1=ON, 0=OFF)
  bloodOxygen: number | null; // O!int    %
  smoke: number | null;       // S!int    (1=detected, 0=clear)
  humidity: number | null;    // H!int    %
  activity: number | null;    // M!int    minutes without movement
  heartbeat: number | null;   // C!int    bpm
  message: string | null;     // U!string free-form message
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
    heartbeat: null,
    message: null,
  };

  // Expected format: "l!23.5;E!21.0;B!1;O!98;S!0;H!45;M!5"
  const parts = raw.trim().split(';');
  for (const part of parts) {
    const [key, value] = part.split('!');
    if (!key || value === undefined) continue;
    if (key.trim() === 'U') { result.message = value; continue; }
    const num = parseFloat(value);
    if (isNaN(num)) continue;

    switch (key.trim()) {
      case 'I': result.babyTemp    = num; break;
      case 'E': result.roomTemp    = num; break;
      case 'B': result.brightness  = num; break;
      case 'O': result.bloodOxygen = num; break;
      case 'S': result.smoke       = num; break;
      case 'H': result.humidity    = num; break;
      case 'M': result.activity    = num; break;
      case 'C': result.heartbeat   = num; break;
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

export function isConnected(): boolean {
  return connectedDevice !== null;
}

export function cancelConnect(): void {
  if (_manager) {
    try { _manager.stopDeviceScan(); } catch {}
  }
  console.log('[BLE] cancelConnect called');
}

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

  console.log('[BLE] waiting for powered on...');
  await waitForPoweredOn();
  console.log('[BLE] powered on');

  const granted = await requestPermissions();
  console.log('[BLE] permissions granted:', granted);
  if (!granted) throw new Error('Bluetooth permissions denied');

  console.log('[BLE] starting scan...');
  return new Promise((resolve, reject) => {
    getManager().startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
      if (error) {
        console.log('[BLE] scan error:', error);
        reject(error);
        return;
      }

      const name = device?.name ?? device?.localName ?? '';
      if (name !== DEVICE_NAME) return;

      getManager().stopDeviceScan();

      try {
        connectedDevice = await device!.connect();
        await connectedDevice.discoverAllServicesAndCharacteristics();
        console.log('[BLE connected] Device:', DEVICE_NAME);
        console.log('[BLE connected] Service UUID:', SERVICE_UUID);
        console.log('[BLE connected] Char UUID:   ', CHAR_UUID);

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
              const bytes = atob(characteristic.value);
              console.log('[BLE raw]', bytes);
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
  console.log('[BLE] disconnect called');
  charSubscription?.remove();
  charSubscription = null;
  connectedDevice?.cancelConnection();
  connectedDevice = null;
}
