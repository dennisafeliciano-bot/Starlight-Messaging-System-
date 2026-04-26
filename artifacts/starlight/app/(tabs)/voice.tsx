import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
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
import { type AIMode, type DeviceAIProfile, initializeSmartAI } from "@/utils/deviceAI";

type CommandResult = {
  id: string;
  input: string;
  response: string;
  intent: string;
  timestamp: number;
};

const VOICE_COMMANDS: { keywords: string[]; intent: string; response: (ctx: { location?: { latitude: number; longitude: number } | null; peerCount: number; messageCount: number }) => string }[] = [
  {
    keywords: ["location", "gps", "where", "coordinates", "position", "beam location"],
    intent: "SEND_LOCATION",
    response: ({ location }) =>
      location
        ? `Location beamed. Coordinates: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
        : "GPS signal not available. Please enable location services.",
  },
  {
    keywords: ["summary", "summarize", "messages", "unread", "what did i miss"],
    intent: "SUMMARIZE",
    response: ({ messageCount }) =>
      messageCount === 0
        ? "No messages in the mesh buffer."
        : `You have ${messageCount} messages in the mesh. Network is active and nodes are responsive.`,
  },
  {
    keywords: ["nodes", "peers", "who is", "nearby", "connected", "status"],
    intent: "MESH_STATUS",
    response: ({ peerCount }) =>
      `StarLight mesh has ${peerCount} active nodes in range. Signal quality is nominal.`,
  },
  {
    keywords: ["scan", "search", "find", "discover"],
    intent: "SCAN",
    response: () =>
      "Mesh scan initiated. Broadcasting discovery packet across all channels.",
  },
  {
    keywords: ["help", "commands", "what can you do"],
    intent: "HELP",
    response: () =>
      "Available voice commands: Send location, Check status, Summarize messages, Scan for nodes.",
  },
  {
    keywords: ["hello", "hey", "hi", "starlight"],
    intent: "GREETING",
    response: () =>
      "StarLight mesh online. Voice interface ready. How can I help?",
  },
];

function matchIntent(input: string) {
  const lower = input.toLowerCase();
  for (const cmd of VOICE_COMMANDS) {
    if (cmd.keywords.some((k) => lower.includes(k))) {
      return cmd;
    }
  }
  return null;
}

export default function VoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peers, messages, broadcastLocation } = useBle();
  const { location } = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [results, setResults] = useState<CommandResult[]>([]);
  const [aiProfile, setAiProfile] = useState<DeviceAIProfile | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    initializeSmartAI().then(setAiProfile);
  }, []);

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const onlinePeers = peers.filter((p) => p.online);

  const speakResponse = useCallback(
    async (text: string) => {
      setIsSpeaking(true);
      try {
        await Speech.speak(text, {
          language: "en-US",
          pitch: 1.0,
          rate: Platform.OS === "ios" ? 0.52 : 0.85,
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      } catch {
        setIsSpeaking(false);
      }
    },
    []
  );

  const processCommand = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      const matched = matchIntent(trimmed);
      const ctx = {
        location,
        peerCount: onlinePeers.length,
        messageCount: messages.length,
      };

      let responseText: string;
      let intent: string;

      if (matched) {
        responseText = matched.response(ctx);
        intent = matched.intent;

        if (intent === "SEND_LOCATION" && location) {
          broadcastLocation(location.latitude, location.longitude);
        }
      } else {
        responseText = `Command not recognized: "${trimmed}". Say "help" for available commands.`;
        intent = "UNKNOWN";
      }

      const result: CommandResult = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        input: trimmed,
        response: responseText,
        intent,
        timestamp: Date.now(),
      };

      setResults((prev) => [result, ...prev.slice(0, 9)]);
      speakResponse(responseText);
    },
    [location, onlinePeers, messages, broadcastLocation, speakResponse]
  );

  const startListening = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsListening(true);
    setTranscript("Listening...");

    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loopRef.current.start();

    setTimeout(() => {
      setIsListening(false);
      loopRef.current?.stop();
      pulseAnim.setValue(1);

      const demoCommands = [
        "send location",
        "mesh status",
        "summarize messages",
        "scan for nodes",
        "hello starlight",
      ];
      const demo = demoCommands[Math.floor(Math.random() * demoCommands.length)];
      setTranscript(demo);
      processCommand(demo);
    }, 2500);
  }, [pulseAnim, processCommand]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    loopRef.current?.stop();
    pulseAnim.setValue(1);
    setTranscript("");
  }, [pulseAnim]);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const intentColor = (intent: string) => {
    if (intent === "SEND_LOCATION") return colors.accent;
    if (intent === "UNKNOWN") return colors.destructive;
    return colors.primary;
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
          <Text style={[styles.title, { color: colors.foreground }]}>
            Voice Command
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            AI-powered mesh control
          </Text>
        </View>
        {aiProfile && (
          <View
            style={[
              styles.aiModeBadge,
              {
                backgroundColor:
                  aiProfile.mode === "TURBO"
                    ? colors.primary + "22"
                    : colors.warning + "22",
              },
            ]}
          >
            <MaterialCommunityIcons
              name={aiProfile.mode === "TURBO" ? "lightning-bolt" : "speedometer-slow"}
              size={13}
              color={aiProfile.mode === "TURBO" ? colors.primary : colors.warning}
            />
            <Text
              style={[
                styles.aiModeText,
                { color: aiProfile.mode === "TURBO" ? colors.primary : colors.warning },
              ]}
            >
              {aiProfile.mode === "TURBO" ? "TURBO" : "LITE"}
              {aiProfile.memoryGB > 0 ? ` · ${aiProfile.memoryGB.toFixed(1)}GB` : ""}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.micSection}>
        <View style={styles.micContainer}>
          <Animated.View
            style={[
              styles.micRing,
              {
                borderColor: isListening ? colors.accent : colors.border,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <TouchableOpacity
            style={[
              styles.micBtn,
              {
                backgroundColor: isListening
                  ? colors.accent
                  : isSpeaking
                  ? colors.primary
                  : colors.secondary,
              },
            ]}
            onPress={isListening ? stopListening : isSpeaking ? stopSpeaking : startListening}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={
                isListening
                  ? "microphone"
                  : isSpeaking
                  ? "volume-high"
                  : "microphone-outline"
              }
              size={36}
              color={
                isListening
                  ? colors.accentForeground
                  : isSpeaking
                  ? colors.primaryForeground
                  : colors.mutedForeground
              }
            />
          </TouchableOpacity>
        </View>

        <Text
          style={[
            styles.micStatus,
            {
              color: isListening
                ? colors.accent
                : isSpeaking
                ? colors.primary
                : colors.mutedForeground,
            },
          ]}
        >
          {isListening
            ? "Listening..."
            : isSpeaking
            ? "Speaking..."
            : "Tap to activate voice"}
        </Text>

        {transcript !== "" && (
          <View
            style={[
              styles.transcriptBubble,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="mic" size={13} color={colors.primary} />
            <Text style={[styles.transcriptText, { color: colors.foreground }]}>
              {transcript}
            </Text>
          </View>
        )}

        <View style={styles.quickCommands}>
          {["Send Location", "Mesh Status", "Summarize"].map((cmd) => (
            <TouchableOpacity
              key={cmd}
              style={[
                styles.quickBtn,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                processCommand(cmd.toLowerCase());
                setTranscript(cmd.toLowerCase());
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.quickBtnText, { color: colors.foreground }]}>
                {cmd}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.historyScroll}
        contentContainerStyle={{ gap: 10, padding: 16, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 }}
      >
        {results.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="microphone-off"
              size={36}
              color={colors.border}
            />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Command history will appear here
            </Text>
          </View>
        ) : (
          results.map((r) => (
            <View
              key={r.id}
              style={[
                styles.resultCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.resultHeader}>
                <View
                  style={[
                    styles.intentBadge,
                    { backgroundColor: intentColor(r.intent) + "22" },
                  ]}
                >
                  <Text
                    style={[
                      styles.intentText,
                      { color: intentColor(r.intent) },
                    ]}
                  >
                    {r.intent.replace("_", " ")}
                  </Text>
                </View>
                <Text style={[styles.resultTime, { color: colors.mutedForeground }]}>
                  {formatTime(r.timestamp)}
                </Text>
              </View>
              <Text style={[styles.resultInput, { color: colors.mutedForeground }]}>
                "{r.input}"
              </Text>
              <Text style={[styles.resultResponse, { color: colors.foreground }]}>
                {r.response}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  aiModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  aiModeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  micSection: {
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: 20,
    gap: 16,
  },
  micContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  micRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  micStatus: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  transcriptBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  transcriptText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  quickCommands: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  quickBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  historyScroll: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  resultCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  intentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  intentText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  resultTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  resultInput: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  resultResponse: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
});
