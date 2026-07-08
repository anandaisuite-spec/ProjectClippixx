import { Component, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

type Props = {
    children: ReactNode;
    fallback?: ReactNode;
};

type State = {
    error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            if (this.props.fallback) return this.props.fallback;
            // On an uncaught render error, send the user home — user can retry from there.
            return <Navigate to="/" replace />;
        }

        return this.props.children;
    }
}
