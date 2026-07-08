import { useState, useRef, useCallback } from 'react';
import Turnstile, { turnstileEnabled } from '@/components/ui/Turnstile';
import { verifyTurnstileToken } from '@/services/api';

const STORAGE_KEY = 'cf_verified';

/** True if this browser session has already passed the gate. */
export function isSessionVerified(): boolean {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false; // sessionStorage unavailable (e.g. privacy mode) → show gate
    }
}

type Props = {
    onVerified: () => void;
};

/**
 * Full-screen Cloudflare Turnstile gate shown once per browser session before
 * the app is accessible.
 *
 * The user ticks the "Verify you are human" checkbox; on success we verify the
 * token server-side, show a brief "✓ Verified!" beat, then redirect into the
 * site automatically. On failure we show an error and reset the widget.
 */
export default function TurnstileGate({ onVerified }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);
    const turnstileRef = useRef<{ reset: () => void } | null>(null);

    const handleToken = useCallback(async (token: string) => {
        setVerifying(true);
        setError(null);
        try {
            await verifyTurnstileToken(token);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
            turnstileRef.current?.reset();
            setVerifying(false);
            return;
        }
        // Verified — show "✓ Verified!" briefly, persist, then auto-redirect.
        setVerifying(false);
        setVerified(true);
        await new Promise((r) => setTimeout(r, 800));
        try { sessionStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
        onVerified();
    }, [onVerified]);

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center px-8 text-center"
            style={{
                width: '100vw',
                height: '100vh',
                background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f0a23 55%, #0a0713 100%)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Connection verification"
        >
            <div className="w-full max-w-xl">
                {/* Wordmark */}
                <h1 className="text-3xl font-extrabold tracking-tight mb-8">
                    <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        Clipixx
                    </span>
                </h1>

                <h2 className="text-xl sm:text-2xl font-bold text-white">Verifying your connection…</h2>
                <p className="mt-2 text-sm text-white/60 max-w-xl mx-auto">
                    This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.
                </p>

                <div className="mt-8 flex flex-col items-center">
                    {verified ? (
                        // Checkbox ticked + verified — show success, then auto-redirect.
                        <p className="text-lg font-medium" style={{ color: '#1D9E75' }}>✓ Verified!</p>
                    ) : (
                        <>
                            <Turnstile
                                ref={turnstileRef}
                                onVerify={handleToken}
                                onError={() => setError('The verification could not load. Please refresh and try again.')}
                                theme="dark"
                            />

                            {verifying && !error && <p className="mt-4 text-sm text-white/50">Checking…</p>}
                            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

                            {/* Dev convenience: when Turnstile isn't configured there's no
                                widget to interact with, so offer an explicit continue. */}
                            {!turnstileEnabled && (
                                <button
                                    onClick={() => handleToken('')}
                                    className="mt-6 px-6 py-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors"
                                >
                                    Continue
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
