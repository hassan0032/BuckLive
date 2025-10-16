import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { ResetPassword } from './components/ResetPassword';
import { Layout } from './components/Layout';
import { ContentLibrary } from './components/ContentLibrary';
import { AdminDashboard } from './components/AdminDashboard';
import { CommunityManagerDashboard } from './components/CommunityManagerDashboard';
import { UserProfile } from './components/UserProfile';
import { ContentDetail } from './components/ContentDetail';
import { PrivacyPolicy } from './components/PrivacyPolicy';

function App() {
  const { user, loading, isAdmin, isCommunityManager } = useAuth();

  // Check if we're on the reset password page
  const isResetPasswordPage = window.location.pathname === '/reset-password' ||
                              window.location.hash.includes('type=recovery');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  // Show reset password page if we're on that route
  if (isResetPasswordPage) {
    return <ResetPassword />;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<ContentLibrary />} />
          <Route path="/content/:id" element={<ContentDetail />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/library" replace />} />
          <Route path="/community-manager" element={isCommunityManager ? <CommunityManagerDashboard /> : <Navigate to="/library" replace />} />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;