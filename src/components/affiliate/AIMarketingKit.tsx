import { useState, useCallback, useRef } from 'react';
import type { Affiliate } from '@/lib/affiliateAuth';
import {
  Store, ShoppingBag, Bike, Users, Sparkles, Loader2, Copy,
  CheckCheck, Download, Share2, Image as ImageIcon, FileText,
} from 'lucide-react';

type InviteType = 'seller' | 'buyer' | 'rider' | 'affiliate';

interface InviteConfig {
  label: string;
  icon: typeof Store;
  color: string;
  bgColor: string;
  borderColor: string;
  imagePrompt: string;
}

const INVITE_CONFIGS: Record<InviteType, InviteConfig> = {
  seller: {
    label: 'Mag-generate para sa SELLER Invite',
    icon: Store,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    imagePrompt:
      'A vibrant modern social media poster advertisement for a public market app, featuring friendly Filipino market vendors smiling, high-quality professional graphic design, 1:1 square ratio, clean layout',
  },
  buyer: {
    label: 'Mag-generate para sa BUYER Invite',
    icon: ShoppingBag,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    imagePrompt:
      'A fresh and modern social media ad banner for a grocery market delivery app, showing a box of fresh colorful vegetables, meat, and fruits delivered at a modern Filipino home doorstep, digital illustration, bright lighting, 1:1 square ratio',
  },
  rider: {
    label: 'Mag-generate para sa RIDER Invite',
    icon: Bike,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    imagePrompt:
      'A delivery rider wearing a modern uniform with a motorcycle, smiling confidently, professional advertising poster style for an app, energetic vibe, 1:1 square ratio',
  },
  affiliate: {
    label: 'Mag-generate para sa AFFILIATE Invite',
    icon: Users,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    imagePrompt:
      'A modern visual concept of online earning and remote work in the Philippines, a cheerful Filipino holding a smartphone displaying a banking income dashboard with modern digital layout, colorful high-quality graphic design, 1:1 square ratio',
  },
};

// ============ TEXT TEMPLATES (5+ per category) ============

