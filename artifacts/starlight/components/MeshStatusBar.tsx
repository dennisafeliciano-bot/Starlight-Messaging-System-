import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  status: "active" | "idle" | "offline";
  peerCount: number;
  isScanning: boolean;
  encrypted?: boolean;
};

export function MeshStatusBar({ status, peerCount, isScanning, encrypted }: Props) {
  const colors = useColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isScanning, pulseAnim]);

  const statusColor =
    status === "active"
      ? colors.online
      : status === "idle"
      ? colors.warning
      : colors.destructive;

  const statusLabel =
    status === "active"
      ? "MESH ACTIVE"
      : status === "idle"
      ? "SEARCHING"
      : "OFFLINE";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.left}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: statusColor, opacity: pulseAnim },
          ]}
        />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>
      <View style={styles.right}>
        {encrypted && (
          <View style={styles.encBadge}>
            <Ionicons name="lock-closed" size={11} color={colors.online} />
            <Text style={[styles.encText, { color: colors.online }]}>E2E</Text>
          </View>
        )}
        <MaterialCommunityIcons
          name="access-point-network"
          size={14}
          color={colors.primary}
        />
        <Text style={[styles.peerText, { color: colors.primary }]}>
          {peerCount} {peerCount === 1 ? "node" : "nodes"} linked
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  peerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  encBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(0,230,118,0.12)",
    marginRight: 4,
  },
  encText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
});
