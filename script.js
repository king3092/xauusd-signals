/* ═══════════════════════════════════════════════════
   MEETHA PIPE v3 — script.js
   TradingView Live Chart + Real XAUUSD Price Region
   Full Signal Engine — EMA / RSI / Bollinger Bands
   ═══════════════════════════════════════════════════ */
"use strict";

/* ── CONFIG ── */
var CFG = {
  emaFast : 10, emaSlow : 21,
  bbPer   : 20, bbStd   : 2,
  rsiPer  : 14, rsiOB   : 70, rsiOS: 30,
  dead1   : 45, dead2   : 55,
  bbNear  : 0.30,
  N       : 240,
  tick    : 60000,
  /* Real XAUUSD price region — March 2026 */
  basePrice : 4700
};

var TF   = "15m";
var SIG  = { "15m": "WAIT", "5m": "WAIT" };
var LOGN = 0;
var tvWidget = null;

/* ══════════════════════════════════════════
   CLOCK
══════════════════════════════════════════ */
setInterval(function () {
  var d = new Date();
  var p = function (v) { return ("0" + v).slice(-2); };
  document.getElementById("clk").textContent =
    p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + " UTC";
}, 1000);

/* ══════════════════════════════════════════
   TRADINGVIEW LIVE CHART
══════════════════════════════════════════ */
function initTradingView(interval) {
  var container = document.getElementById("tv_chart_container");
  container.innerHTML = "";

  if (typeof TradingView === "undefined") {
    /* Fallback: show iframe embed if TradingView lib not loaded */
    container.innerHTML =
      '<iframe src="https://s.tradingview.com/widgetembed/?frameElementId=tv_embed&symbol=OANDA%3AXAUUSD&interval=' +
      (interval === "15m" ? "15" : "5") +
      '&hidesidetoolbar=1&hidetoptoolbar=0&symboledit=1&saveimage=1&toolbarbg=0c0f18&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&studies=EMA%4014%7C%7CEMA%4021%7C%7CBB%40%7C%7CRSI%40" style="width:100%;height:100%;border:none;background:#07090e;"></iframe>';
    return;
  }

  try {
    tvWidget = new TradingView.widget({
      container_id    : "tv_chart_container",
      symbol          : "OANDA:XAUUSD",
      interval        : interval === "15m" ? "15" : "5",
      timezone        : "Etc/UTC",
      theme           : "dark",
      style           : "1",
      locale          : "en",
      toolbar_bg      : "#0c0f18",
      enable_publishing: false,
      hide_top_toolbar : false,
      hide_legend      : false,
      allow_symbol_change: false,
      save_image       : false,
      autosize         : true,
      studies: [
        { id: "MAExp@tv-basicstudies", inputs: { length: 10 }, override: { "Plot.color": "#05d68c", "Plot.linewidth": 2 } },
        { id: "MAExp@tv-basicstudies", inputs: { length: 21 }, override: { "Plot.color": "#f0273e", "Plot.linewidth": 2 } },
        { id: "BB@tv-basicstudies",    inputs: { length: 20, mult: 2 } },
        { id: "RSI@tv-basicstudies",   inputs: { length: 14 } }
      ],
      overrides: {
        "paneProperties.background": "#07090e",
        "paneProperties.backgroundType": "solid",
        "scalesProperties.textColor": "#3a4f6a",
        "mainSeriesProperties.candleStyle.upColor"      : "#05d68c",
        "mainSeriesProperties.candleStyle.downColor"    : "#f0273e",
        "mainSeriesProperties.candleStyle.borderUpColor": "#05d68c",
        "mainSeriesProperties.candleStyle.borderDownColor": "#f0273e",
        "mainSeriesProperties.candleStyle.wickUpColor"  : "#05d68c",
        "mainSeriesProperties.candleStyle.wickDownColor": "#f0273e"
      }
    });
  } catch (e) {
    console.warn("TradingView widget error:", e);
    container.innerHTML =
      '<iframe src="https://s.tradingview.com/widgetembed/?frameElementId=tv_embed&symbol=OANDA%3AXAUUSD&interval=' +
      (interval === "15m" ? "15" : "5") +
      '&theme=dark&style=1&timezone=Etc%2FUTC" style="width:100%;height:100%;border:none;background:#07090e;"></iframe>';
  }
}

