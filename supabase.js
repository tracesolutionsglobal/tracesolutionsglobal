/* =========================================================
   Database connection shared by the website and admin.html.
   Paste the Project URL and the anon public key from
   Supabase → Project Settings → API. The anon key is safe to
   publish: supabase-setup.sql limits what it can do.
   ========================================================= */
window.TSDB = (function () {
  const URL = "https://vjjmsvwbekkrszeornun.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqam1zdndiZWtrcnN6ZW9ybnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTk2NjgsImV4cCI6MjEwNzQ5NTY2OH0.RYCEZQYwyMSaBtBHc5bGzbpO6lZmRvFL3CFWBgB0mEQ";

  const SESSION = "ts-admin-session";
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION) || "null"); } catch (e) {}

  const ready = () => !!(URL && KEY);

  /** fetch() that always settles: aborts and rejects after `ms` instead of hanging forever on a dropped connection. Shared with the page scripts as window.fetchWithTimeout. */
  async function fetchT(url, opts, ms = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } catch (e) {
      if (e.name === "AbortError") throw new Error("The connection timed out. Please check your internet and try again.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function keep(s) {
    session = s ? {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: Date.now() + (s.expires_in || 3600) * 1000,
      email: (s.user && s.user.email) || (session && session.email) || ""
    } : null;
    try { session ? localStorage.setItem(SESSION, JSON.stringify(session)) : localStorage.removeItem(SESSION); } catch (e) {}
  }

  async function auth(path, body) {
    const res = await fetchT(`${URL}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "Sign-in failed");
    return data;
  }

  async function token() {
    if (!session) return KEY;
    if (Date.now() > session.expires_at - 60000) {
      try { keep(await auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token })); }
      catch (e) { keep(null); return KEY; }
    }
    return session.access_token;
  }

  /** PostgREST call, e.g. rest("reviews?select=*", { method: "POST", body: {...} }). */
  async function rest(path, { method = "GET", body, prefer } = {}) {
    if (!ready()) throw new Error("The database isn't connected yet.");
    const headers = { apikey: KEY, Authorization: `Bearer ${await token()}`, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    const res = await fetchT(`${URL}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) {}
    if (!res.ok) {
      const err = new Error((data && (data.message || data.hint)) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    ready,
    rest,
    session: () => session,
    async signIn(email, password) { keep(await auth("token?grant_type=password", { email, password })); return session; },
    signOut() { keep(null); }
  };
})();

/** Shared with every page: fetch() that times out instead of hanging forever on a dropped connection. */
if (!window.fetchWithTimeout) {
  window.fetchWithTimeout = async function (url, opts, ms = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } catch (e) {
      if (e.name === "AbortError") throw new Error("The connection timed out. Please check your internet and try again.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
}
