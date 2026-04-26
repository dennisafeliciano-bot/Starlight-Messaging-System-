import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  InputAccessoryView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Message, type Peer, useBle } from "@/context/BleContext";
import { useColors } from "@/hooks/useColors";

const INPUT_ACCESSORY_ID = "starlight-chat-input";

const TAB_BAR_H = Platform.OS === "web" ? 84 : Platform.OS === "android" ? 60 : 50;

const QUICK_EMOJIS = [
  "👍","🔒","⚡","📡","🗺️","🚨","✅","❌","👀","💬","🛰️","🔇","🔴","🟢","⚠️","🏁",
];

const AI_SUGGESTIONS = [
  "Status check — all nodes?",
  "Mesh stable. Proceeding.",
  "Need backup at this position.",
  "ETA to waypoint?",
  "Signal weak — moving to higher ground.",
  "Encryption verified. Comms secure.",
  "Rendezvous at last known location.",
  "Going radio silent for 10 min.",
  "Copy that. Standing by.",
  "All clear on this end.",
];

function ChatBubble({ message, colors }: { message: Message; colors: any }) {
  const isMe = message.outgoing;

  if (message.type === "GPS_PING") {
    return (
      <View style={bubbleStyles.systemRow}>
        <View style={[bubbleStyles.systemPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="map-marker" size={11} color={colors.primary} />
          <Text style={[bubbleStyles.systemText, { color: colors.mutedForeground }]}>{message.content}</Text>
        </View>
      </View>
    );
  }

  const isReply = message.content.startsWith("↩");
  const lines = isReply ? message.content.split("\n") : null;
  const quotedLine = lines?.[0] ?? "";
  const bodyText = isReply ? lines!.slice(1).join("\n") : message.content;

  return (
    <View style={[bubbleStyles.row, isMe ? bubbleStyles.rowMe : bubbleStyles.rowThem]}>
      {!isMe && (
        <View style={[bubbleStyles.avatar, { backgroundColor: colors.primary + "33" }]}>
          <Text style={[bubbleStyles.avatarInitial, { color: colors.primary }]}>
            {message.peerName?.charAt(0)?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}
      <View style={{ maxWidth: "72%", gap: 3 }}>
        {!isMe && (
          <Text style={[bubbleStyles.senderName, { color: colors.mutedForeground }]}>{message.peerName}</Text>
        )}
        <View
          style={[
            bubbleStyles.bubble,
            isMe
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
            isReply && { borderLeftWidth: 3, borderLeftColor: isMe ? "#ffffff55" : colors.accent },
          ]}
        >
          {isReply && (
            <Text
              style={[bubbleStyles.quotedText, { color: isMe ? "#ffffffaa" : colors.mutedForeground }]}
              numberOfLines={1}
            >
              {quotedLine}
            </Text>
          )}
          <Text style={[bubbleStyles.bodyText, { color: isMe ? colors.primaryForeground : colors.foreground }]}>
            {bodyText}
          </Text>
          <View style={bubbleStyles.meta}>
            {message.encrypted && (
              <Ionicons name="lock-closed" size={9} color={isMe ? "#ffffff88" : colors.online} />
            )}
            <Text style={[bubbleStyles.timeText, { color: isMe ? "#ffffff77" : colors.mutedForeground }]}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 14, alignItems: "flex-end", gap: 8 },
  rowMe: { justifyContent: "flex-end" },
  rowThem: { justifyContent: "flex-start" },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 12, fontFamily: "Inter_700Bold" },
  senderName: { fontSize: 11, fontFamily: "Inter_500Medium", paddingLeft: 2 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 4, maxWidth: "100%" },
  quotedText: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ffffff22" },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 2 },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  systemRow: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 14 },
  systemPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  systemText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peers, messages, encryptionEnabled, sendMessage } = useBle();

  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  // Bottom of composer above the tab bar
  const composerBottom = TAB_BAR_H + (Platform.OS === "ios" ? insets.bottom : 0);

  // Total height the composer takes up (toolbar + optional panels + pill + padding)
  const composerReserved = 120 + (showEmoji ? 56 : 0) + (showAI ? 90 : 0) + (replyTo ? 42 : 0);

  const threadMessages = selectedPeer
    ? messages.filter((m) => m.peerId === selectedPeer.id)
    : [];

  const lastIncoming = [...threadMessages].reverse().find((m) => !m.outgoing);

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
  }, [text, selectedPeer, replyTo, sendMessage, sendScale]);

  const requirePeer = (cb: () => void) => {
    if (!selectedPeer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Select a contact first", "Tap a node at the top to open a thread.");
      return;
    }
    cb();
  };

  const handleAttach = useCallback(() => requirePeer(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEmoji(false); setShowAI(false);
    Alert.alert("Beam Attachment", "Choose what to send over the mesh", [
      { text: "📷 Photo",        onPress: () => sendMessage(selectedPeer!.id, "[📷 Photo attachment]") },
      { text: "📍 Location Pin", onPress: () => sendMessage(selectedPeer!.id, "[📍 Location pin shared via mesh]") },
      { text: "🎤 Voice Clip",   onPress: () => sendMessage(selectedPeer!.id, "[🎤 Voice clip]") },
      { text: "📄 Document",     onPress: () => sendMessage(selectedPeer!.id, "[📄 Document shared via mesh]") },
      { text: "Cancel", style: "cancel" },
    ]);
  }), [selectedPeer, sendMessage]);

  const handleCamera = useCallback(() => requirePeer(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEmoji(false); setShowAI(false);
    Alert.alert("Camera", "Capture and beam a photo?", [
      { text: "📷 Capture Photo", onPress: () => sendMessage(selectedPeer!.id, "[📷 Photo via StarLight Camera]") },
      { text: "📸 Screenshot",    onPress: () => sendMessage(selectedPeer!.id, "[📸 Screenshot shared via mesh]") },
      { text: "Cancel", style: "cancel" },
    ]);
  }), [selectedPeer, sendMessage]);

  const handleReply = useCallback(() => {
    if (!lastIncoming) {
      Alert.alert("Nothing to reply to", "No incoming message in this thread.");
      return;
    }
    Haptics.selectionAsync();
    setReplyTo(lastIncoming);
    setShowEmoji(false); setShowAI(false);
    inputRef.current?.focus();
  }, [lastIncoming]);

  const injectEmoji = (e: string) => {
    setText((p) => p + e);
    Haptics.selectionAsync();
    inputRef.current?.focus();
  };

  const injectAI = (s: string) => {
    setText(s);
    setShowAI(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  const TOOLBAR_ITEMS = [
    { key: "AI",     isMC: true,  icon: "robot-excited-outline", active: showAI,     onPress: () => { Haptics.selectionAsync(); setShowAI(v => !v); setShowEmoji(false); } },
    { key: "Camera", isMC: false, icon: "camera-outline",        active: false,       onPress: handleCamera },
    { key: "Attach", isMC: false, icon: "attach-outline",        active: false,       onPress: handleAttach },
    { key: "Emoji",  isMC: false, icon: "happy-outline",         active: showEmoji,   onPress: () => { Haptics.selectionAsync(); setShowEmoji(v => !v); setShowAI(false); } },
    { key: "Reply",  isMC: true,  icon: "reply-outline",         active: !!replyTo,   onPress: handleReply },
  ] as const;

  const ToolbarRow = () => (
    <View style={[styles.featureToolbar, { backgroundColor: "rgba(13,17,23,0.97)", borderColor: colors.primary }]}>
      {TOOLBAR_ITEMS.map(({ key, isMC, icon, active, onPress }) => (
        <TouchableOpacity key={key} style={styles.toolbarBtn} onPress={onPress} activeOpacity={0.7}>
          {isMC
            ? <MaterialCommunityIcons name={icon as any} size={24} color={active ? colors.primary : colors.mutedForeground} />
            : <Ionicons name={icon as any} size={24} color={active ? colors.primary : colors.mutedForeground} />
          }
          <Text style={[styles.toolbarLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{key}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      {/* ── Header region ─────────────────────────────── */}
      <View style={{ paddingTop: webTopPad }}>
        {/* Contact rail */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.contactBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          contentContainerStyle={styles.contactBarContent}
        >
          {peers.length === 0 ? (
            <Text style={[styles.noNodes, { color: colors.mutedForeground }]}>No nodes in range</Text>
          ) : (
            peers.map((p) => {
              const isActive = selectedPeer?.id === p.id;
              const unread = messages.filter(m => m.peerId === p.id && !m.outgoing).length;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.contactPill}
                  onPress={() => setSelectedPeer(isActive ? null : p)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.contactAvatar, {
                    backgroundColor: isActive ? colors.primary : colors.secondary,
                    borderColor: p.online ? colors.online : colors.border,
                    borderWidth: 2,
                  }]}>
                    <Text style={[styles.contactInitial, { color: isActive ? colors.primaryForeground : colors.foreground }]}>
                      {p.name.charAt(0).toUpperCase()}
                    </Text>
                    {unread > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
                        <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.contactName, { color: isActive ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>
                    {p.name.split(" ")[0]}
                  </Text>
                  <View style={[styles.onlineDot, { backgroundColor: p.online ? colors.online : colors.mutedForeground }]} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Thread header */}
        {selectedPeer && (
          <View style={[styles.threadHeader, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
            <View style={styles.threadHeaderLeft}>
              <View style={[styles.threadDot, { backgroundColor: selectedPeer.online ? colors.online : colors.mutedForeground }]} />
              <Text style={[styles.threadName, { color: colors.foreground }]}>{selectedPeer.name}</Text>
              {encryptionEnabled && (
                <View style={[styles.e2eBadge, { backgroundColor: colors.online + "22" }]}>
                  <Ionicons name="lock-closed" size={10} color={colors.online} />
                  <Text style={[styles.e2eText, { color: colors.online }]}>E2E</Text>
                </View>
              )}
            </View>
            <View style={styles.threadHeaderRight}>
              {selectedPeer.rssi != null && (
                <Text style={[styles.rssi, { color: colors.mutedForeground }]}>{selectedPeer.rssi} dBm</Text>
              )}
              <TouchableOpacity onPress={() => setSelectedPeer(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle-outline" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Message history ─────────────────────────────── */}
      <View style={[styles.historyArea, { paddingBottom: composerReserved + composerBottom }]}>
        {!selectedPeer ? (
          <View style={styles.noThread}>
            <MaterialCommunityIcons name="chat-outline" size={56} color={colors.border} />
            <Text style={[styles.noThreadTitle, { color: colors.mutedForeground }]}>No conversation open</Text>
            <Text style={[styles.noThreadHint, { color: colors.mutedForeground }]}>
              Tap a node above to start a secure thread
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={threadMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} colors={colors} />}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyThread}>
                <MaterialCommunityIcons name="lock-outline" size={32} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {"Secure channel open\nSend the first message"}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* ── Elevated tactical input ─────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={composerBottom + 20}
        style={[styles.elevatedInputWrapper, { bottom: composerBottom }]}
      >
        {/* Feature toolbar — stealth neon border */}
        {Platform.OS !== "ios" && <ToolbarRow />}

        {/* Emoji panel */}
        {showEmoji && (
          <View style={[styles.panel, { backgroundColor: "rgba(13,17,23,0.97)", borderColor: colors.primary }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiScroll}>
              {QUICK_EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => injectEmoji(e)} style={styles.emojiBtn}>
                  <Text style={styles.emojiChar}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI phrases panel */}
        {showAI && (
          <View style={[styles.panel, { backgroundColor: "rgba(13,17,23,0.97)", borderColor: colors.primary }]}>
            <View style={styles.aiHeader}>
              <MaterialCommunityIcons name="robot-excited-outline" size={13} color={colors.primary} />
              <Text style={[styles.aiHeaderText, { color: colors.primary }]}>Quick mesh phrases</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiScroll}>
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

        {/* Reply banner */}
        {replyTo && (
          <View style={[styles.replyBanner, { backgroundColor: "rgba(13,17,23,0.97)", borderColor: colors.primary, borderLeftColor: colors.accent }]}>
            <View style={styles.replyInner}>
              <MaterialCommunityIcons name="reply" size={13} color={colors.accent} />
              <Text style={[styles.replyText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? "…" : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* Pill input row */}
        <View style={[styles.inputRow, { backgroundColor: "rgba(13,17,23,0.97)", borderTopColor: colors.border }]}>
          <View style={[styles.pill, { backgroundColor: colors.card, borderColor: selectedPeer ? colors.primary : colors.border }]}>
            <TouchableOpacity onPress={handleAttach} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="add-circle-outline" size={28} color={selectedPeer ? colors.primary : colors.mutedForeground} />
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
              editable={!!selectedPeer}
              maxLength={500}
            />

            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <TouchableOpacity
                onPress={handleSend}
                disabled={!text.trim() || !selectedPeer || sending}
                activeOpacity={0.8}
                style={[styles.sendCircle, { backgroundColor: text.trim() && selectedPeer ? colors.primary : "transparent" }]}
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
              {500 - text.length}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* iOS sticky toolbar above keyboard */}
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <ToolbarRow />
        </InputAccessoryView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },

  contactBar: { borderBottomWidth: 1, maxHeight: 90 },
  contactBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 16, alignItems: "center" },
  noNodes: { fontSize: 13, fontFamily: "Inter_400Regular", paddingHorizontal: 8 },
  contactPill: { alignItems: "center", gap: 4, width: 56 },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  contactInitial: { fontSize: 16, fontFamily: "Inter_700Bold" },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
  contactName: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },

  threadHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  threadHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  threadHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  threadDot: { width: 8, height: 8, borderRadius: 4 },
  threadName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  e2eBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  e2eText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  rssi: { fontSize: 11, fontFamily: "Inter_400Regular" },

  historyArea: { flex: 1 },
  messageList: { paddingTop: 10, paddingBottom: 12, flexGrow: 1 },
  noThread: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  noThreadTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  noThreadHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  emptyThread: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  /* Elevated input wrapper — floats above the tab bar */
  elevatedInputWrapper: {
    position: "absolute",
    width: "100%",
    zIndex: 999,
    elevation: 999,
  },

  /* Stealth neon toolbar */
  featureToolbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  toolbarBtn: { alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4 },
  toolbarLabel: { fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },

  /* Panels — share the stealth glass look */
  panel: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingVertical: 6,
  },
  emojiScroll: { paddingHorizontal: 12, gap: 4 },
  emojiBtn: { padding: 6 },
  emojiChar: { fontSize: 24 },

  aiHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
  aiHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  aiScroll: { paddingHorizontal: 12, gap: 8 },
  aiChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, maxWidth: 220 },
  aiChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderLeftWidth: 3,
  },
  replyInner: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  replyText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    gap: 10,
    minHeight: 50,
  },
  pillInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", maxHeight: 110, paddingTop: 0, paddingBottom: 0, lineHeight: 21 },
  sendCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  charCount: { fontSize: 12, fontFamily: "Inter_400Regular", width: 28, textAlign: "center" },
});
