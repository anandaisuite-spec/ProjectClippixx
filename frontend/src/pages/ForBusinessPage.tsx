import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import {
    Rocket, Megaphone, PartyPopper, Mic2, ArrowRight,
    Search, Video, Share2, Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAllCreators, type Creator } from '@/data/creators';
import CreatorGrid from '@/features/creator/components/CreatorGrid';

gsap.registerPlugin(ScrollTrigger);

const CREATORS_ANCHOR = 'creators-for-business';

// Use cases — each maps to a real business order_type already supported by BookingModal.
const USE_CASES: { icon: LucideIcon; title: string; desc: string; intent: string }[] = [
    {
        icon: Rocket,
        title: 'Product Launch Wishes',
        desc: 'Have a creator hype up your new product with a personalized video your audience will actually share.',
        intent: 'product_launch',
    },
    {
        icon: Megaphone,
        title: 'Brand Promotions',
        desc: 'Get an authentic endorsement from a creator your customers already trust.',
        intent: 'brand_promotion',
    },
    {
        icon: PartyPopper,
        title: 'Event Invitations',
        desc: 'Invite guests to your conference, launch party, or wedding with a personal video invite.',
        intent: 'event_invitation',
    },
    {
        icon: Mic2,
        title: 'Chief Guest & Emcee',
        desc: 'Book a creator to headline or host your next event — corporate or personal, virtual or in person.',
        intent: 'chief_guest',
    },
];

const STEPS: { number: string; icon: LucideIcon; title: string; desc: string }[] = [
    { number: '01', icon: Search, title: 'Pick a creator & shoutout type', desc: 'Browse creators and choose the occasion that fits your event or brand.' },
    { number: '02', icon: Video, title: 'Share your event or brand details', desc: 'Add your company, event name, date, and exactly what you\'d like them to say.' },
    { number: '03', icon: Share2, title: 'Receive your personalized video', desc: 'Get a ready-to-share video your audience or guests will love.' },
];

export default function ForBusinessPage() {
    const navigate = useNavigate();
    const [creators, setCreators] = useState<Creator[]>([]);
    const [loadingCreators, setLoadingCreators] = useState(true);

    // Refs for the "How it works" timeline animation (matches landing page).
    const howRef = useRef<HTMLElement>(null);
    const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
    const lineRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        getAllCreators()
            .then((data) => { if (!cancelled) setCreators(data); })
            .catch(() => { if (!cancelled) setCreators([]); })
            .finally(() => { if (!cancelled) setLoadingCreators(false); });
        return () => { cancelled = true; };
    }, []);

    // Timeline + step animation — identical pattern to the landing HowItWorks.
    useLayoutEffect(() => {
        let ctx: ReturnType<typeof gsap.context> | null = null;
        const timer = setTimeout(() => {
            ctx = gsap.context(() => {
                gsap.fromTo(
                    lineRef.current,
                    { scaleY: 0 },
                    {
                        scaleY: 1,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: howRef.current,
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
            }, howRef.current ?? undefined);
        }, 300);

        return () => {
            clearTimeout(timer);
            ctx?.revert();
        };
    }, []);

    const scrollToCreators = (intent?: string) => {
        if (intent) {
            // Picked up by BookingModal (business mode) to pre-select the chip.
            sessionStorage.setItem('booking_intent', intent);
        }
        document.getElementById(CREATORS_ANCHOR)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen">
            {/* ── Hero ─────────────────────────────────────────────── */}
            <section className="relative pt-32 pb-20 px-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary-950/10 via-transparent to-transparent" />
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="relative max-w-3xl mx-auto text-center"
                >
                    <span className="inline-block px-5 py-1.5 text-lg font-bold tracking-wider uppercase section-pill-oval rounded-full mb-6">
                        For Business & Events
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
                        Shoutouts for every <span className="gradient-italic">occasion</span>
                    </h1>
                    <p className="mt-5 text-lg text-gray-600 dark:text-dark-300 max-w-2xl mx-auto">
                        From product launches and brand promotions to chief guests and emcees for any event —
                        corporate or personal — book a creator to make it unforgettable.
                    </p>
                    <button
                        onClick={() => scrollToCreators()}
                        className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
                    >
                        Find a creator <ArrowRight className="w-5 h-5" />
                    </button>
                </motion.div>
            </section>

            {/* ── Use case grid ────────────────────────────────────── */}
            <section className="py-16 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {USE_CASES.map((uc, i) => (
                            <motion.div
                                key={uc.title}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: i * 0.08 }}
                                className="forbiz-card group flex flex-col rounded-3xl p-7 transition-all duration-300"
                            >
                                <div className="forbiz-card-icon w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                    <uc.icon className="w-6 h-6 text-primary-500 dark:text-primary-400" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{uc.title}</h3>
                                <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-dark-400">{uc.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works (timeline — matches landing page) ───────── */}
            <section ref={howRef} className="relative py-24 md:py-32 overflow-hidden">
                <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="text-center mb-20">
                        <span className="inline-block px-5 py-1.5 text-lg font-bold tracking-wider uppercase section-pill-oval rounded-full mb-6">
                            Simple Process
                        </span>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                            How it works
                        </h2>
                    </div>

                    <div className="relative max-w-4xl mx-auto">
                        <div
                            ref={lineRef}
                            className="absolute left-8 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500 via-primary-600 to-primary-700 origin-top"
                        />

                        <div className="space-y-12 md:space-y-24">
                            {STEPS.map((step, index) => (
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
                                            {step.desc}
                                        </p>
                                    </div>

                                    <div className="hidden md:block flex-1" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Creators showcase ────────────────────────────────── */}
            <section id={CREATORS_ANCHOR} className="py-16 px-6 scroll-mt-24">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Pick your creator</h2>
                        <p className="mt-2 text-gray-600 dark:text-dark-400">Tap a creator to view their profile and book a business video.</p>
                    </div>
                    {loadingCreators ? (
                        <div className="py-16 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                        </div>
                    ) : (
                        <CreatorGrid creators={creators} />
                    )}
                </div>
            </section>

            {/* ── Closing CTA ──────────────────────────────────────── */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto rounded-3xl border border-primary-200 dark:border-primary-500/20 bg-primary-50 dark:bg-primary-500/5 p-10 text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                        Ready to make your event unforgettable?
                    </h2>
                    <p className="mt-3 text-gray-600 dark:text-dark-400">
                        Browse creators and book a personalized video for your brand or occasion.
                    </p>
                    <button
                        onClick={() => navigate('/creators')}
                        className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
                    >
                        Browse all creators <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </section>
        </div>
    );
}
