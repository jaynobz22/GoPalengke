import { createFileRoute } from "@tanstack/react-router";
import { lazyWithReload } from "../lib/chunk-reload";
import { lazy, Suspense } from "react";

const LegacyApp = lazy(lazyWithReload(() => import("../legacy/App")));

// Catch-all: the GoPalengke app handles its own client-side routing
// (/s/:slug, /u/:slug, /legal/*, /tutorial, /affiliate/*, role dashboards).
export const Route = createFileRoute("/$")({
  ssr: false,
  head: () => ({ meta: [
    { title: "GoPalengke — Account at Komunidad" },
    { name: "description", content: "Buksan ang iyong GoPalengke account, mga gabay, at komunidad ng online palengke." },
    { property: "og:title", content: "GoPalengke — Account at Komunidad" },
    { property: "og:description", content: "Mga account, gabay, at komunidad ng GoPalengke online palengke." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
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
