import React, { useEffect, useRef, useState } from 'react';
import { useBluetooth, BtUser } from '@/context/BluetoothContext';
import { useCallContext } from '@/context/CallContext';
import { userService } from '@/services/userService';
import { ChatModal } from '@/components/Chat/ChatModal';
import { PublicProfile } from '@/types/api';

const BEACON_INTERVAL_MS = 5000;

export const BluetoothDiscovery: React.FC = () => {
  const { isDiscovering, isConnected, nearbyUsers, startDiscovery, stopDiscovery, updateBeacon } = useBluetooth();
  const { initiateCall } = useCallContext();
  const [radiusM, setRadiusM] = useState(50);
  const [chatTarget, setChatTarget] = useState<PublicProfile | null>(null);
  const beaconTimerRef = useRef<ReturnType<typeof setInterval>>();
  const watchIdRef = useRef<number>();

  // Periodic beacon — re-send location every 5s while discovering
  useEffect(() => {
    if (!isDiscovering) {
      clearInterval(beaconTimerRef.current);
      if (watchIdRef.current !== undefined) navigator.geolocation.clearWatch(watchIdRef.current);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => updateBeacon(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      clearInterval(beaconTimerRef.current);
      if (watchIdRef.current !== undefined) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isDiscovering, updateBeacon]);

  const handleOpenChat = async (userId: string) => {
    try {
      const profile = await userService.getPublicProfile(userId);
      setChatTarget(profile);
    } catch {
      setChatTarget({ userId, interests: [], photos: [], followers: 0, following: 0 });
    }
  };

  const handleCall = async (userId: string, type: 'audio' | 'video') => {
    try {
      const profile = await userService.getPublicProfile(userId);
      initiateCall(profile, type);
    } catch {}
  };

  return (
    <>
      <div className="bt-discovery-box">
        {/* Header */}
        <div className="bt-header">
          <div className="bt-title-row">
            <span className="bt-icon">📶</span>
            <h3 className="bt-title">Bluetooth Nearby</h3>
            <span className={`bt-status-dot ${isConnected ? 'bt-status-on' : 'bt-status-off'}`} title={isConnected ? 'Connected' : 'Disconnected'} />
          </div>
          <p className="bt-subtitle">Discover people within {radiusM}m</p>
        </div>

        {/* Radar animation + toggle */}
        <div className="bt-radar-wrap">
          <div className={`bt-radar ${isDiscovering ? 'bt-radar-active' : ''}`}>
            <div className="bt-radar-center">
              {isDiscovering ? (
                <span style={{ fontSize: 22 }}>📡</span>
              ) : (
                <span style={{ fontSize: 22, opacity: 0.4 }}>📵</span>
              )}
            </div>
            {isDiscovering && (
              <>
                <div className="bt-radar-ring bt-radar-ring-1" />
                <div className="bt-radar-ring bt-radar-ring-2" />
                <div className="bt-radar-ring bt-radar-ring-3" />
              </>
            )}
          </div>

          <div className="bt-radar-count">
            {isDiscovering
              ? nearbyUsers.length === 0
                ? 'Scanning…'
                : `${nearbyUsers.length} found`
              : 'Off'}
          </div>
        </div>

        {/* Radius selector */}
        {!isDiscovering && (
          <div className="bt-radius-row">
            <span className="bt-radius-label">Range</span>
            {[10, 25, 50, 100, 200].map(r => (
              <button
                key={r}
                className={`bt-radius-btn ${radiusM === r ? 'bt-radius-btn-active' : ''}`}
                onClick={() => setRadiusM(r)}
              >
                {r}m
              </button>
            ))}
          </div>
        )}

        {/* Toggle button */}
        <button
          className={`bt-toggle-btn ${isDiscovering ? 'bt-toggle-stop' : 'bt-toggle-start'}`}
          onClick={() => isDiscovering ? stopDiscovery() : startDiscovery(radiusM)}
          disabled={!isConnected}
        >
          {!isConnected
            ? 'Connecting…'
            : isDiscovering
              ? 'Stop Discovery'
              : 'Start Discovery'}
        </button>

        {/* Nearby user list */}
        {isDiscovering && nearbyUsers.length > 0 && (
          <div className="bt-user-list">
            {nearbyUsers.map(user => (
              <BtUserRow
                key={user.userId}
                user={user}
                onChat={() => handleOpenChat(user.userId)}
                onAudioCall={() => handleCall(user.userId, 'audio')}
                onVideoCall={() => handleCall(user.userId, 'video')}
              />
            ))}
          </div>
        )}

        {isDiscovering && nearbyUsers.length === 0 && (
          <p className="bt-empty">No one nearby yet. Keep scanning…</p>
        )}
      </div>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
    </>
  );
};

const BtUserRow: React.FC<{
  user: BtUser;
  onChat: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
}> = ({ user, onChat, onAudioCall, onVideoCall }) => (
  <div className="bt-user-row">
    <div className="bt-user-avatar">{user.avatarInitial}</div>
    <div className="bt-user-info">
      <p className="bt-user-name">{user.displayName}</p>
      <p className="bt-user-dist">📍 {user.distanceM}m away</p>
    </div>
    <div className="bt-user-actions">
      <button className="bt-action-btn" onClick={onChat} title="Chat">💬</button>
      <button className="bt-action-btn" onClick={onAudioCall} title="Audio call">📞</button>
      <button className="bt-action-btn" onClick={onVideoCall} title="Video call">📹</button>
    </div>
  </div>
);
