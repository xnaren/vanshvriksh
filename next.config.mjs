/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Allow Server Actions when the app is reached through Codespaces port
      // forwarding (*.app.github.dev) or local forwards (localhost). Without
      // this, Next.js aborts actions with "Invalid Server Actions request"
      // whenever the browser origin and the forwarded host differ — which is
      // normal behind the Codespaces proxy. Harmless in production: the
      // same origin is always allowed; these entries only matter for dev URLs.
      allowedOrigins: ["*.app.github.dev", "localhost:3000", "127.0.0.1:3000"],
    },
  },
};

export default nextConfig;
