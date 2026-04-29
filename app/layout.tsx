import type { Metadata } from 'next'
import ErrorToast from '@/components/ErrorToast'
import './globals.css'

export const metadata: Metadata = {
  title: 'NotebookLM OSS',
  description: 'Open-source AI notebook powered by OpenRAG',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <ErrorToast />
      </body>
    </html>
  )
}