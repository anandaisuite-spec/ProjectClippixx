import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { sendPasswordResetEmail, signInWithCustomToken, auth, signOut } from '@/services/firebase';
import { CREATOR_EMAIL_DOMAIN } from '@/constants/auth';
import { sendOtp, verifyOtp } from '@/services/api';
import OTPInput from '@/components/ui/OTPInput';

// ─── Types ───────────────────────────────────────────────────────────────────

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function friendlyAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  console.error('Auth error:', code, err instanceof Error ? err.message : err);
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. If you signed up with Google, Facebook, or Microsoft, use that button instead.';
    case 'auth/invalid-email':       return 'Please enter a valid email address.';
    case 'auth/user-disabled':       return 'This account has been disabled. Contact support.';
    case 'auth/too-many-requests':   return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/email-already-in-use':return 'An account already exists with this email.';
    case 'auth/weak-password':       return 'Password is too weak. Use at least 8 characters.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return 'Sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked':       return 'The sign-in popup was blocked. Allow popups and try again.';
    case 'auth/unauthorized-domain': return 'Sign-in is not allowed from this domain.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is already linked to a different sign-in method.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    default:
      if (err instanceof Error && !code) return err.message;
      return 'Authentication failed. Please try again.';
  }
}

// India first (default), then alphabetical by country name.
const COUNTRIES = [
  { code: '+91', flag: '🇮🇳', label: 'IN', name: 'India' },
  { code: '+93', flag: '🇦🇫', label: 'AF', name: 'Afghanistan' },
  { code: '+355', flag: '🇦🇱', label: 'AL', name: 'Albania' },
  { code: '+213', flag: '🇩🇿', label: 'DZ', name: 'Algeria' },
  { code: '+54', flag: '🇦🇷', label: 'AR', name: 'Argentina' },
  { code: '+374', flag: '🇦🇲', label: 'AM', name: 'Armenia' },
  { code: '+61', flag: '🇦🇺', label: 'AU', name: 'Australia' },
  { code: '+43', flag: '🇦🇹', label: 'AT', name: 'Austria' },
  { code: '+994', flag: '🇦🇿', label: 'AZ', name: 'Azerbaijan' },
  { code: '+973', flag: '🇧🇭', label: 'BH', name: 'Bahrain' },
  { code: '+880', flag: '🇧🇩', label: 'BD', name: 'Bangladesh' },
  { code: '+375', flag: '🇧🇾', label: 'BY', name: 'Belarus' },
  { code: '+32', flag: '🇧🇪', label: 'BE', name: 'Belgium' },
  { code: '+591', flag: '🇧🇴', label: 'BO', name: 'Bolivia' },
  { code: '+387', flag: '🇧🇦', label: 'BA', name: 'Bosnia and Herzegovina' },
  { code: '+267', flag: '🇧🇼', label: 'BW', name: 'Botswana' },
  { code: '+55', flag: '🇧🇷', label: 'BR', name: 'Brazil' },
  { code: '+359', flag: '🇧🇬', label: 'BG', name: 'Bulgaria' },
  { code: '+855', flag: '🇰🇭', label: 'KH', name: 'Cambodia' },
  { code: '+237', flag: '🇨🇲', label: 'CM', name: 'Cameroon' },
  { code: '+1', flag: '🇨🇦', label: 'CA', name: 'Canada' },
  { code: '+56', flag: '🇨🇱', label: 'CL', name: 'Chile' },
  { code: '+86', flag: '🇨🇳', label: 'CN', name: 'China' },
  { code: '+57', flag: '🇨🇴', label: 'CO', name: 'Colombia' },
  { code: '+506', flag: '🇨🇷', label: 'CR', name: 'Costa Rica' },
  { code: '+385', flag: '🇭🇷', label: 'HR', name: 'Croatia' },
  { code: '+53', flag: '🇨🇺', label: 'CU', name: 'Cuba' },
  { code: '+357', flag: '🇨🇾', label: 'CY', name: 'Cyprus' },
  { code: '+420', flag: '🇨🇿', label: 'CZ', name: 'Czechia' },
  { code: '+45', flag: '🇩🇰', label: 'DK', name: 'Denmark' },
  { code: '+593', flag: '🇪🇨', label: 'EC', name: 'Ecuador' },
  { code: '+20', flag: '🇪🇬', label: 'EG', name: 'Egypt' },
  { code: '+372', flag: '🇪🇪', label: 'EE', name: 'Estonia' },
  { code: '+251', flag: '🇪🇹', label: 'ET', name: 'Ethiopia' },
  { code: '+358', flag: '🇫🇮', label: 'FI', name: 'Finland' },
  { code: '+33', flag: '🇫🇷', label: 'FR', name: 'France' },
  { code: '+995', flag: '🇬🇪', label: 'GE', name: 'Georgia' },
  { code: '+49', flag: '🇩🇪', label: 'DE', name: 'Germany' },
  { code: '+233', flag: '🇬🇭', label: 'GH', name: 'Ghana' },
  { code: '+30', flag: '🇬🇷', label: 'GR', name: 'Greece' },
  { code: '+502', flag: '🇬🇹', label: 'GT', name: 'Guatemala' },
  { code: '+852', flag: '🇭🇰', label: 'HK', name: 'Hong Kong' },
  { code: '+36', flag: '🇭🇺', label: 'HU', name: 'Hungary' },
  { code: '+354', flag: '🇮🇸', label: 'IS', name: 'Iceland' },
  { code: '+62', flag: '🇮🇩', label: 'ID', name: 'Indonesia' },
  { code: '+98', flag: '🇮🇷', label: 'IR', name: 'Iran' },
  { code: '+964', flag: '🇮🇶', label: 'IQ', name: 'Iraq' },
  { code: '+353', flag: '🇮🇪', label: 'IE', name: 'Ireland' },
  { code: '+972', flag: '🇮🇱', label: 'IL', name: 'Israel' },
  { code: '+39', flag: '🇮🇹', label: 'IT', name: 'Italy' },
  { code: '+225', flag: '🇨🇮', label: 'CI', name: 'Ivory Coast' },
  { code: '+81', flag: '🇯🇵', label: 'JP', name: 'Japan' },
  { code: '+962', flag: '🇯🇴', label: 'JO', name: 'Jordan' },
  { code: '+7', flag: '🇰🇿', label: 'KZ', name: 'Kazakhstan' },
  { code: '+254', flag: '🇰🇪', label: 'KE', name: 'Kenya' },
  { code: '+965', flag: '🇰🇼', label: 'KW', name: 'Kuwait' },
  { code: '+996', flag: '🇰🇬', label: 'KG', name: 'Kyrgyzstan' },
  { code: '+856', flag: '🇱🇦', label: 'LA', name: 'Laos' },
  { code: '+371', flag: '🇱🇻', label: 'LV', name: 'Latvia' },
  { code: '+961', flag: '🇱🇧', label: 'LB', name: 'Lebanon' },
  { code: '+218', flag: '🇱🇾', label: 'LY', name: 'Libya' },
  { code: '+370', flag: '🇱🇹', label: 'LT', name: 'Lithuania' },
  { code: '+352', flag: '🇱🇺', label: 'LU', name: 'Luxembourg' },
  { code: '+60', flag: '🇲🇾', label: 'MY', name: 'Malaysia' },
  { code: '+960', flag: '🇲🇻', label: 'MV', name: 'Maldives' },
  { code: '+356', flag: '🇲🇹', label: 'MT', name: 'Malta' },
  { code: '+52', flag: '🇲🇽', label: 'MX', name: 'Mexico' },
  { code: '+373', flag: '🇲🇩', label: 'MD', name: 'Moldova' },
  { code: '+377', flag: '🇲🇨', label: 'MC', name: 'Monaco' },
  { code: '+976', flag: '🇲🇳', label: 'MN', name: 'Mongolia' },
  { code: '+382', flag: '🇲🇪', label: 'ME', name: 'Montenegro' },
  { code: '+212', flag: '🇲🇦', label: 'MA', name: 'Morocco' },
  { code: '+95', flag: '🇲🇲', label: 'MM', name: 'Myanmar' },
  { code: '+977', flag: '🇳🇵', label: 'NP', name: 'Nepal' },
  { code: '+31', flag: '🇳🇱', label: 'NL', name: 'Netherlands' },
  { code: '+64', flag: '🇳🇿', label: 'NZ', name: 'New Zealand' },
  { code: '+234', flag: '🇳🇬', label: 'NG', name: 'Nigeria' },
  { code: '+47', flag: '🇳🇴', label: 'NO', name: 'Norway' },
  { code: '+968', flag: '🇴🇲', label: 'OM', name: 'Oman' },
  { code: '+92', flag: '🇵🇰', label: 'PK', name: 'Pakistan' },
  { code: '+970', flag: '🇵🇸', label: 'PS', name: 'Palestine' },
  { code: '+507', flag: '🇵🇦', label: 'PA', name: 'Panama' },
  { code: '+595', flag: '🇵🇾', label: 'PY', name: 'Paraguay' },
  { code: '+51', flag: '🇵🇪', label: 'PE', name: 'Peru' },
  { code: '+63', flag: '🇵🇭', label: 'PH', name: 'Philippines' },
  { code: '+48', flag: '🇵🇱', label: 'PL', name: 'Poland' },
  { code: '+351', flag: '🇵🇹', label: 'PT', name: 'Portugal' },
  { code: '+974', flag: '🇶🇦', label: 'QA', name: 'Qatar' },
  { code: '+40', flag: '🇷🇴', label: 'RO', name: 'Romania' },
  { code: '+7', flag: '🇷🇺', label: 'RU', name: 'Russia' },
  { code: '+966', flag: '🇸🇦', label: 'SA', name: 'Saudi Arabia' },
  { code: '+221', flag: '🇸🇳', label: 'SN', name: 'Senegal' },
  { code: '+381', flag: '🇷🇸', label: 'RS', name: 'Serbia' },
  { code: '+65', flag: '🇸🇬', label: 'SG', name: 'Singapore' },
  { code: '+421', flag: '🇸🇰', label: 'SK', name: 'Slovakia' },
  { code: '+386', flag: '🇸🇮', label: 'SI', name: 'Slovenia' },
  { code: '+27', flag: '🇿🇦', label: 'ZA', name: 'South Africa' },
  { code: '+82', flag: '🇰🇷', label: 'KR', name: 'South Korea' },
  { code: '+34', flag: '🇪🇸', label: 'ES', name: 'Spain' },
  { code: '+94', flag: '🇱🇰', label: 'LK', name: 'Sri Lanka' },
  { code: '+46', flag: '🇸🇪', label: 'SE', name: 'Sweden' },
  { code: '+41', flag: '🇨🇭', label: 'CH', name: 'Switzerland' },
  { code: '+963', flag: '🇸🇾', label: 'SY', name: 'Syria' },
  { code: '+886', flag: '🇹🇼', label: 'TW', name: 'Taiwan' },
  { code: '+255', flag: '🇹🇿', label: 'TZ', name: 'Tanzania' },
  { code: '+66', flag: '🇹🇭', label: 'TH', name: 'Thailand' },
  { code: '+216', flag: '🇹🇳', label: 'TN', name: 'Tunisia' },
  { code: '+90', flag: '🇹🇷', label: 'TR', name: 'Turkey' },
  { code: '+256', flag: '🇺🇬', label: 'UG', name: 'Uganda' },
  { code: '+380', flag: '🇺🇦', label: 'UA', name: 'Ukraine' },
  { code: '+971', flag: '🇦🇪', label: 'AE', name: 'United Arab Emirates' },
  { code: '+44', flag: '🇬🇧', label: 'GB', name: 'United Kingdom' },
  { code: '+1', flag: '🇺🇸', label: 'US', name: 'United States' },
  { code: '+598', flag: '🇺🇾', label: 'UY', name: 'Uruguay' },
  { code: '+998', flag: '🇺🇿', label: 'UZ', name: 'Uzbekistan' },
  { code: '+58', flag: '🇻🇪', label: 'VE', name: 'Venezuela' },
  { code: '+84', flag: '🇻🇳', label: 'VN', name: 'Vietnam' },
  { code: '+967', flag: '🇾🇪', label: 'YE', name: 'Yemen' },
  { code: '+260', flag: '🇿🇲', label: 'ZM', name: 'Zambia' },
  { code: '+263', flag: '🇿🇼', label: 'ZW', name: 'Zimbabwe' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Country-code dropdown (native <select>).
 *
 * Native <option> popups are OS-drawn, so theme colors must be applied with
 * inline styles (not just Tailwind classes) for both the box and the options.
 * We read the current theme from the `.dark` class on <html> and style
 * accordingly; focus swaps the border to the purple accent with no outline.
 */
function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  // Keep in sync if the theme is toggled while the modal is open.
  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(root.classList.contains('dark')));
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const bg = isDark ? '#1e1b2e' : '#ffffff';
  const color = isDark ? '#ffffff' : '#111111';
  const borderColor = focused ? '#7C3AED' : (isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db');

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="px-2 py-3 rounded-lg text-sm transition-colors"
      style={{
        backgroundColor: bg,
        color,
        border: `1px solid ${borderColor}`,
        outline: 'none',
        // Tells the browser to draw the native option popup in this scheme —
        // this is what makes the OS-drawn list dark (white text) in dark mode
        // and light in light mode, so options are readable in BOTH themes.
        colorScheme: isDark ? 'dark' : 'light',
      }}
    >
      {COUNTRIES.map((c) => (
        <option key={`${c.code}-${c.label}`} value={c.code} style={{ backgroundColor: bg, color }}>
          {c.label} {c.code}
        </option>
      ))}
    </select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LoginModal({ isOpen, onClose, initialMode = 'login' }: LoginModalProps) {
  const { login, createFirebaseAccount, finalizeSignup, loginWithGoogle, loginWithFacebook, loginWithMicrosoft } = useAuth();

  // ── Core form ──
  const [activeTab, setActiveTab]       = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState(false);
  const [loading, setLoading]           = useState(false);

  // ── Forgot password ──
  const [showForgot, setShowForgot]     = useState(false);
  const [resetEmail, setResetEmail]     = useState('');
  const [resetMsg, setResetMsg]         = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // ── Signup phone (collected on the form; no OTP verification step) ──
  const [signupCountry, setSignupCountry] = useState('+91');
  const [signupPhone, setSignupPhone]   = useState('');

  // ── Signup anti-abuse: honeypot ──
  // Invisible field; bots that fill it are silently dropped by the backend.
  // (CAPTCHA is handled site-wide by the full-screen Turnstile gate, not here.)
  const [signupWebsite, setSignupWebsite] = useState('');

  // ── Signup: email OTP verification step ──
  // After Firebase creates the account, we show this step before the DB
  // profile is written. Email-only — no SMS, no Turnstile on this step.
  const [signupStep, setSignupStep] = useState<'form' | 'verify'>('form');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpStatus, setOtpStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [otpError, setOtpError] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const otpCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startOtpCooldown = () => {
    setOtpCooldown(60);
    if (otpCooldownRef.current) clearInterval(otpCooldownRef.current);
    otpCooldownRef.current = setInterval(() => {
      setOtpCooldown((n) => {
        if (n <= 1) {
          if (otpCooldownRef.current) clearInterval(otpCooldownRef.current);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (otpCooldownRef.current) clearInterval(otpCooldownRef.current); }, []);

  useEffect(() => {
    if (isOpen) setActiveTab(initialMode);
  }, [isOpen, initialMode]);

  const resetOtpState = () => {
    setSignupStep('form');
    setOtpDigits(['', '', '', '', '', '']);
    setOtpStatus('idle');
    setOtpError('');
    setOtpCooldown(0);
    if (otpCooldownRef.current) clearInterval(otpCooldownRef.current);
  };

  const handleClose = () => {
    setEmail(''); setPassword(''); setConfirmPassword('');
    setFullName(''); setSignupPhone('');
    setSignupWebsite('');
    resetOtpState();
    setActiveTab(initialMode); setError(''); setSuccess(false);
    setShowForgot(false); setResetEmail(''); setResetMsg('');
    onClose();
  };

  const switchToOtherTab = () => {
    setActiveTab((t) => (t === 'login' ? 'signup' : 'login'));
    setEmail(''); setPassword(''); setConfirmPassword('');
    setFullName(''); setSignupPhone('');
    setSignupWebsite('');
    resetOtpState();
    setError(''); setShowForgot(false); setResetEmail(''); setResetMsg('');
  };

  // ─── Password login ──────────────────────────────────────────────────────
  // Verify credentials with Firebase and sign in directly (no OTP step).

  const handleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const identifier = email.includes('@')
        ? email
        : `${email.trim().toLowerCase()}@${CREATOR_EMAIL_DOMAIN}`;
      await login(identifier, password);
      setSuccess(true);
      setTimeout(() => handleClose(), 1000);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── Signup ──────────────────────────────────────────────────────────────
  // Step 1: create the Firebase account, then send an email OTP and show the
  // verification step. Step 2 (handleOtpVerify): confirm the code, THEN write
  // the DB profile. Google/Facebook/Microsoft and email/password LOGIN are
  // untouched — this OTP step is signup-only.

  const signupFullPhone = () => `${signupCountry}${signupPhone.replace(/\D/g, '')}`;

  const handleSignup = async () => {
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    if (!email.trim())    { setError('Please enter your email address.'); return; }
    if (!signupPhone.replace(/\D/g, '')) { setError('Please enter your phone number.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setError('');
    setLoading(true);
    try {
      await createFirebaseAccount(email.trim(), password);
      await sendOtp('email', email.trim());
      setSignupStep('verify');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpStatus('idle');
      setOtpError('');
      startOtpCooldown();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (code: string) => {
    if (code.length < 6) return;
    setOtpStatus('verifying');
    setOtpError('');
    try {
      const customToken = await verifyOtp('email', email.trim(), code);
      // Re-establish the session via the custom token (the OTP route mints one
      // for the already-existing Firebase user), then write the DB profile.
      await signInWithCustomToken(auth, customToken);
      await finalizeSignup({
        fullName: fullName.trim(),
        phone: signupFullPhone(),
        security: { website: signupWebsite },
      });
      setOtpStatus('success');
      setSuccess(true);
      setTimeout(() => handleClose(), 1200);
    } catch (err) {
      const e = err as { error?: string; message?: string; attemptsRemaining?: number };
      setOtpStatus('error');
      const suffix = typeof e.attemptsRemaining === 'number'
        ? ` ${e.attemptsRemaining} attempt${e.attemptsRemaining !== 1 ? 's' : ''} remaining.`
        : '';
      setOtpError(e.error === 'locked' ? (e.message ?? 'Too many attempts.') : `Incorrect code.${suffix}`);
      setTimeout(() => {
        setOtpDigits(['', '', '', '', '', '']);
        setOtpStatus('idle');
      }, 600);
    }
  };

  const handleOtpResend = async () => {
    if (otpCooldown > 0 || resending) return;
    setResending(true);
    setOtpError('');
    try {
      await sendOtp('email', email.trim());
      setOtpDigits(['', '', '', '', '', '']);
      setOtpStatus('idle');
      startOtpCooldown();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  // Cancel signup mid-verification: discard the just-created Firebase account
  // (it has no DB profile yet) and return to the form.
  const handleOtpBack = async () => {
    try { await signOut(auth); } catch { /* best-effort */ }
    resetOtpState();
  };

  // ─── Forgot password ─────────────────────────────────────────────────────

  const handleForgotPassword = async () => {
    const trimmed = resetEmail.trim();
    setResetMsg('');
    const isSynthetic = !trimmed.includes('@') || trimmed.toLowerCase().endsWith(`@${CREATOR_EMAIL_DOMAIN}`);
    if (isSynthetic) {
      setResetMsg("This account was set up by an admin and doesn't use email. Contact an admin to reset your password.");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'auth/invalid-email') {
        setResetMsg('Please enter a valid email address.');
        setResetLoading(false);
        return;
      }
    } finally {
      setResetLoading(false);
    }
    setResetMsg('If an account exists for this email, a password reset link has been sent.');
  };

  // ─── Social login ────────────────────────────────────────────────────────

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'microsoft') => {
    setError('');
    setLoading(true);
    try {
      if (provider === 'google') await loginWithGoogle();
      else if (provider === 'facebook') await loginWithFacebook();
      else await loginWithMicrosoft();
      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── Shared UI atoms ─────────────────────────────────────────────────────

  const gradientBtn = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  // Single-border focus: subtle border at rest, one purple border on focus.
  // No ring + outline-none avoids the double-border / dual-color effect.
  const inputCls = 'w-full px-4 py-3 bg-gray-100 dark:bg-white/5 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 border border-gray-300 dark:border-white/20 focus:outline-none focus:ring-0 focus:border-primary-600 transition-all';

  const SocialIcons = () => (
    <div className="flex items-center justify-center gap-3 mt-6">
      <button onClick={() => handleSocialLogin('facebook')} disabled={loading} aria-label="Sign in with Facebook" className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/20 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
        <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
      </button>
      <button onClick={() => handleSocialLogin('google')} disabled={loading} aria-label="Sign in with Google" className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/20 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      </button>
      <button onClick={() => handleSocialLogin('microsoft')} disabled={loading} aria-label="Sign in with Microsoft" className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/20 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
        <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
      </button>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
          style={{ isolation: 'isolate' }}
        >
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-dark-900 rounded-3xl shadow-2xl overflow-y-auto flex flex-col md:flex-row md:min-h-[520px]"
          >
            <motion.button
              onClick={handleClose}
              aria-label="Close"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white dark:bg-white/20 flex items-center justify-center text-gray-600 dark:text-white hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors shadow-lg border border-gray-200 dark:border-white/10"
            >
              <X className="w-5 h-5" />
            </motion.button>

            {/* ── Success splash ── */}
            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12 px-8 flex-1 flex items-center justify-center"
              >
                <div>
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {activeTab === 'signup' ? 'Account Created!' : 'Welcome Back!'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">
                    Redirecting you now…
                  </p>
                </div>
              </motion.div>
            ) : (
              <>
                {/* ── Left panel — form ── */}
                <div className="flex-1 p-8 md:p-10 flex flex-col justify-center bg-white dark:bg-dark-900 order-2 md:order-1 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab + signupStep}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="w-full max-w-sm mx-auto"
                    >
                      {activeTab === 'signup' && signupStep === 'verify' ? (
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={handleOtpBack}
                            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-6"
                          >
                            <ArrowLeft className="w-4 h-4" /> Back
                          </button>
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verify your email</h2>
                          <p className="text-sm text-gray-500 dark:text-dark-400 mb-8">
                            We sent a code to <span className="font-medium text-gray-700 dark:text-gray-200">{email.trim()}</span>
                          </p>

                          <OTPInput
                            digits={otpDigits}
                            onChange={setOtpDigits}
                            onComplete={handleOtpVerify}
                            status={otpStatus}
                          />
                          {otpError && (
                            <p className="mt-4 text-sm text-red-500">{otpError}</p>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOtpVerify(otpDigits.join(''))}
                            disabled={otpStatus === 'verifying' || otpStatus === 'success' || otpDigits.join('').length < 6}
                            className="w-full mt-6 py-3 px-6 text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
                            style={{ background: gradientBtn }}
                          >
                            {otpStatus === 'verifying' ? 'Verifying…' : 'Verify & Continue'}
                          </button>

                          <button
                            type="button"
                            onClick={handleOtpResend}
                            disabled={otpCooldown > 0 || resending}
                            className="mt-4 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed transition-all"
                          >
                            {resending ? 'Resending…' : otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : 'Resend code'}
                          </button>
                        </div>
                      ) : (
                      <>
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-4">
                            {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                          </h2>

                          {/* ─ Form fields ─ */}
                          <>
                              {/* Signup fields */}
                              {activeTab === 'signup' && (
                                <div className="mb-4">
                                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" className={inputCls} />
                                </div>
                              )}

                              <div className="mb-4">
                                <input
                                  type={activeTab === 'login' ? 'text' : 'email'}
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  placeholder={activeTab === 'login' ? 'Email or Mobile number' : 'Email Address'}
                                  className={inputCls}
                                />
                              </div>

                              {/* Signup phone field */}
                              {activeTab === 'signup' && (
                                <div className="mb-4 flex gap-2">
                                  <CountrySelect value={signupCountry} onChange={setSignupCountry} />
                                  <input
                                    type="tel"
                                    value={signupPhone}
                                    onChange={(e) => setSignupPhone(e.target.value)}
                                    placeholder="98765 43210"
                                    className={inputCls + ' flex-1'}
                                  />
                                </div>
                              )}

                              {/* Password */}
                              <div className="mb-4 relative">
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  placeholder="Password"
                                  className={inputCls + ' pr-12'}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                                  aria-label={showPassword ? 'Hide' : 'Show'}
                                >
                                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                              </div>

                              {activeTab === 'signup' && (
                                <div className="mb-4 relative">
                                  <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm Password"
                                    className={inputCls + ' pr-12'}
                                  />
                                </div>
                              )}

                              {/* Forgot password */}
                              {activeTab === 'login' && !showForgot && (
                                <div className="text-center mb-4">
                                  <button type="button" onClick={() => { setResetEmail(email); setResetMsg(''); setShowForgot(true); }} className="text-sm text-gray-500 dark:text-dark-400 hover:text-primary-500 transition-colors">
                                    Forgot your password?
                                  </button>
                                </div>
                              )}

                              {activeTab === 'login' && showForgot && (
                                <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Reset your password</p>
                                  <input type="text" value={resetEmail} onChange={(e) => { setResetEmail(e.target.value); setResetMsg(''); }} placeholder="Email or username" className="w-full px-4 py-2.5 bg-white dark:bg-white/5 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500/50 mb-3" />
                                  {resetMsg && (
                                    <p className={`text-xs mb-3 ${resetMsg.startsWith('If an account') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{resetMsg}</p>
                                  )}
                                  <div className="flex gap-3">
                                    <button type="button" onClick={handleForgotPassword} disabled={resetLoading || !resetEmail.trim()} className="flex-1 py-2 px-4 text-white text-sm font-semibold rounded-full disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: gradientBtn }}>
                                      {resetLoading ? 'Sending…' : 'Send reset link'}
                                    </button>
                                    <button type="button" onClick={() => { setShowForgot(false); setResetMsg(''); }} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 whitespace-nowrap">
                                      Back
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Anti-abuse honeypot — invisible to humans; bots that
                                  fill it are silently dropped server-side. */}
                              {activeTab === 'signup' && (
                                <input
                                  type="text"
                                  name="website"
                                  value={signupWebsite}
                                  onChange={(e) => setSignupWebsite(e.target.value)}
                                  autoComplete="off"
                                  tabIndex={-1}
                                  aria-hidden="true"
                                  style={{ display: 'none' }}
                                />
                              )}

                              {/* Terms */}
                              {activeTab === 'signup' && (
                                <p className="text-xs text-gray-500 dark:text-dark-400 text-center mb-4">
                                  By signing up, you agree to our <a href="#" className="text-primary-500 hover:underline">Terms</a> and <a href="#" className="text-primary-500 hover:underline">Privacy Policy</a>.
                                </p>
                              )}

                              {/* Error */}
                              {error && (
                                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                  <p className="text-sm text-red-500 text-center">{error}</p>
                                </div>
                              )}

                              {/* Submit */}
                              <button
                                onClick={activeTab === 'signup' ? handleSignup : handleAuth}
                                disabled={loading || !email || !password || (activeTab === 'signup' && (!confirmPassword || !fullName || !signupPhone))}
                                className="w-full py-3 px-6 text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
                                style={{ background: gradientBtn }}
                              >
                                {loading ? 'Loading…' : activeTab === 'signup' ? 'Continue' : 'Sign In'}
                              </button>
                            </>

                          {/* Divider + social */}
                          <p className="text-center text-sm text-gray-400 dark:text-dark-400 mt-6 mb-2">Or continue with</p>
                          <SocialIcons />
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* ── Right panel — decorative ── */}
                <div className="flex-1 p-8 md:p-10 flex flex-col items-center justify-center relative overflow-hidden order-1 md:order-2" style={{ minHeight: '200px' }}>
                  {/* Light mode: soft pink/blue/purple gradient image. */}
                  <div className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 dark:hidden" style={{ backgroundImage: 'url(/modal-bg-light.jpg)' }} />
                  {/* Dark mode: deep purple gradient image. */}
                  <div className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 hidden dark:block" style={{ backgroundImage: 'url(/modal-bg-dark.jpg)' }} />
                  <div className="absolute inset-0 bg-black/0 dark:bg-black/30" />
                  <div className="relative z-10 text-center flex flex-col items-center justify-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg bg-clip-text text-transparent" style={{ backgroundImage: gradientBtn }}>
                      {activeTab === 'login' ? 'Welcome Back!' : 'Hey There!'}
                    </h2>
                    <p className="text-white/90 text-sm md:text-base mb-8 max-w-xs mx-auto drop-shadow-md">
                      {activeTab === 'login'
                        ? 'Already have an account? Sign in to continue your journey.'
                        : 'Create your account now and step into an amazing new journey.'}
                    </p>
                    <button onClick={switchToOtherTab} className="px-8 py-3 text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all" style={{ background: gradientBtn }}>
                      {activeTab === 'login' ? 'Sign Up' : 'Sign In'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
