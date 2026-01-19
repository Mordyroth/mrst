import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * ============================================================================
   * WARNING: basePath AFFECTS ALL ROUTING - READ BEFORE MODIFYING ANY LINKS
   * ============================================================================
   *
   * With basePath: '/mrst', Next.js AUTOMATICALLY prepends /mrst to:
   *   - <Link href="..."> components
   *   - useRouter().push() calls
   *   - Any Next.js navigation
   *
   * CORRECT:  <Link href="/vehicles">        → renders as /mrst/vehicles
   * WRONG:    <Link href="/mrst/vehicles">   → renders as /mrst/mrst/vehicles = 404!
   *
   * Things that DO need /mrst prefix manually:
   *   - <img src="/mrst/images/...">     (static assets)
   *   - <a href="/mrst/...">             (plain HTML anchors)
   *   - window.location.href = '/mrst/...'
   *
   * THIS HAS CAUSED MULTIPLE PRODUCTION 404 OUTAGES.
   * Run `./scripts/check-link-paths.sh` before committing frontend changes.
   * A pre-commit hook also runs this check automatically.
   * ============================================================================
   */
  basePath: '/mrst',
  transpilePackages: ['@mrst/ui', '@mrst/shared'],
}

export default nextConfig
