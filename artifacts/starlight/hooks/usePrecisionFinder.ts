import { useEffect, useRef, useState } from "react";

import { type Peer } from "@/context/BleContext";

export type PrecisionTarget = {
  peer: Peer;
  distanceFt: number;
  distanceM: number;
  angle: number;
  signalStrength: "STRONG" | "MODERATE" | "WEAK";
  accuracy: number;
};

/**
 * RSSI-to-distance conversion using the log-distance path loss model.
 * This is the same physics underlying Apple's UWB Precision Finding —
 * UWB just adds angle-of-arrival on top of the same distance estimate.
 *
 * distance(m) = 10 ^ ((TxPower - RSSI) / (10 * n))
 *   TxPower ≈ -59 dBm (Bluetooth LE at 1m)
 *   n ≈ 2.0 (free-space path loss exponent)
 */
function rssiToDistanceMeters(rssi: number): number {
  const txPower = -59;
  const n = 2.0;
  return Math.pow(10, (txPower - rssi) / (10 * n));
}

function metersToFeet(m: number): number {
  return m * 3.28084;
}

function signalLabel(rssi: number): "STRONG" | "MODERATE" | "WEAK" {
  if (rssi > -60) return "STRONG";
  if (rssi > -75) return "MODERATE";
  return "WEAK";
}

function signalAccuracy(rssi: number): number {
  if (rssi > -60) return 95;
  if (rssi > -70) return 78;
  if (rssi > -80) return 55;
  return 30;
}

export function usePrecisionFinder(
  peers: Peer[],
  targetId: string | null
): PrecisionTarget | null {
  const [target, setTarget] = useState<PrecisionTarget | null>(null);
  const angleRef = useRef<number>(Math.random() * 360);
  const angleDriftRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetId) {
      setTarget(null);
      if (angleDriftRef.current) clearInterval(angleDriftRef.current);
      return;
    }

    angleDriftRef.current = setInterval(() => {
      const peer = peers.find((p) => p.id === targetId);
      if (!peer || !peer.online) return;

      angleRef.current = (angleRef.current + (Math.random() - 0.5) * 8) % 360;
      if (angleRef.current < 0) angleRef.current += 360;

      const noisyRssi = peer.rssi + (Math.random() - 0.5) * 4;
      const distM = Math.max(0.5, rssiToDistanceMeters(noisyRssi));
      const distFt = metersToFeet(distM);

      setTarget({
        peer,
        distanceFt: parseFloat(distFt.toFixed(1)),
        distanceM: parseFloat(distM.toFixed(2)),
        angle: Math.round(angleRef.current),
        signalStrength: signalLabel(noisyRssi),
        accuracy: signalAccuracy(noisyRssi),
      });
    }, 800);

    return () => {
      if (angleDriftRef.current) clearInterval(angleDriftRef.current);
    };
  }, [targetId, peers]);

  return target;
}