const SELLER_TEMPLATES: string[] = [
  `🛒🔥 MGA SUKI, GUSTO MO BANG LUMAKI ANG BENTA KAHIT NASA BAHAY LANG? 🔥🛒

Kumusta mga ka-seller! 📈 Naisip mo na ba kung paano makarating ang mga produkto mo sa mas maraming tao kahit nasa bahay ka lang?

Ang GoPalengke ay ang sagot! 🎯✨

Ito ang mga benepisyo kapag naging seller ka:
✅ Libreng pag-setup ng online na tindahan
✅ Makarating ang mga produkto sa buong komunidad
✅ Walang hassle sa pag-manage — lahat nasa app!
✅ Mas malawak na market, mas malaking kita! 💰
✅ Real-time na order notifications
✅ Cashless o COD — ikaw ang pipili! 💵

Huwag nang magtiis sa mabagal na benta sa palengke. Mag-online na at dumami ang customers mo! 📱💪

📌 Klik ang link para mag-sign up ngayon:
__LINK__

Sali na at simulan ang paglago ng negosyo mo! 🚀🛍️

#GoPalengke #OnlinePalengke #SellerInvite #PalengkeOnline #NegosyoOnline #DagdagKita`,

  `💰 NAWAWALA ANG MGA SUKI DAHIL SA PANDEMIA? HINDI NA KAILANGAN MAGTIIS! 💰

Kuwento ko lang sa inyo — kilala ko si Aling Nena, vendor sa palengke ng 15 taon. Laging kapos ang benta, laging masikip ang palengke. Hanggang sumali siya sa GoPalengke. 🌟

Ito ang nangyari:
📊 Tumindi ang benta ng 300% sa loob ng 2 buwan!
📱 Lahat ng order pumapasok sa phone niya
🚚 May rider na nagdedeliver — hindi na siya nag-aabala!
💵 Cashless payments, walang nangungupit!

Ito ang mga benepisyo:
✅ Walang puhunan, libreng registration
✅ I-set up ang tindahan sa 5 minuto
✅ Tumanggap ng order kahit natutulog ka!
✅ Makarating sa buyers sa buong barangay

Huwag nang magtiis sa lumang paraan. Mag-GO Palengke na! 📲💪

📌 Mag-sign up bilang seller dito:
__LINK__

#GoPalengke #NegosyoOnline #SellerStory #PalengkeOnline #OnlineBusiness`,

  `🏪 GUSTO MO BANG MAGING "DIGITAL SELLER" NGUNIT WALANG KAPITAL? 📱🏪

Oo, tama ka nga! Libreng sumali sa GoPalengke! 💯

Kung ikaw ay:
🥬 Nagbebenta ng gulay sa palengke
🥩 May karinderya o meat shop
🐟 Fish vendor
🍌 Prutas vendor
🍳 Ulam o kakanin maker

Ito ang mangyayari kapag sumali ka:
1️⃣ Mag-set up ka ng online store — LIBRE!
2️⃣ Lalabas ang products mo sa app
3️⃣ Mag-order ang buyers sa phone nila
4️⃣ May rider na magdedeliver
5️⃣ Tatanggapin mo ang payment — cash o cashless! 💵

Walang rental, walang abono, walang hassle! 🎉

Kumita ng malaki habang nasa bahay ka lang. Ito na ang bagong palengke — digital na! 🚀

📌 Sali na bilang seller:
__LINK__

#GoPalengke #DigitalSeller #FreeOnlineStore #PalengkeOnline #KumitaOnline #WalangPuhunan`,

  `🚀 BAKIT NAGIGING "SMART SELLER" ANG MGA VENDOR SA GOPALENGKE? 🚀

Mga ka-seller, alam niyo ba na mas maraming tao ang nag-o-online shopping ngayon kaysa sa pumupunta sa palengke? 📊

Kaya naman ang GoPalengke ay ginawa para sa inyo! 💡

Ano ang pagkakaiba ng GoPalengke sa tradisyonal na palengke?
❌ Tradisyonal: Mahirap, maalikabok, limited na oras
✅ GoPalengke: Online 24/7, walang sakit, walang oras na limitado!

❌ Tradisyonal: Kailangan pumunta ang buyer sa palengke
✅ GoPalengke: Hatid mo ang produkto sa pinto nila!

❌ Tradisyonal: Cash lang, may risk ng nakawan
✅ GoPalengke: Cashless o COD, safe at secure!

❌ Tradisyonal: Limited sa barangay lang ang customers
✅ GoPalengke: Buong komunidad ang market mo!

Huwag nang mahirap. Mag-GO Palengke na at maging "Smart Seller"! 📱✨

📌 Klik para mag-sign up:
__LINK__

#GoPalengke #SmartSeller #OnlinePalengke #DigitalPalengke #NegosyoTech #SellerUpgrade`,

  `⏰ ORAS MO NA PARA UMASALTO ANG NEGOSYO MO! ⏰

Mga vendor, ang oras na ito ay para sa inyo! 📣

Bakit? Dahil ang GoPalengke ay nagbibigay ng:
🎯 Libreng online storefront — walang rental, walang abono
🎯 Real-time order management — alam mo kung kailan may order
🎯 Built-in delivery system — may rider na nagdedeliver para sa'yo
🎯 Cashless payments — safe at walang issue
🎯 Analytics dashboard — alam mo kung anong products ang bumenta

Ito ang mga success stories ng mga vendor na sumali:
📊 Si Mang Tonyo — 200% increase sa benta ng isda
📊 Si Aling Carmen — 150% increase sa benta ng gulay
📊 Si Boyet — may 50+ orders kada araw sa ulam niya

Kaya naman, huwag nang magtiis sa mabagal na benta. Mag-GO Palengke na! 🚀💪

📌 Klik ang link para maging seller:
__LINK__

#GoPalengke #SellerSuccess #OnlineStore #PalengkeOnline #NegosyoGrowth #DigitalVendor`,
];

