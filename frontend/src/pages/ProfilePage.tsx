import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { ProfileEditor } from '@/components/Profile/ProfileEditor';
import { FollowListModal } from '@/components/Profile/FollowListModal';
import { SettingsModal } from '@/components/Profile/SettingsModal';
import { Loading } from '@/components/Common/Loading';
import { userService } from '@/services/userService';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { profile, isLoading, fetchProfile } = useUser();
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await userService.uploadPhoto(file);
      await fetchProfile();
    } catch (err) {
      console.error('Photo upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return <Loading message="Loading profile..." />;
  }

  const initial = user?.firstName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="profile-page">
      {/* Profile Header */}
      <div className="profile-header-section">
        <div className="profile-pic-wrapper">
          <div
            className="profile-pic"
            onClick={handlePhotoClick}
            style={{ cursor: 'pointer', position: 'relative' }}
            title="Change profile photo"
          >
            <div className="profile-pic-inner">
              {profile?.photos && profile.photos.length > 0 ? (
                <img src={profile.photos[0]} alt="Profile" />
              ) : (
                initial
              )}
            </div>
            {/* Camera overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: uploading ? 1 : 0,
              transition: 'opacity 0.2s',
              fontSize: uploading ? '12px' : '20px',
              color: 'white', fontWeight: 600,
            }}
              onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
              onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}
            >
              {uploading ? 'Uploading…' : '📷'}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />
        </div>

        <div className="profile-info-section">
          <div className="profile-username-row">
            <h2 className="profile-username">
              {user?.firstName} {user?.lastName}
            </h2>
            <button className="btn btn-secondary btn-sm">Edit Profile</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(true)}>⚙</button>
          </div>

          <div className="profile-stats-row">
            <div className="profile-stat">
              <strong>0</strong>
              <span>posts</span>
            </div>
            <div
              className="profile-stat"
              onClick={() => setFollowModal('following')}
              style={{ cursor: 'pointer' }}
            >
              <strong>{profile?.following ?? 0}</strong>
              <span>friends</span>
            </div>
            <div
              className="profile-stat"
              onClick={() => setFollowModal('followers')}
              style={{ cursor: 'pointer' }}
            >
              <strong>{profile?.followers ?? 0}</strong>
              <span>followers</span>
            </div>
          </div>

          <div className="profile-bio">
            <strong>{user?.firstName} {user?.lastName}</strong>
            {profile?.bio && <p style={{ marginTop: '4px' }}>{profile.bio}</p>}
            {profile?.location && (
              <p className="profile-location-text">📍 {profile.location}</p>
            )}
          </div>

          {profile?.interests && profile.interests.length > 0 && (
            <div className="interests-tags" style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {profile.interests.map((interest, idx) => (
                <span key={idx} className="tag">{interest}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="profile-tabs">
        <button className="profile-tab active">⊞ POSTS</button>
        <button className="profile-tab">🎬 REELS</button>
        <button className="profile-tab">🏷️ TAGGED</button>
      </div>

      {/* Edit Profile Section */}
      <div className="profile-content">
        <div className="profile-edit" style={{ gridColumn: '1 / -1' }}>
          <ProfileEditor />
        </div>
      </div>

      {followModal && (
        <FollowListModal
          type={followModal}
          onClose={() => setFollowModal(null)}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};
