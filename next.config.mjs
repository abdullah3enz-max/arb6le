/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundles a minimal self-contained server (node_modules pruned to only what's traced as
  // actually used) into .next/standalone — this is what a Dockerfile can COPY and run with
  // plain `node server.js`, no npm install needed inside the final image.
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  }
};

export default nextConfig;
