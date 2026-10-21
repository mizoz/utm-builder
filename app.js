(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = [
    { key: 'source', param: 'utm_source', q: 's', clean: true },
    { key: 'medium', param: 'utm_medium', q: 'm', clean: true },
    { key: 'campaign', param: 'utm_campaign', q: 'c', clean: true },
    { key: 'term', param: 'utm_term', q: 't', clean: true },
    { key: 'content', param: 'utm_content', q: 'ct', clean: true },
    { key: 'id', param: 'utm_id', q: 'id', clean: false },
    { key: 'platform', param: 'utm_source_platform', q: 'sp', clean: false }
  ];
  var UTM_KEYS = FIELDS.map(function (f) { return f.param; }).concat(['utm_creative_format', 'utm_marketing_tactic']);
  var LS = { last: 'utmb:last', hist: 'utmb:hist', opts: 'utmb:opts' };
  var HIST_MAX = 300;

  function lsGet(k, fallback) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode, full storage */ }
  }

  // ---------- GA4 default channel group ----------
  // Source lists are a short version of Google's category lists (the full ones are a download from Google).
  var SEARCH = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ecosia', 'naver', 'ask', 'aol', 'brave', 'startpage', 'qwant', 'seznam', 'daum', 'search.yahoo', 'msn'];
  var SOCIAL = ['facebook', 'fb', 'instagram', 'ig', 'linkedin', 'lnkd.in', 'twitter', 't.co', 'x.com', 'tiktok', 'pinterest', 'reddit', 'snapchat', 'threads', 'threads.net', 'tumblr', 'quora', 'whatsapp', 'messenger', 'discord', 'mastodon', 'meetup', 'vk', 'weibo', 'wechat', 'line', 'telegram', 'nextdoor', 'yelp', 'medium', 'slack', 'disqus'];
  var VIDEO = ['youtube', 'youtu.be', 'vimeo', 'twitch', 'dailymotion', 'wistia', 'ted', 'netflix', 'hulu', 'disneyplus'];
  var SHOP = ['amazon', 'ebay', 'etsy', 'shopify', 'walmart', 'aliexpress', 'alibaba', 'target', 'bestbuy', 'mercadolibre', 'rakuten', 'shopping.google', 'google shopping', 'igshopping', 'shop.app', 'wayfair'];
  var PAID = /^(.*cp.*|ppc|retargeting|paid.*)$/;
  var SHOP_CAMP = /^(.*(([^a-df-z]|^)shop|shopping).*)$/;
  var DISPLAY = ['display', 'banner', 'expandable', 'interstitial', 'cpm'];
  var SOCIAL_MED = ['social', 'social-network', 'social-media', 'sm', 'social network', 'social media'];
  var EMAIL = ['email', 'e-mail', 'e_mail', 'e mail'];

  function inList(src, list) {
    if (!src) return false;
    if (list.indexOf(src) > -1) return true;
    var base = src.replace(/^(www|m|l|lm|mobile|web|out)\./, '');
    if (list.indexOf(base) > -1) return true;
    var name = base.replace(/\.(com|net|org|co|io|ca|de|fr|es|it|co\.uk|com\.au|ru|cn|jp)$/, '');
    return list.indexOf(name) > -1;
  }

  function channel(p) {
    var s = (p.source || '').trim().toLowerCase();
    var m = (p.medium || '').trim().toLowerCase();
    var c = (p.campaign || '').trim().toLowerCase();
    var paid = PAID.test(m);
    var isShop = inList(s, SHOP), isSearch = inList(s, SEARCH), isSocial = inList(s, SOCIAL), isVideo = inList(s, VIDEO);
    var shopCamp = SHOP_CAMP.test(c);
    var q = function (v) { return '"' + v + '"'; };
    if (!s || !m) return { name: null };
    if (c.indexOf('cross-network') > -1) return { name: 'Cross-network', why: 'The campaign name contains "cross-network".' };
    if ((isShop || shopCamp) && paid) return { name: 'Paid Shopping', why: (isShop ? 'Source ' + q(s) + ' is a shopping site' : 'Campaign ' + q(c) + ' matches the shopping pattern') + ' and medium ' + q(m) + ' matches the paid pattern.' };
    if (isSearch && paid) return { name: 'Paid Search', why: 'Source ' + q(s) + ' is a search engine and medium ' + q(m) + ' matches the paid pattern.' };
    if (isSocial && paid) return { name: 'Paid Social', why: 'Source ' + q(s) + ' is a social site and medium ' + q(m) + ' matches the paid pattern.' };
    if (isVideo && paid) return { name: 'Paid Video', why: 'Source ' + q(s) + ' is a video site and medium ' + q(m) + ' matches the paid pattern.' };
    if (DISPLAY.indexOf(m) > -1) return { name: 'Display', why: 'Medium ' + q(m) + ' is one of display, banner, expandable, interstitial, cpm.' };
    if (paid) return { name: 'Paid Other', why: 'Medium ' + q(m) + ' matches the paid pattern, but source ' + q(s) + ' isn\'t a known search, social, video or shopping site.' };
    if (isShop || shopCamp) return { name: 'Organic Shopping', why: isShop ? 'Source ' + q(s) + ' is a shopping site.' : 'Campaign ' + q(c) + ' matches the shopping pattern.' };
    if (isSocial || SOCIAL_MED.indexOf(m) > -1) return { name: 'Organic Social', why: isSocial ? 'Source ' + q(s) + ' is a social site (and the medium isn\'t paid).' : 'Medium ' + q(m) + ' is a social medium.' };
    if (isVideo || /video/.test(m)) return { name: 'Organic Video', why: isVideo ? 'Source ' + q(s) + ' is a video site.' : 'Medium ' + q(m) + ' contains "video".' };
    if (isSearch || m === 'organic') return { name: 'Organic Search', why: isSearch ? 'Source ' + q(s) + ' is a search engine.' : 'Medium is "organic".' };
    if (EMAIL.indexOf(s) > -1 || EMAIL.indexOf(m) > -1) return { name: 'Email', why: 'Source or medium is email (or e-mail, e_mail).' };
    if (m === 'affiliate') return { name: 'Affiliates', why: 'Medium is "affiliate".' };
    if (m === 'referral' || m === 'app' || m === 'link') return { name: 'Referral', why: 'Medium ' + q(m) + ' is one of referral, app, link.' };
    if (m === 'audio') return { name: 'Audio', why: 'Medium is "audio".' };
    if (s === 'sms' || m === 'sms') return { name: 'SMS', why: 'Source or medium is "sms".' };
    if (/push$/.test(m) || m.indexOf('mobile') > -1 || m.indexOf('notification') > -1 || s === 'firebase') return { name: 'Mobile Push Notifications', why: 'Medium ends in "push" or contains "mobile"/"notification", or source is firebase.' };
    return { name: 'Unassigned', why: 'No default channel rule matches medium ' + q(m) + (s ? ' with source ' + q(s) : '') + '.', bad: true };
  }

  // ---------- naming ----------
  var MACRO = /(\{\{[^{}]*\}\}|\{[^{}]*\})/;
  function cleanName(v, sep) {
    if (!v) return '';
    var other = sep === '-' ? /_/g : /-/g;
    return v.split(MACRO).map(function (part, i) {
      if (i % 2 === 1) return part; // ad platform macro like {{ad.name}} or {keyword}
      return part.toLowerCase()
        .replace(/\s+/g, sep)
        .replace(other, sep)
        .replace(/[^a-z0-9._~+\-]/g, '')
        .replace(sep === '-' ? /-{2,}/g : /_{2,}/g, sep);
    }).join('').replace(sep === '-' ? /^-+|-+$/g : /^_+|_+$/g, '');
  }
  // keystroke-safe version: same length, so the caret doesn't jump
  function softClean(v, sep) {
    var out = '', depth = 0;
    for (var i = 0; i < v.length; i++) {
      var ch = v[i];
      if (ch === '{') depth++;
      if (ch === '}') depth = Math.max(0, depth - 1);
      out += depth ? ch : (/\s/.test(ch) ? sep : ch.toLowerCase());
    }
    return out;
  }
  function norm(v) { return (v || '').toLowerCase().replace(/[\s_-]+/g, ''); }

  // ---------- URL building ----------
  function enc(v) { return encodeURIComponent(v).replace(/%7B/gi, '{').replace(/%7D/gi, '}'); }

  function build(rawUrl, p) {
    var res = { url: '', notes: [], ok: false };
    var raw = (rawUrl || '').trim();
    if (!raw) return res;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      raw = 'https://' + raw.replace(/^\/+/, '');
      res.addedScheme = true;
    }
    var u;
    try { u = new URL(raw); } catch (e) { res.invalid = true; return res; }
    if (!/^https?:$/.test(u.protocol) || !u.hostname || u.hostname.indexOf('.') < 0 && u.hostname !== 'localhost') { res.invalid = true; return res; }
    res.host = u.hostname;
    var hash = '', hi = raw.indexOf('#');
    if (hi > -1) { hash = raw.slice(hi); raw = raw.slice(0, hi); }
    var query = '', qi = raw.indexOf('?');
    if (qi > -1) { query = raw.slice(qi + 1); raw = raw.slice(0, qi); }
    if (/^https?:\/\/[^\/]+$/i.test(raw)) raw += '/';
    var kept = [], replaced = [], clickIds = [];
    query.split('&').forEach(function (pair) {
      if (!pair) return;
      var k = pair.split('=')[0];
      try { k = decodeURIComponent(k.replace(/\+/g, ' ')); } catch (e) { /* keep raw */ }
      var kl = k.toLowerCase();
      if (UTM_KEYS.indexOf(kl) > -1) { replaced.push(kl); return; }
      if (/^(gclid|fbclid|msclkid|gbraid|wbraid|dclid|ttclid|li_fat_id)$/.test(kl)) clickIds.push(kl);
      kept.push(pair);
    });
    FIELDS.forEach(function (f) {
      var v = (p[f.key] || '').trim();
      if (v) kept.push(f.param + '=' + enc(v));
    });
    res.url = raw + (kept.length ? '?' + kept.join('&') : '') + hash;
    res.replaced = replaced;
    res.clickIds = clickIds;
    res.http = u.protocol === 'http:';
    res.ok = true;
    return res;
  }

  // ---------- warnings ----------
  var UNPRINTED = ['qr', 'qr-code', 'qr_code', 'qrcode', 'print', 'flyer', 'poster', 'offline', 'billboard', 'direct-mail', 'direct_mail', 'mailer', 'event', 'tradeshow', 'trade-show', 'brochure', 'business-card', 'signage', 'tv', 'radio', 'ooh'];

  function mediumHint(m, s, sep) {
    var x = m.toLowerCase().replace(/[\s_]+/g, '-');
    var j = function (a, b) { return a + sep + b; };
    if (/^(newsletter|e-?newsletter|mail|mailchimp|edm|klaviyo|mailing)$/.test(x)) return { text: 'Use "email" so GA4 counts it as Email.', fix: { medium: 'email' } };
    if (UNPRINTED.indexOf(x) > -1 || /^qr/.test(x)) return { text: 'GA4 has no print or QR channel, so this will always be Unassigned. That\'s OK if you keep the value consistent and add a custom channel group in GA4 (Admin > Data display > Channel groups) that maps it to an "Offline" channel.' };
    if (/^(partner|partners|sponsor|sponsorship|sponsored-post|pr|press|blog|guest-post|directory|listing|website)$/.test(x)) return { text: 'Use "referral" for partner and sponsor links (or "affiliate" if they get paid per sale).', fix: { medium: 'referral' } };
    if (/^podcast/.test(x)) return { text: 'Use "audio" for podcast links so they land in Audio.', fix: { medium: 'audio' } };
    if (/^(text|text-message|txt)$/.test(x)) return { text: 'Use "sms" for text messages.', fix: { medium: 'sms' } };
    if (/^(social-?paid|socialpaid|social-ads|ads|ad|sponsored|boosted|boost|promoted)$/.test(x)) return { text: 'Start the medium with "paid" (or use cpc) so GA4 treats it as paid.', fix: { medium: inList(s, SOCIAL) ? j('paid', 'social') : 'cpc' } };
    if (/^(influencer|creator|ugc)$/.test(x)) return { text: 'Influencer posts usually go under "social" (or a "paid" medium if you paid for them).', fix: { medium: 'social' } };
    if (inList(x, SOCIAL) || inList(x, SEARCH) || inList(x, VIDEO)) return { text: 'That looks like a source, not a medium. Put the site in utm_source and the type of traffic (social, cpc, email...) in utm_medium.' };
    return { text: 'Mediums GA4 understands: email, social, ' + j('paid', 'social') + ', cpc, display, referral, affiliate, audio, sms, organic, video.' };
  }

  function check(rawUrl, p, b, ch, opts) {
    var w = [];
    var sep = opts.sep;
    var add = function (level, text, fix) { w.push({ level: level, text: text, fix: fix }); };
    if (!(rawUrl || '').trim()) add('err', 'Add the page URL you want people to land on.');
    else if (b.invalid) add('err', 'That URL doesn\'t look right. It should look like https://example.com/page.');
    if (!p.source) add('err', 'utm_source is missing. GA4 needs it to know where the visit came from.');
    if (!p.medium) add('err', 'utm_medium is missing. Without it GA4 can\'t pick a channel.');
    if (!p.campaign) add('err', 'utm_campaign is missing. Google says to always set source, medium and campaign.');
    if (b.addedScheme && b.ok) add('info', 'Added https:// to the start of your URL.');
    if (b.http) add('info', 'Your URL uses http://. If the site redirects to https, some redirects drop the tags, so link to the https version.');
    if (b.replaced && b.replaced.length) add('info', 'Your URL already had ' + b.replaced.join(', ') + '. I replaced them with the values above.');
    if (b.clickIds && b.clickIds.length) add('warn', 'Your URL contains ' + b.clickIds.join(', ') + '. Click IDs are added by the ad platform per click, so remove them from links you share.');

    FIELDS.forEach(function (f) {
      var v = p[f.key] || '';
      if (!v) return;
      if (f.clean) {
        var stripped = v.replace(new RegExp(MACRO.source, 'g'), '');
        var cl = cleanName(v, sep);
        if (/\s/.test(stripped)) add('warn', f.param + ' has spaces. They turn into %20 and break easily when copied.', fixObj(f.key, cl));
        else if (/[A-Z]/.test(stripped)) add('warn', f.param + ' has capital letters. GA4 is case sensitive, so "' + v + '" and "' + v.toLowerCase() + '" become two rows.', fixObj(f.key, cl));
        else if (/[^a-z0-9._~+\-]/.test(stripped)) add('warn', f.param + ' has characters like & # ? or quotes. They get encoded and look messy in reports.', fixObj(f.key, cl));
      }
      if (f.key !== 'id' && f.key !== 'platform' && opts.history) {
        var prev = opts.history[f.key];
        if (prev) {
          var n = norm(v);
          var match = prev.filter(function (h) { return h !== v && norm(h) === n; })[0];
          if (match) add('warn', 'You used "' + match + '" for ' + f.param + ' before. Stick to one spelling so reports don\'t split.', fixObj(f.key, match));
        }
      }
    });

    if (p.medium && p.source) {
      var ml = p.medium.toLowerCase(), sl = p.source.toLowerCase();
      if (ch.bad) {
        var h = mediumHint(ml, sl, sep);
        add('warn', 'utm_medium "' + p.medium + '" lands in Unassigned. ' + h.text, h.fix);
      } else if (/(^|[-_ ])(paid|ads?|sponsored|boost(ed)?|promoted)([-_ ]|$)/.test(ml) && !PAID.test(ml)) {
        add('warn', 'Medium "' + p.medium + '" sounds paid, but GA4 will count it as ' + ch.name + '. Paid mediums have to start with "paid" or contain "cp" (cpc, cpm).', { medium: inList(sl, SOCIAL) ? 'paid' + sep + 'social' : 'cpc' });
      }
      if ((EMAIL.indexOf(sl) > -1 || ['social', 'cpc', 'paid', 'organic', 'referral', 'display'].indexOf(sl) > -1) && (inList(ml, SOCIAL) || inList(ml, SEARCH))) {
        add('warn', 'Looks like source and medium are swapped.', { source: ml, medium: sl });
      }
      if (ch.name && /Shopping/.test(ch.name) && !inList(sl, SHOP) && SHOP_CAMP.test((p.campaign || '').toLowerCase())) {
        add('warn', 'The campaign name contains "shop", so GA4 puts this in ' + ch.name + '. If that\'s not what you want, rename it (for example "store" instead of "shop").');
      }
      var expect = { email: 'Email', 'e-mail': 'Email', sms: 'SMS', audio: 'Audio', affiliate: 'Affiliates', referral: 'Referral', organic: 'Organic Search', social: 'Organic Social' }[ml];
      if (expect && ch.name && ch.name !== expect) add('warn', 'Medium "' + p.medium + '" would normally be ' + expect + ', but GA4 checks other rules first and this link lands in ' + ch.name + '. ' + ch.why);
      if (ch.name === 'Paid Other' && sl) add('info', 'GA4 doesn\'t recognise "' + p.source + '" as a search, social or video site, so paid traffic from it is Paid Other.');
      if (inList(sl, SEARCH) && sl.indexOf('google') > -1 && PAID.test(ml)) add('info', 'For Google Ads, turn on auto-tagging and link Ads to GA4 instead. It\'s more detailed than manual tags. Manual tags still help if auto-tagging is off.');
      if (ch.name === 'Cross-network') add('info', 'The campaign name contains "cross-network", which forces the Cross-network channel no matter what the medium is.');
    }
    if (b.ok && b.url.length > 2000) add('warn', 'This link is over 2,000 characters. Some apps cut long links off.');
    if (b.ok && b.host && /(^|\.)(bit\.ly|tinyurl\.com|t\.co|lnkd\.in|ow\.ly|buff\.ly)$/.test(b.host)) add('warn', 'That looks like a short link. Tag the final page URL, then shorten the tagged link.');
    return w;
  }
  function fixObj(k, v) { var o = {}; o[k] = v; return o; }

  // ---------- presets ----------
  var PRESETS = [
    { name: 'Newsletter', set: { source: 'newsletter', medium: 'email' }, tip: 'Change the source to your newsletter name if you have more than one.' },
    { name: 'LinkedIn organic', set: { source: 'linkedin', medium: 'social' } },
    { name: 'LinkedIn paid', set: { source: 'linkedin', medium: 'paid{sep}social' } },
    { name: 'Meta ads', set: { source: 'facebook', medium: 'paid{sep}social', campaign: '{{campaign.name}}', term: '{{adset.name}}', content: '{{ad.name}}' }, tip: 'Meta fills the {{...}} values per ad. Use source "instagram" for Instagram-only ads.' },
    { name: 'Google Ads', set: { source: 'google', medium: 'cpc', term: '{keyword}', content: '{creative}', id: '{campaignid}' }, tip: 'Auto-tagging is better if your Ads account is linked to GA4. These ValueTrack {...} values are filled in by Google Ads.' },
    { name: 'QR on print', set: { source: 'flyer', medium: 'print' }, tip: 'Change source to poster, business-card, etc. Print has no GA4 default channel, see the warning.' },
    { name: 'Podcast', set: { source: 'podcast-name', medium: 'audio' }, tip: 'Swap podcast-name for the show.' },
    { name: 'Partner / sponsor', set: { source: 'partner-site', medium: 'referral' }, tip: 'Use the partner\'s name as the source. Use medium "affiliate" if they earn per sale.' }
  ];

  // ---------- DOM ----------
  var inputs = {};
  FIELDS.forEach(function (f) { inputs[f.key] = $('f-' + f.key); });
  var urlIn = $('f-url'), outUrl = $('out-url');
  var optClean = $('o-clean'), optSep = $('o-sep');
  var lastResult = null;
  var history = lsGet(LS.hist, []);
  if (!Array.isArray(history)) history = [];

  function opts() { return { clean: optClean.checked, sep: optSep.value }; }

  function readForm() {
    var p = {};
    FIELDS.forEach(function (f) { p[f.key] = inputs[f.key].value.trim(); });
    return p;
  }

  function historyIndex() {
    var idx = {};
    FIELDS.forEach(function (f) {
      var set = {};
      history.forEach(function (h) { var v = h.p && h.p[f.key]; if (v) set[v] = 1; });
      idx[f.key] = Object.keys(set);
    });
    return idx;
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function copy(text, msg) {
    var done = function () { toast(msg || 'Copied'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing else to try */ }
    document.body.removeChild(ta);
  }

  function download(name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function slug(s) { return (s || '').toLowerCase().replace(/\{+[^}]*\}+/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }

  // ---------- render ----------
  var stateTimer;
  function update() {
    var p = readForm();
    var o = opts();
    var b = build(urlIn.value, p);
    var ch = channel(p);
    var warns = check(urlIn.value, p, b, ch, { sep: o.sep, history: historyIndex() });
    var complete = b.ok && p.source && p.medium && p.campaign;

    outUrl.value = b.ok ? b.url : '';
    $('btn-copy').disabled = !b.ok;
    $('btn-save').disabled = !complete;

    var box = $('channel');
    box.className = 'channel' + (ch.name ? (ch.bad ? ' warn' : ' ok') : '');
    $('ch-name').textContent = ch.name || 'Fill in source and medium';
    $('ch-why').textContent = ch.name ? ch.why : 'The badge updates as you type.';

    FIELDS.concat([{ key: 'url' }]).forEach(function (f) {
      var el = f.key === 'url' ? urlIn : inputs[f.key];
      el.classList.remove('has-warn', 'has-err');
      el.removeAttribute('aria-invalid');
    });
    if (b.invalid) { urlIn.classList.add('has-err'); urlIn.setAttribute('aria-invalid', 'true'); }

    var ul = $('warnings');
    ul.textContent = '';
    var interacted = urlIn.value || FIELDS.some(function (f) { return p[f.key]; });
    warns.forEach(function (w) {
      if (!interacted && w.level === 'err') return;
      var li = document.createElement('li');
      li.className = w.level;
      var b1 = document.createElement('b');
      b1.textContent = w.level === 'err' ? 'Missing:' : w.level === 'warn' ? 'Check:' : 'Note:';
      li.appendChild(b1);
      li.appendChild(document.createTextNode(' ' + w.text));
      if (w.fix) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Fix: ' + Object.keys(w.fix).map(function (k) { return k + ' = ' + w.fix[k]; }).join(', ');
        btn.addEventListener('click', function () {
          Object.keys(w.fix).forEach(function (k) { inputs[k].value = w.fix[k]; });
          update();
          var first = inputs[Object.keys(w.fix)[0]];
          if (first) first.focus();
        });
        li.appendChild(btn);
      }
      ul.appendChild(li);
      if (w.fix) Object.keys(w.fix).forEach(function (k) { if (inputs[k]) inputs[k].classList.add('has-warn'); });
    });

    lastResult = { p: p, b: b, ch: ch, complete: complete, base: urlIn.value.trim() };
    renderQR(b.ok ? b.url : '');

    clearTimeout(stateTimer);
    stateTimer = setTimeout(function () {
      lsSet(LS.last, { url: urlIn.value, p: p });
      lsSet(LS.opts, o);
      try { history_replace(shareUrl()); } catch (e) { /* file:// etc */ }
    }, 250);
  }
  function history_replace(u) { window.history.replaceState(null, '', u); }

  function shareUrl() {
    var parts = [];
    if (urlIn.value.trim()) parts.push('u=' + encodeURIComponent(urlIn.value.trim()));
    FIELDS.forEach(function (f) {
      var v = inputs[f.key].value.trim();
      if (v) parts.push(f.q + '=' + encodeURIComponent(v));
    });
    return location.pathname + (parts.length ? '?' + parts.join('&') : '');
  }

  // ---------- QR ----------
  var qrCache = { text: null, qr: null };
  function makeQR(text) {
    if (typeof window.qrcode !== 'function') return null;
    if (qrCache.text === text) return qrCache.qr;
    var qr = null;
    try {
      qr = window.qrcode(0, 'M');
      qr.addData(text, 'Byte');
      qr.make();
    } catch (e) { qr = null; }
    qrCache = { text: text, qr: qr };
    return qr;
  }
  function qrSvg(qr, withSize) {
    var n = qr.getModuleCount(), m = 4, total = n + m * 2, d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '"' +
      (withSize ? ' width="' + total * 10 + '" height="' + total * 10 + '"' : '') +
      ' shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path fill="#000000" d="' + d + '"/></svg>';
  }
  function renderQR(text) {
    var box = $('qr-box');
    if (!text) { box.hidden = true; return; }
    box.hidden = false;
    var note = $('qr-note');
    if (typeof window.qrcode !== 'function') {
      $('qr-view').textContent = '';
      note.textContent = 'The QR code library didn\'t load (offline or blocked). Reload when you\'re online.';
      $('btn-png').disabled = $('btn-svg').disabled = true;
      return;
    }
    var qr = makeQR(text);
    $('btn-png').disabled = $('btn-svg').disabled = !qr;
    if (!qr) { $('qr-view').textContent = ''; note.textContent = 'This link is too long for a QR code. Shorten the URL or drop optional fields.'; return; }
    $('qr-view').innerHTML = qrSvg(qr, false);
    note.textContent = text.length > 300
      ? 'Long link, so the code is dense. Print it at least 3 cm wide and test it with a phone first.'
      : 'SVG scales to any size, best for print. Test scan before you print.';
  }
  function qrName(ext) {
    var p = lastResult ? lastResult.p : {};
    var bits = ['qr', slug(p.source), slug(p.campaign), slug(p.content)].filter(Boolean);
    return bits.join('-') + '.' + ext;
  }
  $('btn-svg').addEventListener('click', function () {
    var qr = lastResult && makeQR(lastResult.b.url);
    if (qr) download(qrName('svg'), qrSvg(qr, true), 'image/svg+xml');
  });
  $('btn-png').addEventListener('click', function () {
    var qr = lastResult && makeQR(lastResult.b.url);
    if (!qr) return;
    var want = parseInt($('qr-size').value, 10) || 1024;
    var n = qr.getModuleCount(), total = n + 8;
    var cell = Math.max(1, Math.floor(want / total));
    var size = cell * total;
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + 4) * cell, (r + 4) * cell, cell, cell);
    cv.toBlob(function (blob) { if (blob) download(qrName('png'), blob); }, 'image/png');
  });

  // ---------- form events ----------
  FIELDS.forEach(function (f) {
    var el = inputs[f.key];
    el.addEventListener('input', function () {
      if (f.clean && optClean.checked) {
        var s = el.selectionStart, e = el.selectionEnd;
        var v = softClean(el.value, optSep.value);
        if (v !== el.value) { el.value = v; try { el.setSelectionRange(s, e); } catch (err) { /* type without selection */ } }
      }
      update();
    });
    el.addEventListener('change', function () {
      if (f.clean && optClean.checked) {
        var v = cleanName(el.value, optSep.value);
        if (v !== el.value) el.value = v;
      }
      update();
    });
  });
  urlIn.addEventListener('input', update);
  urlIn.addEventListener('change', function () { urlIn.value = urlIn.value.trim(); update(); });
  optClean.addEventListener('change', update);
  optSep.addEventListener('change', update);

  $('btn-clean').addEventListener('click', function () {
    FIELDS.forEach(function (f) { if (f.clean) inputs[f.key].value = cleanName(inputs[f.key].value, optSep.value); });
    update();
    toast('Names cleaned up');
  });
  $('btn-reset').addEventListener('click', function () {
    urlIn.value = '';
    FIELDS.forEach(function (f) { inputs[f.key].value = ''; });
    document.querySelectorAll('#preset-list button').forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
    update();
    urlIn.focus();
  });
  $('btn-copy').addEventListener('click', function () { if (lastResult && lastResult.b.ok) copy(lastResult.b.url, 'Link copied'); });
  $('btn-share').addEventListener('click', function () { copy(location.origin + shareUrl(), 'Builder link copied'); });
  $('btn-save').addEventListener('click', function () {
    if (!lastResult || !lastResult.complete) return;
    addHistory([{ url: lastResult.b.url, base: lastResult.base, p: lastResult.p, channel: lastResult.ch.name }]);
    toast('Saved to history');
  });

  // presets
  var plist = $('preset-list');
  PRESETS.forEach(function (pr) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = pr.name;
    btn.setAttribute('aria-pressed', 'false');
    if (pr.tip) btn.title = pr.tip;
    btn.addEventListener('click', function () {
      var sep = optSep.value;
      Object.keys(pr.set).forEach(function (k) { inputs[k].value = pr.set[k].replace('{sep}', sep); });
      // drop macros left over from an ad preset
      ['campaign', 'term', 'content', 'id'].forEach(function (k) {
        if (pr.set[k] == null && /^\{/.test(inputs[k].value)) inputs[k].value = '';
      });
      plist.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
      update();
      if (pr.tip) toast(pr.name + ': ' + pr.tip);
      if (!inputs.campaign.value) inputs.campaign.focus();
    });
    plist.appendChild(btn);
  });

  function fillDatalists() {
    var idx = historyIndex();
    var src = ['newsletter', 'linkedin', 'facebook', 'instagram', 'google', 'bing', 'youtube', 'tiktok', 'x.com', 'reddit', 'flyer', 'poster', 'podcast-name', 'partner-site'];
    var med = ['email', 'social', 'paid' + optSep.value + 'social', 'cpc', 'display', 'referral', 'affiliate', 'audio', 'sms', 'video', 'organic', 'print'];
    [['dl-source', idx.source.concat(src)], ['dl-medium', idx.medium.concat(med)]].forEach(function (pair) {
      var dl = $(pair[0]); dl.textContent = '';
      var seen = {};
      pair[1].forEach(function (v) {
        if (seen[v]) return; seen[v] = 1;
        var o = document.createElement('option'); o.value = v; dl.appendChild(o);
      });
    });
  }

  // ---------- history ----------
  function addHistory(items) {
    var now = new Date().toISOString();
    items.forEach(function (it) {
      history = history.filter(function (h) { return h.url !== it.url; });
      it.ts = now;
      history.unshift(it);
    });
    if (history.length > HIST_MAX) history.length = HIST_MAX;
    lsSet(LS.hist, history);
    renderHistory();
    fillDatalists();
  }
  function renderHistory() {
    $('hist-count').textContent = history.length;
    $('hist-csv').disabled = $('hist-clear').disabled = !history.length;
    var f = $('hist-filter').value.trim().toLowerCase();
    var ul = $('hist-list');
    ul.textContent = '';
    var shown = history.filter(function (h) { return !f || h.url.toLowerCase().indexOf(f) > -1 || (h.channel || '').toLowerCase().indexOf(f) > -1; });
    if (!shown.length) {
      var li = document.createElement('li');
      li.textContent = history.length ? 'Nothing matches that filter.' : 'No saved links yet. Build one and press "Save to history".';
      ul.appendChild(li);
      return;
    }
    shown.forEach(function (h) {
      var li = document.createElement('li');
      var meta = document.createElement('div'); meta.className = 'h-meta';
      var tag = document.createElement('span'); tag.className = 'tag' + (h.channel === 'Unassigned' ? ' warn' : ''); tag.textContent = h.channel || '?';
      meta.appendChild(tag);
      var t = document.createElement('span'); t.textContent = (h.p.campaign || '') + ' · ' + new Date(h.ts).toLocaleString();
      meta.appendChild(t);
      var u = document.createElement('div'); u.className = 'h-url'; u.textContent = h.url;
      var row = document.createElement('div'); row.className = 'row-btns';
      [['Copy', function () { copy(h.url, 'Link copied'); }],
       ['Load', function () { loadInto(h.base, h.p); selectTab('tab-single'); toast('Loaded into the builder'); }],
       ['Delete', function () { history = history.filter(function (x) { return x !== h; }); lsSet(LS.hist, history); renderHistory(); fillDatalists(); }]
      ].forEach(function (a) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = a[0];
        b.setAttribute('aria-label', a[0] + ' ' + h.url);
        b.addEventListener('click', a[1]); row.appendChild(b);
      });
      li.appendChild(meta); li.appendChild(u); li.appendChild(row);
      ul.appendChild(li);
    });
  }
  $('hist-filter').addEventListener('input', renderHistory);
  $('hist-clear').addEventListener('click', function () {
    if (!confirm('Delete all ' + history.length + ' saved links from this browser?')) return;
    history = []; lsSet(LS.hist, history); renderHistory(); fillDatalists();
  });
  $('hist-csv').addEventListener('click', function () {
    var rows = [['saved_at', 'original_url', 'tagged_url'].concat(FIELDS.map(function (f) { return f.param; }), ['ga4_channel'])];
    history.forEach(function (h) {
      rows.push([h.ts, h.base, h.url].concat(FIELDS.map(function (f) { return h.p[f.key] || ''; }), [h.channel || '']));
    });
    download('utm-links-history.csv', toCSV(rows), 'text/csv;charset=utf-8');
  });

  function loadInto(base, p) {
    urlIn.value = base || '';
    FIELDS.forEach(function (f) { inputs[f.key].value = (p && p[f.key]) || ''; });
    update();
  }

  // ---------- CSV ----------
  function toCSV(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) {
        v = String(v == null ? '' : v);
        if (/^[=+\-@]/.test(v) && !/^https?:/.test(v)) v = "'" + v; // spreadsheet formula guard
        return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
  }
  function parseCSV(text, delim) {
    var rows = [], row = [], cell = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  }

  var HEAD = { url: 'url', website: 'url', link: 'url', page: 'url', landing_page: 'url', 'landing page': 'url', website_url: 'url',
    source: 'source', medium: 'medium', campaign: 'campaign', term: 'term', content: 'content', id: 'id', campaign_id: 'id',
    source_platform: 'platform', platform: 'platform' };

  var bulkRows = [];
  function runBulk() {
    var text = $('bulk-in').value.replace(/^﻿/, '');
    var status = $('bulk-status');
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) { status.textContent = 'Paste some URLs or a CSV first.'; return; }
    var first = lines[0];
    var delim = first.indexOf('\t') > -1 ? '\t' : first.indexOf(';') > -1 && first.indexOf(',') < 0 ? ';' : ',';
    var heads = first.split(delim).map(function (h) { return h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/^utm_/, ''); });
    var isCSV = heads.some(function (h) { return HEAD[h] === 'url'; });
    var defaults = readForm();
    var o = opts();
    var records = [];
    if (isCSV) {
      var rows = parseCSV(text, delim);
      var map = heads.map(function (h) { return HEAD[h] || null; });
      rows.slice(1).forEach(function (r) {
        var rec = { url: '', p: {} };
        r.forEach(function (v, i) { var k = map[i]; if (!k) return; if (k === 'url') rec.url = v.trim(); else rec.p[k] = v.trim(); });
        records.push(rec);
      });
    } else {
      lines.forEach(function (l) { records.push({ url: l.trim(), p: {} }); });
    }
    var hidx = historyIndex();
    bulkRows = records.map(function (rec) {
      var p = {};
      FIELDS.forEach(function (f) {
        var v = rec.p[f.key] != null && rec.p[f.key] !== '' ? rec.p[f.key] : defaults[f.key];
        if (o.clean && f.clean) v = cleanName(v, o.sep);
        p[f.key] = v || '';
      });
      var b = build(rec.url, p);
      var ch = channel(p);
      var w = check(rec.url, p, b, ch, { sep: o.sep, history: hidx }).filter(function (x) { return x.level !== 'info'; });
      return { base: rec.url, p: p, b: b, ch: ch, w: w.map(function (x) { return x.text; }) };
    });
    // spelling drift inside the batch
    ['source', 'medium', 'campaign'].forEach(function (k) {
      var seen = {};
      bulkRows.forEach(function (r) {
        var v = r.p[k]; if (!v) return;
        var n = norm(v);
        if (seen[n] && seen[n] !== v) r.w.push('utm_' + k + ' "' + v + '" vs "' + seen[n] + '" in another row. Pick one spelling.');
        else seen[n] = seen[n] || v;
      });
    });
    renderBulk();
    var ok = bulkRows.filter(function (r) { return r.b.ok; }).length;
    var withW = bulkRows.filter(function (r) { return r.w.length; }).length;
    status.textContent = 'Built ' + ok + ' of ' + bulkRows.length + ' links' + (withW ? ', ' + withW + ' with warnings.' : '. No warnings.');
  }
  function renderBulk() {
    var table = $('bulk-table'), tb = table.querySelector('tbody');
    tb.textContent = '';
    bulkRows.forEach(function (r, i) {
      var tr = document.createElement('tr');
      var td0 = document.createElement('td'); td0.textContent = i + 1;
      var td1 = document.createElement('td'); td1.textContent = r.b.ok ? r.b.url : (r.base || '(empty)');
      var td2 = document.createElement('td');
      var tag = document.createElement('span'); tag.className = 'tag' + (r.ch.bad || !r.ch.name ? ' warn' : ''); tag.textContent = r.ch.name || 'n/a';
      td2.appendChild(tag);
      var td3 = document.createElement('td'); td3.textContent = r.w.length ? r.w.join(' ') : 'None';
      [td0, td1, td2, td3].forEach(function (td) { tr.appendChild(td); });
      tb.appendChild(tr);
    });
    table.hidden = !bulkRows.length;
    var any = bulkRows.some(function (r) { return r.b.ok; });
    $('bulk-csv').disabled = $('bulk-copy').disabled = $('bulk-save').disabled = !any;
  }
  $('bulk-run').addEventListener('click', runBulk);
  $('bulk-file').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () { $('bulk-in').value = String(rd.result); runBulk(); };
    rd.readAsText(file);
    e.target.value = '';
  });
  $('bulk-csv').addEventListener('click', function () {
    var rows = [['original_url', 'tagged_url'].concat(FIELDS.map(function (f) { return f.param; }), ['ga4_channel', 'warnings'])];
    bulkRows.forEach(function (r) {
      rows.push([r.base, r.b.ok ? r.b.url : ''].concat(FIELDS.map(function (f) { return r.p[f.key]; }), [r.ch.name || '', r.w.join(' | ')]));
    });
    download('utm-links.csv', toCSV(rows), 'text/csv;charset=utf-8');
  });
  $('bulk-copy').addEventListener('click', function () {
    copy(bulkRows.filter(function (r) { return r.b.ok; }).map(function (r) { return r.b.url; }).join('\n'), 'All links copied');
  });
  $('bulk-save').addEventListener('click', function () {
    var items = bulkRows.filter(function (r) { return r.b.ok && r.p.source && r.p.medium && r.p.campaign; })
      .map(function (r) { return { url: r.b.url, base: r.base, p: r.p, channel: r.ch.name }; });
    addHistory(items.reverse());
    toast('Saved ' + items.length + ' links');
  });

  // ---------- tabs ----------
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(id) {
    tabs.forEach(function (t) {
      var on = t.id === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t.id); });
    t.addEventListener('keydown', function (e) {
      var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (j === null) return;
      e.preventDefault();
      var next = tabs[(j + tabs.length) % tabs.length];
      selectTab(next.id); next.focus();
    });
  });

  // ---------- init ----------
  var savedOpts = lsGet(LS.opts, null);
  if (savedOpts) { optClean.checked = savedOpts.clean !== false; if (savedOpts.sep === '_' || savedOpts.sep === '-') optSep.value = savedOpts.sep; }
  var qs = new URLSearchParams(location.search);
  var fromQuery = qs.has('u') || FIELDS.some(function (f) { return qs.has(f.q); });
  if (fromQuery) {
    urlIn.value = qs.get('u') || '';
    FIELDS.forEach(function (f) { inputs[f.key].value = qs.get(f.q) || ''; });
    if (inputs.id.value || inputs.platform.value) $('more').open = true;
  } else {
    var last = lsGet(LS.last, null);
    if (last && last.p) loadInto(last.url, last.p);
    if (last && last.p && (last.p.id || last.p.platform)) $('more').open = true;
  }
  fillDatalists();
  renderHistory();
  update();
})();
