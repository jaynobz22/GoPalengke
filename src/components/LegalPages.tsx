import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Shield, HelpCircle, AlertTriangle, ChevronDown, Ban, Clock, Package, CreditCard, AlertCircle } from 'lucide-react';

export type LegalPageType = 'terms' | 'disclaimer' | 'privacy' | 'faq' | 'cancellation';

export function LegalPages({ type, onBack }: { type: LegalPageType; onBack: () => void }) {
  const titles: Record<LegalPageType, string> = {
    terms: 'Terms and Conditions',
    disclaimer: 'Disclaimer',
    privacy: 'Privacy Policy',
    faq: 'Frequently Asked Questions',
    cancellation: 'Cancellation Policy',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 pt-6 pb-8 text-white">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition mb-4"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="flex items-center gap-3">
            {type === 'terms' && <FileText size={28} className="text-white" />}
            {type === 'disclaimer' && <AlertTriangle size={28} className="text-white" />}
            {type === 'privacy' && <Shield size={28} className="text-white" />}
            {type === 'faq' && <HelpCircle size={28} className="text-white" />}
            {type === 'cancellation' && <Ban size={28} className="text-white" />}
            <h1 className="text-2xl font-bold">{titles[type]}</h1>
          </div>
          <p className="text-brand-100 text-sm mt-2">Huling update: Setyembre 8, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-6 max-w-3xl mx-auto pb-16">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-8">
          {type === 'terms' && <TermsContent />}
          {type === 'disclaimer' && <DisclaimerContent />}
          {type === 'privacy' && <PrivacyContent />}
          {type === 'faq' && <FaqContent />}
          {type === 'cancellation' && <CancellationContent />}
        </div>
      </div>
    </div>
  );
}

