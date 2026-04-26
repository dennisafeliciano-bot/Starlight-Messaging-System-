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

const QUICK_EMOJIS = ["👍", "🔒", "⚡", "📡", "🗺️", "🚨", "✅", "❌", "👀", "💬", "🛰️", "🔇", "🔴", "🟢", "⚠️", "🏁"];

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
  const isSystem = message.type === "GPS_PING";

  if (isSystem) {
    return (
      <View style={bubbleStyles.systemRow}>
        <View style={[bubbleStyles.systemBubble, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="map-marker" size={12} color={colors.primary} />
          <Text style={[bubbleStyles.systemText, { color: colors.mutedForeground }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  const isReply = message.content.startsWith("↩");

  return (
    <View style={[bubbleStyles.row, isMe ? bubbleStyles.rowMe : bubbleStyles.rowThem]}>
      {!isMe && (
        <View style={[bubbleStyles.avatar, { backgroundColor: colors.primary + "33" }]}>
          <Text style={[bubbleStyles.avatarText, { color: colors.primary }]}>
            {message.peerName?.charAt(0)?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}
      <View style={{ maxWidth: "72%", gap: 3 }}>
        {!isMe && (
          <Text style={[bubbleStyles.senderName, { color: colors.mutedForeground }]}>
            {message.peerName}
          </Text>
        )}
        <View
          style={[
            bubbleStyles.bubble,
            isMe
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.card, borderBottomLeftRadius: 4, borderColor: colors.border, borderWidth: 1 },
            isReply && { borderLeftWidth: 3, borderLeftColor: isMe ? "#ffffff55" : colors.accent },
          ]}
        >
          {isReply && (
            <Text
              style={[
                bubbleStyles.replyPreview,
                { color: isMe ? "#ffffffaa" : colors.mutedForeground },
              ]}
              numberOfLines={1}
            >
              {message.content.split("\n")[0]}
            </Text>
          )}
          <Text
            style={[
              bubbleStyles.bubbleText,
              { color: isMe ? colors.primaryForeground : colors.foreground },
            ]}
          >
            {isReply ? message.content.split("\n").slice(1).join("\n") : message.content}
          </Text>
          <View style={bubbleStyles.meta}>
            {message.encrypted && (
              <Ionicons name="lock-closed" size={9} color={isMe ? "#ffffff88" : colors.online} />
            )}
            <Text
              style={[
                bubbleStyles.time,
                { color: isMe ? "#ffffff77" : colors.mutedForeground },
              ]}
            >
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
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
  avatarText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  senderName: { fontSize: 11, fontFamily: "Inter_500Medium", paddingLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 4 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  replyPreview: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", paddingBottom: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  time: { fontSize: 10, fontFamily: "Inter_400Regular" },
  systemRow: { alignItems: "center", paddingVertical: 4, paddingHorizontal: 14 },
  systemBubble: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  systemText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    peers,
    messages,
    encryptionEnabled,
    sendMessage,
    userName,
  } = useBle();

  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [showPeerList, setShowPeerList] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  const onlinePeers = peers.filter((p) => p.online);
  const allPeers = peers;

  const threadMessages = selectedPeer
    ? messages.filter((m) => m.peerId === selectedPeer.id)
    : [];

  const lastReceivedMessage = [...threadMessages].reverse().find((m) => !m.outgoing);

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
  }, [text, selectedPeer, sendMessage, replyTo, sendScale]);

  const handleAttach = useCallback(() => {
    if (!selectedPeer) { promptSelectPeer(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEmoji(false); setShowAI(false);
    Alert.alert("Beam Attachment", "Choose what to send over the mesh", [
      { text: "📷 Photo", onPress: () => sendMessage(selectedPeer.id, "[📷 Photo attachment]") },
      { text: "📍 Location Pin", onPress: () => sendMessage(selectedPeer.id, "[📍 Location pin shared via mesh]") },
      { text: "🎤 Voice Clip", onPress: () => sendMessage(selectedPeer.id, "[🎤 Voice clip]") },
      { text: "📄 Document", onPress: () => sendMessage(selectedPeer.id, "[📄 Document shared via mesh]") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [selectedPeer, sendMessage]);

  const handleCamera = useCallback(() => {
    if (!selectedPeer) { promptSelectPeer(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEmoji(false); setShowAI(false);
    Alert.alert("Camera", "Capture and beam a photo?", [
      { text: "📷 Capture Photo", onPress: () => sendMessage(selectedPeer.id, "[📷 Photo via StarLight Camera]") },
      { text: "📸 Screenshot", onPress: () => sendMessage(selectedPeer.id, "[📸 Screenshot shared via mesh]") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [selectedPeer, sendMessage]);

  const handleReply = useCallback(() => {
    if (!lastReceivedMessage) {
      Alert.alert("Nothing to reply to", "No incoming message found in this thread.");
      return;
    }
    Haptics.selectionAsync();
    setReplyTo(lastReceivedMessage);
    setShowEmoji(false); setShowAI(false);
    inputRef.current?.focus();
  }, [lastReceivedMessage]);

  const promptSelectPeer = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Select a contact first", "Tap a node above to open a conversation.");
  };

  const injectEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    Haptics.selectionAsync();
    inputRef.current?.focus();
  };

  const injectAI = (s: string) => {
    setText(s);
    setShowAI(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  const ToolbarRow = () => (
    <View style={[styles.toolbar, { backgroundColor: colors.card, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
      {[
        { icon: "robot-excited-outline", label: "AI", isMC: true, active: showAI, onPress: () => { Haptics.selectionAsync(); setShowAI(v => !v); setShowEmoji(false); } },
        { icon: "camera-outline", label: "Camera", isMC: false, active: false, onPress: handleCamera },
        { icon: "attach-outline", label: "Attach", isMC: false, active: false, onPress: handleAttach },
        { icon: "happy-outline", label: "Emoji", isMC: false, active: showEmoji, onPress: () => { Haptics.selectionAsync(); setShowEmoji(v => !v); setShowAI(false); } },
        { icon: "reply-outline", label: "Reply", isMC: true, active: !!replyTo, onPress: handleReply },
      ].map(({ icon, label, isMC, active, onPress }) => (
        <TouchableOpacity key={label} style={styles.toolbarBtn} onPress={onPress} activeOpacity={0.7}>
          {isMC
            ? <MaterialCommunityIcons name={icon as any} size={24} color={active ? colors.primary : colors.mutedForeground} />
            : <Ionicons name={icon as any} size={24} color={active ? colors.primary : colors.mutedForeground} />
          }
          <Text style={[styles.toolbarLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ paddingTop: webTopPad }}>
        {/* Contact bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.contactBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          contentContainerStyle={styles.contactBarContent}
        >
          {allPeers.length === 0 ? (
            <Text style={[styles.noContacts, { color: colors.mutedForeground }]}>No nodes in range</Text>
          ) : (
            allPeers.map((p) => {
              const isActive = selectedPeer?.id === p.id;
              const unread = messages.filter(m => m.peerId === p.id && !m.outgoing).length;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.contactPill}
                  onPress={() => { setSelectedPeer(isActive ? null : p); setShowPeerList(false); }}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.contactAvatar,
                    {
                      backgroundColor: isActive ? colors.primary : colors.secondary,
                      borderColor: p.online ? colors.online : colors.border,
                      borderWidth: 2,
                    },
                  ]}>
                    <Text style={[styles.contactAvatarText, { color: isActive ? colors.primaryForeground : colors.foreground }]}>
                      {p.name.charAt(0).toUpperCase()}
                    </Text>
                    {unread > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.destructive }]}>
                        <Text style={styles.unreadText}>{unread > 9 ? "9+" : unread}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.contactName, { color: isActive ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>
                    {p.name.split(" ")[0]}
                  </Text>
                  <View style={[styles.contactStatus, { backgroundColor: p.online ? colors.online : colors.mutedForeground }]} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Active thread header */}
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
              {selectedPeer.rssi && (
                <Text style={[styles.rssiText, { color: colors.mutedForeground }]}>{selectedPeer.rssi} dBm</Text>
              )}
              <TouchableOpacity onPress={() => setSelectedPeer(null)}>
                <Ionicons name="close-circle-outline" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Message thread */}
      {!selectedPeer ? (
        <View style={styles.noThread}>
          <MaterialCommunityIcons name="chat-outline" size={56} color={colors.border} />
          <Text style={[styles.noThreadTitle, { color: colors.mutedForeground }]}>No conversation open</Text>
          <Text style={[styles.noThreadHint, { color: colors.mutedForeground }]}>Tap a node above to start a secure thread</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={threadMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} colors={colors} />}
          contentContainerStyle={[styles.messageList, { paddingBottom: 12 }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyThread}>
              <MaterialCommunityIcons name="lock-outline" size={32} color={colors.border} />
              <Text style={[styles.emptyThreadText, { color: colors.mutedForeground }]}>
                Secure channel open{"\n"}Send the first message
              </Text>
            </View>
          }
        />
      )}

      {/* ── Composer ── */}
      <View style={[styles.composerWrap, { backgroundColor: colors.background, paddingBottom: insets.bottom + webBotPad + 4, borderTopColor: colors.border }]}>
        {Platform.OS !== "ios" && <ToolbarRow />}

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

        {showAI && (
          <View style={[styles.aiBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

        {replyTo && (
          <View style={[styles.replyBanner, { backgroundColor: colors.secondary, borderLeftColor: colors.primary, marginHorizontal: 12, marginTop: 8 }]}>
            <View style={styles.replyBannerInner}>
              <MaterialCommunityIcons name="reply" size={13} color={colors.primary} />
              <Text style={[styles.replyText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? "…" : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

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
            placeholder={selectedPeer ? `Message ${selectedPeer.name}${encryptionEnabled ? " 🔒" : ""}…` : "Type encrypted message..."}
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
            {500 - text.length} left
          </Text>
        )}
      </View>

      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <ToolbarRow />
        </InputAccessoryView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  contactBar: { borderBottomWidth: 1, maxHeight: 90 },
  contactBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 16, alignItems: "center" },
  noContacts: { fontSize: 13, fontFamily: "Inter_400Regular", paddingHorizontal: 8 },
  contactPill: { alignItems: "center", gap: 4, width: 56 },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  contactAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  unreadBadge: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  unreadText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
  contactName: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  contactStatus: { width: 6, height: 6, borderRadius: 3 },

  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  threadHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  threadHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  threadDot: { width: 8, height: 8, borderRadius: 4 },
  threadName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  e2eBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  e2eText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  rssiText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  noThread: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  noThreadTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  noThreadHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },

  messageList: { paddingTop: 10, flexGrow: 1 },
  emptyThread: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyThreadText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  composerWrap: { borderTopWidth: 1, gap: 0 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  toolbarBtn: { alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4 },
  toolbarLabel: { fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },

  emojiBar: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 6 },
  emojiScroll: { paddingHorizontal: 12, gap: 4 },
  emojiBtn: { padding: 6 },
  emojiChar: { fontSize: 24 },

  aiBar: { borderTopWidth: 1, borderBottomWidth: 1, paddingBottom: 8 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
  aiHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  aiScroll: { paddingHorizontal: 12, gap: 8 },
  aiChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, maxWidth: 220 },
  aiChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  replyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: 3, borderRadius: 6 },
  replyBannerInner: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  replyText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  pill: { flexDirection: "row", alignItems: "flex-end", borderRadius: 26, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, gap: 10, minHeight: 52, margin: 10, marginTop: 8 },
  pillInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", maxHeight: 120, paddingTop: 2, paddingBottom: 2, lineHeight: 21 },
  sendCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right", paddingRight: 18, paddingBottom: 4 },
});
