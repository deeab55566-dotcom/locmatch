import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessage, PublicProfile } from '@/types/api';
import { chatService } from '@/services/chatService';
import { useSocket } from '@/context/SocketContext';
import { useChatContext } from '@/context/ChatContext';
import { useCallContext } from '@/context/CallContext';
import { storage } from '@/utils/storage';

interface ChatModalProps {
  targetUser: PublicProfile;
  onClose: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({ targetUser, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { on, off, emit, isConnected } = useSocket();
  const { markRead, setActiveChatPartner } = useChatContext();
  const { initiateCall } = useCallContext();
  const currentUserId = storage.getUser()?.id;

  const displayName = targetUser.firstName
    ? `${targetUser.firstName} ${targetUser.lastName || ''}`.trim()
    : targetUser.userId.slice(0, 8);

  const avatarInitial = (targetUser.firstName || targetUser.userId).charAt(0).toUpperCase();

  // Load history
  useEffect(() => {
    chatService.getChatHistory(targetUser.userId)
      .then(msgs => setMessages(msgs))
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, [targetUser.userId]);

  // Register socket handlers and mark conversation as active/read
  useEffect(() => {
    markRead(targetUser.userId);
    setActiveChatPartner(targetUser.userId);

    const handleIncoming = (msg: ChatMessage) => {
      if (msg.fromUserId === targetUser.userId) {
        setMessages(prev => [...prev, msg]);
      }
    };

    const handleSent = (msg: ChatMessage) => {
      if (msg.toUserId === targetUser.userId) {
        setMessages(prev => [...prev, msg]);
      }
    };

    on('chat:message', handleIncoming);
    on('chat:message:sent', handleSent);

    return () => {
      off('chat:message', handleIncoming);
      off('chat:message:sent', handleSent);
      setActiveChatPartner(null);
    };
  }, [targetUser.userId, on, off, markRead, setActiveChatPartner]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    emit('chat:send', { toUserId: targetUser.userId, message: text });
    setInput('');
  }, [input, targetUser.userId, emit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-small"
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', height: '520px', padding: 0 }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 16px', borderBottom: '1px solid var(--ig-border)',
          background: 'var(--ig-white)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--ig-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0,
          }}>
            {targetUser.photos?.[0]
              ? <img src={targetUser.photos[0]} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : avatarInitial}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{displayName}</div>
            <div style={{ fontSize: '11px', color: isConnected ? 'var(--ig-success)' : 'var(--ig-secondary)' }}>
              {isConnected ? 'Online' : 'Connecting...'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              onClick={() => initiateCall(targetUser, 'audio')}
              title="Audio call"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px', borderRadius: '6px' }}
            >
              📞
            </button>
            <button
              onClick={() => initiateCall(targetUser, 'video')}
              title="Video call"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px', borderRadius: '6px' }}
            >
              📹
            </button>
          </div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '8px',
          background: 'var(--ig-bg)',
        }}>
          {isLoadingHistory ? (
            <div className="loading"><div className="loading-spinner"></div></div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ig-secondary)', fontSize: '13px', marginTop: '40px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
              <p>No messages yet. Say hi!</p>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.fromUserId === currentUserId;
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '72%', padding: '8px 12px',
                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMe ? 'var(--ig-blue)' : 'var(--ig-white)',
                    color: isMe ? 'white' : 'var(--ig-text)',
                    fontSize: '14px', lineHeight: '1.4',
                    border: isMe ? 'none' : '1px solid var(--ig-border)',
                    wordBreak: 'break-word',
                  }}>
                    {msg.message}
                    <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px', textAlign: isMe ? 'right' : 'left' }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          display: 'flex', gap: '8px', padding: '12px 16px',
          borderTop: '1px solid var(--ig-border)', background: 'var(--ig-white)',
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            style={{
              flex: 1, padding: '8px 14px', borderRadius: '20px',
              border: '1px solid var(--ig-border)', fontSize: '14px',
              background: 'var(--ig-bg)', outline: 'none',
            }}
            autoFocus
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: input.trim() ? 'var(--ig-blue)' : 'var(--ig-secondary)',
              fontWeight: 700, fontSize: '14px', padding: '0 4px',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
