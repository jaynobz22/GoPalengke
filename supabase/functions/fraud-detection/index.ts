import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Patterns for off-platform poaching detection
const POACHING_PATTERNS = [
  /\bviber\b/i,
  /\bwhatsapp\b/i,
  /\bfb\s*messenger\b/i,
  /\bmessenger\b/i,
  /\btext\s*mo\s*ako\b/i,
  /\btext\s*me\b/i,
  /\bcall\s*me\s*at\b/i,
  /\bpm\s*me\b/i,
  /\bmessage\s*me\s*sa\b/i,
  /\badd\s*me\s*sa\b/i,
  /\b09\d{9}\b/,
  /\b\+63\s*9\d{9}\b/,
  /\bhttps?:\/\/(?!gopalengke\.net)\S+/i,
];

interface ScanChatRequest {
  action: "scan_chat";
  senderId: string;
  messageBody: string;
  conversationId: string;
  messageId: string;
}

interface CheckDeviceRequest {
  action: "check_device";
  deviceId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
}

interface CheckPriceRequest {
  action: "check_price";
  productId?: string;
  categoryId: string;
  price: number;
  sellerId: string;
  productName: string;
}

interface CheckOrderFloodRequest {
  action: "check_order_flood";
  buyerId: string;
  storeId: string;
}

interface CheckIpMismatchRequest {
  action: "check_ip_mismatch";
  deliveryCity: string;
  deliveryRegion: string;
}

interface AdminActionRequest {
  action: "admin_action";
  flagId: string;
  adminId: string;
  adminAction: "dismiss" | "lift" | "ban";
  deviceId?: string;
  notes?: string;
}

