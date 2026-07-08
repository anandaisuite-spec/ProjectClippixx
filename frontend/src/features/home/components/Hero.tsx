import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import Button from '@/components/ui/Button';

type HeroProps = {
  onGetStarted?: () => void;
};

export default function Hero({ onGetStarted }: HeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const orbsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      gsap.set([headlineRef.current, subheadlineRef.current, ctaRef.current], {
        opacity: 0,
        y: 60,
      });

      tl.to(orbsRef.current?.children || [], {
        opacity: 0.6,
        scale: 1,
        duration: 1.5,
        stagger: 0.2,
        ease: 'power2.out',
      })
        .to(
          headlineRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 1,
            force3D: false,
          },
          '-=1'
        )
        .to(
          subheadlineRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            force3D: false,
          },
          '-=0.6'
        )
        .to(
          ctaRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            force3D: false,
          },
          '-=0.4'
        );

      gsap.to(orbsRef.current?.children || [], {
        y: 'random(-30, 30)',
        x: 'random(-20, 20)',
        duration: 'random(4, 6)',
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: {
          each: 0.5,
          from: 'random',
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="hero relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background removed - using body gradient only */}

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-20 lg:pt-40">
        <div className="max-w-4xl text-left">
          <h1
            ref={headlineRef}
            className="text-3xl sm:text-4xl md:text-7xl lg:text-8xl font-bold leading-[1.08] text-gray-900 dark:text-white"
            style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.02em' }}
          >
            Personalized
            <br />
            videos
            <br />
            from your <span className="gradient-italic">favorite</span>
            <br />
            <span className="gradient-italic">stars Coming Soon...</span>
          </h1>

          <p
            ref={subheadlineRef}
            className="mt-8 text-base md:text-lg text-gray-600 dark:text-dark-300 max-w-md leading-relaxed"
          >
            The impossible gift, made possible. Connect with thousands
            of actors, athletes, and creators for a moment they'll never
            forget.
          </p>

          <div ref={ctaRef} className="mt-10 flex flex-wrap gap-4">
            <Button size="lg" onClick={onGetStarted}>Get Started</Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}
            >
              How It Works
            </Button>
          </div>
        </div>
      </div>


    </section>
  );
}
