import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const supabaseOrigin = supabaseUrl?.origin ?? 'https://*.supabase.co';
const isDev = process.env.NODE_ENV !== 'production';

// Next.js injecte des scripts en ligne pour l'hydratation : 'unsafe-inline'
// reste nécessaire sans nonce. Le reste est verrouillé.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}${isDev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Supabase local (CLI, port 54321) sert les images depuis localhost.
    dangerouslyAllowLocalIP: supabaseUrl?.hostname === 'localhost' || supabaseUrl?.hostname === '127.0.0.1',
    remotePatterns: [
      {
        protocol: supabaseUrl?.protocol === 'http:' ? 'http' : 'https',
        hostname: supabaseUrl?.hostname ?? '*.supabase.co',
        ...(supabaseUrl?.port ? { port: supabaseUrl.port } : {}),
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    // Images produits et logo (2 Mo max, validé côté serveur).
    serverActions: { bodySizeLimit: '3mb' },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
