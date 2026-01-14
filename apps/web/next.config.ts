import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: '/mrst',
  transpilePackages: ['@mrst/ui', '@mrst/shared'],
}

export default nextConfig
