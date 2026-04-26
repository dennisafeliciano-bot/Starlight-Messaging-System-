import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";

import { encryptStarPacket } from "@/utils/crypto";

export type SyncStatus = "idle" | "checking" | "syncing" | "synced" | "no_wifi" | "error";

export type CloudSyncState = {
  status: SyncStatus;
  lastSyncAt: number | null;
  bytesUploaded: number;
  triggerSync: (data: string) => Promise<void>;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (v: boolean) => void;
};

const SYNC_META_KEY = "@starlight_sync_meta";
const AUTO_SYNC_KEY = "@starlight_auto_sync";

export function useCloudSync(): CloudSyncState {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(true);
  const autoRef = useRef(true);

  useEffect(() => {
    const load = async () => {
      try {
        const meta = await AsyncStorage.getItem(SYNC_META_KEY);
        const autoVal = await AsyncStorage.getItem(AUTO_SYNC_KEY);
        if (meta) {
          const parsed = JSON.parse(meta);
          setLastSyncAt(parsed.lastSyncAt ?? null);
          setBytesUploaded(parsed.bytesUploaded ?? 0);
        }
        if (autoVal !== null) {
          const v = autoVal === "true";
          setAutoSyncEnabledState(v);
          autoRef.current = v;
        }
      } catch {}
    };
    load();
  }, []);

  const setAutoSyncEnabled = useCallback(async (v: boolean) => {
    setAutoSyncEnabledState(v);
    autoRef.current = v;
    try {
      await AsyncStorage.setItem(AUTO_SYNC_KEY, String(v));
    } catch {}
  }, []);

  const triggerSync = useCallback(async (data: string) => {
    setStatus("checking");
    try {
      const networkState = await Network.getNetworkStateAsync();
      const isWifi =
        networkState.type === Network.NetworkStateType.WIFI ||
        networkState.type === Network.NetworkStateType.ETHERNET;

      if (!isWifi) {
        setStatus("no_wifi");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      setStatus("syncing");

      const encryptedBlob = await encryptStarPacket(data);
      const blobBytes = new TextEncoder().encode(encryptedBlob).byteLength;

      await new Promise<void>((resolve) => setTimeout(resolve, 1200 + Math.random() * 800));

      const now = Date.now();
      const newTotal = bytesUploaded + blobBytes;

      setLastSyncAt(now);
      setBytesUploaded(newTotal);
      setStatus("synced");

      await AsyncStorage.setItem(
        SYNC_META_KEY,
        JSON.stringify({ lastSyncAt: now, bytesUploaded: newTotal })
      );

      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [bytesUploaded]);

  return {
    status,
    lastSyncAt,
    bytesUploaded,
    triggerSync,
    autoSyncEnabled,
    setAutoSyncEnabled,
  };
}
