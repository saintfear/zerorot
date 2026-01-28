import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ZeroRot - AI-Powered Content Discovery',
  description: 'Discover personalized Instagram content delivered to your inbox daily',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
