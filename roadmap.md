# Roadmap: GoPalengke Migration (GitHub → Lovable)

## Current: Rider billing automation and admin error
- [x] Update first cycle (onboarding + platform), synchronize progress and new-delivery suspension; 13 tests and isolated payment-state checks pass; replacement SQL supplied
- [x] Fix missing admin earnings ledger import; isolated admin overview and expanded payment reference render without page errors
- [x] Prepare onboarding and paid-platform milestone SQL preserving existing 3% accrual; PostgreSQL fixture verifies one-time ₱300 at ₱1,000, partial payments, ₱35/₱15, ₱50 without sponsor and safe reruns
- [x] Deduct rider affiliate shares in admin ledger; eleven tests pass; pushed
- [ ] Apply and verify database/rider-fee-and-affiliate-payout.sql on external database (blocked: SQL execution access unavailable; script stops if legacy payout hooks conflict)
- [ ] Verify rider progress for standalone affiliate-only sessions (blocked: current legacy affiliate login has no verified auth session; narrow progress read requires linked account sign-in)

## Current: Seller completed-order popup
- [x] Clear selected order on navigation, refresh details before actions, synchronize DONE and close only after successful save
- [x] Seven regression tests pass; isolated browser verifies cached pending → delivered/DONE without acceptance controls, and successful DONE closure with no page errors; pushed 3806678
- [ ] Verify with a real seller order (blocked: no authenticated session for the existing external account system)

## Current: Arrival step on seller and buyer
- [x] Show explicit arrival between pickup/travel and delivered, retaining COD and NON-COD completion gates
- [x] Thirteen rule tests pass; isolated seller and buyer screens show travel → arrival → delivered without page errors; pushed 749fdcb

## Current: Buyer COD QR/cash
- [x] Arrival-only rider QR with QR-default and clickable cash choice, without changing COD accounting
- [x] Six payment/arrival tests pass; isolated buyer screen verifies hidden before arrival, default QR, Cash selection and return to QR; pushed

## Current: Seller rider QR timing
- [x] Restrict rider QR/payment instructions to NON-COD store arrival/pickup and remove travel QR
- [x] Three rule tests pass; isolated seller screen verifies QR at NON-COD pickup, hidden during travel and COD; pushed to existing repo

## Current: Rider arrival at buyer
- [x] Add persistent arrival action and buyer/seller arrival banner
- [x] Move COD remittance before delivered, including per-store reference gating
- [x] Sixteen arrival/tracking/pickup/COD tests pass; isolated COD browser flow verifies arrival → reference → delivered without errors; changes pushed
- [ ] Apply database/rider-buyer-arrival.sql to external GoPalengke database (blocked: no privileged access to that backend)
- [ ] Verify real buyer/seller/rider delivery (blocked: no authenticated external account session)

## Current: Smooth live rider map
- [x] Add cancellable display-only rider marker animation and retain user map framing during GPS updates
- [x] Include GPS and completion fields in buyer backup refresh updates
- [x] Ten tracking/pickup tests pass; isolated browser verifies smooth movement and destination change without errors; pushed to existing GitHub repo
- [ ] Verify live movement with real buyer/rider accounts (blocked: no session for the existing external account system)

## Current: Buyer rider acceptance
- [x] Update rider/seller pickup and buyer on-the-way notice; acceptance and pickup tests pass and changes pushed
- [x] Gate buyer movement banners, tracking map, and ETA on rider acceptance; four acceptance tests pass and push to the existing repo
- [ ] Verify seller assignment → rider acceptance in real buyer/rider accounts (blocked: no authenticated session for the existing external account system)

Source: https://github.com/jaynobz22/GoPalengke (Vite SPA + Supabase, checked out at /tmp/gopalengke-src)

