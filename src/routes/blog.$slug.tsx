import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getBlogPost } from "@/lib/blog.functions";
import { readingMinutes, renderMarkdown, seoDescOf, seoTitleOf } from "@/lib/blog";

const ORIGIN = "https://gopalengke.net";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await getBlogPost({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return post;
  },
  head: ({ params, loaderData: p }) => {
    const url = `${ORIGIN}/blog/${params.slug}`;
    if (!p) return { meta: [{ title: "Article not found — GoPalengke Blog" }, { name: "robots", content: "noindex" }] };
    const title = seoTitleOf(p);
    const desc = seoDescOf(p);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        ...(p.keywords.length ? [{ name: "keywords", content: p.keywords.join(", ") }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        ...(p.publishedAt ? [{ property: "article:published_time", content: p.publishedAt }] : []),
        ...(p.coverImage ? [{ property: "og:image", content: p.coverImage }, { name: "twitter:image", content: p.coverImage }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: desc,
          image: p.coverImage || undefined, datePublished: p.publishedAt, dateModified: p.updatedAt,
          keywords: p.keywords.join(", "), mainEntityOfPage: url,
          author: { "@type": "Organization", name: "GoPalengke" },
          publisher: { "@type": "Organization", name: "GoPalengke", logo: { "@type": "ImageObject", url: `${ORIGIN}/images/Copilot_20260907_183703.jpg` } },
        }),
      }],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">Hindi makita ang article</h1>
      <Link to="/blog" className="text-primary underline">Bumalik sa Blog</Link>
    </div>
  ),
  component: BlogPostPage,
});

function BlogPostPage() {
  const p = Route.useLoaderData();
  const url = `${ORIGIN}/blog/${p.slug}`;
  const enc = encodeURIComponent(url);
  const shares = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${enc}&text=${encodeURIComponent(p.title)}` },
    { label: "Reddit", href: `https://www.reddit.com/submit?url=${enc}&title=${encodeURIComponent(p.title)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc}&text=${encodeURIComponent(p.title)}` },
    { label: "Messenger", href: `fb-messenger://share/?link=${enc}` },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/blog" className="text-sm font-semibold text-primary">← GoPalengke Blog</Link>
          <a href="/" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Mamalengke</a>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-8">
        <span className="text-xs font-semibold uppercase text-primary">{p.category}</span>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{p.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {p.publishedAt && new Date(p.publishedAt).toLocaleDateString("fil-PH", { dateStyle: "long" })} · {readingMinutes(p.content)} min basa
        </p>
        {p.coverImage && <img src={p.coverImage} alt={p.title} className="mt-6 aspect-[1200/630] w-full rounded-2xl object-cover" />}
        <div className="blog-prose mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.content) }} />
        <div className="mt-10 border-t border-border pt-6">
          <p className="mb-3 text-sm font-semibold">I-share ang article:</p>
          <div className="flex flex-wrap gap-2">
            {shares.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-primary hover:text-primary">{s.label}</a>)}
          </div>
        </div>
      </article>
    </div>
  );
}
