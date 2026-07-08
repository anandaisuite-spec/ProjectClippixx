import PolicyPage from './PolicyPage';
import { POLICY_TITLES, RefundContent } from './policyContent';

export default function RefundPage() {
    return (
        <PolicyPage title={POLICY_TITLES.refunds}>
            <RefundContent />
        </PolicyPage>
    );
}
