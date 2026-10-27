/* Meta Tags — builds escaped <head> tags and renders previews with textContent only. No network. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;
  var FIELDS = ["title", "description", "url", "image", "imageAlt", "siteName", "twitter", "type", "card", "locale"];
  var LIMITS = { title: [30, 60, 70], description: [70, 160, 200] }; // [ok from, ok to, hard]

  // ---------- core ----------
  function chars(s) { return Array.from(String(s || "")).length; }
  function truncate(s, n) { var a = Array.from(String(s || "").trim()); return a.length > n ? a.slice(0, n - 1).join("").trimEnd() + "…" : a.join(""); }
  function absUrl(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s.replace(/^\/+/, "");
    return s;
  }
  function parseUrl(s) { try { var u = new URL(absUrl(s)); return /^https?:$/.test(u.protocol) ? u : null; } catch (e) { return null; } }
  function norm(s) { var u = parseUrl(s); return u ? u.href : absUrl(s); }
  function domain(s) { var u = parseUrl(s); return u ? u.hostname.replace(/^www\./, "") : ""; }
  function crumb(s) {
    var u = parseUrl(s); if (!u) return "";
    var parts = u.pathname.split("/").filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return [u.hostname.replace(/^www\./, "")].concat(parts).join(" › ");
  }
  function handle(s) { s = String(s || "").trim().replace(/^(https?:\/\/)?(www\.)?(twitter|x)\.com\//i, "").replace(/^@+/, "").replace(/\/.*$/, ""); return s ? "@" + s : ""; }

  function build(d) {
    var url = norm(d.url), img = norm(d.image), tw = handle(d.twitter), L = [];
    function meta(attr, key, val) { if (val) L.push("<meta " + attr + '="' + key + '" content="' + S3.esc(val) + '">'); }
    if (d.title) L.push("<title>" + S3.esc(d.title) + "</title>");
    meta("name", "description", d.description);
    if (url) L.push('<link rel="canonical" href="' + S3.esc(url) + '">');
    L.push("", "<!-- Open Graph (Facebook, LinkedIn, WhatsApp, Slack…) -->");
    meta("property", "og:type", d.type || "website");
    meta("property", "og:url", url);
    meta("property", "og:title", d.title);
    meta("property", "og:description", d.description);
    meta("property", "og:image", img);
    meta("property", "og:image:alt", img && d.imageAlt);
    meta("property", "og:site_name", d.siteName);
    meta("property", "og:locale", d.locale);
    L.push("", "<!-- X (Twitter) -->");
    meta("name", "twitter:card", d.card || "summary_large_image");
    meta("name", "twitter:site", tw);
    meta("name", "twitter:title", d.title);
    meta("name", "twitter:description", d.description);
    meta("name", "twitter:image", img);
    meta("name", "twitter:image:alt", img && d.imageAlt);
    return L.join("\n");
  }

  // returns {field: [level, message]}; level ok | warn | bad
  function lint(d) {
    var r = {};
    ["title", "description"].forEach(function (k) {
      var n = chars(d[k]), l = LIMITS[k];
      r[k] = !n ? ["bad", "required"] : n < l[0] ? ["warn", n + " · short"] : n <= l[1] ? ["ok", n + " / " + l[1]] : n <= l[2] ? ["warn", n + " · may be cut"] : ["bad", n + " · too long"];
    });
    r.url = !d.url ? ["warn", "recommended"] : parseUrl(d.url) ? ["ok", "valid"] : ["bad", "not a web URL"];
    r.image = !d.image ? ["warn", "no image: plain cards"] : parseUrl(d.image) ? ["ok", "valid"] : ["bad", "not a web URL"];
    var tw = handle(d.twitter);
    r.twitter = !tw ? ["ok", "optional"] : /^@\w{1,15}$/.test(tw) ? ["ok", tw] : ["bad", "1–15 letters, digits, _"];
    return r;
  }

  // ---------- UI ----------
  var imgUrl = null;
  function read() { var d = {}; FIELDS.forEach(function (k) { d[k] = $("#" + k).value; }); return d; }
  function write(d) { FIELDS.forEach(function (k) { var el = $("#" + k); el.value = d[k] != null ? d[k] : el.tagName === "SELECT" ? el.options[0].value : ""; }); }
  function set(id, text) { $("#" + id).textContent = text; }

  function render() {
    var d = read(), dom = domain(d.url) || "yoursite.com", title = d.title.trim() || "Your page title", desc = d.description.trim() || "Your description shows here.";
    $("#out").textContent = build(d);
    var issues = 0, lt = lint(d);
    $$(".count").forEach(function (c) {
      var v = lt[c.dataset.for]; if (!v) return;
      c.className = "count " + v[0]; c.textContent = v[1];
      if (v[0] === "bad") issues++;
    });
    var chip = $("#issues");
    chip.className = "chip " + (issues ? "bad" : "ok"); chip.textContent = issues ? issues + (issues === 1 ? " problem" : " problems") : "Ready to paste";

    set("g-name", d.siteName.trim() || dom); set("g-crumb", crumb(d.url) || dom);
    set("g-title", truncate(title, 60)); set("g-desc", truncate(desc, 160));
    set("fb-domain", dom.toUpperCase()); set("fb-title", truncate(title, 88)); set("fb-desc", truncate(desc, 110));
    set("x-over", truncate(title, 70)); set("x-domain", dom); set("x-title", truncate(title, 70)); set("x-desc", truncate(desc, 125));
    set("x-from", "From " + dom);
    var small = d.card === "summary";
    $("#x-card").classList.toggle("small", small);
    var hasImg = !!(d.image.trim() || imgUrl);
    $$("[data-img]").forEach(function (box) {
      box.classList.toggle("none", !hasImg);
      var im = box.querySelector("img");
      if (imgUrl && !im) { im = document.createElement("img"); im.alt = ""; box.insertBefore(im, box.firstChild); }
      if (im) { if (imgUrl) im.src = imgUrl; else im.remove(); }
      box.classList.toggle("placeholder", hasImg && !imgUrl);
    });
    $(".fb").classList.toggle("noimg", !hasImg);
    S3.store("meta.form", d);
  }

  var deb = S3.debounce(render, 120);
  FIELDS.forEach(function (k) { $("#" + k).addEventListener("input", deb); $("#" + k).addEventListener("change", render); });
  $("#pick-img input").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) return;
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    imgUrl = URL.createObjectURL(f); e.target.value = ""; render();
  });
  $("#copy").addEventListener("click", function () { S3.copy($("#out").textContent, "Tags copied"); S3.done(); });
  $("#save").addEventListener("click", function () { S3.download($("#out").textContent + "\n", "meta-tags.html", "text/html"); S3.done(); });
  $("#clear").addEventListener("click", function () { write({}); if (imgUrl) { URL.revokeObjectURL(imgUrl); imgUrl = null; } render(); $("#title").focus(); });
  function sample() {
    write({ title: "Meta Tags: free SEO and social preview generator", description: "Create meta, Open Graph and X card tags with live Google, Facebook and X previews. Free, private and it runs in your browser.",
      url: "https://s3eidat.github.io/meta-tags/", image: "https://s3eidat.github.io/meta-tags/screenshot.png", imageAlt: "Meta Tags tool with live previews",
      siteName: "S3eidat Tools", twitter: "@s3eidat", type: "website", card: "summary_large_image", locale: "en_US" });
    render();
  }
  $("#sample").addEventListener("click", sample);

  write(S3.store("meta.form") || {});
  render();

  // Demo image is drawn locally on a canvas, so the screenshot shows a card without any network request.
  window.S3_DEMO = function () {
    sample();
    var c = document.createElement("canvas"); c.width = 1200; c.height = 630;
    var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 1200, 630);
    gr.addColorStop(0, "#0e9f9a"); gr.addColorStop(1, "#3730a3");
    g.fillStyle = gr; g.fillRect(0, 0, 1200, 630);
    g.fillStyle = "#fff"; g.font = "bold 96px sans-serif"; g.fillText("Meta Tags", 80, 330);
    g.font = "44px sans-serif"; g.globalAlpha = .8; g.fillText("SEO + social previews", 80, 410);
    return new Promise(function (res) { c.toBlob(function (b) { imgUrl = URL.createObjectURL(b); render(); res(); }); });
  };

  window.S3_SELFTEST = function () {
    var saved = read();
    var evil = '"><img src=x onerror=alert(1)>';
    var html = build({ title: evil, description: "Tom & Jerry's", url: "s3eidat.github.io/a b", image: "", twitter: "x.com/s3eidat", type: "website", card: "summary" });
    var safeOut = html.indexOf("<img") < 0 && html.indexOf('<meta property="og:title" content="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">') >= 0 &&
      html.indexOf("<title>&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</title>") >= 0 &&
      html.indexOf('content="Tom &amp; Jerry&#39;s"') >= 0 && html.indexOf('<meta name="twitter:site" content="@s3eidat">') >= 0 &&
      html.indexOf("og:image") < 0;
    // previews must show the raw text and never create elements from it
    write({ title: evil, description: "<b>bold</b>", url: "https://www.s3eidat.github.io/tools/meta-tags/" });
    render();
    var pv = $("#g-title").textContent === truncate(evil, 60) && $("#g-desc").textContent === "<b>bold</b>" &&
      !document.querySelector(".pv img[src='x']") && !document.querySelector(".pv b b") && $("#fb-domain").textContent === "S3EIDAT.GITHUB.IO" &&
      $("#g-crumb").textContent === "s3eidat.github.io › tools › meta-tags";
    write(saved); render();
    var l = lint({ title: "x".repeat(61), description: "", url: "nota url", image: "", twitter: "@this_is_way_too_long_handle" });
    return safeOut && pv && truncate("abcdef", 4) === "abc…" && truncate("abc", 4) === "abc" && chars("☕☕") === 2 &&
      handle("s3eidat") === "@s3eidat" && handle("x.com/s3eidat/status/1") === "@s3eidat" &&
      absUrl("s3eidat.github.io") === "https://s3eidat.github.io" && domain("https://www.s3eidat.github.io/x") === "s3eidat.github.io" &&
      html.indexOf('<link rel="canonical" href="https://s3eidat.github.io/a%20b">') >= 0 &&
      l.title[0] === "warn" && l.description[0] === "bad" && l.twitter[0] === "bad" && lint({ title: "x".repeat(45), description: "y".repeat(150), url: "", image: "", twitter: "" }).title[0] === "ok";
  };
})();
