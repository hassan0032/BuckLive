import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedback, FeedbackFilters } from '../hooks/useFeedback';
import { useContent } from '../hooks/useContent';
import { ContentFeedback } from '../types';
import { MessageSquare, ThumbsUp, ThumbsDown, Calendar, Mail, User, FileText } from 'lucide-react';

export const FeedbackManagement: React.FC = () => {
  const navigate = useNavigate();
  const { feedback, loading, error, fetchFeedback } = useFeedback();
  const { content } = useContent();
  const [contentFilter, setContentFilter] = useState<string>('');
  const [helpfulFilter, setHelpfulFilter] = useState<string>('');
  const [contentMap, setContentMap] = useState<Record<string, string>>({});

  useEffect(() => {
    // Build content map for quick lookup
    const map: Record<string, string> = {};
    content.forEach((c) => {
      map[c.id] = c.title;
    });
    setContentMap(map);
  }, [content]);

  useEffect(() => {
    const filters: FeedbackFilters = {};
    if (contentFilter) {
      filters.contentId = contentFilter;
    }
    if (helpfulFilter !== '') {
      filters.wasHelpful = helpfulFilter === 'true';
    }
    fetchFeedback(filters);
  }, [contentFilter, helpfulFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Error loading feedback: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#363f49]">Content Feedback</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">Total: {feedback.length}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Content
            </label>
            <select
              value={contentFilter}
              onChange={(e) => setContentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            >
              <option value="">All Content</option>
              {content.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Helpful Status
            </label>
            <select
              value={helpfulFilter}
              onChange={(e) => setHelpfulFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            >
              <option value="">All Feedback</option>
              <option value="true">Helpful (Yes)</option>
              <option value="false">Not Helpful (No)</option>
            </select>
          </div>
        </div>

        {/* Feedback Table */}
        {feedback.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No feedback found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Helpful
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {feedback.map((item: ContentFeedback) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/content/${item.content_id}`)}
                        className="text-brand-primary hover:text-brand-d-blue hover:underline flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="max-w-xs truncate">
                          {contentMap[item.content_id] || 'Unknown Content'}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{item.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.was_helpful ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <ThumbsUp className="h-3 w-3" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <ThumbsDown className="h-3 w-3" />
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        {item.comment ? (
                          <p className="line-clamp-2">{item.comment}</p>
                        ) : (
                          <span className="text-gray-400 italic">No comment</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(item.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

