// src/lib/onboarding-reminders.server.ts

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

/**
 * Direktang tumatawag sa official Resend API gamit ang compatibility configuration.
 * Gagamitin nito ang global token configuration para sa Vercel pipeline.
 */
export async function sendOnboardingEmail(payload: EmailPayload) {
  // Gumagamit ng runtime agnostic check upang maiwasan ang compilation boundary restriction
  const targetEnv = typeof process !== 'undefined' ? process.env : (globalThis as any).process?.env;
  const apiKey = targetEnv?.RESEND_API_KEY;

  if (!apiKey) {
    console.error("❌ Error: RESEND_API_KEY is not defined in environment variables.");
    throw new Error("Missing RESEND_API_KEY configuration");
  }

  const senderEmail = payload.from || "admin@gopalengke.net";

  try {
    const response = await fetch("https://resend.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: senderEmail,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Resend API Error Response:", data);
      return { success: false, error: data };
    }

    console.log("✅ Email sent successfully via Resend API:", data.id);
    return { success: true, data };
  } catch (error) {
    console.error("❌ Failed to call Resend API:", error);
    return { success: false, error };
  }
}
