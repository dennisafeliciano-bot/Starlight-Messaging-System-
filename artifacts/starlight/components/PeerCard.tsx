import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type Peer } from "@/context/BleContext";
import { useColors } from "@/hooks/useColors";

type Props = {
  peer: Peer;
  onPress: (peer: Peer) => void;
  selected?: boolean;
};

function signalBars(rssi: number): number {
  if (rssi > -55) return 4;
  if (rssi > -70) return 3;
  if (rssi > -80) return 2;
  return 1;
}

export function PeerCard({ peer, onPress, selected }: Props) {
  const colors = useColors();
  const bars = signalBars(peer.rssi);
  const timeAgo = Math.round((Date.now() - peer.lastSeen) / 1000);

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress(peer);
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: selected ? colors.secondary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={styles.leftSection}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: peer.online ? colors.online : colors.mutedForeground,
            },
          ]}
        />
        <MaterialCommunityIcons
          name="bluetooth-connect"
          size={18}
          color={peer.online ? colors.primary : colors.mutedForeground}
        />
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {peer.name}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {peer.online ? `Active · ${peer.rssi} dBm` : `Last seen ${timeAgo}s ago`}
        </Text>
      </View>
      <View style={styles.signal}>
        {[1, 2, 3, 4].map((b) => (
          <View
            key={b}
            style={[
              styles.bar,
              {
                height: 4 + b * 3,
                backgroundColor:
                  b <= bars && peer.online ? colors.primary : colors.border,
              },
            ]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  signal: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
