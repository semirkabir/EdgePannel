export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // SessionProvider is now in the root layout's Providers component
  return <>{children}</>
}


