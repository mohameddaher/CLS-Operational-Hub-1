/* CLS Operations Hub: emailed weekly and monthly report.
   Vercel runs this on a schedule (see vercel.json "crons"). It reads the records from Supabase and
   sends a summary by email with Resend. Settings come from Vercel Environment Variables:
     SUPABASE_URL, SUPABASE_SERVICE_KEY  (server only, never put in config.js)
     RESEND_API_KEY, REPORT_TO           (REPORT_FROM and APP_URL are optional)
     CRON_SECRET                         (protects this address)
   Manual test in a browser:  /api/report?type=weekly&secret=YOUR_CRON_SECRET  (add &preview=1 to see it without emailing) */
"use strict";

const COLLECTIONS = ["traffic", "circuits", "genLoad", "pfe", "ups", "alarms", "incidents", "activities", "tasks", "clearances"];
const TZ_OFFSET_H = 3; // Mogadishu is UTC+3 all year

const pad = n => String(n).padStart(2, "0");
const iso = d => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fd = s => { const d = typeof s === "string" ? parse(s) : s; return d ? d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear() : "-"; };
const esc = v => String(v == null ? "" : v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const avg = a => { a = a.filter(x => x != null); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const r1 = v => v == null ? "-" : String(Math.round(v * 10) / 10);
const u = (v, unit) => v == null ? "-" : r1(v) + " " + unit;

function localToday(now) { const t = new Date(now.getTime() + TZ_OFFSET_H * 36e5); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); }

function period(type, now) {
  const today = localToday(now);
  if (type === "monthly") {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return { from: iso(first), to: iso(last), label: MON[first.getUTCMonth()] + " " + first.getUTCFullYear(), title: "Monthly report" };
  }
  const to = addDays(today, -1), from = addDays(to, -6);
  return { from: iso(from), to: iso(to), label: fd(from) + " to " + fd(to), title: "Weekly report" };
}

function clearanceDays(r, today) {
  const e = r.expires ? parse(r.expires) : r.issued ? (() => { const d = parse(r.issued); return d ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, d.getUTCDate())) : null; })() : null;
  return e ? Math.round((e - today) / 864e5) : null;
}

