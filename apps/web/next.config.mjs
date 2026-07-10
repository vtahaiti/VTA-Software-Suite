/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@vta/ui"],
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
