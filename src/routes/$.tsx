import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const LegacyApp = lazy(() => import("../legacy/App"));

// Catch-all: the GoPalengke app handles its own client-side routing
// (/s/:slug, /u/:slug, /legal/*, /tutorial, /affiliate/*, role dashboards).
export const Route = createFileRoute("/$")({
  ssr: false,
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
