import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Option 1: Using domains (simpler)
    domains: ["res.cloudinary.com"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  
    // Option 2: Using remotePatterns (more flexible - recommended)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        // You can also specify pathname and port if needed
      },
      {
        protocol: 'https',
        hostname: '**', // Allow all domains (use cautiously)
      }
    ],
    
    // Optional: Add other image optimizations
    formats: ['image/webp', 'image/avif'],
  },
  // Other Next.js config options...
};

export default nextConfig;