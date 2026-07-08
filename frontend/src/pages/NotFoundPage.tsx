import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Home, Compass, ChevronRight } from 'lucide-react';

/**
 * 404 — static recreation of the Canva reference design.
 * React + Tailwind only.
 */
export default function NotFoundPage() {
  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden text-white"
      style={{
        background: 'radial-gradient(ellipse 90% 70% at 50% 38%, #1a1a3a 0%, #0b0b1e 72%)',
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center px-4 pb-12 pt-16 text-center sm:pt-[4.5rem]">
        {/* top label */}
        <p className="text-[15px] font-normal text-[#a0a0c0]">You look a little lost...</p>

        {/* heading */}
        <h1 className="relative mt-3 whitespace-nowrap text-[2.4rem] font-extrabold leading-[1.1] tracking-[-0.025em] sm:text-[3rem]">
          <OoopsAccent />
          <span className="text-white">Ooops! Page </span>
          <span className="relative inline-block text-[#b794f6]">
            not found
            <svg
              className="pointer-events-none absolute -bottom-1 left-0 w-full"
              height="8"
              viewBox="0 0 160 8"
              preserveAspectRatio="none"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 5.5 C 35 2, 85 7, 158 4"
                stroke="#9d70ff"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        {/* description */}
        <p className="mt-6 text-[15px] leading-relaxed text-[#a0a0c0]">
          The page you&apos;re looking for doesn&apos;t exist
          <br />
          or may have been moved.
        </p>

        {/* illustration — directly on page background, no container */}
        <Illustration />

        {/* action cards */}
        <div className="mt-8 w-full max-w-[462px] space-y-3 sm:mt-10">
          <ActionCard
            to="/"
            icon={<Home className="h-5 w-5" strokeWidth={2} />}
            title="Back to Home"
            subtitle="Return to the homepage."
          />
          <ActionCard
            to="/creators"
            icon={<Compass className="h-5 w-5" strokeWidth={2} />}
            title="Explore Clippixx"
            subtitle="Discover tools and features."
          />
        </div>

        {/* footer */}
        <p className="mt-8 text-sm text-[#a0a0c0]">
          Still need help?{' '}
          <Link to="/feedback" className="text-[#9d70ff] hover:text-[#b794f6]">
            Contact our support team.
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Three slanted purple accent lines above "Ooops!" */
function OoopsAccent() {
  return (
    <svg
      className="pointer-events-none absolute -left-1 -top-3.5 sm:-left-2 sm:-top-4"
      width="28"
      height="18"
      viewBox="0 0 28 18"
      fill="none"
      aria-hidden
    >
      <line x1="3" y1="15" x2="7" y2="5" stroke="#9d70ff" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="16" x2="14" y2="3" stroke="#9d70ff" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="17" y1="15" x2="21" y2="6" stroke="#9d70ff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── 404 illustration: numerals, robot, clouds, plane, sparkles ─────────── */

function Illustration() {
  return (
    <div className="relative mt-8 flex h-[19rem] w-full max-w-[520px] items-center justify-center sm:mt-10 sm:h-80">
      <FlightPath />

      <Cloud className="left-[8%] top-5" scale={1.105} />
      <Cloud className="right-[24%] top-2" scale={1.014} />

      <PaperPlane />

      <Sparkle className="left-[26%] top-[34%]" size={14} />
      <Sparkle className="left-[8%] top-[58%]" size={20} />
      <Sparkle className="left-[40%] top-[24%]" size={10} />
      <Sparkle className="right-[30%] top-[70%]" size={12} />
      <Sparkle className="right-[10%] top-[40%]" size={9} />
      <Sparkle className="left-[20%] top-[80%]" size={11} />

      {/* floor glow */}
      <div
        className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2"
        style={{
          width: 420,
          height: 50,
          filter: 'blur(35px)',
          opacity: 0.8,
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.7), transparent 70%)',
        }}
        aria-hidden
      />

      <div
        className="relative z-10 flex items-end justify-center gap-1 sm:gap-1.5"
        style={{ transform: 'scaleX(1.311) scaleY(1.035)' }}
      >
        <Numeral tilt={-8}>4</Numeral>

        <div className="relative inline-block leading-none">
          <Numeral isZero>0</Numeral>
          <QuestionMark />
          <img
            src="/404-robot.png"
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 block h-[38%] w-auto max-w-[56%] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
          />
        </div>

        <Numeral tilt={8}>4</Numeral>
      </div>
    </div>
  );
}

function Numeral({ children, isZero, tilt = 0 }: { children: string; isZero?: boolean; tilt?: number }) {
  return (
    <span
      className="text-[8.5rem] font-extrabold leading-none sm:text-[13rem]"
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        color: isZero ? '#7d80ef' : '#8b8ff5',
        display: 'inline-block',
        transform: `perspective(620px) rotateY(${tilt}deg)`,
        letterSpacing: '-0.04em',
        textShadow: [
          '1px 1px 0 #7c7ff0',
          '2px 2px 0 #7174ec',
          '3px 3px 0 #6a6ce8',
          '4px 5px 0 #6260e3',
          '5px 6px 0 #5a52dd',
          '7px 9px 0 #5446d6',
          '9px 12px 0 #4c3ccf',
          '11px 16px 22px rgba(67,56,202,0.55)',
        ].join(', '),
      }}
    >
      {children}
    </span>
  );
}

function QuestionMark() {
  return (
    <span
      className="absolute left-[58%] top-[1%] z-20 font-black text-[#b794f6]"
      style={{
        fontSize: '1.65rem',
        textShadow: '1px 2px 0 #7c5cff, 2px 4px 8px rgba(124,92,255,0.45)',
      }}
      aria-hidden
    >
      ?
    </span>
  );
}

function Cloud({ className = '', scale = 1 }: { className?: string; scale?: number }) {
  const w = Math.round(58 * scale);
  const h = Math.round(34 * scale);
  return (
    <div className={`absolute ${className}`} aria-hidden>
      <svg width={w} height={h} viewBox="0 0 58 34" fill="none">
        <path
          d="M14 28 a10 10 0 0 1 0-20 a13 13 0 0 1 26 2 a9 9 0 0 1 3 18 Z"
          fill="#a78bfa"
          opacity="0.55"
          style={{ filter: 'drop-shadow(0 3px 6px rgba(124,92,255,0.25))' }}
        />
      </svg>
    </div>
  );
}

function Sparkle({ className = '', size = 12 }: { className?: string; size?: number }) {
  return (
    <div className={`absolute ${className}`} aria-hidden>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#c4b5fd">
        <path d="M12 0 C 13 8, 16 11, 24 12 C 16 13, 13 16, 12 24 C 11 16, 8 13, 0 12 C 8 11, 11 8, 12 0 Z" />
      </svg>
    </div>
  );
}

function FlightPath() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      viewBox="0 0 520 320"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden
    >
      <path
        d="M 18 268
           C 72 248, 118 228, 158 205
           C 188 188, 205 162, 215 132
           C 225 98, 248 72, 278 68
           C 308 64, 328 88, 338 118
           C 348 148, 372 128, 398 98
           C 424 68, 448 48, 478 28"
        stroke="#ffffff"
        strokeOpacity="0.42"
        strokeWidth="2"
        strokeDasharray="5 7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function PaperPlane() {
  return (
    <div className="absolute right-[3%] top-0 z-[1]" aria-hidden>
      <svg width="42" height="42" viewBox="0 0 46 46" fill="none">
        <path d="M42 5 L5 22 L19 27 L23 42 L29 27 L42 5 Z" fill="#8b5cf6" />
        <path d="M42 5 L19 27 L23 42 L42 5 Z" fill="#a78bfa" />
        <path d="M42 5 L19 27 L25 28 Z" fill="#c4b5fd" />
      </svg>
    </div>
  );
}

function ActionCard({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="group flex w-full items-center gap-4 rounded-2xl border border-[#ffffff0d] bg-[#0f0f2d] px-5 py-[1.125rem] shadow-[0_2px_20px_rgba(0,0,0,0.35)] transition-colors hover:border-[#ffffff14] hover:bg-[#12153d] sm:px-6 sm:py-5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#7c6cf0] to-[#5b5ef5] text-white shadow-[0_2px_8px_rgba(124,108,240,0.35)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-bold text-white">{title}</span>
        <span className="mt-0.5 block text-[13px] text-[#8b8ba8]">{subtitle}</span>
      </span>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#7a7a9a] transition-colors group-hover:text-[#9d70ff]" strokeWidth={2} />
    </Link>
  );
}
