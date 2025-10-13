import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { ResetPassword } from './components/ResetPassword';
import { Layout } from './components/Layout';
import { ContentLibrary } from './components/ContentLibrary';
import { AdminDashboard } from './components/AdminDashboard';
import { UserProfile } from './components/UserProfile';

function App() {
  const { user, loading, isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState('library');

  // Check if we're on the reset password page
  const isResetPasswordPage = window.location.pathname === '/reset-password' || 
                              window.location.hash.includes('type=recovery');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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

  const renderPage = () => {
    switch (currentPage) {
      case 'library':
        return <ContentLibrary />;
      case 'profile':
        return <UserProfile />;
      case 'admin':
        return isAdmin ? <AdminDashboard /> : <ContentLibrary />;
      default:
        return <ContentLibrary />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default App;