import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export const metadata = {
    title: 'Terms of Service | EdgePannel',
    description: 'Terms of Service for EdgePannel - Prediction Markets Visualized.',
}

export default function TermsOfService() {
    const lastUpdated = 'January 8, 2026'

    return (
        <div className="min-h-screen bg-background text-foreground py-20 px-6 sm:px-12 lg:px-24">
            <div className="max-w-4xl mx-auto">
                <div className="mb-12">
                    <Link href="/">
                        <Button variant="ghost" className="gap-2 -ml-4 hover:bg-primary/10">
                            <ChevronLeft className="h-4 w-4" />
                            Back to EdgePannel
                        </Button>
                    </Link>
                    <h1 className="text-4xl sm:text-5xl font-bold mt-8 mb-4 tracking-tight">Terms of Service</h1>
                    <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
                </div>

                <div className="prose prose-invert max-w-none space-y-12 text-lg leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary">1. Agreement to Terms</h2>
                        <p className="text-muted-foreground">
                            By accessing or using EdgePannel (the &quot;Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform. EdgePannel provides visualization and tracking tools for prediction markets hosted on third-party platforms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary">2. No Financial Advice</h2>
                        <div className="bg-primary/5 border-l-4 border-primary p-6 rounded-r-lg">
                            <p className="font-medium text-foreground mb-0">
                                DISCLAIMER: EdgePannel is an informational and visualization tool only. Nothing on this Platform constitutes financial, legal, or investment advice.
                            </p>
                            <p className="text-muted-foreground mt-4 italic">
                                All market data, probabilities, and trends are for educational and entertainment purposes. You are solely responsible for your own trading decisions and should consult with a professional advisor before making any financial commitments.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary">3. Third-Party Services</h2>
                        <p className="text-muted-foreground">
                            EdgePannel integrates data from Polymarket and Kalshi. We are not affiliated with, endorsed by, or in partnership with these entities. Your use of these third-party platforms is governed by their respective terms of service. We do not guarantee the accuracy, completeness, or timeliness of data provided by these sources.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary">4. User Accounts</h2>
                        <p className="text-muted-foreground mb-4">
                            To access certain features, you may be required to register for an account using OAuth (Google or X). You are responsible for:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Maintaining the confidentiality of your account credentials.</li>
                            <li>All activities that occur under your account.</li>
                            <li>Ensuring your use of the Platform complies with local laws in your jurisdiction.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary">5. Intellectual Property</h2>
                        <p className="text-muted-foreground">
                            The visual designs, 3D globe implementation, branding, and code of EdgePannel are the intellectual property of EdgePannel. You may not reproduce, distribute, or create derivative works from our Platform without express written permission.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary">6. Limitation of Liability</h2>
                        <p className="text-muted-foreground">
                            To the maximum extent permitted by law, EdgePannel and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary">7. Changes to Terms</h2>
                        <p className="text-muted-foreground">
                            We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new terms on this page and updating the &quot;Last updated&quot; date.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary">8. Contact Information</h2>
                        <p className="text-muted-foreground">
                            If you have any questions about these Terms, please contact us at <span className="text-foreground font-medium">semirkabir@gmail.com</span>.
                        </p>
                    </section>
                </div>

                <div className="mt-20 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                    <p>© 2026 EdgePannel. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-primary transition-colors font-medium text-foreground">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