// ============= TERMS AND CONDITIONS =============
function TermsContent() {
  return (
    <div className="space-y-6 text-sm md:text-[15px] text-gray-700 leading-relaxed">
      <Section title="1. Pagtanggap ng Terms">
        <p>
          Sa pag-sign up at paggamit ng GoPalengke platform, sumasang-ayon ka sa mga sumusunod na Terms and Conditions.
          Kung hindi ka sang-ayon sa alinman sa mga tuntunin na ito, huwag gamitin ang platform.
        </p>
      </Section>

      <Section title="2. Tungkol sa GoPalengke">
        <p>
          Ang GoPalengke ay isang online wet market platform na nag-uugnay ng mga tindera/tindero sa palengke
          sa mga mamimili sa buong Pilipinas. Nagbibigay ito ng online marketplace kung saan maaaring mag-post
          ng mga paninda ang mga seller, mag-order ang mga buyer, at maghatid ang mga rider ng mga order
          diretso sa bahay ng mamimili. Ang platform ay sumusuporta sa QR Code payment (GCash/Maya) at
          Cash on Delivery (COD) bilang mga paraan ng pagbabayad.
        </p>
      </Section>

      <Section title="3. Mga Uri ng User Account">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Buyer (Mamimili)</strong> — Maaaring mag-browse, mag-order, at makipag-chat o video call sa seller bago bumili.</li>
          <li><strong>Seller (Tindera/Tindero)</strong> — Maaaring mag-set up ng store, mag-post ng produkto, at tumanggap ng orders. Kailangan magbayad ng 3% commission sa bawat sale at ₱499/month na subscription fee kapag umabot na ang total sales sa ₱5,000.</li>
          <li><strong>Rider</strong> — Maaaring tumanggap ng delivery assignments, mag-update ng order status, at maghatid ng order sa buyer. Kailangan magpasa ng identity verification (valid ID, plate number, motor model, atbp.).</li>
          <li><strong>Admin</strong> — Namamahala sa platform approval, announcements, commission, at moderation.</li>
        </ul>
      </Section>

      <Section title="4. Account Registration at Verification">
        <p>
          Kailangan ng wastong email address at phone number para sa pag-register. Ang lahat ng accounts
          ay dadaan sa admin approval bago makagamit ng platform. Ang mga rider ay kailangan magpasa ng
          valid ID at iba pang verification details. Ang anumang maling impormasyon na ibinigay ay maaaring
          magresulta sa pag-suspend o pag-delete ng account.
        </p>
      </Section>

      <Section title="5. Mga Pananagutan ng Seller">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Class A at sariwang produkto lamang.</strong> Hindi pwede ang bulok, luma, o sira na paninda.</li>
          <li><strong>Isang negative review lang tungkol sa bulok o sira na food products — aalisin agad ang seller sa platform. Walang second chance.</strong></li>
          <li>Totoong tindahan o may pwesto sa palengke ang dapat na irerehistro. Maaaring magtinda rin kahit walang pwesto kung legitimate na negosyo.</li>
          <li>Kailangan panatilihin ang updated na stock at presyo ng mga produkto.</li>
          <li>Ang seller ay mananagot sa kasapatan at kalidad ng produkto na ibinebenta.</li>
        </ul>
      </Section>

      <Section title="6. Mga Pananagutan ng Buyer">
        <ul className="list-disc pl-5 space-y-2">
          <li>Bago bumili, i-chat at i-video call muna ang seller gamit ang Messages tab sa dashboard para siguraduhing legit at makita ang produktong bibilhin.</li>
          <li>Kung COD, siguraduhing may tao sa bahay para magbayad at tatanggap ng order pagdating ng rider.</li>
          <li>Magbigay ng tamang delivery address at contact number.</li>
          <li>Huwag mag-order kung hindi sigurado na tatanggapin ang order.</li>
        </ul>
      </Section>

      <Section title="7. Mga Pananagutan ng Rider">
        <ul className="list-disc pl-5 space-y-2">
          <li>Maghatid ng order nang mabilis at ligtas sa tamang address.</li>
          <li>I-update ang order status (picked up, delivered) sa app.</li>
          <li>Panatilihin ang availability status updated sa dashboard.</li>
          <li>Siguraduhing tama ang pagbabalik ng sukli kung COD.</li>
          <li>Huwag i-cancel ang delivery assignment kung naka-accept na, maliban kung may lehitimong dahilan.</li>
        </ul>
      </Section>

      <Section title="8. Commission at Subscription Fee">
        <p>
          Ang bawat seller ay may obligasyon na magbayad ng 3% commission sa bawat completed sale. Kapag
          umabot na ang total sales ng seller sa ₱5,000, may monthly subscription fee na ₱499. Ang kabuuang
          halaga na kailangan bayaran ay makikita sa Billing tab ng seller dashboard. Kapag hindi nabayaran
          ang fees within the grace period, maaaring i-freeze ang account ng seller hanggang sa mabayaran.
        </p>
      </Section>

      <Section title="9. Payment Methods">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>QR Code (GCash/Maya)</strong> — Magbabayad ang buyer sa seller gamit ang QR code na ipapakita sa store page. Kailangan mag-input ng reference number bilang proof of payment.</li>
          <li><strong>Cash on Delivery (COD)</strong> — Magbabayad ang buyer sa rider pagdating ng order. Ang rider ay magre-report ng payment acceptance sa app.</li>
        </ul>
        <p className="mt-2">
          Ang GoPalengke ay hindi direktang nagpo-process ng payments. Ang transaksyon ay sa pagitan ng
          buyer at seller (para sa QR) o buyer at rider (para sa COD).
        </p>
      </Section>

      <Section title="10. Reviews at Ratings">
        <p>
          Maaaring mag-iwan ng review at rating ang buyer para sa seller at rider pagkatapos ng delivered order.
          Ang reviews ay mahalaga para mapanatili ang kalidad ng service sa platform. Ang mga seller na
          makatanggap ng negative review tungkol sa bulok o sira na produkto ay aalisin agad sa platform.
        </p>
      </Section>

      <Section title="11. Messaging at Video Call">
        <p>
          Ang platform ay may built-in chat at video call feature para sa komunikasyon ng buyer at seller,
          at buyer at rider. Ang lahat ng conversations ay nakabase sa specific order. Mayroon ding admin
          messaging at video call para sa suporta at verification ng mga users.
        </p>
      </Section>

      <Section title="12. Prohibited Activities">
        <ul className="list-disc pl-5 space-y-2">
          <li>Huwag mag-post ng fake o misleading na produkto.</li>
          <li>Huwag mag-benta ng contraband, expired, o hindi pinapayagang produkto.</li>
          <li>Huwag mang-harass o mang-abuso sa kapwa user.</li>
          <li>Huwag gumamit ng fake account o maling identity.</li>
          <li>Huwag i-bypass ang payment system ng platform.</li>
          <li>Huwag mag-spam sa chat o magpadala ng malicious links.</li>
        </ul>
      </Section>

      <Section title="13. Account Suspension at Termination">
        <p>
          Maaaring i-suspend, i-freeze, o i-delete ng admin ang anumang account na lumabag sa mga tuntunin
          na ito. Ang seller freeze ay awtomatiko kapag hindi nabayaran ang fees within the grace period.
          Ang anumang account na na-suspend dahil sa pagbebenta ng bulok o sira na produkto ay permanenteng
          aalisin — walang second chance.
        </p>
      </Section>

      <Section title="14. Limitation of Liability">
        <p>
          Ang GoPalengke ay isang platform lamang na nag-uugnay ng buyers, sellers, at riders. Hindi kami
          mananagot sa kalidad, kasapatan, o safety ng mga produkto na ibinebenta ng sellers. Hindi rin kami
          mananagot sa pagka-late, pagka-damage, o pagkawala ng order habang nasa delivery. Ang mga
          transaksyon ay sa pagitan ng users at ang GoPalengke ay hindi kasapi sa anumang kontrata sa pagitan
          ng buyer at seller.
        </p>
      </Section>

      <Section title="15. Pagbabago ng Terms">
        <p>
          Maaaring baguhin ng GoPalengke ang mga Terms and Conditions na ito anumang oras. Ang mga pagbabago
          ay magkakabisa agad pagkatapos i-post sa platform. Ang patuloy na paggamit ng platform pagkatapos
          ng mga pagbabago ay nangangahulugang sang-ayon ka sa mga updated na terms.
        </p>
      </Section>

      <Section title="16. Contact">
        <p>
          Para sa mga tanong tungkol sa mga Terms na ito, maaaring makipag-ugnayan sa admin gamit ang
          admin messaging feature sa platform.
        </p>
      </Section>
    </div>
  );
}

