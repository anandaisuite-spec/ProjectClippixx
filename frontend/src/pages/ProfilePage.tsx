import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProfileById } from "@/services/api";
import type { PublicProfile } from "@/services/api";
import { ArrowLeft } from 'lucide-react';
import AvatarPlaceholder from "@/components/ui/AvatarPlaceholder";

export default function ProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setError('No user ID provided');
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        getProfileById(userId)
            .then((p) => { if (!cancelled) setProfile(p); })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [userId]);

    const handleBack = () => navigate('/browse');

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-gray-500">{error ?? 'Profile not found'}</p>
                <button onClick={handleBack} className="text-purple-600 dark:text-purple-400 hover:underline text-sm">
                    ← Back to Browse
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-8 pt-24">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Browse
                </button>

                <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 border border-gray-100 dark:border-dark-700 shadow-sm">
                    <div className="flex flex-col items-center text-center">
                        <AvatarPlaceholder
                            name={`${profile.first_name} ${profile.last_name}`}
                            src={profile.avatar_url}
                            size={96}
                            className="mb-4"
                        />

                        <h1 className="text-2xl font-bold mb-1">{profile.first_name} {profile.last_name}</h1>

                        <span className="text-xs uppercase tracking-widest text-purple-600 dark:text-purple-400 font-semibold mb-4">
                            {profile.account_type}
                        </span>

                        {profile.bio && (
                            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md leading-relaxed">
                                {profile.bio}
                            </p>
                        )}

                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
                            Member since {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
