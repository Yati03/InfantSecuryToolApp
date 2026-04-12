// ── PLACEHOLDER — replace with the IP printed by the ESP32 on Serial ─────────
const ESP32_HOST = 'http://172.20.10.11';
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1000;
const PING_RETRY_MS    = 2000;

export interface SensorData {
  babyTemp:    number | null;  // I!float  °C  (internal)
  roomTemp:    number | null;  // E!float  °C  (external)
  brightness:  number | null;  // B!int    (1=ON, 0=OFF)
  bloodOxygen: number | null;  // O!int    %
  smoke:       number | null;  // S!int    (1=detected, 0=clear)
  humidity:    number | null;  // H!int    %
  activity:    number | null;  // M!int    minutes without movement
  heartbeat:   number | null;  // C!int    bpm
  message:     string | null;  // U!string free-form message
}

type DataCallback       = (data: SensorData) => void;
type DisconnectCallback = () => void;

let _connected            = false;
let _cancelled            = false;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let dataCallbacks:       DataCallback[]       = [];
let disconnectCallbacks: DisconnectCallback[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseData(raw: string): SensorData {
  const result: SensorData = {
    babyTemp: null, roomTemp: null, brightness: null,
    bloodOxygen: null, smoke: null, humidity: null,
    activity: null, heartbeat: null, message: null,
  };

  // Format: "E!21.00;I!36.50;B!    0;O!   98;S!    0;H!   45;M!    5;C!  130"
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

function stopPolling() {
  if (_pollTimer !== null) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

function startPolling() {
  stopPolling();
  _pollTimer = setInterval(async () => {
    try {
      const res  = await fetch(`${ESP32_HOST}/sensors`);
      const text = await res.text();
      const data = parseData(text);
      dataCallbacks.forEach((cb) => cb(data));
    } catch {
      stopPolling();
      _connected = false;
      disconnectCallbacks.forEach((cb) => cb());
    }
  }, POLL_INTERVAL_MS);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isConnected(): boolean {
  return _connected;
}

export function cancelConnect(): void {
  _cancelled = true;
  stopPolling();
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
  _cancelled = false;

  // Retry /ping until the ESP32 responds or the caller cancels
  await new Promise<void>((resolve, reject) => {
    const attempt = async () => {
      if (_cancelled) { reject(new Error('cancelled')); return; }
      try {
        const res = await fetch(`${ESP32_HOST}/ping`);
        if (res.ok) { resolve(); return; }
      } catch {
        // not reachable yet — keep retrying
      }
      if (!_cancelled) setTimeout(attempt, PING_RETRY_MS);
    };
    attempt();
  });

  _connected = true;
  startPolling();
}

export function disconnect(): void {
  stopPolling();
  _connected = false;
}
