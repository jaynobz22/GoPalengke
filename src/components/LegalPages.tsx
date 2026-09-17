import { useState } from 'react';
import {
  ArrowLeft, FileText, Shield, HelpCircle, AlertTriangle, ChevronDown, Ban,
  Clock, Package, CreditCard, AlertCircle, ShieldCheck, Eye, MapPin,
  ShoppingBag, Bot, MessageSquareWarning, UserX, AlertOctagon, BadgeCheck,
  Bird, PawPrint, Handshake,
} from 'lucide-react';

export type LegalPageType = 'terms' | 'disclaimer' | 'privacy' | 'faq' | 'cancellation' | 'antiscam';

export function LegalPages({ type, onBack }: { type: LegalPageType; onBack: () => void }) {
  const titles: Record<LegalPageType, string> = {
    terms: 'Terms and Conditions',
    disclaimer: 'Disclaimer',
    privacy: 'Privacy Policy',
    faq: 'Frequently Asked Questions',
    cancellation: 'Cancellation Policy',
    antiscam: 'Anti Scam & Spam Policy',
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
            {type === 'antiscam' && <ShieldCheck size={28} className="text-white" />}
            <h1 className="text-2xl font-bold">{titles[type]}</h1>
          </div>
          <p className="text-brand-100 text-sm mt-2">Last updated: September 17, 2026</p>
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
          {type === 'antiscam' && <AntiscamContent />}
        </div>
      </div>
    </div>
  );
}