// ============= DISCLAIMER =============
function DisclaimerContent() {
  return (
    <div className="space-y-6 text-sm md:text-[15px] text-gray-700 leading-relaxed">
      <Section title="General Disclaimer">
        <p>
          Ang GoPalengke ay isang online marketplace platform lamang. Hindi kami ang nagbebenta ng mga
          produkto na ipinapakita sa platform. Ang mga produkto ay pag-aari at pananagutan ng mga
          registered sellers. Ang GoPalengke ay hindi bahagi ng anumang transaksyon sa pagitan ng buyer
          at seller bukod sa pagbibigay ng platform para sa kanilang interaksyon.
        </p>
      </Section>

      <Section title="Kalidad ng Produkto">
        <p>
          Inu-encourage namin ang lahat ng sellers na magbenta ng Class A at sariwang produkto lamang.
          Subalit, hindi namin personally na sinusuri ang bawat produkto bago ito ma-post. Ang pananagutan
          sa kasapatan, kalidad, at safety ng produkto ay nasa seller. Ang anumang reklamo tungkol sa
          produkto ay direktang dapat i-address sa seller gamit ang chat feature ng platform.
        </p>
        <p className="mt-2 font-semibold text-red-600">
          Babala: Isang negative review lang ng buyer tungkol sa bulok o sira na food products — aalisin
          agad ang seller sa platform. Walang second chance.
        </p>
      </Section>

      <Section title="Delivery at Logistics">
        <p>
          Ang paghatid ng order ay ginagawa ng mga registered riders. Ang GoPalengke ay hindi mananagot
          sa pagka-late, pagka-damage, pagkawala, o maling paghatid ng order. Ang rider ang direktang
          pananagutan sa safe at napapanahong paghatid ng order. Maaaring mag-iwan ng review ang buyer
          para sa rider pagkatapos ng delivery.
        </p>
      </Section>

      <Section title="Payment Transactions">
        <p>
          Ang GoPalengke ay hindi direktang nagpo-process ng payments. Para sa QR Code payments, ang
          transaksyon ay direktang sa pagitan ng buyer at seller gamit ang GCash o Maya. Para sa COD,
          ang transaksyon ay sa pagitan ng buyer at rider. Hindi kami mananagot sa anumang dispute
          tungkol sa payment. Inirerekomenda namin na mag-ingat sa pagbabayad at palaging humingi ng
          reference number o resibo.
        </p>
      </Section>

      <Section title="Reviews at Ratings">
        <p>
          Ang mga reviews at ratings sa platform ay opinions ng mga users at hindi necessarily reflect
          ang opinyon ng GoPalengke. Hindi kami mananagot sa anumang content ng reviews. Ang mga review
          ay subject sa moderation kung ito ay offensive, fake, o misleading.
        </p>
      </Section>

      <Section title="External Links">
        <p>
          Ang platform ay maaaring maglaman ng links sa external websites (hal. GCash, Maya). Hindi kami
          mananagot sa content o practices ng mga external websites na ito. Basahin ang kanilang sariling
          terms at privacy policies.
        </p>
      </Section>

      <Section title="No Warranty">
        <p>
          Ang platform ay ibinibigay "as is" at "as available" nang walang anumang warranty, expressed o
          implied. Hindi namin ginagarantiya na ang platform ay laging available, error-free, o walang
          interruption. Hindi kami mananagot sa anumang direct, indirect, incidental, o consequential
          damages na maaaring magmula sa paggamit ng platform.
        </p>
      </Section>

      <Section title="Verification">
        <p>
          Bagama't naghahabol kami na i-verify ang lahat ng sellers at riders sa platform, hindi namin
          garantiya na ang lahat ng impormasyon na ibinigay ng users ay totoo. Inirerekomenda namin na
          gamitin ang video call feature bago bumili para personally na makita ang produkto at ma-verify
          ang seller.
        </p>
      </Section>
    </div>
  );
}

