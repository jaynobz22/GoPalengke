import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const LANDING_IMAGES = [
  "https://melwjygaczevpasgazfo.supabase.co/storage/v1/object/public/store-images/landing/Copilot_20260906_113445.png",
  "https://melwjygaczevpasgazfo.supabase.co/storage/v1/object/public/store-images/landing/Copilot_20260906_114051.png",
  "https://melwjygaczevpasgazfo.supabase.co/storage/v1/object/public/store-images/landing/Copilot_20260906_115019.png",
  "https://melwjygaczevpasgazfo.supabase.co/storage/v1/object/public/store-images/landing/Copilot_20260906_115256.png",
  "https://melwjygaczevpasgazfo.supabase.co/storage/v1/object/public/store-images/landing/Copilot_20260906_115828.png",
  "https://melwjygaczevpasgazfo.supabase.co/storage/v1/object/public/store-images/landing/Copilot_20260907_183703.png",
];

function defaultOgImage(seed?: string): string {
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    return LANDING_IMAGES[Math.abs(hash) % LANDING_IMAGES.length];
  }
  return LANDING_IMAGES[Math.floor(Math.random() * LANDING_IMAGES.length)];
}

interface StoreRow {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  slug: string;
  city: string | null;
  barangay: string | null;
  region: string | null;
  palengke_name: string | null;
  is_open: boolean;
  rating: number;
}

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  unit: string;
  store_id: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const title = escapeHtml(opts.title);
  const desc = escapeHtml(opts.description);
  const img = escapeHtml(opts.image);
  const url = escapeHtml(opts.url);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="GoPalengke" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${img}" />

  <meta http-equiv="refresh" content="0; url=${url}" />
</head>
<body>
  <p>Redirecting to <a href="${url}">${url}</a></p>
