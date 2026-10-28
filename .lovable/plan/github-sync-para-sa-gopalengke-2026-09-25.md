# GitHub Sync para sa GoPalengke

## Layunin
Awtomatikong two-way sync ng code ng app sa GitHub repo mo (`jaynobz22/GoPalengke`) — kapag may edits tayo dito, automatic na magpo-push sa GitHub, at kapag may push ka sa GitHub, automatic ring dadaan dito.

## Mahalagang paalala
Ang GitHub sync ay i-o-on sa **Lovable editor UI** — hindi ito magagawa mula sa chat. Isang setup lang ito, tapos matic na lahat pagkatapos.

## Mga hakbang (gagawin mo, isang beses lang)
1. Sa Lovable editor, i-click ang **Plus (+) menu** sa chat input (kaliwa sa ilalim) → **GitHub** → **Connect project**
2. I-authorize ang Lovable GitHub App sa GitHub account mo (`jaynobz22`)
3. Piliin ang account/organization — dahil may existing `GoPalengke` repo ka na, puwede itong i-link doon (o gumawa ng bagong repo kung gusto mo ng hiwalay)

## Pagkatapos ma-connect (gagawin ko)
- I-verify na dumadaloy ang code sa GitHub (tingnan kung may bagong commit sa repo)
- I-confirm na walang conflict sa kasalukuyang code ng app

## Buod ng kung ano ang matic pagkatapos nito
- **Supabase (database mo)** — ✅ matic na, walang kailangan
- **GitHub (code)** — ✅ matic na pagkatapos ng setup sa itaas
- **Publish (public URL)** — may click pa rin ito sa Publish button; hindi kayang gawing matic ang pag-deploy sa live URL dahil ikaw ang nagkontrol kung kailan mag-live ang changes

Walang gagalawin sa database mo at sa gumaganang app — setup lang ng sync ang ito.
