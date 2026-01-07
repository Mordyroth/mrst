import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MRST - Vehicle Rental Management',
  description: 'Multi-tenant SaaS for vehicle rental and collision businesses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
