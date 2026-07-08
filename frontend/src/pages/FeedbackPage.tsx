import { useNavigate } from 'react-router-dom';
import FeedbackForm from "@/features/feedback/components/FeedbackForm";

/**
 * Full-page wrapper for the Feedback form (URL: /feedback).
 * The form renders as a full-screen overlay; closing returns to the previous page.
 */
export default function FeedbackPage() {
    const navigate = useNavigate();
    return <FeedbackForm isOpen onClose={() => navigate(-1)} />;
}
