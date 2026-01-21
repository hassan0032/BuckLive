import { BookOpen, Clock, Download, FileText, Loader2, Search, Tag, Video, X, AlertCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePublicShare } from '../hooks/usePublicShare';
import { getThumbnailUrl } from '../lib/supabase';
import { Content, CONTENT_TYPE, ContentType, getContentTypeBadgeLabel, PAYMENT_TIER } from '../types';
import { cn } from '../utils/helper';

export const PublicShareView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { shareInfo, loading: shareLoading, error: shareError } = usePublicShare(token || '');
  
  const [filteredContent, setFilteredContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);

  // Initialize content from shareInfo
  useEffect(() => {
    if (!shareInfo) return;
    const data = shareInfo.content || [];
    setFilteredContent(data as Content[]);

    const cats = Array.from(new Set(data.map(item => item.category).filter(Boolean)));
    setAllCategories(cats);
    setLoading(false);
  }, [shareInfo]);

  // Client-side filtering
  const filterContent = useCallback(() => {
    if (!shareInfo) return;
    let data = shareInfo.content || [];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }

    if (selectedType) {
      data = data.filter(item => item.type === selectedType);
    }

    if (selectedCategory) {
      data = data.filter(item => item.category === selectedCategory);
    }

    if (selectedTags.length > 0) {
      data = data.filter(item =>
        selectedTags.every(tag => item.tags?.includes(tag))
      );
    }

    setFilteredContent(data as Content[]);
  }, [searchQuery, selectedType, selectedCategory, selectedTags, shareInfo]);

  useEffect(() => {
    filterContent();
  }, [filterContent]);

  const handleSearchQueryChange = (value: string) => setSearchQuery(value);
  const handleTypeChange = (value: string) => setSelectedType(value);
  const handleCategoryChange = (value: string) => setSelectedCategory(value);
  const handleTagClick = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [tag]);
  };
  const clearTagFilter = () => setSelectedTags([]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getContentIcon = (type: ContentType) => {
    switch (type) {
      case CONTENT_TYPE.VIDEO: return Video;
      case CONTENT_TYPE.PDF: return FileText;
      case CONTENT_TYPE.BLOG: return BookOpen;
      default: return FileText;
    }
  };

  const getTypeColor = (type: ContentType) => {
    switch (type) {
      case CONTENT_TYPE.VIDEO: return 'bg-blue-100 text-blue-700';
      case CONTENT_TYPE.PDF: return 'bg-brand-beige-light text-brand-secondary';
      case CONTENT_TYPE.BLOG: return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleContentClick = (contentId: string) => navigate(`/public/${token}/content/${contentId}`);

  if (shareLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
    </div>
  );

  if (shareError) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige">
      <div className="text-center max-w-md">
        <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[#363f49] mb-2">Invalid Share Link</h2>
        <p className="text-gray-600">{shareError || 'This share link is invalid or has been disabled.'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige-light to-brand-beige">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[#363f49] mb-2">{shareInfo?.name}'s Library</h1>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          {selectedTags.length > 0 && (
            <div className="flex items-center gap-2 pb-4 border-b border-gray-200">
              <span className="text-sm text-gray-600">Filtered by tag:</span>
              {selectedTags.map(tag => (
                <div key={tag} className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary text-white rounded-md text-sm font-medium">
                  <Tag className="h-3 w-3" /> {tag}
                  <button onClick={clearTagFilter} className="hover:bg-white hover:bg-opacity-20 rounded-full p-0.5 transition-colors" aria-label="Clear tag filter">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={selectedType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="">All Types</option>
                <option value="video">Videos</option>
                <option value="pdf">Resources</option>
                <option value="blog">Articles</option>
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="">All Categories</option>
                {allCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-brand-primary">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm font-medium">Loading content...</span>
              </div>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-12 col-span-full">
              <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#363f49] mb-2">No content found</h3>
              <p className="text-gray-600">
                {shareInfo ? `No content available for ${shareInfo.membership_tier} tier or matching your filters` : 'Try adjusting your search filters'}
              </p>
            </div>
          ) : (
            filteredContent.map((item) => {
              const ContentIcon = getContentIcon(item.type);
              const thumbnailUrl = getThumbnailUrl(item);
              return (
                <div key={item.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer" onClick={() => handleContentClick(item.id)}>
                  {/* Thumbnail */}
                  <div className="relative h-48 bg-gray-200">
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ContentIcon className="h-16 w-16 text-gray-400" />
                      </div>
                    )}

                    {/* Type Badge */}
                    <div className={cn(`absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-medium ${getTypeColor(item.type)}`)}>
                      {getContentTypeBadgeLabel(item.type)}
                    </div>

                    {/* Tier Badge */}
                    {item.required_tier === PAYMENT_TIER.GOLD && (
                      <div className="absolute top-3 left-20 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-medium">
                        {PAYMENT_TIER.GOLD.toUpperCase()}
                      </div>
                    )}

                    {/* Duration/Size Badge */}
                    {((item.type === 'video' && (item.duration ?? 0) > 0) || ((item.file_size ?? 0) > 0)) && (
                      <div className="absolute top-3 right-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded-md text-xs">
                        {item.type === 'video' && (item.duration ?? 0) > 0 ? (
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDuration(item.duration ?? 0)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <Download className="h-3 w-3" />
                            <span>{formatFileSize(item.file_size)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-lg text-[#363f49] mb-2 line-clamp-2">{item.title}</h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">{item.description}</p>

                    {/* Tags */}
                    {item.tags && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.tags.slice(0, 3).map((tag, index) => (
                          <button
                            key={index}
                            onClick={(e) => { e.stopPropagation(); handleTagClick(tag); }}
                            className={`inline-flex items-center px-2 py-1 text-xs rounded-md transition-all hover:scale-105 ${
                              selectedTags.includes(tag)
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </button>
                        ))}
                        {item.tags.length > 3 && <span className="text-xs text-gray-500">+{item.tags.length - 3} more</span>}
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                      <span>By {item.author}</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>

                    <button
                      onClick={() => handleContentClick(item.id)}
                      className="w-full bg-brand-primary text-white py-2 px-4 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
                    >
                      {item.type === 'video' ? 'Watch Now' : item.type === 'pdf' ? 'Download Resource' : 'Read Article'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
