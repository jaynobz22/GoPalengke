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
