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

import { type Peer, useBle } from "@/context/BleContext";
import { useLocation } from "@/context/LocationContext";
import { usePrecisionFinder } from "@/hooks/usePrecisionFinder";
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

function SignalStrengthBars({ level, color }: { level: "STRONG" | "MODERATE" | "WEAK"; color: string }) {
  const heights = [8, 14, 20];
  const filled = level === "STRONG" ? 3 : level === "MODERATE" ? 2 : 1;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: h,
            borderRadius: 2,
            backgroundColor: i < filled ? color : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </View>
  );
}

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peers, broadcastLocation } = useBle();
  const { location, loading, requestLocation } = useLocation();
  const [broadcasting, setBroadcasting] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [finderTargetId, setFinderTargetId] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  const precisionTarget = usePrecisionFinder(peers, finderTargetId);

  const MAP_W = 340;
  const MAP_H = 280;
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

  useEffect(() => {
    if (precisionTarget) {
      Animated.timing(arrowAnim, {
        toValue: precisionTarget.angle,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [precisionTarget?.angle]);

  const radarScale = radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.8] });
  const radarOpacity = radarAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.5, 0.1, 0] });

  const centerLat = location?.latitude ?? 40.7128;
  const centerLon = location?.longitude ?? -74.006;

  const nodes: MapNode[] = [
    { id: "me", name: "You", x: MAP_W / 2, y: MAP_H / 2, isMe: true, online: true, lat: centerLat, lon: centerLon },
    ...peers.map((p) => {
      const pos = latLonToXY(
        p.lat ?? centerLat + (Math.random() - 0.5) * 0.005,
        p.lon ?? centerLon + (Math.random() - 0.5) * 0.005,
        centerLat, centerLon, MAP_W, MAP_H
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

  const onlinePeers = peers.filter((p) => p.online);

  const signalColor =
    precisionTarget?.signalStrength === "STRONG"
      ? colors.online
      : precisionTarget?.signalStrength === "MODERATE"
      ? colors.warning
      : colors.destructive;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: webTopPad }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Mesh Radar</Text>
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
        {/* Radar Map */}
        <View style={[styles.mapContainer, { backgroundColor: colors.card, borderColor: colors.border, width: MAP_W, height: MAP_H }]}>
          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Acquiring GPS...</Text>
            </View>
          ) : (
            <>
              {[55, 100, 145].map((r) => (
                <View
                  key={r}
                  style={[styles.ring, { width: r * 2, height: r * 2, borderRadius: r, borderColor: colors.border, left: MAP_W / 2 - r, top: MAP_H / 2 - r }]}
                />
              ))}
              <Animated.View
                style={[styles.radarPulse, { borderColor: colors.primary, left: MAP_W / 2 - 70, top: MAP_H / 2 - 70, transform: [{ scale: radarScale }], opacity: radarOpacity }]}
              />
              {nodes.map((node) => (
                <Pressable
                  key={node.id}
                  style={[styles.nodeWrapper, { left: node.x - 10, top: node.y - 10 }]}
                  onPress={() => {
                    if (!node.isMe) {
                      setFinderTargetId((prev) => (prev === node.id ? null : node.id));
                      setSelectedNode((prev) => (prev?.id === node.id ? null : node));
                    }
                    Haptics.selectionAsync();
                  }}
                >
                  <View
                    style={[
                      styles.nodeDot,
                      {
                        backgroundColor: node.isMe ? colors.accent : finderTargetId === node.id ? colors.warning : node.online ? colors.primary : colors.mutedForeground,
                        borderColor: colors.background,
                        borderWidth: finderTargetId === node.id ? 2 : 1.5,
                      },
                    ]}
                  />
                  <Text style={[styles.nodeLabel, { color: node.isMe ? colors.accent : node.online ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                    {node.isMe ? "ME" : node.name.split(" ")[0]}
                  </Text>
                </Pressable>
              ))}
              <View style={styles.legend}>
                {[{ color: colors.accent, label: "You" }, { color: colors.primary, label: "Online" }, { color: colors.warning, label: "Tracked" }].map((l) => (
                  <View key={l.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                    <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Precision Finder */}
        <View style={[styles.finderCard, { backgroundColor: colors.card, borderColor: finderTargetId ? colors.warning : colors.border }]}>
          <View style={styles.finderHeader}>
            <View style={styles.finderTitleRow}>
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={16}
                color={finderTargetId ? colors.warning : colors.mutedForeground}
              />
              <Text style={[styles.finderTitle, { color: finderTargetId ? colors.foreground : colors.mutedForeground }]}>
                Precision Finder
              </Text>
              {finderTargetId && (
                <View style={[styles.uwbBadge, { backgroundColor: colors.warning + "22" }]}>
                  <Text style={[styles.uwbBadgeText, { color: colors.warning }]}>RSSI</Text>
                </View>
              )}
            </View>
            {finderTargetId && (
              <TouchableOpacity
                onPress={() => { setFinderTargetId(null); setSelectedNode(null); }}
              >
                <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {!finderTargetId ? (
            <Text style={[styles.finderHint, { color: colors.mutedForeground }]}>
              Tap a node on the radar to track its distance and bearing
            </Text>
          ) : precisionTarget ? (
            <View style={styles.finderBody}>
              {/* Compass arrow */}
              <View style={[styles.compassRing, { borderColor: colors.border }]}>
                <Animated.View
                  style={[
                    styles.arrowWrap,
                    {
                      transform: [
                        { rotate: `${precisionTarget.angle}deg` },
                      ],
                    },
                  ]}
                >
                  <Ionicons name="navigate" size={28} color={signalColor} />
                </Animated.View>
                <Text style={[styles.compassLabel, { color: colors.mutedForeground }]}>
                  {precisionTarget.angle}°
                </Text>
              </View>

              {/* Distance and stats */}
              <View style={styles.finderStats}>
                <Text style={[styles.finderPeerName, { color: colors.foreground }]}>
                  {precisionTarget.peer.name}
                </Text>
                <Text style={[styles.finderDistance, { color: signalColor }]}>
                  {precisionTarget.distanceFt} ft
                </Text>
                <Text style={[styles.finderDistanceM, { color: colors.mutedForeground }]}>
                  {precisionTarget.distanceM} m
                </Text>
                <View style={styles.finderSignalRow}>
                  <SignalStrengthBars level={precisionTarget.signalStrength} color={signalColor} />
                  <Text style={[styles.finderSignalLabel, { color: signalColor }]}>
                    {precisionTarget.signalStrength}
                  </Text>
                </View>
                <View style={[styles.accuracyBar, { backgroundColor: colors.secondary }]}>
                  <View
                    style={[
                      styles.accuracyFill,
                      { width: `${precisionTarget.accuracy}%` as any, backgroundColor: signalColor },
                    ]}
                  />
                </View>
                <Text style={[styles.accuracyLabel, { color: colors.mutedForeground }]}>
                  {precisionTarget.accuracy}% accuracy · {precisionTarget.peer.rssi} dBm
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.finderSearching}>
              <ActivityIndicator size="small" color={colors.warning} />
              <Text style={[styles.finderHint, { color: colors.mutedForeground }]}>Acquiring signal...</Text>
            </View>
          )}
        </View>

        {/* Broadcast */}
        <View style={styles.actions}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.broadcastBtn, { backgroundColor: broadcasting ? colors.accent : colors.primary }]}
              onPress={handleBroadcast}
              disabled={broadcasting || !location}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="broadcast" size={20} color={colors.primaryForeground} />
              <Text style={[styles.broadcastText, { color: colors.primaryForeground }]}>
                {broadcasting ? "Beaming GPS..." : "Broadcast Location"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
          {lastBroadcast && (
            <Text style={[styles.lastBroadcast, { color: colors.mutedForeground }]}>
              Last broadcast {Math.round((Date.now() - lastBroadcast) / 1000)}s ago
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 14, alignItems: "center" },
  mapContainer: { borderRadius: 16, borderWidth: 1, overflow: "hidden", position: "relative" },
  loadingOverlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  ring: { position: "absolute", borderWidth: 1 },
  radarPulse: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 1.5 },
  nodeWrapper: { position: "absolute", alignItems: "center", width: 60, marginLeft: -20 },
  nodeDot: { width: 16, height: 16, borderRadius: 8 },
  nodeLabel: { fontSize: 9, marginTop: 2, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textAlign: "center" },
  legend: { position: "absolute", bottom: 8, right: 10, gap: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  finderCard: { width: 340, padding: 16, borderRadius: 16, borderWidth: 1.5, gap: 12 },
  finderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  finderTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  finderTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  uwbBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  uwbBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  finderHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },
  finderBody: { flexDirection: "row", alignItems: "center", gap: 20 },
  compassRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  arrowWrap: { alignItems: "center", justifyContent: "center" },
  compassLabel: { position: "absolute", bottom: 6, fontSize: 9, fontFamily: "Inter_500Medium" },
  finderStats: { flex: 1, gap: 4 },
  finderPeerName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  finderDistance: { fontSize: 28, fontFamily: "Inter_700Bold", lineHeight: 32 },
  finderDistanceM: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -2 },
  finderSignalRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  finderSignalLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  accuracyBar: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 6, width: "100%" },
  accuracyFill: { height: "100%", borderRadius: 2 },
  accuracyLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  finderSearching: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  actions: { alignItems: "center", gap: 10, width: "100%" },
  broadcastBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30 },
  broadcastText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  lastBroadcast: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
