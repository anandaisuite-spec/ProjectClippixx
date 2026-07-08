import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Search, MessageSquare, Video, Download } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Find Your Star',
    description:
      'Browse our extensive catalog of celebrities across all categories. Use filters to find the perfect match for your occasion.',
  },
  {
    number: '02',
    icon: MessageSquare,
    title: 'Make a Request',
    description:
      'Tell the celebrity who the video is for, the occasion, and any specific messages you\'d like included.',
  },
  {
    number: '03',
    icon: Video,
    title: 'Get Your Video',
    description:
      'Your star records a personalized video message just for you. Most videos are delivered within 7 days.',
  },
  {
    number: '04',
    icon: Download,
    title: 'Share the Joy',
    description:
      'Download your video and share it with the world. Keep it forever as a treasured memory.',
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let ctx: ReturnType<typeof gsap.context> | null = null;

    // Delay setup so lazy-loaded siblings above have painted and settled layout
    const timer = setTimeout(() => {
      ctx = gsap.context(() => {
        gsap.fromTo(
          lineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 60%',
              end: 'bottom 70%',
              scrub: 1,
            },
          }
        );

        stepsRef.current.forEach((step, index) => {
          if (!step) return;

          gsap.fromTo(
            step,
            { opacity: 0, x: index % 2 === 0 ? -60 : 60 },
            {
              opacity: 1,
              x: 0,
              duration: 0.8,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: step,
                start: 'top 80%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        });

        // Recalculate all trigger positions after layout is stable
        ScrollTrigger.refresh();
      }, sectionRef.current ?? undefined);
    }, 300);

    return () => {
      clearTimeout(timer);
      ctx?.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="workflow"
      className="relative py-24 md:py-32 overflow-hidden"
    >


      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-20">
          <span className="inline-block px-5 py-1.5 text-lg font-bold tracking-wider uppercase section-pill-oval rounded-full mb-6">
            Simple Process
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            How Clippixx works
          </h2>
          <p className="text-lg text-gray-600 dark:text-dark-400 max-w-2xl mx-auto">
            Getting a personalized video from your favorite celebrity has never
            been easier.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div
            ref={lineRef}
            className="absolute left-8 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500 via-primary-600 to-primary-700 origin-top"
          />

          <div className="space-y-12 md:space-y-24">
            {steps.map((step, index) => (
              <div
                key={step.number}
                ref={(el) => { stepsRef.current[index] = el; }}
                className={`relative flex items-center gap-8 md:gap-16 ${index % 2 === 1 ? 'md:flex-row-reverse' : ''
                  }`}
              >
                <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary-500 border-4 border-gray-50 dark:border-dark-950 z-10" />

                <div
                  className={`flex-1 pl-20 md:pl-0 ${index % 2 === 1 ? 'md:text-right' : ''
                    }`}
                >
                  <div
                    className={`inline-flex items-center gap-4 mb-4 ${index % 2 === 1 ? 'md:flex-row-reverse' : ''
                      }`}
                  >
                    <span className="text-6xl font-bold text-black/50 dark:text-white/60 drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.1)]">
                      {step.number}
                    </span>
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center">
                      <step.icon className="w-7 h-7 text-primary-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-dark-400 leading-relaxed max-w-md">
                    {step.description}
                  </p>
                </div>

                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
