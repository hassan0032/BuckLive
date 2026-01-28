import { HelpCircle, X } from 'lucide-react';
import { FC, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useContentQuestions } from '../hooks/useContentQuestions';

interface ContentQuestionFormProps {
  contentId: string;
  contentTitle: string;
}

const ContentQuestionForm: FC<ContentQuestionFormProps> = ({ contentId, contentTitle }) => {
  const { user } = useAuth();
  const { submitQuestion } = useContentQuestions();
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionSubmitted, setQuestionSubmitted] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionFormData, setQuestionFormData] = useState({
    name: '',
    email: '',
    question: '',
  });
  const [questionError, setQuestionError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setQuestionFormData({
        name: user.profile?.first_name && user.profile?.last_name
          ? `${user.profile.first_name} ${user.profile.last_name}`
          : '',
        email: user.email || '',
        question: '',
      });
    }
  }, [user]);

  const handleQuestionClick = () => {
    setShowQuestionForm(true);
    setQuestionError(null);
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuestionError(null);

    if (!questionFormData.name.trim()) {
      setQuestionError('Name is required');
      return;
    }

    if (!questionFormData.question.trim()) {
      setQuestionError('Question is required');
      return;
    }

    if (questionFormData.question.trim().length < 10) {
      setQuestionError('Question must be at least 10 characters');
      return;
    }

    if (!contentId) {
      setQuestionError('Content ID is missing');
      return;
    }

    setSubmittingQuestion(true);

    try {
      const { error } = await submitQuestion({
        content_id: contentId,
        name: questionFormData.name.trim(),
        email: questionFormData.email.trim() || null,
        question: questionFormData.question.trim(),
        content_title: contentTitle,
      });

      if (error) {
        setQuestionError(error);
      } else {
        setQuestionSubmitted(true);
        // Keep modal open to show success message
      }
    } catch (err) {
      setQuestionError(err instanceof Error ? err.message : 'Failed to submit question');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleCloseModal = () => {
    setShowQuestionForm(false);
    setQuestionError(null);
    setQuestionSubmitted(false);
    setQuestionFormData({
      name: user?.profile?.first_name && user?.profile?.last_name
        ? `${user.profile.first_name} ${user.profile.last_name}`
        : '',
      email: user?.email || '',
      question: '',
    });
  };

  const handleModalBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showQuestionForm) {
        handleCloseModal();
      }
    };

    if (showQuestionForm) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showQuestionForm]);

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
        <div className="text-center">
          <HelpCircle className="h-12 w-12 text-brand-primary mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[#363f49] mb-2">Have a question about this content?</h3>
          <p className="text-gray-600 mb-6">
            We're here to help! Ask your question and we'll get back to you.
          </p>
          <button
            onClick={handleQuestionClick}
            className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
          >
            Ask a Question
          </button>
        </div>
      </div>

      {/* Question Modal */}
      {showQuestionForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={handleModalBackdropClick}
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {questionSubmitted ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-[#363f49]">Thank You!</h2>
                    <button
                      onClick={handleCloseModal}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="text-center py-8">
                    <p className="text-green-600 font-semibold mb-2 text-lg">Your question has been submitted!</p>
                    <p className="text-gray-600 text-sm mb-6">
                      We've received your question and will get back to you soon.
                    </p>
                    <button
                      onClick={handleCloseModal}
                      className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors font-semibold uppercase text-sm"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-[#363f49]">Ask a Question</h2>
                    <button
                      onClick={handleCloseModal}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleQuestionSubmit} className="space-y-4">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">
                        Have a question about <span className="font-semibold">{contentTitle}</span>? We're here to help!
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="question-name" className="block text-sm font-medium text-gray-700 mb-1">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="question-name"
                          value={questionFormData.name}
                          onChange={(e) => setQuestionFormData({ ...questionFormData, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="question-email" className="block text-sm font-medium text-gray-700 mb-1">
                          Email <span className="text-gray-500 text-xs">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          id="question-email"
                          value={questionFormData.email}
                          onChange={(e) => setQuestionFormData({ ...questionFormData, email: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                          placeholder="Leave blank for anonymous"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="question-text" className="block text-sm font-medium text-gray-700 mb-1">
                        Your Question <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="question-text"
                        value={questionFormData.question}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, question: e.target.value })}
                        rows={5}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                        placeholder="What would you like to know about this content?"
                        required
                        minLength={10}
                      />
                      <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
                    </div>

                    {questionError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {questionError}
                      </div>
                    )}

                    <div className="flex gap-4 pt-2">
                      <button
                        type="submit"
                        disabled={submittingQuestion}
                        className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm"
                      >
                        {submittingQuestion ? 'Submitting...' : 'Submit Question'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold uppercase text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContentQuestionForm;
