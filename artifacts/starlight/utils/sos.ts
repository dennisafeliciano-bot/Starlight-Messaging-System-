import * as Battery from "expo-battery";
import * as Location from "expo-location";

export type SOSPacket = {
  status: "EMERGENCY_SOS";
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  battery: number;
  batteryState: string;
  timestamp: number;
  nodeId: string;
};

export type SOSResult =
  | { ok: true; packet: SOSPacket; nodeCount: number }
  | { ok: false; error: string };

async function getBatteryInfo(): Promise<{ level: number; state: string }> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    const state = await Battery.getBatteryStateAsync();
    const stateMap: Record<number, string> = {
      [Battery.BatteryState.CHARGING]: "CHARGING",
      [Battery.BatteryState.FULL]: "FULL",
      [Battery.BatteryState.UNPLUGGED]: "UNPLUGGED",
      [Battery.BatteryState.UNKNOWN]: "UNKNOWN",
    };
    return { level: Math.round(level * 100), state: stateMap[state] ?? "UNKNOWN" };
  } catch {
    return { level: -1, state: "UNAVAILABLE" };
  }
}

async function getGPSLocation(): Promise<Location.LocationObject> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission denied");
  }

  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
  });
}

export async function buildSOSPacket(nodeId: string): Promise<SOSPacket> {
  const [location, battery] = await Promise.all([
    getGPSLocation(),
    getBatteryInfo(),
  ]);

  return {
    status: "EMERGENCY_SOS",
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: Math.round(location.coords.accuracy ?? 0),
    altitude: location.coords.altitude ?? null,
    battery: battery.level,
    batteryState: battery.state,
    timestamp: Date.now(),
    nodeId,
  };
}

export function formatSOSMessage(packet: SOSPacket): string {
  const bat = packet.battery >= 0 ? `${packet.battery}%` : "N/A";
  const acc = packet.accuracy > 0 ? `±${packet.accuracy}m` : "";
  return (
    `🆘 EMERGENCY SOS — ${new Date(packet.timestamp).toISOString()}\n` +
    `📍 GPS: ${packet.lat.toFixed(6)}, ${packet.lng.toFixed(6)} ${acc}\n` +
    `🔋 Battery: ${bat} (${packet.batteryState})\n` +
    `📡 Node: ${packet.nodeId}`
  );
}