const BUYER_TEMPLATES: string[] = [
  `🥬🥩 GUSTO MO BA NG SARIWANG REKADO PERO TAMAD LUMABAS? SAGOT KA NG GOPALENGKE! 🍅🍗

Mga kaibigan! 🏠 Gusto mo bang makakuha ng sariwang gulay, karne, at prutas nang hindi mo na kailangan pang pumunta sa palengke?

Ang GoPalengke ay dito na! 🛵✨

Bakit mo subukan?
🥬 Sariwang gulay at prutas direkta sa palengke
🥩 Preskong karne, hindi tinatagalan
🚫 Iwas-traffic, iwas-pagod, iwas-init!
📱 Mag-order ka lang sa app, hatid na sa pinto mo
⏰ Mabilis na delivery, walang antay-antay
💰 Presyong palengke, walang dagdag!

Huwag na mahirap sa pagbili ng pagkain. Sa GoPalengke, lahat ng sariwa ay isang tapik lang! 👆📲

📌 Klik ang link para mag-sign up at makapag-order na:
__LINK__

Sali na at tamasahin ang convenience! 🎉🛒

#GoPalengke #PalengkeDelivery #FreshVeggies #SariwangRekado #IwasTraffic #OnlinePalengke #HomeDelivery`,

  `🚦 INIWAN MO NA BA ANG PALENGKE DAHIL SA TRAFFIC? HINDI MO NA KAILANGAN! 🚦

Alam ko ang feeling — gumising ka ng maaga, mag-commute, magtiis sa traffic, mag-alikabok sa palengke, tapos uwi ka pa ng pagod. 😤

Pero ngayon, may mas madaling paraan! 🎉

Sa GoPalengke, ganito ka-simple:
1️⃣ Buksan ang app sa phone mo 📱
2️⃣ Piliin ang mga produkto — gulay, karne, prutas, ulam! 🥬🥩
3️⃣ I-checkout at maghintay sa bahay 🛋️
4️⃣ Hatid na sa pinto mo ng rider! 🛵

Walang traffic, walang pagod, walang alikabok! ✨

At ang presyo? Presyong palengke! Walang dagdag! 💰

Kaya naman, huwag nang magtiis. Mag-GO Palengke na! 📲

📌 Mag-sign up at makapag-order na:
__LINK__

#GoPalengke #IwasTraffic #FreshDelivery #PalengkeOnline #TamadLumabas #HomeDeliveryPH`,

  `🍳 GUSTO MO BANG MAGLUTO NG MASARAP PERO WALANG KANG REKADO? 🍳

Mga kaibigan, nangyari na ba sa inyo — gusto mong magluto ng masarap na ulam, pero wala kang sariwang rekado? 🤔

Huwag mag-alala! Ang GoPalengke ay dito na! 🛵✨

Pumili ka lang ng:
🥬 Sariwang gulay — petsay, repolyo, talong, kamatis
🥩 Preskong karne — baboy, baka, manok
🐟 Isda — bangus, tilapia, galunggong
🍌 Prutas — saging, mangga, papaya
🍳 Ulam — adobo, sinigang, kare-kare

Lahat ng ito ay direkta sa palengke, hatid sa pinto mo! 🚪

At ang pinakamaganda? Mura pa! Presyong palengke! 💰

Kaya naman, huwag nang magtiis sa "wala akong rekado" na excuse. Mag-GO Palengke na! 📲

📌 Klik para mag-sign up at makapag-order:
__LINK__

#GoPalengke #FreshIngredients #LutoKangSariwa #PalengkeOnline #SariwangRekado #HomeCooking`,

  `📱 ANG PALENGKE AY NASA BULSA MO NA! 📱

Mga kaibigan, alam niyo ba na hindi na kailangan pumunta sa palengke para makabili ng sariwang pagkain? 🎉

Ang GoPalengke ay ang unang app sa Pilipinas na nagdadala ng palengke direkta sa bahay mo! 🏠✨

Ganito ka-simple:
📱 Buksan ang app
🛒 Piliin ang mga produkto
💳 Mag-checkout (cash o cashless!)
🛵 Hintayin ang delivery

Ito ang mga benepisyo:
✅ Sariwang produkto direkta sa palengke
✅ Walang traffic, walang pagod
✅ Presyong palengke, walang dagdag
✅ Mabilis na delivery
✅ Cashless o COD — ikaw ang pipili

Huwag nang mahirap. Ang palengke ay nasa phone mo na! 📲

📌 Klik para mag-sign up:
__LINK__

#GoPalengke #PalengkeSaPhone #OnlinePalengke #FreshDelivery #IwasTraffic #DigitalPalengke`,

  `🌧️ UMUULAN AT AYAW MO LUMABAS? GOSYONG GOPALENGKE NA! 🌧️

Mga kaibigan, nangyari na ba sa inyo — umuulan, gusto mong magluto, pero wala kang sariwang rekado? 🌧️

Huwag mag-alala! Ang GoPalengke ay dito na! 🛵✨

Kahit umuulan, kahit mainit, kahit tamad ka — pwede mong ma-order ang:
🥬 Sariwang gulay
🥩 Preskong karne
🐟 Isda
🍌 Prutas
🍳 Ulam at kakanin

Direkta sa palengke, hatid sa pinto mo! 🚪

At ang presyo? Presyong palengke! Walang dagdag! 💰

Kaya naman, huwag nang magtiis sa gutom. Mag-GO Palengke na! 📲

📌 Klik para mag-sign up at makapag-order:
__LINK__

#GoPalengke #UlanPeroMayPagkain #PalengkeOnline #FreshDelivery #IwasTraffic #HomeDelivery`,
];

