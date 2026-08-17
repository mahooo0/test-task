import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // The Data Room API (NestJS) is a separate service; the browser talks to it
  // directly with a Clerk bearer token, so nothing is proxied here.
};

// Cookie-based locale (no i18n routing) — the request config lives at src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
