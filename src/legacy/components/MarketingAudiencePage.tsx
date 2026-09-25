// @ts-nocheck
import { useMemo } from 'react';
import {
  ArrowRight, BadgeCheck, Bike, Check, ChevronRight, CircleDollarSign,
  Clock3, Headphones, Infinity as InfinityIcon, MapPin, MessageCircle,
  PackageCheck, Route, Share2, ShieldCheck, ShoppingBasket, Smartphone, Star,
  Store, Target, TrendingUp, Truck, Users, WalletCards,
} from 'lucide-react';
import { navigate } from '../lib/router';

type Audience = 'seller' | 'rider' | 'buyer' | 'affiliate';

type PageConfig = {
  audience: Audience;
  eyebrow: string;
  title: string;
  accent: string;
  summary: string;
  image: string;
  imageAlt: string;
  cta: string;
  fitTitle: string;
  fitItems: string[];
  benefitsTitle: string;
  benefits: Array<{ icon: typeof Store; title: string; description: string }>;
  steps: Array<{ title: string; description: string }>;
  proofTitle: string;
  proof: string;
  finalTitle: string;
  finalCopy: string;
};

const CONFIGS: Record<Audience, PageConfig> = {
  seller: {
    audience: 'seller',
    eyebrow: 'Para sa mga nagtitinda',
    title: 'Dalhin ang paninda mo sa mas maraming mamimili.',
    accent: 'Online tindahan na gawa para sa palengke.',
    summary: 'May pwesto ka man sa palengke, may farm, home-based food business, o nagbebenta ng produktong pang-araw-araw, puwede mong ilagay ang paninda mo sa GoPalengke at tumanggap ng orders sa phone.',
    image: '/images/gopalengke-seller-marketing.jpg',
    imageAlt: 'Tinderang Pilipina na may sariwang paninda at online store sa phone',
    cta: 'Gumawa ng seller account',
    fitTitle: 'Sino ang puwedeng magbenta?',
    fitItems: ['Mga tindero at tindera sa palengke', 'Farmers at direct producers', 'Home-based ulam, kakanin, at food sellers', 'Nagbebenta ng isda, karne, gulay, prutas, bigas, itlog, frozen goods, bakery, spices, at iba pang kaugnay na paninda'],
    benefitsTitle: 'Bakit sulit para sa seller?',
    benefits: [
      { icon: Smartphone, title: 'Sariling online store', description: 'Ipakita ang pangalan ng tindahan, lokasyon, larawan, presyo, stock, at availability ng bawat produkto.' },
      { icon: Users, title: 'Mas madaling mahanap', description: 'Makikita ng buyers ang verified at bukas na tindahan at makakapili sila ayon sa produkto at lokasyon.' },
      { icon: PackageCheck, title: 'Ayos ang order workflow', description: 'Tanggapin at i-update ang order mula pending hanggang ready for pickup sa seller dashboard.' },
      { icon: MessageCircle, title: 'Direktang usapan', description: 'May in-app chat at video call para malinaw ang order at puwedeng makita ng buyer ang produkto bago delivery.' },
      { icon: Truck, title: 'May delivery network', description: 'Kapag ready na ang order, puwedeng kunin at ihatid ng GoPalengke rider sa buyer.' },
      { icon: WalletCards, title: 'Flexible na bayaran', description: 'Maaaring maghanda ng QR payment at tumanggap ng suportadong cashless o COD orders.' },
    ],
    steps: [
      { title: 'Mag-sign up bilang Seller', description: 'Ilagay ang basic contact at location details at i-verify ang email.' },
      { title: 'I-set up ang tindahan', description: 'Ilagay ang pangalan, produkto, presyo, stock, at paraan ng bayad.' },
      { title: 'Kumpletuhin ang verification', description: 'Dadaan sa admin chat o video verification bago makita ng buyers ang tindahan.' },
      { title: 'Tumanggap at maghanda ng orders', description: 'I-manage ang orders at makipag-usap sa buyer mula sa seller dashboard.' },
    ],
    proofTitle: 'Tiwala ang pundasyon ng marketplace',
    proof: 'Hindi basta lumalabas ang bagong tindahan. Kailangan muna itong ma-verify ng admin, kaya mas may kumpiyansa ang buyers sa mga nakikita nilang seller.',
    finalTitle: 'Handa ka nang gawing online ang paninda mo?',
    finalCopy: 'Simulan ang seller account at dalhin ang tunay na palengke experience sa phone ng mga mamimili.',
  },
  rider: {
    audience: 'rider',
    eyebrow: 'Para sa delivery riders',
    title: 'Kumita sa paghatid ng tunay na orders sa inyong lugar.',
    accent: 'May malinaw na delivery flow sa phone.',
    summary: 'Kung may motorsiklo, tricycle o bao-bao, o minivan ka, puwede kang sumali bilang rider at humawak ng deliveries na angkop sa kapasidad ng sasakyan mo.',
    image: '/images/gopalengke-rider-marketing.jpg',
    imageAlt: 'GoPalengke rider na may motorsiklo at sariwang grocery delivery',
    cta: 'Gumawa ng rider account',
    fitTitle: 'Anong sasakyan ang puwede?',
    fitItems: ['Motorcycle para sa magagaan na orders', 'Tricycle o bao-bao para sa mas malaking karga', 'Minivan para sa bulk at mabibigat na deliveries', 'Riders na may smartphone at handang bumiyahe sa kanilang lugar'],
    benefitsTitle: 'Bakit sulit para sa rider?',
    benefits: [
      { icon: Route, title: 'Organisadong delivery jobs', description: 'Makikita sa rider dashboard ang available at kasalukuyang deliveries, history, at detalye ng order.' },
      { icon: MapPin, title: 'May navigation at location', description: 'May mapa, pickup at delivery details, at live location tools para mas maayos ang biyahe.' },
      { icon: CircleDollarSign, title: 'Kita mula sa delivery fee', description: 'Ang delivery fee ay kinakalkula ayon sa distansya, bigat, lugar, at kinakailangang sasakyan.' },
      { icon: Bike, title: 'Tamang karga sa sasakyan', description: 'Pinipili ang vehicle class sa signup para maitugma ang delivery sa kapasidad ng rider.' },
      { icon: MessageCircle, title: 'Madaling koordinasyon', description: 'May in-app chat sa buyer at admin support para sa tanong, pickup, at delivery concerns.' },
      { icon: Star, title: 'Makabuo ng magandang record', description: 'May delivery history at reviews na tumutulong ipakita ang maayos mong serbisyo.' },
    ],
    steps: [
      { title: 'Mag-sign up bilang Rider', description: 'Ilagay ang contact, location, at piliin ang sasakyang gagamitin.' },
      { title: 'Hintayin ang approval', description: 'Susuriin muna ng admin ang rider account bago ito maging aktibo.' },
      { title: 'Pumili at tanggapin ang delivery', description: 'Tingnan ang pickup, destination, order details, at delivery fee.' },
      { title: 'Ihatid at kumpletuhin', description: 'Gamitin ang navigation at status updates hanggang makumpirma ang delivery.' },
    ],
    proofTitle: 'Hindi hulaan ang bayad at biyahe',
    proof: 'May delivery calculation batay sa lokasyon, distansya, bigat, at vehicle tier. Nakikita rin ang delivery records at billing sa sariling dashboard.',
    finalTitle: 'Gawing dagdag pagkakakitaan ang iyong sasakyan.',
    finalCopy: 'Sumali bilang rider at tumulong maghatid ng sariwang paninda mula palengke hanggang bahay.',
  },
  buyer: {
    audience: 'buyer',
    eyebrow: 'Para sa mga mamimili',
    title: 'Mamili sa palengke nang hindi umaalis ng bahay.',
    accent: 'Sariwang paninda, verified sellers, at delivery sa isang app.',
    summary: 'Mag-browse ng isda, karne, gulay, prutas, bigas, itlog, ulam, kakanin, at iba pang pang-araw-araw na paninda mula sa mga tindahang malapit sa iyo.',
    image: '/images/gopalengke-buyer-marketing.jpg',
    imageAlt: 'Mamimiling Pilipina na tumatanggap ng sariwang GoPalengke delivery',
    cta: 'Gumawa ng buyer account',
    fitTitle: 'Para kanino ang GoPalengke?',
    fitItems: ['Busy na pamilya at working professionals', 'Senior citizens at hirap bumiyahe', 'Mga gustong umiwas sa traffic, pila, init, at mabigat na bitbit', 'Mamimiling gustong makita muna ang seller, presyo, at reviews'],
    benefitsTitle: 'Bakit mas madaling mamili dito?',
    benefits: [
      { icon: ShoppingBasket, title: 'Maraming paninda sa isang lugar', description: 'Maghanap ayon sa kategorya, tindahan, produkto, presyo kada unit, at availability.' },
      { icon: BadgeCheck, title: 'Verified na mga tindahan', description: 'Tanging verified at bukas na stores ang ipinapakita sa marketplace para mas panatag ang pamimili.' },
      { icon: MessageCircle, title: 'Chat at video bago bumili', description: 'Makipag-usap sa seller at gamitin ang video call kung gusto mong makita o linawin ang produkto.' },
      { icon: Truck, title: 'Hatid sa address mo', description: 'May rider delivery, order status, live tracking map, at ETA habang papunta ang order.' },
      { icon: WalletCards, title: 'May pagpipilian sa bayad', description: 'Piliin ang suportadong QR payment o Cash on Delivery sa checkout.' },
      { icon: Star, title: 'Reviews mula sa users', description: 'Makita at makapagbigay ng ratings at reviews para sa seller at rider pagkatapos ng order.' },
    ],
    steps: [
      { title: 'Mag-sign up bilang Buyer', description: 'I-verify ang email at ilagay ang iyong lokasyon at delivery details.' },
      { title: 'Piliin ang paninda', description: 'Mag-browse ng verified stores at idagdag sa cart ang kailangan.' },
      { title: 'Mag-checkout', description: 'Kumpirmahin ang address, delivery fee, order, at paraan ng bayad.' },
      { title: 'Subaybayan ang delivery', description: 'Makipag-chat at tingnan ang status, rider location, at ETA hanggang dumating.' },
    ],
    proofTitle: 'Alam mo kung kanino galing ang order mo',
    proof: 'Makikita ang tindahan, lokasyon, presyo, reviews, at order progress. Puwede ka ring makipag-chat o video call para mas malinaw bago dumating ang delivery.',
    finalTitle: 'Ang susunod mong pamamalengke, puwedeng sa phone na.',
    finalCopy: 'Gumawa ng buyer account at mamili mula sa mga verified na tindahan ng GoPalengke.',
  },
  affiliate: {
    audience: 'affiliate',
    eyebrow: 'Para sa kapwa affiliate',
    title: 'I-promote ang GoPalengke — dito ang malaking kitaan.',
    accent: 'Lifetime 2-tier commission, walang limit.',
    summary: 'Hindi mo kailangang magtinda o maghatid. Ang trabaho mo ay mag-imbita: mag-refer ng sellers, riders, at kapwa affiliate. Kumita ka sa bawat milestone nila habang buhay — at mas lumalaki pa ang kita mo kapag ang mga naimbitahan mo ay may sariling mga referral na.',
    image: '/images/gopalengke-affiliate-marketing.jpg',
    imageAlt: 'Mga affiliate na masayang tumitingin ng kita sa phone sa gitna ng palengke',
    cta: 'Sumali bilang Affiliate',
    fitTitle: 'Sino ang puwedeng maging affiliate?',
    fitItems: [
      'Kahit sino — walang pwesto o paninda na kailangan',
      'Students at freelancers na gusto ng dagdag na kita',
      'Content creators at page admins na may audience',
      'Mga affiliate ng ibang platform na gusto ng lifetime commission',
    ],
    benefitsTitle: 'Magkano ang puwede mong kitain?',
    benefits: [
      { icon: Store, title: '₱150 kada seller milestone', description: 'Kada ₱1,000 na ma-collect mula sa seller na nirefer mo, ₱200 ang commission — ₱150 sa iyo (Tier 1). Halimbawa: ₱50,000 sales = ₱330 sa iyo.' },
      { icon: Bike, title: '₱35 kada rider milestone', description: 'Kada ₱500 na ma-collect mula sa rider na nirefer mo, ₱50 ang commission — ₱35 sa iyo (Tier 1). Halimbawa: 500 trips = ₱350 sa iyo.' },
      { icon: Users, title: '₱50 + ₱15 Tier 2 override', description: 'Kapag nag-invite ka ng kapwa affiliate, kikita ka ng ₱50 kada seller milestone at ₱15 kada rider milestone ng mga referral nila.' },
      { icon: InfinityIcon, title: 'Lifetime at walang limit', description: 'Habang aktibo ang mga nirefer mo sa GoPalengke, tuloy-tuloy ang commission mo — kahit minsan mo lang silang na-refer.' },
      { icon: Share2, title: 'Handa nang marketing pages', description: 'May ready-to-share pages para sa sellers, riders, at buyers na awtomatikong may referral code mo at Facebook share button.' },
      { icon: TrendingUp, title: 'Live na dashboard at calculator', description: 'Makikita mo agad sa affiliate dashboard ang milestones, kinita, referral links, at earnings calculator.' },
    ],
    steps: [
      { title: 'Mag-sign up bilang Affiliate', description: 'Kung may sponsor kang nag-imbita sa iyo, awtomatikong nakakabit ka sa kanya.' },
      { title: 'Kunin ang mga referral links mo', description: 'May link para sa sellers at riders, at isa pang link para sa kapwa affiliate.' },
      { title: 'I-share at mag-imbita', description: 'I-post sa Facebook o ipasa sa mga kilala mong nagtitinda, may sasakyan, o gusto ring kumita.' },
      { title: 'Kumita sa bawat milestone', description: 'Kapag may na-collect ang mga nirefer mo, kusang pumapasok ang commission sa dashboard mo.' },
    ],
    proofTitle: 'Totoong kita, hindi hula',
    proof: 'May commission lang kapag may aktwal na na-collect na halaga sa platform, at nakikita ang bawat milestone sa dashboard — kaya malinaw ang pagkalkula ng kita.',
    finalTitle: 'Ang malaking kitaan ay nasa pag-promote.',
    finalCopy: 'Sumali sa affiliate program at simulan ang lifetime 2-tier commission sa GoPalengke.',
  },
};

