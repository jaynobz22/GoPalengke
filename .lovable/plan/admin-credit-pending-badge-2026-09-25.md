# Admin Credit Pending Badge

## Gagawin
- Kukunin ang bilang ng credit purchases na may `pending` status pag bukas ng admin dashboard.
- Maglalagay ng pulang number badge sa **Credits** tab kapag may kailangang i-approve.
- Awtomatikong ia-update ang bilang kapag may bagong bumili, na-approve, o na-reject.
- Itatago ang badge kapag wala nang pending approval.

## Technical details
- Gagamitin ang kasalukuyang `video_credit_purchases` records at realtime updates; walang bagong table o pagbabago sa credit pricing/approval rules.
- Mananatiling aktibo ang kasalukuyang Credits page at approval actions.
- Ive-verify ang build at mobile admin tab layout pagkatapos ng pagbabago.
