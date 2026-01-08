import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@mrst/ui', '@mrst/shared'],
  basePath: '/mrst',
  assetPrefix: '/mrst',
}

export default nextConfig
