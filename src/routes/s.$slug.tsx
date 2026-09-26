import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getStoreSharePreview } from "@/lib/store-share.functions";

const LegacyApp = lazy(() => import("../legacy/App"));
const PUBLIC_ORIGIN = "https://gopalengke.net";

export const Route = createFileRoute("/s/$slug")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>) => ({
    p: typeof search["p"] === "string" ? search["p"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ productId: search.p }),
  loader: ({ params, deps }) =>
    getStoreSharePreview({
      data: { slug: params.slug, productId: deps.productId },
    }),
  head: ({ params, loaderData, match }) => {
    const productId = match.search.p;
    const query = productId ? `?p=${encodeURIComponent(productId)}` : "";
    const url = `${PUBLIC_ORIGIN}/s/${encodeURIComponent(params.slug)}${query}`;
    const title = loaderData?.title || "Tindahan sa GoPalengke";
    const description =
      loaderData?.description ||
      "Tingnan ang tindahan at mga sariwang paninda nito sa GoPalengke.";
    const image = loaderData?.image;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: productId ? "product" : "website" },
        { property: "og:url", content: url },
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:alt", content: loaderData?.productName || loaderData?.storeName || title },
              { name: "twitter:image", content: image },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: StoreRoute,
});

function StoreRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      }
    >
      <LegacyApp />
    </Suspense>
  );
}