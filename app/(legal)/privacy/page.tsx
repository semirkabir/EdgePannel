import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ShieldCheck, Eye, Database, Lock } from 'lucide-react'

export const metadata = {
    title: 'Privacy Policy | EdgePannel',
    description: 'Privacy Policy for EdgePannel - Prediction Markets Visualized.',
}

export default function PrivacyPolicy() {
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
                    <h1 className="text-4xl sm:text-5xl font-bold mt-8 mb-4 tracking-tight">Privacy Policy</h1>
                    <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
                </div>

                <div className="prose prose-invert max-w-none space-y-12 text-lg leading-relaxed">
                    <p className="text-muted-foreground">
                        At EdgePannel (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our Platform.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 not-prose">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <Eye className="h-8 w-8 text-primary mb-4" />
                            <h3 className="text-xl font-semibold mb-2 text-foreground">Data Collection</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                We only collect data necessary to provide and improve our visualization services.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <Lock className="h-8 w-8 text-primary mb-4" />
                            <h3 className="text-xl font-semibold mb-2 text-foreground">Data Security</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Your credentials and API keys are encrypted at rest using industry-standard protocols.
                            </p>
                        </div>
                    </div>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary flex items-center gap-3">
                            <Database className="h-6 w-6" /> 1. Information We Collect
                        </h2>
                        <div className="space-y-4">
                            <h3 className="text-xl font-medium text-foreground">Account Information</h3>
                            <p className="text-muted-foreground">
                                When you sign in using Google or X (Twitter) OAuth, we receive information such as your name, email address, and profile picture. We use this to personalize your experience and manage your account.
                            </p>
                            <h3 className="text-xl font-medium text-foreground">Trading Credentials</h3>
                            <p className="text-muted-foreground">
                                If you choose to link your Polymarket or Kalshi API keys, these are encrypted and stored securely to enable trading features through the EdgePannel interface.
                            </p>
                            <h3 className="text-xl font-medium text-foreground">Usage Data</h3>
                            <p className="text-muted-foreground">
                                We may collect anonymous analytics data regarding how you interact with the globe and market data to help us improve the Platform&apos;s performance.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6" /> 2. How We Use Your Information
                        </h2>
                        <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
                            <li>To provide, maintain, and improve the Platform&apos;s visualization and trading tools.</li>
                            <li>To protect against unauthorized access and ensure account security.</li>
                            <li>To communicate with you about updates, security alerts, and support requests.</li>
                            <li>To process and execute trades via linked third-party APIs as requested by you.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary flex items-center gap-3">
                            <Eye className="h-6 w-6" /> 3. Data Disclosure
                        </h2>
                        <p className="text-muted-foreground">
                            We do not sell your personal data to third parties. We only share information when:
                        </p>
                        <ul className="list-disc pl-6 space-y-3 text-muted-foreground mt-4">
                            <li>It is required to execute trades with your linked accounts (e.g., sending orders to Polymarket or Kalshi).</li>
                            <li>Required by law or to protect our legal rights.</li>
                            <li>With your explicit consent.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary flex items-center gap-3">
                            <Database className="h-6 w-6" /> 4. Data Retention
                        </h2>
                        <p className="text-muted-foreground">
                            We retain your account information and encrypted credentials only as long as your account is active. You may request account deletion at any time by contacting us, which will result in the immediate removal of all your stored data.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold border-b border-primary/20 pb-2 mb-6 text-primary flex items-center gap-3">
                            <Lock className="h-6 w-6" /> 5. Your Rights
                        </h2>
                        <p className="text-muted-foreground">
                            Depending on your location, you may have rights regarding your personal data, including the right to access, correct, or delete your information. Contact us at <span className="text-foreground font-medium">semirkabir@gmail.com</span> for any data-related requests.
                        </p>
                    </section>
                </div>

                <div className="mt-20 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                    <p>© 2026 EdgePannel. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link href="/privacy" className="hover:text-primary transition-colors font-medium text-foreground">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
