import React, { useState, useEffect } from 'react';
import { Content, ContentType, ContentVersion, PaymentTier } from '../types';
import { X, Save, Eye, History, Loader } from 'lucide-react';
import { ImageUploader } from './ImageUploader';
import { PDFUploader } from './PDFUploader';
import { RichTextEditor } from './RichTextEditor';
import { VersionHistory } from './VersionHistory';
import { useContent } from '../hooks/useContent';

interface EnhancedContentFormProps {
  editingContent?: Content | null;
  onClose: () => void;
  onSubmit: (data: Omit<Content, 'id' | 'created_at' | 'updated_at'>, isDraft: boolean) => Promise<void>;
}

export const EnhancedContentForm: React.FC<EnhancedContentFormProps> = ({
  editingContent,
  onClose,
  onSubmit,
}) => {
  const { uploadThumbnail, uploadPDF, saveDraft } = useContent();
  const [activeTab, setActiveTab] = useState<'general' | 'media' | 'content'>('general');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'video' as 'video' | 'pdf' | 'blog',
    url: '',
    thumbnail_url: '',
    storage_thumbnail_path: '',
    storage_pdf_path: '',
    tags: '',
    category: '',
    author: '',
    required_tier: 'silver' as 'silver' | 'gold',
    duration: '',
    file_size: '',
    blog_content: '',
    blog_content_draft: '',
    vimeo_video_id: '',
    status: 'published' as 'draft' | 'published',
    enable_questions: false,
    is_manager_only: false,
  });

  useEffect(() => {
    if (editingContent) {
      setFormData({
        title: editingContent.title,
        description: editingContent.description,
        type: editingContent.type,
        url: editingContent.url,
        thumbnail_url: editingContent.thumbnail_url || '',
        storage_thumbnail_path: editingContent.storage_thumbnail_path || '',
        storage_pdf_path: editingContent.storage_pdf_path || '',
        tags: editingContent.tags.join(', '),
        category: editingContent.category,
        author: editingContent.author,
        required_tier: editingContent.required_tier,
        duration: editingContent.duration?.toString() || '',
        file_size: editingContent.file_size?.toString() || '',
        blog_content: editingContent.blog_content || '',
        blog_content_draft: editingContent.blog_content_draft || '',
        vimeo_video_id: editingContent.vimeo_video_id || '',
        status: editingContent.status || 'published',
        enable_questions: editingContent.enable_questions || false,
        is_manager_only: editingContent.is_manager_only || false,
      });
    }
  }, [editingContent]);

  const extractVimeoId = (url: string): string => {
    const patterns = [
      /vimeo\.com\/(\d+)/,
      /player\.vimeo\.com\/video\/(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return '';
  };

  const handleVimeoUrlChange = (url: string) => {
    setFormData({
      ...formData,
      url,
      vimeo_video_id: extractVimeoId(url),
    });
  };

  const handleThumbnailUpload = async (path: string, publicUrl: string) => {
    setFormData({
      ...formData,
      storage_thumbnail_path: path,
      thumbnail_url: publicUrl,
    });
  };

  const handlePDFUpload = async (path: string, publicUrl: string, fileSize: number) => {
    setFormData({
      ...formData,
      storage_pdf_path: path,
      url: publicUrl,
      file_size: fileSize.toString(),
    });
  };

  const handleAutoSave = async (html: string) => {
    if (!editingContent?.id) return;

    setAutoSaving(true);
    await saveDraft(editingContent.id, html);
    setAutoSaving(false);
  };

  const handleVersionRestore = (version: ContentVersion) => {
    setFormData({
      ...formData,
      title: version.title,
      description: version.description,
      blog_content: version.blog_content,
    });
    setShowVersionHistory(false);
  };

  const handleSubmit = async (isDraft: boolean) => {
    setSaving(true);
    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required');
      }
      if (!formData.category.trim()) {
        throw new Error('Category is required');
      }
      if (!formData.author.trim()) {
        throw new Error('Author is required');
      }

      // Validate type-specific requirements
      if (formData.type === 'video') {
        if (!formData.vimeo_video_id && !formData.url) {
          throw new Error('Vimeo video URL is required for video content');
        }
      }

      if (formData.type === 'pdf') {
        if (!formData.storage_pdf_path && !formData.url) {
          throw new Error('PDF file must be uploaded for PDF content');
        }
      }

      if (formData.type === 'blog' && !isDraft) {
        if (!formData.blog_content || formData.blog_content.trim() === '<p></p>') {
          throw new Error('Blog content is required when publishing');
        }
      }

      const contentData: Omit<Content, 'id' | 'created_at' | 'updated_at'> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        url: formData.url || '',
        thumbnail_url: formData.thumbnail_url || '',
        storage_thumbnail_path: formData.storage_thumbnail_path || '',
        storage_pdf_path: formData.storage_pdf_path || '',
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        category: formData.category.trim(),
        author: formData.author.trim(),
        required_tier: formData.required_tier,
        status: isDraft ? 'draft' : 'published',
        vimeo_video_id: formData.vimeo_video_id || '',
        enable_questions: formData.enable_questions,
        is_manager_only: formData.is_manager_only,
      };

      if (formData.type === 'video' && formData.duration) {
        contentData.duration = parseInt(formData.duration);
      }

      if (formData.type === 'pdf' && formData.file_size) {
        contentData.file_size = parseInt(formData.file_size);
      }

      if (formData.type === 'blog') {
        contentData.blog_content = formData.blog_content || '';
        contentData.blog_content_draft = formData.blog_content_draft || '';
      }

      if (!isDraft && !editingContent) {
        contentData.published_at = new Date().toISOString();
      }

      await onSubmit(contentData, isDraft);
    } catch (error) {
      console.error('Content submission error:', error);
      alert(`Failed to save content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const isValid = () => {
    if (!formData.title || !formData.description || !formData.category || !formData.author) {
      return false;
    }

    // Type-specific validation
    if (formData.type === 'video' && !formData.vimeo_video_id && !formData.url) {
      return false;
    }

    if (formData.type === 'pdf' && !formData.storage_pdf_path && !formData.url) {
      return false;
    }

    return true;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingContent ? 'Edit Content' : 'Add New Content'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {formData.status === 'draft' ? 'Draft' : 'Published'}
                {autoSaving && <span className="ml-2 text-brand-primary">Saving...</span>}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {editingContent && formData.type === 'blog' && (
                <button
                  onClick={() => setShowVersionHistory(true)}
                  className="px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center uppercase font-semibold"
                >
                  <History className="h-4 w-4 mr-2" />
                  History
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="border-b border-gray-200">
            <nav className="flex px-6">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-3 px-4 border-b-2 font-semibold text-sm transition-colors uppercase ${activeTab === 'general'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('media')}
                className={`py-3 px-4 border-b-2 font-semibold text-sm transition-colors uppercase ${activeTab === 'media'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Media
              </button>
              {formData.type === 'blog' && (
                <button
                  onClick={() => setActiveTab('content')}
                  className={`py-3 px-4 border-b-2 font-semibold text-sm transition-colors uppercase ${activeTab === 'content'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Content Editor
                </button>
              )}
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as ContentType })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    >
                      <option value="video">Video</option>
                      <option value="pdf">Resource</option>
                      <option value="blog">Article</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Author <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Required Tier
                    </label>
                    <select
                      value={formData.required_tier}
                      onChange={(e) =>
                        setFormData({ ...formData, required_tier: e.target.value as PaymentTier })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    >
                      <option value="silver">Silver</option>
                      <option value="gold">Gold</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="tag1, tag2, tag3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="flex flex-col space-y-3 mt-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enable-questions"
                      checked={formData.enable_questions}
                      onChange={(e) => setFormData({ ...formData, enable_questions: e.target.checked })}
                      className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                    />
                    <label htmlFor="enable-questions" className="text-sm font-medium text-gray-700">
                      Enable question submissions for this content
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="manager-only"
                      checked={formData.is_manager_only}
                      onChange={(e) => setFormData({ ...formData, is_manager_only: e.target.checked })}
                      className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                    />
                    <label htmlFor="manager-only" className="text-sm font-medium text-gray-700">
                      Visible only to Managers and Admins
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'media' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Thumbnail Image</h3>
                  <ImageUploader
                    onUploadComplete={handleThumbnailUpload}
                    uploadFunction={uploadThumbnail}
                    currentImageUrl={formData.thumbnail_url}
                  />
                </div>

                {formData.type === 'video' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Vimeo Video Settings
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Vimeo URL <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={formData.url}
                          onChange={(e) => handleVimeoUrlChange(e.target.value)}
                          placeholder="https://vimeo.com/123456789"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                          required
                        />
                        {formData.vimeo_video_id && (
                          <p className="text-sm text-green-600 mt-1">
                            Video ID detected: {formData.vimeo_video_id}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration (seconds)
                        </label>
                        <input
                          type="number"
                          value={formData.duration}
                          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.type === 'pdf' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">PDF Upload</h3>
                    <PDFUploader
                      onUploadComplete={handlePDFUpload}
                      uploadFunction={uploadPDF}
                      currentPdfUrl={formData.url}
                      currentFileName={formData.storage_pdf_path.split('/').pop()}
                    />
                  </div>
                )}

                {formData.type === 'blog' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      External Link (optional)
                    </label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://example.com/blog-post"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Leave empty to use the built-in editor content
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'content' && formData.type === 'blog' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Blog Content</h3>
                <RichTextEditor
                  content={formData.blog_content}
                  onChange={(html) => setFormData({ ...formData, blog_content: html })}
                  onAutoSave={editingContent ? handleAutoSave : undefined}
                  placeholder="Write your blog post content here..."
                />
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-between items-center bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors uppercase font-semibold"
            >
              Cancel
            </button>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={!isValid() || saving}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center uppercase font-semibold"
              >
                {saving ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={!isValid() || saving}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors disabled:opacity-50 flex items-center uppercase font-semibold text-sm"
              >
                {saving ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Publish
              </button>
            </div>
          </div>
        </div>
      </div>

      {showVersionHistory && editingContent && (
        <VersionHistory
          contentId={editingContent.id}
          onRestore={handleVersionRestore}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
    </>
  );
};
