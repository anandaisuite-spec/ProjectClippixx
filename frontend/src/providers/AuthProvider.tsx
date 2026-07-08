import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    auth,
    googleProvider,
    facebookProvider,
    microsoftProvider,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    type User,
} from "@/services/firebase";
import { createProfile } from "@/services/api";
import { CREATOR_EMAIL_DOMAIN } from "@/constants/auth";

type SignupSecurity = {
    /** Honeypot field value — humans never fill it; bots do. */
    website?: string;
};

/** Everything needed to write the profile row once email OTP verification succeeds. */
type PendingProfile = {
    fullName: string;
    phone?: string;
    security?: SignupSecurity;
};

type AuthContextType = {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    /**
     * Creates the Firebase account only (email/password) and signs the user in.
     * Does NOT create the DB profile — call finalizeSignup() after email OTP
     * verification succeeds. Splitting these lets the signup UI show a
     * "verify your email" step before the account is fully provisioned.
     */
    createFirebaseAccount: (email: string, password: string) => Promise<void>;
    /** Writes the DB profile row for the currently signed-in Firebase user. */
    finalizeSignup: (pending: PendingProfile) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    loginWithFacebook: () => Promise<void>;
    loginWithMicrosoft: () => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

type AuthProviderProps = {
    children: ReactNode;
};

export default function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        // Admin-onboarded creators log in with a bare username (no email). If the
        // entered value has no "@", expand it to the synthetic creator domain so
        // the placeholder domain stays completely invisible to them. Real emails
        // (which already contain "@") are passed through unchanged.
        const identifier = email.includes('@')
            ? email
            : `${email.trim().toLowerCase()}@${CREATOR_EMAIL_DOMAIN}`;
        await signInWithEmailAndPassword(auth, identifier, password);
    };

    // Step 1 of signup: create the Firebase account (this also signs the user
    // in). The DB profile is intentionally NOT created here — the caller shows
    // an email-OTP verification step first and calls finalizeSignup() after.
    const createFirebaseAccount = async (email: string, password: string) => {
        await createUserWithEmailAndPassword(auth, email, password);
    };

    // Step 2 of signup: called after email OTP verification succeeds. Writes
    // the profile row for the now-verified, already-signed-in Firebase user.
    const finalizeSignup = async ({ fullName, phone, security }: PendingProfile) => {
        const [firstName, ...lastParts] = fullName.split(' ');
        const lastName = lastParts.join(' ') || firstName;

        await createProfile({
            account_type: 'fan',
            first_name: firstName,
            last_name: lastName,
            ...(phone ? { phone } : {}),
            ...(security?.website !== undefined ? { website: security.website } : {}),
        });
    };

    const loginWithGoogle = async () => {
        const result = await signInWithPopup(auth, googleProvider);
        const firebaseUser = result.user;

        const displayName = firebaseUser.displayName || firebaseUser.email || 'User';
        const [firstName, ...lastParts] = displayName.split(' ');
        const lastName = lastParts.join(' ') || firstName;

        try {
            await createProfile({
                account_type: 'fan',
                first_name: firstName,
                last_name: lastName,
            });
        } catch (error) {
            // Profile might already exist for returning Google users — that's fine
            console.warn('Profile creation skipped (may already exist):', error);
        }
    };

    const loginWithFacebook = async () => {
        const result = await signInWithPopup(auth, facebookProvider);
        const firebaseUser = result.user;

        const displayName = firebaseUser.displayName || firebaseUser.email || 'User';
        const [firstName, ...lastParts] = displayName.split(' ');
        const lastName = lastParts.join(' ') || firstName;

        try {
            await createProfile({
                account_type: 'fan',
                first_name: firstName,
                last_name: lastName,
            });
        } catch (error) {
            console.warn('Profile creation skipped (may already exist):', error);
        }
    };

    const loginWithMicrosoft = async () => {
        const result = await signInWithPopup(auth, microsoftProvider);
        const firebaseUser = result.user;

        const displayName = firebaseUser.displayName || firebaseUser.email || 'User';
        const [firstName, ...lastParts] = displayName.split(' ');
        const lastName = lastParts.join(' ') || firstName;

        try {
            await createProfile({
                account_type: 'fan',
                first_name: firstName,
                last_name: lastName,
            });
        } catch (error) {
            console.warn('Profile creation skipped (may already exist):', error);
        }
    };

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, createFirebaseAccount, finalizeSignup, loginWithGoogle, loginWithFacebook, loginWithMicrosoft, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
