import { Audio } from "expo-av";
import {
  cacheDirectory,
  EncodingType,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { Platform } from "react-native";

const SAMPLE_RATE = 22050;
const SIREN_DURATION_S = 1.0;
const SIREN_LOW_HZ = 440;
const SIREN_HIGH_HZ = 880;

type SirenHandle = {
  stop: () => Promise<void>;
  isActive: boolean;
};

let activeSiren: SirenHandle | null = null;

function writeString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function buildSirenWAVBase64(): string {
  const numSamples = Math.floor(SAMPLE_RATE * SIREN_DURATION_S);
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const sweep = (t % SIREN_DURATION_S) / SIREN_DURATION_S;
    const freq =
      sweep < 0.5
        ? SIREN_LOW_HZ + (SIREN_HIGH_HZ - SIREN_LOW_HZ) * (sweep * 2)
        : SIREN_HIGH_HZ - (SIREN_HIGH_HZ - SIREN_LOW_HZ) * ((sweep - 0.5) * 2);

    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const sample = Math.sin(phase) * 0.85;
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

async function playNativeSiren(): Promise<SirenHandle> {
  const base64 = buildSirenWAVBase64();
  const uri = (cacheDirectory ?? "file:///tmp/") + "starlight_sos_siren.wav";
  await writeAsStringAsync(uri, base64, {
    encoding: EncodingType.Base64,
  });

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, volume: 1.0, isLooping: true }
  );

  return {
    isActive: true,
    stop: async () => {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {}
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
    },
  };
}

type WebAudioCtx = typeof AudioContext;
declare const window: { AudioContext?: WebAudioCtx; webkitAudioContext?: WebAudioCtx };

function playWebSiren(): SirenHandle {
  const AudioContextClass =
    typeof window !== "undefined"
      ? (window.AudioContext ?? (window as Record<string, unknown>).webkitAudioContext as WebAudioCtx | undefined)
      : undefined;

  if (!AudioContextClass) return { isActive: false, stop: async () => {} };

  const ctx = new (AudioContextClass as unknown as { new(): AudioContext })();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = SIREN_LOW_HZ;
  gain.gain.value = 0.7;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  let sweepTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const scheduleSweep = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    osc.frequency.cancelScheduledValues(now);
    osc.frequency.setValueAtTime(SIREN_LOW_HZ, now);
    osc.frequency.linearRampToValueAtTime(SIREN_HIGH_HZ, now + 0.5);
    osc.frequency.linearRampToValueAtTime(SIREN_LOW_HZ, now + 1.0);
    sweepTimer = setTimeout(scheduleSweep, 1000);
  };

  scheduleSweep();

  return {
    isActive: true,
    stop: async () => {
      stopped = true;
      if (sweepTimer) clearTimeout(sweepTimer);
      try {
        osc.stop();
        await ctx.close();
      } catch {}
    },
  };
}

export async function startEmergencySiren(): Promise<void> {
  if (activeSiren?.isActive) return;

  console.log("[StarLight] SOS Siren activating — bypassing silent mode");

  if (Platform.OS === "web") {
    activeSiren = playWebSiren();
  } else {
    activeSiren = await playNativeSiren();
  }
}

export async function stopEmergencySiren(): Promise<void> {
  if (!activeSiren) return;
  await activeSiren.stop();
  activeSiren = null;
  console.log("[StarLight] SOS Siren stopped");
}

export function isSirenActive(): boolean {
  return activeSiren?.isActive === true;
}
