import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OTPInputProps {
  digits: string[];
  onChange: (digits: string[]) => void;
  onComplete: (code: string) => void;
  status: 'idle' | 'verifying' | 'success' | 'error';
  disabled?: boolean;
}

const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R; // circumference

export default function OTPInput({ digits, onChange, onComplete, status, disabled }: OTPInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const length = digits.length;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleChange = (i: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    onChange(next);
    if (digit && i < length - 1) {
      refs.current[i + 1]?.focus();
      setActiveIndex(i + 1);
    }
    if (digit && next.every((d) => d !== '')) onComplete(next.join(''));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setActiveIndex(i - 1);
    }
  };

  const isLocked = disabled || status === 'verifying' || status === 'success';

  return (
    <div className="flex flex-col items-center gap-5">
      {/* ── Boxes ── */}
      <motion.div
        animate={status === 'error' ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
        className="flex justify-center gap-3"
      >
        {digits.map((d, i) => {
          const isFilled   = d !== '';
          const isActive   = activeIndex === i && !isLocked;
          const isError    = status === 'error';
          const isSuccess  = status === 'success';

          return (
            <motion.div
              key={i}
              // Staggered entrance — plays once when the component mounts
              initial={{ opacity: 0, y: 14, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: i * 0.055,
                duration: 0.32,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative"
            >
              {/* Traveling glow ring under the active box */}
              <AnimatePresence>
                {isActive && !isFilled && (
                  <motion.span
                    key="glow"
                    layoutId="otp-glow"
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      boxShadow: '0 0 0 3px rgba(139,92,246,0.35), 0 0 12px 2px rgba(139,92,246,0.2)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  />
                )}
              </AnimatePresence>

              <motion.input
                ref={(el) => { refs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={d}
                disabled={isLocked}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => { e.target.select(); setActiveIndex(i); }}
                onBlur={() => setActiveIndex(null)}
                // Pop on fill
                animate={isFilled && !isError ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ duration: 0.18 }}
                className={[
                  'w-12 h-14 text-center text-2xl font-bold rounded-2xl relative z-10',
                  'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white',
                  'border-2 transition-colors outline-none disabled:opacity-50 cursor-text',
                  isError
                    ? 'border-red-500 dark:border-red-400'
                    : isSuccess
                    ? 'border-emerald-500 dark:border-emerald-400'
                    : isFilled
                    ? 'border-violet-500 dark:border-violet-400'
                    : isActive
                    ? 'border-violet-500 dark:border-violet-400'
                    : 'border-gray-200 dark:border-white/20',
                ].join(' ')}
              />
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Status feedback ── */}
      <AnimatePresence mode="wait">
        {status === 'verifying' && (
          <motion.div
            key="ring"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="flex items-center gap-2 text-violet-400"
          >
            {/* Spinning arc ring */}
            <svg width="22" height="22" viewBox="0 0 44 44">
              {/* Track */}
              <circle
                cx="22" cy="22" r={RING_R}
                fill="none"
                stroke="rgba(139,92,246,0.15)"
                strokeWidth="3.5"
              />
              {/* Spinning arc */}
              <motion.circle
                cx="22" cy="22" r={RING_R}
                fill="none"
                stroke="rgb(139,92,246)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * 0.72}
                style={{ transformOrigin: '50% 50%' }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              />
            </svg>
            <span className="text-sm font-medium">Verifying…</span>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5"
          >
            {/* Checkmark circle */}
            <motion.div
              className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <motion.path
                  d="M5 13l4 4L19 7"
                  stroke="rgb(16,185,129)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.38, delay: 0.06 }}
                />
              </svg>
            </motion.div>
            <span className="text-sm font-medium text-emerald-500">Verified</span>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.p
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-500 dark:text-red-400 text-center"
          >
            Incorrect code, try again
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
