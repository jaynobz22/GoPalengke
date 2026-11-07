// Browser-safe blog helpers shared by admin editor, public pages and server functions.
export const BLOG_CATEGORIES = ["Balita", "Tutorial", "Update", "Gabay", "Kwento"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
}

export const SEO_TITLE_MAX = 60;
export const SEO_DESC_MAX = 160;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function parseKeywords(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()))
    .slice(0, 15);
}

export function seoTitleOf(p: Pick<BlogPost, "seoTitle" | "title">) {
  return (p.seoTitle || p.title).trim();
}
export function seoDescOf(p: Pick<BlogPost, "seoDescription" | "excerpt">) {
  return (p.seoDescription || p.excerpt).trim();
}

export function publishedPosts(posts: BlogPost[]): BlogPost[] {
  return posts
    .filter((p) => p.status === "published" && p.publishedAt)
    .sort((a, b) => (b.publishedAt! > a.publishedAt! ? 1 : -1));
}

export function readingMinutes(content: string) {
  return Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

/** Minimal, escaped Markdown: #/##/### headings, - lists, 1. lists, > quotes, images, links, bold. */
export function renderMarkdown(md: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    let m: RegExpMatchArray | null;
    if (!line) { flushPara(); closeList(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); closeList();
      const lvl = Math.min(4, (m[1] ?? "").length + 1);
      out.push(`<h${lvl}>${inline(m[2] ?? "")}</h${lvl}>`);
    } else if ((m = line.match(/^[-*]\s+(.*)$/)) || (m = line.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      const kind = /^\d/.test(line) ? "ol" : "ul";
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(m[1] ?? "")}</li>`);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); closeList();
      out.push(`<blockquote>${inline(m[1] ?? "")}</blockquote>`);
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara(); closeList();
  return out.join("\n");
}
