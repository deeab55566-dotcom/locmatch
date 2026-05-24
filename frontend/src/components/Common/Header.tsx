import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { useTheme } from '@/context/ThemeContext';
import { SearchBar } from '@/components/Common/SearchBar';
import { useChatContext } from '@/context/ChatContext';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { totalUnread } = useChatContext();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="header">
      <div className="header-container">
        <div
          className="header-logo"
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer' }}
        >
          FriendsFinder
        </div>

        <div className="header-search">
          <SearchBar />
        </div>

        <nav className="header-nav">
          <button
            className={`nav-icon-btn ${isActive('/dashboard') ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
            title="Home"
          >
            🏠
          </button>

          <button
            className={`nav-icon-btn ${isActive('/explore') ? 'active' : ''}`}
            onClick={() => navigate('/explore')}
            title="Explore"
          >
            🔍
          </button>

          <button
            className={`nav-icon-btn ${isActive('/nearby') ? 'active' : ''}`}
            onClick={() => navigate('/nearby')}
            title="Nearby"
          >
            📍
          </button>

          <button
            className={`nav-icon-btn ${isActive('/messages') ? 'active' : ''}`}
            onClick={() => navigate('/messages')}
            title="Messages"
            style={{ position: 'relative' }}
          >
            💬
            {totalUnread > 0 && (
              <span className="nav-badge">{totalUnread > 9 ? '9+' : totalUnread}</span>
            )}
          </button>

          <button
            className="nav-icon-btn dark-toggle"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          <NotificationBell />

          <button
            className={`nav-avatar ${isActive('/profile') ? 'active' : ''}`}
            onClick={() => navigate('/profile')}
            title="Profile"
          >
            {user?.firstName?.charAt(0)?.toUpperCase() || '?'}
          </button>
        </nav>
      </div>
    </header>
  );
};
