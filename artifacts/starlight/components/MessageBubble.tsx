import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { type Message } from "@/context/BleContext";
import { useColors } from "@/hooks/useColors";

type Props = {
  message: Message;
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: Props) {
  const colors = useColors();
  const isOut = message.outgoing;

  const bubbleColor = isOut ? colors.primary : colors.card;
  const textColor = isOut ? colors.primaryForeground : colors.foreground;

  const typeIcon =
    message.type === "GPS_PING" ? (
      <Ionicons name="location" size={12} color={textColor} style={{ opacity: 0.8 }} />
    ) : message.type === "VOICE" ? (
      <MaterialCommunityIcons name="microphone" size={12} color={textColor} style={{ opacity: 0.8 }} />
    ) : null;

  return (
    <View style={[styles.wrapper, isOut ? styles.wrapperOut : styles.wrapperIn]}>
      {!isOut && (
        <Text style={[styles.sender, { color: colors.mutedForeground }]}>
          {message.peerName}
        </Text>
      )}
      <View
        style={[
          styles.bubble,
          { backgroundColor: bubbleColor },
          isOut ? styles.bubbleOut : styles.bubbleIn,
        ]}
      >
        {typeIcon && <View style={styles.typeRow}>{typeIcon}</View>}
        <Text style={[styles.content, { color: textColor }]}>
          {message.content}
        </Text>
        <View style={styles.footer}>
          {message.encrypted && (
            <View style={styles.encryptBadge}>
              <Ionicons
                name="lock-closed"
                size={9}
                color={isOut ? "rgba(6,13,26,0.55)" : colors.online}
              />
              <Text
                style={[
                  styles.encryptLabel,
                  { color: isOut ? "rgba(6,13,26,0.55)" : colors.online },
                ]}
              >
                AES-256
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.time,
              { color: isOut ? "rgba(6,13,26,0.5)" : colors.mutedForeground },
            ]}
          >
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
    maxWidth: "80%",
  },
  wrapperOut: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  wrapperIn: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  sender: {
    fontSize: 11,
    marginBottom: 3,
    fontFamily: "Inter_500Medium",
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 4,
  },
  bubbleOut: {
    borderBottomRightRadius: 4,
  },
  bubbleIn: {
    borderBottomLeftRadius: 4,
  },
  typeRow: {
    marginBottom: 1,
  },
  content: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 2,
  },
  encryptBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  encryptLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  time: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
