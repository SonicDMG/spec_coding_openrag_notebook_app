import type { Metadata } from 'next'
import ErrorToast from '@/components/ErrorToast'
import { ThemeProvider, themeScript } from '@/components/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'NotebookLM OSS',
  description: 'Open-source AI notebook powered by OpenRAG',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider>
          {children}
          <ErrorToast />
        </ThemeProvider>
      </body>
    </html>
  )
}