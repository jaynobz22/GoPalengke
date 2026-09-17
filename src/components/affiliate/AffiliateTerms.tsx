import { navigate } from '@/lib/router';
import { ArrowLeft, FileText, ShieldCheck, Scale } from 'lucide-react';

export function AffiliateTerms() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/affiliate')} className="flex items-center gap-2">
            <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <span className="text-lg font-bold text-gray-800">GoPalengke</span>
              <span className="text-xs text-brand-600 font-medium ml-1">Affiliate</span>
            </div>
          </button>
          <button
            onClick={() => navigate('/affiliate')}
            className="flex items-center gap-1.5 text-gray-600 text-sm font-medium hover:text-gray-800 transition"
          >
            <ArrowLeft size={16} /> Back to Landing Page
          </button>
        </div>
      </nav>

      {/* Header */}
      <header className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 text-white">
        <div className="max-w-4xl mx-auto px-5 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-4">
            <Scale size={16} className="text-yellow-300" />
            <span className="text-white text-sm font-medium">Legal Document</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold mb-2">
            Affiliate Program Terms of Service and Rules
          </h1>
          <p className="text-green-50 text-sm max-w-2xl mx-auto">
            Please read these terms carefully before participating in the GoPalengke Affiliate Program.
            By registering and using your affiliate account, you acknowledge that you understand and
            agree to be bound by the terms set forth below.
          </p>
          <p className="text-green-200 text-xs mt-4">Last Updated: September 17, 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-5 py-10">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10 space-y-10">

          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                <FileText size={20} className="text-brand-700" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-gray-800">
                1. Program Overview &amp; Eligibility
              </h2>
            </div>
            <div className="space-y-3 pl-1">
              <p className="text-sm md:text-[15px] text-gray-600 leading-relaxed">
                The <strong>GoPalengke Affiliate Program</strong> is a performance-based marketing
                system that rewards individuals for referring new sellers and riders to the GoPalengke
                platform. Affiliates earn commissions based on milestone achievements tied to actual
                administrative collections from their referred accounts.
              </p>
              <ul className="space-y-2 text-sm md:text-[15px] text-gray-600 leading-relaxed list-disc pl-5">
                <li>
                  Affiliates must maintain a <strong>valid and active account</strong> with a verified
                  local payout method on file, such as <strong>GCash</strong>, <strong>Maya</strong>, or
                  <strong> GoTyme</strong>. Failure to maintain a valid payout method may result in
                  delayed or withheld disbursements.
                </li>
                <li>
                  Affiliates are <strong>independent contractors</strong> and are not employees,
                  partners, joint venturers, or direct legal agents of GoPalengke. Nothing in these
                  terms shall be construed as creating an employer-employee relationship.
                </li>
                <li>
                  Affiliates are solely responsible for any tax obligations arising from commissions
                  earned through this program. GoPalengke does not withhold taxes on behalf of
                  affiliates.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                <ShieldCheck size={20} className="text-brand-700" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-gray-800">
                2. Milestone-Based Commission Structure
              </h2>
            </div>
            <p className="text-sm md:text-[15px] text-gray-600 leading-relaxed mb-4 pl-1">
              Commissions are calculated and credited based on verified administrative collections
              from referred accounts. The following milestone thresholds define when a payout is
              triggered:
            </p>

            {/* Seller Referrals */}
            <div className="bg-orange-50 rounded-2xl border border-orange-100 p-5 mb-4">
              <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">A</span>
                Seller Referrals
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                A commission is triggered <strong>only</strong> when the Admin successfully collects
                an accumulated amount of <strong>₱1,000</strong> from a referred seller. This
                accumulation combines the <strong>3% seller transaction fee</strong> and the
                <strong> ₱700 platform rental fee</strong>. Upon successful collection and
                verification of the full ₱1,000 threshold, a commission of <strong>₱200</strong> is
                credited to the affiliate's wallet.
              </p>
            </div>

            {/* Rider Referrals */}
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 mb-4">
              <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">B</span>
                Rider Referrals
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                A commission is triggered <strong>only</strong> when the Admin successfully collects
                an accumulated amount of <strong>₱500</strong> from a referred rider, whether through
                booking fees or wallet deductions. Upon successful collection and verification of the
                full ₱500 threshold, a commission of <strong>₱50</strong> is credited to the
                affiliate's wallet.
              </p>
            </div>

            {/* Fractional Carry-Over */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-600 text-white text-xs font-bold flex items-center justify-center">C</span>
                Fractional Carry-Over Rule
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Any accumulated collections that fall short of the next milestone threshold will
                safely remain as a <strong>fractional credit balance</strong> on the referred
                account. This balance carries forward and continues to accumulate until the
                respective milestone is fully completed. Partial thresholds do not trigger partial
                payouts.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">
              3. Anti-Fraud &amp; Strict Prohibited Conduct
            </h2>
            <p className="text-sm md:text-[15px] text-gray-600 leading-relaxed mb-4 pl-1">
              To safeguard the integrity of the affiliate system and ensure fair compensation for all
              participants, the following actions are strictly prohibited. Violation of any item
              below may result in immediate account suspension, forfeiture of unpaid balances, and
              permanent ban from the program.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-red-50 rounded-xl p-4 border border-red-100">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Fake Registrations</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mt-0.5">
                    The creation of fraudulent or dummy seller/rider accounts using false personal
                    details, fabricated business information, or misleading contact data solely to
                    bypass system verification or artificially inflate referral counts is strictly
                    forbidden.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-red-50 rounded-xl p-4 border border-red-100">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Self-Referral</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mt-0.5">
                    Affiliates are strictly prohibited from signing up as a seller or rider using
                    their own affiliate tracking links, or from referring immediate household
                    members or accounts under their direct control for the purpose of generating
                    self-awarded commissions.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-red-50 rounded-xl p-4 border border-red-100">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Receipt Forgery</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mt-0.5">
                    Uploading altered, fraudulent, or previously used GCash/GoTyme payment receipt
                    screenshots in an attempt to fake milestone achievements or accelerate
                    commission payouts will result in immediate termination of the affiliate
                    account and forfeiture of all pending earnings.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-red-50 rounded-xl p-4 border border-red-100">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">4</span>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Spamming</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mt-0.5">
                    Unauthorized mass distribution of affiliate links across random channels,
                    forums, or messaging platforms without proper content presentation or relevant
                    context is grounds for an account review. Repeated or egregious spamming may
                    lead to suspension.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">
              4. Penalties, Suspension, and Forfeiture
            </h2>
            <div className="space-y-3 pl-1">
              <p className="text-sm md:text-[15px] text-gray-600 leading-relaxed">
                GoPalengke Admin retains the <strong>absolute right</strong> to investigate any
                suspicious traffic spikes, unusual milestone triggers, or flagged receipt uploads at
                any time, without prior notice to the affiliate.
              </p>
              <p className="text-sm md:text-[15px] text-gray-600 leading-relaxed">
                Upon verification of a violation, the following actions will be applied
                immediately and without warning:
              </p>
              <ul className="space-y-2 text-sm md:text-[15px] text-gray-600 leading-relaxed list-disc pl-5">
                <li>
                  <strong>Immediate deactivation</strong> of the affiliate account, revoking all
                  access to the affiliate dashboard and referral tools.
                </li>
                <li>
                  <strong>Continuous blocking</strong> of the user's dashboard, preventing any
                  further login, link generation, or commission tracking.
                </li>
                <li>
                  <strong>Complete forfeiture</strong> of all unpaid wallet balances, including any
                  pending or in-progress milestone commissions, with no obligation for GoPalengke
                  to disburse forfeited amounts.
                </li>
              </ul>
              <p className="text-sm md:text-[15px] text-gray-600 leading-relaxed">
                Decisions rendered by the GoPalengke Admin following an investigation are final and
                binding.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">
              5. Payout Procedures &amp; Modifications
            </h2>
            <div className="space-y-3 pl-1">
              <p className="text-sm md:text-[15px] text-gray-600 leading-relaxed">
                All payouts are <strong>manually approved</strong> by the Admin upon verification of
                true funds transferred through the official <strong>GoTyme</strong> or
                <strong> GCash QR payment system</strong>. Affiliates must submit a payout request
                through their dashboard once the minimum wallet balance threshold is met.
              </p>
              <p className="text-sm md:text-[15px] text-gray-600 leading-relaxed">
                GoPalengke reserves the right to <strong>modify commission thresholds, percentage
                structures, payout minimums, or any other terms</strong> set forth in this document
                at any time. Such modifications will be communicated to affiliates with prior notice
                through the <strong>Affiliate Dashboard notification banner</strong>. Continued
                participation in the program after a modification takes effect constitutes
                acceptance of the updated terms.
              </p>
            </div>
          </section>

          {/* Acceptance note */}
          <div className="bg-brand-50 rounded-2xl border border-brand-100 p-5 text-center">
            <p className="text-sm text-brand-800 leading-relaxed">
              By creating an affiliate account and using your referral links, you confirm that you
              have read, understood, and agreed to all the terms and rules stated in this document.
            </p>
          </div>
        </div>

        {/* Bottom back button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/affiliate')}
            className="px-6 py-3 bg-white text-gray-700 rounded-xl text-sm font-semibold border border-gray-200 hover:border-brand-300 hover:text-brand-700 transition flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Back to Landing Page
          </button>
          <button
            onClick={() => navigate('/affiliate/dashboard')}
            className="px-6 py-3 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-sm active:scale-95 transition flex items-center gap-2"
          >
            Back to Dashboard
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 px-5 py-8 mt-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-7 h-7 rounded-lg object-cover" />
            <span className="text-lg font-bold text-white">GoPalengke</span>
          </div>
          <p className="text-xs mb-2">© 2026 GoPalengke Affiliate Program. All rights reserved.</p>
          <button onClick={() => navigate('/affiliate')} className="text-xs text-gray-400 hover:text-white transition">
            Bumalik sa Affiliate Landing
          </button>
        </div>
      </footer>
    </div>
  );
}