## Tasks
- [x] Correct affiliate seller progress to accrued sales fees in tracker and details; five calculation tests and simulated browser flows pass; pushed to existing GitHub repo
- [ ] Verify affiliate fee cycles and ₱150/₱50 credit after a real seller payment (blocked: no authenticated session or verified payment-trigger access for the external account system)
- [x] Update rider admin chat to approval/location reminders only; nine tests pass, signed-in temporary rider sees one persisted reminder after reload, check account removed, and changes pushed
- [x] Add talipapa/neighborhood seller option and location-based market choices with manual entry to create/edit store forms; four tests and isolated form interactions pass; pushed
- [x] Tint buyer/seller, admin and affiliate chat panels soft green with a visible edge so the chat box reads apart from the white page; desktop and phone screenshots checked and pushed
- [ ] Verify new seller-location choices save/read back on a real seller account (blocked: existing external account system has no available authenticated session)
- [x] Rename the profile-completion submit button to "I-save at Simulang Gamitin ang GoPalengke" and keep it on one line on phone
- [x] Fix login Back/homepage navigation; phone/desktop app Back, browser Back, signup exit/reload and missing-profile tests pass
- [ ] Verify deleted-account session recovery on a real account (blocked: no session for the existing external account system)
- [x] Complete seller approval: remove verification request/documents, send Congratulations and location reminder, test and push
- [ ] Verify seller approval cleanup and congratulations inside a real admin/seller chat (blocked: no authenticated session for the existing external account system)
- [x] Add admin profile-photo editing and display the assigned admin's picture in user chats
- [x] Verify admin photo controls/chat display with mocked storage/profile reads and push to GitHub
- [ ] Verify admin photo persistence and user-chat profile access on real accounts (blocked: no session or privileged access to the existing external account system)
- [x] Restore seller profile-photo editing and check existing buyer/rider controls
- [x] Allow original-image upload without cropping; browser-check original/cropped dimensions, replace/remove/cancel on phone and desktop; push changes
- [ ] Verify profile-picture persistence inside real seller/buyer/rider accounts (blocked: no session for the existing external account system)
- [x] Group all admin tabs into left-side navigation; all 15 selections, group toggles, and phone drawer verified in an isolated browser check
- [x] Push admin navigation changes to the existing GitHub repo
- [ ] Verify grouped navigation inside the real admin account (blocked: no session for the existing external account system)
- [x] Fix registered-phone login for existing email accounts without public email lookup
- [x] Test phone login safeguards and push the fix to GitHub
- [ ] Verify real-account phone login (requires the user's own sign-in on the external account system)
- [x] Closed testing beta-tester page (/beta-tester)
- [x] Add "Beta Testers" link to the homepage footer
- [x] Push page and footer link to GitHub, verify the live site opens the page

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
- [x] Activity pop-up: homepage visitors only, smooth fade, colored per category, 10s show / 10s gap
- [x] Preserve uploaded affiliate banner and marketing-image proportions on phone and laptop

## Current: Blank-screen crash guard
- [x] Wrap the whole app in an error boundary so a stale/cached module auto-reloads instead of blanking the screen
- [x] Verify normal load, forced render-error recovery, and build
- [x] Push the crash guard to GitHub

## Current: Beta tester hero background
- [x] Use the uploaded GoPalengke phone screenshot as the hero background
- [x] Replace the flat blur with a left-to-right fade so the headline stays readable
- [x] Thin the blur and re-position the image so the phone with the app is visible
- [x] Verify phone and laptop rendering and build
- [x] Push to GitHub

- [x] Admin-user video call fix: polling fallback sa useIncomingAdminCall (5s), "Subukan muli" retry sa AdminVideoCall error banner, database/admin-calls.sql RLS policies (kailangang patakbuhin ng user sa database SQL Editor)

## Current: Buyer bao-bao/minivan finder
- [x] Add "Maramihan ang bibilhin?" card sa buyer home na nagbubukas ng listahan ng available na bao-bao/minivan riders (malapit na city muna)
- [x] Buyer-to-rider inquiry chat bago mag-order (getOrCreateRiderInquiry, null-order buyer_rider conversation)
- [x] fleetRiders filter/sort module + 5 tests pass
- [ ] Apply `database/rider-inquiry-chat.sql` sa existing GoPalengke database (blocked: kailangang i-run ng user sa kanilang database SQL Editor — walang privileged access ang workspace na ito)
- [ ] Verify buyer-to-rider inquiry chat sa real buyer at rider accounts (blocked: no authenticated session for the existing external account system)
