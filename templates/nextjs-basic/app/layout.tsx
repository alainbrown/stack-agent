import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '__PROJECT_NAME__',
  description: '__DESCRIPTION__',
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
