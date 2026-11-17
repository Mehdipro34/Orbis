import type { NextConfig } from "next";

const supabaseHost = "wdwvcvpgovvkoodozbxf.supabase.co";
const development = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://" + supabaseHost,
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'" + (development ? " 'unsafe-eval'" : ""),
  "connect-src 'self' https://" + supabaseHost + (development ? " ws://localhost:* http://localhost:*" : ""),
  "font-src 'self' data:",
  "upgrade-insecure-requests"
].join("; ");

const securityHeaders = [
  {key:"Content-Security-Policy",value:contentSecurityPolicy},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"X-Frame-Options",value:"DENY"},
  {key:"X-DNS-Prefetch-Control",value:"on"},
  {key:"Strict-Transport-Security",value:"max-age=63072000; includeSubDomains; preload"},
  {key:"Permissions-Policy",value:"camera=(self), microphone=(self), geolocation=()"}
];

const nextConfig: NextConfig = {
  poweredByHeader:false,
  reactStrictMode:true,
  images:{remotePatterns:[{protocol:"https",hostname:supabaseHost,pathname:"/storage/v1/object/public/**"}]},
  async headers(){return [{source:"/:path*",headers:securityHeaders}];}
};

export default nextConfig;