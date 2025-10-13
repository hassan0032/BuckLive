import React, { useState } from 'react';
import { Check, CreditCard, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentSelectionProps {
  email: string;
  firstName: string;
  lastName: string;
  onBack: () => void;
}

export const PaymentSelection: React.FC<PaymentSelectionProps> = ({
  email,
  firstName,
  lastName,
  onBack
}) => {
  const [selectedTier, setSelectedTier] = useState<'silver' | 'gold'>('silver');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Please sign up first to proceed with payment');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tier: selectedTier,
            email,
            firstName,
            lastName,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const tiers = [
    {
      name: 'Silver',
      value: 'silver' as const,
      price: 19,
      features: [
        'Access to all Silver tier content',
        'Video library access',
        'PDF resources',
        'Blog articles',
        'Monthly newsletter',
      ],
    },
    {
      name: 'Gold',
      value: 'gold' as const,
      price: 49,
      features: [
        'Everything in Silver',
        'Access to all Gold tier content',
        'Premium video content',
        'Exclusive resources',
        'Priority support',
        'Early access to new content',
      ],
      popular: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl p-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center text-brand-primary hover:text-brand-d-blue transition-colors font-bold"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Choose Your Membership
          </h2>
          <p className="text-gray-600">
            Select a plan to get started with full access to our content library
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {tiers.map((tier) => (
            <div
              key={tier.value}
              onClick={() => setSelectedTier(tier.value)}
              className={`relative cursor-pointer rounded-xl border-2 p-6 transition-all ${
                selectedTier === tier.value
                  ? 'border-brand-primary bg-brand-beige-light shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-brand-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedTier === tier.value
                      ? 'border-brand-primary bg-brand-primary'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedTier === tier.value && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">
                  ${tier.price}
                </span>
                <span className="text-gray-600">/month</span>
              </div>

              <ul className="space-y-3">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-brand-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">Order Summary</h4>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">
              {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Membership
            </span>
            <span className="font-semibold text-gray-900">
              ${tiers.find((t) => t.value === selectedTier)?.price}/month
            </span>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total per month</span>
              <span className="text-2xl font-bold text-gray-900">
                ${tiers.find((t) => t.value === selectedTier)?.price}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full bg-brand-primary text-white py-4 px-6 rounded-lg font-bold hover:bg-brand-d-blue focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center uppercase text-sm"
        >
          {loading ? (
            'Processing...'
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Continue to Payment
            </>
          )}
        </button>

        <p className="text-center text-sm text-gray-600 mt-4">
          Secure payment powered by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
};
