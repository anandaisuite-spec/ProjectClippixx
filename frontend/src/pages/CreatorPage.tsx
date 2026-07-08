import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DollarSign, Calendar, CheckCircle, Shield, TrendingUp, Users } from 'lucide-react';
import Button from "@/components/ui/Button";
import { useModals } from "@/providers/ModalProvider";

gsap.registerPlugin(ScrollTrigger);

export default function CreatorPage() {
  const { openCreatorApplication } = useModals();

  return (
    <div className="min-h-screen text-gray-900 dark:text-white">
      <CreatorHero onApplicationClick={openCreatorApplication} />
      <Earnings />
      <HowItWorks />
      <ControlAndSafety />
      <SocialProof />
      <FinalCTA onApplicationClick={openCreatorApplication} />
    </div>
  );
}

type CreatorHeroProps = {
  onApplicationClick: () => void;
};

function CreatorHero({ onApplicationClick }: CreatorHeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-[100px] opacity-60" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/20 rounded-full blur-[80px] opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-900/30 rounded-full blur-[120px] opacity-60" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-20 lg:pt-40">
        <div className="max-w-4xl">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-white">
            Monetize your
            <br />
            <span className="gradient-italic">influence.</span>
            <br />
            On your terms.
          </h1>

          <p className="mt-8 text-lg md:text-xl text-gray-600 dark:text-dark-300 max-w-xl leading-relaxed">
            Turn fan requests into income. Set your own rates, choose which videos to make, and get paid weekly.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button size="lg" onClick={onApplicationClick}>Join as a Creator</Button>
            <Button variant="outline" size="lg">
              See How It Works
            </Button>
          </div>
        </div>
      </div>

    </section>
  );
}

