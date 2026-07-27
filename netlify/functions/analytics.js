// HCPS admin analytics — reads monthly_sales from Supabase (service_role, server-side)
// and returns per-period aggregates for the admin dashboard. No npm deps (native fetch).
//
// Netlify env vars required:
//   SUPABASE_URL             e.g. https://ycqmztthwldytkzyvmiv.supabase.co
//   SUPABASE_SERVICE_ROLE    the secret service_role key (NOT the publishable key)
//   ANALYTICS_TOKEN          (optional) shared passcode; if set, the page must send it
//
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const json = (code, obj) => ({
  statusCode: code,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(obj),
});

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

const MONTH = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const label = (p) => { const [y,m] = p.split("-"); return `${MONTH[parseInt(m,10)-1]} ${y}`; };

function aggregate(rows, mfrNames) {
  const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const lineM = new Map(), repM = new Map(), dealM = new Map();
  let sales = 0, comm = 0;
  const reps = new Set(), lines = new Set();
  for (const r of rows) {
    const s = Number(r.amount) || 0, c = Number(r.commission) || 0;
    sales += s; comm += c;
    const ln = mfrNames[r.manufacturer] || r.manufacturer;
    lines.add(ln); if (r.rep_name) reps.add(r.rep_name);
    const L = lineM.get(ln) || [0,0,0]; L[0]+=s; L[1]+=c; L[2]+=1; lineM.set(ln,L);
    const rp = r.rep_name || "Unassigned";
    const R = repM.get(rp) || [0,0]; R[0]+=s; R[1]+=c; repM.set(rp,R);
    const dn = r.customer_name || "(unknown)";
    const D = dealM.get(dn) || [0,0,new Set()]; D[0]+=s; D[1]+=c; D[2].add(ln); dealM.set(dn,D);
  }
  const byLine = [...lineM].map(([line,v])=>({line,sales:money(v[0]),comm:money(v[1]),recs:v[2]})).sort((a,b)=>b.sales-a.sales);
  const byRep  = [...repM].map(([rep,v])=>({rep,sales:money(v[0]),comm:money(v[1])})).sort((a,b)=>b.comm-a.comm);
  const topDealers = [...dealM].map(([dealer,v])=>({dealer,sales:money(v[0]),comm:money(v[1]),lines:v[2].size})).sort((a,b)=>b.sales-a.sales).slice(0,20);
  return { totals:{ sales:money(sales), comm:money(comm), dealers:dealM.size, lines:lines.size, reps:reps.size }, byLine, byRep, topDealers };
}

exports.handler = async (event) => {
  try {
    const need = process.env.ANALYTICS_TOKEN;
    if (need) {
      const got = event.headers["x-analytics-token"] || (event.queryStringParameters||{}).token || "";
      if (got !== need) return json(401, { error: "unauthorized" });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE) return json(500, { error: "Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE)" });

    const mfrs = await sbGet("manufacturers?select=slug,name");
    const mfrNames = Object.fromEntries(mfrs.map(m => [m.slug, m.name]));
    const rows = await sbGet("monthly_sales?select=manufacturer,period,customer_name,rep_name,amount,commission&limit=100000");

    const byPeriod = new Map();
    for (const r of rows) {
      const p = (r.period || "").slice(0,10);
      if (!byPeriod.has(p)) byPeriod.set(p, []);
      byPeriod.get(p).push(r);
    }
    const periods = [...byPeriod.keys()].filter(Boolean).sort();
    const data = { all: aggregate(rows, mfrNames) };
    const periodList = [{ key: "all", label: "All periods" }];
    for (const p of periods) { data[p] = aggregate(byPeriod.get(p), mfrNames); periodList.push({ key: p, label: label(p) }); }

    return json(200, { generatedAt: new Date().toISOString(), periods: periodList, data });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
