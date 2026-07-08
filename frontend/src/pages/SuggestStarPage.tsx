import { useNavigate } from 'react-router-dom';
import SuggestStarForm from "@/features/suggest-star/components/SuggestStarForm";

/**
 * Full-page wrapper for the Suggest a Star form (URL: /suggeststars).
 * The form renders as a full-screen overlay; closing returns to the previous page.
 */
export default function SuggestStarPage() {
    const navigate = useNavigate();
    return <SuggestStarForm isOpen onClose={() => navigate(-1)} />;
}
