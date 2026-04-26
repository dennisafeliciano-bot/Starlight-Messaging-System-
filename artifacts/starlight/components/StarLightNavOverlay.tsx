import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter, useSegments } from "expo-router";
import React, { useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  bottomOffset?: number;
};

type NavItem = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
  segment: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { icon: "radio-outline",          route: "/(tabs)",         segment: "(tabs)",   label: "Mesh"   },
  { icon: "navigate-circle-outline", route: "/(tabs)/map",     segment: "map",      label: "Radar"  },
  { icon: "chatbubble-ellipses-outline", route: "/(tabs)/chat", segment: "chat",   label: "Chat"   },
  { icon: "mic-outline",            route: "/(tabs)/voice",   segment: "voice",    label: "Voice"  },
  { icon: "settings-outline",       route: "/(tabs)/settings", segment: "settings", label: "Node"  },
];

export function StarLightNavOverlay({ bottomOffset = 0 }: Props) {
  const router = useRouter();
  const segments = useSegments();
  const colors = useColors();

  const scaleBack = useRef(new Animated.Value(1)).current;
  const scaleRefs = useRef(NAV_ITEMS.map(() => new Animated.Value(1))).current;

  const currentSegment = segments[segments.length - 1] ?? "";

  const punchAnim = (anim: Animated.Value, cb: () => void) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.82, duration: 70, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start(cb);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    punchAnim(scaleBack, () => {
      if (router.canGoBack()) router.back();
      else router.navigate("/(tabs)");
    });
  };

  const handleNav = (item: NavItem, anim: Animated.Value) => {
    Haptics.selectionAsync();
    punchAnim(anim, () => router.navigate(item.route as never));
  };

  const activeNeon = colors.primary;
  const dimColor = "rgba(0,212,255,0.35)";

  return (
    <>
      {/* ── Back arrow — floats above the composer input ── */}
      <View
        pointerEvents="box-none"
        style={[styles.backWrap, { bottom: bottomOffset + 8 }]}
      >
        <Animated.View style={{ transform: [{ scale: scaleBack }] }}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.backBtn, { backgroundColor: "rgba(13,17,23,0.82)", borderColor: dimColor }]}
          >
            <Ionicons name="chevron-back-circle" size={30} color={activeNeon} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Right slide bar — vertical quick-nav rail ── */}
      <View
        pointerEvents="box-none"
        style={[
          styles.rail,
          {
            backgroundColor: "rgba(13,17,23,0.82)",
            borderColor: "rgba(0,212,255,0.28)",
          },
          Platform.OS === "web" && styles.railWeb,
        ]}
      >
        {NAV_ITEMS.map((item, idx) => {
          const isActive = currentSegment === item.segment;
          return (
            <Animated.View key={item.route} style={{ transform: [{ scale: scaleRefs[idx] }] }}>
              <TouchableOpacity
                onPress={() => handleNav(item, scaleRefs[idx])}
                activeOpacity={0.7}
                style={styles.railBtn}
                hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={isActive ? activeNeon : dimColor}
                />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Tactical neon divider */}
        <View style={[styles.divider, { backgroundColor: activeNeon }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backWrap: {
    position: "absolute",
    left: 10,
    zIndex: 1100,
  },
  backBtn: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
  },

  rail: {
    position: "absolute",
    right: 0,
    top: "25%",
    width: 46,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    borderWidth: 1,
    borderRightWidth: 0,
    paddingVertical: 10,
    alignItems: "center",
    zIndex: 1100,
    gap: 0,
  },
  railWeb: {
    top: "30%",
  },
  railBtn: {
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  divider: {
    width: 2,
    height: 34,
    borderRadius: 1,
    marginTop: 6,
    opacity: 0.7,
  },
});
