import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const LegacyApp = lazy(() => import("../legacy/App"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "GoPalengke — Online Wet Market Platform" },
      {
        name: "description",
        content:
          "GoPalengke — bumili ng sariwang gulay, isda, karne, at prutas online mula sa palengke. Mabilis na delivery sa iyong bahay.",
      },
      { property: "og:title", content: "GoPalengke — Online Wet Market Platform" },
      {
        property: "og:description",
        content:
          "Bumili ng sariwang gulay, isda, karne, at prutas online mula sa palengke. Mabilis na delivery sa iyong bahay.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://gopalengke.net/" },
      { property: "og:image", content: "https://gopalengke.net/images/gopalengke-share.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://gopalengke.net/images/gopalengke-share.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: () => (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      }
    >
      <LegacyApp />
    </Suspense>
  ),
});
