# Seller Milestones at Recognition Badge

## Mga level
Ang ranggo ay base sa **kabuuang completed sales** ng seller, hindi sa pending o cancelled orders.

1. **Bagong Sibol** — ₱0–₱24,999
2. **Suki Magnet** — ₱25,000–₱99,999
3. **Palengke Paborito** — ₱100,000–₱299,999
4. **Hari ng Pwesto** — ₱300,000–₱749,999
5. **Bantog na Tindero** — ₱750,000–₱1,499,999
6. **Alamat ng Palengke** — ₱1,500,000–₱2,999,999
7. **Pambansang Suking-Bayan** — ₱3,000,000 pataas

## Gagawin
- Gagawa ng iisang seller-rank system para pare-pareho ang pangalan, badge, kulay, at sales threshold sa buong app.
- Ipapakita ang kasalukuyang badge sa seller dashboard, buyer store view, at public store link.
- Sa seller dashboard, may progress bar, kasalukuyang total sales, susunod na rank, at halagang kulang para maabot ito.
- Ang public at buyer store views ay badge at rank name lang ang makikita; hindi ilalantad ang eksaktong sales ng seller.
- Hindi makakadagdag sa milestone ang pending, cancelled, o hindi completed na order.

## Teknikal
- Gagamitin ang kasalukuyang `seller_fees.total_sales` bilang opisyal na source ng seller milestone.
- Idadagdag ang ligtas na public rank value sa store record at automatic itong ia-update kapag nagbago ang completed sales; hindi ise-share ang private billing amount.
- Maglalagay ng database validation at access rules para hindi kayang taasan ng seller ang sarili niyang rank mula sa phone/browser.
- Lalabas ang maliit at responsive na badge sa phone at laptop nang hindi tinatakpan ang store name, rating, o status.

## Pag-check
- Susubukan ang bawat threshold, lalo na ang eksaktong boundary values tulad ng ₱25,000 at ₱100,000.
- Susuriin ang seller dashboard, buyer store view, at public `/s/...` store page sa phone at laptop.
- Iche-check na hindi nakikita ng publiko ang total sales at hindi gumagalaw ang rank sa cancelled orders.
- Iche-check ang app pagkatapos at ipo-push agad sa kasalukuyang GitHub repository.
