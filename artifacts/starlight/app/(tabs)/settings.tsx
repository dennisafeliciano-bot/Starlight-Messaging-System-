import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBle } from "@/context/BleContext";
import { useColors } from "@/hooks/useColors";

type SettingRowProps = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
};

function SettingRow({
  icon,
  label,
  sublabel,
  right,
  onPress,
  destructive,
}: SettingRowProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: destructive
                ? colors.destructive + "22"
                : colors.secondary,
            },
          ]}
        >
          {icon}
        </View>
        <View style={styles.rowInfo}>
          <Text
            style={[
              styles.rowLabel,
              { color: destructive ? colors.destructive : colors.foreground },
            ]}
          >
            {label}
          </Text>
          {sublabel && (
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              {sublabel}
            </Text>
          )}
        </View>
      </View>
      {right}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    peers,
    messages,
    nodeStatus,
    userName,
    setUserName,
    clearMessages,
    encryptionEnabled,
    setEncryptionEnabled,
  } = useBle();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [meshEnabled, setMeshEnabled] = useState(true);
  const [locationShare, setLocationShare] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const onlinePeers = peers.filter((p) => p.online);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      setUserName(nameInput.trim().replace(/\s+/g, "_"));
    }
    setEditingName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleClearMessages = () => {
    if (Platform.OS === "web") {
      clearMessages();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Alert.alert(
      "Clear All Messages",
      "This will delete all mesh messages from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            clearMessages();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const statusColor =
    nodeStatus === "active"
      ? colors.online
      : nodeStatus === "idle"
      ? colors.warning
      : colors.destructive;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20,
        paddingTop: webTopPad,
      }}
    >
      <View
        style={[
          styles.profileCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[styles.avatar, { backgroundColor: colors.primary + "33" }]}
        >
          <MaterialCommunityIcons
            name="account-network"
            size={32}
            color={colors.primary}
          />
        </View>
        <View style={styles.profileInfo}>
          {editingName ? (
            <View style={styles.nameEdit}>
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <TouchableOpacity onPress={handleSaveName}>
                <Ionicons name="checkmark-circle" size={26} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: colors.foreground }]}>
                {userName}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNameInput(userName);
                  setEditingName(true);
                }}
              >
                <Ionicons name="pencil" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.nodeBadge}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.nodeStatus, { color: statusColor }]}>
              {nodeStatus === "active" ? "Node Online" : "Node Idle"}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.statsRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {[
          { label: "Nodes Linked", value: onlinePeers.length.toString() },
          { label: "Messages", value: messages.length.toString() },
          { label: "Total Peers", value: peers.length.toString() },
        ].map((s, i) => (
          <View
            key={s.label}
            style={[
              styles.statItem,
              i < 2 && { borderRightWidth: 1, borderRightColor: colors.border },
            ]}
          >
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {s.value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
        MESH SETTINGS
      </Text>
      <View
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <SettingRow
          icon={
            <MaterialCommunityIcons
              name="access-point-network"
              size={18}
              color={colors.primary}
            />
          }
          label="StarLight Mesh"
          sublabel="Bluetooth mesh broadcasting"
          right={
            <Switch
              value={meshEnabled}
              onValueChange={(v) => {
                setMeshEnabled(v);
                Haptics.selectionAsync();
              }}
              trackColor={{ false: colors.border, true: colors.primary + "88" }}
              thumbColor={meshEnabled ? colors.primary : colors.mutedForeground}
            />
          }
        />
        <SettingRow
          icon={
            <Ionicons name="location" size={18} color={colors.accent} />
          }
          label="GPS Sharing"
          sublabel="Share location with mesh nodes"
          right={
            <Switch
              value={locationShare}
              onValueChange={(v) => {
                setLocationShare(v);
                Haptics.selectionAsync();
              }}
              trackColor={{ false: colors.border, true: colors.accent + "88" }}
              thumbColor={locationShare ? colors.accent : colors.mutedForeground}
            />
          }
        />
        <SettingRow
          icon={
            <MaterialCommunityIcons
              name="microphone"
              size={18}
              color={colors.signal}
            />
          }
          label="Voice Commands"
          sublabel="AI-powered voice interface"
          right={
            <Switch
              value={voiceEnabled}
              onValueChange={(v) => {
                setVoiceEnabled(v);
                Haptics.selectionAsync();
              }}
              trackColor={{ false: colors.border, true: colors.signal + "88" }}
              thumbColor={voiceEnabled ? colors.signal : colors.mutedForeground}
            />
          }
        />
        <SettingRow
          icon={
            <Ionicons name="lock-closed" size={18} color={colors.online} />
          }
          label="AES-256 Encryption"
          sublabel="End-to-end encrypt all packets"
          right={
            <Switch
              value={encryptionEnabled}
              onValueChange={(v) => {
                setEncryptionEnabled(v);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              trackColor={{ false: colors.border, true: colors.online + "88" }}
              thumbColor={encryptionEnabled ? colors.online : colors.mutedForeground}
            />
          }
        />
      </View>

      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
        DATA
      </Text>
      <View
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <SettingRow
          icon={
            <Ionicons name="trash" size={18} color={colors.destructive} />
          }
          label="Clear Message Cache"
          sublabel={`${messages.length} messages stored`}
          onPress={handleClearMessages}
          destructive
        />
      </View>

      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
        ABOUT
      </Text>
      <View
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <SettingRow
          icon={
            <MaterialCommunityIcons
              name="star-four-points"
              size={18}
              color={colors.primary}
            />
          }
          label="StarLight"
          sublabel="v1.0.0 · Mesh communication layer"
        />
        <SettingRow
          icon={
            <MaterialCommunityIcons
              name="shield-check"
              size={18}
              color={colors.online}
            />
          }
          label="Encryption"
          sublabel="End-to-end · AES-256 simulated"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { flex: 1, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameEdit: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  nameInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    borderWidth: 1,
    fontFamily: "Inter_400Regular",
  },
  nodeBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  nodeStatus: { fontSize: 12, fontFamily: "Inter_500Medium" },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  sectionHeader: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowSub: { fontSize: 12, marginTop: 1, fontFamily: "Inter_400Regular" },
});
