import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const handleBuckInstituteClick = () => {
    window.open('https://buckinstitute.org', '_blank', 'noopener,noreferrer');
  };

  const handlePrivacyClick = () => {
    navigate('/privacy-policy');
  };

  return (
    <footer className="bg-[#363f49] text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div>
              <img src="/live-logo-solo.png" alt="Logo" className="h-10 w-auto" /><br />
              <span className="text-sm">
                © {currentYear} Buck Institute. All rights reserved.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={handlePrivacyClick}
              className="text-sm hover:text-brand-beige-light transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={handleBuckInstituteClick}
              className="flex items-center space-x-1 text-sm hover:text-brand-beige-light transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Buck Institute</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
