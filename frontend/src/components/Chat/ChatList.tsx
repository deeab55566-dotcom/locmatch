import React, { useEffect, useState } from 'react';
import { PublicProfile } from '@/types/api';
import { useChatContext } from '@/context/ChatContext';
import { userService } from '@/services/userService';
import { formatRelativeTime } from '@/utils/helpers';

interface ChatListProps {
  onSelectConversation: (profile: PublicProfile) => void;
}

export const ChatList: React.FC<ChatListProps> = ({ onSelectConversation }) => {
  const { conversations, fetchConversations } = useChatContext();
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConversations().finally(() => setIsLoading(false));
  }, [fetchConversations]);

  // Fetch profiles for any conversation partners we don't have yet
  useEffect(() => {
    const missing = conversations
      .map(c => c.partnerId)
      .filter(id => !profiles[id]);

    if (missing.length === 0) return;

    Promise.allSettled(missing.map(id => userService.getPublicProfile(id))).then(results => {
      const updates: Record<string, PublicProfile> = {};
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          updates[missing[i]] = result.value;
        }
      });
      if (Object.keys(updates).length > 0) {
        setProfiles(prev => ({ ...prev, ...updates }));
      }
    });
  }, [conversations]);

  const getDisplayName = (partnerId: string) => {
    const p = profiles[partnerId];
    if (!p) return partnerId.slice(0, 10) + '…';
    return p.firstName
      ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`
      : p.userId.slice(0, 10) + '…';
  };

  const getInitial = (partnerId: string) => {
    const p = profiles[partnerId];
    return (p?.firstName || partnerId).charAt(0).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="chat-list">
        <div className="chat-list-header"><h2>Messages</h2></div>
        <div className="loading" style={{ padding: '40px 0' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h2>Messages</h2>
      </div>

      <div className="chat-list-items">
        {conversations.length === 0 ? (
          <div className="chat-empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No conversations yet</p>
            <p style={{ fontSize: '13px', color: 'var(--ig-secondary)', margin: 0 }}>
              Find people in Explore and start chatting
            </p>
          </div>
        ) : (
          conversations.map(convo => {
            const profile = profiles[convo.partnerId];
            return (
              <div
                key={convo.partnerId}
                className="chat-list-item"
                onClick={() => profile && onSelectConversation(profile)}
                style={{ opacity: profile ? 1 : 0.6, cursor: profile ? 'pointer' : 'default' }}
              >
                <div className="conversation-avatar">
                  {profile?.photos?.[0]
                    ? <img src={profile.photos[0]} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    : getInitial(convo.partnerId)}
                </div>
                <div className="conversation-content">
                  <div className="conversation-name">{getDisplayName(convo.partnerId)}</div>
                  <div className="conversation-last-message">{convo.lastMessage || 'No messages yet'}</div>
                </div>
                <div className="conversation-meta">
                  <small className="conversation-time">
                    {formatRelativeTime(new Date(convo.lastMessageTime))}
                  </small>
                  {(convo.unreadCount ?? 0) > 0 && (
                    <span className="unread-badge">{convo.unreadCount > 9 ? '9+' : convo.unreadCount}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
