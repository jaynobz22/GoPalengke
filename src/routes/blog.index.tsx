import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { listBlogPosts } from "@/lib/blog.functions";
import { BLOG_CATEGORIES } from "@/lib/blog";

const URL = "https://gopalengke.net/blog";
const TITLE = "GoPalengke Blog — Tutorials, Updates at Gabay sa Online Palengke";
const DESC = "Mga article, tutorial at balita tungkol sa GoPalengke: online palengke sa Pilipinas para sa vendors, riders at mamimili.";

export const Route = createFileRoute("/blog/")({
  loader: () => listBlogPosts(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const posts = Route.useLoaderData();
  const [cat, setCat] = useState<string>("Lahat");
  const shown = cat === "Lahat" ? posts : posts.filter((p) => p.category === cat);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center gap-2 font-bold">
            <img src="/images/Copilot_20260907_183703.jpg" alt="GoPalengke" className="h-8 w-8 rounded-lg object-cover" />
            GoPalengke <span className="text-primary">Blog</span>
          </a>
          <a href="/" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Mamalengke</a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-extrabold md:text-4xl">GoPalengke Blog</h1>
        <p className="mt-2 text-muted-foreground">Tutorials, updates at mga kwento mula sa online palengke ng bayan.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["Lahat", ...BLOG_CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-sm ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{c}</button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="mt-12 text-center text-muted-foreground">Wala pang article dito. Balikan mo kami maya-maya!</p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
                {p.coverImage ? <img src={p.coverImage} alt={p.title} loading="lazy" className="aspect-[1200/630] w-full object-cover" /> : <div className="aspect-[1200/630] w-full bg-secondary" />}
                <div className="p-4">
                  <span className="text-xs font-semibold uppercase text-primary">{p.category}</span>
                  <h2 className="mt-1 line-clamp-2 text-lg font-bold group-hover:text-primary">{p.title}</h2>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{p.publishedAt && new Date(p.publishedAt).toLocaleDateString("fil-PH", { dateStyle: "medium" })}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
