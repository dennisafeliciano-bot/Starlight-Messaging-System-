import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export type StarContact = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  initials: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: StarContact) => void;
  alreadyAdded?: string[];
};

type PermState = "idle" | "loading" | "granted" | "denied";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function StarLightContactPicker({ visible, onClose, onSelect, alreadyAdded = [] }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permState, setPermState] = useState<PermState>("idle");
  const [contacts, setContacts] = useState<StarContact[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const slideAnim = useRef(new Animated.Value(800)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelected(new Set());
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 22, tension: 160 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      requestAndLoad();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 800, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const requestAndLoad = async () => {
    setPermState("loading");
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        setPermState("denied");
        return;
      }
      setPermState("granted");
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        sort: Contacts.SortTypes.FirstName,
      });
      const mapped: StarContact[] = data
        .filter((c) => c.name)
        .map((c) => ({
          id: c.id ?? `c_${Math.random()}`,
          name: c.name!,
          phone: c.phoneNumbers?.[0]?.number,
          email: c.emails?.[0]?.email,
          initials: getInitials(c.name!),
        }));
      setContacts(mapped);
    } catch {
      setPermState("denied");
    }
  };

  const filtered = contacts.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const toggleSelect = (contact: StarContact) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contact.id)) next.delete(contact.id);
      else next.add(contact.id);
      return next;
    });
  };

  const handleConfirm = () => {
    const picked = contacts.filter((c) => selected.has(c.id));
    if (picked.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    picked.forEach((c) => onSelect(c));
    onClose();
  };

  const handleSingleTap = (contact: StarContact) => {
    if (alreadyAdded.includes(contact.id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(contact);
    onClose();
  };

  const renderContact = useCallback(({ item }: { item: StarContact }) => {
    const isAdded = alreadyAdded.includes(item.id);
    const isSelected = selected.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.contactRow,
          { borderBottomColor: colors.border },
          isAdded && { opacity: 0.45 },
        ]}
        onPress={() => handleSingleTap(item)}
        onLongPress={() => toggleSelect(item)}
        activeOpacity={0.75}
        disabled={isAdded}
      >
        {/* Avatar */}
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: isSelected
                ? colors.primary
                : isAdded
                ? colors.secondary
                : colors.secondary,
              borderColor: isSelected ? colors.primary : colors.border,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}
        >
          {isSelected ? (
            <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.avatarText, { color: isAdded ? colors.mutedForeground : colors.foreground }]}>
              {item.initials}
            </Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={[styles.contactName, { color: isAdded ? colors.mutedForeground : colors.foreground }]}>
              {item.name}
            </Text>
            {isAdded && (
              <View style={[styles.addedPill, { backgroundColor: colors.online + "22" }]}>
                <Text style={[styles.addedText, { color: colors.online }]}>Added</Text>
              </View>
            )}
          </View>
          {item.phone && (
            <Text style={[styles.contactDetail, { color: colors.primary }]}>{item.phone}</Text>
          )}
          {!item.phone && item.email && (
            <Text style={[styles.contactDetail, { color: colors.mutedForeground }]}>{item.email}</Text>
          )}
        </View>

        {/* Arrow */}
        {!isAdded && (
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        )}
      </TouchableOpacity>
    );
  }, [selected, alreadyAdded, colors]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Shadow List</Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
              {permState === "granted"
                ? `${contacts.length} contacts synced`
                : "Import contacts to your mesh"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {selected.size > 0 && (
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={[styles.confirmText, { color: colors.primaryForeground }]}>
                  Add {selected.size}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={26} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        {permState === "granted" && (
          <View style={[styles.searchWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search contacts..."
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS !== "ios" && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Body */}
        {permState === "idle" || permState === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              Syncing Shadow List...
            </Text>
          </View>
        ) : permState === "denied" ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="account-lock-outline" size={52} color={colors.border} />
            <Text style={[styles.deniedTitle, { color: colors.foreground }]}>
              Contact Access Required
            </Text>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              StarLight needs contact access to build your Shadow List. Enable it in your device Settings.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="search" size={40} color={colors.border} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              No contacts match "{query}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderContact}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={8}
            updateCellsBatchingPeriod={40}
            removeClippedSubviews={true}
          />
        )}

        {/* Multi-select hint */}
        {permState === "granted" && contacts.length > 0 && selected.size === 0 && (
          <View style={[styles.hint, { borderTopColor: colors.border }]}>
            <MaterialCommunityIcons name="gesture-tap-hold" size={14} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Tap to add one · Long-press to select multiple
            </Text>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "85%",
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sheetSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  confirmBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  confirmText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 14,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  contactInfo: { flex: 1, gap: 3 },
  contactNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  contactName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  addedPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  addedText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  contactDetail: { fontSize: 12, fontFamily: "Inter_400Regular" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32, minHeight: 280 },
  stateText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  deniedTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },

  hint: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 10, borderTopWidth: 1 },
  hintText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
