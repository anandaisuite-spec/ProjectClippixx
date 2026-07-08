import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProfile, getMyActivity } from "@/services/api";
import type { Profile, UserActivity } from "@/services/api";
import { User, Star, MessageSquare, ClipboardList } from 'lucide-react';
import { capitalizeFirst } from '@/utils/text';

export default function UserDashboard() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [activity, setActivity] = useState<UserActivity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);

        Promise.all([getMyProfile(), getMyActivity()])
            .then(([p, a]) => {
                setProfile(p);
                setActivity(a);
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-8 pt-24">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        Welcome back{profile ? `, ${capitalizeFirst(profile.first_name)}` : ''}!
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Your personal dashboard.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={load} className="ml-4 text-sm underline hover:no-underline">Retry</button>
                    </div>
                )}

                {/* Quick actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <button
                        onClick={() => navigate('/my-profile')}
                        className="flex items-center gap-3 p-5 bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-md transition-shadow text-left"
                    >
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">My Profile</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Edit your details</p>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/browse')}
                        className="flex items-center gap-3 p-5 bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-md transition-shadow text-left"
                    >
                        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                            <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">Browse Stars</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Find your favourite</p>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-3 p-5 bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-md transition-shadow text-left"
                    >
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">Home</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Back to Clippixx</p>
                        </div>
                    </button>
                </div>

                {/* Activity summary */}
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <ClipboardList className="w-5 h-5 text-gray-500" />
                        <h2 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-12 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : activity && (
                        activity.applications.length === 0 &&
                        activity.suggestions.length === 0 &&
                        activity.feedback.length === 0
                    ) ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                            No activity yet. Browse stars or suggest a new one!
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {activity?.applications.slice(0, 3).map((a) => (
                                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-700">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        Application: <span className="font-medium">{a.full_name}</span>
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 capitalize">
                                        {a.status}
                                    </span>
                                </div>
                            ))}
                            {activity?.suggestions.slice(0, 3).map((s) => (
                                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-700">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        Suggestion: <span className="font-medium">{s.celebrity_name}</span>
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 capitalize">
                                        {s.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
