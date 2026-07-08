import { lazy, Suspense, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CurvedLoop from "@/components/ui/CurvedLoop";
import Hero from "@/features/home/components/Hero";
import WelcomeBackHero from "@/features/home/components/WelcomeBackHero";
import { useModals } from "@/providers/ModalProvider";
import { useAuth } from "@/providers/AuthProvider";

const Showcase = lazy(() => import("@/features/home/components/Showcase"));
const Features = lazy(() => import("@/features/home/components/Features"));
const HowItWorks = lazy(() => import("@/features/home/components/HowItWorks"));
const JoinSection = lazy(() => import("@/features/home/components/JoinSection"));
const CTA = lazy(() => import("@/features/home/components/CTA"));

function SectionLoader() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function HomePage() {
  const { openSignup, openSuggestStar, openFeedback } = useModals();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  // Scroll to a section when arriving with a hash (e.g. footer "How It Works"
  // links to /#workflow). Delayed so lazy sections have mounted.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
    return () => clearTimeout(t);
  }, [location.hash]);

  // Don't flash the wrong hero during the Firebase auth check
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <main>
          {user ? (
            <WelcomeBackHero />
          ) : (
            <Hero onGetStarted={openSignup} />
          )}
        </main>
      </div>

      <CurvedLoop
        marqueeText="Actors      Comedians      Musicians      Creators      Reality TV      Athletes      Influencers      "
        speed={0.8}
        curveAmount={0}
        direction="left"
        interactive={false}
      />

      <div className="relative">
        <main>
          <Suspense fallback={<SectionLoader />}>
            <Features />
          </Suspense>
          <Suspense fallback={<SectionLoader />}>
            <Showcase onViewAll={() => navigate('/creators')} />
          </Suspense>
          <Suspense fallback={<SectionLoader />}>
            <HowItWorks />
          </Suspense>
          <Suspense fallback={<SectionLoader />}>
            <JoinSection
              onSuggestStar={openSuggestStar}
              onFeedback={openFeedback}
            />
          </Suspense>
          {!user && (
            <Suspense fallback={<SectionLoader />}>
              <CTA onGetStarted={openSignup} />
            </Suspense>
          )}
        </main>
      </div>
    </>
  );
}
