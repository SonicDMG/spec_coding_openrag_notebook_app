import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // Increase body size limit for PDF uploads (default is 1MB)
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  // Prevent hot reload during file uploads in development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules', '**/.next', '**/notebooklm.db*'],
      }
    }
    return config
  },
}

export default nextConfig