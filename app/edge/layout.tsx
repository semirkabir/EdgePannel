import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Command Center',
    description: 'Interactive visualization and intelligent filtering for prediction markets.',
}

export default function EdgeLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