// ============= PRIVACY POLICY =============
function PrivacyContent() {
  return (
    <div className="space-y-6 text-sm md:text-[15px] text-gray-700 leading-relaxed">
      <Section title="1. Panimula">
        <p>
          Ang GoPalengke ay nakomporma sa <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>
          ng Pilipinas. Ang Privacy Policy na ito ay nagpapaliwanag kung paano namin kinokolekta, ginagamit,
          at pinoprotektahan ang iyong personal na impormasyon. Sa pag-sign up at paggamit ng platform,
          ikaw ay nagbibigay ng pahintulot na kolektahin at gamitin ang iyong data ayon sa policy na ito.
        </p>
      </Section>

      <Section title="2. Personal Information na Kinokolekta">
        <p>Kapag nag-register ka sa GoPalengke, maaaring kolektahin ang mga sumusunod:</p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Pangalan</strong> — full name na ibinibigay sa registration</li>
          <li><strong>Email address</strong> — para sa account at communication</li>
          <li><strong>Phone number</strong> — para sa verification at contact</li>
          <li><strong>Address</strong> — barangay, city, region para sa delivery at store location</li>
          <li><strong>Profile photo / avatar</strong> — opsyonal, para sa public profile</li>
          <li><strong>Rider verification details</strong> — edad, family status, residence address, plate number, motor model, at valid ID photo (para sa riders lamang)</li>
          <li><strong>Store information</strong> — store name, description, logo, banner, QR code, at palengke name (para sa sellers lamang)</li>
          <li><strong>Location data</strong> — live GPS coordinates ng rider habang may active delivery, at store coordinates ng seller</li>
          <li><strong>Order at payment details</strong> — order history, payment method, reference numbers</li>
          <li><strong>Chat messages at video call records</strong> — para sa buyer-seller, buyer-rider, at admin-user conversations</li>
        </ul>
      </Section>

      <Section title="3. Paano Ginagamit ang Personal Information">
        <p>Ginagamit ang iyong personal information para sa mga sumusunod na layunin:</p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Paglikha at pamamahala ng iyong account</li>
          <li>Pag-process at paghatid ng iyong mga order</li>
          <li>Komunikasyon sa pagitan ng buyers, sellers, riders, at admin</li>
          <li>Verification ng identity lalo na para sa mga rider at seller</li>
          <li>Pag-compute at pag-collect ng commission at subscription fees mula sa sellers</li>
          <li>Pagpapakita ng public profile at store page sa ibang users</li>
          <li>Live tracking ng rider location habang may active delivery</li>
          <li>Reviews at ratings system</li>
          <li>Customer support at dispute resolution</li>
          <li>Platform security at fraud prevention</li>
        </ul>
      </Section>

      <Section title="4. Legal Basis sa ilalim ng Data Privacy Act">
        <p>
          Ang pagproseso ng iyong personal data ay batay sa:
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Consent</strong> — ibinigay mo ang pahintulot sa pag-sign up</li>
          <li><strong>Contractual necessity</strong> — kinakailangan para ma-deliver ang serbisyo na hinihingi mo</li>
          <li><strong>Legitimate interest</strong> — para sa platform security, fraud prevention, at service improvement</li>
          <li><strong>Legal obligation</strong> — kung kinakailangan ng batas</li>
        </ul>
      </Section>

      <Section title="5. Pagbabahagi ng Personal Information">
        <p>
          Hindi namin ibinebenta ang iyong personal data. Maaari naming ibahagi ang iyong data sa mga
          sumusunod na sitwasyon:
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Sa pagitan ng users</strong> — Ang iyong pangalan, profile photo, phone number, at address ay makikita ng kausap mo sa chat o order transaction. Ang store information ng seller ay public.</li>
          <li><strong>Sa Supabase</strong> — Ang aming database at authentication ay pinapagana ng Supabase, na nag-i-store ng data sa secure servers.</li>
          <li><strong>Sa payment providers</strong> — Kung gumamit ka ng GCash o Maya, ang payment transaction ay subject sa privacy policy ng nasabing provider.</li>
          <li><strong>Sa awtoridad</strong> — Kung kinakailangan ng batas o legal na utos, maaaring ibahagi ang data sa tamang awtoridad.</li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        <p>
          Ginagawa namin ang lahat na panatilihin ang iyong personal data lamang hangga't kinakailangan
          para sa mga layunin na nakasaad sa policy na ito. Ang account data, order history, at chat
          messages ay mananatili habgang active ang iyong account. Kapag na-delete ang account, ang data
          ay maaaring manatili sa aming database para sa legal o audit purposes sa loob ng reasonable
          na panahon, pagkatapos ay permanenteng buburahin.
        </p>
      </Section>

      <Section title="7. Data Security">
        <p>
          Gumagamit kami ng mga sumusunod na hakbang para protektahan ang iyong personal data:
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Row Level Security (RLS)</strong> — Ang lahat ng database tables ay may RLS policies na nagsisiguro na lamang ang may-ari ng data ang makakapag-access o makakapag-edit.</li>
          <li><strong>Encrypted authentication</strong> — Ang passwords ay hashed at hindi namin makita ang iyong password.</li>
          <li><strong>Secure storage</strong> — Ang mga larawan (profile, store, valid ID) ay naka-store sa secure storage buckets na may access control.</li>
          <li><strong>Role-based access</strong> — Ang admin access ay limitado lamang sa mga authorized admin accounts.</li>
          <li><strong>Session management</strong> — Ang login sessions ay managed nang ligtas gamit ang secure tokens.</li>
        </ul>
      </Section>

      <Section title="8. Mga Karapatan ng User sa ilalim ng Data Privacy Act">
        <p>Bilang user sa ilalim ng Data Privacy Act of 2012, may karapatan ka na:</p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Right to be informed</strong> — Malaman kung paano ginagamit ang iyong data (ito ang policy na ito)</li>
          <li><strong>Right to access</strong> — Hingin ang kopya ng personal data na hawak namin tungkol sa iyo</li>
          <li><strong>Right to object</strong> Tutol sa pagproseso ng iyong data para sa mga layuning hindi mo pinapayagan</li>
          <li><strong>Right to erasure o blocking</strong> — Hingin na burahin o i-block ang iyong data kung hindi na kinakailangan</li>
          <li><strong>Right to data portability</strong> — Hingin ang iyong data sa format na maaaring ilipat sa ibang service</li>
          <li><strong>Right to rectify</strong> — Itama ang anumang mali o hindi updated na impormasyon</li>
          <li><strong>Right to file a complaint</strong> — Mag-file ng reklamo sa National Privacy Commission kung nalabag ang iyong karapatan</li>
        </ul>
        <p className="mt-2">
          Para gamitin ang alinman sa mga karapatang ito, maaaring makipag-ugnayan sa admin gamit ang
          admin messaging feature sa platform.
        </p>
      </Section>

      <Section title="9. Cookies at Tracking">
        <p>
          Gumagamit ang platform ng browser storage at session storage para sa authentication at user
          preferences. Hindi gumagamit ang platform ng third-party tracking cookies para sa advertising.
        </p>
      </Section>

      <Section title="10. Location Data">
        <p>
          Ang live location ng rider ay kinokolekta at ipinapakita sa buyer habang may active delivery
          para sa tracking purposes. Pagkatapos ma-deliver ang order, hindi na kinokolekta ang live location.
          Ang store coordinates ng seller ay static at ginagamit para sa delivery fee computation at
          map display.
        </p>
      </Section>

      <Section title="11. Mga Bata">
        <p>
          Ang platform ay hindi para sa mga bata wala pang 18 taong gulang. Hindi namin sinasadyang
          kolektahin ang personal data ng mga bata. Kung naniniwala ka na nakolekta namin ang data ng
          isang bata nang walang pahintulot ng magulang, maaaring makipag-ugnayan sa admin para burahin ito.
        </p>
      </Section>

      <Section title="12. Mga Pagbabago sa Privacy Policy">
        <p>
          Maaaring baguhin ang Privacy Policy na ito paminsan-minsan. Ang mga pagbabago ay magkakabisa
          agad pagkatapos i-post sa platform. Inirerekomenda namin na suriin ang policy paminsan-minsan.
        </p>
      </Section>

      <Section title="13. Contact para sa Privacy Concerns">
        <p>
          Para sa anumang tanong o reklamo tungkol sa privacy, maaaring makipag-ugnayan sa admin gamit
          ang admin messaging feature sa platform. Maaari ring mag-file ng reklamo sa National Privacy
          Commission (NPC) sa www.privacy.gov.ph kung naniniwala ka na nalabag ang iyong mga karapatan
          sa ilalim ng Data Privacy Act of 2012.
        </p>
      </Section>
    </div>
  );
}

