/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server mode: "standalone" bundles a minimal server for the production Docker image.
  output: "standalone",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    // Runs src/instrumentation.ts on server start (validates environment variables).
    instrumentationHook: true,
  },
};
export default nextConfig;