const RIDER_TEMPLATES: string[] = [
  `🏍️💨 MAY MOTOR KA BA AT GUSTONG KUMITA NANG MALAKI ARAW-ARAW? 💰🏍️

Mga rider! 🙋‍♂️ Gusto mo bang kumita nang malaki gamit ang motor mo habang tumutulong sa komunidad?

Ang GoPalengke ay naghahanap ng mga delivery rider! 🚀✨

Bakit sali ka na?
💰 Magandang kitaan — kumita kada delivery!
⏰ Flexible na oras — ikaw ang boss ng schedule mo
📱 Madaling gamiting app, walang komplikado
🛵 Gamitin ang sarili mong motor
🏆 Maging bayani sa komunidad — hatid mo ang sariwang pagkain sa pamilya!
📈 Maraming order, maraming kita!

Huwag nang maghanap ng ibang trabaho. Dito sa GoPalengke, ang motor mo ay pera! 💵🏍️

📌 Klik ang link para mag-sign up bilang rider:
__LINK__

Sali na at simulang kumita ngayon! 🙌💪

#GoPalengke #RiderJobs #DeliveryRider #MotorKita #TrabahoOnline #KumitaSaMotor #GoPalengkeRider`,

  `🛵 NAGIGING "HERO" ANG MGA RIDER SA GOPALENGKE! 🛵

Mga kaibigan, alam niyo ba na ang pagiging rider ay hindi lang trabaho — ito ay pagiging "HERO" sa komunidad? 🦸‍♂️

Bakit? Dahil ang GoPalengke riders ay:
🏆 Naghahatid ng sariwang pagkain sa pamilya
🏆 Tumutulong sa mga vendor na lumago ang negosyo
🏆 Binibigyan ng convenience ang mga buyers

At ang pinakamaganda? Kumikita ka pa! 💰

Ito ang mga benepisyo:
✅ Kumita ng ₱500-₱1000+ kada araw
✅ Flexible na oras — part-time o full-time
✅ Gamitin ang sarili mong motor
✅ Walang puhunan, libreng registration
✅ Mabilis na payout, walang antay

Kaya naman, huwag nang magtiis sa walang trabaho. Maging "GoPalengke Rider Hero" na! 🚀

📌 Klik para mag-sign up bilang rider:
__LINK__

#GoPalengke #RiderHero #DeliveryJob #MotorKita #TrabahoOnline #CommunityHero`,

  `📈 GUSTO MO BANG KUMITA HABANG NATUTULOG? 📈

Mga rider, alam niyo ba na pwede kayong kumita sa GoPalengke kahit part-time lang? 🤔

Ganito ka-simple:
1️⃣ Mag-sign up bilang rider 📱
2️⃣ Buksan ang app kung kailan mo gusto
3️⃣ Tanggapin ang orders na gusto mo
4️⃣ I-deliver at kumita! 💰

Walang quota, walang minimum hours. Ikaw ang boss! 🎯

Ito ang mga benepisyo:
✅ ₱50-₱150 kada delivery
✅ 10-20 deliveries kada araw = ₱500-₱3000!
✅ Cashless payments, safe at secure
✅ Real-time na order tracking
✅ Flexible na oras — araw, gabi, o weekend!

Kaya naman, huwag nang maghanap ng ibang trabaho. Mag-GO Palengke Rider na! 🚀🏍️

📌 Klik para mag-sign up:
__LINK__

#GoPalengke #RiderJobs #PartTimeJob #MotorKita #KumitaOnline #FlexibleWork`,

  `🏍️ ANG MOTOR MO AY PERA! 🏍️

Mga kaibigan, naisip mo na ba kung gaano karaming pera ang nawawala sa'yo dahil nakatayo lang ang motor mo sa garaje? 🤔

Kung ikaw ay:
✅ May sariling motor
✅ May driver's license
✅ Gustong kumita ng extra income
✅ 18+ years old

Ang GoPalengke Rider Program ay para sa'yo! 🎯

Ito ang mangyayari:
📱 Mag-sign up sa app
🛵 Tanggapin ang orders
💰 Kumita kada delivery!

At ang pinakamaganda?
✅ Walang puhunan
✅ Walang monthly fee
✅ Flexible na oras
✅ Maraming order araw-araw

Huwag nang paghintay. Ang motor mo ay pera! 💵🏍️

📌 Klik para mag-sign up bilang rider:
__LINK__

#GoPalengke #MotorPera #RiderJobs #KumitaSaMotor #DeliveryRider #ExtraIncome`,

  `🚀 BAKIT NAGIGING "TOP EARNER" ANG MGA RIDER SA GOPALENGKE? 🚀

Mga rider, alam niyo ba na ang mga riders sa GoPalengke ay kumikita ng higit sa ₱10,000 kada buwan? 💰

Paano? Dahil ang GoPalengke ay:
✅ Maraming orders araw-araw
✅ Mataas na rate kada delivery
✅ Bonus at incentives para sa top riders
✅ Real-time na order dispatch
✅ Cashless payments — walang issue sa pera

Ito ang mga benepisyo:
📊 ₱500-₱1000+ kada araw
📊 Flexible na oras — ikaw ang pipili
📊 Gamitin ang sarili mong motor
📊 Walang puhunan, libreng registration
📊 Maging bayani sa komunidad

Kaya naman, huwag nang magtiis sa mababang kita. Maging "Top Earner" sa GoPalengke! 📈🏍️

📌 Klik para mag-sign up:
__LINK__

#GoPalengke #TopEarner #RiderJobs #HighIncome #MotorKita #DeliveryJobPH`,
];