/* ══════════════════════════════════════════
   MATH — EMA / BB / RSI
══════════════════════════════════════════ */
function calcEMA(arr, n) {
  if (arr.length < n) return arr.map(function () { return null; });
  var k = 2 / (n + 1), e = 0, r = [], i;
  for (i = 0; i < n; i++) e += arr[i]; e /= n;
  for (i = 0; i < n - 1; i++) r.push(null);
  r.push(e);
  for (i = n; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); r.push(e); }
  return r;
}
function calcSMA(arr, n) {
  return arr.map(function (_, i) {
    if (i < n - 1) return null;
    var s = 0; for (var j = i - n + 1; j <= i; j++) s += arr[j]; return s / n;
  });
}
function calcBB(arr, n, s) {
  var mid = calcSMA(arr, n), up = [], lo = [], i, j, sl, m, sd;
  for (i = 0; i < arr.length; i++) {
    if (i < n - 1) { up.push(null); lo.push(null); continue; }
    sl = arr.slice(i - n + 1, i + 1); m = mid[i]; sd = 0;
    for (j = 0; j < sl.length; j++) sd += (sl[j] - m) * (sl[j] - m);
    sd = Math.sqrt(sd / n); up.push(m + s * sd); lo.push(m - s * sd);
  }
  return { u: up, m: mid, l: lo };
}
function calcRSI(arr, n) {
  if (arr.length <= n) return arr.map(function () { return null; });
  var g = [], l = [], i, d, ag = 0, al = 0, r = [];
  for (i = 0; i < arr.length; i++) {
    d = i ? arr[i] - arr[i - 1] : 0;
    g.push(d > 0 ? d : 0); l.push(d < 0 ? -d : 0);
  }
  for (i = 1; i <= n; i++) { ag += g[i]; al += l[i]; } ag /= n; al /= n;
  for (i = 0; i < n; i++) r.push(null);
  r.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  for (i = n + 1; i < arr.length; i++) {
    ag = (ag * (n - 1) + g[i]) / n; al = (al * (n - 1) + l[i]) / n;
    r.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return r;
}

/* ══════════════════════════════════════════
   CANDLE GENERATOR
   Real XAUUSD price region (~$4,600-4,900)
══════════════════════════════════════════ */
function genCandles(tf, N) {
  var step  = (tf === "15m" ? 15 : 5) * 60;
  var now   = Math.floor(Date.now() / 1000);
  var epoch = Math.floor(now / step);
  var seed  = (epoch * 0x1F3A7 + (tf === "15m" ? 0xAB01 : 0xCD02)) >>> 0;

  function rng() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967295;
  }

  /* Start near real XAUUSD price ~$4,700 */
  var price = CFG.basePrice + (rng() - 0.5) * 200;
  var candles = [], i;

  for (i = N - 1; i >= 0; i--) {
    var t  = (epoch - i) * step;
    var v  = 3.5 + rng() * 8.0;   /* XAUUSD has bigger moves */
    var dr = (rng() - 0.487) * 0.9;
    var o  = price;
    var b  = (rng() - 0.5 + dr) * v * 2.5;
    var cl = o + b;
    var hi = Math.max(o, cl) + rng() * v * 0.9;
    var lo = Math.min(o, cl) - rng() * v * 0.9;
    candles.push({ t: t, o: o, h: hi, l: lo, c: cl });
    price = cl;
  }
  return candles;
}

