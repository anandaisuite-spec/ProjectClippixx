import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Sparkles, User, Link, Mail } from 'lucide-react';
import { submitSuggestion } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import Button from '@/components/ui/Button';
import Stepper, { Step } from '@/components/ui/Stepper';

const categories = ['Actor', 'Athlete', 'Creator', 'Musician', 'Comedian', 'Reality TV', 'Other'];

type SuggestStarFormProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SuggestStarForm({ isOpen, onClose }: SuggestStarFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    celebrity_name: '',
    category: '',
    category_other: '',
    social_links: '',
    reason: '',
    submitter_email: '',
  });

  useEffect(() => {
    if (isOpen && user?.email) {
      setFormData(prev => ({
        ...prev,
        submitter_email: user.email!,
      }));
    }
  }, [isOpen, user]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate the required fields on a given step. Sets inline errors and returns
  // false to block advancing. Fires only on Next/Complete (not per keystroke).
  const validateStep = (step: number): boolean => {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (!formData.celebrity_name.trim()) next.celebrity_name = 'Celebrity Name is required';
      if (!formData.category) next.category = 'Please select a category';
      if (formData.category === 'Other' && !formData.category_other.trim()) {
        next.category_other = 'Please specify the category';
      }
    } else if (step === 3) {
      if (!formData.submitter_email.trim()) next.submitter_email = 'Your Email is required';
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
      // When "Other" is chosen, the specific type the user typed is captured in
      // the free-text reason (category itself stays a backend-valid value).
      const reason = formData.category === 'Other' && formData.category_other.trim()
        ? `Category (Other): ${formData.category_other.trim()}${formData.reason ? `. ${formData.reason}` : ''}`
        : formData.reason;
      const { category_other: _omit, ...rest } = formData;
      void _omit;
      await submitSuggestion({ ...rest, reason });
      setSuccess(true);
    } catch {
      setError('Failed to submit. Please try again.');
    }
  };

  const handleClose = () => {
    setFormData({
      celebrity_name: '',
      category: '',
      category_other: '',
      social_links: '',
      reason: '',
      submitter_email: '',
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
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-cyan-500 to-primary-500" />

            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Suggest a Star</h2>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Help us grow our community</p>
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
                    Your suggestion has been submitted. We'll review it and reach out if we add them!
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
                  {/* Step 1: Celebrity Name */}
                  <Step>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <User className="w-5 h-5 text-primary-400" />
                        <span className="text-sm font-medium text-gray-500 dark:text-dark-400">Step 1 of 3</span>
                      </div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                        Celebrity Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.celebrity_name}
                        onChange={(e) => updateField('celebrity_name', e.target.value)}
                        placeholder="Who would you like to see?"
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors ${errors.celebrity_name ? 'border-red-400 dark:border-red-500/60' : 'border-gray-200 dark:border-white/10'}`}
                      />
                      {errors.celebrity_name && <p className="mt-1 text-xs text-red-500">{errors.celebrity_name}</p>}
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2 mt-4">
                        Category *
                      </label>
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => updateField('category', e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 transition-colors appearance-none cursor-pointer ${errors.category ? 'border-red-400 dark:border-red-500/60' : 'border-gray-200 dark:border-white/10'}`}
                      >
                        <option value="">Select a category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}

                      {formData.category === 'Other' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                            Who is it? *
                          </label>
                          <input
                            type="text"
                            value={formData.category_other}
                            onChange={(e) => updateField('category_other', e.target.value)}
                            placeholder="Tell us the type or who they are"
                            className={`w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors ${errors.category_other ? 'border-red-400 dark:border-red-500/60' : 'border-gray-200 dark:border-white/10'}`}
                          />
                          {errors.category_other && <p className="mt-1 text-xs text-red-500">{errors.category_other}</p>}
                        </div>
                      )}
                    </div>
                  </Step>

                  {/* Step 2: Additional Details */}
                  <Step>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Link className="w-5 h-5 text-primary-400" />
                        <span className="text-sm font-medium text-gray-500 dark:text-dark-400">Step 2 of 3</span>
                      </div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                        Social Media Links
                      </label>
                      <input
                        type="text"
                        value={formData.social_links}
                        onChange={(e) => setFormData({ ...formData, social_links: e.target.value })}
                        placeholder="Instagram, Twitter, or website URL"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                      />
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2 mt-4">
                        Why should they join?
                      </label>
                      <textarea
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="Tell us why fans would love personalized videos from them"
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
                      />
                    </div>
                  </Step>

                  {/* Step 3: Your Email */}
                  <Step>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-5 h-5 text-primary-400" />
                        <span className="text-sm font-medium text-gray-500 dark:text-dark-400">Step 3 of 3</span>
                      </div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                        Your Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.submitter_email}
                        onChange={(e) => updateField('submitter_email', e.target.value)}
                        placeholder="We'll notify you if they join"
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors ${errors.submitter_email ? 'border-red-400 dark:border-red-500/60' : 'border-gray-200 dark:border-white/10'}`}
                      />
                      {errors.submitter_email && <p className="mt-1 text-xs text-red-500">{errors.submitter_email}</p>}
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
