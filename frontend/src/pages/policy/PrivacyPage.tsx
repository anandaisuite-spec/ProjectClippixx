import PolicyPage from './PolicyPage';
import { POLICY_TITLES, PrivacyContent } from './policyContent';

export default function PrivacyPage() {
    return (
        <PolicyPage title={POLICY_TITLES.privacy}>
            <PrivacyContent />
        </PolicyPage>
    );
}
