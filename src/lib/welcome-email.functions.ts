import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { GP_URL, GP_ANON } from "./onboarding-reminders.server";
import { sendWelcomeEmailFor } from "./welcome-email.server";

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(20) }).parse(d))
  .handler(async ({ data }) => {
    const sb = createClient(GP_URL, GP_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: userData, error } = await sb.auth.getUser(data.accessToken);
    if (error || !userData.user) throw new Error("Hindi valid ang session.");
    return sendWelcomeEmailFor(sb, userData.user.id);
  });