// ============= CANCELLATION POLICY =============
function CancellationContent() {
  return (
    <div className="space-y-6 text-sm md:text-[15px] text-gray-700 leading-relaxed">
      {/* Warning Banner */}
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-red-700 text-sm">Strictly No Cancellation for Perishable Goods</p>
          <p className="text-red-600 text-xs mt-1">
            Once an order is marked as "Preparing," cancellation is strictly prohibited. Meat, fish, and vegetables are already cut, weighed, and packed — they cannot be returned to inventory or resold.
          </p>
        </div>
      </div>

      <Section title="1. Overview">
        <p>
          This Cancellation Policy outlines the rules and conditions under which a buyer may cancel an order on GoPalengke.
          It is designed to protect vendors from losses due to the perishable nature of wet market goods, in accordance with
          Department of Trade and Industry (DTI) guidelines on fair trade, while remaining fair and transparent to buyers.
        </p>
      </Section>

      <Section title="2. Cancellation Window — Before Preparation">
      <div className="space-y-3">
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
            <Clock size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-700 text-sm">Free Cancellation Within 30 Minutes</p>
              <p className="text-green-600 text-xs mt-1">
                Buyers may cancel an order freely through their dashboard within 30 minutes of placing it, provided the
                order status is still "Pending" or "Confirmed." Cancellation during this window is automatically approved
                with no penalties.
              </p>
            </div>
          </div>
          <p>
            After the 30-minute window has passed, and the order remains in "Pending" or "Confirmed" status, the buyer may
            still request a cancellation. However, approval is no longer automatic and will be subject to review by the vendor.
          </p>
        </div>
      </Section>

      <Section title="3. No Cancellation — During Preparation or In Transit">
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <Ban size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">"Preparing" Status — No Cancellation</p>
              <p className="text-red-600 text-xs mt-1">
                Once the vendor marks the order as "Preparing," the items (especially meat, fish, and vegetables) have
                already been cut, weighed, and packed. These perishable goods cannot be returned to inventory or resold.
                Cancellation is strictly prohibited at this stage.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <Ban size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">"In Transit" Status — No Cancellation</p>
              <p className="text-red-600 text-xs mt-1">
                Once the order is with the rider ("In Transit"), cancellation is not permitted under any circumstances.
                The goods are already in transit and cannot be returned.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 italic">
            This policy exists because wet market goods are perishable by nature. Unlike manufactured products, fresh
            meat, fish, and produce cannot be restocked once they have been prepared for a specific order.
          </p>
        </div>
      </Section>

      <Section title="4. Cancellation Reason Codes">
        <p>When requesting a cancellation before the cut-off, the buyer must select a reason from the following options:</p>
        <div className="space-y-2 mt-2">
          <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-2.5">
            <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">1</span>
            <div>
              <p className="font-medium text-gray-700 text-sm">Change of Mind</p>
              <p className="text-xs text-gray-500">The buyer no longer wishes to purchase the items. Subject to the 30-minute free cancellation window.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-2.5">
            <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">2</span>
            <div>
              <p className="font-medium text-gray-700 text-sm">Incorrect Delivery Address or Contact</p>
              <p className="text-xs text-gray-500">The buyer provided a wrong address or contact number. May be cancelled within the 30-minute window without penalty.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">3</span>
            <div>
              <p className="font-medium text-amber-700 text-sm">Delayed Delivery (Vendor or Rider Fault)</p>
              <p className="text-xs text-amber-600">If the delay is caused by the vendor or rider (e.g., severe delay beyond the expected delivery time), the buyer is entitled to cancel without penalties — even if the order is already in "Preparing" status. This will be reviewed by the admin.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="5. Inventory & Stock Return Policy">
        <div className="space-y-2">
          <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
            <Package size={18} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-700 text-sm">Perishable Items (Meat, Fish, Vegetables, Fruits)</p>
              <p className="text-xs text-gray-500 mt-0.5">Cannot be returned to inventory once packed. These items are prepared specifically for the order and cannot be resold.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-green-50 rounded-xl p-3">
            <Package size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-700 text-sm">Dry Goods & Grocery Items</p>
              <p className="text-xs text-green-600 mt-0.5">Will automatically be returned to the store's available stock if a valid cancellation occurs within the allowed window.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="6. Refund Policy for Online Payments">
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
          <CreditCard size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-sm text-blue-700">
              For online payments (GCash, Maya, GoTyme, and other e-wallets), refunds will only be processed under the following conditions:
            </p>
            <ul className="list-disc pl-5 text-xs text-blue-600 space-y-1">
              <li>The cancellation was made within the 30-minute free cancellation window, <strong>or</strong></li>
              <li>The cancellation is due to vendor or rider fault (e.g., severe delay, non-delivery, or item unavailability confirmed by admin)</li>
            </ul>
            <p className="text-xs text-blue-500 mt-1">
              Refunds will be processed within 5–7 business days back to the original payment method. The buyer will be notified via the platform once the refund is initiated.
            </p>
          </div>
        </div>
      </Section>

      <Section title="7. Cash on Delivery (COD) Management">
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-700 text-sm">Anti-Fake Order Policy</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Frequent cancellations, fake orders, or refusal to pay on COD deliveries will result in the following actions
              under our suspicious activity monitoring system:
            </p>
          </div>
        </div>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>First offense:</strong> Warning notification sent to the buyer.</li>
          <li><strong>Second offense:</strong> The buyer's Cash on Delivery option will be suspended. Only online payment (QR Code) will be available for future orders.</li>
          <li><strong>Third offense:</strong> The buyer's account will be flagged and may be disabled by the admin under the platform's fraud detection system.</li>
        </ul>
      </Section>

      <Section title="8. Dispute Resolution">
        <p>
          If a buyer believes their cancellation request was unfairly denied, they may escalate the matter to the admin
          using the admin messaging feature in the dashboard. The admin will review the order history, chat records, and
          delivery timestamps to make a fair determination. Decisions made by the admin are final.
        </p>
      </Section>

      <Section title="9. DTI Compliance Statement">
        <p>
          This policy is formulated in alignment with the Department of Trade and Industry (DTI) guidelines on fair trade
          practices and consumer protection. It balances the consumer's right to cancel within a reasonable window with
          the vendor's right to protect perishable goods that cannot be restocked once prepared.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          For questions about this Cancellation Policy, buyers may reach out to the admin through the admin messaging
          feature in the platform dashboard.
        </p>
      </Section>
    </div>
  );
}

