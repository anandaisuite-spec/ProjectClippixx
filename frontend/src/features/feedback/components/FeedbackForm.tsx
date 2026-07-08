import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, MessageSquare, Tag, FileText, Mail } from 'lucide-react';
import { submitFeedback } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import Button from '@/components/ui/Button';
import Stepper, { Step } from '@/components/ui/Stepper';

const feedbackTypes = ['Bug Report', 'Feature Request', 'General Feedback', 'Improvement', 'Other'];

type FeedbackFormProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function FeedbackForm({ isOpen, onClose }: FeedbackFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    type: '',
    subject: '',
    message: '',
    email: '',
  });

  useEffect(() => {
    if (isOpen && user?.email) {
      setFormData(prev => ({
        ...prev,
        email: user.email!,
      }));
    }
  }, [isOpen, user]);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate required fields per step; inline errors block advancing on Next.
  const validateStep = (step: number): boolean => {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (!formData.type) next.type = 'Please select a feedback type';
      if (!formData.subject.trim()) next.subject = 'Subject is required';
    } else if (step === 2) {
      if (!formData.message.trim()) next.message = 'Message is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Update a field and clear its error as the user fills it in.
  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const rest = { ...prev };
      delete rest[field];
      return rest;
    });
  };

  const handleSubmit = async () => {

    setError('');

    try {
      await submitFeedback(formData);
      setSuccess(true);
    } catch {
      setError('Failed to submit. Please try again.');
    }

  };

  const handleClose = () => {
    setFormData({
      type: '',
      subject: '',
      message: '',
      email: '',
    });
    setSuccess(false);
    setError('');
    setErrors({});
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gray-100/90 dark:bg-dark-950/90 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-primary-500 to-cyan-500" />

            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Share Feedback</h2>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Help us improve</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {success ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Thank You!</h3>
                  <p className="text-gray-500 dark:text-dark-400 mb-6">
                    Your feedback has been submitted. We appreciate you helping us improve!
                  </p>
                  <Button onClick={handleClose} variant="outline">
                    Close
                  </Button>
                </motion.div>
              ) : (
                <Stepper
                  initialStep={1}
                  onFinalStepCompleted={handleSubmit}
                  validateStep={validateStep}
                  backButtonText="Back"
                  nextButtonText="Next"
                >
                  {/* Step 1: Feedback Type */}
                  <Step>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Tag className="w-5 h-5 text-cyan-400" />
                        <span className="text-sm font-medium text-gray-500 dark:text-dark-400">Step 1 of 3</span>
                      </div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                        Feedback Type *
                      </label>
                      <select
                        required
                        value={formData.type}
                        onChange={(e) => updateField('type', e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer ${errors.type ? 'border-red-400 dark:border-red-500/60' : 'border-gray-200 dark:border-white/10'}`}
                      >
                        <option value="">Select feedback type</option>
                        {feedbackTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      {errors.type && <p className="mt-1 text-xs text-red-500">{errors.type}</p>}
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2 mt-4">
                        Subject *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.subject}
                        onChange={(e) => updateField('subject', e.target.value)}
                        placeholder="Brief summary of your feedback"
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors ${errors.subject ? 'border-red-400 dark:border-red-500/60' : 'border-gray-200 dark:border-white/10'}`}
                      />
                      {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject}</p>}
                    </div>
                  </Step>

                  {/* Step 2: Message */}
                  <Step>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <span className="text-sm font-medium text-gray-500 dark:text-dark-400">Step 2 of 3</span>
                      </div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                        Message *
                      </label>
                      <textarea
                        required
                        value={formData.message}
                        onChange={(e) => updateField('message', e.target.value)}
                        placeholder="Share your thoughts, ideas, or report issues..."
                        rows={6}
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none ${errors.message ? 'border-red-400 dark:border-red-500/60' : 'border-gray-200 dark:border-white/10'}`}
                      />
                      {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message}</p>}
                    </div>
                  </Step>

                  {/* Step 3: Email */}
                  <Step>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-5 h-5 text-cyan-400" />
                        <span className="text-sm font-medium text-gray-500 dark:text-dark-400">Step 3 of 3</span>
                      </div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                        Your Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Optional - for follow-up responses"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                      {error && (
                        <p className="text-sm text-red-400">{error}</p>
                      )}
                    </div>
                  </Step>
                </Stepper>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
