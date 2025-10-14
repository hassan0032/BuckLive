import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, Mail, Shield, Calendar, CreditCard, AlertCircle } from 'lucide-react';

export const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);

  if (!user) return null;

  const isIndividualMember = user.registration_type === 'self_registered';
  const subscriptionActive = user.subscription_status === 'active';
  const getTierDisplay = () => {
    if (isIndividualMember && user.payment_tier) {
      return user.payment_tier.toUpperCase();
    }
    if (user.profile?.community) {
      return user.profile.community.membership_tier?.toUpperCase() || 'SILVER';
    }
    return 'SILVER';
  };

  const getTierColor = () => {
    const tier = isIndividualMember ? user.payment_tier : user.profile?.community?.membership_tier;
    return tier === 'gold' ? 'text-yellow-600' : 'text-gray-600';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-[#363f49] mb-2">Your Profile</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-brand-beige-light rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#363f49]">
              {user.profile?.first_name} {user.profile?.last_name}
            </h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-sm text-[#363f49]">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Shield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Role</p>
                <p className="text-sm text-[#363f49] capitalize">
                  {user.role || 'Member'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Shield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Membership Tier</p>
                <p className={`text-sm font-medium ${getTierColor()}`}>
                  {getTierDisplay()}
                </p>
              </div>
            </div>

            {isIndividualMember && (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Subscription Type</p>
                  <p className="text-sm text-[#363f49]">Individual Membership</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Member Since</p>
                <p className="text-sm text-[#363f49]">
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Account Status</p>
                <p className={`text-sm font-medium ${
                  subscriptionActive || user.profile?.community ? 'text-green-600' : 'text-red-600'
                }`}>
                  {subscriptionActive || user.profile?.community ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>

            {isIndividualMember && user.subscription_ends_at && (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Next Billing Date</p>
                  <p className="text-sm text-[#363f49]">
                    {new Date(user.subscription_ends_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
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
    </div>
  );
};