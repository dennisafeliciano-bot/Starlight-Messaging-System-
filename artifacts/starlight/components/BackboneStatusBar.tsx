import { BlurView } from "expo-blur";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useBle } from "@/context/BleContext";
import { useColors } from "@/hooks/useColors";

// ─── helpers ──────────────────────────────────────────────────────────────────
function linkQuality(online: number, total: number): { label: string; color: string } {
  if (total === 0 || online === 0) return { label: "Offline", color: "#FF1744" };
  if (online === total)            return { label: "Nominal", color: "#4FC3F7" };
  if (online / total >= 0.5)      return { label: "Degraded", color: "#FFB300" };
  return                                 { label: "Critical", color: "#FF6D00" };
}

function packetLoss(online: number, total: number): string {
  if (total === 0) return "N/A";
  const loss = Math.round(((total - online) / total) * 100);
  return `${loss}%`;
}

// ─── component ────────────────────────────────────────────────────────────────
export function BackboneStatusBar() {
  const colors  = useColors();
  const { peers, encryptionEnabled, nodeStatus } = useBle();

  const online = peers.filter((p) => p.online).length;
  const total  = peers.length;

  const link    = linkQuality(online, total);
  const loss    = packetLoss(online, total);
  const aesColor = encryptionEnabled ? "#00E676" : "#FFB300";
  const aesLabel = encryptionEnabled ? "AES-256" : "PLAIN";

  // Subtle pulse on the AES label when encryption is active
  const aesAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!encryptionEnabled) { aesAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(aesAnim, { toValue: 0.45, duration: 1200, useNativeDriver: true }),
        Animated.timing(aesAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [encryptionEnabled, aesAnim]);

  const content = (
    <View style={styles.row} pointerEvents="none">
      {/* Left cluster — encryption */}
      <View style={styles.cluster}>
        <Animated.Text style={[styles.label, { color: aesColor, opacity: aesAnim }]}>
          {aesLabel}
        </Animated.Text>
        <Text style={[styles.sub, { color: "rgba(255,255,255,0.55)" }]}>
          Packet loss: {loss}
        </Text>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.18)" }]} />

      {/* Right cluster — mesh stats */}
      <View style={styles.cluster}>
        <Text style={[styles.label, { color: "rgba(255,255,255,0.9)" }]}>
          Nodes: {online}/{total === 0 ? "—" : total}
        </Text>
        <Text style={[styles.sub, { color: link.color }]}>
          Link: {link.label}
        </Text>
      </View>

      {/* Node status dot */}
      <View style={[styles.dot, { backgroundColor: nodeStatus === "active" ? colors.primary : nodeStatus === "idle" ? colors.warning : colors.destructive }]} />
    </View>
  );

  if (Platform.OS === "web") {
    return (
      <View style={[styles.wrap, { backgroundColor: "rgba(6,13,26,0.82)", borderColor: "rgba(255,255,255,0.14)" }]}>
        {content}
      </View>
    );
  }

  return (
    <BlurView intensity={55} tint="dark" style={[styles.wrap, { borderColor: "rgba(255,255,255,0.16)" }]}>
      {content}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cluster: {
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
  sub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    width: 1,
    height: 22,
    borderRadius: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: "auto",
  },
});
