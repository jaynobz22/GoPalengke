import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publishedPosts, slugify, type BlogPost } from "./blog";

// Blog posts live as one JSON index in the public "blog" storage bucket — no app tables touched.
const GP_URL = "https://melwjygaczevpasgazfo.supabase.co";
const INDEX = "posts.json";
const publicUrl = (path: string) => `${GP_URL}/storage/v1/object/public/blog/${path}`;

async function readIndex(): Promise<BlogPost[]> {
  const res = await fetch(`${publicUrl(INDEX)}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return [];
  try { const j = await res.json(); return Array.isArray(j) ? j : []; } catch { return []; }
}

async function adminKey(token: string) {
  const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Hindi naka-configure ang server.");
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u } = await sb.auth.getUser(token);
  if (!u?.user?.id) throw new Error("Hindi naka-login.");
  const { data: p } = await sb.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (p?.role !== "admin") throw new Error("Admin lang ang pwede.");
  return key;
}

async function upload(key: string, path: string, body: BodyInit, type: string) {
  const res = await fetch(`${GP_URL}/storage/v1/object/blog/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": type, "x-upsert": "true", "cache-control": "no-cache" },
    body,
  });
  if (!res.ok) throw new Error(`Hindi ma-save (${res.status}).`);
}

const writeIndex = (key: string, posts: BlogPost[]) => upload(key, INDEX, JSON.stringify(posts), "application/json");

export const listBlogPosts = createServerFn({ method: "GET" }).handler(async () =>
  publishedPosts(await readIndex()).map(({ content: _c, ...rest }) => ({ ...rest, content: "" })),
);

export const getBlogPost = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => publishedPosts(await readIndex()).find((p) => p.slug === data.slug) ?? null);

const tokenSchema = z.string().min(10).max(4000);

export const adminListBlogPosts = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    await adminKey(data.token);
    return (await readIndex()).sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  });

const postSchema = z.object({
  id: z.string().max(60).optional(),
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().max(120),
  excerpt: z.string().trim().max(400),
  content: z.string().max(100000),
  coverImage: z.string().max(1000),
  category: z.string().max(40),
  seoTitle: z.string().trim().max(120),
  seoDescription: z.string().trim().max(300),
  keywords: z.array(z.string().max(80)).max(15),
  status: z.enum(["draft", "published"]),
});

export const saveBlogPost = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, post: postSchema }).parse(d))
  .handler(async ({ data }) => {
    const key = await adminKey(data.token);
    const posts = await readIndex();
    const p = data.post;
    const slug = slugify(p.slug || p.title);
    if (!slug) throw new Error("Kailangan ng slug.");
    if (posts.some((x) => x.slug === slug && x.id !== p.id)) throw new Error("May ibang article na gumagamit ng slug na ito.");
    const now = new Date().toISOString();
    const existing = posts.find((x) => x.id === p.id);
    const saved: BlogPost = {
      ...p,
      id: existing?.id ?? crypto.randomUUID(),
      slug,
      publishedAt: p.status === "published" ? existing?.publishedAt ?? now : existing?.publishedAt ?? null,
      updatedAt: now,
    };
    await writeIndex(key, existing ? posts.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...posts]);
    return saved;
  });

export const deleteBlogPost = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, id: z.string().max(60) }).parse(d))
  .handler(async ({ data }) => {
    const key = await adminKey(data.token);
    await writeIndex(key, (await readIndex()).filter((p) => p.id !== data.id));
    return { ok: true };
  });

export const uploadBlogImage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, dataUrl: z.string().max(7_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const key = await adminKey(data.token);
    const m = data.dataUrl.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
    if (!m) throw new Error("JPG, PNG o WEBP lang.");
    const bytes = Uint8Array.from(atob(m[3] ?? ""), (c) => c.charCodeAt(0));
    const path = `images/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
    await upload(key, path, bytes, m[1] ?? "image/jpeg");
    return { url: publicUrl(path) };
  });