function Earnings() {
  const earnings = [
    {
      icon: DollarSign,
      title: 'You Set Your Price',
      description: 'Full control over your rates. Charge what you are worth, from ₹10 to ₹2,500 per video.',
    },
    {
      icon: TrendingUp,
      title: 'Average ₹150 Per Video',
      description: 'Creators typically earn ₹150 per personalized video. Top earners make ₹50,000+ monthly.',
    },
    {
      icon: Calendar,
      title: 'Weekly Payouts',
      description: 'Get paid every week via direct deposit. No waiting, no hassle.',
    },
    {
      icon: CheckCircle,
      title: 'No Exclusivity',
      description: 'Keep all your other income streams. Use any platform, anytime.',
    },
  ];

  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-950/10 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16 md:mb-20">
          <span className="inline-block px-4 py-1.5 text-xs font-medium tracking-wider uppercase text-primary-400 bg-primary-500/10 rounded-full mb-6">
            Earnings
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Make real <span className="gradient-italic">money</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-dark-400 max-w-2xl mx-auto">
            Your fans want personalized content. Get paid for making it.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {earnings.map((item) => (
            <div
              key={item.title}
              className="group relative p-8 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] hover:border-primary-500/40 dark:hover:border-primary-500/30 transition-all duration-500"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center mb-6">
                  <item.icon className="w-7 h-7 text-primary-400" />
                </div>

                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {item.title}
                </h3>

                <p className="text-gray-600 dark:text-dark-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Set Price & Availability',
      description: 'Choose your rate per video and how many requests you want to accept each week. Update anytime.',
    },
    {
      number: '02',
      title: 'Accept or Decline Requests',
      description: 'Review each request and decide if you want to make the video. You have full control.',
    },
    {
      number: '03',
      title: 'Record & Get Paid',
      description: 'Record the video on your phone, upload it, and get paid. Most videos take 2-5 minutes to make.',
    },
  ];

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

        ScrollTrigger.refresh();
      }, sectionRef.current ?? undefined);
    }, 300);

    return () => {
      clearTimeout(timer);
      ctx?.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary-900/10 rounded-full blur-[200px]" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-20">
          <span className="inline-block px-4 py-1.5 text-xs font-medium tracking-wider uppercase text-primary-400 bg-primary-500/10 rounded-full mb-6">
            Simple Process
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            How it <span className="gradient-italic">works</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-dark-400 max-w-2xl mx-auto">
            Start earning in three simple steps. No complicated setup required.
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
                className={`relative flex items-center gap-8 md:gap-16 ${
                  index % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary-500 border-4 border-gray-50 dark:border-dark-950 z-10" />

                <div
                  className={`flex-1 pl-20 md:pl-0 ${
                    index % 2 === 1 ? 'md:text-right' : ''
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-4 mb-4 ${
                      index % 2 === 1 ? 'md:flex-row-reverse' : ''
                    }`}
                  >
                    <span className="text-6xl font-bold text-black/40 dark:text-white/60">
                      {step.number}
                    </span>
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

function ControlAndSafety() {
  const features = [
    {
      icon: CheckCircle,
      title: 'Full Approval Control',
      description: 'You decide which requests to accept. No obligation to complete any video you do not want to make.',
    },
    {
      icon: Shield,
      title: 'Decline Anything',
      description: 'Not comfortable with a request? Decline it instantly. Your comfort and safety come first.',
    },
    {
      icon: Users,
      title: 'Private Videos',
      description: 'All videos are private by default. Fans can only share if you explicitly allow it.',
    },
    {
      icon: CheckCircle,
      title: 'Brand Safety',
      description: 'We review all requests for inappropriate content. Your reputation is protected.',
    },
  ];

  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-950/10 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16 md:mb-20">
          <span className="inline-block px-4 py-1.5 text-xs font-medium tracking-wider uppercase text-primary-400 bg-primary-500/10 rounded-full mb-6">
            Control & Safety
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            You are in <span className="gradient-italic">control</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-dark-400 max-w-2xl mx-auto">
            Your platform, your rules. We prioritize your safety and creative freedom.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative p-8 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] hover:border-primary-500/40 dark:hover:border-primary-500/30 transition-all duration-500"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-primary-400" />
                </div>

                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>

                <p className="text-gray-600 dark:text-dark-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  const creators = [
    {
      name: 'Sarah Mitchell',
      role: 'Lifestyle Influencer',
      quote: 'I make ₹3,000 a month in just a few hours. Clippixx lets me connect with fans and get paid for it.',
    },
    {
      name: 'Marcus Chen',
      role: 'Gaming Creator',
      quote: 'Total game-changer. I set my own schedule and only accept videos I want to make. The income is real.',
    },
    {
      name: 'Elena Rodriguez',
      role: 'Fitness Coach',
      quote: 'My fans love getting personalized shoutouts. I love the extra income. Win-win.',
    },
  ];

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary-900/10 rounded-full blur-[200px]" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 text-xs font-medium tracking-wider uppercase text-primary-400 bg-primary-500/10 rounded-full mb-6">
            Creator Stories
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Join thousands of <span className="gradient-italic">creators</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {creators.map((creator) => (
            <div
              key={creator.name}
              className="p-8 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] transition-colors duration-300"
            >
              <p className="text-gray-700 dark:text-dark-300 leading-relaxed mb-6">"{creator.quote}"</p>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{creator.name}</div>
                <div className="text-sm text-gray-500 dark:text-dark-400">{creator.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type FinalCTAProps = {
  onApplicationClick: () => void;
};

function FinalCTA({ onApplicationClick }: FinalCTAProps) {
  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-950/20 to-transparent" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          Turn your time into <span className="gradient-italic">income</span>
        </h2>
        <p className="text-lg md:text-xl text-gray-600 dark:text-dark-300 mb-10 max-w-2xl mx-auto">
          Join Clippixx today and start earning from your fans. No cost to join, no commitment required.
        </p>
        <Button size="lg" onClick={onApplicationClick}>Start Earning From Fans</Button>
      </div>
    </section>
  );
}
