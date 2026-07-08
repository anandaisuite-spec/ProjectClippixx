import { Section, Para, NumberedList } from './PolicyPage';

/**
 * Shared policy bodies — single source of truth, rendered by BOTH the full
 * pages (TermsPage/PrivacyPage/RefundPage) and the footer PolicyModal.
 */

export const POLICY_TITLES = {
    terms: 'Terms & Conditions',
    privacy: 'Privacy Policy',
    refunds: 'Refund and Cancellation Policy',
} as const;

export type PolicyKey = keyof typeof POLICY_TITLES;

export function TermsContent() {
    return (
        <>
            <Para>
                This document is an electronic record in terms of Information Technology Act, 2000 and
                rules thereunder as applicable.
            </Para>
            <Para>
                This document is published in accordance with Rule 3(1) of the Information Technology
                (Intermediaries guidelines) Rules, 2011 for access or usage of https://clipixx.com/ ('Platform').
            </Para>
            <Para>
                The Platform is owned by Clippixx, registered at A-410 Soparnika Sanvi Phase 2,
                Vijaya Nagar, 5th Cross, Whitefield, Bangalore North, 560066.
            </Para>
            <Para>
                Your use of the Platform is governed by these Terms of Use. By using the Platform, you
                are contracting with the Platform Owner and these terms constitute your binding obligations.
            </Para>

            <Section heading="Terms of Use:">
                <NumberedList
                    items={[
                        'You agree to provide true, accurate and complete information during registration and are responsible for all acts done through your registered account.',
                        'We do not provide any warranty as to the accuracy, timeliness, or completeness of information on this Platform.',
                        'Your use of our Services is solely at your own risk.',
                        'The contents of the Platform are proprietary and licensed to us. You will not claim any intellectual property rights in its contents.',
                        'Unauthorized use of the Platform may lead to action against you as per these Terms and/or applicable laws.',
                        'You agree to pay the charges associated with availing the Services.',
                        'You agree not to use the Platform for any unlawful or illegal purpose.',
                        'The Platform may contain links to third-party websites governed by their own terms and policies.',
                        'Upon initiating a transaction, you are entering into a legally binding contract with the Platform Owner.',
                        'You shall indemnify and hold harmless Clipixx, its affiliates, officers, directors, agents, and employees from any claim or demand arising out of your breach of these Terms.',
                        'Neither party shall be liable for failure to perform due to a force majeure event.',
                        'These Terms shall be governed by the laws of India.',
                        'All disputes shall be subject to the exclusive jurisdiction of the courts in India.',
                        'All concerns must be communicated using the contact information provided on this website.',
                    ]}
                />
            </Section>
        </>
    );
}

export function PrivacyContent() {
    return (
        <>
            <Section heading="Introduction">
                <Para>
                    This Privacy Policy describes how Clipixx and its affiliates collect, use, share,
                    protect or otherwise process your personal data through https://clipixx.com/. By
                    visiting this Platform or providing your information, you agree to be bound by this
                    Privacy Policy and the laws of India.
                </Para>
            </Section>

            <Section heading="Collection">
                <Para>
                    We collect personal data when you use our Platform, including name, date of birth,
                    address, telephone/mobile number, email ID, and proof of identity or address.
                    Sensitive personal data such as bank account, credit/debit card information may be
                    collected with your consent. We may also track your behaviour, preferences, and
                    transaction information on the Platform.
                </Para>
            </Section>

            <Section heading="Usage">
                <Para>
                    We use personal data to provide services you request, handle orders, enhance customer
                    experience, resolve disputes, inform you about offers and updates, customise your
                    experience, detect fraud, enforce our terms, and conduct marketing research.
                </Para>
            </Section>

            <Section heading="Sharing">
                <Para>
                    We may share your personal data with group entities, affiliates, sellers, business
                    partners, logistics partners, and third-party service providers. We may disclose
                    personal data to government agencies or law enforcement if required by law.
                </Para>
            </Section>

            <Section heading="Cookies" id="cookies">
                <Para>
                    We and our partners use cookies and similar tracking technologies to track your
                    behaviour, remember your preferences, and customise your experience on the Platform.
                    You can manage cookies through your browser settings; disabling them may affect some
                    features of the Platform.
                </Para>
            </Section>

            <Section heading="Security Precautions">
                <Para>
                    We adopt reasonable security practices to protect your personal data from unauthorised
                    access. However, transmission of information over the internet cannot always be
                    guaranteed as completely secure. Users are responsible for protecting their login and
                    password records.
                </Para>
            </Section>

            <Section heading="Data Deletion and Retention">
                <Para>
                    You may delete your account by visiting your profile and settings. We retain your
                    personal data for no longer than required for the purpose it was collected, or as
                    required under applicable law.
                </Para>
            </Section>

            <Section heading="Your Rights">
                <Para>
                    You may access, rectify, and update your personal data directly through the Platform.
                </Para>
            </Section>

            <Section heading="Consent">
                <Para>
                    By visiting our Platform or providing your information, you consent to the collection,
                    use, storage and processing of your information in accordance with this Privacy Policy.
                </Para>
            </Section>

            <Section heading="Changes to this Privacy Policy">
                <Para>
                    We may update this Privacy Policy periodically. We will notify you about significant
                    changes as required under applicable laws.
                </Para>
            </Section>

            <Section heading="Grievance Officer">
                <Para>
                    For any privacy concerns, please contact us using the contact information provided on
                    this website.
                </Para>
                <Para>Phone: Monday - Friday (9:00 - 18:00)</Para>
            </Section>
        </>
    );
}

export function RefundContent() {
    return (
        <>
            <Para>
                This policy outlines how you can cancel or seek a refund for a product/service purchased
                through the Platform.
            </Para>

            <NumberedList
                items={[
                    'Cancellations will only be considered if the request is made within 1 day of placing the order. Cancellation requests may not be entertained if the order has already been communicated to the seller and shipping has been initiated.',
                    'Clipixx does not accept cancellation requests for perishable items. However, a refund or replacement can be made if the quality of the product delivered is not good.',
                    'In case of damaged or defective items, please report to our customer service team within 1 day of receipt.',
                    'If the product received is not as shown on the site, bring it to the notice of our customer service within 1 day of receiving the product.',
                    "For products with a manufacturer's warranty, please refer the issue to the manufacturer.",
                    'Approved refunds will be processed within 7 days.',
                ]}
            />
        </>
    );
}

export const POLICY_CONTENT: Record<PolicyKey, () => JSX.Element> = {
    terms: TermsContent,
    privacy: PrivacyContent,
    refunds: RefundContent,
};
