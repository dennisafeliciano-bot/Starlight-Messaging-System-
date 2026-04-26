import * as Device from "expo-device";

export type AIMode = "TURBO" | "LITE" | "UNKNOWN";

export type DeviceAIProfile = {
  mode: AIMode;
  memoryGB: number;
  label: string;
  description: string;
};

let cachedProfile: DeviceAIProfile | null = null;

export async function initializeSmartAI(): Promise<DeviceAIProfile> {
  if (cachedProfile) return cachedProfile;

  try {
    const totalMemoryBytes = Device.totalMemory;
    const memoryGB = (totalMemoryBytes ?? 0) / (1024 * 1024 * 1024);

    let mode: AIMode;
    let label: string;
    let description: string;

    if (memoryGB >= 6) {
      mode = "TURBO";
      label = "StarLight Turbo";
      description = "Full voice reasoning, advanced summarization, mesh AI active";
    } else if (memoryGB >= 3) {
      mode = "TURBO";
      label = "StarLight Turbo";
      description = "Full voice reasoning and mesh AI active";
    } else if (memoryGB > 0) {
      mode = "LITE";
      label = "StarLight Lite";
      description = "Fast keyword matching, lower memory footprint";
    } else {
      mode = "UNKNOWN";
      label = "StarLight";
      description = "Memory profile unavailable";
    }

    cachedProfile = { mode, memoryGB, label, description };
    return cachedProfile;
  } catch {
    cachedProfile = { mode: "UNKNOWN", memoryGB: 0, label: "StarLight", description: "Could not read device memory" };
    return cachedProfile;
  }
}

export function clearAIProfileCache() {
  cachedProfile = null;
}
