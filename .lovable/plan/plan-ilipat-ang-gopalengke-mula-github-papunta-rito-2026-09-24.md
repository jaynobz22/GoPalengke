# Plan: Ilipat ang GoPalengke (mula GitHub papunta rito)

## Layunin

Gawing kapareho ng proyektong ito ang natapos na GoPalengke app sa GitHub
(jaynobz22/GoPalengke) — lahat ng pahina, features, at functionalities.
Ang kasalukuyang green-theme demo dito ay papalitan ng buong app.
Ang backend (database, login, storage) ay ililipat sa Lovable Cloud.

## Mga feature na nasa lumang app (i-verify mo kung kumpleto ito)

- **Landing page** at public pages (tungkol sa palengke, legal pages: terms/privacy)
- **Login/Sign-up**: email + password, email OTP verification, apat na roles — Buyer, Seller, Rider, Admin
- **Buyer app**: mag-browse ng palengke/stores/products (kabuo ang ulam at kakanin, may kilo/frac quantity), bayong/cart, checkout, scheduled delivery, order tracking (OrderStepTracker, LiveETA, live tracking map), reviews, chat sa seller
- **Seller app**: pamahalaan ang tindahan at paninda, mga order, chat sa buyer, seller billing/commission, profile review
- **Rider app**: delivery jobs, navigation map, rider billing (per-delivery fees)
- **Admin app**: dashboard + analytics, announcements, admin chat at video calls, komisyon/subscription setup, email campaigns, QR codes, user management (kasama delete + ban), fraud detection/security dashboard, tutorial videos
- **Affiliate program**: 2-tier referral system, referral links (?ref=, ?aff_ref=), earnings/transactions, AI marketing kit, marketing materials
- **Video calls**: Zego Cloud (buyer-seller/admin calls, video credits)
- **Push notifications**: Web Push (VAPID) + in-app notifications sa mga order
- **Delivery fee logic**: multi-tier fleet (motorcycle ≤20kg / tricycle ≤150kg / minivan ≤500kg), NCR vs Province rates, 3% platform commission, free < 5kg
- **Email**: welcome email at campaigns gamit ang Resend (nakaimbak ang key sa platform_settings)
- **Maps**: Leaflet + OpenStreetMap (delivery, rider navigation, live tracking)
- **Image uploads**: profile images, product photos, chat attachments (may crop at compression)

## Paano ililipat (mapping)

| Lumang app | Papunta rito |
|---|---|
| Vite + React SPA (bolt.new) | TanStack Start (ang stack ng proyektong ito) |
| Supabase project (~37 tables, 50+ migrations) | Lovable Cloud — same schema, may RLS policies at grants |
| Supabase Auth | Lovable Auth (email+password, email OTP, roles sa user_roles table) |
| Supabase Storage buckets | Lovable Cloud storage |
| 6 na Supabase Edge Functions | Server routes sa ilalim ng /api/public/ (fraud-detection, og-preview, send-campaign-emails, send-push-notification, send-welcome-email, delete-storage-objects) |
| Netlify hosting | Lovable hosting |
| Leaflet maps | Dynamic import (ClientOnly) para hindi umalis ang SSR |
| Zego SDK (CDN) | Pareho — client-side lang, walang SSR |

## Mga hakbang

1. **Schema at data setup** — isalin ang lahat ng database tables, RLS policies, triggers, at seed data (product catalog, categories) sa Lovable Cloud.
2. **Auth at roles** — login, sign-up with role, email OTP, admin roles sa hiwalay na user_roles table, referral capture.
3. **Core apps** — Landing, Buyer, Seller, Rider, Admin: pahina, order flow, cart, chat, reviews, billing, delivery fee logic.
4. **Maps at tracking** — Leaflet (dynamic import), live tracking, ETA, rider navigation.
5. **Messaging at calls** — buyer-seller chat, admin chat, Zego video calls, video credits.
6. **Affiliate system** — 2-tier referrals, dashboard, marketing tools.
7. **Notifications at email** — Web Push, notification triggers, welcome email, campaigns (Resend), tutorial videos, announcements.
8. **Security at admin extras** — fraud detection, device bans, audit log, QR codes, og-preview.
9. **Verification** — build, sign-up/login flow, isaang buong order flow (browse → cart → checkout → tracking), chat, at admin dashboard.

## Kailangan mula sa iyo (mamaya, hindi hadlang sa simula)

- **Lumang data** (products, stores, orders, users): pagkatapos ng preview, magbibigay ka ng CSV/JSON export mula sa Supabase dashboard mo para mailipat ang tunay na records at users.
- **Mga susi (secrets)**: VAPID keys (push) at Zego credentials (video calls) — hihingin nang secure sa chat kapag kailangan na para sa verification. Hindi mo kailangan i-paste ito ngayon.

## Paalala

Ang demo na ginawa natin dito (green theme, ₱49 delivery) ay mapapalitan ng
tunay na app. Kung may gusto kang manatili mula sa demo, sabihin mo bago
kumilos ang plan.
