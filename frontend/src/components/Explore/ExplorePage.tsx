import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import { PublicProfile } from '@/types/api';
import { ChatModal } from '@/components/Chat/ChatModal';
import { useCallContext } from '@/context/CallContext';

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export const ExplorePage: React.FC = () => {
  const { nearbyUsers } = useLocation();
  const { user: currentUser } = useAuth();
  const { initiateCall } = useCallContext();

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<PublicProfile | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Single effect — discover (empty) or search (2+ chars)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // 1 char: wait for more input, don't fetch
    if (query.trim().length === 1) {
      setIsSearchMode(true);
      return;
    }

    const delay = query.trim().length >= 2 ? 300 : 0;

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        if (query.trim().length >= 2) {
          setIsSearchMode(true);
          const results = await userService.searchUsers(query.trim(), 30);
          setUsers(results);
        } else {
          setIsSearchMode(false);
          const results = await userService.discoverUsers(30);
          setUsers(results);
        }
      } catch {
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    }, delay);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleAddFriend = useCallback(async (userId: string) => {
    setAddingId(userId);
    try {
      await userService.addFriend(userId);
      setAddedIds(prev => new Set(prev).add(userId));
    } catch (err: any) {
      if (err?.response?.data?.error?.includes('Already following')) {
        setAddedIds(prev => new Set(prev).add(userId));
      }
    } finally {
      setAddingId(null);
    }
  }, []);

  const getInitial = (p: PublicProfile) =>
    (p.firstName || p.userId).charAt(0).toUpperCase();

  const getDisplayName = (p: PublicProfile) =>
    p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : p.userId.slice(0, 10) + '…';

  const nearbyMap = new Map(nearbyUsers.map(u => [u.userId, u.distance]));

  const sortedUsers = [...users]
    .filter(p => p.userId !== currentUser?.id)
    .sort((a, b) => {
      const aD = nearbyMap.get(a.userId);
      const bD = nearbyMap.get(b.userId);
      if (aD !== undefined && bD !== undefined) return aD - bD;
      if (aD !== undefined) return -1;
      if (bD !== undefined) return 1;
      return (b.followers ?? 0) - (a.followers ?? 0);
    });

  return (
    <>
      <div className="explore-page-wrap">
        {/* Header */}
        <div className="explore-header-bar">
          <h2 className="explore-title">
            {isSearchMode ? `Results for "${query}"` : 'Discover People'}
          </h2>
          <div className="explore-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ width: 15, height: 15, flexShrink: 0, color: 'var(--ig-secondary)' }}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="explore-search-input"
              type="text"
              placeholder="Search people…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ig-secondary)', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="loading" style={{ padding: '60px 0' }}>
            <div className="loading-spinner" />
          </div>
        ) : sortedUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--ig-secondary)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {isSearchMode ? '🔍' : '👥'}
            </div>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>
              {isSearchMode ? 'No users found' : 'No users yet'}
            </p>
            {isSearchMode && (
              <p style={{ fontSize: '13px', margin: 0 }}>Try a different name or ID</p>
            )}
          </div>
        ) : (
          <>
            {!isSearchMode && nearbyUsers.length > 0 && (
              <div className="explore-section-label">📍 Nearby shown first</div>
            )}
            <div className="explore-grid">
              {sortedUsers.map(p => {
                const dist = nearbyMap.get(p.userId);
                const isAdded = addedIds.has(p.userId);
                const isAdding = addingId === p.userId;

                return (
                  <div key={p.userId} className="explore-card">
                    <div className="explore-card-avatar">
                      {p.photos?.[0]
                        ? <img src={p.photos[0]} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : getInitial(p)}
                    </div>

                    <div className="explore-card-info">
                      <div className="explore-card-name">{getDisplayName(p)}</div>
                      {p.bio && <div className="explore-card-bio">{p.bio}</div>}
                      <div className="explore-card-meta">
                        {(p.followers ?? 0) > 0 && (
                          <span>{p.followers} followers</span>
                        )}
                        {dist !== undefined && (
                          <span className="explore-nearby-badge">📍 {fmtDist(dist)}</span>
                        )}
                      </div>
                    </div>

                    <div className="explore-card-actions">
                      <button
                        className="btn btn-sm btn-primary"
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        onClick={() => setChatTarget(p)}
                        title="Chat"
                      >
                        💬
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        onClick={() => initiateCall(p, 'audio')}
                        title="Audio call"
                      >
                        📞
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        onClick={() => initiateCall(p, 'video')}
                        title="Video call"
                      >
                        📹
                      </button>
                      <button
                        className={`btn btn-sm ${isAdded ? 'btn-secondary' : 'btn-outline'}`}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        onClick={() => !isAdded && handleAddFriend(p.userId)}
                        disabled={isAdded || isAdding}
                      >
                        {isAdding ? '…' : isAdded ? '✓' : '+ Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
    </>
  );
};
