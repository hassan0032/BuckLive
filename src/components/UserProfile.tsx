import { AlertCircle, Calendar, CreditCard, Mail, PencilIcon, Shield, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBilling } from '../hooks/useBilling';
import { supabase } from '../lib/supabase';
import { User as AppUser } from '../types';

export const UserProfile: React.FC = () => {
  const { user, isAdmin, isCommunityManager } = useAuth();
  const { startDate, renewalDate } = useBilling();
  const [localUser, setLocalUser] = useState<AppUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });

  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  const displayUser = localUser || user;

  const openEdit = () => {
    setError(null);
    setSuccess(null);
    setForm({
      first_name: displayUser.profile?.first_name || '',
      last_name: displayUser.profile?.last_name || '',
      email: displayUser.email || '',
    });
    setShowEditModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        throw new Error('You must be signed in to update your profile.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-user-information`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: displayUser.id,
          firstName: form.first_name,
          lastName: form.last_name,
          email: form.email,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile');
      }

      if (form.email && form.email !== displayUser.email) {
        await supabase.auth.refreshSession();
        setSuccess('Email updated. Check your inbox to confirm your new email.');
      } else {
        setSuccess('Profile updated successfully.');
      }

      setLocalUser(prev => prev ? {
        ...prev,
        email: form.email,
        profile: {
          ...prev.profile,
          first_name: form.first_name,
          last_name: form.last_name,
        },
      } : {
        ...displayUser,
        email: form.email,
        profile: {
          ...displayUser.profile,
          first_name: form.first_name,
          last_name: form.last_name,
        },
      });

      setShowEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const isIndividualMember = displayUser.registration_type === 'self_registered';
  const subscriptionActive = displayUser.subscription_status === 'active';
  const getTierDisplay = () => {
    if (isIndividualMember && displayUser.payment_tier) {
      return displayUser.payment_tier.toUpperCase();
    }
    if (displayUser.profile?.community) {
      return displayUser.profile.community.membership_tier?.toUpperCase() || 'SILVER';
    }
    return 'SILVER';
  };

  const getTierColor = () => {
    const tier = isIndividualMember ? displayUser.payment_tier : displayUser.profile?.community?.membership_tier;
    return tier === 'gold' ? 'text-yellow-600' : 'text-gray-600';
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-[#363f49] mb-2">Your Profile</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between">
          <div className='flex justify-between items-center space-x-4 mb-6'>
            <div className="w-16 h-16 bg-brand-beige-light rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#363f49]">
                {displayUser.profile?.first_name} {displayUser.profile?.last_name}
              </h2>
              <p className="text-gray-600">{displayUser.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openEdit}
            className="w-8 h-8 bg-brand-beige-light rounded-full flex items-center justify-center hover:bg-gray-100"
            aria-label="Edit profile"
          >
            <PencilIcon className="h-4 w-4 text-brand-primary" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-sm text-[#363f49]">{displayUser.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <Shield className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Role</p>
              <p className="text-sm text-[#363f49] capitalize">
                {(displayUser.role || 'Member').replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          {isCommunityManager && (
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Shield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Membership Tier</p>
                <p className={`text-sm font-medium ${getTierColor()}`}>
                  {getTierDisplay()}
                </p>
              </div>
            </div>
          )}

          {isIndividualMember && (
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <CreditCard className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Subscription Type</p>
                <p className="text-sm text-[#363f49]">Individual Membership</p>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Member Since</p>
              <p className="text-sm text-[#363f49]">
                {new Date(displayUser.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {isIndividualMember && displayUser.subscription_ends_at && (
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Next Billing Date</p>
                <p className="text-sm text-[#363f49]">
                  {new Date(displayUser.subscription_ends_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {isCommunityManager && (
            <>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Billing Start</p>
                  <p className="text-sm text-[#363f49]">
                    {startDate ? new Date(startDate).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Next Renewal</p>
                  <p className="text-sm text-[#363f49]">
                    {renewalDate ? new Date(renewalDate).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {isIndividualMember && !subscriptionActive && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Subscription Inactive</p>
              <p className="text-sm text-yellow-700 mt-1">
                Your subscription is not active. Please update your payment method to continue accessing premium content.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-[#363f49] mb-4">Account Statistics</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-brand-primary">0</p>
              <p className="text-sm text-gray-600">Videos Watched</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">0</p>
              <p className="text-sm text-gray-600">Articles Read</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">0</p>
              <p className="text-sm text-gray-600">PDFs Downloaded</p>
            </div>
          </div>
        </div>
      </div>
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Edit Profile</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors uppercase font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};