function buildReport(data, type, now) {
  now = now || new Date();
  const P = period(type, now), today = localToday(now), inP = d => d && String(d).slice(0, 10) >= P.from && String(d).slice(0, 10) <= P.to;
  const sections = [];
  const table = (head, rows) => `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${head.map((h, i) => `<th style="text-align:${i ? "right" : "left"};padding:6px 8px;border-bottom:2px solid #D8DFEA;color:#5F6C86;font-size:11px;text-transform:uppercase">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td style="text-align:${i ? "right" : "left"};padding:6px 8px;border-bottom:1px solid #EEF1F6">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const tone = p => p == null ? "#5F6C86" : p >= 90 ? "#C81E1E" : p >= 80 ? "#B45309" : "#15803D";
  const pc = p => p == null ? "-" : `<b style="color:${tone(p)}">${r1(p)}%</b>`;
  const add = (title, body) => sections.push(`<h2 style="font-size:16px;margin:26px 0 8px;color:#142036">${esc(title)}</h2>${body}`);
  const note = t => `<p style="color:#5F6C86;font-size:13px;margin:4px 0">${esc(t)}</p>`;

  // Link throughput
  { const recs = data.traffic.filter(r => inP(r.date)), names = {}; data.circuits.forEach(c => names[c.id] = c.name + (c.port ? " (" + c.port + ")" : ""));
    const keys = [...new Set(recs.flatMap(r => Object.keys(r).filter(k => /^c_/.test(k))))];
    const rows = keys.map(k => { const v = recs.map(r => num(r[k])).filter(x => x != null); return v.length ? [esc(names[k.slice(2)] || k), avg(v), Math.max(...v)] : null; }).filter(Boolean).sort((a, b) => b[2] - a[2]);
    add("Link throughput", rows.length ? table(["Link", "Average", "Peak"], rows.slice(0, 14).map(r => [r[0], pc(r[1]), pc(r[2])])) + note(recs.length + " nightly reports in this period.") : note("No throughput report was recorded in this period.")); }

  // Generator load
  { const recs = data.genLoad.filter(r => inP(r.date)), rows = [];
    [1, 2, 3].forEach(i => { const d = recs.map(r => num(r["g" + i + "d"])), n = recs.map(r => num(r["g" + i + "n"])), all = d.concat(n).filter(x => x != null);
      rows.push(["Generator " + i, pc(avg(d)), pc(avg(n)), pc(all.length ? Math.max(...all) : null)]); });
    add("Generator load", recs.length ? table(["Generator", "Day avg", "Night avg", "Peak"], rows) + note(recs.length + " day" + (recs.length === 1 ? "" : "s") + " recorded. Red is 90% or more, orange 80% or more.") : note("No generator load was recorded in this period.")); }

  // PFE
  { const recs = data.pfe.filter(r => inP(r.date));
    const rows = ["Converter 1", "Converter 2"].map(c => { const x = recs.filter(r => r.converter === c); return [c, u(avg(x.map(r => num(r.voltage))), "V"), u(avg(x.map(r => num(r.current))), "mA"), String(x.length)]; });
    add("Power Feeding Equipment", recs.length ? table(["Converter", "Avg voltage", "Avg current", "Readings"], rows) : note("No PFE reading was recorded in this period.")); }

  // UPS
  { const recs = data.ups.filter(r => inP(r.date));
    const rows = ["UPS A1", "UPS B1"].map(u => { const x = recs.filter(r => r.unit === u), loads = x.flatMap(r => [1, 2, 3].map(i => num(r["ld" + i]))).filter(v => v != null);
      return [u, u(avg(x.map(r => avg([1, 2, 3].map(i => num(r["o_pv" + i]))))), "V"), loads.length ? r1(avg(loads)) + "%" : "-", loads.length ? Math.max(...loads) + "%" : "-", String(x.length)]; });
    add("Huawei UPS", recs.length ? table(["UPS", "Avg output V", "Avg load", "Max load", "Sheets"], rows) : note("No UPS sheet was recorded in this period.")); }

  // Alarms and incidents
  { const act = data.alarms.filter(a => a.state !== "Cleared"), rank = { Critical: 0, Major: 1, Minor: 2, Warning: 3 };
    add("Alarms", act.length ? note(act.length + " active alarm" + (act.length === 1 ? "" : "s") + " right now.") + table(["Alarm", "Severity"], act.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)).slice(0, 8).map(a => [esc(a.description) + (a.element ? ` <span style="color:#5F6C86">${esc(a.element)}</span>` : ""), esc(a.severity)])) : note("No active alarms."));
    const inc = data.incidents.filter(i => inP(i.start)), open = data.incidents.filter(i => i.status !== "Resolved").length;
    add("Internet incidents", (inc.length ? table(["Incident", "Type", "Status"], inc.map(i => [esc(i.title), esc(i.type), esc(i.status)])) : note("No incident started in this period.")) + note(open + " incident" + (open === 1 ? " is" : "s are") + " still open.")); }

  // Activities, tasks
  { const done = data.activities.filter(a => inP(a.completed)), pend = data.activities.filter(a => a.status !== "Completed"), over = pend.filter(a => a.due && parse(a.due) < today);
    add("Activities", note(done.length + " completed in this period, " + pend.length + " pending or in progress, " + over.length + " overdue.") + (over.length ? table(["Overdue activity", "Due"], over.slice(0, 6).map(a => [esc(a.title), fd(a.due)])) : ""));
    const open = data.tasks.filter(t => t.status !== "Done"), tover = open.filter(t => t.due && parse(t.due) < today);
    add("Tasks", note(open.length + " open task" + (open.length === 1 ? "" : "s") + ", " + tover.length + " overdue.") + (tover.length ? table(["Overdue task", "Assigned to", "Due"], tover.slice(0, 6).map(t => [esc(t.title), esc(t.assignee), fd(t.due)])) : "")); }

  // Clearances
  { const due = data.clearances.map(r => ({ r, d: clearanceDays(r, today) })).filter(x => x.d != null && x.d <= 7).sort((a, b) => a.d - b.d);
    add("Airport gate clearance", due.length ? table(["Holder", "Status"], due.map(x => [esc(x.r.holder), x.d < 0 ? `<b style="color:#C81E1E">Expired ${-x.d} days ago</b>` : `<b style="color:#B45309">${x.d} day${x.d === 1 ? "" : "s"} left</b>`])) : note("No clearance expires within 7 days.")); }

  const appUrl = process.env.APP_URL || "https://mogadishu-cls.vercel.app";
  const html = `<!doctype html><html><body style="margin:0;background:#F4F6FA;font-family:Segoe UI,Arial,sans-serif;color:#142036"><div style="max-width:680px;margin:0 auto;padding:20px"><div style="background:#0A1A33;color:#fff;border-radius:14px 14px 0 0;padding:20px 24px"><div style="font-size:12px;letter-spacing:.1em;opacity:.7">DARE1 · MOGADISHU CABLE LANDING STATION</div><div style="font-size:22px;font-weight:700;margin-top:4px">${esc(P.title)}</div><div style="opacity:.8;margin-top:2px">${esc(P.label)}</div></div><div style="background:#fff;border-radius:0 0 14px 14px;padding:4px 24px 24px">${sections.join("")}<p style="margin-top:28px"><a href="${esc(appUrl)}" style="background:#2563EB;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9px;font-weight:600">Open CLS Operations Hub</a></p></div><p style="color:#8A94A8;font-size:12px;text-align:center">Sent automatically by the CLS Operations Hub.</p></div></body></html>`;
  return { subject: "CLS Operations Hub · " + P.title + " · " + P.label, html, period: P };
}

