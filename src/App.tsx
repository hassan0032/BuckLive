import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminDashboard } from './components/AdminDashboard';
import { Auth } from './components/Auth';
import { CommunityManagerDashboard } from './components/CommunityManagerDashboard';
import CommunityManagerNotifications from './components/CommunityManagerNotifications';
import { ContentDetail } from './components/ContentDetail';
import { ContentLibrary } from './components/ContentLibrary';
import { Layout } from './components/Layout';
import { PaymentSelection } from './components/PaymentSelection';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { PublicContentDetail } from './components/PublicContentDetail';
import { PublicShareView } from './components/PublicShareView';
import { ResetPassword } from './components/ResetPassword';
import { UserProfile } from './components/UserProfile';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user, loading, isAdmin, isCommunityManager, isSharedAccount } = useAuth();

  // Check if we're on the reset password page
  const isResetPasswordPage = window.location.pathname === '/reset-password' || window.location.hash.includes('type=recovery');

  // Check if we're on a public share route
  const isPublicShareRoute = window.location.pathname.startsWith('/public/');

  if (loading && !isPublicShareRoute) {
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

  // Allow public share routes without authentication
  if (isPublicShareRoute) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/public/:token" element={<PublicShareView />} />
          <Route path="/public/:token/content/:id" element={<PublicContentDetail />} />
        </Routes>
      </BrowserRouter>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // Show payment selection for users who need to complete payment
  if (user.needsPayment) {
    return (
      <PaymentSelection
        email={user.email}
        firstName={user.profile?.first_name || ''}
        lastName={user.profile?.last_name || ''}
        onBack={() => {
          // Sign out the user so they can start fresh
          import('./lib/supabase').then(({ supabase }) => {
            supabase.auth.signOut();
          });
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public share routes (no authentication required) */}
        <Route path="/public/:token" element={<PublicShareView />} />
        <Route path="/public/:token/content/:id" element={<PublicContentDetail />} />

        {/* Authenticated routes */}
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/library" replace />} />
                <Route path="/library" element={<ContentLibrary />} />
                <Route path="/content/:id" element={<ContentDetail />} />
                <Route path="/profile" element={isSharedAccount ? <Navigate to="/library" replace /> : <UserProfile />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/library" replace />} />
                <Route path="/community-manager" element={isCommunityManager ? <CommunityManagerDashboard /> : <Navigate to="/library" replace />} />
                <Route
                  path="/notifications"
                  element={
                    isCommunityManager ? <CommunityManagerNotifications /> : <Navigate to="/library" replace />
                  }
                />
                <Route path="*" element={<Navigate to="/library" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;