/* ══════════════════════════════════════════
   SIGNAL ENGINE
══════════════════════════════════════════ */
function compute(candles) {
  var cls = candles.map(function (c) { return c.c; });
  var his = candles.map(function (c) { return c.h; });
  var los = candles.map(function (c) { return c.l; });
  var N   = cls.length;

  var e10  = calcEMA(cls, CFG.emaFast);
  var e21  = calcEMA(cls, CFG.emaSlow);
  var bb   = calcBB(cls, CFG.bbPer, CFG.bbStd);
  var rsi  = calcRSI(cls, CFG.rsiPer);

  var pr   = cls[N - 1], E10 = e10[N - 1], E21 = e21[N - 1];
  var bbU  = bb.u[N - 1], bbM = bb.m[N - 1], bbL = bb.l[N - 1];
  var RSIv = rsi[N - 1];

  if (!E10 || !E21 || !bbU || RSIv == null) return null;

  var rHi = his[N - 1], rLo = los[N - 1], i;
  for (i = Math.max(0, N - 7); i < N; i++) { rHi = Math.max(rHi, his[i]); rLo = Math.min(rLo, los[i]); }

  var bnd = bbU - bbL, half = bnd / 2;
  var bbPct = bnd > 0 ? ((pr - bbL) / bnd) * 100 : 50;
  var nU  = bnd > 0 && pr >= bbU - half * CFG.bbNear;
  var nL  = bnd > 0 && pr <= bbL + half * CFG.bbNear;
  var dead  = RSIv >= CFG.dead1 && RSIv <= CFG.dead2;
  var emaUp = E10 > E21, emaDn = E10 < E21;

  var bC = [
    { l: "EMA 10 > EMA 21",     p: emaUp,                       n: emaUp  ? "UPTREND"   : "NO UPTREND"   },
    { l: "RSI < 50 & < 30",     p: RSIv < 50 && RSIv < CFG.rsiOS, n: dead ? "DEAD ZONE" : "RSI " + RSIv.toFixed(1) },
    { l: "Price near Lower BB", p: nL,                           n: bbPct.toFixed(0) + "% in band"        },
  ];
  var sC = [
    { l: "EMA 10 < EMA 21",     p: emaDn,                       n: emaDn  ? "DOWNTREND" : "NO DOWNTREND" },
    { l: "RSI > 50 & > 70",     p: RSIv > 50 && RSIv > CFG.rsiOB, n: dead ? "DEAD ZONE" : "RSI " + RSIv.toFixed(1) },
    { l: "Price near Upper BB", p: nU,                           n: bbPct.toFixed(0) + "% in band"        },
  ];

  var bS = 0, sS = 0;
  bC.forEach(function (c) { if (c.p) bS++; });
  sC.forEach(function (c) { if (c.p) sS++; });

  var dir = "WAIT", score = 0, chks = bC;
  if (dead) {
    dir = "WAIT"; score = 0;
    chks = [
      { l: "EMA Trend",   p: false, n: "RSI DEAD ZONE" },
      { l: "RSI Level",   p: false, n: "RSI " + RSIv.toFixed(1) + " (45-55)" },
      { l: "BB Position", p: false, n: "SIDEWAYS MARKET" },
    ];
  } else if (bS >= 2 && bS >= sS) { dir = "BUY";  score = bS; chks = bC; }
  else if (sS >= 2 && sS > bS)    { dir = "SELL"; score = sS; chks = sC; }
  else if (bS === 1) { dir = "WAIT"; score = 1; chks = bC; }
  else if (sS === 1) { dir = "WAIT"; score = 1; chks = sC; }
  else {
    dir = "WAIT"; score = 0;
    chks = [
      { l: "EMA Trend",   p: false, n: "NO SIGNAL"        },
      { l: "RSI Level",   p: false, n: "RSI " + RSIv.toFixed(1) },
      { l: "BB Position", p: false, n: "NEUTRAL"           },
    ];
  }

  var str = score === 3 ? "STRONG" : score === 2 ? "WEAK" : "NO TRADE";
  var en = pr, sl, tp;
  if (dir === "BUY")  { sl = rLo - 1.5; tp = en + (en - sl) * 2; }
  else if (dir === "SELL") { sl = rHi + 1.5; tp = en - (sl - en) * 2; }
  else { sl = pr; tp = pr; }

  return {
    dir: dir, score: score, str: str, chks: chks,
    pr: pr, E10: E10, E21: E21, bbU: bbU, bbM: bbM, bbL: bbL, bbPct: bbPct,
    RSIv: RSIv, dead: dead, emaUp: emaUp, nU: nU, nL: nL,
    en: en, sl: sl, tp: tp
  };
}

