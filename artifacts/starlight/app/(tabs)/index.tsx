import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
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
import { type Peer, useBle } from "@/context/BleContext";
import { useColors } from "@/hooks/useColors";

export default function MeshScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peers, messages, isScanning, nodeStatus, encryptionEnabled, sendMessage, userName } = useBle();
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [text, setText] = useState("");
  const [showPeers, setShowPeers] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  const onlinePeers = peers.filter((p) => p.online);

  const filteredMessages = selectedPeer
    ? messages.filter((m) => m.peerId === selectedPeer.id)
    : messages;

  const handleSend = useCallback(async () => {
    if (!text.trim() || !selectedPeer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.82, duration: 90, useNativeDriver: true }),
      Animated.timing(sendScale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
    sendMessage(selectedPeer.id, text.trim());
    setText("");
    setTimeout(() => setSending(false), 400);
  }, [text, selectedPeer, sendMessage, sendScale]);

  const handleAttach = useCallback(() => {
    if (!selectedPeer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Select a node first", "Choose a peer node before attaching a file.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Attach File",
      "Choose what to beam over the mesh",
      [
        {
          text: "Photo",
          onPress: () => {
            sendMessage(selectedPeer.id, "[📷 Photo attachment — coming in next build]");
          },
        },
        {
          text: "Location Pin",
          onPress: () => {
            sendMessage(selectedPeer.id, "[📍 Location pin shared via mesh]");
          },
        },
        {
          text: "Voice Clip",
          onPress: () => {
            sendMessage(selectedPeer.id, "[🎤 Voice clip — coming in next build]");
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }, [selectedPeer, sendMessage]);

  const handleSelectPeer = (peer: Peer) => {
    setSelectedPeer((prev) => (prev?.id === peer.id ? null : peer));
    setShowPeers(false);
  };

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBotPad = Platform.OS === "web" ? 34 : 0;

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
            <Text
              style={[
                styles.peerSelectorText,
                { color: selectedPeer ? colors.foreground : colors.mutedForeground },
              ]}
            >
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
          <View
            style={[
              styles.peerDropdown,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {onlinePeers.length === 0 ? (
              <Text style={[styles.emptyPeers, { color: colors.mutedForeground }]}>
                No nodes detected nearby
              </Text>
            ) : (
              onlinePeers.map((p) => (
                <PeerCard
                  key={p.id}
                  peer={p}
                  onPress={handleSelectPeer}
                  selected={selectedPeer?.id === p.id}
                />
              ))
            )}
          </View>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={[styles.messageList, { paddingBottom: 8 }]}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="access-point-network"
              size={48}
              color={colors.border}
            />
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
              {selectedPeer
                ? `No messages with ${selectedPeer.name}`
                : "Mesh is listening..."}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {selectedPeer
                ? "Send the first packet"
                : "Select a node above to start beaming"}
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + webBotPad + 6,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.messengerPill,
            {
              backgroundColor: colors.card,
              borderColor: selectedPeer ? colors.primary : colors.border,
            },
          ]}
        >
          {/* Attach button */}
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

          {/* Text input */}
          <TextInput
            style={[styles.pillInput, { color: colors.foreground }]}
            value={text}
            onChangeText={setText}
            placeholder={
              selectedPeer
                ? `Message ${selectedPeer.name}${encryptionEnabled ? " 🔒" : ""}…`
                : "Type secure message..."
            }
            placeholderTextColor={colors.mutedForeground}
            multiline
            returnKeyType="default"
            editable={!!selectedPeer}
            maxLength={500}
          />

          {/* Send button */}
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || !selectedPeer || sending}
              activeOpacity={0.8}
              style={[
                styles.sendCircle,
                {
                  backgroundColor:
                    text.trim() && selectedPeer ? colors.primary : "transparent",
                },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={
                  text.trim() && selectedPeer
                    ? colors.primaryForeground
                    : colors.mutedForeground
                }
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Character count when typing */}
        {text.length > 400 && (
          <Text style={[styles.charCount, { color: text.length >= 500 ? colors.destructive : colors.mutedForeground }]}>
            {500 - text.length} chars left
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  peerSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  peerSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  peerSelectorText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  peerDropdown: {
    margin: 12,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  emptyPeers: {
    textAlign: "center",
    padding: 12,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  messageList: {
    paddingHorizontal: 14,
    paddingTop: 12,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  emptyHint: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
    fontFamily: "Inter_400Regular",
  },
  inputWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 4,
  },
  messengerPill: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    gap: 10,
    minHeight: 52,
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
    paddingRight: 4,
  },
});
