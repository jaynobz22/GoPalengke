# Roadmap: GoPalengke Migration (GitHub → Lovable)

Source: https://github.com/jaynobz22/GoPalengke (Vite SPA + Supabase, checked out at /tmp/gopalengke-src)

## Tasks
- [x] Add a privacy-safe live/sample buyer and rider activity pop-up across public and user screens
- [ ] 1. Enable Lovable Cloud (DB, auth, storage)
- [ ] 2. Schema: port all 50+ Supabase migrations into Lovable Cloud (tables, RLS, grants, triggers, seed data)
- [ ] 3. Auth: email+password, email OTP, 4 roles (buyer/seller/rider/admin), user_roles table, referral capture
- [ ] 4. Port app code: lib/*, pages (Landing/Auth/Buyer/Seller/Rider/Admin/Affiliate), components
- [ ] 5. Maps: Leaflet dynamic import (delivery, rider nav, live tracking, ETA)
- [ ] 6. Messaging & calls: buyer-seller chat, admin chat, Zego video calls, video credits
- [ ] 7. Affiliate system: 2-tier referrals, dashboard, marketing tools
- [ ] 8. Notifications & email: Web Push (VAPID), welcome email, campaigns (Resend), announcements
- [ ] 9. Admin extras: fraud detection, device bans, audit log, QR codes, og-preview
- [ ] 10. Edge functions → server routes under /api/public/
- [ ] 11. Verify: build, sign-up/login, full order flow, chat, admin dashboard

## Pending (needs user)
- [ ] Data import: CSV/JSON exports of products, stores, orders, users from their Supabase dashboard (after preview)
- [ ] Secrets: VAPID keys (push), Zego credentials (video calls) — request via secure form when needed for verification

## Current: Targeted affiliate marketing pages
- [x] Build separate seller, rider, and buyer marketing pages
- [x] Preserve affiliate referral code through targeted signup
- [x] Add targeted links, thumbnails, copy, and Facebook share to affiliate dashboard
- [x] Verify mobile/desktop, social metadata, build, and referral flow
- [x] Push completed work to jaynobz22/GoPalengke

## Current: Affiliate marketing simplification
- [x] Remove social-media share buttons from the affiliate marketing dashboard
- [x] Make uploaded and targeted marketing images download-only
- [x] Disable AI image generation while retaining marketing text generation
- [x] Guarantee the correct affiliate link is included when generated text is copied
- [x] Verify the affiliate marketing controls and build, then push to GitHub

## Current: Responsive user dashboards
- [x] Make buyer, seller, rider, and admin dashboards adapt to laptop/desktop widths
- [x] Make public seller storefronts adapt without stretching or breaking images
- [x] Preserve the existing phone layouts
- [x] Verify desktop and mobile layouts and build
- [x] Push responsive dashboard update to GitHub

## Current: Rider profile images
- [x] Preserve the natural proportions of profile, valid ID, OR/CR, and QR images
- [x] Verify responsive image sizing and build
- [x] Push rider profile image fix to GitHub

## Current: Seller milestones
- [x] Define seven unique Palengke-themed seller ranks based on completed sales
- [x] Add rank badges to seller, buyer, and public store views
- [x] Add seller-only sales progress toward the next rank
- [ ] Apply `database/seller-ranks.sql` to the existing GoPalengke database (blocked: this workspace has no privileged access to that external database)
- [x] Verify rank thresholds on phone and laptop, then push to GitHub

## Current: Welcome email redesign
- [x] Green logo header with GoPalengke branding
- [x] Exact welcome wording: "Hello [Pangalan], Welcome to GoPalengke! The First Online Wet Market sa Pilipinas!"
- [x] Second paragraph thanking the user for signing up as their role, with role checklist
- [x] Green CTA button ending in "Ngayon" plus helpful links footer
- [x] Sender set to GoPalengke Admin
- [x] Push welcome email redesign to GitHub