// ============= FAQ =============
function FaqContent() {
  const faqs = [
    {
      q: 'Ano ang GoPalengke?',
      a: 'Ang GoPalengke ay ang unang online wet market sa Pilipinas. Ito ay isang platform na nag-uugnay ng mga tindera/tindero sa palengke sa mga mamimili. Maaaring mag-order ng sariwang isda, karne, gulay, prutas, at iba pang paninda galing sa palengke na pinakamalapit sa iyo, at ipapa-deliver diretso sa bahay.',
    },
    {
      q: 'Paano ako mag-sign up?',
      a: 'I-click ang "Mag-sign Up" sa homepage. Piliin ang role mo — Buyer, Seller, o Rider. Mag-input ng email, password, pangalan, at phone number. Pagkatapos mag-sign up, mahihintay mo ang approval ng admin bago makagamit ng platform.',
    },
    {
      q: 'Ano ang pagkakaiba ng Buyer, Seller, at Rider?',
      a: 'Ang Buyer ay ang mamimili na nag-o-order ng paninda. Ang Seller ay ang tindera/tindero na nagpo-post ng produkto at tumatanggap ng orders. Ang Rider ay ang naghahatid ng order mula sa seller patungo sa buyer. Ang Admin ay ang nagpapasya sa approvals, announcements, at moderation ng platform.',
    },
    {
      q: 'Paano mag-order bilang Buyer?',
      a: 'Mag-browse ng mga tindahan o produkto sa dashboard. Idagdag sa cart ang mga gustong bilhin. Pumili ng payment method — QR Code (GCash/Maya) o Cash on Delivery (COD). Mag-checkout at hintayin na ma-confirm ng seller. Makikipag-chat ka sa seller at rider sa Messages tab para sa updates.',
    },
    {
      q: 'Bakit kailangan mag-chat at video call bago bumili?',
      a: 'Para siguraduhing legit ang seller at makita mo ang aktwal na produkto bago ka bumili. Gamit ang Messages tab sa dashboard mo, maaari kang mag-chat at mag-video call sa seller. Ito ay para sa iyong proteksyon at seguridad.',
    },
    {
      q: 'Ano ang mga payment methods?',
      a: 'Dalawang paraan ng pagbabayad: (1) QR Code — magbabayad ka gamit ang GCash o Maya sa QR code ng seller, at mag-input ng reference number bilang proof of payment. (2) Cash on Delivery (COD) — magbabayad ka sa rider pagdating ng order sa bahay mo.',
    },
    {
      q: 'Ano ang COD at paano ito gumagana?',
      a: 'Sa Cash on Delivery, magbabayad ka ng cash sa rider pagdating ng order. Siguraduhing may tao sa bahay para magbayad at tatanggap ng order. Ang rider ay magre-report sa app na natanggap ang payment.',
    },
    {
      q: 'Paano magsimula bilang Seller?',
      a: 'Pagkatapos ma-approve ng admin, mag-set up ka ng store sa dashboard — store name, description, logo, banner, at palengke location. Mag-post ng mga produkto na may presyo, stock, at larawan. Kapag may order, makakatanggap ka ng notification at makakapag-chat sa buyer.',
    },
    {
      q: 'Magkano ang commission at subscription fee para sa Seller?',
      a: 'Ang bawat sale ay may 3% commission na ibibigay sa platform. Kapag umabot na ang total sales mo sa ₱5,000, may monthly subscription fee na ₱499. Makikita ang kabuuang halaga na kailangan bayaran sa Billing tab ng seller dashboard.',
    },
    {
      q: 'Anong mangyayari kung hindi ako makabayad ng fees bilang Seller?',
      a: 'May grace period na ibinibigay ang platform. Kapag hindi ka pa rin nakabayad within the grace period, ma-freeze ang iyong account — hindi ka makakapag-post ng produkto o makakatanggap ng orders hanggang sa mabayaran mo ang outstanding balance.',
    },
    {
      q: 'Ano ang mangyayari kung may negative review tungkol sa bulok o sira na produkto?',
      a: 'Isang negative review lang ng buyer tungkol sa bulok, luma, o sira na food products — aalisin agad ang seller sa platform. Walang second chance. Kaya siguraduhin na Class A at sariwa palagi ang iyong paninda.',
    },
    {
      q: 'Paano magsimula bilang Rider?',
      a: 'Pagkatapos mag-sign up bilang rider at ma-approve ng admin, kailangan mong magpasa ng identity verification — edad, family status, residence address, plate number, motor model, at valid ID photo. Pagkatapos, maaari ka nang tumanggap ng delivery assignments sa dashboard.',
    },
    {
      q: 'Paano tumanggap ng delivery assignment bilang Rider?',
      a: 'Sa rider dashboard, makikita mo ang available na deliveries. I-accept ang order, pumunta sa store para i-pick up ang order, i-update ang status sa app (picked up), at ihatid sa buyer. I-update ulit ang status sa delivered pagkatapos maihatid.',
    },
    {
      q: 'Paano gumagana ang live tracking?',
      a: 'Habang may active delivery, ang live GPS location mo (bilang rider) ay ipinapakita sa buyer sa mapa. Makikita ng buyer kung saan ka na at kailan ka darating. Pagkatapos ma-deliver, hindi na kinokolekta ang live location.',
    },
    {
      q: 'Paano ang delivery fee computation?',
      a: 'Ang delivery fee ay nakabase sa distansya sa pagitan ng store at delivery address ng buyer. Awto-compute ito ng platform kapag mag-checkout ang buyer.',
    },
    {
      q: 'Paano makipag-chat sa seller o rider?',
      a: 'Pumunta sa Messages tab sa dashboard. Ang mga conversations ay awtomatikong nagkakaron base sa order mo. Maaari kang mag-send ng text message o mag-video call sa seller bago bumili, at sa rider habang may ongoing delivery.',
    },
    {
      q: 'Paano gumagana ang video call?',
      a: 'Sa Messages tab, maaari kang mag-video call sa seller o rider. I-click ang video call icon at hihintayin na tanggapin ng kabilang panig. Ang video call ay mahalaga para ma-verify ang produkto o ma-clarify ang order details.',
    },
    {
      q: 'Paano mag-iwan ng review?',
      a: 'Pagkatapos ma-deliver ang order, maaari kang mag-iwan ng rating (1-5 stars) at comment para sa seller at rider. Ang reviews ay mahalaga para mapanatili ang kalidad ng service at protektahan ang ibang buyers.',
    },
    {
      q: 'May public profile ba ang bawat user?',
      a: 'Oo. Ang bawat user ay may public profile page na makikita ng iba. Para sa seller, kasama rito ang store page na nagpapakita ng produkto. Para sa rider, kasama ang verification details. Maaaring i-share ang link ng profile o store page.',
    },
    {
      q: 'Paano ko ma-update ang aking store information?',
      a: 'Bilang seller, pumunta sa store settings sa dashboard. Maaari mong i-update ang store name, description, logo, banner, QR code, location, at palengke name. Maaari ring idagdag o baguhin ang mga produkto anumang oras.',
    },
    {
      q: 'Ano ang mangyayari kung may problema sa order?',
      a: 'Maaari kang makipag-chat sa seller o rider gamit ang Messages tab. Kung hindi malutas, maaari kang makipag-ugnayan sa admin gamit ang admin messaging feature. Ang admin ay maaari ring mag-video call para sa suporta.',
    },
    {
      q: 'Paano ko mapoprotektahan ang aking personal data?',
      a: 'Ang GoPalengke ay nakomporma sa Data Privacy Act of 2012. Ang lahat ng database tables ay may Row Level Security na nagsisiguro na ikaw lamang ang makaka-access sa iyong data. Hindi namin ibinebenta ang iyong data. Basahin ang Privacy Policy para sa detalye.',
    },
    {
      q: 'Paano ako makikipag-ugnayan sa admin?',
      a: 'Gamit ang admin messaging feature sa dashboard, maaari kang mag-send ng message sa admin para sa anumang tanong, reklamo, o hiling. Maaari ring mag-video call ang admin sa iyo para sa verification o suporta.',
    },
    {
      q: 'Maaari ba akong magtinda kahit walang pwesto sa palengke?',
      a: 'Oo. Maaari kang magtenda sa GoPalengke kahit walang pisikal na pwesto sa palengke, basta legitimate na negosyo at Class A at sariwa ang produkto. Subalit, kung may pwesto ka sa palengke, maaari mong ilagay ang palengke name sa store settings.',
    },
  ];

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <FaqItem key={i} question={faq.q} answer={faq.a} />
      ))}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition"
      >
        <span className="flex-1 font-semibold text-gray-800 text-sm">{question}</span>
        <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-bold text-gray-800 text-base mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
