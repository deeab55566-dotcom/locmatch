import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SocketProvider } from '@/context/SocketContext';
import { UserProvider } from '@/context/UserContext';
import { LocationProvider } from '@/context/LocationContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ChatProvider } from '@/context/ChatContext';
import { CallProvider } from '@/context/CallContext';
import { BluetoothProvider } from '@/context/BluetoothContext';
import { CallOverlay } from '@/components/Call/CallOverlay';
import { CallRequestBanner } from '@/components/Call/CallRequestBanner';
import { useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ExplorePage } from '@/pages/ExplorePage';
import { NearbyPage } from '@/pages/NearbyPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { Header } from '@/components/Common/Header';
import './App.css';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading"><div className="loading-spinner"></div></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SocketProvider>
      <NotificationProvider>
        <ChatProvider>
          <CallProvider>
            <BluetoothProvider>
            <UserProvider>
              <LocationProvider>
                <Header />
                <div className="main-content">
                  <Outlet />
                </div>
                <CallRequestBanner />
                <CallOverlay />
              </LocationProvider>
            </UserProvider>
            </BluetoothProvider>
          </CallProvider>
        </ChatProvider>
      </NotificationProvider>
    </SocketProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/nearby" element={<NearbyPage />} />
            <Route path="/messages" element={<MessagesPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
