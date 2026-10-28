# Plan (binago): GoPalengke sa Lovable, gamit ang EXISTING Supabase mo

## Bagong direksyon (galing sa iyo)

Hindi na ililipat ang database sa Lovable Cloud. Ang existing Supabase project
mo (melwjygaczevpasgazfo — nakita ko sa app code) ang ikokonekta rito.
Ang lahat ng data, users, storage files, at edge functions ay **mananatili
doon** — walang migration ng schema o records, walang mababago sa
database mo, at hindi na kailangan ng CSV exports.

### Ang kailangan mula sa iyo (isang click lang, hindi ko ito magagawa sa chat)

1. Sa Lovable editor: **Project Settings → Connectors → Supabase**.
2. I-connect at i-authorize ang Supabase account mo, piliin ang
   GoPalengke project (melwjygaczevpasgazfo).
3. Pagkatapos, babatay ang app dito sa env vars ng iyong Supabase.

Paalala: Nag-enable ako ng bagong Lovable Cloud kanina bago dumating ang
mensahe mo — walang laman ito at hindi gagamitin; idi-disconnect natin ito
pagkatapos ma-connect ang Supabase mo para walang kalituhan.

## Mga hakbang

1. **Ikonekta mo ang Supabase** (steps sa itaas).
2. **Frontend port** — ang natitirang totoong trabaho:
   - Kopyahin ang buong app code mula sa repo (pages, components, lib) papunta rito.
   - Isalin ang mga public files: manifest.json, service worker (sw.js), icons, images.
   - I-adapt ang supabase client para gamitin ang env vars ng nakakonektang Supabase.
   - Ilagay ang lahat ng pahina sa TanStack Start (client-side rendering, katulad ng SPA)
     habang pinapanatili ang custom routing ng app.
   - I-install ang mga kulang na packages: leaflet, react-leaflet, react-image-crop.
   - Alisin ang demo (green-theme draft) at ang luma nitong index page.
3. **Edge functions** — iiwan at gagana ito sa Supabase project mo (fraud-detection,
   og-preview, send-campaign-emails, send-push-notification, send-welcome-email,
   delete-storage-objects). Ang app ay tatawag dito gaya ng dati.
4. **Idi-disconnect ang walang lamang Lovable Cloud** pagkatapos ng hakbang 1.
5. **Verification** — build, landing page, sign-up/sign-in laban sa totoong
   database, browse ng totoong stores/products, at order/cart flow.

## Mananatili (walang babaguhin)

- Database, auth (lahat ng existing users at passwords), storage buckets,
  RLS policies, triggers, at edge functions sa Supabase project mo.
- Mga secrets na nandoon na: VAPID keys (push), Resend key (email, nasa
  platform_settings table), Zego credentials.

## Mga benepisyo ng route na ito

- Mas mabilis — frontend lang ang gagalawin.
- Walang user migration, walang first-login friction; same password, same data.
- Realtime, push, at email functions tuloy sa paggana.