const AFFILIATE_TEMPLATES: string[] = [
  `💸📱 GUSTO MO BANG KUMITA GAMIT ANG FACEBOOK MO HABANG NASA BAHAY LANG? SALI NA BILANG GOPALENGKE AFFILIATE! 🏠💰

Mga kaibigan! 🤝 Naisip mo na ba kung paano kumita ng passive income gamit lang ang cellphone at Facebook mo?

Ang GoPalengke Affiliate Program ay ang sagot! 🎯✨

Paano ito gumagana?
📋 I-share ang referral link mo sa Facebook, TikTok, o kahit saan
👥 Kapag may nag-sign up bilang seller o rider gamit ang link mo...
💸 Makakakuha ka ng komisyon sa bawat milestone na maabot nila!
🔥 2-Tier system — kumita ka rin sa mga tao na ni-refer ng mga na-refer mo!
📈 Walang limit sa kikita — habang lumalago ang network mo, lumalago rin ang kita!
🆓 Libre sumali, walang puhunan!

Ito ang pinakamadaling paraan para kumita online sa Pilipinas! 🇵🇭💵

📌 Klik ang link para maging affiliate ngayon:
__LINK__

Sali na at simulan ang pag-build ng passive income mo! 🚀💸

#GoPalengke #AffiliateProgram #PassiveIncome #KumitaOnline #WorkFromHome #DagdagKita #OnlineBusiness`,

  `🤔 NAPAPANSIN MO BA NA MARAMI KA NANG FACEBOOK FRIENDS PERO WALA KANG KITA MULA SA KANILA? 🤔

Mga kaibigan, alam niyo ba na pwede mong gawing pera ang Facebook mo? 💰

Ang GoPalengke Affiliate Program ay ang sagot! 🎯

Ganito ka-simple:
1️⃣ Mag-sign up bilang affiliate — LIBRE! 🆓
2️⃣ Kumuha ng referral link mo 📎
3️⃣ I-share sa Facebook, TikTok, o kahit saan 📱
4️⃣ Kapag may nag-sign up... KUMITA KA! 💸

Ito ang kita mo:
💰 ₱150 kada seller na maabot ang milestone
💰 ₱35 kada rider na maabot ang milestone
💰 Tier 2 override — kumita ka rin sa mga na-refer ng mga na-refer mo!

Walang limit! Habang lumalago ang network mo, lumalago ang kita! 📈

Kaya naman, huwag nang magtiis sa walang pera. Mag-GO Palengke Affiliate na! 🚀

📌 Klik para mag-sign up:
__LINK__

#GoPalengke #Affiliate #FacebookPera #PassiveIncome #KumitaOnline #WorkFromHome`,

  `🔥 ANG PINAKAMADALING PARAAN PARA KUMITA ONLINE SA PILIPINAS! 🔥

Mga kaibigan, kung naghahanap ka ng "passive income" na totoo at legit, ito na! 💯

Ang GoPalengke Affiliate Program ay:
✅ 100% LIBRE — walang puhunan, walang fee
✅ 2-TIER SYSTEM — kumita ka sa sarili mo at sa mga downline mo
✅ FLEXIBLE — gawin mo sa sarili mong oras
✅ UNLIMITED — walang limit sa kikita
✅ LEGIT — totoong komisyon, totoong pera

Paano?
📱 I-share ang link mo sa Facebook
👥 Kapag may nag-sign up bilang seller/rider
💸 Makakakuha ka ng komisyon sa bawat milestone!

Ito ang halimbawa:
📊 10 sellers × ₱150 = ₱1,500
📊 10 riders × ₱35 = ₱350
📊 Tier 2: 50 referrals × ₱50 = ₱2,500
TOTAL: ₱4,350+ kada buwan! 💰

Huwag nang magtiis sa walang pera. Sali na! 🚀

📌 Klik para maging affiliate:
__LINK__

#GoPalengke #AffiliateProgram #PassiveIncomePH #KumitaOnline #LegitOnlineJob #WorkFromHomePH`,

  `📱 KUNG GUSTO MO BANG KUMITA GAMIT LANG ANG CELLPHONE MO, ITO ANG SAGOT! 📱

Mga kaibigan, alam niyo ba na pwede kayong kumita ng libo-libo kada buwan gamit lang ang Facebook at cellphone niyo? 🤔

Ang GoPalengke Affiliate Program ay ang sagot! 💡

Heto ang mga benepisyo:
🆓 Libreng registration — walang puhunan
📋 Madali lang — i-share ang link mo
💸 Komisyon sa bawat milestone ng referrals
🔥 2-Tier system — kumita ka rin sa mga downline mo
📈 Unlimited na kita — habang lumalago ang network, lumalago ang pera
⏰ Walang oras na limitado — gawin mo sa sarili mong pace

Ito ang magandang halimbawa:
Kung makapag-refer ka ng 20 sellers at 20 riders...
💰 20 sellers × ₱150 = ₱3,000
💰 20 riders × ₱35 = ₱700
💰 Tier 2 bonuses = ₱1,000+
TOTAL: ₱4,700+ kada buwan! 💵

At pwede pa itong lumaki! 📈

Kaya naman, huwag nang magtiis. Sali na! 🚀

📌 Klik para mag-sign up:
__LINK__

#GoPalengke #Affiliate #CellphonePera #KumitaSaFacebook #PassiveIncome #OnlineJobPH`,

  `🚀 GUSTO MO BANG MAGKAROON NG "PASSIVE INCOME" NA TOTOO AT LEGIT? 🚀

Mga kaibigan, ang "passive income" ay hindi lang pang-dream. Ito ay totoo sa GoPalengke! 💯

Ang GoPalengke Affiliate Program ay ang pinakamadaling paraan para kumita online sa Pilipinas! 🇵🇭

Paano ito gumagana?
1️⃣ Mag-sign up bilang affiliate — LIBRE! 🆓
2️⃣ Kumuha ng referral link mo 📎
3️⃣ I-share sa Facebook, TikTok, o kahit saan 📱
4️⃣ Kapag may nag-sign up... KUMITA KA! 💸

Ito ang kita mo:
💰 ₱150 kada seller na maabot ang milestone
💰 ₱35 kada rider na maabot ang milestone
💰 Tier 2 override — kumita ka rin sa mga na-refer ng mga na-refer mo!

Walang limit! Habang lumalago ang network mo, lumalago ang kita! 📈

Kaya naman, huwag nang magtiis sa walang pera. Mag-GO Palengke Affiliate na! 🚀

📌 Klik para mag-sign up:
__LINK__

#GoPalengke #AffiliateProgram #PassiveIncome #KumitaOnline #WorkFromHome #DagdagKita #OnlineBusiness`,
];

