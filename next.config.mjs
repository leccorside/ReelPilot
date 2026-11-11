/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server mode: "standalone" bundles a minimal server for the production Docker image.
  output: "standalone",
  trailingSlash: true,
  // The trailing-slash redirect is done by src/middleware.ts for pages only. Next's own 308 redirect
  // also hit /api/auth/* calls made by next-auth/react (no trailing slash) and the browser dropped the
  // POST body on the way, losing the CSRF token (sign-out and session update failed).
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  experimental: {
    // Runs src/instrumentation.ts on server start (validates environment variables).
    instrumentationHook: true,
    // Native module (argon2 password hashing): loaded from node_modules, never bundled.
    serverComponentsExternalPackages: ["@node-rs/argon2"],
  },
};
export default nextConfig;
