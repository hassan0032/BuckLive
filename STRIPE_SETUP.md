# Stripe Integration Setup Guide

## Overview
This application now supports both community-based access (with access codes) and individual self-registration with Stripe payment processing.

## Prerequisites
You need a Stripe account to enable payment functionality. Follow these steps:

1. Create a Stripe account at https://dashboard.stripe.com/register
2. Get your API keys from https://dashboard.stripe.com/apikeys

## Required Stripe Secrets

The following secrets need to be configured in your Supabase project:

### 1. STRIPE_SECRET_KEY
- Your Stripe secret key (starts with `sk_`)
- Used by edge functions to create checkout sessions and process webhooks
- Found in: Stripe Dashboard > Developers > API keys

### 2. STRIPE_WEBHOOK_SECRET
- Webhook signing secret for verifying webhook events
- Used to secure webhook communication from Stripe
- Setup instructions:
  1. Go to Stripe Dashboard > Developers > Webhooks
  2. Click "Add endpoint"
  3. Enter your webhook URL: `https://[your-project-ref].supabase.co/functions/v1/stripe-webhook`
  4. Select events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
  5. Copy the webhook signing secret (starts with `whsec_`)

## Pricing Configuration

Current pricing is configured in the `create-checkout-session` edge function:

- **Silver Tier**: $19/month
- **Gold Tier**: $49/month

To modify pricing, update the `prices` object in:
`supabase/functions/create-checkout-session/index.ts`

## How It Works

### User Registration Flow
1. User clicks "Sign up"
2. User chooses registration method:
   - **Join with Access Code**: Traditional community-based registration
   - **Purchase Individual Membership**: New self-registration with payment
3. For payment registration:
   - User enters name, email, and password
   - User selects Silver or Gold tier
   - System creates Supabase auth account
   - User is redirected to Stripe Checkout
   - Upon successful payment, webhook updates user profile with subscription details

### Webhook Processing
The `stripe-webhook` edge function handles:
- `checkout.session.completed`: Creates user profile and records initial payment
- `customer.subscription.updated`: Updates subscription status and dates
- `customer.subscription.deleted`: Marks subscription as canceled
- `invoice.payment_succeeded`: Records recurring payments
- `invoice.payment_failed`: Marks subscription as past_due

### Content Access Control
The database function `get_user_community_tier()` checks:
1. Individual payment tier (if user has active subscription)
2. Community membership tier (if user joined via access code)
3. Defaults to 'silver' tier

Content RLS policies use this function to enforce tier-based access.

## Database Schema

### New Fields in `user_profiles`
- `registration_type`: 'access_code' or 'self_registered'
- `stripe_customer_id`: Stripe customer ID
- `subscription_id`: Stripe subscription ID
- `subscription_status`: 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
- `payment_tier`: 'silver' or 'gold'
- `subscription_started_at`: Subscription start date
- `subscription_ends_at`: Current billing period end date

### Payments Table
Records all payment transactions with:
- User ID
- Amount and currency
- Payment status
- Stripe payment intent ID
- Stripe invoice ID
- Transaction metadata

## Testing

### Test Mode
1. Use Stripe test API keys (start with `sk_test_`)
2. Use test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155`
3. Use any future expiration date and any 3-digit CVC

### Webhook Testing
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Forward webhooks to local dev:
   ```bash
   stripe listen --forward-to https://[your-project-ref].supabase.co/functions/v1/stripe-webhook
   ```
3. Trigger test events:
   ```bash
   stripe trigger checkout.session.completed
   ```

## Production Checklist

Before going live:
- [ ] Switch to live Stripe API keys
- [ ] Update webhook endpoint with live URL
- [ ] Test complete registration flow
- [ ] Verify subscription renewals work
- [ ] Test failed payment handling
- [ ] Confirm content access restrictions
- [ ] Review pricing configuration
- [ ] Set up monitoring for webhook failures

## Support

For Stripe-specific issues:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com

For application issues:
- Check Supabase logs for edge function errors
- Review database logs for RLS policy issues
