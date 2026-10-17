import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Phone sign-up via Twilio Verify. Phone accounts get a synthetic login email
// (<digits>@phone.gopalengke.net) so the existing email/password auth keeps working.

export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  let local = "";
  if (d.startsWith("63") && d.length === 12) local = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) local = d.slice(1);
  else if (d.startsWith("9") && d.length === 10) local = d;
  if (!/^9\d{9}$/.test(local)) return null;
  return `+63${local}`;
}

export function phoneLoginEmail(e164: string) {
  return `${e164.replace(/\D/g, "")}@phone.gopalengke.net`;
}

async function adminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { GP_URL } = await import("./onboarding-reminders.server");
  const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Hindi naka-configure ang sign-up.");
  return createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function twilio(path: string, body: Record<string, string>) {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const svc = process.env["TWILIO_VERIFY_SERVICE_SID"];
  if (!sid || !token || !svc) throw new Error("Hindi pa naka-configure ang SMS verification.");
  const res = await fetch(`https://verify.twilio.com/v2/Services/${svc}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Twilio ${path} failed [${res.status}]`, json);
    if (json?.code === 60203) throw new Error("Masyadong maraming subok. Maghintay ng ilang minuto.");
    if (json?.code === 60200 || json?.code === 21211) throw new Error("Hindi valid ang cellphone number.");
    if (res.status === 404 && path === "VerificationCheck") return { status: "expired" };
    throw new Error("Hindi maipadala ang SMS. Subukan ulit.");
  }
  return json;
}

async function phoneTaken(sb: any, e164: string) {
  const local = "0" + e164.slice(3);
  const { data } = await sb.from("profiles").select("id").or(`phone.eq.${e164},phone.eq.${local},email.eq.${phoneLoginEmail(e164)}`).limit(1);
  return (data?.length ?? 0) > 0;
}

export const sendPhoneSignupCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: z.string().max(20) }).parse(d))
  .handler(async ({ data }) => {
    const e164 = normalizePhone(data.phone);
    if (!e164) throw new Error("Ilagay ang tamang cellphone number (hal. 09171234567).");
    const sb = await adminClient();
    if (await phoneTaken(sb, e164)) throw new Error("May account na sa number na ito. Mag-sign in na lang.");
    await twilio("Verifications", { To: e164, Channel: "sms" });
    return { ok: true };
  });

export const completePhoneSignup = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().max(20),
        code: z.string().regex(/^\d{4,8}$/),
        password: z.string().min(6).max(100),
        role: z.enum(["buyer", "seller", "rider"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const e164 = normalizePhone(data.phone);
    if (!e164) throw new Error("Hindi valid ang cellphone number.");
    const check = await twilio("VerificationCheck", { To: e164, Code: data.code });
    if (check?.status !== "approved") throw new Error("Mali o expired na ang code.");

    const sb = await adminClient();
    if (await phoneTaken(sb, e164)) throw new Error("May account na sa number na ito. Mag-sign in na lang.");
    const email = phoneLoginEmail(e164);
    const { data: created, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      password: data.password,
    });
    if (error || !created?.user) {
      console.error("createUser failed", error);
      throw new Error("Hindi makagawa ng account. Subukan ulit.");
    }
    const { error: pErr } = await sb.from("profiles").insert({
      id: created.user.id,
      email,
      full_name: "",
      role: data.role,
      phone: "0" + e164.slice(3),
      email_verified: true,
      phone_verified: true,
      is_approved: data.role === "buyer",
      vehicle_type: data.role === "rider" ? "motorcycle" : null,
    });
    if (pErr) {
      console.error("profile insert failed", pErr);
      await sb.auth.admin.deleteUser(created.user.id);
      throw new Error("Hindi makagawa ng account. Subukan ulit.");
    }
    return { ok: true, email };
  });
