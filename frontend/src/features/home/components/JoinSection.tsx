import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

type JoinSectionProps = {
  onSuggestStar?: () => void;
  onFeedback?: () => void;
};

export default function JoinSection({ onSuggestStar, onFeedback }: JoinSectionProps) {
  return (
    <section className="relative py-32 md:py-40 overflow-hidden">


      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-block px-5 py-1.5 text-lg font-bold tracking-wider uppercase section-pill-oval rounded-full mb-6"
          >
            Join Our Community
          </motion.span>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-8">
            Help us{' '}
            <span className="gradient-italic">grow</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-dark-300 max-w-3xl mx-auto leading-relaxed">
            Want to see your favorite celebrity on our platform or share your thoughts?<br className="hidden sm:block" />
            Let us know and help us grow our community.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-10 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative h-full"
          >
            <div className="relative p-10 md:p-12 glass-card rounded-[26px] h-full flex flex-col">
              <div className="flex-1">
                <div className="relative w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-8">
                  <div className="absolute inset-0 bg-primary-400/10 rounded-2xl blur-sm" />
                  <img src="/star-icon.png" alt="" className="relative w-10 h-10 object-contain" style={{ filter: 'brightness(0) saturate(100%) invert(47%) sepia(94%) saturate(1352%) hue-rotate(227deg) brightness(100%) contrast(91%) drop-shadow(0 4px 8px rgba(102, 126, 234, 0.5))' }} />
                </div>

                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-5">
                  Suggest a Star
                </h3>

                <p className="glass-card-muted mb-8 leading-relaxed text-lg">
                  Is there a celebrity you'd love to see on our platform? Let us know! We're always looking to bring new talent to connect with their fans through personalized videos.
                </p>

                <ul className="space-y-4 mb-10">
                  <li className="flex items-center gap-4 text-base glass-card-muted">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    Get notified when they join
                  </li>
                  <li className="flex items-center gap-4 text-base glass-card-muted">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    Help grow the community
                  </li>
                  <li className="flex items-center gap-4 text-base glass-card-muted">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    Takes less than 2 minutes
                  </li>
                </ul>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={onSuggestStar}
              >
                Suggest a Star
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative h-full"
          >
            <div className="relative p-10 md:p-12 glass-card rounded-[26px] h-full flex flex-col">
              <div className="flex-1">
                <div className="relative w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-8">
                  <div className="absolute inset-0 bg-primary-400/10 rounded-2xl blur-sm" />
                  <img src="/feedback-icon.png" alt="" className="relative w-10 h-10 object-contain drop-shadow-lg" style={{ filter: 'hue-rotate(420deg)' }} />
                </div>

                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-5">
                  Share Feedback
                </h3>

                <p className="glass-card-muted mb-8 leading-relaxed text-lg">
                  Have ideas to improve our platform? Found a bug or have a feature request? We'd love to hear from you and make our platform better together.
                </p>

                <ul className="space-y-4 mb-10">
                  <li className="flex items-center gap-4 text-base glass-card-muted">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    Shape the platform's future
                  </li>
                  <li className="flex items-center gap-4 text-base glass-card-muted">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    Quick and easy to submit
                  </li>
                  <li className="flex items-center gap-4 text-base glass-card-muted">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    Your voice matters
                  </li>
                </ul>
              </div>

              <Button
                variant="outline"
                size="lg"
                onClick={onFeedback}
              >
                Send Feedback
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
