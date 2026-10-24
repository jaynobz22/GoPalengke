<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Affiliate seller fee progress uses the shared browser-safe affiliateSellerMilestone calculator in both tracker and referral details; delivered sales accrue fees and credited milestone counts retire paid cycles without treating accrual as wallet earnings.

- User dashboards use full-width responsive shells up to `max-w-7xl`, while preserving their phone layout below `md`; this prevents desktop sessions from remaining in a narrow mobile column.
- Public store shares use the dedicated `/s/$slug` SSR data route with optional `?p=<product-id>`; social crawlers need server-readable store/product metadata and images.
- Seller recognition uses the shared SellerRankBadge module and a public stores.seller_rank snapshot; exact seller_fees.total_sales remains private.
- Cross-screen social proof uses one global privacy-safe activity component; real order events take priority and simulated fallback events must be labeled as samples.
- Phone/password login resolves existing account identifiers only on the server and returns a password-validated session through the shared auth provider; this prevents anonymous email disclosure and preserves verification/device/account checks.
- Keep phone normalization in a browser-safe utility shared by signup and server login; this keeps accepted phone formats consistent and independently testable.
- Keep admin tab definitions and grouped navigation in the shared AdminNavigation module; this preserves every existing content view and its notification counts across desktop sidebar and phone drawer.
- Shared image uploads offer original-file upload and optional crop editing, await profile persistence, and report save errors; this keeps all role screens consistent without duplicating upload flows.
- Admin profile photos use the existing profiles.avatar_url and shared upload field; AdminChat resolves the conversation participant's photo with a narrow profile read so all user roles see the assigned admin without duplicate storage.
- Both admin seller-approval controls use the shared sellerApproval module; it preserves unrelated chats, checks cleanup errors, and reuses an existing approval message on retries.
- Legacy login visibility is synchronized with URL history; confirmed missing profiles clear only the local session, while failed profile reads preserve existing accounts.
- Seller create/edit forms share SellerLocationFields and sellerLocation market filtering; reuse the existing market directory with GPS/city fallback so suggestions and manual entries stay consistent without adding a paid lookup service.
- Profile dashboard gating and rider onboarding use the shared profileCompletion rules; rider admin reminders validate the existing account session server-side and use a stable message ID to prevent duplicates on concurrent loads or retries.
- Buyer pre-order rider inquiries reuse the null-order conversation pattern (getOrCreateRiderInquiry, type buyer_rider) and the shared fleetRiders module lists only available/approved tricycle and minivan riders, nearest city first; this keeps heavy-cargo chats consistent with store inquiries without duplicating RLS or sorting logic.
- Buyer movement banners, maps, and ETA use the shared browser-safe buyerRiderTracking gate; this prevents rider assignment from being mistaken for delivery acceptance.
- Buyer order-detail realtime and polling updates share mergeBuyerOrderUpdate; GPS and completion changes must propagate even when the status stays unchanged. Map interpolation is display-only and respects reduced motion.
- Rider pickup uses browser-safe orderPickup updates: single-store pickup activates delivery status, while grouped pickup records only its store until group departure; this keeps buyer movement aligned with the delivery leg.
- Rider arrival uses orders.rider_arrived_buyer_at while retaining picked_up status; riderArrival guards delivery completion until arrival and every COD store reference exist, preserving delivery/commission trigger timing.
- Seller and buyer trackers use browser-safe orderArrivalPhase for arrival presentation before delivered; this keeps an arrival timestamp from being mistaken for delivery completion.
- Seller rider-fee QR and payment instructions share sellerRiderQr pickup-phase gating, so they disappear on departure without changing payment accounting.
- Buyer COD payment choices use BuyerCodPayment behind arrival gating; QR/cash selection is presentation-only and never changes COD verification or remittance accounting.
