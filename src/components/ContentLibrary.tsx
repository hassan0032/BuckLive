import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useContent } from '../hooks/useContent';
import { getThumbnailUrl } from '../lib/supabase';
import { Content } from '../types';
import { Search, Video, FileText, BookOpen, Clock, Download, Tag, X, Loader2 } from 'lucide-react';

export const ContentLibrary: React.FC = () => {
  const { content, loading, searching, searchContent } = useContent();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<Array<{ type: 'title' | 'tag' | 'category'; value: string; content?: Content }>>([]);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(-1);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const cats = new Set(content.map(item => item.category));
    return Array.from(cats);
  }, [content]);

  useEffect(() => {
    if (location.state?.selectedTag) {
      const tag = location.state.selectedTag;
      setSelectedTags([tag]);
      searchContent(searchQuery, selectedType, selectedCategory, [tag]);
    }
  }, [location.state]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (query: string, type: string, category: string, tags: string[]) => {
    await searchContent(query, type, category, tags);
  }, [searchContent]);

  const generateAutocomplete = useCallback((query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setAutocompleteResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results: Array<{ type: 'title' | 'tag' | 'category'; value: string; content?: Content }> = [];

    const seenTitles = new Set<string>();
    const seenTags = new Set<string>();
    const seenCategories = new Set<string>();

    content.forEach(item => {
      if (item.title.toLowerCase().includes(lowerQuery) && !seenTitles.has(item.title)) {
        results.push({ type: 'title', value: item.title, content: item });
        seenTitles.add(item.title);
      }

      if (!seenCategories.has(item.category) && item.category.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'category', value: item.category });
        seenCategories.add(item.category);
      }

      item.tags.forEach(tag => {
        if (!seenTags.has(tag) && tag.toLowerCase().includes(lowerQuery)) {
          results.push({ type: 'tag', value: tag });
          seenTags.add(tag);
        }
      });
    });

    setAutocompleteResults(results.slice(0, 8));
  }, [content]);

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (value.trim()) {
      if (value.trim().length >= 2) {
        setShowAutocomplete(true);
        generateAutocomplete(value);
      } else {
        setShowAutocomplete(false);
        setAutocompleteResults([]);
      }

      searchDebounceRef.current = setTimeout(() => {
        performSearch(value, selectedType, selectedCategory, selectedTags);
      }, 400);
    } else {
      setShowAutocomplete(false);
      setAutocompleteResults([]);
      performSearch('', selectedType, selectedCategory, selectedTags);
    }
  };

  const handleAutocompleteSelect = (result: { type: 'title' | 'tag' | 'category'; value: string; content?: Content }) => {
    if (result.type === 'title' && result.content) {
      navigate(`/content/${result.content.id}`);
    } else if (result.type === 'tag') {
      setSelectedTags([result.value]);
      setSearchQuery('');
      performSearch('', selectedType, selectedCategory, [result.value]);
    } else if (result.type === 'category') {
      setSelectedCategory(result.value);
      setSearchQuery('');
      performSearch('', selectedType, result.value, selectedTags);
    }
    setShowAutocomplete(false);
    setSelectedAutocompleteIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete || autocompleteResults.length === 0) {
      if (e.key === 'Enter') {
        performSearch(searchQuery, selectedType, selectedCategory, selectedTags);
        setShowAutocomplete(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedAutocompleteIndex(prev =>
          prev < autocompleteResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedAutocompleteIndex >= 0) {
          handleAutocompleteSelect(autocompleteResults[selectedAutocompleteIndex]);
        } else {
          performSearch(searchQuery, selectedType, selectedCategory, selectedTags);
          setShowAutocomplete(false);
        }
        break;
      case 'Escape':
        setShowAutocomplete(false);
        setSelectedAutocompleteIndex(-1);
        break;
    }
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    performSearch(searchQuery, value, selectedCategory, selectedTags);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    performSearch(searchQuery, selectedType, value, selectedTags);
  };

  const handleTagClick = async (tag: string) => {
    const newTags = selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [tag];
    setSelectedTags(newTags);
    await searchContent(searchQuery, selectedType, selectedCategory, newTags);
  };

  const clearTagFilter = async () => {
    setSelectedTags([]);
    await searchContent(searchQuery, selectedType, selectedCategory, []);
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
    </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-[#363f49] mb-2">Content Library</h1>
        <p className="text-gray-600">Discover videos, articles, and resources to help you live better longer.</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        {/* Active Tag Filter */}
        {selectedTags.length > 0 && (
          <div className="flex items-center gap-2 pb-4 border-b border-gray-200">
            <span className="text-sm text-gray-600">Filtered by tag:</span>
            {selectedTags.map((tag) => (
              <div
                key={tag}
                className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary text-white rounded-md text-sm font-medium"
              >
                <Tag className="h-3 w-3" />
                {tag}
                <button
                  onClick={clearTagFilter}
                  className="hover:bg-white hover:bg-opacity-20 rounded-full p-0.5 transition-colors"
                  aria-label="Clear tag filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative" ref={autocompleteRef}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-brand-primary animate-spin z-10" />
            )}
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => handleSearchQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => searchQuery.trim().length >= 2 && setShowAutocomplete(true)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              autoComplete="off"
            />

            {showAutocomplete && autocompleteResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {autocompleteResults.map((result, index) => (
                  <button
                    key={`${result.type}-${result.value}-${index}`}
                    onClick={() => handleAutocompleteSelect(result)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-b-0 ${
                      index === selectedAutocompleteIndex ? 'bg-brand-primary bg-opacity-10' : ''
                    }`}
                  >
                    {result.type === 'title' && (
                      <>
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#363f49] truncate">{result.value}</div>
                          <div className="text-xs text-gray-500">Content</div>
                        </div>
                      </>
                    )}
                    {result.type === 'tag' && (
                      <>
                        <Tag className="h-4 w-4 text-brand-primary flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[#363f49]">{result.value}</div>
                          <div className="text-xs text-gray-500">Tag</div>
                        </div>
                      </>
                    )}
                    {result.type === 'category' && (
                      <>
                        <BookOpen className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[#363f49]">{result.value}</div>
                          <div className="text-xs text-gray-500">Category</div>
                        </div>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            >
              <option value="">All Types</option>
              <option value="video">Videos</option>
              <option value="pdf">PDFs</option>
              <option value="blog">Blog Posts</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
        {searching && (
          <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-10 rounded-lg">
            <div className="flex items-center gap-2 text-brand-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm font-medium">Searching...</span>
            </div>
          </div>
        )}
        {content.map((item) => {
          const ContentIcon = getContentIcon(item.type);
          const thumbnailUrl = getThumbnailUrl(item);
          return (
            <div key={item.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              {/* Thumbnail */}
              <div className="relative h-48 bg-gray-200">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ContentIcon className="h-16 w-16 text-gray-400" />
                  </div>
                )}
                
                {/* Type Badge */}
                <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-medium ${getTypeColor(item.type)}`}>
                  {item.type.toUpperCase()}
                </div>
                
                {/* Tier Badge */}
                {item.required_tier === 'gold' && (
                  <div className="absolute top-3 left-20 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-medium">
                    GOLD
                  </div>
                )}

                {/* Duration/Size Badge */}
                {((item.type === 'video' && item.duration && item.duration > 0) || (item.file_size && item.file_size > 0)) && (
                  <div className="absolute top-3 right-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded-md text-xs">
                    {item.type === 'video' && item.duration && item.duration > 0 ? (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(item.duration)}</span>
                      </div>
                    ) : item.file_size && item.file_size > 0 ? (
                      <div className="flex items-center space-x-1">
                        <Download className="h-3 w-3" />
                        <span>{formatFileSize(item.file_size)}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-lg text-[#363f49] mb-2 line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                  {item.description}
                </p>

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.slice(0, 3).map((tag, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagClick(tag);
                        }}
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
                    {item.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{item.tags.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>By {item.author}</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => navigate(`/content/${item.id}`)}
                  className="w-full mt-3 bg-brand-primary text-white py-2 px-4 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
                >
                  {item.type === 'video' ? 'Watch Now' : item.type === 'pdf' ? 'Download PDF' : 'Read Article'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {content.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#363f49] mb-2">No content found</h3>
          <p className="text-gray-600">Try adjusting your search filters</p>
        </div>
      )}
    </div>

  );
};