</body>
</html>`;
}

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  const crawlers = [
    "facebookexternalhit", "facebookcatalog", "facebook", "meta",
    "twitterbot", "linkedinbot", "telegrambot", "whatsapp",
    "googlebot", "bingbot", "slackbot", "discordbot",
    "applebot", "pinterest", "skypesharing", "snapchat",
  "tiktok", "crawler", "bot", "spider", "preview",
  "developers.google.com", "googleimage", "googleweblight",
  "nginx_configuration_check",
  "chrome-lighthouse", "pagead",
  "openssl", "curl", "python-requests", "java",
    "go-http-client", "okhttp", "node-fetch",
  "quora", "ia_archiver", "wayback",
    "yeti", "naver", "daum", "yandex",
    "semrush", "ahrefs", "moz",
    "uptimerobot", "pingdom", "site24x7",
    "embedly", "iframely", "unfurl",
    "line/", "linebot",
  ];
  return crawlers.some((c) => ua.includes(c));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/og-preview\/?/, "");

    const userAgent = req.headers.get("user-agent") || "";
    const isBot = isCrawler(userAgent);

    const parts = path.split("/");
    const appUrl = `https://${url.host}/`;
    const redirectTo = url.searchParams.get("redirect_to");

    // For humans, redirect to the app (honour ?redirect_to= override first)
    if (!isBot) {
      if (redirectTo) {
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: `${appUrl}${redirectTo}` },
        });
      }
      if (parts.length >= 2 && parts[0] === "s") {
        const slug = decodeURIComponent(parts[1]);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: `${appUrl}s/${slug}` },
        });
      }
      if (parts.length >= 2 && parts[0] === "u") {
        const slug = decodeURIComponent(parts[1]);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: `${appUrl}u/${slug}` },
        });
      }
      if (parts.length >= 2 && parts[0] === "p") {
        const productId = decodeURIComponent(parts[1]);
        const { data: product } = await supabase
          .from("products")
          .select("store_id")
          .eq("id", productId)
          .maybeSingle();
        if (product) {
          const { data: store } = await supabase
            .from("stores")
            .select("slug")
            .eq("id", (product as { store_id: string }).store_id)
            .maybeSingle();
          if (store) {
            return new Response(null, {
              status: 302,
              headers: { ...corsHeaders, Location: `${appUrl}s/${(store as { slug: string }).slug}` },
            });
          }
        }
      }
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: appUrl },
      });
    }

    // For crawlers, serve the OG preview HTML

    if (parts.length >= 2 && parts[0] === "s") {
      const slug = decodeURIComponent(parts[1]);

      const { data: store } = await supabase
        .from("stores")
        .select("id, name, description, banner_url, logo_url, slug, city, barangay, region, palengke_name, is_open, rating")
        .eq("slug", slug)
        .maybeSingle();

      if (!store) {
        return new Response("Store not found", {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      const s = store as StoreRow;
      const ogImage = s.banner_url || s.logo_url || defaultOgImage(s.id);
      const description = s.description
        ? `${s.description}${s.palengke_name ? ` · ${s.palengke_name}` : ""}${s.city ? ` · ${s.city}` : ""}`
        : `${s.palengke_name || ""} ${s.barangay || ""} ${s.city || ""} ${s.region || ""}`.trim() || "GoPalengke Online Wet Market";

      const fullUrl = `${appUrl}s/${s.slug}`;

      return new Response(
        buildHtml({
          title: `${s.name} · GoPalengke`,
          description,
          image: ogImage,
          url: fullUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    if (parts.length >= 2 && parts[0] === "p") {
      const productId = decodeURIComponent(parts[1]);

      const { data: product } = await supabase
        .from("products")
        .select("id, name, description, image_url, price, unit, store_id")
        .eq("id", productId)
        .maybeSingle();

      if (!product) {
        return new Response("Product not found", {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      const p = product as ProductRow;

      const { data: store } = await supabase
        .from("stores")
        .select("id, name, slug, banner_url, logo_url, city, palengke_name")
        .eq("id", p.store_id)
        .maybeSingle();

      const s = store as Partial<StoreRow> | null;
      const ogImage = p.image_url || s?.banner_url || s?.logo_url || defaultOgImage(p.store_id);
      const description = p.description
        ? `${p.description} · ₱${p.price}/${p.unit}${s?.name ? ` · ${s.name}` : ""}`
        : `₱${p.price} per ${p.unit}${s?.name ? ` · ${s.name}` : ""}`;
      const fullUrl = s?.slug ? `${appUrl}s/${s.slug}` : appUrl;

      return new Response(
        buildHtml({
          title: `${p.name} · ₱${p.price}/${p.unit} · GoPalengke`,
          description,
          image: ogImage,
          url: fullUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    if (parts.length >= 2 && parts[0] === "u") {
      const slug = decodeURIComponent(parts[1]);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url, city, barangay")
        .eq("slug", slug)
        .maybeSingle();

      if (!profile) {
        return new Response("User not found", {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      const p = profile as { id: string; full_name: string; role: string; avatar_url: string | null; city: string | null; barangay: string | null };

      let storeData: Partial<StoreRow> | null = null;
      if (p.role === "seller") {
        const { data: s } = await supabase
          .from("stores")
          .select("id, name, slug, banner_url, logo_url, city, palengke_name")
          .eq("seller_id", p.id)
          .maybeSingle();
        storeData = s as Partial<StoreRow> | null;
      }

      const ogImage = storeData?.banner_url || storeData?.logo_url || p.avatar_url || defaultOgImage(p.id);
      const roleLabel = p.role === "buyer" ? "Mamimili" : p.role === "seller" ? "Tindera/Tindero" : "Rider";
      const description = `${roleLabel}${p.barangay ? ` · ${p.barangay}` : ""}${p.city ? ` · ${p.city}` : ""}`;
      const fullUrl = storeData?.slug ? `${appUrl}s/${storeData.slug}` : `${appUrl}u/${slug}`;

      return new Response(
        buildHtml({
          title: `${p.full_name} · ${roleLabel} · GoPalengke`,
          description,
          image: ogImage,
          url: fullUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    return new Response("Invalid path. Use /og-preview/s/{slug}, /og-preview/p/{productId}, or /og-preview/u/{slug}", {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