async function loadAll() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in Vercel Environment Variables.");
  const out = {};
  for (const c of COLLECTIONS) {
    out[c] = [];
    for (let from = 0; ; from += 1000) {
      const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/records?select=id,data&collection=eq.${c}&order=id`, { headers: { apikey: key, Authorization: "Bearer " + key, Range: from + "-" + (from + 999) } });
      if (!r.ok) throw new Error("Supabase " + c + ": " + r.status + " " + (await r.text()).slice(0, 200));
      const rows = await r.json();
      rows.forEach(x => out[c].push({ id: x.id, ...x.data }));
      if (rows.length < 1000) break;
    }
  }
  return out;
}

async function sendEmail(subject, html) {
  const key = process.env.RESEND_API_KEY, to = process.env.REPORT_TO;
  if (!key || !to) throw new Error("RESEND_API_KEY and REPORT_TO must be set in Vercel Environment Variables.");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.REPORT_FROM || "CLS Operations Hub <onboarding@resend.dev>", to: to.split(",").map(s => s.trim()), subject, html }) });
  const body = await r.text();
  if (!r.ok) throw new Error("Resend " + r.status + ": " + body.slice(0, 300));
  return body;
}

async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET, q = req.query || {};
    const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || q.secret;
    if (!secret || given !== secret) { res.statusCode = 401; res.end("Not allowed. Set CRON_SECRET in Vercel and pass it as ?secret=..."); return; }
    const type = q.type === "monthly" ? "monthly" : "weekly";
    const rep = buildReport(await loadAll(), type, new Date());
    if (q.preview) { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(rep.html); return; }
    await sendEmail(rep.subject, rep.html);
    res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ sent: true, type, period: rep.period }));
  } catch (e) { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ sent: false, error: String(e.message || e) })); }
}

module.exports = handler;
module.exports.buildReport = buildReport;
