import type { Metadata, Viewport } from 'next'
import { Providers } from '@/lib/providers'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
}

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
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased overflow-x-hidden">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