const TEMPLATE_MAP: Record<InviteType, string[]> = {
  seller: SELLER_TEMPLATES,
  buyer: BUYER_TEMPLATES,
  rider: RIDER_TEMPLATES,
  affiliate: AFFILIATE_TEMPLATES,
};

function randomSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

function pickRandomTemplate(type: InviteType, link: string, affiliateName: string): string {
  const templates = TEMPLATE_MAP[type];
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace(/__LINK__/g, link);
}

function buildPollinationsUrl(prompt: string, seed: string): string {
  const separator = prompt.includes('?') ? '&' : '?';
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}${separator}seed=${seed}`;
}

export function AIMarketingKit({ affiliate }: { affiliate: Affiliate }) {
  const [activeType, setActiveType] = useState<InviteType | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [genCount, setGenCount] = useState(0);
  const imgLoaderRef = useRef<HTMLImageElement | null>(null);

  const referralLink = `${window.location.origin}/?ref=${affiliate.referral_code}`;
  const affiliateLink = `${window.location.origin}/affiliate?aff_ref=${affiliate.referral_code}`;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const generate = useCallback(
    (type: InviteType) => {
      const config = INVITE_CONFIGS[type];
      setActiveType(type);
      setImageUrl(null);
      setText('');
      setImageLoading(true);
      setTextLoading(true);

      const link = type === 'affiliate' ? affiliateLink : referralLink;
      const fullText = pickRandomTemplate(type, link, affiliate.full_name);

      // Simulate text generation delay for UX
      setTimeout(() => {
        setText(fullText);
        setTextLoading(false);
      }, 600);

      // Generate image via Pollinations.ai with random seed
      const seed = randomSeed();
      const url = buildPollinationsUrl(config.imagePrompt, seed);

      // Cancel previous image loader if any
      if (imgLoaderRef.current) {
        imgLoaderRef.current.src = '';
      }

      const img = new Image();
      imgLoaderRef.current = img;
      img.onload = () => {
        if (imgLoaderRef.current === img) {
          setImageUrl(url);
          setImageLoading(false);
        }
      };
      img.onerror = () => {
        if (imgLoaderRef.current === img) {
          setImageLoading(false);
        }
      };
      img.src = url;

      setGenCount((c) => c + 1);
    },
    [referralLink, affiliateLink, affiliate.full_name],
  );

  function copyText() {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast('Na-copy na ang text sa clipboard!');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareToFacebook() {
    if (!text) return;
    const shareUrl = activeType === 'affiliate' ? affiliateLink : referralLink;
    const fbText = encodeURIComponent(text);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${fbText}`,
      '_blank',
      'width=600,height=400',
    );
  }

  async function downloadImage() {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `gopalengke_${activeType}_poster_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast('Na-download na ang larawan!');
    } catch {
      window.open(imageUrl, '_blank');
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-gray-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          {toast}
        </div>
      )}

      {/* AI Marketing Kit Generator Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-white text-base">AI Marketing Kit Generator</h2>
              <p className="text-green-100 text-xs">Bawat click = panibagong post at poster! Infinite generator.</p>
            </div>
            {genCount > 0 && (
              <span className="text-[10px] bg-white/20 text-white px-2 py-1 rounded-full font-medium">
                {genCount} generated
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(Object.keys(INVITE_CONFIGS) as InviteType[]).map((type) => {
              const config = INVITE_CONFIGS[type];
              const Icon = config.icon;
              const isActive = activeType === type;
              return (
                <button
                  key={type}
                  onClick={() => generate(type)}
                  disabled={imageLoading || textLoading}
                  className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl border-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                    isActive
                      ? `${config.bgColor} ${config.borderColor} ${config.color}`
                      : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white`}>
                    <Icon size={18} className={isActive ? config.color : 'text-gray-400'} />
                  </div>
                  <span className="text-left flex-1">{config.label}</span>
                  {isActive && !imageLoading && !textLoading && (
                    <Sparkles size={16} className={config.color} />
                  )}
                </button>
              );
            })}
          </div>
          {activeType && !imageLoading && !textLoading && (
            <p className="text-center text-xs text-gray-400">
              Pindutin ulit ang parehong button para sa panibagong post at poster!
            </p>
          )}
        </div>

        {/* Results: Two-Column Layout */}
        {(activeType || imageLoading || textLoading) && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LEFT COLUMN: Image */}
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <ImageIcon size={16} className="text-gray-500" />
                  <h3 className="text-sm font-bold text-gray-700">AI Generated Poster</h3>
                </div>

                <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center relative">
                  {imageLoading ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Loader2 size={28} className="animate-spin" />
                      <p className="text-xs">Gumagawa ng bagong larawan...</p>
                    </div>
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="AI Generated Poster"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <ImageIcon size={28} />
                      <p className="text-xs">Pumili ng type sa taas</p>
                    </div>
                  )}
                </div>

                {imageUrl && !imageLoading && (
                  <button
                    onClick={downloadImage}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-gray-700 text-white rounded-xl text-xs font-semibold active:scale-95 transition"
                  >
                    <Download size={15} /> I-download ang Larawan
                  </button>
                )}
              </div>

              {/* RIGHT COLUMN: Text */}
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <FileText size={16} className="text-gray-500" />
                  <h3 className="text-sm font-bold text-gray-700">AI Generated Post</h3>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-3 min-h-[200px] max-h-[300px] overflow-y-auto">
                  {textLoading ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-400 py-8">
                      <Loader2 size={24} className="animate-spin" />
                      <p className="text-xs">Nag-iisip ang AI...</p>
                    </div>
                  ) : text ? (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 text-gray-400 py-8">
                      <FileText size={24} />
                      <p className="text-xs">Pumili ng type sa taas</p>
                    </div>
                  )}
                </div>

                {text && !textLoading && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={copyText}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition"
                    >
                      {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                      {copied ? 'Na-copy na!' : 'Kopyahin ang Text'}
                    </button>
                    <button
                      onClick={shareToFacebook}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition"
                    >
                      <Share2 size={15} /> I-share sa Facebook
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
