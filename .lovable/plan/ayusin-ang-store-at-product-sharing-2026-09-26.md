# Ayusin ang store at product sharing

## Gagawin
- Gumawa ng tunay na public store page address na nababasa ng Facebook at Messenger bago pa buksan ang app.
- Maglagay ng hiwalay na share address para sa bawat paninda gamit ang product ID, habang parehong store page pa rin ang bubukas.
- Ibigay sa social preview ang store name, description, at store banner; para sa product share, gamitin ang product name, presyo, at product image, na may banner bilang fallback.
- Itama lahat ng Facebook, Messenger, native share, at copy-link buttons para gamitin ang eksaktong store/product address at hindi ang homepage.
- Suriin ang generated page metadata, phone/desktop sharing flow, at preview errors; pagkatapos ay i-push agad sa kasalukuyang GitHub repository.

## Technical details
- Magdagdag ng dedicated TanStack route para sa `/s/$slug` na may server-readable Open Graph at Twitter metadata.
- Gamitin ang optional `?p=<product-id>` para maging unique at shareable ang bawat product preview.
- Panatilihin ang kasalukuyang GoPalengke screen at navigation; metadata at share URL behavior lamang ang babaguhin.
