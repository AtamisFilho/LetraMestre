import type { NextConfig } from "next";

/**
 * Next.js configuration for LetraMestre.
 *
 * Notes:
 *  - `typescript.ignoreBuildErrors` is OFF so the build catches type errors.
 *  - `reactStrictMode` is ON.
 *  - `poweredByHeader` is OFF (don't advertise the framework).
 *  - Security headers (CSP, X-Frame-Options, HSTS, etc.) are applied to
 *    every route. In dev we relax `connect-src` to allow http/ws against
 *    local services; in prod we tighten it.
 *  - Next 16 removed the `eslint` config key entirely; do NOT re-add it.
 */
const isDev = process.env.NODE_ENV !== "production";

const csp = isDev
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: http: https:",
      "frame-ancestors 'none'",
    ].join("; ")
  : [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' wss:",
      "frame-ancestors 'none'",
    ].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Do not silently swallow type errors during `next build`.
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
