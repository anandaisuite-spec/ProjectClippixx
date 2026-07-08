import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
}: ButtonProps) {
  // min-h-[44px] + flex centering: guarantees the 44px minimum touch target on
  // every Button size without changing widths or text sizing.
  const baseStyles = 'relative inline-flex items-center justify-center min-h-[44px] font-medium tracking-wide uppercase transition-all duration-300 rounded-full';

  const variants = {
    primary:
      'bg-white text-gray-900 border border-gray-900/30 shadow-sm hover:bg-gray-900 hover:text-white hover:border-gray-900 dark:bg-gray-900 dark:text-white dark:border-white/40 dark:hover:bg-white dark:hover:text-gray-900 dark:hover:border-white',
    secondary:
      'bg-primary-600 text-white border border-primary-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 dark:hover:bg-white dark:hover:text-gray-900 dark:hover:border-white',
    outline:
      'bg-white text-gray-900 border border-gray-900/30 shadow-sm hover:bg-gray-900 hover:text-white hover:border-gray-900 dark:bg-gray-900 dark:text-white dark:border-white/40 dark:hover:bg-white dark:hover:text-gray-900 dark:hover:border-white',
  };

  const sizes = {
    sm: 'px-5 py-2.5 text-xs',
    md: 'px-8 py-3.5 text-sm',
    lg: 'px-10 py-4 text-base',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </motion.button>
  );
}
