import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useCallback, useRef, useState } from "react";
import {
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
  const { peers, messages, isScanning, nodeStatus, encryptionEnabled, sendMessage } = useBle();
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [text, setText] = useState("");
  const [showPeers, setShowPeers] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const onlinePeers = peers.filter((p) => p.online);

  const filteredMessages = selectedPeer
    ? messages.filter((m) => m.peerId === selectedPeer.id)
    : messages;

  const handleSend = useCallback(() => {
    if (!text.trim() || !selectedPeer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(selectedPeer.id, text.trim());
    setText("");
  }, [text, selectedPeer, sendMessage]);

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
          styles.inputRow,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + webBotPad + 8,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.secondary,
              color: colors.foreground,
              borderColor: colors.border,
            },
          ]}
          value={text}
          onChangeText={setText}
          placeholder="Beam a message..."
          placeholderTextColor={colors.mutedForeground}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!!selectedPeer}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: text.trim() && selectedPeer ? colors.primary : colors.border,
            },
          ]}
          onPress={handleSend}
          disabled={!text.trim() || !selectedPeer}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
