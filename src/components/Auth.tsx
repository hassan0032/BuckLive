import React, { useState } from 'react';
import { signUp, signIn, validateAccessCode } from '../lib/supabase';
import { Eye, EyeOff, User, Mail, Lock, ArrowLeft, CreditCard, Key } from 'lucide-react';
import { ForgotPassword } from './ForgotPassword';
import { PaymentSelection } from './PaymentSelection';

type RegistrationType = 'access_code' | 'payment' | null;

export const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [registrationType, setRegistrationType] = useState<RegistrationType>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        if (registrationType === 'access_code') {
          const { data: communityId, error: codeError } = await validateAccessCode(accessCode);
          if (codeError) {
            throw new Error('Invalid access code');
          }

          const { error } = await signUp(email, password, firstName, lastName, communityId);
          if (error) throw error;
        } else if (registrationType === 'payment') {
          const { error } = await signUp(email, password, firstName, lastName, null);
          if (error) throw error;
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
  }

  if (isSignUp && registrationType === 'payment' && email && password && firstName && lastName) {
    return (
      <PaymentSelection
        email={email}
        firstName={firstName}
        lastName={lastName}
        onBack={() => setRegistrationType(null)}
      />
    );
  }

  if (isSignUp && !registrationType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
          <button
            onClick={() => setIsSignUp(false)}
            className="mb-6 flex items-center text-brand-primary hover:text-brand-d-blue transition-colors uppercase font-bold"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to sign in
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              How would you like to join?
            </h2>
            <p className="text-gray-600">
              Choose the registration method that works best for you
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setRegistrationType('access_code')}
              className="group relative p-8 border-2 border-gray-200 rounded-xl hover:border-brand-primary hover:shadow-lg transition-all text-left uppercase font-bold"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-brand-beige-light rounded-lg mb-4 group-hover:bg-brand-primary transition-colors">
                <Key className="h-6 w-6 text-brand-primary group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Join with Access Code
              </h3>
              <p className="text-gray-600">
                Have an access code from your organization? Join an existing community with instant access.
              </p>
            </button>

            <button
              onClick={() => setRegistrationType('payment')}
              className="group relative p-8 border-2 border-gray-200 rounded-xl hover:border-brand-primary hover:shadow-lg transition-all text-left uppercase font-bold"
            >
              <div className="absolute -top-3 right-6">
                <span className="bg-brand-primary text-white px-3 py-1 rounded-full text-xs font-medium">
                  Popular
                </span>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-brand-beige-light rounded-lg mb-4 group-hover:bg-brand-primary transition-colors">
                <CreditCard className="h-6 w-6 text-brand-primary group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Purchase Individual Membership
              </h3>
              <p className="text-gray-600">
                Get immediate access with a monthly subscription. Choose between Silver or Gold tiers.
              </p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="text-gray-700 font-medium">Starting at $19/month</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {isSignUp && registrationType && (
          <button
            onClick={() => setRegistrationType(null)}
            className="mb-4 flex items-center text-brand-primary hover:text-brand-d-blue transition-colors uppercase font-bold"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
        )}

        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/live-logo-solo.png" alt="Logo" className="h-16 w-auto" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-gray-600">
            {isSignUp
              ? registrationType === 'access_code'
                ? 'Enter your details and access code'
                : 'Create your account to continue'
              : 'Sign in to access your library'
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                  required
                />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                  required
                />
              </div>
            </div>
          )}

          {isSignUp && registrationType === 'access_code' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="6-Character Access Code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors uppercase tracking-wider"
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary text-white py-3 px-4 rounded-lg font-bold hover:bg-brand-d-blue focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm"
          >
            {loading
              ? 'Please wait...'
              : isSignUp && registrationType === 'payment'
                ? 'Continue to Payment'
                : isSignUp
                  ? 'Create Account'
                  : 'Sign In'
            }
          </button>
        </form>

        <div className="mt-6 text-center">
          {!isSignUp && (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-brand-primary hover:text-brand-d-blue font-bold text-sm mb-4 block mx-auto uppercase"
            >
              Forgot your password?
            </button>
          )}

          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setRegistrationType(null);
              setError('');
            }}
            className="text-brand-primary hover:text-brand-d-blue font-bold uppercase"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"
            }
          </button>
        </div>
      </div>
    </div>
  );
};
