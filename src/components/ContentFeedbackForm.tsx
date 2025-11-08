import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { FC, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from '../hooks/useFeedback';

const ContentFeedbackForm: FC<{ contentId: string }> = ({ contentId }) => {
  const { user } = useAuth();
  const { submitFeedback } = useFeedback();
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [wasHelpful, setWasHelpful] = useState<boolean | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackFormData, setFeedbackFormData] = useState({
    name: '',
    email: '',
    comment: '',
  });
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFeedbackFormData({
        name: user.profile?.first_name + ' ' + user.profile?.last_name || '',
        email: user.email || '',
        comment: '',
      });
    }
  }, [user]);

  const handleHelpfulClick = (helpful: boolean) => {
    setWasHelpful(helpful);
    setShowFeedbackForm(true);
    setFeedbackError(null);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);

    if (!feedbackFormData.name.trim() || !feedbackFormData.email.trim()) {
      setFeedbackError('Name and email are required');
      return;
    }

    if (!contentId || wasHelpful === null) {
      setFeedbackError('Please select whether the content was helpful');
      return;
    }

    setSubmittingFeedback(true);

    try {
      const { error } = await submitFeedback({
        content_id: contentId,
        name: feedbackFormData.name.trim(),
        email: feedbackFormData.email.trim(),
        comment: feedbackFormData.comment.trim() || undefined,
        was_helpful: wasHelpful,
        user_id: user?.id || null,
      });

      if (error) {
        setFeedbackError(error);
      } else {
        setFeedbackSubmitted(true);
        setShowFeedbackForm(false);
        setFeedbackFormData({ name: '', email: '', comment: '' });
        setWasHelpful(null);
      }
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <>
      <div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-[#363f49] mb-4 text-center">Was this helpful?</h3>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handleHelpfulClick(true)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${wasHelpful === true
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <ThumbsUp className="h-5 w-5" />
              Yes
            </button>
            <button
              onClick={() => handleHelpfulClick(false)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${wasHelpful === false
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <ThumbsDown className="h-5 w-5" />
              No
            </button>
          </div>
        </div>
      </div>

      {feedbackSubmitted ? (
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center py-4">
            <p className="text-green-600 font-semibold mb-2">Thank you for your feedback!</p>
            <p className="text-gray-600 text-sm">Your feedback helps us improve our content.</p>
          </div>
        </div>
      ) : (
        showFeedbackForm && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <h4 className="text-xl font-semibold text-[#363f49] mb-4 text-center">
                Share your feedback
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="feedback-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="feedback-name"
                    value={feedbackFormData.name}
                    onChange={(e) => setFeedbackFormData({ ...feedbackFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="feedback-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="feedback-email"
                    value={feedbackFormData.email}
                    onChange={(e) => setFeedbackFormData({ ...feedbackFormData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="feedback-comment" className="block text-sm font-medium text-gray-700 mb-1">
                  Comment (Optional)
                </label>
                <textarea
                  id="feedback-comment"
                  value={feedbackFormData.comment}
                  onChange={(e) => setFeedbackFormData({ ...feedbackFormData, comment: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                  placeholder="Tell us more about your experience..."
                />
              </div>

              {feedbackError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {feedbackError}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedbackForm(false);
                    setWasHelpful(null);
                    setFeedbackError(null);
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )
      )}
    </>
  )
}

export default ContentFeedbackForm