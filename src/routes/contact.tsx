import { createFileRoute } from "@tanstack/react-router";
import { lazyWithReload } from "../lib/chunk-reload";
import { lazy, Suspense } from "react";

const LegacyApp = lazy(lazyWithReload(() => import("../legacy/App")));

export const Route = createFileRoute("/contact")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contact Us & Account Deletion — GoPalengke" },
      { name: "description", content: "Makipag-ugnayan sa GoPalengke o mag-request ng pagbura ng iyong account at data." },
      { property: "og:title", content: "Contact Us & Account Deletion — GoPalengke" },
      { property: "og:description", content: "Makipag-ugnayan sa GoPalengke o mag-request ng pagbura ng iyong account at data." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://gopalengke.net/contact" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://gopalengke.net/contact" }],
  }),
  component: () => (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LegacyApp />
    </Suspense>
  ),
});
