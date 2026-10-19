import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  agentRules: false,
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "172.22.4.171",
    "192.168.56.1",        // your LAN IP
    "*.local-origin.dev",
    "*.tunnel.example.com"

  ],
};

initOpenNextCloudflareForDev();

export default nextConfig;
