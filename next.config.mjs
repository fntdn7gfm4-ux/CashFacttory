/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  turbopack: { root: process.cwd() }
};

export default nextConfig;
