import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type Peer = {
  id: string;
  name: string;
  rssi: number;
  lastSeen: number;
  lat?: number;
  lon?: number;
  online: boolean;
};

export type Message = {
  id: string;
  peerId: string;
  peerName: string;
  content: string;
  type: "TEXT" | "GPS_PING" | "VOICE";
  timestamp: number;
  outgoing: boolean;
};

type BleContextType = {
  peers: Peer[];
  messages: Message[];
  isScanning: boolean;
  nodeStatus: "active" | "idle" | "offline";
  sendMessage: (peerId: string, content: string, type?: Message["type"]) => void;
  broadcastLocation: (lat: number, lon: number) => void;
  userName: string;
  setUserName: (name: string) => void;
  clearMessages: () => void;
};

const BleContext = createContext<BleContextType | null>(null);

const MOCK_NAMES = [
  "Alpha Node",
  "Bravo Node",
  "Charlie Node",
  "Delta Node",
  "Echo Node",
  "Foxtrot Node",
];

const MOCK_MESSAGES = [
  "StarLight mesh is up. Signal strong.",
  "GPS confirmed. Moving to rally point.",
  "Copy that. Holding position.",
  "Heads up, new node detected nearby.",
  "Link quality nominal. Packet loss 0%.",
  "Signal boosted. Mesh extended.",
];

function makePeer(index: number): Peer {
  const baseNames = MOCK_NAMES;
  return {
    id: `node-${index}`,
    name: baseNames[index % baseNames.length],
    rssi: -(40 + Math.floor(Math.random() * 50)),
    lastSeen: Date.now() - Math.floor(Math.random() * 30000),
    lat: 40.7128 + (Math.random() - 0.5) * 0.01,
    lon: -74.006 + (Math.random() - 0.5) * 0.01,
    online: Math.random() > 0.2,
  };
}

const STORAGE_KEY = "@starlight_messages";
const USERNAME_KEY = "@starlight_username";

export function BleProvider({ children }: { children: React.ReactNode }) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<"active" | "idle" | "offline">(
    "idle"
  );
  const [userName, setUserNameState] = useState("Dennis_Feliciano");
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const storedMessages = await AsyncStorage.getItem(STORAGE_KEY);
        const storedName = await AsyncStorage.getItem(USERNAME_KEY);
        if (storedMessages) setMessages(JSON.parse(storedMessages));
        if (storedName) setUserNameState(storedName);
      } catch {}
    };
    load();
    startMesh();
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, []);

  const saveMessages = useCallback(async (msgs: Message[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-200)));
    } catch {}
  }, []);

  const startMesh = useCallback(() => {
    setIsScanning(true);
    setNodeStatus("active");

    const initialPeerCount = 2 + Math.floor(Math.random() * 3);
    const initial: Peer[] = Array.from({ length: initialPeerCount }, (_, i) =>
      makePeer(i)
    );
    setPeers(initial);

    scanIntervalRef.current = setInterval(() => {
      setPeers((prev) => {
        const updated = prev.map((p) => ({
          ...p,
          rssi: -(40 + Math.floor(Math.random() * 50)),
          lastSeen: p.online ? Date.now() : p.lastSeen,
          online: Math.random() > 0.15,
        }));

        if (Math.random() > 0.7 && updated.length < 6) {
          updated.push(makePeer(updated.length));
        }
        return updated;
      });
    }, 4000);

    pingIntervalRef.current = setInterval(() => {
      setPeers((currentPeers) => {
        if (currentPeers.length === 0) return currentPeers;
        const onlinePeers = currentPeers.filter((p) => p.online);
        if (onlinePeers.length === 0) return currentPeers;
        const peer = onlinePeers[Math.floor(Math.random() * onlinePeers.length)];
        const content =
          MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
        const msg: Message = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          peerId: peer.id,
          peerName: peer.name,
          content,
          type: "TEXT",
          timestamp: Date.now(),
          outgoing: false,
        };
        setMessages((prev) => {
          const next = [...prev, msg];
          saveMessages(next);
          return next;
        });
        return currentPeers;
      });
    }, 8000);
  }, [saveMessages]);

  const sendMessage = useCallback(
    (peerId: string, content: string, type: Message["type"] = "TEXT") => {
      const peer = peers.find((p) => p.id === peerId);
      const msg: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        peerId,
        peerName: peer?.name ?? "Unknown",
        content,
        type,
        timestamp: Date.now(),
        outgoing: true,
      };
      setMessages((prev) => {
        const next = [...prev, msg];
        saveMessages(next);
        return next;
      });
    },
    [peers, saveMessages]
  );

  const broadcastLocation = useCallback(
    (lat: number, lon: number) => {
      peers.filter((p) => p.online).forEach((peer) => {
        sendMessage(
          peer.id,
          `GPS_PING: ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          "GPS_PING"
        );
      });
    },
    [peers, sendMessage]
  );

  const setUserName = useCallback(async (name: string) => {
    setUserNameState(name);
    try {
      await AsyncStorage.setItem(USERNAME_KEY, name);
    } catch {}
  }, []);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return (
    <BleContext.Provider
      value={{
        peers,
        messages,
        isScanning,
        nodeStatus,
        sendMessage,
        broadcastLocation,
        userName,
        setUserName,
        clearMessages,
      }}
    >
      {children}
    </BleContext.Provider>
  );
}

export function useBle() {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error("useBle must be used within BleProvider");
  return ctx;
}
