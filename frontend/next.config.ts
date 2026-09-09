import path from "node:path"

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /*
   * The repo root, not this directory.
   *
   * Turbopack refuses to resolve files outside its root, and it picks that
   * root by finding the nearest lockfile — which is `frontend/package-lock.json`.
   * `@stayora/shared` lives at `E:\Hotel\shared`, one level up, so it was
   * outside and the build failed the moment a VALUE was imported from it
   * rather than only a type. Types are erased before Turbopack ever sees them,
   * which is why this only appeared when the auth forms started using
   * `loginSchema` itself.
   *
   * Widening to the repo root puts both workspaces inside. It costs a little
   * more filesystem watching in development, which is the documented trade.
   */
  turbopack: {
    root: path.join(__dirname, ".."),
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "loremflickr.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
}

export default nextConfig
