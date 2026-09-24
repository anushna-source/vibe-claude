import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @inventory/shared ships as workspace source-built ESM; let Next compile it.
  transpilePackages: ['@inventory/shared'],
  poweredByHeader: false,
};

export default nextConfig;
