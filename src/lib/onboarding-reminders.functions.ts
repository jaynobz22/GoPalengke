import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { GP_URL, GP_ANON, runOnboardingReminders } from "./onboarding-reminders.server";

export const onboardingReminders = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(20), send: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const sb = createClient(GP_URL, GP_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser(data.accessToken);
    if (userErr || !userData.user) throw new Error("Hindi naka-login bilang admin.");
    const { data: me } = await sb.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if ((me as any)?.role !== "admin") throw new Error("Admin lang ang pwedeng gumamit nito.");

    return runOnboardingReminders(sb, data.send);
  });
