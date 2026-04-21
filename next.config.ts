import type { NextConfig } from 'next';
import withPWA from '@ducanh2912/next-pwa';

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA({
  dest: 'public',
  register: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    // Cache pages and static assets for offline use
    runtimeCaching: [
      {
        // Cache Google Fonts
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        // Cache all dashboard pages — network first, fallback to cache
        urlPattern: /^https?:\/\/[^/]+\/(?:dashboard|clients|invoices|quotes|projects|leads|payments|settings).*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
          networkTimeoutSeconds: 10,
        },
      },
      {
        // Cache static assets (JS, CSS, images) — stale while revalidate
        urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-assets',
          expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
} as Parameters<typeof withPWA>[0])(nextConfig);