// ============= TERMS AND CONDITIONS =============
function TermsContent() {
  return (
    <div className="space-y-6 text-sm md:text-[15px] text-gray-700 leading-relaxed">
      <Section title="1. Acceptance of Terms">
        <p>
          By signing up and using the GoPalengke platform, you agree to the following Terms and Conditions.
          If you do not agree to any of these terms, please do not use the platform.
        </p>
      </Section>

      <Section title="2. About GoPalengke">
        <p>
          GoPalengke is an online wet market platform that connects market vendors to buyers across the
          Philippines. It provides an online marketplace where sellers can post their products, buyers can
          place orders, and riders can deliver orders directly to the buyer's home. The platform supports
          QR Code payment (GCash/Maya) and Cash on Delivery (COD) as payment methods.
        </p>
      </Section>

      <Section title="3. Types of User Accounts">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Buyer</strong> — Can browse, order, and chat or video call with the seller before purchasing.</li>
          <li><strong>Seller</strong> — Can set up a store, post products, and receive orders. Required to pay a 3% commission on each sale. Once total sales reach ₱5,000, a monthly rent of ₱700 is automatically activated and added to the running balance.</li>
          <li><strong>Rider</strong> — Can accept delivery assignments, update order status, and deliver orders to buyers. Required to submit identity verification (valid ID, plate number, motor model, etc.). A 3% platform fee is deducted from each delivery earning. Once accumulated fees reach ₱500, the rider must pay via the Billing tab to continue accepting new deliveries.</li>
          <li><strong>Admin</strong> — Manages platform approvals, announcements, commission, and moderation.</li>
        </ul>
      </Section>

      <Section title="4. Account Registration and Verification">
        <p>
          A valid email address and phone number are required for registration. All accounts must go
          through admin approval before being able to use the platform. Riders are required to submit a
          valid ID and other verification details. Any false information provided may result in account
          suspension or deletion.
        </p>
      </Section>

      <Section title="5. Seller Responsibilities">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Class A and fresh products only.</strong> Spoiled, old, or damaged goods are not allowed.</li>
          <li><strong>A single negative review regarding spoiled or damaged food products will result in immediate removal from the platform. No second chances.</strong></li>
          <li>A real store or market stall should be registered. Selling without a physical stall is allowed if it is a legitimate business.</li>
          <li>Sellers must keep product stock and prices updated at all times.</li>
          <li>The seller is responsible for the freshness and quality of the products they sell.</li>
          <li><strong>Livestock sellers</strong> must upload a valid Bureau of Animal Industry (BAI) Registration and Local LGU Veterinary Health Certificate. Livestock orders are limited to Store Pick-Up or Local Meet-Up only — no rider delivery. Failure to maintain valid permits will result in immediate removal of livestock listings.</li>
        </ul>
      </Section>

      <Section title="6. Buyer Responsibilities">
        <ul className="list-disc pl-5 space-y-2">
          <li>Before purchasing, chat and video call the seller using the Messages tab in the dashboard to verify legitimacy and see the actual product.</li>
          <li>For COD orders, ensure someone is home to pay and receive the order upon the rider's arrival.</li>
          <li>Provide an accurate delivery address and contact number.</li>
          <li>Do not place an order if you are not certain you will accept it.</li>
        </ul>
      </Section>

      <Section title="7. Rider Responsibilities">
        <ul className="list-disc pl-5 space-y-2">
          <li>Deliver orders promptly and safely to the correct address.</li>
          <li>Update order status (picked up, delivered) in the app.</li>
          <li>Keep availability status updated on the dashboard.</li>
          <li>Ensure correct change is given for COD orders.</li>
          <li>Do not cancel a delivery assignment once accepted, except for legitimate reasons.</li>
          <li>A 3% platform fee is deducted from each delivery earning. Once accumulated fees reach ₱500,
          the rider must pay through the Billing tab. Until payment is made, the rider cannot accept new
          deliveries but can still log in and view the dashboard. After payment is approved, the account
          is reactivated and fees begin accumulating again.</li>
        </ul>
      </Section>

      <Section title="8. Commission and Monthly Rent">
        <p>
          Each seller is obligated to pay a 3% commission on every completed sale. This is tracked
          automatically in the seller's Billing tab. Once the seller's total gross sales reach or exceed
          ₱5,000, a monthly rent of ₱700 is automatically activated and added to the running balance.
          Before reaching ₱5,000, the monthly rent is <strong>FREE</strong> — only the 3% commission applies.
        </p>
        <p className="mt-2">
          The 3% commission and ₱700 monthly rent are consolidated into a single "Current Balance Due"
          in the Billing tab. Sellers can continue using the app while the balance grows. Once the
          combined balance reaches ₱1,000, the system will require payment to prevent dashboard
          deactivation. If fees are not paid within the grace period, the seller's account may be frozen
          until payment is made.
        </p>
      </Section>

      <Section title="9. Payment Methods">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>QR Code (GCash/Maya)</strong> — The buyer pays the seller using the QR code displayed on the store page. A reference number must be entered as proof of payment.</li>
          <li><strong>Cash on Delivery (COD)</strong> — The buyer pays the rider upon delivery. The rider reports payment acceptance in the app.</li>
        </ul>
        <p className="mt-2">
          GoPalengke does not directly process payments. Transactions are between the buyer and seller
          (for QR) or buyer and rider (for COD).
        </p>
      </Section>

      <Section title="10. Reviews and Ratings">
        <p>
          Buyers may leave a review and rating for the seller and rider after a delivered order. Reviews
          are important to maintain service quality on the platform. Sellers who receive a negative review
          regarding spoiled or damaged products will be immediately removed from the platform.
        </p>
      </Section>

      <Section title="11. Messaging and Video Call">
        <p>
          The platform has a built-in chat and video call feature for communication between buyer and
          seller, and buyer and rider. All conversations are based on a specific order. There is also
          admin messaging and video call for support and user verification.
        </p>
      </Section>

      <Section title="12. Prohibited Activities">
        <ul className="list-disc pl-5 space-y-2">
          <li>Do not post fake or misleading products.</li>
          <li>Do not sell contraband, expired, or prohibited products.</li>
          <li>Do not harass or abuse other users.</li>
          <li>Do not use fake accounts or false identities.</li>
          <li>Do not bypass the platform's payment system.</li>
          <li>Do not spam the chat or send malicious links.</li>
          <li>Do not list wild exotic fauna or any species protected under Republic Act No. 9147 (Wildlife Resources Conservation and Protection Act). Only farm livestock (chickens, ducks, turkeys, goats, piglets) are permitted.</li>
        </ul>
      </Section>

      <Section title="13. Account Suspension and Termination">
        <p>
          The admin may suspend, freeze, or delete any account that violates these terms. A seller freeze
          is automatic when fees are not paid within the grace period. Any account suspended for selling
          spoiled or damaged products will be permanently removed — no second chances.
        </p>
      </Section>

      <Section title="14. Limitation of Liability">
        <p>
          GoPalengke is a platform that connects buyers, sellers, and riders. We are not responsible for
          the quality, freshness, or safety of products sold by sellers. We are also not responsible for
          delays, damage, or loss of orders during delivery. Transactions are between users, and
          GoPalengke is not a party to any contract between buyer and seller.
        </p>
      </Section>

      <Section title="15. Changes to Terms">
        <p>
          GoPalengke may change these Terms and Conditions at any time. Changes take effect immediately
          after being posted on the platform. Continued use of the platform after changes means you agree
          to the updated terms.
        </p>
      </Section>

      <Section title="16. Contact">
        <p>
          For questions about these Terms, you may contact the admin using the admin messaging feature
          on the platform.
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
          GoPalengke is an online marketplace platform only. We do not sell the products displayed on the
          platform. Products are owned and managed by registered sellers. GoPalengke is not part of any
          transaction between buyer and seller other than providing the platform for their interaction.
        </p>
      </Section>

      <Section title="Product Quality">
        <p>
          We encourage all sellers to sell only Class A and fresh products. However, we do not personally
          inspect each product before it is posted. The responsibility for freshness, quality, and safety
          of products lies with the seller. Any complaint about a product should be addressed directly to
          the seller using the chat feature on the platform.
        </p>
        <p className="mt-2 font-semibold text-red-600">
          Warning: A single negative review from a buyer regarding spoiled or damaged food products will
          result in immediate removal of the seller from the platform. No second chances.
        </p>
      </Section>

      <Section title="Livestock and Live Animals">
        <p>
          For livestock and live animal listings, GoPalengke relies on the seller's submitted permits
          (Bureau of Animal Industry Registration and Local LGU Veterinary Health Certificates) to verify
          legal compliance. The platform does not independently inspect live animals. Buyers are strongly
          advised to inspect the animal in person during Store Pick-Up or Local Meet-Up before completing
          the transaction. GoPalengke is not liable for the health, condition, or welfare of any live animal
          sold through the platform. Any concerns regarding animal welfare or illegal wildlife trade should
          be reported to the admin immediately and may be escalated to the appropriate government authorities.
        </p>
      </Section>

      <Section title="Delivery and Logistics">
        <p>
          Order delivery is handled by registered riders. GoPalengke is not responsible for delays,
          damage, loss, or incorrect delivery of orders. The rider is directly responsible for safe and
          timely delivery. Buyers may leave a review for the rider after delivery.
        </p>
      </Section>

      <Section title="Payment Transactions">
        <p>
          GoPalengke does not directly process payments. For QR Code payments, the transaction is directly
          between buyer and seller using GCash or Maya. For COD, the transaction is between buyer and
          rider. We are not responsible for any payment disputes. We recommend exercising caution when
          paying and always requesting a reference number or receipt.
        </p>
      </Section>

      <Section title="Reviews and Ratings">
        <p>
          Reviews and ratings on the platform are opinions of users and do not necessarily reflect the
          views of GoPalengke. We are not responsible for the content of reviews. Reviews are subject to
          moderation if they are offensive, fake, or misleading.
        </p>
      </Section>

      <Section title="External Links">
        <p>
          The platform may contain links to external websites (e.g., GCash, Maya). We are not responsible
          for the content or practices of these external websites. Please read their respective terms and
          privacy policies.
        </p>
      </Section>

      <Section title="No Warranty">
        <p>
          The platform is provided "as is" and "as available" without any warranty, expressed or implied.
          We do not guarantee that the platform will always be available, error-free, or uninterrupted. We
          are not responsible for any direct, indirect, incidental, or consequential damages that may arise
          from the use of the platform.
        </p>
      </Section>

      <Section title="Verification">
        <p>
          While we strive to verify all sellers and riders on the platform, we cannot guarantee that all
          information provided by users is accurate. We recommend using the video call feature before
          purchasing to personally inspect the product and verify the seller.
        </p>
      </Section>
    </div>
  );
}

