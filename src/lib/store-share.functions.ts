import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/legacy/lib/supabase";

type StoreShareRow = {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  city: string | null;
  palengke_name: string | null;
};

type ProductShareRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  unit: string;
};

// Facebook doesn't render WebP thumbnails; convert to a 1200x630 JPG via a public image CDN.
function shareImage(src: string | null) {
  if (!src) return null;
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=1200&h=630&fit=cover&output=jpg&q=82`;
}

async function publicRead<T>(path: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) return [];
  return (await response.json()) as T[];
}

export const getStoreSharePreview = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        slug: z.string().trim().min(1).max(160),
        productId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const stores = await publicRead<StoreShareRow>(
      `stores?slug=eq.${encodeURIComponent(data.slug)}&select=id,name,description,banner_url,city,palengke_name&limit=1`,
    );
    const store = stores[0];
    if (!store) return null;

    let product: ProductShareRow | null = null;
    if (data.productId) {
      const products = await publicRead<ProductShareRow>(
        `products?id=eq.${encodeURIComponent(data.productId)}&store_id=eq.${encodeURIComponent(store.id)}&select=id,name,description,image_url,price,unit&limit=1`,
      );
      product = products[0] ?? null;
    }

    const location = store.palengke_name || store.city || "GoPalengke";
    if (product) {
      return {
        title: `${product.name} — ${store.name} | GoPalengke`,
        description:
          product.description ||
          `₱${Number(product.price).toLocaleString("en-PH")}/${product.unit} sa ${store.name}, ${location}.`,
        image: shareImage(product.image_url || store.banner_url),
        storeName: store.name,
        productName: product.name,
      };
    }

    return {
      title: `${store.name} | GoPalengke`,
      description:
        store.description ||
        `Tingnan ang mga sariwang paninda ng ${store.name} sa ${location}.`,
      image: shareImage(store.banner_url),
      storeName: store.name,
      productName: null,
    };
  });