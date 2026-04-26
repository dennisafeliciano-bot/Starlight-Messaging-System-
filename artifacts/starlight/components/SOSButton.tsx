import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useBle } from "@/context/BleContext";
import { useColors } from "@/hooks/useColors";
import { buildSOSPacket, formatSOSMessage } from "@/utils/sos";
import { startEmergencySiren, stopEmergencySiren } from "@/utils/siren";
import { encryptStarPacket } from "@/utils/crypto";

// ─── SAFE TEST FLAG ────────────────────────────────────────────────────────────
// Set to `false` for real-world deployment. While true, SOS fires full visuals,
// siren, and a priority mesh packet — but no actual emergency broadcast.
const IS_TEST_MODE = true;

type SOSPhase = "idle" | "arming" | "sending" | "sent" | "error";

const HOLD_MS = 1600;
const SOS_RED = "#FF1744";
const SOS_GREEN = "#00E676";

export function SOSButton({ nodeId }: { nodeId: string }) {
  const colors = useColors();
  const { broadcastSOS, peers, sendMessage } = useBle();

  const [phase, setPhase] = useState<SOSPhase>("idle");
  const [sentCount, setSentCount] = useState(0);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const ringLoop = useRef<Animated.CompositeAnimation | null>(null);

  const onlinePeers = peers.filter((p) => p.online).length;

  useEffect(() => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
      ])
    );
    pulseLoop.current.start();
    return () => pulseLoop.current?.stop();
  }, []);

  const stopRings = useCallback(() => {
    ringLoop.current?.stop();
    ring1.setValue(0);
    ring2.setValue(0);
    ring3.setValue(0);
  }, [ring1, ring2, ring3]);

  const startRings = useCallback(() => {
    stopRings();
    const makeRing = (anim: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]);
    ringLoop.current = Animated.loop(
      Animated.parallel([makeRing(ring1, 0), makeRing(ring2, 340), makeRing(ring3, 680)])
    );
    ringLoop.current.start();
  }, [ring1, ring2, ring3, stopRings]);

  useEffect(() => {
    if (phase === "sent") startRings();
    else stopRings();
  }, [phase, startRings, stopRings]);

  const armProgress = useCallback(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start();
  }, [progressAnim]);

  const cancelProgress = useCallback(() => {
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, { toValue: 0, duration: 120, useNativeDriver: false }).start();
  }, [progressAnim]);

  const handlePressIn = useCallback(() => {
    if (phase === "sending" || phase === "sent") return;
    setPhase("arming");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    armProgress();
    holdTimer.current = setTimeout(() => fire(), HOLD_MS);
  }, [phase]);

  const handlePressOut = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (phase === "arming") {
      setPhase("idle");
      cancelProgress();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [phase, cancelProgress]);

  const cancelSOS = useCallback(async () => {
    setPhase("idle");
    stopRings();
    await stopEmergencySiren();
  }, [stopRings]);

  const fire = useCallback(async () => {
    setPhase("sending");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    console.log("[StarLight] SOS Button Pressed...");

    try {
      if (IS_TEST_MODE) {
        // ── TEST MODE ─────────────────────────────────────────────────────────
        // Full visual + audio + mesh test — zero real emergency traffic.
        console.log("[StarLight] DEBUG: SOS Test Mode Active. No real authorities notified.");

        // 1. Grab GPS + battery for the test packet display
        const packet = await buildSOSPacket(nodeId);

        // 2. Visual — rings + green phase already triggered by setPhase("sent") below
        setSentCount(0);
        setPhase("sent");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // 3. Audio — full StarLight siren (plays through silent mode)
        startEmergencySiren().catch((e) =>
          console.warn("[StarLight] Siren error:", e)
        );

        // 4. Mesh — encrypt a no-action test string and beam it to the first
        //    online peer (priority packet); falls back to local log if no peers.
        const encrypted = await encryptStarPacket(
          "TEST_SOS_SIGNAL_NO_ACTION_REQUIRED"
        );
        const target = peers.find((p) => p.online);
        if (target) {
          sendMessage(target.id, encrypted, "SOS");
          console.log(
            `[StarLight] Test priority packet beamed to: ${target.name} (${target.id})`
          );
        } else {
          console.log("[StarLight] No online peers — test packet logged locally.");
        }

        Alert.alert(
          "✅ Test Successful",
          `Siren active · AES-256 test packet sent${target ? ` to ${target.name}` : " (no peers online)"}.\n\n` +
            `📍 ${packet.lat.toFixed(6)}, ${packet.lng.toFixed(6)}\n` +
            `🔋 Battery: ${packet.battery >= 0 ? `${packet.battery}%` : "N/A"} (${packet.batteryState})\n\n` +
            `⚠️ TEST MODE — No real alarm triggered.`,
          [
            {
              text: "Stop Siren",
              style: "destructive",
              onPress: cancelSOS,
            },
            { text: "OK", style: "default" },
          ]
        );
      } else {
        // ── REAL WORLD MODE ───────────────────────────────────────────────────
        const packet = await buildSOSPacket(nodeId);
        const payload = formatSOSMessage(packet);
        const count = await broadcastSOS(payload);

        setSentCount(count);
        setPhase("sent");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        startEmergencySiren().catch((e) =>
          console.warn("[StarLight] Siren error:", e)
        );

        const dest =
          count > 0 ? `${count} node${count !== 1 ? "s" : ""}` : "broadcast channel";
        Alert.alert(
          "🆘 SOS Beamed",
          `Emergency signal + GPS sent to ${dest} via AES-256 encrypted mesh.\n\n` +
            `📍 ${packet.lat.toFixed(6)}, ${packet.lng.toFixed(6)}\n` +
            `🔋 Battery: ${packet.battery >= 0 ? `${packet.battery}%` : "N/A"} (${packet.batteryState})\n\n` +
            `🔊 Emergency siren active — plays through silent mode`,
          [
            {
              text: "Cancel SOS",
              style: "destructive",
              onPress: cancelSOS,
            },
            { text: "Keep Active", style: "default" },
          ]
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setPhase("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "SOS Failed",
        `Could not beam emergency signal:\n${msg}\n\nCheck location permissions and mesh status.`,
        [{ text: "OK", onPress: () => setPhase("idle") }]
      );
    }
  }, [nodeId, broadcastSOS, sendMessage, peers, stopRings, cancelSOS]);

  const btnBg =
    phase === "sent" ? SOS_GREEN : phase === "error" ? colors.warning : SOS_RED;

  const ringColor = phase === "sent" ? SOS_GREEN : SOS_RED;

  const ringStyle = (anim: Animated.Value) => ({
    position: "absolute" as const,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: ringColor,
    opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.85, 0.5, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.wrapper}>
      {/* Expanding rings */}
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
      <Animated.View style={ringStyle(ring3)} />

      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={[
            styles.button,
            {
              backgroundColor: btnBg,
              transform: [{ scale: pulseAnim }],
              shadowColor: btnBg,
            },
            phase === "arming" && styles.buttonArming,
          ]}
        >
          {phase === "sending" ? (
            <MaterialCommunityIcons name="progress-clock" size={28} color="#fff" />
          ) : phase === "sent" ? (
            <MaterialCommunityIcons name="check-circle-outline" size={28} color="#fff" />
          ) : phase === "error" ? (
            <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#fff" />
          ) : (
            <Text style={styles.sosText}>SOS</Text>
          )}
        </Animated.View>
      </Pressable>

      {/* Arming progress bar */}
      {phase === "arming" && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth, backgroundColor: SOS_RED }]}
          />
        </View>
      )}

      <Text
        style={[
          styles.label,
          {
            color:
              phase === "sent"
                ? SOS_GREEN
                : phase === "error"
                ? colors.warning
                : colors.mutedForeground,
          },
        ]}
      >
        {phase === "idle" && "Hold to arm"}
        {phase === "arming" && "Arming SOS..."}
        {phase === "sending" && "Beaming..."}
        {phase === "sent" && `Active · ${sentCount > 0 ? sentCount + " nodes" : "broadcast"}`}
        {phase === "error" && "Failed — retry"}
      </Text>

      <Text style={[styles.peerHint, { color: colors.mutedForeground }]}>
        {onlinePeers > 0
          ? `${onlinePeers} node${onlinePeers !== 1 ? "s" : ""} reachable`
          : "No nodes · will broadcast"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 8 },
  button: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 18,
    elevation: 14,
  },
  buttonArming: { shadowOpacity: 1, shadowRadius: 28 },
  sosText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: 2,
  },
  progressTrack: {
    width: 110,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,23,68,0.2)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  peerHint: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