/* ══════════════════════════════════════════
   UI UPDATE
══════════════════════════════════════════ */
function f2(v) { return v == null ? "--" : v.toFixed(2); }
function f1(v) { return v == null ? "--" : v.toFixed(1); }
function sc(el, add) {
  el.className = el.className.replace(/\b(buy|sell|wait|bull|bear|neut|pass|fail)\b/g, "").trim();
  if (add) el.classList.add(add);
}

function updateUI(res, tf) {
  /* Signal box */
  var box = document.getElementById("sigbox");
  sc(box, res.dir.toLowerCase());
  document.getElementById("sigico").textContent = res.dir === "BUY" ? "🟢" : res.dir === "SELL" ? "🔴" : "⚠️";
  var ww = document.getElementById("sigwrd");
  ww.textContent = res.dir === "BUY" ? "STRONG BUY" : res.dir === "SELL" ? "STRONG SELL" : res.score === 1 ? "WEAK — WAIT" : "WAIT";
  var ss = document.getElementById("sigstr");
  ss.className = "sigstr";
  if (res.str === "STRONG")    { ss.textContent = "STRONG — 3/3 CONDITIONS MET"; ss.classList.add("sS"); }
  else if (res.str === "WEAK") { ss.textContent = "WEAK — 2/3 CONDITIONS MET";   ss.classList.add("sW"); }
  else                          { ss.textContent = "NO TRADE — LESS THAN 2/3";    ss.classList.add("sN"); }

  /* Trade levels */
  document.getElementById("tdE").textContent = f2(res.en);
  document.getElementById("tdS").textContent = f2(res.sl);
  document.getElementById("tdT").textContent = f2(res.tp);
  var sd = Math.abs(res.en - res.sl), td = Math.abs(res.tp - res.en);
  document.getElementById("slDst").textContent = sd > 0 ? "$" + sd.toFixed(1) : "--";
  document.getElementById("tpDst").textContent = td > 0 ? "$" + td.toFixed(1) : "--";

  /* BB strip */
  document.getElementById("vBBu").textContent = f2(res.bbU);
  document.getElementById("vBBm").textContent = f2(res.bbM);
  document.getElementById("vBBl").textContent = f2(res.bbL);
  document.getElementById("vPRC").textContent = f2(res.pr);

  /* Conditions */
  [["ck1","ci1","cr1"], ["ck2","ci2","cr2"], ["ck3","ci3","cr3"]].forEach(function (ids, i) {
    var c = res.chks[i];
    var row = document.getElementById(ids[0]);
    var ic  = document.getElementById(ids[1]);
    var re  = document.getElementById(ids[2]);
    sc(row, c.p ? "pass" : res.dead ? "neut" : "fail");
    ic.textContent = c.p ? "V" : res.dead ? "~" : "X";
    re.textContent = c.n || "--";
  });

  /* Score */
  var pct = (res.score / 3) * 100;
  var sf  = document.getElementById("sfil");
  sf.style.width      = pct + "%";
  sf.style.background = res.score === 3 ? "var(--gn)" : res.score === 2 ? "var(--gd2)" : res.score === 1 ? "var(--yw)" : "var(--t3)";
  document.getElementById("stxt").textContent = "Score: " + res.score + " / 3  —  " + res.str;

  /* EMA card */
  var icEMA = document.getElementById("icEMA");
  sc(icEMA, res.emaUp ? "bull" : "bear");
  document.getElementById("vE10").textContent = f2(res.E10);
  document.getElementById("vE21").textContent = f2(res.E21);
  var tEMA = document.getElementById("tEMA");
  tEMA.className = "itag " + (res.emaUp ? "tgB" : "tgR");
  tEMA.textContent = res.emaUp ? "UPTREND" : "DOWNTREND";

  /* RSI card */
  var icRSI = document.getElementById("icRSI");
  sc(icRSI, res.dead ? "neut" : res.RSIv >= CFG.rsiOB ? "bear" : res.RSIv <= CFG.rsiOS ? "bull" : "neut");
  document.getElementById("vRSI").textContent = f1(res.RSIv);
  var rf = document.getElementById("rfil");
  rf.style.width      = res.RSIv + "%";
  rf.style.background = res.RSIv >= CFG.rsiOB ? "var(--rd)" : res.RSIv <= CFG.rsiOS ? "var(--gn)" : "var(--bl)";
  var tRSI = document.getElementById("tRSI"), vn = document.getElementById("vRSIn");
  if (res.dead)                     { tRSI.className = "itag tgY"; tRSI.textContent = "DEAD ZONE";  vn.textContent = "45-55"; }
  else if (res.RSIv >= CFG.rsiOB)   { tRSI.className = "itag tgR"; tRSI.textContent = "OVERBOUGHT"; vn.textContent = ">70 SELL"; }
  else if (res.RSIv <= CFG.rsiOS)   { tRSI.className = "itag tgB"; tRSI.textContent = "OVERSOLD";   vn.textContent = "<30 BUY"; }
  else if (res.RSIv > 50)           { tRSI.className = "itag tgY"; tRSI.textContent = ">50";         vn.textContent = "sell zone"; }
  else                               { tRSI.className = "itag tgY"; tRSI.textContent = "<50";         vn.textContent = "buy zone"; }

  /* BB card */
  var icBB = document.getElementById("icBB");
  sc(icBB, res.nL ? "bull" : res.nU ? "bear" : "neut");
  document.getElementById("vBBP").textContent = res.bbPct.toFixed(1) + "%";
  var tBB = document.getElementById("tBB");
  tBB.className = "itag " + (res.nL ? "tgB" : res.nU ? "tgR" : "tgD");
  tBB.textContent = res.nL ? "NEAR LOWER" : res.nU ? "NEAR UPPER" : "MID RANGE";

  /* Labels & status */
  var tfu = tf.toUpperCase();
  document.getElementById("condtag").textContent  = tfu;
  document.getElementById("indtag").textContent   = tfu;
  document.getElementById("chartag").textContent  = "XAUUSD — " + tfu + " — LIVE";
  var d = new Date(), pp = function (v) { return ("0" + v).slice(-2); };
  document.getElementById("lastupd").textContent  = "Updated: " + pp(d.getUTCHours()) + ":" + pp(d.getUTCMinutes()) + ":" + pp(d.getUTCSeconds()) + " UTC";
  document.getElementById("statmsg").innerHTML    = "<span class='gok'>&#9679;</span> Signal Engine Active";
}

