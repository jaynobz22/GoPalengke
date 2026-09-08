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

const DEFAULT_OG_IMAGE = "https://melwjygaczevpasgazfo.supabase.co/storage/v1/object/public/store-images/Copilot_20260907_183703.png";

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

  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; }
    .card { max-width: 500px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .banner { width: 100%; height: 200px; object-fit: cover; background: #e5e7eb; }
    .info { padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 20px; color: #1f2937; }
    p { margin: 0 0 4px; font-size: 14px; color: #6b7280; }
    .cta { display: inline-block; margin-top: 16px; padding: 12px 28px; background: #ea580c; color: #fff; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <img class="banner" src="${img}" alt="${title}" />
    <div class="info">
      <h1>${title}</h1>
      <p>${desc}</p>
      <a class="cta" href="${url}">View on GoPalengke</a>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/og-preview\/?/, "");

    // path format: s/{slug} or p/{productId}
    const parts = path.split("/");
    const appUrl = `https://${url.host}/#/`;

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
      const ogImage = s.banner_url || s.logo_url || DEFAULT_OG_IMAGE;
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
      const ogImage = p.image_url || s?.banner_url || s?.logo_url || DEFAULT_OG_IMAGE;
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

      // If seller, find their store and use store banner as OG image
      let storeData: Partial<StoreRow> | null = null;
      if (p.role === "seller") {
        const { data: s } = await supabase
          .from("stores")
          .select("id, name, slug, banner_url, logo_url, city, palengke_name")
          .eq("seller_id", p.id)
          .maybeSingle();
        storeData = s as Partial<StoreRow> | null;
      }

      const ogImage = storeData?.banner_url || storeData?.logo_url || p.avatar_url || DEFAULT_OG_IMAGE;
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
