// HCPS admin — save a dealer's rep owner + HCPS account number to dealer_directory.
// Writes with the service_role key (server-side). Requires ANALYTICS_TOKEN (fails closed when unset).
//
//   POST /.netlify/functions/assign
//   headers: x-analytics-token: <passcode>   (only if ANALYTICS_TOKEN is set)
//   body: { "dealer_name": "...", "rep_name": "...", "hcps_account": "..." }
//
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const json = (code, obj) => ({ statusCode: code, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
    /* FAILS CLOSED (Admin 360 B0, 2026-11-08): this legacy endpoint writes with the service key and used to be
       open whenever ANALYTICS_TOKEN was unset. An unset token now refuses every request; the existing passcode keeps
       working (constant-time comparison). */
    const need = process.env.ANALYTICS_TOKEN || "";
    if (!need) return json(503, { error: "assign is not configured (ANALYTICS_TOKEN unset) — refusing" });
    {
      const h = event.headers || {};
      const got = String(h["x-analytics-token"] || h["X-Analytics-Token"] || "");
      const A = Buffer.from(got), B = Buffer.from(need);
      if (A.length !== B.length || !require("crypto").timingSafeEqual(A, B)) return json(401, { error: "unauthorized" });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE) return json(500, { error: "Supabase env vars not set" });

    let body; try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad JSON" }); }
    const dealer_name = (body.dealer_name || "").trim();
    if (!dealer_name) return json(400, { error: "dealer_name required" });
    const row = {
      dealer_name,
      rep_name: (body.rep_name || "").trim() || null,
      hcps_account: (body.hcps_account || "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    // Upsert on the dealer_name primary key.
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dealer_directory`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) return json(500, { error: `Supabase ${r.status}: ${await r.text()}` });
    const saved = await r.json();
    return json(200, { ok: true, saved: Array.isArray(saved) ? saved[0] : saved });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