// ============= PRIVACY POLICY =============
function PrivacyContent() {
  return (
    <div className="space-y-6 text-sm md:text-[15px] text-gray-700 leading-relaxed">
      <Section title="1. Introduction">
        <p>
          GoPalengke complies with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>
          of the Philippines. This Privacy Policy explains how we collect, use, and protect your personal
          information. By signing up and using the platform, you consent to the collection and use of your
          data in accordance with this policy.
        </p>
      </Section>

      <Section title="2. Personal Information Collected">
        <p>When you register on GoPalengke, the following may be collected:</p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Name</strong> — full name provided during registration</li>
          <li><strong>Email address</strong> — for account and communication</li>
          <li><strong>Phone number</strong> — for verification and contact</li>
          <li><strong>Address</strong> — barangay, city, region for delivery and store location</li>
          <li><strong>Profile photo / avatar</strong> — optional, for public profile</li>
          <li><strong>Rider verification details</strong> — age, family status, residence address, plate number, motor model, and valid ID photo (riders only)</li>
          <li><strong>Store information</strong> — store name, description, logo, banner, QR code, palengke name, and livestock transport permits (sellers only)</li>
          <li><strong>Location data</strong> — live GPS coordinates of the rider during active delivery, and store coordinates of the seller</li>
          <li><strong>Order and payment details</strong> — order history, payment method, reference numbers</li>
          <li><strong>Chat messages and video call records</strong> — for buyer-seller, buyer-rider, and admin-user conversations</li>
        </ul>
      </Section>

      <Section title="3. How Personal Information Is Used">
        <p>Your personal information is used for the following purposes:</p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Creating and managing your account</li>
          <li>Processing and delivering your orders</li>
          <li>Communication between buyers, sellers, riders, and admin</li>
          <li>Identity verification, especially for riders and sellers</li>
          <li>Verification of livestock vendor permits (BAI Registration and LGU Veterinary Health Certificates)</li>
          <li>Computing and collecting commission and monthly rent from sellers, and platform fees from riders</li>
          <li>Displaying public profiles and store pages to other users</li>
          <li>Live tracking of rider location during active delivery</li>
          <li>Reviews and ratings system</li>
          <li>Customer support and dispute resolution</li>
          <li>Platform security and fraud prevention</li>
        </ul>
      </Section>

      <Section title="4. Legal Basis Under the Data Privacy Act">
        <p>
          The processing of your personal data is based on:
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Consent</strong> — you gave permission upon signing up</li>
          <li><strong>Contractual necessity</strong> — required to deliver the service you requested</li>
          <li><strong>Legitimate interest</strong> — for platform security, fraud prevention, and service improvement</li>
          <li><strong>Legal obligation</strong> — when required by law</li>
        </ul>
      </Section>

      <Section title="5. Sharing of Personal Information">
        <p>
          We do not sell your personal data. We may share your data in the following situations:
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Between users</strong> — Your name, profile photo, phone number, and address are visible to the person you are chatting with in a chat or order transaction. Seller store information is public.</li>
          <li><strong>With Supabase</strong> — Our database and authentication are powered by Supabase, which stores data on secure servers.</li>
          <li><strong>With payment providers</strong> — If you use GCash or Maya, the payment transaction is subject to the privacy policy of the respective provider.</li>
          <li><strong>With authorities</strong> — If required by law or legal order, data may be shared with the appropriate authorities.</li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        <p>
          We make every effort to retain your personal data only for as long as necessary for the purposes
          stated in this policy. Account data, order history, and chat messages remain while your account
          is active. Upon account deletion, data may be retained in our database for legal or audit purposes
          for a reasonable period, after which it will be permanently erased.
        </p>
      </Section>

      <Section title="7. Data Security">
        <p>
          We take the following measures to protect your personal data:
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Row Level Security (RLS)</strong> — All database tables have RLS policies ensuring that only the data owner can access or edit their data.</li>
          <li><strong>Encrypted authentication</strong> — Passwords are hashed and we cannot see your password.</li>
          <li><strong>Secure storage</strong> — Images (profile, store, valid ID) are stored in secure storage buckets with access control.</li>
          <li><strong>Role-based access</strong> — Admin access is limited to authorized admin accounts only.</li>
          <li><strong>Session management</strong> — Login sessions are managed securely using secure tokens.</li>
        </ul>
      </Section>

      <Section title="8. User Rights Under the Data Privacy Act">
        <p>As a user under the Data Privacy Act of 2012, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Right to be informed</strong> — Know how your data is used (this policy)</li>
          <li><strong>Right to access</strong> — Request a copy of the personal data we hold about you</li>
          <li><strong>Right to object</strong> — Object to the processing of your data for purposes you have not permitted</li>
          <li><strong>Right to erasure or blocking</strong> — Request that your data be deleted or blocked if no longer necessary</li>
          <li><strong>Right to data portability</strong> — Request your data in a format that can be transferred to another service</li>
          <li><strong>Right to rectify</strong> — Correct any inaccurate or outdated information</li>
          <li><strong>Right to file a complaint</strong> — File a complaint with the National Privacy Commission if your rights have been violated</li>
        </ul>
        <p className="mt-2">
          To exercise any of these rights, you may contact the admin using the admin messaging feature on
          the platform.
        </p>
      </Section>

      <Section title="9. Cookies and Tracking">
        <p>
          The platform uses browser storage and session storage for authentication and user preferences.
          The platform does not use third-party tracking cookies for advertising.
        </p>
      </Section>

      <Section title="10. Location Data">
        <p>
          The rider's live location is collected and displayed to the buyer during active delivery for
          tracking purposes. After the order is delivered, live location is no longer collected. The
          seller's store coordinates are static and used for delivery fee computation and map display.
        </p>
      </Section>

      <Section title="11. Children">
        <p>
          The platform is not intended for children under 18 years of age. We do not knowingly collect
          personal data from children. If you believe we have collected data from a child without parental
          consent, you may contact the admin to have it deleted.
        </p>
      </Section>

      <Section title="12. Changes to the Privacy Policy">
        <p>
          This Privacy Policy may be updated from time to time. Changes take effect immediately after
          being posted on the platform. We recommend reviewing the policy periodically.
        </p>
      </Section>

      <Section title="13. Contact for Privacy Concerns">
        <p>
          For any questions or complaints regarding privacy, you may contact the admin using the admin
          messaging feature on the platform. You may also file a complaint with the National Privacy
          Commission (NPC) at www.privacy.gov.ph if you believe your rights under the Data Privacy Act
          of 2012 have been violated.
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

// ============= ANTI-SCAM & SPAM POLICY =============
function AntiscamContent() {
  return (
    <div className="space-y-6 text-sm md:text-[15px] text-gray-700 leading-relaxed">
      {/* Zero-tolerance banner */}
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertOctagon size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-red-700 text-sm">Zero-Tolerance Policy Against Scam and Spam</p>
          <p className="text-red-600 text-xs mt-1">
            GoPalengke maintains a zero-tolerance policy against any form of scam, fraud, and spam.
            Any user caught engaging in these activities will be penalized according to the severity of the violation,
            including permanent banning and blocking of hardware and IP addresses.
          </p>
        </div>
      </div>

      {/* Section 1: Prohibited Activities */}
      <Section title="1. Prohibited Activities (Zero-Tolerance)">
        <div className="space-y-3">
          {/* Fake orders & trip-cutting */}
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <ShoppingBag size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">Fake Orders and Trip-Cutting</p>
              <p className="text-red-600 text-xs mt-1">
                Placing bulk orders across multiple stores with no intention to pay, or
                significantly changing the delivery address far from the registered location is strictly
                prohibited. This is considered a scam against vendors and riders.
              </p>
            </div>
          </div>

          {/* Inventory locking / spam */}
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <Bot size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">Inventory Locking (Spam)</p>
              <p className="text-red-600 text-xs mt-1">
                Using bots or deliberately switching carts and creating fake orders just to
                lock a vendor's perishable goods inventory is a serious violation. This is not
                tolerated and will result in immediate penalties.
              </p>
            </div>
          </div>

          {/* Chat & spam abuse */}
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <MessageSquareWarning size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">Chat and Spam Abuse</p>
              <p className="text-red-600 text-xs mt-1">
                Using the vendor-buyer chat for automated spam, phishing links, external payment
                gateways, or invitations to transact outside the platform is strictly prohibited.
                The chat is for legitimate communication about orders only.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: System Protection & Verification */}
      <Section title="2. System Protection and Features">
        <div className="space-y-3">
          {/* Seller verification */}
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
            <BadgeCheck size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-700 text-sm">Seller Verification Process</p>
              <p className="text-green-600 text-xs mt-1">
                All registered vendors go through strict admin review — including
                location confirmation and a mandatory live video call verification to prove that
                there is a physical market stall or real inventory before approval.
              </p>
            </div>
          </div>

          {/* Suspicious activity monitoring */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <Eye size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-700 text-sm">Suspicious Activity Monitoring</p>
              <p className="text-blue-600 text-xs mt-1">
                The system automatically detects unusual behavior such as consecutive
                bulk orders in a short period, multi-store checkout at the same time, and rapid
                IP address changes within a single session.
              </p>
            </div>
          </div>

          {/* Coordinator layer */}
          <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <MapPin size={18} className="text-gray-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-700 text-sm">Coordinator Layer</p>
              <p className="text-gray-600 text-xs mt-1">
                Delivery distances and rates are automatically cross-verified by the system to block
                fake addresses and ensure the delivery price matches the actual distance.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 3: Enforcement & Sanctions */}
      <Section title="3. Penalties and Sanctions">
        <div className="space-y-3">
          {/* Warning & restriction */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-700 text-sm">Warning and Restriction</p>
              <p className="text-amber-600 text-xs mt-1">
                First-time minor offenses (such as accidental chat spam) will result
                in a system warning or temporary 24-hour block on chat function.
              </p>
            </div>
          </div>

          {/* Account suspension */}
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
            <Ban size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-700 text-sm">Suspension of Account</p>
              <p className="text-orange-600 text-xs mt-1">
                Repeated cancellations, fake orders, or failed COD will trigger automatic
                removal of the Cash on Delivery (COD) payment option from the user's account. From then on, online
                payment (QR Code) will be the only available option.
              </p>
            </div>
          </div>

          {/* Permanent ban */}
          <div className="flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-xl p-3">
            <UserX size={18} className="text-red-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-800 text-sm">Permanent Ban</p>
              <p className="text-red-700 text-xs mt-1">
                Proven scam, fraudulent listing of non-existent perishable products,
                use of spam bots, or payment fraud will result in immediate account deactivation,
                including blocking of hardware and IP addresses to prevent re-registering.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 4: Livestock & Live Animals Safety Guidelines */}
      <Section title="4. Livestock & Live Animals Safety Guidelines">
        <div className="space-y-4">
          {/* Highlighted info banner */}
          <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
            <PawPrint size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-700 text-sm">Livestock & Live Animals — Special Rules Apply</p>
              <p className="text-amber-600 text-xs mt-1">
                The sale of live animals on GoPalengke is subject to strict legal, logistical, and welfare
                requirements. Sellers and buyers must read and comply with all guidelines below before
                listing or purchasing any livestock.
              </p>
            </div>
          </div>

          {/* 4.1 Permitted Livestock Categories */}
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
            <Bird size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-700 text-sm">4.1 Permitted Livestock Categories</p>
              <p className="text-green-600 text-xs mt-1">
                The platform strictly allows the listing and sale of farm livestock only — including live
                chickens, ducks, turkeys, goats, and piglets — for agricultural, backyard breeding, or
                farming purposes. The listing, sale, or trade of wild exotic fauna, including any species
                protected under <strong>Republic Act No. 9147 (Wildlife Resources Conservation and Protection Act)</strong>,
                is <strong>absolutely banned</strong>. Any attempt to list protected wildlife will result in
                immediate removal of the listing and permanent account suspension.
              </p>
            </div>
          </div>

          {/* 4.2 Mandatory Legal Compliance (Sellers) */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <ShieldCheck size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-700 text-sm">4.2 Mandatory Legal Compliance (Sellers)</p>
              <p className="text-blue-600 text-xs mt-1">
                All livestock vendors must upload valid documentation before listing any live animal. This
                includes a <strong>Bureau of Animal Industry (BAI) Registration</strong> and a
                <strong> Local LGU Veterinary Health Certificate</strong> issued by the city or municipal
                veterinarian. Sellers must keep these documents updated and valid at all times. Failure to
                maintain current documentation will result in the immediate removal of all livestock listings
                from the platform without prior notice.
              </p>
            </div>
          </div>

          {/* 4.3 Logistics Restructure — Meet-Up / Pick-Up Only */}
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <Handshake size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">4.3 Complete Logistics Restructure — Meet-Up / Pick-Up Only</p>
              <p className="text-red-600 text-xs mt-1">
                Due to local quarantine checkpoints, health regulations, and animal welfare considerations,
                standard motorcycle riders and standard platform couriers are <strong>strictly prohibited</strong>
                from transporting live animals. When a cart contains any item from the "Livestock" category, the
                rider delivery option is automatically disabled by the system. The transaction is forced to
                <strong> "Store Pick-Up" or "Local Meet-Up"</strong> mode, and the delivery fee is overridden to
                <strong> exactly ₱0.00</strong>. Buyers and sellers must coordinate the pick-up or meet-up
                location and time directly through the platform's chat feature.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 5: Reporting */}
      <Section title="5. How to Report Scam or Spam">
        <p>
          If you see any suspicious activity, scam, or spam on the platform, you can
          report it immediately using the admin messaging feature in your dashboard. The admin will review it as soon as
          possible and take appropriate action based on this policy.
        </p>
      </Section>

      {/* Section 6: Contact */}
      <Section title="6. Contact">
        <p>
          For questions about this policy, you may contact the admin using the admin
          messaging feature on the platform dashboard.
        </p>
      </Section>
    </div>
  );
}

// ============= FAQ =============
function FaqContent() {
  const faqs = [
    {
      q: 'What is GoPalengke?',
      a: 'GoPalengke is the first online wet market in the Philippines. It is a platform that connects market vendors to buyers. You can order fresh fish, meat, vegetables, fruits, and other goods from the palengke nearest to you, and have them delivered directly to your home.',
    },
    {
      q: 'How do I sign up?',
      a: 'Click "Sign Up" on the homepage. Choose your role — Buyer, Seller, or Rider. Enter your email, password, name, and phone number. After signing up, you will need to wait for admin approval before you can use the platform.',
    },
    {
      q: 'What is the difference between a Buyer, Seller, and Rider?',
      a: 'A Buyer is a customer who places orders. A Seller is a vendor who posts products and receives orders. A Rider is the person who delivers orders from the seller to the buyer. The Admin handles approvals, announcements, and platform moderation.',
    },
    {
      q: 'How do I order as a Buyer?',
      a: 'Browse stores or products on the dashboard. Add items to your cart. Choose a payment method — QR Code (GCash/Maya) or Cash on Delivery (COD). Checkout and wait for the seller to confirm. You can chat with the seller and rider in the Messages tab for updates.',
    },
    {
      q: 'Why do I need to chat and video call before buying?',
      a: 'To ensure the seller is legitimate and to see the actual product before you buy. Using the Messages tab in your dashboard, you can chat and video call the seller. This is for your protection and security.',
    },
    {
      q: 'What are the payment methods?',
      a: 'Two payment methods: (1) QR Code — pay using GCash or Maya to the seller\'s QR code, and enter a reference number as proof of payment. (2) Cash on Delivery (COD) — pay the rider in cash upon delivery to your home.',
    },
    {
      q: 'What is COD and how does it work?',
      a: 'With Cash on Delivery, you pay cash to the rider upon delivery. Make sure someone is home to pay and receive the order. The rider will report in the app that payment has been received.',
    },
    {
      q: 'How do I get started as a Seller?',
      a: 'After being approved by the admin, set up your store on the dashboard — store name, description, logo, banner, and palengke location. Post products with prices, stock, and photos. When you receive an order, you will get a notification and can chat with the buyer.',
    },
    {
      q: 'How much is the commission and monthly rent for Sellers?',
      a: 'Each sale has a 3% commission paid to the platform. The monthly rent is FREE until your total gross sales reach ₱5,000. Once you reach ₱5,000, a monthly rent of ₱700 is automatically activated and added to your running balance. The 3% commission and ₱700 rent are combined into a single "Current Balance Due" in the Billing tab. You can keep using the app while the balance grows, but once it reaches ₱1,000, you will need to pay to avoid account deactivation.',
    },
    {
      q: 'What happens if I cannot pay my fees as a Seller?',
      a: 'You can continue using the app while your balance grows. Once your combined balance (3% commission + ₱700 rent) reaches ₱1,000, the system will alert you and show the payment portal (QR code). If you do not pay within the grace period, your account will be frozen — you will not be able to post products or receive orders until the outstanding balance is paid.',
    },
    {
      q: 'What happens if there is a negative review about spoiled or damaged products?',
      a: 'A single negative review from a buyer regarding spoiled, old, or damaged food products will result in immediate removal of the seller from the platform. No second chances. Always ensure your products are Class A and fresh.',
    },
    {
      q: 'How do I get started as a Rider?',
      a: 'After signing up as a rider and being approved by the admin, you must submit identity verification — age, family status, residence address, plate number, motor model, and a valid ID photo. After that, you can accept delivery assignments on the dashboard.',
    },
    {
      q: 'How much does it cost to be a Rider?',
      a: 'A 3% platform fee is deducted from each delivery earning. Once your accumulated platform fees reach ₱500, you will need to pay through the Billing tab. While your account is frozen due to unpaid fees, you can still log in and view your dashboard, but you cannot accept new deliveries. After your payment is approved by the admin, your account is reactivated and the 3% fee starts accumulating again.',
    },
    {
      q: 'How do I accept a delivery assignment as a Rider?',
      a: 'On the rider dashboard, you will see available deliveries. Accept the order, go to the store to pick up the order, update the status in the app (picked up), and deliver to the buyer. Update the status to delivered after completing the delivery.',
    },
    {
      q: 'How does live tracking work?',
      a: 'During an active delivery, your live GPS location (as a rider) is shown to the buyer on a map. The buyer can see where you are and when you will arrive. After delivery is completed, live location is no longer collected.',
    },
    {
      q: 'How is the delivery fee computed?',
      a: 'The delivery fee is based on the distance between the store and the buyer\'s delivery address. It is automatically computed by the platform when the buyer checks out.',
    },
    {
      q: 'How do I chat with the seller or rider?',
      a: 'Go to the Messages tab on the dashboard. Conversations are automatically created based on your order. You can send text messages or video call the seller before buying, and the rider during an ongoing delivery.',
    },
    {
      q: 'How does video call work?',
      a: 'In the Messages tab, you can video call the seller or rider. Click the video call icon and wait for the other party to accept. Video calls are important for verifying products or clarifying order details.',
    },
    {
      q: 'How do I leave a review?',
      a: 'After the order is delivered, you can leave a rating (1-5 stars) and a comment for the seller and rider. Reviews are important to maintain service quality and protect other buyers.',
    },
    {
      q: 'Does each user have a public profile?',
      a: 'Yes. Each user has a public profile page visible to others. For sellers, this includes a store page showing products. For riders, it includes verification details. Profile or store page links can be shared.',
    },
    {
      q: 'How do I update my store information?',
      a: 'As a seller, go to store settings on the dashboard. You can update the store name, description, logo, banner, QR code, location, and palengke name. You can also add or change products at any time.',
    },
    {
      q: 'What happens if there is a problem with an order?',
      a: 'You can chat with the seller or rider using the Messages tab. If unresolved, you can contact the admin using the admin messaging feature. The admin can also video call you for support.',
    },
    {
      q: 'How do I protect my personal data?',
      a: 'GoPalengke complies with the Data Privacy Act of 2012. All database tables have Row Level Security ensuring that only you can access your data. We do not sell your data. Read the Privacy Policy for details.',
    },
    {
      q: 'How do I contact the admin?',
      a: 'Using the admin messaging feature on the dashboard, you can send a message to the admin for any question, complaint, or request. The admin can also video call you for verification or support.',
    },
    {
      q: 'Can I sell even without a stall in the palengke?',
      a: 'Yes. You can sell on GoPalengke even without a physical stall in the palengke, as long as it is a legitimate business and products are Class A and fresh. However, if you do have a stall in the palengke, you can enter the palengke name in store settings.',
    },
    {
      q: 'Can I sell live animals or livestock on GoPalengke?',
      a: 'Yes, but only farm livestock — live chickens, ducks, turkeys, goats, and piglets — for agricultural, backyard breeding, or farming purposes. Wild exotic fauna or any species protected under Republic Act No. 9147 is absolutely banned. Sellers must upload a valid Bureau of Animal Industry (BAI) Registration and Local LGU Veterinary Health Certificate. Failure to keep these updated will result in immediate removal of livestock listings.',
    },
    {
      q: 'Why can\'t livestock be delivered by a rider?',
      a: 'Due to local quarantine checkpoints, health regulations, and animal welfare, standard motorcycle riders and platform couriers are strictly prohibited from transporting live animals. When your cart contains a livestock item, the rider delivery option is automatically disabled. The system forces the transaction to "Store Pick-Up" or "Local Meet-Up" mode, and the delivery fee is set to exactly ₱0.00. You and the seller must coordinate the pick-up or meet-up location and time through the platform\'s chat feature.',
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
