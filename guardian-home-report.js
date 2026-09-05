/* guardian-home-report.js — live $C7 scan on the homepage report card */
(function () {
  "use strict";
  var MINT = "979sitxCjWFPdAsrF2ybKNENwFcpiHDwaAasC5Xa5qww";
  var card = document.getElementById("c7-report");
  if (!card) return;

  function el(sel) { return card.querySelector(sel); }
  function set(sel, text) {
    var n = el(sel);
    if (n) n.textContent = text;
  }
  function val(id, text, cls) {
    var n = document.getElementById(id);
    if (!n) return;
    n.textContent = text;
    n.className = "val" + (cls ? " " + cls : "");
  }

  function fail(msg) {
    var st = el(".report-status");
    if (st) {
      st.hidden = false;
      st.textContent = msg;
    }
    var body = el(".report-body");
    if (body) body.hidden = true;
  }

  fetch("/api/token?mint=" + encodeURIComponent(MINT), { cache: "no-store" })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      var d = res.d;
      if (!res.ok || !d || d.error || d.x402Version) {
        throw new Error((d && (d.error || d.message)) || "Scan unavailable");
      }
      var st = el(".report-status");
      if (st) st.hidden = true;
      var body = el(".report-body");
      if (body) body.hidden = false;

      var name = (d.name || "C7") + (d.symbol ? " $" + d.symbol : "");
      set(".report-name", name);
      set(".report-grade", d.risk || "—");
      var score = Number(d.score);
      var max = Number(d.scoreMax) || 100;
      set(".report-score", Number.isFinite(score) ? ("Score " + score + " / " + max + " · pattern band") : "Score not measured");

      val("c7-mint-auth", d.mintAuthorityRevoked ? "Revoked" : "Active", d.mintAuthorityRevoked ? "is-good" : "is-flag");
      val("c7-freeze", d.freezeAuthorityRevoked ? "Revoked" : "Active", d.freezeAuthorityRevoked ? "is-good" : "is-flag");
      var L = d.liquidity || {};
      var locked = L.measured ? (Number(L.lockedPct) || 0) + (Number(L.burnedPct) || 0) : null;
      val("c7-lp", locked != null ? locked.toFixed(0) + "% locked" : "Not measured", locked != null && locked >= 90 ? "is-good" : "");
      val("c7-top1", d.top1Pct != null ? d.top1Pct + "%" : "Not measured");
      val("c7-top10", d.top10Pct != null ? d.top10Pct + "%" : "Not measured");

      var sig = (d.signals || []).slice(0, 3).map(function (s) { return s.text; }).join(" ");
      set(".report-signals", sig || "Patterns, not verdicts.");
    })
    .catch(function () {
      fail("Live scan is warming up. Open Scan to run it yourself.");
    });
})();
