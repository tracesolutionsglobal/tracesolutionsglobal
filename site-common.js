/* =========================================================
   Shared on every page: the site footer and the WhatsApp /
   Call buttons in the header. Contact details live here once.
   Load right after <footer id="siteFooter"></footer>.
   ========================================================= */
(function () {
  const C = {
    email: "sales@tracesolutionsglobal.com",
    instagram: "https://www.instagram.com/tracesolutionsglobal/",
    facebook: "https://www.facebook.com/p/Trace-Solutions-61594900683412/",
    location: "Based in Sri Lanka, serving the UK, US, Australia and Sri Lanka",
    hours: "Replies within one working day",
    /* Show "Pricing" in the footer once starting prices are set in index.html (TS.site.pricing). */
    showPricing: true,
    /* First number is the main line used by the header buttons. */
    phones: [
      { name: "Sales line", phone: "+44 7548 692972" },
      { name: "Azzy", phone: "+94 76 831 0321" },
      { name: "Ocean", phone: "+94 77 723 4441" },
      { name: "Mandy", phone: "+94 77 780 9199" }
    ]
  };
  window.TS_CONTACT = C;

  const digits = s => String(s).replace(/\D/g, "");
  const waHref = (phone, text) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text || "Hi Trace Solutions Global, I'd like to talk about a website.")}`;
  const telHref = phone => `tel:+${digits(phone)}`;
  const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>';
  const CALL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
  const here = location.pathname.split("/").pop() || "index.html";
  const home = here === "index.html" ? "" : "index.html";

  const css = `
