import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePublicShare } from '../hooks/usePublicShare';
import { getThumbnailUrl, getPDFUrl } from '../lib/supabase';
import { Content } from '../types';
import { 
  ArrowLeft, Clock, Tag, User, Calendar, Video, FileText, BookOpen, Download, AlertCircle 
} from 'lucide-react';

export const PublicContentDetail: React.FC = () => {
  const { token, id } = useParams<{ token: string; id: string }>();
  const navigate = useNavigate();
  const { shareInfo, loading: shareLoading, error: shareError } = usePublicShare(token || '');
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch specific content via Edge Function
  useEffect(() => {
    if (!token || !id) return;

    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-share-link`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ token, contentId: id }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch content: ${text || res.statusText}`);
        }

        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch content');
        }

        // When contentId is provided, edge function returns single content object
        if (!data.content) {
          setError('This content is not available or you do not have access to it.');
          setContent(null);
          return;
        }

        setContent(data.content as Content);
        setError(null);
      } catch (err) {
        console.error('Content fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [token, id]);

  const extractVimeoId = (url: string): string | null => {
    const patterns = [
      /vimeo\.com\/(\d+)/,
      /player\.vimeo\.com\/video\/(\d+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video': return Video;
      case 'pdf': return FileText;
      case 'blog': return BookOpen;
      default: return FileText;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-blue-100 text-blue-700';
      case 'pdf': return 'bg-brand-beige-light text-brand-secondary';
      case 'blog': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (shareLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (shareError || !shareInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#363f49] mb-2">Invalid Share Link</h2>
          <p className="text-gray-600">
            {shareError || 'This share link is invalid or has been disabled.'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#363f49] mb-2">Content Not Available</h2>
          <p className="text-gray-600 mb-4">{error || 'This content is not available or you do not have access to it.'}</p>
          <button
            onClick={() => navigate(`/public/${token}`)}
            className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const vimeoId = content.type === 'video'
    ? (content.vimeo_video_id || (content.url ? extractVimeoId(content.url) : null))
    : null;
  const ContentIcon = getContentIcon(content.type);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/public/${token}`)}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors uppercase font-semibold"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </button>

        {/* Content Card */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {content.type === 'video' && vimeoId ? (
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={`https://player.vimeo.com/video/${vimeoId}?badge=0&autopause=0`}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                allowFullScreen
                title={content.title}
              ></iframe>
            </div>
          ) : getThumbnailUrl(content) ? (
            <div className="relative h-96 bg-gray-200">
              <img
                src={getThumbnailUrl(content)}
                alt={content.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <ContentIcon className="h-24 w-24 text-white opacity-80" />
              </div>
            </div>
          ) : (
            <div className="relative h-96 bg-gray-200 flex items-center justify-center">
              <ContentIcon className="h-24 w-24 text-gray-400" />
            </div>
          )}

          {/* Content Details */}
          <div className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1 rounded-md text-sm font-medium ${getTypeColor(content.type)}`}>
                {content.type.toUpperCase()}
              </span>
              {content.required_tier.toLowerCase() === 'gold' && (
                <span className="bg-yellow-500 text-white px-3 py-1 rounded-md text-sm font-medium">
                  GOLD TIER
                </span>
              )}
            </div>

            <h1 className="text-4xl font-bold text-[#363f49] mb-4">{content.title}</h1>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2" />
                <span>{content.author}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <span>{new Date(content.created_at).toLocaleDateString()}</span>
              </div>
              {content.type === 'video' && content.duration && (
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>{formatDuration(content.duration)}</span>
                </div>
              )}
              {content.type === 'pdf' && content.file_size && (
                <div className="flex items-center">
                  <Download className="h-4 w-4 mr-2" />
                  <span>{formatFileSize(content.file_size)}</span>
                </div>
              )}
            </div>

            <div className="prose max-w-none mb-6">
              <p className="text-gray-700 text-lg leading-relaxed">{content.description}</p>
            </div>

            {content.type === 'blog' && content.blog_content && (
              <div className="mb-8">
                <div
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: content.blog_content }}
                />
              </div>
            )}

            {content.tags && content.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[#363f49] mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {content.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-[#363f49]">Category</p>
                <p className="text-gray-600">{content.category}</p>
              </div>
              {content.type === 'pdf' && getPDFUrl(content) && (
                <a
                  href={getPDFUrl(content)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};