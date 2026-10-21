import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import heroImg from "@/assets/beta-hero.jpg";
import { supabase } from "@/legacy/lib/supabase";

const ANDROID_URL = "https://play.google.com/store/apps/details?id=net.gopalengke";
const WEB_URL = "https://play.google.com/apps/testing/net.gopalengke";

const title = "Maging GoPalengke Beta Tester — Closed Testing";
const description =
  "Tulungan ang GoPalengke na makapasok sa Google Play Store. Sumali sa closed testing, i-install ang app, at gamitin ito sa loob ng 14 na araw.";

export const Route = createFileRoute("/beta-tester")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BetaTesterPage,
});

const steps = [
  {
    n: 1,
    t: "Ilagay ang pangalan at Gmail mo sa form",
    d: "Gamitin ang parehong Gmail account na naka-login sa Play Store ng Android phone mo.",
  },
  {
    n: 2,
    t: "Hintayin ang email mula sa GoPalengke",
    d: "Idadagdag ka namin sa tester list. May matatanggap kang email na may download link — i-check ang inbox at spam folder.",
  },
  {
    n: 3,
    t: "I-install at buksan ang app",
    d: "I-download ang GoPalengke mula sa Play Store. Kung hindi pa lumalabas, maghintay ng ilang minuto at i-refresh.",
  },
  {
    n: 4,
    t: "Gamitin sa loob ng 14 na araw",
    d: "Huwag i-uninstall. Buksan at i-explore ang app kahit isang beses kada araw para makumpleto ang requirement ni Google.",
  },
];

const faqs = [
  {
    q: "Bakit \"App not available\" ang lumalabas?",
    a: "Baka hindi ka pa naidadagdag sa tester list, o ibang Gmail account ang gamit mo sa Play Store. Hintayin ang email namin at gamitin ang parehong Gmail.",
  },
  {
    q: "Libre ba ito?",
    a: "Oo, libre ang pag-install at pag-test. Ligtas ito at galing mismo sa Google Play Store.",
  },
  {
    q: "Ano ang gagawin ko sa app?",
    a: "Mag-browse ng tindahan, tingnan ang mga produkto, at subukan ang mga features. Kung may makita kang problema, i-message kami sa Contact page.",
  },
];

function BetaTesterPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <img
          src={heroImg}
          alt=""
          aria-hidden="true"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover object-[33%_center]"
        />
        <img
          src={heroImg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[33%_center] blur-[6px] [mask-image:linear-gradient(to_right,black_0%,black_10%,transparent_38%)]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-deep/92 via-primary-deep/60 to-primary-deep/20" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 text-center">
          <span className="inline-block rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold tracking-wide">
            GOOGLE PLAY CLOSED TESTING
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight [text-shadow:0_2px_18px_rgb(0_0_0/0.5)] md:text-5xl">
            Maging Opisyal na GoPalengke Beta Tester!
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base opacity-90 [text-shadow:0_1px_10px_rgb(0_0_0/0.5)] md:text-lg">

            Kailangan namin ng hindi bababa sa 12 testers na gagamit ng app sa loob ng 14 na araw para
            mailabas ang GoPalengke sa Google Play Store para sa buong Pilipinas.
          </p>
        </div>
      </section>

      <BetaSignupForm />

      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-center text-2xl font-bold">Paano Sumali</h2>
        <ol className="mt-8 space-y-4">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                {s.n}
              </div>
              <div>
                <h3 className="font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-muted/50">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="text-center text-2xl font-bold">Pumili kung paano sasali bilang tester</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Gamitin lang ito pagkatanggap mo ng email namin.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <a
              href={ANDROID_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition hover:border-primary"
            >
              <div className="text-4xl">📱</div>
              <h3 className="mt-3 text-lg font-bold">Sumali via Android</h3>
              <p className="mt-1 text-sm text-muted-foreground">Buksan diretso sa Play Store app ng phone mo.</p>
              <span className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Buksan sa Play Store
              </span>
            </a>
            <a
              href={WEB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition hover:border-primary"
            >
              <div className="text-4xl">🌐</div>
              <h3 className="mt-3 text-lg font-bold">Sumali via Web</h3>
              <p className="mt-1 text-sm text-muted-foreground">Mag-opt in gamit ang browser, tapos i-install sa phone.</p>
              <span className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Mag-opt in sa Web
              </span>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-center text-2xl font-bold">Mga Madalas Itanong</h2>
        <div className="mt-6 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Maraming salamat sa pagtulong sa GoPalengke! 💚{" "}
          <a href="/" className="font-semibold text-primary underline">Bumalik sa Home</a>
        </p>
      </section>
    </main>
  );
}

function BetaSignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    const m = email.trim().toLowerCase();
    if (n.length < 2 || n.length > 100) return setError("Pakilagay ang buong pangalan mo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) || m.length > 255) return setError("Pakilagay ang tamang email address.");
    setState("saving");
    const { error } = await supabase.from("beta_testers").insert({ full_name: n, email: m });
    if (error && error.code !== "23505") {
      setState("idle");
      return setError("Hindi naisumite. Pakisubukan ulit mamaya.");
    }
    try { localStorage.setItem("gopalengke_beta_joined", "1"); } catch {}
    setState("done");
  }

  return (
    <section className="mx-auto max-w-xl px-5 pt-12">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-center text-2xl font-bold">Sumali sa Beta Testing</h2>
        {state === "done" ? (
          <div className="mt-5 rounded-xl bg-primary/10 p-4 text-sm text-foreground" role="status">
            <p className="font-semibold text-primary">✅ Salamat sa pagsali!</p>
            <p className="mt-2">May matatanggap kang email mula sa GoPalengke na may download link ng app. I-check ang inbox mo (pati spam folder) paminsan-minsan.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Buong pangalan" aria-label="Buong pangalan" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="Gmail address (gamit sa Play Store)" aria-label="Gmail address" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm" />
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">📧 Pagkatapos mag-submit, may matatanggap kang email na may download link ng app. I-check lang ang inbox mo anytime.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={state === "saving"} className="w-full rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground disabled:opacity-60">
              {state === "saving" ? "Isinusumite..." : "Sumali bilang Beta Tester"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
