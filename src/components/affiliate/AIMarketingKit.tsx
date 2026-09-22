import { useState, useCallback } from 'react';
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

function generatePostText(type: InviteType, referralLink: string, affiliateName: string): string {
  const name = affiliateName.split(' ')[0] || 'Kaibigan';

  switch (type) {
    case 'seller':
      return `🛒🔥 MGA SUKI, GUSTO MO BANG LUMAKI ANG BENTA KAHIT NASA BAHAY LANG? 🔥🛒

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
${referralLink}

Sali na at simulan ang paglago ng negosyo mo! 🚀🛍️

#GoPalengke #OnlinePalengke #SellerInvite #PalengkeOnline #NegosyoOnline #DagdagKita`;

    case 'buyer':
      return `🥬🥩 GUSTO MO BA NG SARIWANG REKADO PERO TAMAD LUMABAS? SAGOT KA NG GOPALENGKE! 🍅🍗

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
${referralLink}

Sali na at tamasahin ang convenience! 🎉🛒

#GoPalengke #PalengkeDelivery #FreshVeggies #SariwangRekado #IwasTraffic #OnlinePalengke #HomeDelivery`;

    case 'rider':
      return `🏍️💨 MAY MOTOR KA BA AT GUSTONG KUMITA NANG MALAKI ARAW-ARAW? 💰🏍️

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
${referralLink}

Sali na at simulang kumita ngayon! 🙌💪

#GoPalengke #RiderJobs #DeliveryRider #MotorKita #TrabahoOnline #KumitaSaMotor #GoPalengkeRider`;

    case 'affiliate':
      return `💸📱 GUSTO MO BANG KUMITA GAMIT ANG FACEBOOK MO HABANG NASA BAHAY LANG? SALI NA BILANG GOPALENGKE AFFILIATE! 🏠💰

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
${referralLink}

Sali na at simulan ang pag-build ng passive income mo! 🚀💸

#GoPalengke #AffiliateProgram #PassiveIncome #KumitaOnline #WorkFromHome #DagdagKita #OnlineBusiness`;

    default:
      return '';
  }
}

function buildPollinationsUrl(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
}

export function AIMarketingKit({ affiliate }: { affiliate: Affiliate }) {
  const [activeType, setActiveType] = useState<InviteType | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      const fullText = generatePostText(type, link, affiliate.full_name);

      // Simulate text generation delay for UX
      setTimeout(() => {
        setText(fullText);
        setTextLoading(false);
      }, 800);

      // Generate image via Pollinations.ai
      const url = buildPollinationsUrl(config.imagePrompt);
      const img = new Image();
      img.onload = () => {
        setImageUrl(url);
        setImageLoading(false);
      };
      img.onerror = () => {
        setImageLoading(false);
      };
      img.src = url;
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
      a.download = `gopalengke_${activeType}_poster.jpg`;
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
            <div>
              <h2 className="font-bold text-white text-base">AI Marketing Kit Generator</h2>
              <p className="text-green-100 text-xs">Gumawa ng promotional post at poster sa isang click</p>
            </div>
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
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-white' : 'bg-white'
                  }`}>
                    <Icon size={18} className={isActive ? config.color : 'text-gray-400'} />
                  </div>
                  <span className="text-left flex-1">{config.label}</span>
                  {isActive && !imageLoading && !textLoading && (
                    <CheckCheck size={16} className={config.color} />
                  )}
                </button>
              );
            })}
          </div>
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
                      <p className="text-xs">Gumagawa ng larawan...</p>
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
