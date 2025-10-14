import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../lib/supabase';
import { LogOut, User, Settings, Library } from 'lucide-react';
import { Footer } from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = [
    { id: 'library', label: 'Library', icon: Library, path: '/library' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: Settings, path: '/admin' }] : []),
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <img src="/live-logo-solo.png" alt="Logo" className="h-8 w-auto" />
                {user?.profile?.community?.name && (
                  <h1 className="text-xl font-bold text-[#363f49]">
                    {user.profile.community.name}
                  </h1>
                )}
              </div>
              
              <nav className="hidden md:flex space-x-8">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-semibold transition-colors uppercase ${
                      isActive(item.path)
                        ? 'text-brand-primary bg-brand-beige-light'
                        : 'text-gray-700 hover:text-brand-primary hover:bg-brand-beige-light'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                Welcome, {user?.profile?.first_name || user?.email}
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-semibold text-gray-700 hover:text-red-600 hover:bg-red-50 transition-colors uppercase"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="px-4 py-2">
          <div className="flex space-x-4 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors uppercase ${
                  isActive(item.path)
                    ? 'text-brand-primary bg-brand-beige-light'
                    : 'text-gray-700 hover:text-brand-primary hover:bg-brand-beige-light'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};