import { ArrowLeft, BookOpen, Calendar, Clock, Download, FileText, List, Tag, User, Video } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useContent } from '../hooks/useContent';
import { useContentTracking } from '../hooks/useContentTracking';
import { getPDFUrl, getThumbnailUrl } from '../lib/supabase';
import { Content, getContentTypeBadgeLabel } from '../types';
import ContentFeedbackForm from './ContentFeedbackForm';
import ContentQuestionForm from './ContentQuestionForm';

export const ContentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { singleContent, singleLoading, fetchContentById, fetchRelatedContent, content } = useContent();
  const [relatedContent, setRelatedContent] = useState<Content[]>([]);

  useContentTracking(id, user?.id, user?.community_id);

  useEffect(() => {
    if (id) {
      fetchContentById(id);
    }
  }, [id]);

  useEffect(() => {
    if (singleContent) {
      loadRelatedContent();
    }
  }, [singleContent]);

  const loadRelatedContent = async () => {
    if (!singleContent) return;
    const { data } = await fetchRelatedContent(
      singleContent.id,
      singleContent.category,
      singleContent.tags
    );
    if (data) {
      setRelatedContent(data);
    }
  };

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

  if (singleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!singleContent) {
    return (
      <div className="text-center py-12">
        <Video className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[#363f49] mb-2">Content not found</h3>
        <p className="text-gray-600 mb-4">The content you're looking for doesn't exist or you don't have access to it.</p>
        <button
          onClick={() => navigate('/library')}
          className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </button>
      </div>
    );
  }

  const vimeoId = singleContent.type === 'video'
    ? (singleContent.vimeo_video_id || extractVimeoId(singleContent.url))
    : null;
  const ContentIcon = getContentIcon(singleContent.type);
  const supportingContentItems =
    singleContent.supporting_content && singleContent.supporting_content.length > 0
      ? content.filter((item) => singleContent.supporting_content?.includes(item.id))
      : [];

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors uppercase font-semibold"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </button>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {singleContent.type === 'video' && vimeoId ? (
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}?badge=0&autopause=0`}
              className="absolute top-0 left-0 w-full h-full"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
              allowFullScreen
              title={singleContent.title}
            ></iframe>
          </div>
        ) : getThumbnailUrl(singleContent) ? (
          <div className="relative h-96 bg-gray-200">
            <img
              src={getThumbnailUrl(singleContent)}
              alt={singleContent.title}
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

        <div className="p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 rounded-md text-sm font-medium ${getTypeColor(singleContent.type)}`}>
              {getContentTypeBadgeLabel(singleContent.type)}
            </span>
            {singleContent.required_tier === 'gold' && (
              <span className="bg-yellow-500 text-white px-3 py-1 rounded-md text-sm font-medium">
                GOLD TIER
              </span>
            )}
          </div>

          <h1 className="text-4xl font-bold text-[#363f49] mb-4">
            {singleContent.title}
          </h1>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              <span>{singleContent.author}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              <span>{new Date(singleContent.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
            {singleContent.type === 'video' && singleContent.duration && (
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                <span>{formatDuration(singleContent.duration)}</span>
              </div>
            )}
            {singleContent.type === 'pdf' && singleContent.file_size && (
              <div className="flex items-center">
                <Download className="h-4 w-4 mr-2" />
                <span>{formatFileSize(singleContent.file_size)}</span>
              </div>
            )}
          </div>

          <div className="prose max-w-none mb-6">
            <p className="text-gray-700 text-lg leading-relaxed">
              {singleContent.description}
            </p>
          </div>

          {singleContent.type === 'blog' && singleContent.blog_content && (
            <div className="mb-8">
              <div
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: singleContent.blog_content }}
              />
            </div>
          )}

          {singleContent.type === 'blog' && singleContent.url && (
            <div className="mb-6">
              <a
                href={singleContent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Read Full Article
              </a>
            </div>
          )}

          {singleContent.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#363f49] mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {singleContent.tags.map((tag, index) => (
                  <button
                    key={index}
                    onClick={() => navigate('/library', { state: { selectedTag: tag } })}
                    className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-brand-primary hover:text-white transition-all hover:scale-105 cursor-pointer"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#363f49]">Category</p>
                <p className="text-gray-600">{singleContent.category}</p>
              </div>
              {singleContent.type === 'pdf' && getPDFUrl(singleContent) && (
                <a
                  href={getPDFUrl(singleContent)}
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

      {/* Supporting Content Section */}
      {supportingContentItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden my-8">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#363f49] flex items-center">
              <List className="h-5 w-5 mr-2 text-brand-primary" />
              Supporting Content
            </h2>
            <span className="text-sm font-medium text-gray-600 bg-gray-200 px-3 py-1 rounded-full">
              {supportingContentItems.length} {supportingContentItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
            {supportingContentItems.map((item, index) => {
              const SupportingIcon = getContentIcon(item.type);
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/content/${item.id}`)}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className="text-sm font-medium text-gray-400 w-6 text-center group-hover:text-brand-primary transition-colors">
                    {index + 1}
                  </div>
                  <div className="relative w-32 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-gray-200">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 group-hover:bg-gray-200 transition-colors">
                        <SupportingIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-semibold rounded shadow-sm">
                      {getContentTypeBadgeLabel(item.type).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-sm font-bold text-[#363f49] mb-1 line-clamp-2 group-hover:text-brand-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback Section */}
      <ContentFeedbackForm contentId={singleContent.id} />

      {/* Question Section */}
      {singleContent.enable_questions && (
        <ContentQuestionForm 
          contentId={singleContent.id} 
          contentTitle={singleContent.title}
        />
      )}

      {relatedContent.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-[#363f49]">Related Content</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedContent.map((item) => {
              const RelatedIcon = getContentIcon(item.type);
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/content/${item.id}`)}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
                >
                  <div className="relative h-40 bg-gray-200">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <RelatedIcon className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium ${getTypeColor(item.type)}`}>
                      {getContentTypeBadgeLabel(item.type)}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-[#363f49] mb-1 line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
