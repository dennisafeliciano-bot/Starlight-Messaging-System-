import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

export type Coords = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

type LocationContextType = {
  location: Coords | null;
  permissionGranted: boolean;
  loading: boolean;
  requestLocation: () => Promise<void>;
};

const LocationContext = createContext<LocationContextType | null>(null);

const DEFAULT_LOCATION: Coords = {
  latitude: 40.7128,
  longitude: -74.006,
  accuracy: 5,
};

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<Coords | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(async () => {
    if (Platform.OS === "web") {
      setLocation(DEFAULT_LOCATION);
      setPermissionGranted(true);
      return;
    }
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        });
      } else {
        setLocation(DEFAULT_LOCATION);
        setPermissionGranted(false);
      }
    } catch {
      setLocation(DEFAULT_LOCATION);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <LocationContext.Provider
      value={{ location, permissionGranted, loading, requestLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
