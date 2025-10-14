import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-brand-primary hover:text-brand-d-blue transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-semibold uppercase">Back</span>
      </button>

      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-semibold text-[#363f49] mb-6">Privacy Policy</h1>

        <div className="prose max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Introduction</h2>
            <p>
              Welcome to the Buck Institute content management platform. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our platform. Please read this privacy policy
              carefully. If you do not agree with the terms of this privacy policy, please do not access the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Information We Collect</h2>
            <h3 className="text-lg font-medium text-[#363f49] mb-2">Personal Information</h3>
            <p>
              We collect information that you provide directly to us when you register for an account, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name and email address</li>
              <li>Community affiliation and access codes</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Profile information and preferences</li>
            </ul>

            <h3 className="text-lg font-medium text-[#363f49] mb-2 mt-4">Usage Information</h3>
            <p>
              We automatically collect certain information about your device and how you interact with our platform, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Content viewing history and preferences</li>
              <li>Search queries and interactions</li>
              <li>Device and browser information</li>
              <li>IP address and location data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve our platform</li>
              <li>Process your transactions and manage your subscription</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Personalize your content experience</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, prevent, and address technical issues and security concerns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Information Sharing and Disclosure</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share your information
              in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>With your consent or at your direction</li>
              <li>With service providers who perform services on our behalf</li>
              <li>To comply with legal obligations or protect rights and safety</li>
              <li>In connection with a merger, sale, or acquisition of all or part of our organization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your personal information.
              This includes encryption of data in transit and at rest, secure authentication systems, and regular security
              assessments. However, no method of transmission over the internet is 100% secure, and we cannot guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Your Rights and Choices</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access and review your personal information</li>
              <li>Request correction of inaccurate or incomplete data</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict certain processing of your data</li>
              <li>Export your data in a portable format</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at the email address provided below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our platform and store certain
              information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              However, if you do not accept cookies, you may not be able to use some portions of our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Third-Party Services</h2>
            <p>
              Our platform uses third-party services including Supabase for data storage and Stripe for payment processing.
              These services have their own privacy policies governing the use of your information. We encourage you to
              review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Children's Privacy</h2>
            <p>
              Our platform is not intended for children under the age of 13. We do not knowingly collect personal
              information from children under 13. If you believe we have collected information from a child under 13,
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new
              Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy
              Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#363f49] mb-3">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p className="mt-2">
              <strong>Buck Institute for Research on Aging</strong><br />
              Email: privacy@buckinstitute.org<br />
              Website: <a href="https://buckinstitute.org" className="text-brand-primary hover:underline" target="_blank" rel="noopener noreferrer">buckinstitute.org</a>
            </p>
          </section>

          <section className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