.tsh-acts{display:inline-flex;gap:.4rem;align-items:center}
.tsh-btn{display:inline-flex;align-items:center;gap:.4rem;height:40px;padding:0 .9rem;border-radius:999px;font:700 .88rem/1 "Plus Jakarta Sans",system-ui,sans-serif;text-decoration:none;white-space:nowrap;border:1.5px solid transparent}
.tsh-btn svg{width:18px;height:18px;flex:none}
.tsh-wa{background:#25D366;color:#06331A}
.tsh-wa:hover{background:#1fbe5b}
.tsh-call{background:transparent;color:#012228;border-color:rgba(1,34,40,.2)}
.tsh-call:hover{border-color:#012228}
@media (max-width:720px){.tsh-btn{width:40px;padding:0;justify-content:center}.tsh-btn span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}
@media (max-width:480px){.tsh-call{display:none}}
/* Phones: shrink the logo text so logo, WhatsApp and menu always fit on one row */
@media (max-width:560px){.site-header .logo .word{font-size:.8rem;letter-spacing:.07em}.site-header .container{gap:.6rem}.tsh-acts{gap:.3rem}}
@media (max-width:420px){.site-header .logo .word{font-size:.7rem;letter-spacing:.04em}.site-header .logo svg.mark{width:28px;height:21px}.site-header .logo{gap:.45rem}}
@media (max-width:359px){.tsh-wa{display:none}}
/* Desktop widths where the full menu shows: keep the header to one row */
@media (min-width:1241px) and (max-width:1440px){.tsh-btn{width:40px;padding:0;justify-content:center}.tsh-btn span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.tsh-call{display:none}}
.tsf{background:#012228;color:rgba(255,255,255,.78);padding:3.5rem 0 2rem;font:15px/1.6 "Plus Jakarta Sans",system-ui,sans-serif}
.tsf .tsf-in{max-width:1200px;margin:0 auto;padding-inline:clamp(16px,4vw,32px)}
.tsf-grid{display:grid;grid-template-columns:1.2fr 1fr 1.5fr 1.1fr;gap:2.2rem}
@media (max-width:960px){.tsf-grid{grid-template-columns:1fr 1fr}}
@media (max-width:520px){.tsf-grid{grid-template-columns:1fr}}
.tsf a{color:inherit;text-decoration:none}
.tsf a:hover{color:#fff}
.tsf ul > li > a{display:inline-block;padding:.3rem 0}
.tsf h4{color:#fff;font-size:.95rem;font-weight:700;margin:0 0 .9rem;letter-spacing:0}
.tsf ul{list-style:none;margin:0;padding:0;display:grid;gap:.25rem}
.tsf-logo{display:inline-flex;align-items:center;gap:.6rem;color:#fff;font:600 .9rem/1 Montserrat,"Plus Jakarta Sans",sans-serif;letter-spacing:.12em}
.tsf-logo svg{width:32px;height:24px}
.tsf-logo .g{color:#3DDC84}
.tsf-brand p{margin:1rem 0 0;max-width:32ch;font-size:.92rem}
.tsf-phone{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.3rem .8rem}
.tsf-phone small{display:block;font-size:.78rem;color:rgba(255,255,255,.55)}
.tsf-phone b{color:#fff;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.tsf-pa{display:inline-flex;gap:.35rem}
.tsf-pa a{display:inline-flex;align-items:center;gap:.3rem;min-height:36px;padding:.45rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700;background:rgba(255,255,255,.08)}
.tsf-pa a.wa{background:#25D366;color:#06331A}
.tsf-pa a svg{width:14px;height:14px}
.tsf-bottom{margin-top:2.6rem;padding-top:1.4rem;border-top:1px solid rgba(255,255,255,.12);display:flex;flex-wrap:wrap;justify-content:space-between;gap:.8rem 1.4rem;font-size:.85rem}
.tsf-legal{display:flex;flex-wrap:wrap;gap:.4rem 1.2rem}
.tsf-legal a{text-decoration:underline;text-underline-offset:2px}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- header: WhatsApp + Call, one tap from every page ---------- */
  const main = C.phones[0].phone;
  const acts = document.createElement("div");
  acts.className = "tsh-acts";
  acts.innerHTML = `<a class="tsh-btn tsh-wa" href="${waHref(main)}" target="_blank" rel="noopener" aria-label="WhatsApp us on ${main}">${WA_ICON}<span>WhatsApp</span></a>`
    + `<a class="tsh-btn tsh-call" href="${telHref(main)}" aria-label="Call us on ${main}">${CALL_ICON}<span>Call</span></a>`;
  const navActions = document.querySelector(".site-header .nav-actions");
  if (navActions) navActions.prepend(acts);
  else { const bar = document.querySelector(".site-header .container"); if (bar) bar.append(acts); }

  /* ---------- footer ---------- */
  const f = document.getElementById("siteFooter");
  if (!f) return;
  f.className = "tsf";
  const phone = p => `<li class="tsf-phone"><span><small>${p.name}</small><b>${p.phone}</b></span>
    <span class="tsf-pa"><a class="wa" href="${waHref(p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp ${p.name}">${WA_ICON}WhatsApp</a><a href="${telHref(p.phone)}" aria-label="Call ${p.name}">${CALL_ICON}Call</a></span></li>`;
  f.innerHTML = `<div class="tsf-in">
    <div class="tsf-grid">
      <div class="tsf-brand">
        <a class="tsf-logo" href="${home || "#top"}" aria-label="Trace Solutions Global, home"><svg viewBox="0 0 322 244" aria-hidden="true"><g fill="#fff"><path d="M4 4h314l-36 56H39z"/><path d="M68 93h59l62 123-48 24z"/><path d="M168 93h87l-45 87z" fill="#1FA75A"/></g></svg><span>TRACE SOLUTIONS <span class="g">G</span>LOBAL</span></a>
        <p>Modern websites for businesses worldwide, designed so you can see them before we build them.</p>
      </div>
      <div>
        <h4>Explore</h4>
        <ul>
          <li><a href="work.html">Our work</a></li>
          <li><a href="build.html">Concept Builder</a></li>
          <li><a href="${home}#services">Services</a></li>
          <li${C.showPricing ? "" : " hidden"}><a href="${home}#pricing" data-pricing-link>Pricing</a></li>
          <li><a href="${home}#about">About</a></li>
          <li data-reviews-link hidden><a href="${home}#reviews">Reviews</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact our team</h4>
        <ul>${C.phones.map(phone).join("")}</ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li><a href="mailto:${C.email}">${C.email}</a></li>
          <li><a href="${C.instagram}" target="_blank" rel="noopener">Instagram</a> · <a href="${C.facebook}" target="_blank" rel="noopener">Facebook</a></li>
          <li>${C.location}</li>
          <li>${C.hours}</li>
        </ul>
      </div>
    </div>
    <div class="tsf-bottom">
      <span>© ${new Date().getFullYear()} Trace Solutions Global. All rights reserved.</span>
      <span class="tsf-legal"><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of service</a></span>
    </div>
  </div>`;
})();
