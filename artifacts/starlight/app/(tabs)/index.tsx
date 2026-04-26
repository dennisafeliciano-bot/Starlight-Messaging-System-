import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  InputAccessoryView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageBubble } from "@/components/MessageBubble";
import { MeshStatusBar } from "@/components/MeshStatusBar";
import { PeerCard } from "@/components/PeerCard";
import { SOSButton } from "@/components/SOSButton";
import { StarLightNavOverlay } from "@/components/StarLightNavOverlay";
import { type Message, type Peer, useBle } from "@/context/BleContext";
import { useColors } from "@/hooks/useColors";

const INPUT_ACCESSORY_ID = "starlight-input";

const QUICK_EMOJIS = ["👍", "🔒", "⚡", "📡", "🗺️", "🚨", "✅", "❌", "👀", "💬", "🛰️", "🔇"];

const AI_SUGGESTIONS = [
  "Status check — all nodes?",
  "Mesh stable. Proceeding.",
  "Need backup at this position.",
  "ETA to waypoint?",
  "Signal weak — moving to higher ground.",
  "Encryption verified. Comms secure.",
  "Rendezvous at last known location.",
  "Going radio silent for 10 min.",
];

export default function MeshScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    peers,
    messages,
    isScanning,
    nodeStatus,
    encryptionEnabled,
    sendMessage,
    userName,
  } = useBle();

  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [text, setText] = useState("");
  const [showPeers, setShowPeers] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const sendScale = useRef(new Animated.Value(1)).current;
  const toolbarSlide = useRef(new Animated.Value(0)).current;

  const onlinePeers = peers.filter((p) => p.online);

  const filteredMessages = selectedPeer
    ? messages.filter((m) => m.peerId === selectedPeer.id)
    : messages;

  const lastReceivedMessage = [...filteredMessages]
    .reverse()
    .find((m) => !m.outgoing);

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBotPad = Platform.OS === "web" ? 34 : 0;

  const punchSend = () => {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.78, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
  };

  const handleSend = useCallback(async () => {
    if (!text.trim() || !selectedPeer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    punchSend();

    const payload = replyTo
      ? `↩ "${replyTo.content.slice(0, 40)}${replyTo.content.length > 40 ? "…" : ""}"\n${text.trim()}`
      : text.trim();

    sendMessage(selectedPeer.id, payload);
    setText("");
    setReplyTo(null);
    setShowEmoji(false);
    setShowAI(false);
    setTimeout(() => setSending(false), 400);
  }, [text, selectedPeer, sendMessage, replyTo]);

  const handleAttach = useCallback(() => {
    if (!selectedPeer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Select a node first", "Choose a peer before attaching.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEmoji(false);
    setShowAI(false);
    Alert.alert("Beam Attachment", "Choose what to send over the mesh", [
      { text: "📷 Photo", onPress: () => sendMessage(selectedPeer.id, "[📷 Photo attachment]") },
      { text: "📍 Location Pin", onPress: () => sendMessage(selectedPeer.id, "[📍 Location pin shared via mesh]") },
      { text: "🎤 Voice Clip", onPress: () => sendMessage(selectedPeer.id, "[🎤 Voice clip]") },
      { text: "📄 Document", onPress: () => sendMessage(selectedPeer.id, "[📄 Document shared via mesh]") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [selectedPeer, sendMessage]);

  const handleCamera = useCallback(() => {
    if (!selectedPeer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Select a node first", "Choose a peer before sending a photo.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEmoji(false);
    setShowAI(false);
    Alert.alert("Camera", "Capture and beam a photo?", [
      { text: "📷 Send Photo", onPress: () => sendMessage(selectedPeer.id, "[📷 Photo captured via StarLight Camera]") },
      { text: "📸 Screenshot", onPress: () => sendMessage(selectedPeer.id, "[📸 Screenshot shared via mesh]") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [selectedPeer, sendMessage]);

  const handleReply = useCallback(() => {
    if (!lastReceivedMessage) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Nothing to reply to", "No incoming message found in this thread.");
      return;
    }
    Haptics.selectionAsync();
    setReplyTo(lastReceivedMessage);
    setShowEmoji(false);
    setShowAI(false);
    inputRef.current?.focus();
  }, [lastReceivedMessage]);

  const handleAI = useCallback(() => {
    Haptics.selectionAsync();
    setShowEmoji(false);
    setShowAI((v) => !v);
  }, []);

  const handleEmojiToggle = useCallback(() => {
    Haptics.selectionAsync();
    setShowAI(false);
    setShowEmoji((v) => !v);
  }, []);

  const injectEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    Haptics.selectionAsync();
    inputRef.current?.focus();
  };

  const injectAI = (suggestion: string) => {
    setText(suggestion);
    setShowAI(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  const handleSelectPeer = (peer: Peer) => {
    setSelectedPeer((prev) => (prev?.id === peer.id ? null : peer));
    setShowPeers(false);
  };

  const toolbarActive = colors.primary;
  const toolbarInactive = colors.mutedForeground;

  const ToolbarRow = () => (
    <View style={[styles.toolbar, { backgroundColor: colors.card, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={styles.toolbarBtn}
        onPress={handleAI}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="robot-excited-outline"
          size={24}
          color={showAI ? toolbarActive : toolbarInactive}
        />
        <Text style={[styles.toolbarLabel, { color: showAI ? toolbarActive : toolbarInactive }]}>AI</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.toolbarBtn} onPress={handleCamera} activeOpacity={0.7}>
        <Ionicons name="camera-outline" size={24} color={toolbarInactive} />
        <Text style={[styles.toolbarLabel, { color: toolbarInactive }]}>Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.toolbarBtn} onPress={handleAttach} activeOpacity={0.7}>
        <Ionicons name="attach-outline" size={26} color={toolbarInactive} />
        <Text style={[styles.toolbarLabel, { color: toolbarInactive }]}>Attach</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.toolbarBtn} onPress={handleEmojiToggle} activeOpacity={0.7}>
        <Ionicons
          name="happy-outline"
          size={24}
          color={showEmoji ? toolbarActive : toolbarInactive}
        />
        <Text style={[styles.toolbarLabel, { color: showEmoji ? toolbarActive : toolbarInactive }]}>Emoji</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.toolbarBtn} onPress={handleReply} activeOpacity={0.7}>
        <MaterialCommunityIcons
          name="reply-outline"
          size={24}
          color={replyTo ? toolbarActive : toolbarInactive}
        />
        <Text style={[styles.toolbarLabel, { color: replyTo ? toolbarActive : toolbarInactive }]}>Reply</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={{ paddingTop: webTopPad }}>
        <MeshStatusBar
          status={nodeStatus}
          peerCount={onlinePeers.length}
          isScanning={isScanning}
          encrypted={encryptionEnabled}
        />

        <TouchableOpacity
          style={[styles.peerSelector, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}
          onPress={() => setShowPeers((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.peerSelectorLeft}>
            <MaterialCommunityIcons
              name="bluetooth-connect"
              size={16}
              color={selectedPeer ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.peerSelectorText, { color: selectedPeer ? colors.foreground : colors.mutedForeground }]}>
              {selectedPeer ? selectedPeer.name : "Select a node to beam"}
            </Text>
          </View>
          <Ionicons
            name={showPeers ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>

        {showPeers && (
          <View style={[styles.peerDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {onlinePeers.length === 0 ? (
              <Text style={[styles.emptyPeers, { color: colors.mutedForeground }]}>
                No nodes detected nearby
              </Text>
            ) : (
              onlinePeers.map((p) => (
                <PeerCard key={p.id} peer={p} onPress={handleSelectPeer} selected={selectedPeer?.id === p.id} />
              ))
            )}
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={[styles.messageList, { paddingBottom: 8 }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="access-point-network" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
                {selectedPeer ? `No messages with ${selectedPeer.name}` : "Mesh is listening..."}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                {selectedPeer ? "Send the first packet" : "Select a node above to start beaming"}
              </Text>
            </View>
          }
        />

        {/* Floating SOS button — top-right corner of feed */}
        <View
          pointerEvents="box-none"
          style={[styles.sosOverlay, { backgroundColor: colors.background + "CC", borderColor: "rgba(255,23,68,0.25)" }]}
        >
          <SOSButton nodeId={selectedPeer?.id ?? "local"} />
        </View>
      </View>

      {/* ── Bottom composer area ─────────────────────────── */}
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.background, paddingBottom: insets.bottom + webBotPad + 4, borderTopColor: colors.border },
        ]}
      >
        {/* Toolbar — inline on Android/web, InputAccessoryView on iOS */}
        {Platform.OS !== "ios" && <ToolbarRow />}

        {/* Emoji quick-picker */}
        {showEmoji && (
          <View style={[styles.emojiBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiScroll}>
              {QUICK_EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => injectEmoji(e)} style={styles.emojiBtn}>
                  <Text style={styles.emojiChar}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI suggestion chips */}
        {showAI && (
          <View style={[styles.aiBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.aiHeader}>
              <MaterialCommunityIcons name="robot-excited-outline" size={14} color={colors.primary} />
              <Text style={[styles.aiHeaderText, { color: colors.primary }]}>Quick mesh phrases</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiChipsScroll}>
              {AI_SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => injectAI(s)}
                  style={[styles.aiChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.aiChipText, { color: colors.foreground }]} numberOfLines={1}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Reply-to banner */}
        {replyTo && (
          <View style={[styles.replyBanner, { backgroundColor: colors.secondary, borderLeftColor: colors.primary }]}>
            <View style={styles.replyBannerInner}>
              <MaterialCommunityIcons name="reply" size={14} color={colors.primary} />
              <Text style={[styles.replyBannerText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? "…" : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* The pill input */}
        <View
          style={[
            styles.messengerPill,
            { backgroundColor: colors.card, borderColor: selectedPeer ? colors.primary : colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={handleAttach}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="add-circle-outline"
              size={28}
              color={selectedPeer ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.pillInput, { color: colors.foreground }]}
            inputAccessoryViewID={Platform.OS === "ios" ? INPUT_ACCESSORY_ID : undefined}
            value={text}
            onChangeText={setText}
            placeholder={
              selectedPeer
                ? `Message ${selectedPeer.name}${encryptionEnabled ? " 🔒" : ""}…`
                : "Type encrypted message..."
            }
            placeholderTextColor={colors.mutedForeground}
            multiline
            returnKeyType="default"
            editable={!!selectedPeer}
            maxLength={500}
          />

          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || !selectedPeer || sending}
              activeOpacity={0.8}
              style={[
                styles.sendCircle,
                { backgroundColor: text.trim() && selectedPeer ? colors.primary : "transparent" },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={text.trim() && selectedPeer ? colors.primaryForeground : colors.mutedForeground}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {text.length > 400 && (
          <Text style={[styles.charCount, { color: text.length >= 500 ? colors.destructive : colors.mutedForeground }]}>
            {500 - text.length} left
          </Text>
        )}
      </View>

      {/* iOS only: sticky toolbar above keyboard */}
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <ToolbarRow />
        </InputAccessoryView>
      )}

      {/* Nav overlay — back arrow + right quick-nav rail */}
      <StarLightNavOverlay />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  peerSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  peerSelectorLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  peerSelectorText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  peerDropdown: { margin: 12, borderRadius: 12, padding: 10, borderWidth: 1 },
  emptyPeers: { textAlign: "center", padding: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  messageList: { paddingHorizontal: 14, paddingTop: 12, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 80 },
  sosOverlay: {
    position: "absolute",
    bottom: 16,
    right: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 13, textAlign: "center", paddingHorizontal: 40, fontFamily: "Inter_400Regular" },

  /* ── Composer ── */
  inputWrap: { borderTopWidth: 1, gap: 0 },

  toolbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  toolbarBtn: { alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 4 },
  toolbarLabel: { fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },

  emojiBar: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  emojiScroll: { paddingHorizontal: 12, gap: 4 },
  emojiBtn: { padding: 6 },
  emojiChar: { fontSize: 24 },

  aiBar: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  aiHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  aiChipsScroll: { paddingHorizontal: 12, gap: 8 },
  aiChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 220,
  },
  aiChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderLeftWidth: 3,
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 6,
  },
  replyBannerInner: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  replyBannerText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  messengerPill: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    gap: 10,
    minHeight: 52,
    margin: 10,
    marginTop: 8,
  },
  pillInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
    paddingTop: 2,
    paddingBottom: 2,
    lineHeight: 21,
  },
  sendCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    paddingRight: 18,
    paddingBottom: 4,
  },
});
