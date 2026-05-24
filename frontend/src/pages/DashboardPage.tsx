import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { useLocation } from '@/hooks/useLocation';
import { NearbyUsers } from '@/components/Location/NearbyUsers';
import { LocationTracker } from '@/components/Location/LocationTracker';
import { BluetoothDiscovery } from '@/components/Bluetooth/BluetoothDiscovery';
import { ChatModal } from '@/components/Chat/ChatModal';
import { FollowListModal } from '@/components/Profile/FollowListModal';
import { userService } from '@/services/userService';
import { PublicProfile } from '@/types/api';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { profile, fetchProfile } = useUser();
  const { nearbyUsers } = useLocation();
  const navigate = useNavigate();
  const [sidebarProfiles, setSidebarProfiles] = useState<Record<string, PublicProfile>>({});
  const [addedFriends, setAddedFriends] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<PublicProfile | null>(null);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const [nearbyModal, setNearbyModal] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    nearbyUsers.slice(0, 5).forEach(u => {
      if (!sidebarProfiles[u.userId]) {
        userService.getPublicProfile(u.userId)
          .then(p => setSidebarProfiles(prev => ({ ...prev, [u.userId]: p })))
          .catch(() => {});
      }
    });
  }, [nearbyUsers]);

  const handleAddFriend = useCallback(async (userId: string) => {
    setAddingId(userId);
    try {
      await userService.addFriend(userId);
      setAddedFriends(prev => new Set(prev).add(userId));
    } catch (err: any) {
      if (err?.response?.data?.error?.includes('Already following')) {
        setAddedFriends(prev => new Set(prev).add(userId));
      }
    } finally {
      setAddingId(null);
    }
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        {/* Feed */}
        <div className="dashboard-feed">
          <div className="location-card">
            <h3>📍 Location Tracking</h3>
            <LocationTracker />
          </div>
          <div className="card">
            <NearbyUsers />
          </div>
          <BluetoothDiscovery />
        </div>

        {/* Sidebar */}
        <div className="dashboard-sidebar">
          {/* User Info */}
          <div className="sidebar-user">
            <div
              className="sidebar-avatar"
              onClick={() => navigate('/profile')}
              style={{ cursor: 'pointer' }}
            >
              <div className="sidebar-avatar-inner">
                {user?.firstName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>
            <div className="sidebar-user-info">
              <div
                className="sidebar-username"
                onClick={() => navigate('/profile')}
                style={{ cursor: 'pointer' }}
              >
                {user?.firstName?.toLowerCase()}
              </div>
              <div className="sidebar-name">
                {user?.firstName} {user?.lastName}
              </div>
            </div>
            <button className="sidebar-switch" onClick={() => navigate('/profile')}>
              Switch
            </button>
          </div>

          {/* Stats */}
          {profile && (
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--ig-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
                <div
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => setFollowModal('following')}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{profile.following}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ig-secondary)' }}>Friends</div>
                </div>
                <div
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => setFollowModal('followers')}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{profile.followers}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ig-secondary)' }}>Followers</div>
                </div>
                <div
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => setNearbyModal(true)}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{nearbyUsers.length}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ig-secondary)' }}>Nearby</div>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {nearbyUsers.length > 0 && (
            <div>
              <div className="sidebar-suggestions-header">
                <span className="sidebar-suggestions-title">Suggested For You</span>
                <button className="sidebar-see-all">See All</button>
              </div>
              {nearbyUsers.slice(0, 5).map(u => {
                const p = sidebarProfiles[u.userId];
                const displayName = p?.firstName
                  ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`
                  : u.userId.slice(0, 10) + '…';
                const initial = (p?.firstName || u.userId).charAt(0).toUpperCase();
                const isFriend = addedFriends.has(u.userId);
                const isAdding = addingId === u.userId;

                return (
                  <div key={u.userId} className="suggested-user">
                    <div className="suggested-avatar">
                      {p?.photos?.[0]
                        ? <img src={p.photos[0]} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : initial}
                    </div>
                    <div className="suggested-info">
                      <div className="suggested-username">{displayName}</div>
                      <div className="suggested-meta">
                        {u.distance != null ? `${(u.distance / 1000).toFixed(1)}km away` : 'Nearby'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => p && setChatTarget(p)}
                        disabled={!p}
                      >
                        💬 Chat
                      </button>
                      <button
                        className={`btn btn-sm ${isFriend ? 'btn-secondary' : 'btn-outline'}`}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => !isFriend && handleAddFriend(u.userId)}
                        disabled={isFriend || isAdding}
                      >
                        {isAdding ? '…' : isFriend ? '✓ Friend' : '+ Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--ig-secondary)', lineHeight: 1.8, marginTop: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {['About', 'Help', 'Press', 'API', 'Jobs', 'Privacy', 'Terms', 'Locations'].map(l => (
                <a key={l} href="#" style={{ color: 'var(--ig-secondary)', fontSize: '11px' }}>{l}</a>
              ))}
            </div>
            <div style={{ marginTop: '8px' }}>© 2026 LOCMATCH</div>
          </div>
        </div>
      </div>

      {chatTarget && (
        <ChatModal
          targetUser={chatTarget}
          onClose={() => setChatTarget(null)}
        />
      )}

      {followModal && (
        <FollowListModal
          type={followModal}
          onClose={() => setFollowModal(null)}
        />
      )}

      {nearbyModal && (
        <div className="modal-overlay" onClick={() => setNearbyModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '80vh', width: '600px' }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--ig-border)',
            }}>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>📍 Nearby Users</span>
              <button className="modal-close" onClick={() => setNearbyModal(false)}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <NearbyUsers />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
