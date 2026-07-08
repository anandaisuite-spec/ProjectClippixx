import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Mail, ArrowUp } from 'lucide-react';
import { useModals } from '@/providers/ModalProvider';

// A footer link is a label with EITHER a `to` route (React Router navigation)
// OR an `action` key that opens a modal/card. `action` takes precedence.
type FooterAction = 'policy:terms' | 'policy:privacy' | 'policy:refunds' | 'feedback' | 'suggest';
type FooterLink = { label: string; to?: string; action?: FooterAction };

const footerLinks: Record<string, FooterLink[]> = {
  Service: [
    { label: 'Categories', to: '/browse' },
    { label: 'How It Works', to: '/#workflow' },
    { label: 'For Business', to: '/for-business' },
    { label: 'Join as Creator', to: '/creator' },
  ],
  Company: [
    { label: 'About Us', to: '/about' },
    { label: 'Explore Creators', to: '/creators' },
    { label: 'Suggest a Star', action: 'suggest' },
  ],
  Support: [
    { label: 'Contact Us', action: 'feedback' },
    { label: 'Privacy Policy', action: 'policy:privacy' },
    { label: 'Terms of Service', action: 'policy:terms' },
    { label: 'Refund Policy', action: 'policy:refunds' },
  ],
  Resources: [
    { label: 'FAQs', to: '/help' },
    { label: 'Share Feedback', action: 'feedback' },
  ],
};

export default function Footer() {
  const { openPolicy, openFeedback, openSuggestStar } = useModals();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runAction = (action: FooterAction) => {
    switch (action) {
      case 'policy:terms': return openPolicy('terms');
      case 'policy:privacy': return openPolicy('privacy');
      case 'policy:refunds': return openPolicy('refunds');
      case 'feedback': return openFeedback();
      case 'suggest': return openSuggestStar();
    }
  };

  return (
    <footer className="relative bg-white dark:bg-dark-950 border-t border-gray-200 dark:border-white/5">
      {/* Decorative gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <Link to="/" className="flex items-center gap-2">
                {/* Icon logo — dark icon on light bg, light icon on dark bg. */}
                <img src="/logo-dark.png" alt="Clippixx" className="h-10 w-auto block dark:hidden" />
                <img src="/logo-light.png" alt="Clippixx" className="h-10 w-auto hidden dark:block" />

                {/* Text logo — dark text on light bg, light text on dark bg. */}
                <img src="/clippixx-dark.png" alt="Clippixx" className="h-10 w-auto block dark:hidden" />
                <img src="/clippixx-light.png" alt="Clippixx" className="h-10 w-auto hidden dark:block" />
              </Link>
              <p className="mt-4 text-gray-700 dark:text-dark-400 text-sm leading-relaxed max-w-sm">
                Personalized video messages from your favorite celebrities.
                The impossible gift, made possible. Create unforgettable moments with stars.
              </p>

              {/* Contact Info */}
              <div className="mt-6 space-y-3">
                <a href="mailto:hello@clippixx.com" className="flex items-center gap-3 text-sm text-gray-700 dark:text-dark-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                  <Mail className="w-4 h-4" />
                  hello@clippixx.com
                </a>
              </div>

              {/* Social Links */}
              <div className="flex gap-3 mt-6">
                {/* Facebook */}
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-300"
                  aria-label="Facebook"
                >
                  <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </motion.a>
                {/* Google */}
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-300"
                  aria-label="Google"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </motion.a>
                {/* Instagram */}
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-300"
                  aria-label="Instagram"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="url(#instagram-gradient-footer)">
                    <defs>
                      <linearGradient id="instagram-gradient-footer" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FFDC80" />
                        <stop offset="25%" stopColor="#FCAF45" />
                        <stop offset="50%" stopColor="#F77737" />
                        <stop offset="75%" stopColor="#C13584" />
                        <stop offset="100%" stopColor="#833AB4" />
                      </linearGradient>
                    </defs>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </motion.a>
                {/* LinkedIn */}
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-300"
                  aria-label="LinkedIn"
                >
                  <svg className="w-5 h-5 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </motion.a>
              </div>
            </div>

            {/* Links Sections */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5">
                  {category}
                </h3>
                <ul className="space-y-3">
                  {links.map((link) => {
                    const cls = 'text-sm text-gray-700 dark:text-dark-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1 group text-left';
                    const inner = <span className="group-hover:translate-x-1 transition-transform duration-200">{link.label}</span>;
                    return (
                      <li key={link.label}>
                        {link.action ? (
                          <button type="button" onClick={() => runAction(link.action!)} className={cls}>{inner}</button>
                        ) : link.to ? (
                          <Link to={link.to} className={cls}>{inner}</Link>
                        ) : (
                          <a href="#" className={cls}>{inner}</a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="py-8 border-t border-gray-200 dark:border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Stay in the loop
              </h4>
              <p className="text-sm text-gray-700 dark:text-dark-400">
                Get the latest celebrity updates and exclusive offers.
              </p>
            </div>
            <div className="flex w-full md:w-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 md:w-64 px-4 py-3 bg-white dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-l-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
              <button className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-r-xl transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-gray-200 dark:border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-dark-500">
              <span>© {new Date().getFullYear()} Clippixx. All rights reserved.</span>
              <button type="button" onClick={() => openPolicy('privacy')} className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy</button>
              <button type="button" onClick={() => openPolicy('terms')} className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms</button>
              <button type="button" onClick={() => openPolicy('privacy')} className="hover:text-gray-900 dark:hover:text-white transition-colors">Cookies</button>
            </div>

            <div className="flex items-center gap-4">

              {/* Back to Top Button */}
              <motion.button
                onClick={scrollToTop}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-dark-400 hover:text-white hover:bg-gradient-to-br hover:from-primary-500 hover:to-primary-600 dark:hover:from-primary-500 dark:hover:to-primary-600 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25"
                aria-label="Back to top"
              >
                <ArrowUp className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