/* ══════════════════════════════════════════
   MTF BANNER
══════════════════════════════════════════ */
function updateMTF() {
  var s15 = SIG["15m"], s5 = SIG["5m"];
  function setCard(sid, sub, sig) {
    var el = document.getElementById(sid), s = document.getElementById(sub);
    el.className = "mtfv " + (sig === "BUY" ? "buy" : sig === "SELL" ? "sell" : "wait");
    el.textContent = sig === "BUY" ? "BUY ▲" : sig === "SELL" ? "SELL ▼" : "WAIT ⚠";
    s.textContent  = sig === "BUY" ? "Bullish confirmed" : sig === "SELL" ? "Bearish confirmed" : "No clear setup";
  }
  setCard("v15sig", "v15sub", s15);
  setCard("v5sig",  "v5sub",  s5);
  var cv = document.getElementById("consv");
  if (s15 === "WAIT" || s5 === "WAIT") { cv.className = "consv no";  cv.textContent = "ONE TF WAITING"; }
  else if (s15 === s5)                  { cv.className = "consv yes"; cv.textContent = "BOTH " + s15 + " — STRONG"; }
  else                                   { cv.className = "consv no";  cv.textContent = "CONFLICT — STAY OUT"; }
}

/* ══════════════════════════════════════════
   LOG
══════════════════════════════════════════ */
function addLog(res, tf) {
  if (res.dir === "WAIT") return;
  var d = new Date(), p = function (v) { return ("0" + v).slice(-2); };
  var ts = p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
  var tr = document.createElement("tr");
  tr.innerHTML =
    "<td>" + ts + "</td><td>" + tf.toUpperCase() + "</td>" +
    "<td class='" + (res.dir === "BUY" ? "lbuy" : "lsell") + "'>" + (res.dir === "BUY" ? "BUY 🟢" : "SELL 🔴") + "</td>" +
    "<td>" + res.str + "</td><td>" + f2(res.en) + "</td><td>" + f2(res.sl) + "</td><td>" + f2(res.tp) + "</td>";
  var body = document.getElementById("logbody");
  var empty = body.querySelector(".lempty");
  if (empty) empty.parentNode.removeChild(empty);
  body.insertBefore(tr, body.firstChild);
  while (body.children.length > 25) body.removeChild(body.lastChild);
  LOGN++;
  document.getElementById("logcnt").textContent = LOGN + " signal" + (LOGN !== 1 ? "s" : "");
}

