import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server for the Docker image.
  output: 'standalone',
};

export default nextConfig;
