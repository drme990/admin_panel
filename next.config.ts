import type { NextConfig } from 'next';
import type { RemotePattern } from 'next/dist/shared/lib/image-config';
import createNextIntlPlugin from 'next-intl/plugin';

const nextIntlConfig = createNextIntlPlugin();

const remotePatterns: RemotePattern[] = [
  { hostname: 'placehold.co' },
  {
    protocol: 'https',
    hostname: 'res.cloudinary.com',
    pathname: '/**',
  },
  {
    protocol: 'https',
    hostname: 'storage.manasik.net',
    pathname: '/**',
  },
];

if (process.env.R2_PUBLIC_URL) {
  try {
    const url = new URL(process.env.R2_PUBLIC_URL);
    remotePatterns.push({
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      pathname: '/**',
    });
  } catch {
    // Ignore malformed URLs and keep the app buildable.
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: '60mb',
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/admin/:path*`,
      },
    ];
  },
};

export default nextIntlConfig(nextConfig);
