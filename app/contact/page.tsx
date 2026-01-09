import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Mail, Twitter, MessageSquare } from 'lucide-react'

export const metadata = {
    title: 'Contact Us | EdgePannel',
    description: 'Get in touch with the EdgePannel team.',
}

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-black text-white py-20 px-6 sm:px-12 lg:px-24 font-mono">
            <div className="max-w-4xl mx-auto">
                <div className="mb-12">
                    <Link href="/">
                        <Button variant="ghost" className="gap-2 -ml-4 text-white/60 hover:text-[#00ff7f] hover:bg-white/5">
                            <ChevronLeft className="h-4 w-4" />
                            Back to EdgePannel
                        </Button>
                    </Link>
                    <h1 className="text-4xl sm:text-6xl font-black mt-8 mb-4 tracking-tighter">CONTACT_US</h1>
                    <p className="text-white/40 uppercase tracking-widest text-xs">Establish communication channel</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    <div className="border border-white/10 bg-white/5 p-8 hover:border-[#00ff7f]/50 transition-colors group">
                        <Mail className="h-8 w-8 text-[#00ff7f] mb-6" />
                        <h3 className="text-xl font-bold mb-2">Email</h3>
                        <p className="text-white/50 text-sm mb-6">For support, partnerships, or data inquiries.</p>
                        <a href="mailto:semirkabir@gmail.com" className="text-[#00ff7f] hover:underline block font-bold">
                            semirkabir@gmail.com
                        </a>
                    </div>

                    <div className="border border-white/10 bg-white/5 p-8 hover:border-[#00ff7f]/50 transition-colors group">
                        <Twitter className="h-8 w-8 text-[#00ff7f] mb-6" />
                        <h3 className="text-xl font-bold mb-2">Social</h3>
                        <p className="text-white/50 text-sm mb-6">Follow us for updates and live market alerts.</p>
                        <a href="https://twitter.com/edgepannel" target="_blank" rel="noopener noreferrer" className="text-[#00ff7f] hover:underline block font-bold">
                            @edgepannel
                        </a>
                    </div>
                </div>

                <div className="border-2 border-white/10 bg-black p-12 relative overflow-hidden">
                    {/* Diagonal accent */}
                    <div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-[#00ff7f]/20 -translate-y-12 translate-x-12" />

                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <MessageSquare className="h-6 w-6 text-[#00ff7f]" />
                        SYSTEM_STATUS
                    </h2>
                    <div className="space-y-4 text-sm text-white/60">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span>SUPPORT_RESPONSE_TIME</span>
                            <span className="text-[#00ff7f] font-bold">&lt; 24H</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span>ACTIVE_MONITORING</span>
                            <span className="text-[#00ff7f] font-bold">ENABLED</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span>OPERATIONAL_STATUS</span>
                            <span className="text-[#00ff7f] font-bold">OPTIMAL</span>
                        </div>
                    </div>
                </div>

                <div className="mt-20 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/40">
                    <p>© 2026 EdgePannel. All systems operational.</p>
                    <div className="flex gap-6">
                        <Link href="/privacy" className="hover:text-[#00ff7f] transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-[#00ff7f] transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