type RequestBody =
  | ScanChatRequest
  | CheckDeviceRequest
  | CheckPriceRequest
  | CheckOrderFloodRequest
  | CheckIpMismatchRequest
  | AdminActionRequest;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    switch (body.action) {
      case "scan_chat":
        return await handleScanChat(body as ScanChatRequest);
      case "check_device":
        return await handleCheckDevice(body as CheckDeviceRequest);
      case "check_price":
        return await handleCheckPrice(body as CheckPriceRequest);
      case "check_order_flood":
        return await handleCheckOrderFlood(body as CheckOrderFloodRequest);
      case "check_ip_mismatch":
        return await handleCheckIpMismatch(body as CheckIpMismatchRequest);
      case "admin_action":
        return await handleAdminAction(body as AdminActionRequest);
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ============================================================
// 1. CHAT SCANNER — Off-platform poaching detection
// ============================================================
async function handleScanChat(req: ScanChatRequest) {
  const { senderId, messageBody, messageId } = req;

  const matchedPatterns: string[] = [];
  for (const pattern of POACHING_PATTERNS) {
    if (pattern.test(messageBody)) {
      matchedPatterns.push(pattern.source);
    }
  }

  if (matchedPatterns.length === 0) {
    return new Response(
      JSON.stringify({ flagged: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Suspend the sender
  await supabase.rpc("suspend_user_account", { p_user_id: senderId });

  // Censor the message for the recipient
  await supabase
    .from("messages")
    .update({ body: "[REDACTED FOR SECURITY: Account Suspended]" })
    .eq("id", messageId);

  // Log as HIGH severity flag
  const { data: flagData } = await supabase
    .from("security_flags")
    .insert({
      user_id: senderId,
      trigger_type: "OFF_PLATFORM_POACHING",
      severity: "HIGH",
      actions_taken: ["ACCOUNT_SUSPENDED", "MESSAGE_REDACTED"],
      details: {
        message_body: messageBody,
        matched_patterns: matchedPatterns,
        conversation_id: req.conversationId,
        message_id: messageId,
      },
      status: "PENDING_REVIEW",
    })
    .select("id")
    .single();

  // Force-logout: revoke all sessions for this user via admin API
  try {
    const adminUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users/${senderId}/sessions`;
    await fetch(adminUrl, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      },
    });
  } catch {
    // Best-effort logout
  }

  return new Response(
    JSON.stringify({
      flagged: true,
      flagId: flagData?.id,
      action: "ACCOUNT_SUSPENDED",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ============================================================
// 2. DEVICE FINGERPRINT — Bulk account creation detection
// ============================================================
async function handleCheckDevice(req: CheckDeviceRequest) {
  const { deviceId, userId, ipAddress, userAgent } = req;

  // Check if device is already banned
  const { data: banned } = await supabase
    .from("banned_devices")
    .select("id")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (banned) {
    return new Response(
      JSON.stringify({ banned: true, message: "This device is blacklisted." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Upsert device record
  await supabase
    .from("user_devices")
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        ip_address: ipAddress,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "device_id,user_id" },
    );

  // Check how many distinct users share this device in last 10 minutes
  const { data: floodData } = await supabase.rpc("check_device_flood", {
    p_device_id: deviceId,
  });
  const distinctUsers = (floodData as number) || 0;

  if (distinctUsers > 3) {
    // Ban all associated accounts
    const { data: deviceUsers } = await supabase
      .from("user_devices")
      .select("user_id")
      .eq("device_id", deviceId)
      .gte("last_seen_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (deviceUsers) {
      const userIds = [...new Set(deviceUsers.map((d: { user_id: string }) => d.user_id))];
      for (const uid of userIds) {
        await supabase
          .from("profiles")
          .update({ account_status: "BANNED", is_active: false, updated_at: new Date().toISOString() })
          .eq("id", uid);

        await supabase.from("security_flags").insert({
          user_id: uid,
          trigger_type: "BULK_ACCOUNT_CREATION",
          severity: "HIGH",
          actions_taken: ["ACCOUNT_BANNED"],
          details: {
            device_id: deviceId,
            distinct_users: distinctUsers,
            user_ids: userIds,
          },
          status: "BANNED",
        });
      }

      // Blacklist the device
      await supabase.from("banned_devices").insert({
        device_id: deviceId,
        reason: `POTENTIAL_BOTNET_FARM: ${distinctUsers} accounts in 10 min`,
      });

      return new Response(
        JSON.stringify({
          flagged: true,
          action: "ACCOUNT_BANNED",
          distinctUsers,
          message: "Potential botnet farm detected. All accounts banned.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  return new Response(
    JSON.stringify({ flagged: false, distinctUsers }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ============================================================
// 3. PRICE ANOMALY — Too-good-to-be-true listing detection
// ============================================================
async function handleCheckPrice(req: CheckPriceRequest) {
  const { categoryId, price, sellerId, productName } = req;

  const { data: avgData } = await supabase.rpc("get_category_avg_price", {
    p_category_id: categoryId,
  });
  const avgPrice = parseFloat((avgData as string) || "0");

  if (avgPrice > 0 && price < avgPrice * 0.4) {
    // Price is 60% below average — flag it
    await supabase.rpc("apply_account_restriction", { p_user_id: sellerId });

    const { data: flagData } = await supabase
      .from("security_flags")
      .insert({
        user_id: sellerId,
        trigger_type: "PRICE_ANOMALY",
        severity: "MEDIUM",
        actions_taken: ["ACCOUNT_RESTRICTED_48H", "LISTING_PENDING_MODERATION"],
        details: {
          product_name: productName,
          listing_price: price,
          category_avg_price: avgPrice,
          price_drop_percent: Math.round((1 - price / avgPrice) * 100),
        },
        status: "PENDING_REVIEW",
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({
        flagged: true,
        action: "PENDING_MODERATION",
        avgPrice,
        listingPrice: price,
        priceDropPercent: Math.round((1 - price / avgPrice) * 100),
        flagId: flagData?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ flagged: false, avgPrice }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ============================================================
// 4. ORDER FLOODING — Multi-store checkout rate limiter
// ============================================================
async function handleCheckOrderFlood(req: CheckOrderFloodRequest) {
  const { buyerId, storeId } = req;

  const { data: storeCount } = await supabase.rpc("check_order_flood", {
    p_buyer_id: buyerId,
  });
  const distinctStores = (storeCount as number) || 0;

  // Check if this store is already in the recent orders
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("store_id")
    .eq("buyer_id", buyerId)
    .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString());

  const recentStoreIds = new Set((recentOrders || []).map((o: { store_id: string }) => o.store_id));

  // If already 4 distinct stores and this is a new one
  if (distinctStores >= 4 && !recentStoreIds.has(storeId)) {
    await supabase.rpc("suspend_user_account", { p_user_id: buyerId });

    await supabase.from("security_flags").insert({
      user_id: buyerId,
      trigger_type: "ORDER_FLOODING",
      severity: "HIGH",
      actions_taken: ["ACCOUNT_SUSPENDED", "ORDER_BLOCKED"],
      details: {
        distinct_stores: distinctStores,
        attempted_store_id: storeId,
      },
      status: "PENDING_REVIEW",
    });

    return new Response(
      JSON.stringify({
        flagged: true,
        action: "ACCOUNT_SUSPENDED",
        distinctStores,
        message: "Order flooding detected. Account suspended.",
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ flagged: false, distinctStores }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ============================================================
// 5. IP / DELIVERY MISMATCH — GeoIP check
// ============================================================
async function handleCheckIpMismatch(req: CheckIpMismatchRequest) {
  const { deliveryCity, deliveryRegion } = req;

  // Get caller IP from request headers
  const forwarded = req as unknown as { headers?: Record<string, string> };
  const callerIp =
    (forwarded.headers?.["x-forwarded-for"]?.split(",")[0] || "").trim() ||
    (forwarded.headers?.["x-real-ip"] || "").trim();

  if (!callerIp) {
    return new Response(
      JSON.stringify({ mismatch: false, message: "No IP to check" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Use a free GeoIP lookup
  let geoData: { country?: string; region?: string; city?: string } = {};
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${callerIp}?fields=country,regionName,city`);
    if (geoRes.ok) {
      geoData = await geoRes.json();
    }
  } catch {
    // GeoIP service unavailable — don't block
  }

  const isPhilippines = (geoData.country || "").toLowerCase() === "philippines";

  if (!isPhilippines && geoData.country) {
    // Overseas IP — log as MEDIUM severity
    await supabase.from("security_flags").insert({
      trigger_type: "IP_DELIVERY_MISMATCH",
      severity: "MEDIUM",
      actions_taken: ["VERIFICATION_REQUIRED"],
      details: {
        ip: callerIp,
        ip_country: geoData.country,
        ip_region: geoData.region,
        ip_city: geoData.city,
        delivery_city: deliveryCity,
        delivery_region: deliveryRegion,
      },
      status: "PENDING_REVIEW",
    });

    return new Response(
      JSON.stringify({
        mismatch: true,
        ipCountry: geoData.country,
        ipCity: geoData.city,
        deliveryCity,
        message: "IP location does not match delivery address. Verification required.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ mismatch: false, ipCountry: geoData.country || "unknown" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ============================================================
// 6. ADMIN ACTIONS — Dismiss, Lift, Ban
// ============================================================
async function handleAdminAction(req: AdminActionRequest) {
  const { flagId, adminId, adminAction, deviceId, notes } = req;

  // Verify admin
  const { data: admin } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminId)
    .maybeSingle();

  if (!admin || admin.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: flag } = await supabase
    .from("security_flags")
    .select("*")
    .eq("id", flagId)
    .maybeSingle();

  if (!flag) {
    return new Response(
      JSON.stringify({ error: "Flag not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (adminAction === "dismiss") {
    await supabase
      .from("security_flags")
      .update({
        status: "RESOLVED",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", flagId);

    await supabase.from("security_audit_log").insert({
      flag_id: flagId,
      admin_id: adminId,
      action: "DISMISS",
      notes: notes || null,
    });
  } else if (adminAction === "lift") {
    if (flag.user_id) {
      await supabase.rpc("lift_suspension", {
        p_user_id: flag.user_id,
        p_admin_id: adminId,
      });
    }

    await supabase.from("security_audit_log").insert({
      flag_id: flagId,
      admin_id: adminId,
      action: "LIFT_SUSPENSION",
      notes: notes || null,
    });
  } else if (adminAction === "ban") {
    if (flag.user_id && deviceId) {
      await supabase.rpc("ban_user_and_device", {
        p_user_id: flag.user_id,
        p_device_id: deviceId,
        p_admin_id: adminId,
        p_reason: notes || "Banned by admin",
      });
    } else if (flag.user_id) {
      await supabase
        .from("profiles")
        .update({ account_status: "BANNED", is_active: false, updated_at: new Date().toISOString() })
        .eq("id", flag.user_id);

      await supabase
        .from("security_flags")
        .update({
          status: "BANNED",
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", flagId);
    }

    await supabase.from("security_audit_log").insert({
      flag_id: flagId,
      admin_id: adminId,
      action: "BAN_USER_DEVICE",
      notes: notes || null,
    });
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
