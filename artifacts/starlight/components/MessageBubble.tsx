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

  const icon =
    message.type === "GPS_PING" ? (
      <Ionicons name="location" size={13} color={textColor} />
    ) : message.type === "VOICE" ? (
      <MaterialCommunityIcons name="microphone" size={13} color={textColor} />
    ) : null;

  return (
    <View
      style={[styles.wrapper, isOut ? styles.wrapperOut : styles.wrapperIn]}
    >
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
        {icon && (
          <View style={styles.typeIndicator}>
            {icon}
          </View>
        )}
        <Text style={[styles.content, { color: textColor }]}>
          {message.content}
        </Text>
        <Text style={[styles.time, { color: isOut ? "rgba(6,13,26,0.6)" : colors.mutedForeground }]}>
          {formatTime(message.timestamp)}
        </Text>
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
  typeIndicator: {
    marginBottom: 2,
  },
  content: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  time: {
    fontSize: 10,
    alignSelf: "flex-end",
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
