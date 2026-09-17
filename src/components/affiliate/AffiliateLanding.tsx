import { useState } from 'react';
import { navigate } from '@/lib/router';
import {
  TrendingUp, Store, Bike, Wallet, ArrowRight, Users, Calculator,
  Sparkles, Check, ChevronRight, DollarSign, PiggyBank, Copy, CheckCheck,
} from 'lucide-react';

export function AffiliateLanding() {
  const [sellers, setSellers] = useState(10);
  const [riders, setRiders] = useState(20);

  // Calculation logic from the spec:
  // Per seller: ₱50,000 gross sales → 3% = ₱1,500 commission + ₱700 rent = ₱2,200 admin collections
  // ₱2,200 / ₱1,000 = 2.2 milestones × ₱200 = ₱440 per seller
  // Per rider: 20 trips/day × 25 days = 500 trips × ₱10 = ₱5,000 admin collections
  // ₱5,000 / ₱500 = 10 milestones × ₱50 = ₱500 per rider
  const sellerIncome = sellers * 440;
  const riderIncome = riders * 500;
  const totalIncome = sellerIncome + riderIncome;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <span className="text-lg font-bold text-gray-800">GoPalengke</span>
              <span className="text-xs text-brand-600 font-medium ml-1">Affiliate</span>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/affiliate/login')}
              className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-800 transition"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/affiliate/register')}
              className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-sm active:scale-95 transition"
            >
              Join Now
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700">
        <div className="absolute top-10 left-10 w-48 h-48 bg-green-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-emerald-300/10 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-5 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
            <Sparkles size={16} className="text-yellow-300" />
            <span className="text-white text-sm font-medium">Lifetime Passive Income Program</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Kumita ng Unli-Passive Income sa Pag Share ng GoPalengke Para Malaman ng Maraming Tao
          </h1>
          <p className="text-green-50 text-base md:text-lg max-w-2xl mx-auto mb-8">
            I-refer ang mga seller at rider sa GoPalengke at kumita ng lifetime commission sa bawat
            milestone na maabot nila. Walang limit.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/affiliate/register')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-green-700 rounded-2xl font-extrabold text-base shadow-xl active:scale-95 transition flex items-center justify-center gap-2"
            >
              Join as Affiliate Partner
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => navigate('/affiliate/login')}
              className="w-full sm:w-auto px-8 py-4 bg-white/15 backdrop-blur-sm text-white rounded-2xl font-bold text-base border border-white/30 active:scale-95 transition"
            >
              Affiliate Login
            </button>
          </div>
        </div>
      </section>

      {/* Mechanics */}
      <section className="max-w-5xl mx-auto px-5 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Paano Ito Gumagana?</h2>
          <p className="text-gray-500 text-sm">Dalawang paraan ng pagkakita — Seller Milestone at Rider Milestone</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Seller Milestone Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Store size={22} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Seller Milestone</h3>
                <p className="text-orange-50 text-xs">₱200 kada ₱1,000 collected</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={14} className="text-green-600" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Kapag ang admin ay nakapag-collect ng <strong>₱1,000</strong> mula sa seller na ikaw ang nag refer
                  (mula sa 3% transaction fee + ₱700 platform rent), awtomatikong ibabawas ang
                  <strong> ₱200</strong> at ipapasa sa iyo as kita mo bilang affiliate.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                <p className="font-medium text-gray-600 mb-1">Halimbawa:</p>
                <p>₱50,000 sales × 3% = ₱1,500 + ₱700 rent = <strong>₱2,200 collected</strong></p>
                <p>₱2,200 / ₱1,000 = 2.2 milestones × ₱200 = <strong>₱440 sa'yo</strong></p>
              </div>
            </div>
          </div>

          {/* Rider Milestone Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Bike size={22} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Rider Milestone</h3>
                <p className="text-blue-50 text-xs">₱50 kada ₱500 collected</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={14} className="text-green-600" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Kapag ang admin ay nakapag-collect ng <strong>₱500</strong> mula sa isang rider
                  (mula sa booking fees / wallet deductions), awtomatikong ibabawas ang
                  <strong> ₱50</strong> at ipapasa sa iyo as affiliate bilang kita.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                <p className="font-medium text-gray-600 mb-1">Halimbawa:</p>
                <p>20 trips/day × 25 days = 500 trips × ₱10 fee = <strong>₱5,000 collected</strong></p>
                <p>₱5,000 / ₱500 = 10 milestones × ₱50 = <strong>₱500 sa'yo</strong></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Earnings Calculator */}
      <section className="bg-gradient-to-b from-gray-50 to-green-50 py-12">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-brand-50 rounded-full px-4 py-1.5 mb-3">
              <Calculator size={16} className="text-brand-600" />
              <span className="text-brand-700 text-sm font-medium">Earnings Calculator</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Kalkulahin ang Potensyal na Kita</h2>
            <p className="text-gray-500 text-sm mt-1">Ajustahin ang dami ng mga referrals para makita ang potensyal na kita bawat buwan</p>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 md:p-8">
            {/* Sliders */}
            <div className="space-y-6">
              {/* Sellers slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Store size={16} className="text-orange-500" /> Active Sellers
                  </label>
                  <span className="text-lg font-bold text-gray-800 bg-orange-50 px-3 py-1 rounded-lg">{sellers}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={sellers}
                  onChange={e => setSellers(Number(e.target.value))}
                  className="w-full h-2 bg-orange-100 rounded-full appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>1</span><span>50</span><span>100</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">₱440 per seller / month</p>
              </div>

              {/* Riders slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Bike size={16} className="text-blue-500" /> Active Riders
                  </label>
                  <span className="text-lg font-bold text-gray-800 bg-blue-50 px-3 py-1 rounded-lg">{riders}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="200"
                  value={riders}
                  onChange={e => setRiders(Number(e.target.value))}
                  className="w-full h-2 bg-blue-100 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>1</span><span>100</span><span>200</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">₱500 per rider / month</p>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-3">
                <PiggyBank size={20} className="text-yellow-300" />
                <span className="text-sm font-medium text-green-50">Potential Passive Income</span>
              </div>
              <p className="text-4xl font-extrabold mb-3">
                ₱{totalIncome.toLocaleString()} <span className="text-lg font-medium text-green-200">/ month</span>
              </p>
              <div className="flex gap-4 text-xs text-green-100">
                <span className="flex items-center gap-1">
                  <Store size={12} /> Sellers: ₱{sellerIncome.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Bike size={12} /> Riders: ₱{riderIncome.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/affiliate/register')}
              className="w-full mt-5 py-3.5 bg-brand-600 text-white rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
            >
              Simulan ang Pag-earn
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-5">
        <div className="max-w-3xl mx-auto bg-gray-900 rounded-3xl p-8 text-center">
          <DollarSign size={32} className="text-green-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Ready to Start Earning?</h2>
          <p className="text-gray-400 text-sm mb-5">Mag-register na bilang affiliate partner at magsimulang i-refer ang mga seller at rider.</p>
          <button
            onClick={() => navigate('/affiliate/register')}
            className="px-8 py-3.5 bg-green-500 text-white rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition inline-flex items-center gap-2"
          >
            Join as Affiliate Partner
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 px-5 py-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-7 h-7 rounded-lg object-cover" />
            <span className="text-lg font-bold text-white">GoPalengke</span>
          </div>
          <p className="text-xs mb-3">© 2026 GoPalengke Affiliate Program. All rights reserved.</p>
          <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-white transition">
            Bumalik sa GoPalengke
          </button>
        </div>
      </footer>
    </div>
  );
}
