import PolicyPage from './PolicyPage';
import { POLICY_TITLES, TermsContent } from './policyContent';

export default function TermsPage() {
    return (
        <PolicyPage title={POLICY_TITLES.terms}>
            <TermsContent />
        </PolicyPage>
    );
}