/* ══════════════════════════════════════════
   SOUND
══════════════════════════════════════════ */
function beep(dir) {
  try {
    var ac = new (window.AudioContext || window.webkitAudioContext)();
    var ns = dir === "BUY" ? [523, 659, 784] : [784, 659, 523];
    ns.forEach(function (hz, i) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = "sine"; o.frequency.value = hz;
      var t = ac.currentTime + i * 0.16;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.start(t); o.stop(t + 0.45);
    });
  } catch (e) {}
}

/* ══════════════════════════════════════════
   FLASH
══════════════════════════════════════════ */
function flash(dir) {
  var b = document.getElementById("sigbox");
  b.classList.remove("flash"); void b.offsetWidth;
  if (dir !== "WAIT") b.classList.add("flash");
  setTimeout(function () { b.classList.remove("flash"); }, 3200);
}

/* ══════════════════════════════════════════
   RUN
══════════════════════════════════════════ */
function runTF(tf) {
  var candles = genCandles(tf, CFG.N);
  var res     = compute(candles);
  if (!res) return;
  var prev = SIG[tf];
  SIG[tf]  = res.dir;
  if (tf === TF) updateUI(res, tf);
  updateMTF();
  if (res.dir !== "WAIT" && res.dir !== prev) {
    if (tf === TF) { beep(res.dir); flash(res.dir); }
    addLog(res, tf);
  }
}

function runAll() { runTF("15m"); runTF("5m"); }

/* ══════════════════════════════════════════
   CONTROLS
══════════════════════════════════════════ */
window.setTF = function (tf) {
  TF = tf;
  document.getElementById("btn15").className = "tfbtn" + (tf === "15m" ? " on" : "");
  document.getElementById("btn5").className  = "tfbtn" + (tf === "5m"  ? " on" : "");
  initTradingView(tf);
  runAll();
};

window.doRefresh = function () {
  var btn = document.getElementById("rfbtn");
  btn.style.opacity = "0.4";
  setTimeout(function () { btn.style.opacity = "1"; }, 500);
  initTradingView(TF);
  runAll();
};

/* ══════════════════════════════════════════
   BOOT
══════════════════════════════════════════ */
window.addEventListener("load", function () {
  initTradingView(TF);
  runAll();
  setInterval(runAll, CFG.tick);
});
