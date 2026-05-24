import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { BT_WS_URL } from '@/utils/constants';
import { storage } from '@/utils/storage';

export interface BtUser {
  userId: string;
  displayName: string;
  avatarInitial: string;
  distanceM: number;
}

export interface BluetoothContextType {
  isDiscovering: boolean;
  isConnected: boolean;
  nearbyUsers: BtUser[];
  startDiscovery: (radiusM?: number) => void;
  stopDiscovery: () => void;
  updateBeacon: (lat: number, lng: number) => void;
}

const BluetoothContext = createContext<BluetoothContextType | null>(null);

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<BtUser[]>([]);
  const radiusRef = useRef(50);

  useEffect(() => {
    const userId = storage.getUser()?.id;
    if (!userId) return;

    const socket = io(BT_WS_URL, {
      query: { userId },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsDiscovering(false);
    });

    socket.on('bt:nearby-list', (data: { users: BtUser[] }) => {
      setNearbyUsers(data.users || []);
    });

    socket.on('bt:user-found', (user: BtUser) => {
      setNearbyUsers(prev => {
        const existing = prev.findIndex(u => u.userId === user.userId);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = user;
          return next;
        }
        return [...prev, user].sort((a, b) => a.distanceM - b.distanceM);
      });
    });

    socket.on('bt:user-lost', (data: { userId: string }) => {
      setNearbyUsers(prev => prev.filter(u => u.userId !== data.userId));
    });

    socket.on('bt:stopped', () => {
      setIsDiscovering(false);
      setNearbyUsers([]);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const startDiscovery = useCallback((radiusM = 50) => {
    radiusRef.current = radiusM;
    const user = storage.getUser();
    const displayName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.email || 'Unknown';

    if (!navigator.geolocation) {
      alert('Geolocation is required for Bluetooth discovery.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        socketRef.current?.emit('bt:start', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          radiusM,
          displayName,
        });
        setIsDiscovering(true);
      },
      () => alert('Could not get location. Enable location access for Bluetooth discovery.')
    );
  }, []);

  const stopDiscovery = useCallback(() => {
    socketRef.current?.emit('bt:stop');
    setIsDiscovering(false);
    setNearbyUsers([]);
  }, []);

  const updateBeacon = useCallback((lat: number, lng: number) => {
    if (!isDiscovering) return;
    socketRef.current?.emit('bt:beacon', { latitude: lat, longitude: lng });
  }, [isDiscovering]);

  return (
    <BluetoothContext.Provider value={{ isDiscovering, isConnected, nearbyUsers, startDiscovery, stopDiscovery, updateBeacon }}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = (): BluetoothContextType => {
  const ctx = useContext(BluetoothContext);
  if (!ctx) throw new Error('useBluetooth must be used within BluetoothProvider');
  return ctx;
};
