import { redirect } from 'next/navigation'
import { getAdminEmail } from '@/lib/auth/admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminEmail = await getAdminEmail()

  if (!adminEmail) {
    // Check if ADMIN_EMAIL is configured
    if (!process.env.ADMIN_EMAIL) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-4">Configuration Error</h1>
            <p className="text-gray-400">
              ADMIN_EMAIL environment variable is not set. Please configure it in your .env file.
            </p>
          </div>
        </div>
      )
    }

    // User is not authorized
    redirect('/dashboard?error=unauthorized')
  }

  return <>{children}</>
}
