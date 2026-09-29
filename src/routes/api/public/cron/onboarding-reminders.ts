import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { GP_URL, runOnboardingReminders } from "@/lib/onboarding-reminders.server";

// Called once a day by the GoPalengke database scheduler.
// Caller must send the GoPalengke service key as Bearer token.
export const Route = createFileRoute("/api/public/cron/onboarding-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
        if (!key) return new Response("Server configuration error", { status: 500 });
        const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const d = (v: string) => createHash("sha256").update(v).digest();
        if (!token || !timingSafeEqual(d(token), d(key))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const sb = createClient(GP_URL, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        try {
          const result = await runOnboardingReminders(sb, true);
          return Response.json({ sent: result.sent, failed: result.failed, total: result.total });
        } catch (e) {
          console.error("onboarding cron failed", e);
          return Response.json({ error: String((e as Error).message) }, { status: 500 });
        }
      },
    },
  },
});
