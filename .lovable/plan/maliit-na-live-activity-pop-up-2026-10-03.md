# Maliit na Live Activity Pop-up

## Gagawin
- Magdagdag ng maliit, dismissible activity pop-up sa ibabang kaliwa ng screen, nakaangat sa mobile navigation at safe area.
- Ipakita muna ang tunay at anonymized na order/rider activity kapag mayroon; walang pangalan, eksaktong address, o ibang personal na detalye.
- Kapag walang bagong tunay na activity, magpalit-palit ng malinaw na may label na “Sample activity” gamit ang produkto, timbang, tindahan, palengke, at barangay examples. Hindi ito tatawaging tunay na bagong order.
- Buyer activity: timbang + produkto + tindahan + public market.
- Rider activity: pickup/delivery update + barangay lamang.
- Isang pop-up lang bawat pagkakataon, kusa itong mawawala, may X button, at hindi lalabas nang sobrang dalas.

## Technical details
- Gumawa ng reusable global activity component at ikabit sa shared app shell para sakop ang landing, buyer, seller, at rider screens.
- Gumamit ng existing order realtime/polling pattern para mauna ang totoong activity, na may privacy-safe mapping.
- Magdagdag ng mobile-safe positioning, reduced-motion support, cleanup ng timers/subscriptions, at session-level dismissal.
- I-verify sa phone at desktop, tingnan ang runtime/build errors, at i-push agad sa existing GitHub repository.
