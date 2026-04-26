import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBle } from "@/context/BleContext";
import { useLocation } from "@/context/LocationContext";
import { useColors } from "@/hooks/useColors";

type MapNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  isMe?: boolean;
  online?: boolean;
  lat: number;
  lon: number;
};

function latLonToXY(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  width: number,
  height: number
): { x: number; y: number } {
  const scale = 8000;
  const x = width / 2 + (lon - centerLon) * scale;
  const y = height / 2 - (lat - centerLat) * scale;
  return { x, y };
}

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peers, broadcastLocation } = useBle();
  const { location, loading, requestLocation } = useLocation();
  const [broadcasting, setBroadcasting] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;

  const MAP_W = 340;
  const MAP_H = 300;

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [radarAnim]);

  const radarScale = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.8],
  });
  const radarOpacity = radarAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.5, 0.1, 0],
  });

  const centerLat = location?.latitude ?? 40.7128;
  const centerLon = location?.longitude ?? -74.006;

  const nodes: MapNode[] = [
    {
      id: "me",
      name: "You",
      x: MAP_W / 2,
      y: MAP_H / 2,
      isMe: true,
      online: true,
      lat: centerLat,
      lon: centerLon,
    },
    ...peers.map((p) => {
      const pos = latLonToXY(
        p.lat ?? centerLat + (Math.random() - 0.5) * 0.005,
        p.lon ?? centerLon + (Math.random() - 0.5) * 0.005,
        centerLat,
        centerLon,
        MAP_W,
        MAP_H
      );
      return {
        id: p.id,
        name: p.name,
        x: Math.max(20, Math.min(MAP_W - 20, pos.x)),
        y: Math.max(20, Math.min(MAP_H - 20, pos.y)),
        isMe: false,
        online: p.online,
        lat: p.lat ?? centerLat,
        lon: p.lon ?? centerLon,
      };
    }),
  ];

  const handleBroadcast = async () => {
    if (!location) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBroadcasting(true);
    broadcastLocation(location.latitude, location.longitude);
    setLastBroadcast(Date.now());

    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();

    setTimeout(() => setBroadcasting(false), 1500);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: webTopPad },
      ]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Mesh Radar
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : "Acquiring GPS..."}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: colors.secondary }]}
          onPress={requestLocation}
        >
          <Ionicons name="locate" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          style={[
            styles.mapContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Acquiring GPS...
              </Text>
            </View>
          ) : (
            <>
              {[60, 110, 160].map((r) => (
                <View
                  key={r}
                  style={[
                    styles.ring,
                    {
                      width: r * 2,
                      height: r * 2,
                      borderRadius: r,
                      borderColor: colors.border,
                      left: MAP_W / 2 - r,
                      top: MAP_H / 2 - r,
                    },
                  ]}
                />
              ))}

              <Animated.View
                style={[
                  styles.radarPulse,
                  {
                    borderColor: colors.primary,
                    left: MAP_W / 2 - 80,
                    top: MAP_H / 2 - 80,
                    transform: [{ scale: radarScale }],
                    opacity: radarOpacity,
                  },
                ]}
              />

              {nodes.map((node) => (
                <Pressable
                  key={node.id}
                  style={({ pressed }) => [
                    styles.nodeWrapper,
                    { left: node.x - 10, top: node.y - 10 },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    setSelectedNode((prev) =>
                      prev?.id === node.id ? null : node
                    );
                    Haptics.selectionAsync();
                  }}
                >
                  {!node.isMe &&
                    nodes
                      .filter((n) => n.isMe)
                      .map((me) => null)}
                  <View
                    style={[
                      styles.nodeDot,
                      {
                        backgroundColor: node.isMe
                          ? colors.accent
                          : node.online
                          ? colors.primary
                          : colors.mutedForeground,
                        borderColor: node.isMe ? colors.accentForeground : colors.background,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.nodeLabel,
                      {
                        color: node.isMe ? colors.accent : node.online ? colors.foreground : colors.mutedForeground,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {node.isMe ? "ME" : node.name.split(" ")[0]}
                  </Text>
                </Pressable>
              ))}

              <View style={styles.legend}>
                <View style={[styles.legendItem]}>
                  <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.legendText, { color: colors.mutedForeground }]}>You</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Online</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.mutedForeground }]} />
                  <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Offline</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {selectedNode && (
          <View
            style={[
              styles.nodeDetail,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.nodeDetailName, { color: colors.foreground }]}>
              {selectedNode.isMe ? "Your Location" : selectedNode.name}
            </Text>
            <Text style={[styles.nodeDetailCoords, { color: colors.mutedForeground }]}>
              {selectedNode.lat.toFixed(5)}, {selectedNode.lon.toFixed(5)}
            </Text>
            {!selectedNode.isMe && (
              <Text
                style={[
                  styles.nodeDetailStatus,
                  {
                    color: selectedNode.online ? colors.online : colors.mutedForeground,
                  },
                ]}
              >
                {selectedNode.online ? "Online" : "Offline"}
              </Text>
            )}
          </View>
        )}

        <View style={styles.actions}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[
                styles.broadcastBtn,
                { backgroundColor: broadcasting ? colors.accent : colors.primary },
              ]}
              onPress={handleBroadcast}
              disabled={broadcasting || !location}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="broadcast"
                size={20}
                color={colors.primaryForeground}
              />
              <Text style={[styles.broadcastText, { color: colors.primaryForeground }]}>
                {broadcasting ? "Beaming GPS..." : "Broadcast Location"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {lastBroadcast && (
            <Text style={[styles.lastBroadcast, { color: colors.mutedForeground }]}>
              Last broadcast{" "}
              {Math.round((Date.now() - lastBroadcast) / 1000)}s ago
            </Text>
          )}
        </View>

        <View style={{ height: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: 16,
    gap: 14,
    alignItems: "center",
  },
  mapContainer: {
    width: 340,
    height: 300,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
  },
  radarPulse: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
  },
  nodeWrapper: {
    position: "absolute",
    alignItems: "center",
    width: 60,
    marginLeft: -20,
  },
  nodeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  nodeLabel: {
    fontSize: 9,
    marginTop: 2,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  legend: {
    position: "absolute",
    bottom: 8,
    right: 10,
    gap: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  nodeDetail: {
    width: 340,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  nodeDetailName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  nodeDetailCoords: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  nodeDetailStatus: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  actions: {
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  broadcastBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
  },
  broadcastText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  lastBroadcast: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
