/* CLS Operations Hub: Supabase adapter.
   The app was built to store data through window.claude.use("db"). This file provides the same
   interface on top of Supabase (table public.records) plus an email/password sign-in screen.
   If config.js is not filled in, the app falls back to saving on this device only. */
(function () {
  "use strict";
  var URL_ = window.CLS_SUPABASE_URL, KEY = window.CLS_SUPABASE_ANON_KEY;
  var TABLE = "records";
  var configured = !!(URL_ && KEY && !/YOUR[-_]/i.test(URL_ + KEY) && window.supabase && window.supabase.createClient);
  var sb = null;
  var listeners = {}; // collection name -> array of refresh functions

  function mapErr(e) {
    var code = e && e.code;
    if (code === "42501" || code === "PGRST301" || (e && (e.status === 401 || e.status === 403))) code = "permission_denied";
    var out = new Error((e && e.message) || "Supabase error");
    out.code = code || "error";
    return out;
  }

  async function fetchAll(name) {
    var out = [];
    for (var from = 0; ; from += 1000) {
      var r = await sb.from(TABLE).select("id,data").eq("collection", name).order("id").range(from, from + 999);
      if (r.error) throw mapErr(r.error);
      out = out.concat(r.data);
      if (r.data.length < 1000) break;
    }
    return out;
  }

  function refreshCollection(name) {
    (listeners[name] || []).forEach(function (fn) { fn(); });
  }

  function collection(name) {
    return {
      doc: function (id) {
        return {
          set: async function (body) {
            var r = await sb.from(TABLE).upsert({ collection: name, id: id, data: body }, { onConflict: "collection,id" });
            if (r.error) throw mapErr(r.error);
            refreshCollection(name);
          },
          delete: async function () {
            var r = await sb.from(TABLE).delete().eq("collection", name).eq("id", id);
            if (r.error) throw mapErr(r.error);
            refreshCollection(name);
          }
        };
      },
      onSnapshot: function (onNext, onErr) {
        var timer = null, alive = true;
        async function run() {
          try {
            var rows = await fetchAll(name);
            if (!alive) return;
            onNext({ docs: rows.map(function (r) { return { id: r.id, data: function () { return r.data; } }; }) });
          } catch (e) { if (alive && onErr) onErr(e); }
        }
        function refresh() { clearTimeout(timer); timer = setTimeout(run, 80); }
        (listeners[name] = listeners[name] || []).push(refresh);
        run();
        return function () {
          alive = false;
          listeners[name] = (listeners[name] || []).filter(function (f) { return f !== refresh; });
        };
      }
    };
  }

  function startRealtime() {
    try {
      sb.channel("records-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, function (p) {
          var n = (p.new && p.new.collection) || (p.old && p.old.collection);
          if (n) refreshCollection(n);
        })
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") Object.keys(listeners).forEach(refreshCollection);
        });
    } catch (e) { /* polling below still keeps data fresh */ }
    setInterval(function () { Object.keys(listeners).forEach(refreshCollection); }, 60000);
  }

  function mk(tag, css, text) {
    var el = document.createElement(tag);
    if (css) el.style.cssText = css;
    if (text) el.textContent = text;
    return el;
  }

  function showLogin() {
    return new Promise(function (resolve) {
      var box = mk("div", "position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:20px;background:linear-gradient(160deg,#0A1A33,#12284B);font-family:var(--body,system-ui,sans-serif)");
      var form = mk("form", "width:100%;max-width:380px;background:var(--card,#fff);color:var(--ink,#142036);border-radius:18px;padding:26px 24px;box-shadow:0 20px 60px -20px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:12px");
      form.appendChild(mk("div", "font-family:var(--display,system-ui);font-size:22px;font-weight:700", "CLS Operations Hub"));
      form.appendChild(mk("div", "color:var(--muted,#5F6C86);font-size:13.5px;margin-top:-6px", "Sign in with your team account."));
      var fieldCss = "border:1px solid var(--line,#DFE5EF);border-radius:10px;padding:11px 12px;background:var(--field,#fff);color:inherit;font:inherit;width:100%";
      var email = mk("input", fieldCss); email.type = "email"; email.placeholder = "Email"; email.autocomplete = "username"; email.required = true;
      var pass = mk("input", fieldCss); pass.type = "password"; pass.placeholder = "Password"; pass.autocomplete = "current-password"; pass.required = true;
      var msg = mk("div", "color:#C81E1E;font-size:13px;min-height:18px");
      var btn = mk("button", "border:0;border-radius:10px;padding:11px 14px;background:#2563EB;color:#fff;font:inherit;font-weight:600;cursor:pointer", "Sign in");
      btn.type = "submit";
      [email, pass, msg, btn].forEach(function (n) { form.appendChild(n); });
      box.appendChild(form);
      document.body.appendChild(box);
      email.focus();
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        btn.disabled = true; btn.textContent = "Signing in…"; msg.textContent = "";
        var r = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
        if (r.error) { msg.textContent = r.error.message; btn.disabled = false; btn.textContent = "Sign in"; return; }
        box.remove();
        resolve();
      });
    });
  }

  function addSignOut() {
    var lbl = document.getElementById("syncLbl");
    if (!lbl || !lbl.parentNode || document.getElementById("signOutBtn")) return;
    var b = mk("button", "margin-left:auto;border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit;border-radius:8px;padding:3px 9px;font:inherit;font-size:12px;cursor:pointer", "Sign out");
    b.id = "signOutBtn"; b.type = "button";
    b.addEventListener("click", async function () { await sb.auth.signOut(); location.reload(); });
    lbl.parentNode.appendChild(b);
  }

  var dbPromise = null;
  async function openDb() {
    if (!configured) {
      console.warn("CLS Operations Hub: config.js is not filled in, so data is saved on this device only.");
      return null;
    }
    sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    var s = await sb.auth.getSession();
    if (!s.data || !s.data.session) await showLogin();
    sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_OUT") location.reload(); });
    addSignOut();
    startRealtime();
    return { collection: collection };
  }

  var downloads = {
    save: function (o) {
      return new Promise(function (resolve) {
        var type = /\.csv$/i.test(o.filename) ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([o.data], { type: type }));
        a.download = o.filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
        resolve();
      });
    }
  };

  window.claude = {
    use: async function (name) {
      if (name === "downloads") return downloads;
      if (name === "db") { if (!dbPromise) dbPromise = openDb(); return dbPromise; }
      throw new Error("Unsupported capability: " + name);
    }
  };
})();