// Default to the admin affiliate account's code when the link has no ?ref=
// (e.g. https://www.gopalengke.net/para-sa-seller) so the admin still gets credit.
const DEFAULT_ADMIN_REFERRAL_CODE = '5F7249C1';

function getReferralCode() {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_REFERRAL_CODE;
  return new URLSearchParams(window.location.search).get('ref')?.trim() || DEFAULT_ADMIN_REFERRAL_CODE;
}

export function MarketingAudiencePage({ audience }: { audience: Audience }) {
  const config = CONFIGS[audience];
  const referralCode = useMemo(getReferralCode, []);

  function startSignup() {
    if (audience === 'affiliate') {
      sessionStorage.setItem('gopalengke_aff_ref_code', referralCode);
      const suffix = referralCode ? `?aff_ref=${encodeURIComponent(referralCode)}` : '';
      window.location.assign(`/affiliate${suffix}`);
      return;
    }
    if (referralCode) sessionStorage.setItem('gopalengke_ref_code', referralCode);
    const params = new URLSearchParams({ signup: audience });
    if (referralCode) params.set('ref', referralCode);
    window.location.assign(`/?${params.toString()}`);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-gray-50 text-gray-900">
      <header className="absolute inset-x-0 top-0 z-20 safe-top">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-white">
            <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="h-10 w-10 rounded-xl object-cover" />
            <span className="font-bold">GoPalengke</span>
          </button>
          <button type="button" onClick={startSignup} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 shadow-lg active:scale-95">
            Sumali
          </button>
        </div>
      </header>

      <section className="relative min-h-[86svh] overflow-hidden bg-gray-900">
        <img src={config.image} alt={config.imageAlt} width={1200} height={630} className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-gray-950/15" />
        <div className="relative mx-auto flex min-h-[86svh] max-w-6xl items-end px-5 pb-14 pt-28 sm:items-center sm:px-6 sm:pb-16">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-bold uppercase text-amber-300">{config.eyebrow}</p>
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">{config.title}</h1>
            <p className="mt-3 text-lg font-semibold text-green-300">{config.accent}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-200 sm:text-base">{config.summary}</p>
            <button type="button" onClick={startSignup} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 py-4 font-bold text-white shadow-xl active:scale-[0.98] sm:w-auto">
              {config.cta} <ArrowRight size={19} />
            </button>
            {referralCode && <p className="mt-3 text-xs text-gray-300">Referral code applied: <span className="font-mono font-bold text-white">{referralCode}</span></p>}
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-6 md:grid-cols-[0.75fr_1.25fr] md:items-start">
          <div>
            <p className="text-sm font-bold uppercase text-brand-600">Tamang-tama para sa iyo</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-gray-900">{config.fitTitle}</h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {config.fitItems.map((item) => <li key={item} className="flex gap-3 border-b border-gray-100 py-3 text-sm leading-6 text-gray-700"><Check size={19} className="mt-0.5 shrink-0 text-brand-600" />{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase text-brand-600">Mga advantage</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-gray-900">{config.benefitsTitle}</h2>
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {config.benefits.map(({ icon: Icon, title, description }) => (
              <article key={title} className="bg-white p-5 sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon size={22} /></div>
                <h3 className="mt-4 text-base font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-900 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <p className="text-sm font-bold uppercase text-green-300">Simple lang magsimula</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Paano ito gumagana?</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-4">
            {config.steps.map((step, index) => (
              <div key={step.title} className="border-t border-gray-700 pt-4">
                <span className="font-mono text-sm font-bold text-green-300">0{index + 1}</span>
                <h3 className="mt-3 font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-300">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-amber-300 py-10 sm:py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 sm:px-6 md:flex-row md:items-center">
          <ShieldCheck size={44} className="shrink-0 text-gray-900" />
          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">{config.proofTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-800">{config.proof}</p>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 text-center sm:py-20">
        <div className="mx-auto max-w-2xl px-5 sm:px-6">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">{config.finalTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">{config.finalCopy}</p>
          <button type="button" onClick={startSignup} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-7 py-4 font-bold text-white shadow-lg active:scale-[0.98] sm:w-auto">
            {config.cta} <ChevronRight size={19} />
          </button>
        </div>
      </section>

      <footer className="bg-gray-950 px-5 py-7 text-center text-xs text-gray-400">
        <button type="button" onClick={() => navigate('/')} className="font-semibold text-white">GoPalengke</button>
        <p className="mt-2">Sariwang paninda. Lokal na kabuhayan. Mas madaling pamamalengke.</p>
      </footer>
    </main>
  );
}
