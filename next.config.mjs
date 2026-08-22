import createNextIntlPlugin from 'next-intl/plugin';

// GYM-29: no locale-prefixed routing (Section 5 of the revamp plan) — this
// just wires next-intl's build-time message bundling into next.config, the
// actual locale resolution lives in i18n/request.ts (cookie/header-based).
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/yuhonas/free-exercise-db/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
