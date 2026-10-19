/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '6mb' } }, // comprobantes de transferencia
};
export default nextConfig;
