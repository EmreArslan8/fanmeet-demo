/* FanMeet — kullanıcı uygulaması (hash router + view'lar) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { esc, ago, left, money, H } = FM;

  let S = FM.load();
  if (FM.expireListings(S)) FM.save(S);
  const save = () => FM.save(S);

  /* ---------- State yardımcıları ---------- */
  const meId = () => (S.role === 'fan' ? 'me_fan' : 'me_creator');
  const user = id => S.users.find(u => u.id === id);
  const me = () => user(meId());
  const plan = u => FM.plan(S, u);
  const cfg = () => S.config;
  const otherRole = () => (S.role === 'fan' ? 'creator' : 'fan');
  const RANK = { free: 0, premium: 1, plus: 2, pro: 3 };
  const prio = x => (RANK[x.plan] || 0) * 10 + (x.tags.includes('Featured') ? 5 : 0) + (x.tags.includes('Platform Selected') ? 3 : 0);
  const isActive = u => Date.now() - u.lastActive < 72 * H;
  const isVerified = u => u.role === 'creator' && (u.verified || u.tags.includes('Verified'));
  const myConvos = () => S.convos.filter(c => c.users.includes(meId()) && !S.blocked.includes(partnerId(c)));
  const partnerId = c => c.users.find(x => x !== meId());
  const convoWith = id => S.convos.find(c => c.users.includes(meId()) && c.users.includes(id));
  const incoming = () => S.requests.filter(r => r.to === meId() && r.status === 'pending' && !S.blocked.includes(r.from));
  const trLower = s => String(s).toLocaleLowerCase('tr');

  /* ---------- UI parçaları ---------- */
  const vb = u => (isVerified(u) ? icon('verified', 'vbadge') : '');
  const roleChip = u => (u.role === 'creator' ? '<span class="chip chip-dark">Creator</span>' : '<span class="chip chip-outline">Fan</span>');
  function planChip(u) {
    const p = plan(u);
    const cls = { free: '', premium: 'chip-rose', plus: 'chip-plum', pro: 'chip-gold' }[u.plan] || '';
    const name = u.role === 'creator' ? p.name.replace(' Creator', '') : p.name;
    return `<span class="chip ${cls}">${u.plan === 'pro' ? icon('crown') : ''}${name}</span>`;
  }
  const avatar = (u, size = 40) =>
    `<span class="av-wrap"><img class="av av-${size}" src="${esc(u.photo)}" alt="" loading="lazy">${isActive(u) ? '<i class="online"></i>' : ''}</span>`;
  const coinTxt = n => `<b class="row" style="gap:4px;display:inline-flex">${icon('coin', 'ic-sm')}${n}</b>`;

  function toast(msg, err) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.innerHTML = icon(err ? 'alert' : 'check') + `<span>${msg}</span>`;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 3400);
  }

  function modal({ title = '', sub = '', body = '', foot = '', wide = false, onMount }) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><div>${title ? `<h3>${title}</h3>` : ''}${sub ? `<p class="muted small" style="margin-top:4px">${sub}</p>` : ''}</div>
      <button class="icon-btn" data-close aria-label="Kapat">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
    const back = root.firstElementChild;
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) closeModal(); });
    const m = back.querySelector('.modal');
    if (onMount) onMount(m);
    return m;
  }
  const closeModal = () => { $('#modal-root').innerHTML = ''; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); $('#notif-panel').hidden = true; } });

  function confirmBox(title, text, okLabel, onOk, danger) {
    const m = modal({
      title, body: `<p class="muted">${text}</p>`,
      foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="ok">${okLabel}</button>`
    });
    $('#ok', m).onclick = () => { closeModal(); onOk(); };
  }

  function spend(n, reason) {
    const u = me();
    if (u.tokens < n) { noTokens(n); return false; }
    u.tokens -= n;
    S.tokenLog.unshift({ userId: u.id, delta: -n, reason, t: Date.now() });
    return true;
  }
  function noTokens(n) {
    modal({
      title: 'Yetersiz jeton',
      body: `<div class="summary"><div><span>Gereken</span>${coinTxt(n)}</div><div><span>Bakiyen</span>${coinTxt(me().tokens)}</div></div>
             <p class="muted small">Jetonlar süresizdir; yeni iletişim başlatmak, sosyal bağlantı açmak ve ilan vermek için kullanılır.</p>`,
      foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><a class="btn btn-primary" href="#/jeton" data-close>${icon('coin')} Jeton Al</a>`
    });
  }

  const pickFile = accept => new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
    i.onchange = () => res(i.files[0]); i.click();
  });
  const readImage = (file, max = 720) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = rej; img.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });

  function locked(title, text, href, cta) {
    return `<div class="locked"><div class="lock-ic">${icon('lock', 'ic-lg')}</div><h3>${title}</h3><p>${text}</p><a class="btn btn-primary btn-lg" href="${href}">${cta}</a></div>`;
  }

  /* ---------- Router ---------- */
  const NAV = [
    { r: 'harita', t: 'Harita', i: 'map' },
    { r: 'kesfet', t: 'Keşfet', i: 'compass' },
    { r: 'ilanlar', t: 'İlanlar', i: 'megaphone' },
    { r: 'mesajlar', t: 'Mesajlar', i: 'message' },
    { r: 'profil', t: 'Profil', i: 'user' },
    { r: 'ayarlar', t: 'Ayarlar', i: 'settings', desktopOnly: true }
  ];
  const TITLES = { harita: 'Harita', kesfet: 'Keşfet', ilanlar: 'İlanlar', mesajlar: 'Mesajlar', profil: 'Profilim', u: 'Profil', ayarlar: 'Ayarlar', jeton: 'Jeton Mağazası', abonelik: 'Abonelik' };

  function parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'harita';
    const [path, q = ''] = h.split('?');
    const seg = path.split('/');
    return { name: VIEWS[seg[0]] ? seg[0] : 'harita', arg: seg[1], q: new URLSearchParams(q) };
  }

  let cleanup = null;
  let lastRoute = '';
  function render(soft) {
    if (cleanup) { cleanup(); cleanup = null; }
    const R = parse();
    const view = $('#view');
    view.className = 'view' + (soft ? ' no-anim' : '');
    if (!soft) { void view.offsetWidth; }
    const y = window.scrollY;
    view.innerHTML = '';
    VIEWS[R.name](view, R);
    chrome(R);
    const key = location.hash;
    if (soft && key === lastRoute) window.scrollTo(0, y); else window.scrollTo(0, 0);
    lastRoute = key;
  }
  const refresh = () => render(true);

  function chrome(R) {
    const u = me();
    const reqCount = incoming().length;
    const navHtml = (mobile) => NAV.filter(n => !(mobile && n.desktopOnly)).map(n => {
      const on = R.name === n.r || (n.r === 'profil' && R.name === 'u');
      const badge = n.r === 'mesajlar' && reqCount ? `<span class="count">${reqCount}</span>` : '';
      return mobile
        ? `<a href="#/${n.r}" class="${on ? 'on' : ''}">${icon(n.i)}${n.t}${badge}</a>`
        : `<a href="#/${n.r}" class="nav-link ${on ? 'on' : ''}">${icon(n.i)}<span>${n.t}</span>${badge}</a>`;
    }).join('');
    $('#side-nav').innerHTML = navHtml(false);
    $('#bottom-nav').innerHTML = navHtml(true);
    $('#page-title').innerHTML = TITLES[R.name] || '';
    $('#token-pill').innerHTML = `<span class="coin">${icon('coin')}</span>${u.tokens}`;
    $('#me-avatar').innerHTML = `<img src="${esc(u.photo)}" alt="${esc(u.name)}">`;
    $('#bell').innerHTML = icon('bell') + `<span class="dot ${S.notifications.some(n => n.to === u.id && !n.read) ? 'on' : ''}"></span>`;
    $$('[data-role]').forEach(b => b.classList.toggle('on', b.dataset.role === S.role));
    const p = plan(u);
    $('#side-card').innerHTML = u.plan === 'free'
      ? `<span class="eyebrow">${u.role === 'fan' ? 'Free plan' : 'Free Creator'}</span><h4>${u.role === 'fan' ? 'Creator\'ların keşfinde görün' : 'Haritada fanlara görün'}</h4>
         <p class="small muted">${u.role === 'fan' ? 'Premium ile günde 30 profil, haritada 50 kişi ve her ay 150 jeton.' : 'Plus Creator ile harita, öne çıkan alan ve 2× görünürlük.'}</p>
         <a class="btn btn-primary btn-sm" href="#/abonelik">${icon('crown', 'ic-sm')} Planları Gör</a>`
      : `<span class="eyebrow">Aktif plan</span><h4>${p.name}</h4><div class="row between small"><span class="muted">Jeton bakiyesi</span>${coinTxt(u.tokens)}</div>
         <a class="btn btn-ghost btn-sm" href="#/jeton">Jeton Al</a>`;
  }

  /* ---------- Bildirimler ---------- */
  function renderNotifs() {
    const list = S.notifications.filter(n => n.to === meId());
    const map = { alert: 'alert', mail: 'mail', check: 'check', bell: 'bell', coin: 'coin', award: 'award', x: 'x' };
    $('#notif-panel').innerHTML = `<div class="notif-head"><h4>Bildirimler</h4><button class="btn btn-sm btn-ghost" id="read-all">Tümünü okundu say</button></div>
      ${list.length ? list.map(n => `<a class="notif ${n.read ? '' : 'unread'}" href="${n.link || '#'}" data-notif="${n.id}">
        <span class="notif-ic">${icon(map[n.icon] || 'bell')}</span><div class="grow"><div class="small">${esc(n.text)}</div><div class="xs muted">${ago(n.t)}</div></div></a>`).join('')
      : `<div class="empty">${icon('bell')}<p>Henüz bildirim yok.</p></div>`}`;
  }
  $('#bell').addEventListener('click', e => {
    e.stopPropagation();
    const p = $('#notif-panel');
    p.hidden = !p.hidden;
    if (!p.hidden) renderNotifs();
  });
  $('#notif-panel').addEventListener('click', e => {
    if (e.target.closest('#read-all')) {
      S.notifications.forEach(n => { if (n.to === meId()) n.read = true; });
      save(); renderNotifs(); chrome(parse()); return;
    }
    const a = e.target.closest('[data-notif]');
    if (a) {
      const n = S.notifications.find(x => x.id === a.dataset.notif);
      if (n) n.read = true;
      save(); $('#notif-panel').hidden = true;
      if (!n?.link) e.preventDefault();
      if (n?.link && n.link === location.hash) refresh();
    }
  });

  /* ---------- Global aksiyonlar ---------- */
  document.addEventListener('click', e => {
    const t = e.target;
    if (!t.closest('#notif-panel') && !t.closest('#bell')) $('#notif-panel').hidden = true;
    if (!t.closest('.menu') && !t.closest('[data-menu]')) $$('.menu').forEach(m => m.remove());

    const roleBtn = t.closest('[data-role]');
    if (roleBtn) {
      S.role = roleBtn.dataset.role; save();
      const R = parse();
      if (['u', 'mesajlar'].includes(R.name) && R.arg) location.hash = '#/' + (R.name === 'u' ? 'kesfet' : 'mesajlar');
      else render();
      toast(`${S.role === 'fan' ? 'Fan' : 'Creator'} görünümüne geçildi · ${me().name}`);
      return;
    }
    const req = t.closest('[data-req]');
    if (req) { e.preventDefault(); e.stopPropagation(); openRequest(req.dataset.req, req.dataset.listingReq); return; }
    const unlock = t.closest('[data-unlock]');
    if (unlock) { unlockSocial(unlock.dataset.unlock); return; }
    const rep = t.closest('[data-report]');
    if (rep) { openReport(rep.dataset.report, rep.dataset.type); return; }
    const card = t.closest('[data-listing]');
    if (card && !t.closest('a,button')) { listingDetail(card.dataset.listing); }
  });

  function switchStateFromStorage(e) {
    if (e.key !== FM.KEY) return;
    const route = parse();
    S = FM.load();
    // sohbet yazılırken ekranı sıfırlama
    const typing = document.activeElement && ['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName);
    if (typing) chrome(route); else refresh();
  }
  window.addEventListener('storage', switchStateFromStorage);

  setInterval(() => {
    $$('[data-exp]').forEach(el => {
      const exp = +el.dataset.exp;
      el.querySelector('span').textContent = left(exp);
      el.classList.toggle('soon', exp - Date.now() < 3 * H);
    });
    if (FM.expireListings(S)) { save(); if (parse().name === 'ilanlar') refresh(); }
  }, 30e3);

  /* ================= VIEWS ================= */
  const VIEWS = {};

  /* ----- Harita ----- */
  function mapTargets() {
    const u = me();
    const lim = S.role === 'fan' ? plan(u).map : 150;
    const contacted = new Set(myConvos().map(partnerId));
    const list = S.users.filter(x => x.id !== u.id && x.role === otherRole() && x.status === 'active' && x.showOnMap && !S.blocked.includes(x.id) &&
      (contacted.has(x.id) || (x.role === 'creator' ? plan(x).map : x.plan !== 'free')));
    list.sort((a, b) => prio(b) - prio(a));
    return { all: list.length, list: list.slice(0, lim), lim, contacted };
  }

  VIEWS.harita = (v) => {
    const u = me();
    if (u.role === 'creator' && !plan(u).map) {
      v.innerHTML = `<div class="section-head"><div><span class="eyebrow">Harita</span><h2>Yakınındaki <em>fanlar</em></h2></div></div>` +
        locked('Harita Plus Creator ile açılır', 'Free Creator planında harita görünürlüğü yok. Plus veya Pro+ ile haritada fanlara görün, yakınındaki fanları keşfet.', '#/abonelik', 'Planları Gör');
      return;
    }
    const T = mapTargets();
    const noun = S.role === 'fan' ? 'creator' : 'fan';
    v.innerHTML = `<div class="map-layout">
      <div class="map-box"><div id="map"></div>
        <div class="map-overlay">
          <span class="glass">${icon('pin')} ${esc(u.district)}, ${esc(u.city)}</span>
          <span class="glass">${icon('users')} ${T.list.length} ${noun}</span>
          ${u.showOnMap ? '' : `<a class="glass" href="#/ayarlar">${icon('eye')} Haritada gizlisin</a>`}
        </div>
        <div class="glass map-note">${icon('shield')} Konumlar yaklaşıktır: seçilen ilçe içinde güvenli/rastgele gösterilir. Gerçek adres ve canlı konum kullanılmaz.</div>
      </div>
      <aside class="map-side"><div class="card">
        <div class="map-side-head">
          <div class="row between"><b>${S.role === 'fan' ? 'Haritadaki creator\'lar' : 'Haritadaki fanlar'}</b><span class="chip">${T.list.length}${S.role === 'fan' ? ' / ' + T.lim : ''}</span></div>
          ${S.role === 'fan' ? `<div class="meter"><i style="width:${Math.min(100, T.list.length / T.lim * 100)}%"></i></div>
          <p class="xs muted">${plan(u).name} planında haritada en fazla <b>${T.lim}</b> kişi görünür.${u.plan !== 'pro' ? ' <a href="#/abonelik" style="color:var(--rose);font-weight:600">Limiti artır</a>' : ''}</p>`
          : `<p class="xs muted">Sadece Premium ve üzeri fanlar haritada görünür. ${plan(u).name}: harita önceliği <b>${plan(u).mapPri}</b>.</p>`}
        </div>
        <div class="people">${T.list.length ? T.list.map(x => `<button class="person" data-fly="${x.id}">${avatar(x, 48)}
          <div class="grow"><b>${esc(x.name)}</b> ${vb(x)}<div class="xs muted">${x.age} · ${esc(x.district)}${T.contacted.has(x.id) ? ' · <span style="color:var(--plum)">iletişimde</span>' : ''}</div></div>${planChip(x)}</button>`).join('')
          : `<div class="empty">${icon('map')}<p>Şu an haritada kimse yok.</p></div>`}</div>
      </div></aside></div>`;

    if (!window.L) {
      $('#map').innerHTML = `<div class="empty" style="height:100%;align-content:center">${icon('map')}<h4>Harita yüklenemedi</h4><p>Harita katmanı için internet bağlantısı gerekir.</p></div>`;
      return;
    }
    const map = L.map('map', { zoomControl: false, minZoom: 9, maxZoom: 16 }).setView([41.03, 29.0], 11);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 19
    }).addTo(map);
    if (u.showOnMap) {
      L.circle(u.pos, { radius: 1100, color: '#7A3BD0', weight: 1, fillColor: '#7A3BD0', fillOpacity: .06, dashArray: '4 6' }).addTo(map);
      L.marker(u.pos, { icon: L.divIcon({ className: '', html: '<div class="mk-me"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 1000 })
        .addTo(map).bindTooltip('Sen (yaklaşık bölge)', { direction: 'top', offset: [0, -10] });
    }
    const markers = {};
    T.list.forEach(x => {
      const cls = x.plan === 'pro' ? 'pro' : (x.plan !== 'free' ? 'pri' : '');
      const ic = L.divIcon({
        className: '', iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -24],
        html: `<div class="mk ${cls}"><img src="${esc(x.photo)}" alt="">${isVerified(x) ? `<span class="mk-badge">${icon('verified', 'vbadge')}</span>` : ''}</div>`
      });
      const photo = (x.photos.find(p => p.status === 'approved' && p.url !== x.photo) || {}).url || x.photo;
      markers[x.id] = L.marker(x.pos, { icon: ic, zIndexOffset: prio(x) * 10 }).addTo(map).bindPopup(`<div class="pop"><img src="${esc(photo)}" alt="">
        <div class="pop-body"><h4>${esc(x.name)}, ${x.age} ${vb(x)}</h4>
        <div class="row wrap" style="gap:4px">${roleChip(x)}${planChip(x)}${isActive(x) ? '<span class="chip chip-green">Aktif</span>' : ''}</div>
        <div class="xs muted row" style="gap:4px">${icon('pin', 'ic-sm')} ${esc(x.district)} civarı</div>
        <div class="row"><a class="btn btn-ghost btn-sm grow" href="#/u/${x.id}">Profil</a><button class="btn btn-primary btn-sm grow" data-req="${x.id}">${icon('send', 'ic-sm')} Mesaj</button></div></div></div>`);
    });
    $$('[data-fly]', v).forEach(b => b.addEventListener('click', () => {
      const m = markers[b.dataset.fly];
      map.flyTo(m.getLatLng(), 14, { duration: .8 });
      setTimeout(() => m.openPopup(), 850);
      if (window.innerWidth < 860) $('.map-box').scrollIntoView({ behavior: 'smooth' });
    }));
    setTimeout(() => map.invalidateSize(), 60);
    cleanup = () => map.remove();
  };

  /* ----- Keşfet ----- */
  function discoverState() {
    const day = new Date().toDateString();
    let D = S.discover[meId()];
    if (!D || D.day !== day) D = S.discover[meId()] = { day, seen: [] };
    return D;
  }
  function discoverPool() {
    const D = discoverState();
    return S.users.filter(x => x.role === otherRole() && x.status === 'active' && !S.blocked.includes(x.id) &&
      (x.role === 'creator' || x.plan !== 'free') && !D.seen.includes(x.id)).sort((a, b) => prio(b) - prio(a));
  }
  function markSeen(id) {
    const D = discoverState();
    if (!D.seen.includes(id)) D.seen.push(id);
    save();
  }

  VIEWS.kesfet = (v) => {
    const u = me(), p = plan(u);
    const limit = S.role === 'fan' ? p.discover : 60;
    const D = discoverState();
    const remaining = Math.max(0, limit - D.seen.length);
    const pool = discoverPool();
    const noun = S.role === 'fan' ? 'creator' : 'fan';
    let deck;
    if (!remaining) {
      deck = locked('Bugünlük keşif hakkın doldu', `${p.name} planında günde ${limit} profil keşfedebilirsin. Hakların gece yarısı yenilenir.`, '#/abonelik', 'Limiti Artır');
    } else if (!pool.length) {
      deck = `<div class="locked"><div class="lock-ic">${icon('sparkle', 'ic-lg')}</div><h3>Şimdilik herkesi gördün</h3>
        <p>Yeni ${noun}lar katıldıkça burada görünecek. Bu arada ilanlara göz at.</p>
        <div class="row wrap" style="justify-content:center"><a class="btn btn-primary" href="#/ilanlar">İlanlara Git</a><button class="btn btn-ghost" id="restart">Demo: Baştan Başla</button></div></div>`;
    } else {
      const cards = pool.slice(0, 3).map((x, i) => {
        const photos = x.photos.filter(ph => ph.status === 'approved');
        return `<div class="deck-card ${i === 1 ? 'behind' : i === 2 ? 'behind2' : ''}" data-id="${x.id}" data-i="0" style="z-index:${3 - i}">
          <img src="${esc(photos[0]?.url || x.photo)}" alt="${esc(x.name)}" draggable="false">
          ${photos.length > 1 ? `<div class="deck-dots">${photos.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>` : ''}
          <div class="deck-top">${roleChip(x)}${planChip(x)}${isActive(x) ? '<span class="chip chip-green">● Son zamanlarda aktif</span>' : ''}</div>
          <button class="deck-tap l" aria-label="Önceki fotoğraf"></button><button class="deck-tap r" aria-label="Sonraki fotoğraf"></button>
          <span class="stamp pass">GEÇ</span><span class="stamp view">PROFİL</span>
          <div class="deck-info"><h3>${esc(x.name)} <span>${x.age}</span> ${vb(x)}</h3>
            <div class="row small" style="opacity:.9">${icon('pin', 'ic-sm')} ${esc(x.district)}, ${esc(x.city)}</div>
            <p>${esc(x.bio)}</p>
            ${x.tags.length ? `<div class="tags">${x.tags.slice(0, 2).map(t => `<span class="chip chip-rose">${icon('star')}${esc(t)}</span>`).join('')}</div>` : ''}
          </div></div>`;
      }).reverse().join('');
      deck = `<div class="deck" id="deck">${cards}</div>
        <div class="deck-actions">
          <button class="round pass" id="d-pass" aria-label="Geç">${icon('x', 'ic-lg')}</button>
          <button class="round big" id="d-msg" aria-label="Mesaj isteği">${icon('send')}</button>
          <button class="round" id="d-view" aria-label="Profili gör" style="color:var(--plum)">${icon('user', 'ic-lg')}</button>
        </div>
        <p class="xs muted" style="text-align:center;margin-top:12px">Sola kaydır: geç · Sağa kaydır: profili gör</p>`;
    }

    v.innerHTML = `<div class="section-head"><div><span class="eyebrow">Keşfet</span><h2>${S.role === 'fan' ? 'Bugün tanışabileceğin <em>creator</em>\'lar' : 'Seni keşfetmeye hazır <em>fanlar</em>'}</h2></div></div>
      <div class="discover"><div>${deck}</div>
      <div class="discover-side">
        <div class="card card-pad quota">
          <span class="eyebrow">Günlük keşif</span>
          <div class="quota-num">${remaining}<small> / ${limit} profil kaldı</small></div>
          <div class="meter"><i style="width:${(remaining / limit) * 100}%"></i></div>
          <p class="xs muted">Haklar her gece 00:00'da yenilenir.${S.role === 'fan' && u.plan !== 'pro' ? ` <a href="#/abonelik" style="color:var(--rose);font-weight:600">Daha fazla profil</a>` : ''}</p>
        </div>
        <div class="card card-pad">
          <div class="block-title"><h3>Nasıl çalışır?</h3></div>
          <ul class="rules">
            <li>${icon('compass')}<span>Keşfet iki yönlüdür: Fan'lar creator'ları, creator'lar ise fanları keşfeder.</span></li>
            <li>${icon('shield')}<span>Creator'ların keşfinde yalnızca <b>Premium ve üzeri</b> planı olan fanlar görünür.</span></li>
            <li>${icon('send')}<span>Beğeni ya da eşleşme yok. Mesaj isteği gönderirsin (${cfg().requestCost} jeton); kabul edilirse sohbet ücretsizdir.</span></li>
            <li>${icon('sparkle')}<span>Plus ve Pro+ planlar keşifte önceliklidir.</span></li>
          </ul>
        </div>
        ${S.role === 'fan' && u.plan === 'free' ? `<div class="card card-pad" style="background:var(--grad-soft)"><span class="eyebrow">Free plandasın</span>
          <p style="margin:8px 0 14px">Creator'ların keşif ekranında görünmek için Premium veya üzeri bir plana geç.</p><a class="btn btn-primary btn-sm" href="#/abonelik">Planları Gör</a></div>` : ''}
      </div></div>`;

    $('#restart', v)?.addEventListener('click', () => { S.discover[meId()] = null; save(); refresh(); });
    const deckEl = $('#deck', v);
    if (!deckEl) return;
    const top = () => deckEl.lastElementChild;

    function fling(dir, then) {
      const c = top();
      c.style.transition = 'transform .4s var(--ease), opacity .4s';
      c.style.transform = `translateX(${dir * 130}%) rotate(${dir * 18}deg)`;
      c.style.opacity = '0';
      setTimeout(then, 280);
    }
    $('#d-pass', v).onclick = () => { const id = top().dataset.id; fling(-1, () => { markSeen(id); refresh(); }); };
    $('#d-view', v).onclick = () => { const id = top().dataset.id; fling(1, () => { markSeen(id); location.hash = '#/u/' + id; }); };
    $('#d-msg', v).onclick = () => openRequest(top().dataset.id, null, () => markSeen(top().dataset.id));

    // Fotoğraflar arası geçiş
    $$('.deck-tap', v).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const c = b.closest('.deck-card');
      const x = user(c.dataset.id);
      const photos = x.photos.filter(ph => ph.status === 'approved');
      if (photos.length < 2) return;
      let i = +c.dataset.i + (b.classList.contains('r') ? 1 : -1);
      i = (i + photos.length) % photos.length;
      c.dataset.i = i;
      c.querySelector(':scope > img').src = photos[i].url;
      $$('.deck-dots i', c).forEach((d, k) => d.classList.toggle('on', k === i));
    }));

    // Kaydırma
    let sx = 0, dx = 0, drag = false;
    deckEl.addEventListener('pointerdown', e => {
      if (!e.target.closest('.deck-card') || e.target.closest('.deck-card') !== top()) return;
      drag = true; sx = e.clientX; dx = 0; top().style.transition = 'none';
    });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    function onMove(e) {
      if (!drag) return;
      dx = e.clientX - sx;
      const c = top();
      c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      c.querySelector('.stamp.pass').style.opacity = Math.min(1, -dx / 90);
      c.querySelector('.stamp.view').style.opacity = Math.min(1, dx / 90);
    }
    function onUp() {
      if (!drag) return;
      drag = false;
      const c = top();
      if (dx < -110) $('#d-pass', v).click();
      else if (dx > 110) $('#d-view', v).click();
      else {
        c.style.transition = 'transform .3s var(--ease)'; c.style.transform = '';
        $$('.stamp', c).forEach(s => { s.style.opacity = 0; });
      }
    }
    cleanup = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  };

  /* ----- İlanlar ----- */
  const LS = { q: '', sort: 'new' };
  const STATUS = {
    pending: ['chip-amber', 'Admin İncelemesi Bekliyor'], approved: ['chip-green', 'Yayında'], rejected: ['chip-red', 'Reddedildi'],
    revision: ['chip-amber', 'Düzeltme İstendi'], expired: ['', 'Süresi Doldu'], removed: ['chip-red', 'Yayından Kaldırıldı']
  };
  const activeListings = () => S.listings.filter(l => l.status === 'approved' && l.expiresAt > Date.now() && !S.blocked.includes(l.ownerId));

  function lcard(l) {
    const o = user(l.ownerId);
    const own = o.id === meId();
    const soon = l.expiresAt - Date.now() < 3 * H;
    return `<article class="lcard ${o.role}" data-listing="${l.id}" tabindex="0">
      <div class="row between" style="align-items:flex-start">
        <div class="lcard-owner">${avatar(o, 40)}<div><b>${esc(o.name)}</b> ${vb(o)}<div class="row" style="gap:4px;margin-top:3px">${roleChip(o)}${planChip(o)}</div></div></div>
        <span class="timer ${soon ? 'soon' : ''}" data-exp="${l.expiresAt}">${icon('clock')}<span>${left(l.expiresAt)}</span></span>
      </div>
      <h3>${esc(l.title)}</h3>
      <p class="desc">${esc(l.desc)}</p>
      <div class="lmeta"><span>${icon('pin')}${esc(l.district)}, ${esc(l.city)}</span><span>${icon('message')}${l.requests} talep</span><span>${icon('eye')}${l.views}</span></div>
      <div class="lcard-foot">${own ? '<span class="chip chip-plum">Senin ilanın</span>'
        : `<button class="btn btn-primary btn-sm" data-req="${o.id}" data-listing-req="${l.id}">${icon('send', 'ic-sm')} Mesaj Gönder</button><a class="btn btn-ghost btn-sm" href="#/u/${o.id}">Profili Gör</a>`}</div>
    </article>`;
  }

  function listingGrid() {
    const q = trLower(LS.q.trim());
    let list = activeListings().filter(l => !q || trLower(l.title + ' ' + l.desc).includes(q));
    const sorts = {
      new: (a, b) => b.approvedAt - a.approvedAt,
      req: (a, b) => b.requests - a.requests,
      soon: (a, b) => a.expiresAt - b.expiresAt,
      pop: (a, b) => (b.views + b.requests * 4) - (a.views + a.requests * 4)
    };
    list.sort(sorts[LS.sort]);
    return list.length ? list.map(lcard).join('')
      : `<div class="empty" style="grid-column:1/-1">${icon('search')}<h4>Sonuç bulunamadı</h4><p>Başka bir kelimeyle aramayı dene.</p></div>`;
  }

  function myListingLimits() {
    const mine = S.listings.filter(l => l.ownerId === meId());
    const recent = mine.filter(l => l.createdAt > Date.now() - 24 * H);
    const last = Math.max(0, ...mine.map(l => l.createdAt));
    const waitMin = Math.ceil((last + cfg().listingCooldownMin * 60e3 - Date.now()) / 60e3);
    return { used: recent.length, max: cfg().dailyListingLimit, waitMin };
  }

  VIEWS.ilanlar = (v, R) => {
    const tab = R.q.get('tab') || 'all';
    const mine = S.listings.filter(l => l.ownerId === meId()).sort((a, b) => b.createdAt - a.createdAt);
    const lim = myListingLimits();
    let body;
    if (tab === 'mine') {
      body = `<div class="card card-pad" style="margin-bottom:16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <div class="grow"><b>24 saatlik ilan hakkın</b><div class="meter" style="margin:8px 0 6px"><i style="width:${lim.used / lim.max * 100}%"></i></div>
          <span class="xs muted">${lim.used} / ${lim.max} kullanıldı · İlanlar yayından önce admin onayından geçer · Reddedilen ilanın jetonu iade edilir</span></div>
        </div>
        <div class="mine-list">${mine.length ? mine.map(l => {
          const [cls, label] = STATUS[l.status];
          return `<div class="card mine"><div class="grow">
            <div class="row wrap" style="margin-bottom:6px"><span class="chip ${cls}">${label}</span><span class="xs muted">${l.hours} saat · ${l.cost} jeton · ${ago(l.createdAt)}</span></div>
            <h4>${esc(l.title)}</h4>
            <div class="lmeta" style="margin-top:6px">${l.status === 'approved' ? `<span class="timer" data-exp="${l.expiresAt}">${icon('clock')}<span>${left(l.expiresAt)}</span></span>` : ''}
              <span>${icon('eye')}${l.views} görüntülenme</span><span>${icon('message')}${l.requests} talep</span><span>${icon('pin')}${esc(l.district)}</span></div>
            ${l.note && ['revision', 'rejected', 'removed'].includes(l.status) ? `<div class="admin-note">${icon('alert')}<div><b>Admin notu:</b> ${esc(l.note)}${l.status === 'rejected' && l.refunded ? '<br><span class="xs">Jetonların iade edildi.</span>' : ''}</div></div>` : ''}
          </div>
          <div>${l.status === 'revision' ? `<button class="btn btn-primary btn-sm" data-edit="${l.id}">${icon('edit', 'ic-sm')} Düzenle ve Gönder</button>` : ''}</div></div>`;
        }).join('') : `<div class="empty card">${icon('megaphone')}<h4>Henüz ilanın yok</h4><p>İlk ilanını oluştur; admin onayından sonra yayına girer.</p></div>`}</div>`;
    } else {
      body = `<div class="toolbar">
          <label class="search">${icon('search')}<input class="input" id="lsearch" placeholder="İlan başlığı veya açıklamasında ara…" value="${esc(LS.q)}"></label>
          <select class="select" id="lsort" aria-label="Sıralama">
            ${[['new', 'En Yeni'], ['req', 'En Fazla Talep Gören'], ['soon', 'Süresi Yaklaşan'], ['pop', 'Popüler']].map(([k, t]) => `<option value="${k}" ${LS.sort === k ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="listings" id="lgrid">${listingGrid()}</div>`;
    }
    v.innerHTML = `<div class="section-head"><div><span class="eyebrow">İlanlar</span><h2>Süreli, <em>onaylı</em> buluşma ilanları</h2>
        <p>Fan'lar ve creator'lar belirli bir plan için 12–48 saatlik ilan yayınlar. Her ilan admin onayından geçer.</p></div>
        <button class="btn btn-primary btn-lg" id="new-listing">${icon('plus')} İlan Oluştur</button></div>
      <div class="row between wrap" style="margin-bottom:18px"><div class="seg">
        <button class="${tab === 'all' ? 'on' : ''}" data-tab="all">Tüm İlanlar <span class="chip" style="height:20px">${activeListings().length}</span></button>
        <button class="${tab === 'mine' ? 'on' : ''}" data-tab="mine">İlanlarım ${mine.some(l => l.status === 'revision') ? '<span class="count">!</span>' : ''}</button>
      </div></div>${body}`;

    $$('[data-tab]', v).forEach(b => b.onclick = () => { location.hash = '#/ilanlar' + (b.dataset.tab === 'mine' ? '?tab=mine' : ''); });
    $('#new-listing', v).onclick = () => listingForm();
    $$('[data-edit]', v).forEach(b => b.onclick = () => listingForm(S.listings.find(l => l.id === b.dataset.edit)));
    const s = $('#lsearch', v);
    if (s) {
      s.oninput = () => { LS.q = s.value; $('#lgrid').innerHTML = listingGrid(); };
      $('#lsort', v).onchange = e => { LS.sort = e.target.value; $('#lgrid').innerHTML = listingGrid(); };
    }
  };
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('.lcard')) listingDetail(e.target.dataset.listing); });

  function locationSelects(city, district) {
    const cities = Object.keys(FM.LOCATIONS['Türkiye']);
    return `<div class="grid-3">
      <label class="field"><span>Ülke</span><select class="select" name="country"><option>Türkiye</option></select></label>
      <label class="field"><span>Şehir</span><select class="select" name="city">${cities.map(c => `<option ${c === city ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="field"><span>İlçe</span><select class="select" name="district">${Object.keys(FM.LOCATIONS['Türkiye'][city] || {}).map(d => `<option ${d === district ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>`;
  }
  function bindLocation(root) {
    const c = $('[name=city]', root), d = $('[name=district]', root);
    c.onchange = () => { d.innerHTML = Object.keys(FM.LOCATIONS['Türkiye'][c.value]).map(x => `<option>${x}</option>`).join(''); };
  }

  function listingForm(existing) {
    const u = me();
    if (!existing) {
      const lim = myListingLimits();
      if (lim.used >= lim.max) return toast(`24 saat içinde en fazla ${lim.max} ilan oluşturabilirsin.`, true);
      if (lim.waitMin > 0) return toast(`Yeni ilan için ${lim.waitMin} dk beklemelisin (saatte 1 ilan).`, true);
    }
    const d0 = existing ? existing.hours : 24;
    const m = modal({
      title: existing ? 'İlanı düzenle' : 'Yeni ilan oluştur',
      sub: existing ? 'Düzeltilen ilan ek ücret alınmadan tekrar admin incelemesine gönderilir.' : 'Başlık, açıklama ve süreyi belirle. İlan anında yayınlanmaz; admin onayından sonra yayına girer.',
      wide: true,
      body: `<div class="steps"><i class="on"></i><i></i><i></i></div>
        ${existing?.note ? `<div class="admin-note">${icon('alert')}<div><b>Admin notu:</b> ${esc(existing.note)}</div></div>` : ''}
        <label class="field"><span>İlan başlığı</span><input class="input" name="title" maxlength="80" placeholder="Örn. Bugün Moda'da kahve turu" value="${esc(existing?.title || '')}"><span class="counter" data-for="title"></span></label>
        <label class="field"><span>İlan açıklaması <b style="color:var(--rose)">*</b></span><textarea class="textarea" name="desc" maxlength="500" placeholder="Buluşmanın amacı, zamanı ve yeri hakkında net bilgi ver.">${esc(existing?.desc || '')}</textarea><span class="counter" data-for="desc"></span></label>
        ${locationSelects(existing?.city || u.city, existing?.district || u.district)}
        ${existing ? '' : `<div class="field"><span>İlan süresi</span><div class="dur-opts">${cfg().durations.map(d => `<div class="dur"><input type="radio" name="dur" id="d${d.h}" value="${d.h}" ${d.h === d0 ? 'checked' : ''}><label for="d${d.h}"><b>${d.h}</b><span class="small">saat</span><span class="xs muted">${d.cost} jeton</span></label></div>`).join('')}</div></div>
        <div class="summary" id="sum"></div>`}
        <p class="hint">Yasa dışı, dolandırıcılık, taciz, spam veya yanıltıcı içerik barındıran ilanlar reddedilir. Hiçbir ilan admin onayı olmadan yayınlanmaz.</p>`,
      foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><button class="btn btn-primary" id="submit">${existing ? 'Tekrar Gönder' : 'Devam Et'}</button>`
    });
    bindLocation(m);
    const counters = () => $$('[data-for]', m).forEach(c => { const f = $(`[name=${c.dataset.for}]`, m); c.textContent = `${f.value.length} / ${f.maxLength}`; });
    const sum = () => {
      if (existing) return;
      const d = cfg().durations.find(x => x.h === +$('[name=dur]:checked', m).value);
      const ok = u.tokens >= d.cost;
      $('#sum', m).innerHTML = `<div><span>İlan süresi</span><b>${d.h} saat</b></div><div><span>Jeton maliyeti</span>${coinTxt(d.cost)}</div>
        <div><span>Mevcut bakiye</span>${coinTxt(u.tokens)}</div>
        <div class="total"><span>İşlem sonrası</span><span style="color:${ok ? 'inherit' : 'var(--red)'}">${ok ? coinTxt(u.tokens - d.cost) : 'Yetersiz bakiye'}</span></div>`;
    };
    m.addEventListener('input', () => { counters(); sum(); });
    counters(); sum();

    $('#submit', m).onclick = () => {
      const title = $('[name=title]', m).value.trim();
      const desc = $('[name=desc]', m).value.trim();
      const city = $('[name=city]', m).value, district = $('[name=district]', m).value;
      if (title.length < 5) return toast('Başlık en az 5 karakter olmalı.', true);
      if (desc.length < 20) return toast('Açıklama en az 20 karakter olmalı.', true);
      if (existing) {
        Object.assign(existing, { title, desc, city, district, status: 'pending', note: '', createdAt: existing.createdAt });
        existing.history.push({ t: Date.now(), action: 'Kullanıcı düzeltip tekrar gönderdi' });
        FM.notify(S, u.id, `"${title}" ilanın tekrar admin incelemesine gönderildi.`, 'mail', '#/ilanlar?tab=mine');
        save(); closeModal(); refresh(); toast('İlan tekrar incelemeye gönderildi.');
        return;
      }
      const d = cfg().durations.find(x => x.h === +$('[name=dur]:checked', m).value);
      // Adım 2: onay
      const c = modal({
        title: 'Onayla',
        body: `<div class="steps"><i class="on"></i><i class="on"></i><i></i></div>
          <div class="ldetail-owner"><div class="grow"><b>${esc(title)}</b><div class="xs muted">${d.h} saat · ${esc(district)}, ${esc(city)}</div></div>${coinTxt(d.cost)}</div>
          <ol class="flow"><li class="on">Jeton kullanılır (${d.cost})</li><li>İlan "Admin İncelemesi Bekliyor" durumuna geçer</li><li>Admin onaylarsa ${d.h} saat yayında kalır</li><li>Reddedilirse jetonların iade edilir</li></ol>`,
        foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><button class="btn btn-primary" id="pay">${icon('coin', 'ic-sm')} ${d.cost} jeton kullan ve gönder</button>`
      });
      $('#pay', c).onclick = () => {
        if (!spend(d.cost, `İlan (${d.h} saat)`)) return;
        const l = {
          id: FM.uid('l'), ownerId: u.id, title, desc, hours: d.h, cost: d.cost, city, district, status: 'pending',
          createdAt: Date.now(), approvedAt: null, expiresAt: null, views: 0, requests: 0, clicks: 0, note: '', history: [{ t: Date.now(), action: 'Oluşturuldu' }]
        };
        S.listings.unshift(l);
        FM.notify(S, u.id, `"${title}" ilanın admin incelemesine gönderildi.`, 'mail', '#/ilanlar?tab=mine');
        save();
        modal({
          body: `<div class="fanvue"><div class="steps" style="width:100%"><i class="on"></i><i class="on"></i><i class="on"></i></div>
            <div class="success-ic">${icon('check')}</div><h3 class="serif" style="font-size:26px">İlanın incelemeye gönderildi</h3>
            <p class="muted">Admin onayladığında yayına girer ve sana site içi bildirim + e-posta gönderilir.</p>
            <a class="btn btn-ghost btn-sm" href="admin.html#/ilan-talepleri" target="_blank">Demo: Admin panelinde onayla ↗</a></div>`,
          foot: `<a class="btn btn-primary btn-block" href="#/ilanlar?tab=mine" data-close>İlanlarıma Git</a>`
        });
        chrome(parse());
        if (location.hash === '#/ilanlar?tab=mine') refresh();
      };
    };
  }

  function listingDetail(id) {
    const l = S.listings.find(x => x.id === id);
    if (!l) return;
    const o = user(l.ownerId);
    const own = o.id === meId();
    if (!own) { l.views++; save(); }
    modal({
      wide: true,
      title: esc(l.title),
      sub: `${l.hours} saatlik ilan · ${ago(l.approvedAt || l.createdAt)} yayınlandı`,
      body: `<div class="ldetail-owner">${avatar(o, 56)}<div class="grow"><b>${esc(o.name)}, ${o.age}</b> ${vb(o)}
          <div class="row wrap" style="gap:4px;margin-top:4px">${roleChip(o)}${planChip(o)}</div></div>
          <a class="btn btn-ghost btn-sm" href="#/u/${o.id}" data-close>Profili Gör</a></div>
        <p style="font-size:16px;line-height:1.6">${esc(l.desc)}</p>
        <div class="lmeta"><span class="timer" data-exp="${l.expiresAt}">${icon('clock')}<span>${left(l.expiresAt)}</span></span>
          <span>${icon('pin')}${esc(l.district)}, ${esc(l.city)}</span><span>${icon('message')}${l.requests} talep</span><span>${icon('eye')}${l.views} görüntülenme</span></div>
        ${own ? '' : `<p class="hint">${convoWith(o.id) ? 'Bu kişiyle zaten bir sohbetin var, mesaj göndermek ücretsiz.' : `Mesaj isteği ${cfg().requestCost} jetondur. İstek, ${esc(o.name.split(' ')[0])} kişisinin Mesajlar → İstekler bölümüne düşer.`}</p>`}`,
      foot: own ? `<button class="btn btn-ghost" data-close>Kapat</button>` :
        `<button class="btn btn-ghost" data-report="${l.id}" data-type="İlan">${icon('flag', 'ic-sm')} Raporla</button><button class="btn btn-primary" data-req="${o.id}" data-listing-req="${l.id}">${icon('send', 'ic-sm')} Mesaj Gönder</button>`
    });
    if (parse().name === 'ilanlar') { const card = $(`[data-listing="${id}"] .lmeta span:nth-child(3)`); if (card) card.innerHTML = icon('eye') + l.views; }
  }

  /* ----- Mesaj isteği ----- */
  function openRequest(targetId, listingId, onSent) {
    const t = user(targetId), u = me();
    if (!t) return;
    const ex = convoWith(targetId);
    if (ex) { closeModal(); location.hash = '#/mesajlar/' + ex.id; return; }
    if (S.requests.some(r => r.from === u.id && r.to === targetId && r.status === 'pending')) {
      return toast(`${esc(t.name)} kişisine zaten bekleyen bir isteğin var.`, true);
    }
    const inc = S.requests.find(r => r.from === targetId && r.to === u.id && r.status === 'pending');
    if (inc) { closeModal(); location.hash = '#/mesajlar?tab=requests'; return toast('Bu kişinin sana gönderdiği bir istek var, oradan kabul edebilirsin.'); }
    const p = plan(u);
    const listing = listingId && S.listings.find(l => l.id === listingId);
    if (listing) { listing.clicks = (listing.clicks || 0) + 1; save(); }
    if (u.role === 'fan' && p.monthlyRequests) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const used = S.requests.filter(r => r.from === u.id && r.t >= +monthStart).length;
      if (used >= p.monthlyRequests) {
        return modal({
          title: 'Aylık istek hakkın doldu',
          body: `<p class="muted">Free planda ayda <b>${p.monthlyRequests}</b> mesaj isteği gönderebilirsin. Premium ve üzeri planlarda istek sayısı sınırsızdır (her istek ${cfg().requestCost} jeton).</p>`,
          foot: `<button class="btn btn-ghost" data-close>Kapat</button><a class="btn btn-primary" href="#/abonelik" data-close>Planları Gör</a>`
        });
      }
    }
    const cost = cfg().requestCost;
    const m = modal({
      title: 'Mesaj isteği gönder',
      sub: listing ? `İlan: “${esc(listing.title)}”` : 'Yeni bir iletişim başlat',
      body: `<div class="ldetail-owner">${avatar(t, 48)}<div class="grow"><b>${esc(t.name)}, ${t.age}</b> ${vb(t)}<div class="xs muted">${esc(t.district)} · ${t.role === 'creator' ? 'Creator' : 'Fan'}</div></div>${planChip(t)}</div>
        <label class="field"><span>Mesajın</span><textarea class="textarea" id="rq-text" maxlength="400" placeholder="Kendini kısaca tanıt ve neden yazdığını belirt…">${listing ? `Merhaba! "${esc(listing.title)}" ilanını gördüm, ` : ''}</textarea></label>
        <ol class="flow"><li class="on">İstek gönderilir (${cost} jeton)</li><li>${esc(t.name.split(' ')[0])} kişisinin Mesajlar → İstekler bölümüne düşer</li><li>Kabul edilirse sohbet başlar; sonrası ücretsiz</li></ol>
        <div class="summary"><div><span>İstek ücreti</span>${coinTxt(cost)}</div><div class="total"><span>Bakiyen</span>${coinTxt(u.tokens)}</div></div>
        ${u.role === 'fan' && p.monthlyRequests ? `<p class="hint">Free plan: ayda ${p.monthlyRequests} istek hakkı.</p>` : ''}`,
      foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><button class="btn btn-primary" id="rq-send">${icon('send', 'ic-sm')} Gönder · ${cost} jeton</button>`
    });
    const ta = $('#rq-text', m);
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    $('#rq-send', m).onclick = () => {
      const text = ta.value.trim();
      if (text.length < 3) return toast('Lütfen kısa bir mesaj yaz.', true);
      if (!spend(cost, `Mesaj isteği · ${t.name}`)) return;
      const r = { id: FM.uid('r'), from: u.id, to: t.id, text, t: Date.now(), status: 'pending', via: listing ? 'listing' : 'direct', listingId: listing?.id || null };
      S.requests.unshift(r);
      if (listing) listing.requests++;
      save(); closeModal();
      onSent && onSent();
      toast(`İstek gönderildi · ${esc(t.name)}`);
      refresh();
      simulateAccept(r.id);
    };
  }

  const REPLIES = {
    creator: ['Merhaba! Mesajın için teşekkürler 😊', 'Çok sevindim, detayları konuşalım.', 'Harika, ben de bekliyorum!', 'Tabii ki, saat konusunu netleştirelim mi?'],
    fan: ['Merhaba! İsteğini kabul ettiğin için teşekkürler.', 'Çok heyecanlıyım 🙌', 'Süper, orada olurum.', 'İçeriklerini çok seviyorum!']
  };
  const replyFor = id => { const arr = REPLIES[user(id).role]; return arr[Math.floor(Math.random() * arr.length)]; };

  function simulateAccept(reqId) {
    setTimeout(() => {
      const r = S.requests.find(x => x.id === reqId);
      if (!r || r.status !== 'pending') return;
      r.status = 'accepted';
      const t = user(r.to);
      const c = { id: FM.uid('cv'), users: [r.from, r.to], messages: [
        { id: FM.uid('m'), from: r.from, type: 'text', text: r.text, t: r.t },
        { id: FM.uid('m'), from: r.to, type: 'text', text: replyFor(r.to), t: Date.now() }] };
      S.convos.unshift(c);
      FM.notify(S, r.from, `${t.name} mesaj isteğini kabul etti.`, 'check', '#/mesajlar/' + c.id);
      FM.email(S, user(r.from).email, `${t.name} mesaj isteğinizi kabul etti`);
      save();
      if (meId() !== r.from) return;
      chrome(parse());
      if (parse().name === 'mesajlar') refresh();
      toast(`${esc(t.name)} isteğini kabul etti. <a href="#/mesajlar/${c.id}" style="text-decoration:underline">Sohbete git</a>`);
    }, 4000);
  }

  /* ----- Mesajlar ----- */
  const lastMsg = c => c.messages[c.messages.length - 1];
  const msgPreview = m => (!m ? '' : m.type === 'image' ? '📷 Fotoğraf' : m.type === 'video' ? '🎬 Video' : m.type === 'voice' ? '🎤 Sesli mesaj' : m.text);
  const hhmm = t => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  function bubble(m) {
    const cls = m.from === meId() ? 'me' : 'them';
    const time = `<time>${hhmm(m.t)}</time>`;
    if (m.type === 'image') return `<div class="bubble media ${cls}"><img src="${esc(m.url)}" alt="Fotoğraf">${time}</div>`;
    if (m.type === 'video') return m.url?.startsWith('blob:') && !BLOBS.has(m.url)
      ? `<div class="bubble ${cls}">🎬 Video <span class="xs">(demo: sayfa yenilenince önizleme kaldırılır)</span>${time}</div>`
      : `<div class="bubble media ${cls}"><video src="${esc(m.url)}" controls playsinline></video>${time}</div>`;
    if (m.type === 'voice') {
      const bars = Array.from({ length: 28 }, (_, i) => `<i style="height:${20 + Math.abs(Math.sin(i * 1.7 + m.dur)) * 80}%"></i>`).join('');
      return `<div class="bubble ${cls}"><div class="voice"><span class="play">${icon('play')}</span><span class="wave">${bars}</span><span class="xs">0:${String(m.dur).padStart(2, '0')}</span></div>${time}</div>`;
    }
    return `<div class="bubble ${cls}">${esc(m.text)}${time}</div>`;
  }
  const BLOBS = new Set();

  function messagesHtml(c) {
    let day = '';
    return c.messages.map(m => {
      const d = new Date(m.t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
      const sep = d !== day ? `<span class="day">${d === new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) ? 'Bugün' : d}</span>` : '';
      day = d;
      return sep + bubble(m);
    }).join('');
  }

  function appreciation(c) {
    if (S.role !== 'creator') return '';
    const fanId = partnerId(c);
    const fan = user(fanId);
    if (fan.role !== 'fan') return '';
    const need = cfg().appreciateAfter;
    const sent = c.messages.filter(m => m.from === meId()).length;
    const a = S.appreciations.find(x => x.creatorId === meId() && x.fanId === fanId);
    const first = esc(fan.name.split(' ')[0]);
    let txt, btn;
    if (a?.active) {
      txt = `${icon('award', 'ic-sm')} ${first} kişisini takdir ettin.`;
      btn = `<button class="btn btn-ghost btn-sm" data-appr="off">Geri Al</button>`;
    } else if (sent < need) {
      txt = `Takdir Et hakkı için ${need - sent} mesaj daha gönder <span class="xs">(${sent}/${need})</span>`;
      btn = `<button class="btn btn-sm btn-ghost" disabled>${icon('award', 'ic-sm')} Takdir Et</button>`;
    } else if (a?.withdrawnAt && Date.now() - a.withdrawnAt < 24 * H) {
      txt = `Tekrar takdir için ${Math.ceil((a.withdrawnAt + 24 * H - Date.now()) / H)} saat beklemelisin.`;
      btn = `<button class="btn btn-sm btn-ghost" disabled>${icon('award', 'ic-sm')} Takdir Et</button>`;
    } else {
      txt = `${first} ile ${sent} mesajlaştın. Takdir ederek profilinde öne çıkmasını sağla.`;
      btn = `<button class="btn btn-sm btn-dark" data-appr="on">${icon('award', 'ic-sm')} Takdir Et</button>`;
    }
    return `<div class="appreciate-bar" id="appr"><span class="grow">${txt}</span>${btn}</div>`;
  }

  VIEWS.mesajlar = (v, R) => {
    const tab = R.q.get('tab') || 'chats';
    const convos = myConvos().sort((a, b) => (lastMsg(b)?.t || 0) - (lastMsg(a)?.t || 0));
    const reqs = incoming();
    const c = R.arg && S.convos.find(x => x.id === R.arg && x.users.includes(meId()));
    const sent = S.requests.filter(r => r.from === meId()).slice(0, 8);

    const listHtml = tab === 'requests'
      ? (reqs.length ? reqs.map(r => {
        const f = user(r.from);
        return `<div class="req">${avatar(f, 48)}<div class="grow">
          <div class="row wrap" style="gap:6px"><b>${esc(f.name)}, ${f.age}</b>${vb(f)}${roleChip(f)}${planChip(f)}</div>
          <div class="xs muted">${ago(r.t)}${r.via === 'listing' ? ' · ilan üzerinden' : ''}</div>
          <div class="req-msg">${esc(r.text)}</div>
          <div class="req-actions"><button class="btn btn-primary btn-sm" data-accept="${r.id}">${icon('check', 'ic-sm')} Kabul Et</button>
          <button class="btn btn-ghost btn-sm" data-reject="${r.id}">Reddet</button><a class="btn btn-sm" href="#/u/${f.id}">Profil</a></div></div></div>`;
      }).join('') : `<div class="empty">${icon('mail')}<h4>Bekleyen istek yok</h4><p>Yeni mesaj istekleri burada görünür.</p></div>`)
        + (sent.length ? `<div style="padding:16px 16px 6px" class="eyebrow">Gönderdiğin istekler</div>` + sent.map(r => {
          const t = user(r.to);
          const st = { pending: ['chip-amber', 'Bekliyor'], accepted: ['chip-green', 'Kabul edildi'], rejected: ['chip-red', 'Reddedildi'] }[r.status];
          return `<div class="thread">${avatar(t, 40)}<div class="grow"><b>${esc(t.name)}</b><div class="last ellipsis">${esc(r.text)}</div></div><span class="chip ${st[0]}">${st[1]}</span></div>`;
        }).join('') : '')
      : (convos.length ? convos.map(x => {
        const p = user(partnerId(x)); const lm = lastMsg(x);
        return `<a class="thread ${c && c.id === x.id ? 'on' : ''}" href="#/mesajlar/${x.id}">${avatar(p, 48)}
          <div class="grow"><div class="row between"><b class="ellipsis">${esc(p.name)}</b><span class="xs muted">${lm ? ago(lm.t) : ''}</span></div>
          <div class="last ellipsis">${lm?.from === meId() ? 'Sen: ' : ''}${esc(msgPreview(lm))}</div></div></a>`;
      }).join('') : `<div class="empty">${icon('message')}<h4>Henüz sohbet yok</h4><p>Keşfet'ten ya da bir ilandan mesaj isteği gönder.</p><a class="btn btn-primary btn-sm" href="#/kesfet">Keşfet</a></div>`);

    let chatHtml;
    if (c) {
      const p = user(partnerId(c));
      chatHtml = `<div class="chat-head">
          <a class="icon-btn" href="#/mesajlar" aria-label="Geri" style="border:0">${icon('back')}</a>
          <a href="#/u/${p.id}" class="row grow" style="gap:12px">${avatar(p, 40)}<div class="grow"><b>${esc(p.name)}</b> ${vb(p)}
            <div class="xs muted">${isActive(p) ? '<span style="color:var(--green)">●</span> Son zamanlarda aktif' : 'Son görülme ' + ago(p.lastActive)}</div></div></a>
          <button class="icon-btn" data-menu aria-label="Seçenekler">${icon('more')}</button>
        </div>
        <div class="chat-body" id="chat-body">${messagesHtml(c)}</div>
        ${appreciation(c)}
        <div class="composer" id="composer">
          <button class="icon-btn" id="att" aria-label="Fotoğraf veya video gönder">${icon('image')}</button>
          <textarea id="msg" rows="1" placeholder="Mesaj yaz…" aria-label="Mesaj"></textarea>
          <button class="icon-btn" id="mic" aria-label="Sesli mesaj">${icon('mic')}</button>
          <button class="icon-btn send" id="send" aria-label="Gönder">${icon('send')}</button>
        </div>`;
    } else {
      chatHtml = `<div class="chat-empty"><div class="empty">${icon('message')}<h4>${tab === 'requests' ? 'İstek → Kabul → Sohbet' : 'Bir sohbet seç'}</h4>
        <p>${tab === 'requests' ? 'Match sistemi yok; bir isteği kabul ettiğinde sohbet doğrudan başlar.' : 'Kabul edilmiş sohbetlerde metin, fotoğraf, video ve ses mesajları ücretsizdir.'}</p></div></div>`;
    }

    v.innerHTML = `<div class="card inbox ${c ? 'has-chat' : ''}">
      <div class="inbox-list"><div class="inbox-head"><div class="seg" style="width:100%;display:grid;grid-template-columns:1fr 1fr">
        <button class="${tab !== 'requests' ? 'on' : ''}" data-mtab="chats">Mesajlar</button>
        <button class="${tab === 'requests' ? 'on' : ''}" data-mtab="requests">İstekler ${reqs.length ? `<span class="count">${reqs.length}</span>` : ''}</button>
      </div></div><div class="inbox-scroll">${listHtml}</div></div>
      <section class="chat" style="position:relative">${chatHtml}</section></div>`;

    $$('[data-mtab]', v).forEach(b => b.onclick = () => { location.hash = '#/mesajlar' + (b.dataset.mtab === 'requests' ? '?tab=requests' : ''); });
    $$('[data-accept]', v).forEach(b => b.onclick = () => acceptRequest(b.dataset.accept));
    $$('[data-reject]', v).forEach(b => b.onclick = () => {
      const r = S.requests.find(x => x.id === b.dataset.reject);
      r.status = 'rejected'; save(); refresh(); toast('İstek reddedildi.');
    });
    if (c) bindChat(v, c);
  };

  function acceptRequest(id) {
    const r = S.requests.find(x => x.id === id);
    r.status = 'accepted';
    const c = { id: FM.uid('cv'), users: [r.from, r.to], messages: [{ id: FM.uid('m'), from: r.from, type: 'text', text: r.text, t: r.t }] };
    S.convos.unshift(c);
    FM.notify(S, r.from, `${me().name} mesaj isteğini kabul etti.`, 'check');
    FM.email(S, user(r.from).email, `${me().name} mesaj isteğinizi kabul etti`);
    save();
    toast('İstek kabul edildi, sohbet başladı.');
    location.hash = '#/mesajlar/' + c.id;
  }

  function bindChat(v, c) {
    const body = $('#chat-body', v);
    const ta = $('#msg', v);
    const scroll = () => { body.scrollTop = body.scrollHeight; };
    scroll();
    const pid = partnerId(c);

    function push(m) {
      c.messages.push(m);
      save();
      body.insertAdjacentHTML('beforeend', bubble(m));
      scroll();
      const bar = $('#appr', v);
      if (bar) bar.outerHTML = appreciation(c);
      if (m.from === meId()) scheduleReply();
    }
    let replyTimer;
    function scheduleReply() {
      clearTimeout(replyTimer);
      replyTimer = setTimeout(() => {
        const m = { id: FM.uid('m'), from: pid, type: 'text', text: replyFor(pid), t: Date.now() };
        c.messages.push(m); save();
        if (location.hash === '#/mesajlar/' + c.id && document.body.contains(body)) { body.insertAdjacentHTML('beforeend', bubble(m)); scroll(); }
      }, 1800 + Math.random() * 1500);
    }
    const sendText = () => {
      const text = ta.value.trim();
      if (!text) return;
      ta.value = ''; ta.style.height = '';
      push({ id: FM.uid('m'), from: meId(), type: 'text', text, t: Date.now() });
    };
    $('#send', v).onclick = sendText;
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });

    $('#att', v).onclick = async () => {
      const f = await pickFile('image/*,video/*');
      if (!f) return;
      if (f.type.startsWith('video')) {
        const url = URL.createObjectURL(f); BLOBS.add(url);
        push({ id: FM.uid('m'), from: meId(), type: 'video', url, t: Date.now() });
      } else {
        try { push({ id: FM.uid('m'), from: meId(), type: 'image', url: await readImage(f, 640), t: Date.now() }); }
        catch (e) { toast('Görsel okunamadı.', true); }
      }
    };

    $('#mic', v).onclick = () => {
      const comp = $('#composer', v);
      const kids = [...comp.children];
      kids.forEach(k => { k.hidden = true; });
      comp.insertAdjacentHTML('beforeend', `<button class="icon-btn" data-rec="x" aria-label="İptal">${icon('trash')}</button>
        <div class="recording">Kaydediliyor… <span>0:00</span></div><button class="icon-btn send" data-rec="ok" aria-label="Gönder">${icon('send')}</button>`);
      const recEls = [...comp.children].slice(kids.length);
      let sec = 0;
      const iv = setInterval(() => {
        if (!document.body.contains(comp)) return clearInterval(iv);
        sec++; recEls[1].querySelector('span').textContent = '0:' + String(sec).padStart(2, '0');
      }, 1000);
      const done = () => { clearInterval(iv); recEls.forEach(el => el.remove()); kids.forEach(k => { k.hidden = false; }); };
      recEls[0].onclick = done;
      recEls[2].onclick = () => {
        const dur = Math.max(1, sec);
        done();
        push({ id: FM.uid('m'), from: meId(), type: 'voice', dur, t: Date.now() });
      };
    };

    v.querySelector('[data-menu]').onclick = e => {
      e.stopPropagation();
      $$('.menu').forEach(m => m.remove());
      const p = user(pid);
      v.querySelector('.chat').insertAdjacentHTML('beforeend', `<div class="menu">
        <a href="#/u/${p.id}">${icon('user')} Profili Gör</a>
        <button data-report="${p.id}" data-type="Kullanıcı davranışı">${icon('flag')} Raporla</button>
        <button class="danger" id="block">${icon('ban')} Engelle</button></div>`);
      $('#block', v).onclick = () => confirmBox('Kullanıcıyı engelle', `${esc(p.name)} artık sana mesaj gönderemez ve keşif/haritada görünmez.`, 'Engelle', () => {
        S.blocked.push(p.id); save(); toast(`${esc(p.name)} engellendi.`); location.hash = '#/mesajlar';
      }, true);
    };

    const apprBtn = e => {
      const b = e.target.closest('[data-appr]');
      if (!b) return;
      const fan = user(pid);
      let a = S.appreciations.find(x => x.creatorId === meId() && x.fanId === pid);
      if (!a) { a = { creatorId: meId(), fanId: pid, active: false }; S.appreciations.push(a); }
      if (b.dataset.appr === 'on') {
        a.active = true; a.at = Date.now(); fan.appreciated++;
        FM.notify(S, pid, `${me().name} seni takdir etti.`, 'award');
        toast(`${esc(fan.name)} takdir edildi · Takdir Edilme: ${fan.appreciated}`);
      } else {
        a.active = false; a.withdrawnAt = Date.now(); fan.appreciated = Math.max(0, fan.appreciated - 1);
        toast('Takdir geri alındı. 24 saat sonra tekrar verebilirsin.');
      }
      save();
      $('#appr', v).outerHTML = appreciation(c);
    };
    v.querySelector('.chat').addEventListener('click', apprBtn);
  }

  /* ----- Rapor ----- */
  function openReport(targetId, type) {
    const reasons = ['Spam', 'Dolandırıcılık', 'Taciz', 'Tehdit', 'Uygunsuz içerik', 'Yasa dışı içerik', 'Sahte profil', 'Sahte ilan', 'Başka'];
    const m = modal({
      title: 'Raporla', sub: `${type} · Raporlar admin ekibi tarafından incelenir.`,
      body: `<div class="report-reasons">${reasons.map((r, i) => `<label><input type="radio" name="reason" value="${r}" ${i ? '' : 'checked'}> ${r}</label>`).join('')}</div>
        <label class="field"><span>Açıklama (isteğe bağlı)</span><textarea class="textarea" id="rp-desc" style="min-height:80px" placeholder="Ne oldu?"></textarea></label>`,
      foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><button class="btn btn-danger" id="rp-send">${icon('flag', 'ic-sm')} Raporu Gönder</button>`
    });
    $('#rp-send', m).onclick = () => {
      S.reports.unshift({ id: FM.uid('rp'), by: meId(), target: targetId, targetType: type, reason: $('[name=reason]:checked', m).value, desc: $('#rp-desc', m).value.trim(), status: 'new', t: Date.now() });
      save(); closeModal(); toast('Raporun alındı. Teşekkürler.');
    };
  }

  /* ----- Profil ----- */
  const SOC = {
    instagram: ['Instagram', 'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)', 'IG'], x: ['X', '#111', 'X'], tiktok: ['TikTok', '#111', 'TT'],
    youtube: ['YouTube', '#FF0033', 'YT'], kick: ['Kick', '#2A9A12', 'K'], loyalfans: ['LoyalFans', '#1F6FE0', 'LF'], fansly: ['Fansly', '#1FA2F1', 'FS'], web: ['Web sitesi', '#7A3BD0', 'W']
  };
  const socialList = u => Object.entries(u.socials).filter(([, v]) => v).map(([k, val]) =>
    `<div class="slink"><span class="s-ic" style="background:${SOC[k][1]}">${SOC[k][2]}</span><div><b>${SOC[k][0]}</b><div class="xs muted">${esc(val)}</div></div><span class="ext">${icon('ext', 'ic-sm')}</span></div>`).join('');

  function unlockSocial(id) {
    const t = user(id), u = me();
    const list = S.unlocked[u.id] = S.unlocked[u.id] || [];
    const cost = plan(u).social;
    confirmBox('Sosyal bağlantıları aç', `${esc(t.name)} kişisinin sosyal bağlantıları <b>${cost} jeton</b> karşılığında kalıcı olarak açılır. Aynı creator için tekrar ödeme yapmazsın.`, `${cost} jeton ile aç`, () => {
      if (!spend(cost, `Sosyal bağlantı · ${t.name}`)) return;
      list.push(id); save(); refresh(); toast('Sosyal bağlantılar açıldı.');
    });
  }

  function photosBlock(u, own) {
    const max = u.role === 'creator' ? 3 : 1;
    const shown = own ? u.photos : u.photos.filter(p => p.status === 'approved');
    const chip = { pending: '<span class="chip chip-amber">İncelemede</span>', rejected: '<span class="chip chip-red">Reddedildi</span>', removed: '<span class="chip chip-red">Kaldırıldı</span>', approved: '' };
    const slots = shown.map((p, i) => `<div class="photo ${p.status}"><img src="${esc(p.url)}" alt="" loading="lazy">${own ? chip[p.status] || '' : ''}
      ${own ? `<div class="photo-actions"><button data-ph-replace="${i}" aria-label="Değiştir">${icon('upload')}</button>${u.photos.length > 1 ? `<button data-ph-del="${i}" aria-label="Sil">${icon('trash')}</button>` : ''}</div>` : ''}</div>`);
    if (own) for (let i = shown.length; i < max; i++) slots.push(`<button class="photo photo-add" data-ph-add>${icon('plus', 'ic-lg')}<span>Fotoğraf ekle</span></button>`);
    return `<section class="card card-pad"><div class="block-title"><h3>Fotoğraflar</h3>${own ? `<span class="xs muted">${u.photos.length} / ${max} · Her fotoğraf admin onayından geçer</span>` : ''}</div>
      <div class="photos" style="${max === 1 ? 'grid-template-columns:minmax(0,200px)' : ''}">${slots.join('') || '<p class="muted small">Onaylı fotoğraf yok.</p>'}</div></section>`;
  }

  function profileView(v, u, own) {
    const viewer = me();
    const p = plan(u);
    const isCreator = u.role === 'creator';
    const activeL = activeListings().filter(l => l.ownerId === u.id);
    if (!own) { u.views++; save(); }
    const unlocked = !isCreator || own || plan(viewer).social === 0 || (S.unlocked[viewer.id] || []).includes(u.id) || viewer.role === 'creator';
    const stats = isCreator
      ? own ? [[u.views, 'Profil görüntülenme'], [activeL.length, 'Aktif ilan'], [S.requests.filter(r => r.to === u.id).length, 'Gelen istek']]
        : [[activeL.length, 'Aktif ilan'], [u.photos.filter(x => x.status === 'approved').length, 'Fotoğraf'], [Math.max(1, Math.round((Date.now() - u.createdAt) / (30 * 24 * H))) + ' ay', 'Üyelik']]
      : [[u.appreciated, 'Takdir Edilme'], [S.listings.filter(l => l.ownerId === u.id && l.status === 'approved').length, 'Aktif ilan'], [p.name, 'Plan']];
    const hasConvo = !own && convoWith(u.id);

    const actions = own
      ? `<button class="btn btn-ghost" id="edit-bio">${icon('edit', 'ic-sm')} Profili Düzenle</button><a class="btn btn-ghost" href="#/ayarlar">${icon('settings', 'ic-sm')}</a>`
      : `${hasConvo ? `<a class="btn btn-primary" href="#/mesajlar/${hasConvo.id}">${icon('message', 'ic-sm')} Sohbete Git</a>` : `<button class="btn btn-primary" data-req="${u.id}">${icon('send', 'ic-sm')} Mesaj İsteği</button>`}
         <button class="btn btn-ghost" id="pass">${icon('x', 'ic-sm')} Geç</button>
         <button class="btn btn-ghost" data-report="${u.id}" data-type="Profil" aria-label="Raporla">${icon('flag', 'ic-sm')}</button>`;

    const side = [];
    side.push(`<section class="card card-pad"><div class="block-title"><h3>Bilgiler</h3></div><div class="info-list">
      <div><span>Rol</span><b>${isCreator ? 'Creator' : 'Fan'}</b></div>
      <div><span>Yaş</span><b>${u.age}</b></div>
      <div><span>Konum</span><b>${isCreator ? `${esc(u.city)}, ${esc(u.country)}` : `${esc(u.city)} / ${esc(u.district)}`}</b></div>
      ${isCreator ? '' : `<div><span>Abonelik</span><b>${p.name}</b></div>`}
      <div><span>Aktiflik</span><b>${isActive(u) ? '<span style="color:var(--green)">Son zamanlarda aktif</span>' : ago(u.lastActive)}</b></div>
      ${own ? `<div><span>Haritada göster</span><b>${u.showOnMap ? 'Açık' : 'Kapalı'}</b></div>` : ''}
    </div></section>`);

    if (isCreator) {
      side.push(`<section class="card card-pad"><div class="block-title"><h3>Sosyal Bağlantılar</h3>${own ? `<button class="btn btn-sm btn-ghost" id="edit-links">${icon('edit', 'ic-sm')}</button>` : unlocked ? '<span class="chip chip-green">Açık</span>' : ''}</div>
        ${Object.keys(u.socials).length ? (unlocked ? `<div class="links">${socialList(u)}</div>`
          : `<div class="links-locked"><div class="links">${socialList(u)}</div><div class="unlock">${icon('lock', 'ic-lg')}<b>${Object.keys(u.socials).length} bağlantı kilitli</b>
              <button class="btn btn-primary btn-sm" data-unlock="${u.id}">${icon('coin', 'ic-sm')} ${plan(viewer).social} jeton ile aç</button>
              <span class="xs muted">Pro+ fanlar için ücretsiz · Açılan erişim kalıcıdır</span></div></div>`)
          : '<p class="muted small">Bağlantı eklenmemiş.</p>'}</section>`);
      if (p.payments || own) {
        side.push(`<section class="card card-pad"><div class="block-title"><h3>Ödeme Bağlantıları</h3></div>
          ${!p.payments ? `<p class="muted small">Ödeme bağlantıları Plus Creator ve üzeri planlarda görünür.</p><a class="btn btn-soft btn-sm" href="#/abonelik" style="margin-top:10px">Planı Yükselt</a>`
            : u.payments.length ? `<div class="links">${u.payments.map(x => `<div class="slink"><span class="s-ic" style="background:var(--grad)">${icon('heart', 'ic-sm')}</span><div><b>${esc(x.label)}</b><div class="xs muted ellipsis">${esc(x.url)}</div></div><span class="ext">${icon('ext', 'ic-sm')}</span></div>`).join('')}</div>`
              : '<p class="muted small">Bağlantı eklenmemiş.</p>'}
          <p class="xs muted" style="margin-top:10px">FanMeet creator'lara kazanç sağlamaz; bu bağlantılar creator'ın kendi harici hesaplarıdır.</p></section>`);
      }
      if (own) {
        side.push(`<section class="card card-pad"><div class="block-title"><h3>Creator istatistikleri</h3><span class="chip chip-plum">${p.stats}</span></div>
          <div class="info-list"><div><span>Görünürlük önceliği</span><b>${p.boost}×</b></div><div><span>Öne çıkan slot</span><b>${p.featured}</b></div>
          <div><span>Discover önceliği</span><b>${p.discoverPri}</b></div><div><span>Haritada</span><b>${p.map ? p.mapPri : 'Yok'}</b></div></div>
          ${u.plan !== 'pro' ? `<a class="btn btn-soft btn-sm btn-block" href="#/abonelik" style="margin-top:12px">${icon('crown', 'ic-sm')} Görünürlüğü artır</a>` : ''}</section>`);
      }
    } else {
      side.unshift(`<div class="appreciated"><span class="medal">${icon('award', 'ic-lg')}</span><div><b>${u.appreciated}</b><div class="small" style="color:#6E5217">Takdir Edilme</div><div class="xs muted">Creator'ların verdiği toplam takdir</div></div></div>`);
      if (own) {
        const visits = plan(u).visits;
        side.push(`<section class="card card-pad"><div class="block-title"><h3>Profil ziyaretçileri</h3>${visits ? '' : `<span class="chip chip-plum">${icon('lock')} Plus</span>`}</div>
          ${visits ? `<div class="stack">${['c1', 'c3', 'c8'].map(id => user(id)).map(x => `<a class="row" href="#/u/${x.id}">${avatar(x, 32)}<span class="grow small"><b>${esc(x.name)}</b></span><span class="xs muted">${ago(x.lastActive + H)}</span></a>`).join('')}</div>`
            : `<p class="muted small">Profilini hangi creator'ların ziyaret ettiğini Plus ve Pro+ planlarda görebilirsin.</p><a class="btn btn-soft btn-sm" href="#/abonelik" style="margin-top:10px">Planları Gör</a>`}</section>`);
      }
    }

    v.innerHTML = `<div class="profile"><div class="stack" style="gap:20px">
      <section class="card p-hero"><div class="p-cover"></div><div class="p-main">
        <div class="p-top"><img class="av" src="${esc(u.photo)}" alt="${esc(u.name)}">
          <div class="grow"><div class="p-name">${esc(u.name)} <span>${u.age}</span> ${vb(u)}</div>
            <div class="row wrap" style="margin-top:6px">${roleChip(u)}${planChip(u)}<span class="small muted row" style="gap:4px">${icon('pin', 'ic-sm')} ${esc(u.district)}, ${esc(u.city)}</span></div></div>
          <div class="p-actions">${actions}</div></div>
        ${u.tags.length ? `<div class="tags">${u.tags.map(t => `<span class="chip chip-rose">${icon('star')}${esc(t === 'Pro+ Recommended' ? 'Pro+ plan olmanız tavsiye edilir' : t)}</span>`).join('')}</div>` : ''}
        <p style="font-size:15.5px;color:var(--ink-2)">${esc(u.bio) || '<span class="muted">Henüz bir bio eklenmemiş.</span>'}</p>
      </div><div class="p-stats">${stats.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div></section>
      ${photosBlock(u, own)}
      ${activeL.length || own ? `<section><div class="block-title"><h3 class="serif" style="font-size:24px">${own ? 'Yayındaki ilanların' : 'Aktif ilanları'}</h3>${own ? '<a class="btn btn-sm btn-ghost" href="#/ilanlar?tab=mine">Tümü</a>' : ''}</div>
        <div class="listings">${activeL.map(lcard).join('') || `<div class="card empty" style="grid-column:1/-1">${icon('megaphone')}<p>Yayında ilan yok.</p></div>`}</div></section>` : ''}
    </div><aside class="stack" style="gap:20px">${side.join('')}</aside></div>`;

    if (own) bindOwnProfile(v, u);
    $('#pass', v)?.addEventListener('click', () => { markSeen(u.id); location.hash = '#/kesfet'; });
  }

  function bindOwnProfile(v, u) {
    const upload = async (idx) => {
      const f = await pickFile('image/*');
      if (!f) return;
      try {
        const url = await readImage(f);
        const ph = { id: FM.uid('ph'), url, status: 'pending', t: Date.now() };
        if (idx == null) u.photos.push(ph); else u.photos[idx] = ph;
        FM.notify(S, u.id, 'Fotoğrafın admin incelemesine gönderildi.', 'mail', '#/profil');
        save(); refresh();
        toast('Fotoğraf yüklendi · Admin onayı bekleniyor');
      } catch (e) {
        toast('Görsel okunamadı. Farklı bir dosya dene.', true);
      }
    };
    $$('[data-ph-add]', v).forEach(b => b.onclick = () => upload(null));
    $$('[data-ph-replace]', v).forEach(b => b.onclick = () => upload(+b.dataset.phReplace));
    $$('[data-ph-del]', v).forEach(b => b.onclick = () => confirmBox('Fotoğrafı sil', 'Bu fotoğraf profilinden kaldırılacak.', 'Sil', () => {
      const [rm] = u.photos.splice(+b.dataset.phDel, 1);
      if (rm.url === u.photo) u.photo = (u.photos.find(p => p.status === 'approved') || {}).url || u.photo;
      save(); refresh();
    }, true));
    $('#edit-bio', v).onclick = () => {
      const m = modal({
        title: 'Profili düzenle',
        body: `<label class="field"><span>İsim</span><input class="input" id="e-name" value="${esc(u.name)}" maxlength="40"></label>
          <label class="field"><span>Bio</span><textarea class="textarea" id="e-bio" maxlength="300">${esc(u.bio)}</textarea></label>
          <p class="hint">Konum ve harita görünürlüğünü Ayarlar'dan değiştirebilirsin.</p>`,
        foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><button class="btn btn-primary" id="e-save">Kaydet</button>`
      });
      $('#e-save', m).onclick = () => {
        u.name = $('#e-name', m).value.trim() || u.name; u.bio = $('#e-bio', m).value.trim();
        save(); closeModal(); refresh(); toast('Profil güncellendi.');
      };
    };
    $('#edit-links', v)?.addEventListener('click', () => {
      const pay = u.payments[0] || { label: 'Destek Ol', url: '' };
      const m = modal({
        title: 'Bağlantıları düzenle', wide: true,
        body: `<span class="eyebrow">Sosyal bağlantılar</span>
          <div class="grid-2">${Object.keys(SOC).map(k => `<label class="field"><span>${SOC[k][0]}</span><input class="input" data-soc="${k}" value="${esc(u.socials[k] || '')}" placeholder="@kullaniciadi"></label>`).join('')}</div>
          <span class="eyebrow">Ödeme bağlantısı</span>
          <div class="grid-2"><label class="field"><span>Etiket</span><input class="input" id="pay-l" value="${esc(pay.label)}"></label>
          <label class="field"><span>URL</span><input class="input" id="pay-u" value="${esc(pay.url)}" placeholder="https://"></label></div>`,
        foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><button class="btn btn-primary" id="l-save">Kaydet</button>`
      });
      $('#l-save', m).onclick = () => {
        u.socials = {};
        $$('[data-soc]', m).forEach(i => { if (i.value.trim()) u.socials[i.dataset.soc] = i.value.trim(); });
        const url = $('#pay-u', m).value.trim();
        u.payments = url ? [{ label: $('#pay-l', m).value.trim() || 'Destek Ol', url }] : [];
        save(); closeModal(); refresh(); toast('Bağlantılar kaydedildi.');
      };
    });
  }

  VIEWS.profil = v => profileView(v, me(), true);
  VIEWS.u = (v, R) => {
    const u = user(R.arg);
    if (!u || u.status !== 'active' || u.id === meId()) { if (u?.id === meId()) return profileView(v, me(), true); v.innerHTML = `<div class="empty card">${icon('user')}<h4>Profil bulunamadı</h4><a class="btn btn-primary btn-sm" href="#/kesfet">Keşfet'e dön</a></div>`; return; }
    if (S.blocked.includes(u.id)) { v.innerHTML = `<div class="empty card">${icon('ban')}<h4>Bu kullanıcıyı engelledin</h4><button class="btn btn-ghost btn-sm" id="unblock">Engeli kaldır</button></div>`; $('#unblock', v).onclick = () => { S.blocked = S.blocked.filter(x => x !== u.id); save(); refresh(); }; return; }
    profileView(v, u, false);
  };

  /* ----- Ödeme (Fanvue checkout simülasyonu) ----- */
  function checkout(product, apply) {
    if (!product || !product.active) return toast('Bu ürün şu anda satışta değil.', true);
    modal({ body: `<div class="fanvue"><div class="spinner"></div><h3 class="serif" style="font-size:24px">Fanvue güvenli ödeme sayfasına yönlendiriliyorsunuz</h3>
      <p class="muted small">FanMeet kart bilgisi toplamaz. Ödeme Fanvue üzerinde tamamlanır.</p></div>` });
    setTimeout(() => {
      if (!$('.modal')) return;
      const m = modal({
        title: 'Ödeme', sub: 'Demo simülasyonu — gerçek ödeme alınmaz.',
        body: `<div class="checkout-mock"><div class="bar"><i></i><i></i><i></i><span class="grow ellipsis">🔒 ${esc(product.link)}</span></div>
          <div class="inner"><div class="row between"><div><b>${esc(product.name)}</b><div class="xs muted">${product.type === 'subscription' ? '30 günlük otomatik yenilenen abonelik' : 'Tek seferlik satın alma'}</div></div><b style="font-size:22px">${money(product.price)}</b></div>
          <div class="summary"><div><span>Satıcı</span><b>FanMeet</b></div><div><span>Ödeme altyapısı</span><b>Fanvue Checkout</b></div></div>
          <p class="xs muted">Bu ekran, müşterinin Fanvue'nun kendi sayfasında göreceği adımın yerini tutar.</p></div></div>`,
        foot: `<button class="btn btn-ghost" data-close>İptal</button><button class="btn btn-dark" id="pay">Ödemeyi Tamamla (demo)</button>`
      });
      $('#pay', m).onclick = () => {
        modal({ body: `<div class="fanvue"><div class="spinner"></div><h3 class="serif" style="font-size:22px">Ödeme doğrulanıyor…</h3>
          <p class="muted small">FanMeet backend'i Fanvue işlem kaydını doğruluyor ve işlem ID'sinin daha önce kullanılmadığını kontrol ediyor.</p></div>` });
        setTimeout(() => {
          const tx = FM.tx();
          if (S.purchases.some(p => p.tx === tx)) return toast('Bu işlem zaten işlenmiş.', true);
          const u = me();
          const rec = { tx, userId: u.id, item: product.name, type: product.type, amount: product.price, tokens: 0, status: 'verified', t: Date.now() };
          const msg = apply(u, rec);
          S.purchases.unshift(rec);
          FM.notify(S, u.id, msg, 'coin', product.type === 'token' ? '#/jeton' : '#/abonelik');
          FM.email(S, u.email, msg);
          save();
          modal({
            body: `<div class="fanvue"><div class="success-ic">${icon('check')}</div><h3 class="serif" style="font-size:26px">Ödeme doğrulandı</h3>
              <p>${msg}</p><div class="summary" style="width:100%"><div><span>İşlem ID</span><b>${tx}</b></div><div><span>Tutar</span><b>${money(product.price)}</b></div></div></div>`,
            foot: `<button class="btn btn-primary btn-block" data-close>Tamam</button>`
          });
          refresh();
        }, 1300);
      };
    }, 1400);
  }

  VIEWS.jeton = v => {
    const u = me();
    const log = S.tokenLog.filter(x => x.userId === u.id).slice(0, 8);
    const buys = S.purchases.filter(x => x.userId === u.id).slice(0, 6);
    v.innerHTML = `<div class="wallet"><div><span class="eyebrow" style="color:#F79CC0">Jeton bakiyen</span>
        <div class="big">${u.tokens} <small>jeton</small></div>
        <p style="opacity:.7;margin-top:8px;font-size:13px">Jetonlar süresizdir · Transfer edilemez · Nakde çevrilemez</p></div>
        <div class="row wrap"><a class="btn btn-ghost" href="#/abonelik" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2)">${icon('crown', 'ic-sm')} ${plan(u).name}</a></div></div>
      <div class="section-head"><div><span class="eyebrow">Jeton paketleri</span><h2>Daha fazla <em>iletişim</em>, daha fazla ilan</h2><p>Gerçek para karşılığı satın almadan önce açıkça gösterilir. Ödeme Fanvue güvenli ödeme sayfasında tamamlanır.</p></div></div>
      <div class="packs">${cfg().packages.map((p, i) => `<div class="card pack ${i === 1 ? 'hl' : ''}">${p.tag ? `<span class="chip ${i === 1 ? 'chip-dark' : 'chip-gold'} ribbon">${p.tag}</span>` : ''}
        <div class="coins">${icon('coin', 'ic-lg')}</div><div><div class="n">${p.tokens}</div><div class="muted small">${esc(p.name)}</div></div>
        <div class="price">${money(p.price)}</div><div class="xs muted">Jeton başına $${(p.price / p.tokens).toFixed(3).replace('.', ',')}</div>
        <button class="btn ${i === 1 ? 'btn-primary' : 'btn-dark'} btn-block" data-buy="${p.id}">Satın Al</button></div>`).join('')}</div>
      <div class="section-head" style="margin-top:36px"><div><span class="eyebrow">Jeton nerede kullanılır?</span><h2>Jeton mesaj başına <em>alınmaz</em></h2><p>Yeni iletişim başlatmak için kullanılır. Kabul edilmiş sohbetlerde metin, fotoğraf, video ve ses ücretsizdir.</p></div></div>
      <div class="costs">
        <div class="cost"><span>Yeni mesaj isteği</span>${coinTxt(cfg().requestCost)}</div>
        ${cfg().durations.map(d => `<div class="cost"><span>İlan · ${d.h} saat</span>${coinTxt(d.cost)}</div>`).join('')}
        <div class="cost"><span>Creator sosyal bağlantıları</span>${coinTxt(cfg().socialCost)}</div>
        <div class="cost"><span>Kabul edilmiş sohbet</span><b style="color:var(--green)">Ücretsiz</b></div>
      </div>
      <div class="two-col" style="margin-top:36px">
        <section class="card card-pad"><div class="block-title"><h3>Jeton hareketleri</h3></div>
          ${log.length ? `<div class="info-list">${log.map(x => `<div><span>${esc(x.reason)}<br><small>${ago(x.t)}</small></span><b style="color:${x.delta > 0 ? 'var(--green)' : 'var(--ink)'}">${x.delta > 0 ? '+' : ''}${x.delta}</b></div>`).join('')}</div>` : '<p class="muted small">Hareket yok.</p>'}</section>
        <section class="card card-pad"><div class="block-title"><h3>Satın alımlar</h3></div>
          ${buys.length ? `<div class="info-list">${buys.map(x => `<div><span>${esc(x.item)}<br><small>${x.tx} · ${ago(x.t)}</small></span><b>${money(x.amount)}</b></div>`).join('')}</div>` : '<p class="muted small">Henüz satın alım yok.</p>'}</section>
      </div>`;
    $$('[data-buy]', v).forEach(b => b.onclick = () => {
      const pk = cfg().packages.find(p => p.id === b.dataset.buy);
      const prod = S.products.find(p => p.ref === pk.id && p.type === 'token');
      checkout(prod, (u, rec) => {
        u.tokens += pk.tokens; rec.tokens = pk.tokens;
        S.tokenLog.unshift({ userId: u.id, delta: pk.tokens, reason: `Satın alma · ${pk.name}`, t: Date.now() });
        return `${pk.tokens} jeton hesabına eklendi.`;
      });
    });
  };

  VIEWS.abonelik = v => {
    const u = me();
    const plans = cfg().plans[u.role];
    const bestId = 'plus';
    const feats = u.role === 'fan'
      ? p => [
        [true, `Günde <b>${p.discover}</b> Discover profili`],
        [true, `Haritada <b>${p.map}</b> kişi`],
        [true, p.monthlyRequests ? `Ayda ${p.monthlyRequests} mesaj isteği` : 'Sınırsız mesaj isteği (jetonla)'],
        [true, 'Fotoğraf, video ve ses mesajı'],
        [true, p.social ? `Sosyal bağlantılar ${p.social} jeton` : '<b>Sosyal bağlantılar ücretsiz</b>'],
        [p.id !== 'free', 'Creator keşfinde ve haritada görünürlük'],
        [p.discoverPri, 'Discover önceliği'],
        [p.visits, 'Profil ziyaret geçmişi'],
        [!!p.monthlyTokens, p.monthlyTokens ? `Her 30 günde <b>${p.monthlyTokens}</b> jeton` : '30 günlük jeton yok']]
      : p => [
        [true, 'Creator profili + 3 onaylı fotoğraf'],
        [true, `Discover önceliği: <b>${p.discoverPri}</b>`],
        [p.map, p.map ? `Harita görünürlüğü · öncelik <b>${p.mapPri}</b>` : 'Harita görünürlüğü yok'],
        [p.featuredArea, p.featured ? `Öne çıkan creator alanı · <b>${p.featured}</b> slot` : 'Öne çıkan creator alanı'],
        [true, `Profil görünürlük önceliği <b>${p.boost}×</b>`],
        [true, `${p.stats} istatistikler`],
        [p.payments, 'Ödeme bağlantıları'],
        [p.badge, 'Mavi doğrulama rozeti']];

    v.innerHTML = `<div class="section-head"><div><span class="eyebrow">${u.role === 'fan' ? 'Fan abonelikleri' : 'Creator abonelikleri'}</span>
        <h2>${u.role === 'fan' ? 'Daha fazla <em>keşif</em>, daha fazla iletişim' : 'Daha fazla fana <em>görün</em>'}</h2>
        <p>${u.role === 'fan' ? 'Abonelikler keşfetme ve iletişim kapasiteni artırır.' : 'Creator abonelikleri görünürlüğünü ve keşfedilme önceliğini artırır.'} Ödemeler Fanvue üzerinden alınır ve 30 günde bir otomatik yenilenir.</p></div></div>
      <div class="plans">${plans.map(p => {
        const cur = p.id === u.plan;
        return `<div class="card plan ${cur ? 'current' : ''} ${p.id === bestId && !cur ? 'best' : ''}">
          <div class="row between"><h3>${p.name}</h3>${cur ? '<span class="chip chip-dark">Mevcut plan</span>' : p.id === bestId ? '<span class="chip chip-rose">Önerilen</span>' : ''}</div>
          <div class="price">${p.price ? money(p.price) : '$0'}<small> / ay</small></div>
          <ul class="feats">${feats(p).map(([ok, t]) => `<li class="feat ${ok ? '' : 'no'}">${icon(ok ? 'check' : 'x')}<span>${t}</span></li>`).join('')}</ul>
          ${cur ? (p.price ? `<button class="btn btn-ghost btn-block" data-cancel>Aboneliği İptal Et</button>` : `<button class="btn btn-ghost btn-block" disabled>Aktif</button>`)
            : p.price ? `<button class="btn ${p.id === bestId ? 'btn-primary' : 'btn-dark'} btn-block" data-plan="${p.id}">${RANK[p.id] > RANK[u.plan] ? 'Yükselt' : 'Geçiş Yap'}</button>` : ''}
        </div>`;
      }).join('')}</div>
      <p class="xs muted" style="margin-top:16px">Bu tablo başlangıç abonelik yapısıdır; fiyat ve limitler Admin Panel üzerinden değiştirilebilir.${u.role === 'creator' ? ' Creator plan fiyatları dokümanda belirtilmediği için demo amaçlı girilmiştir.' : ''}</p>`;

    $$('[data-plan]', v).forEach(b => b.onclick = () => {
      const p = plans.find(x => x.id === b.dataset.plan);
      const prod = S.products.find(x => x.type === 'subscription' && x.role === u.role && x.ref === p.id);
      checkout(prod, (usr, rec) => {
        usr.plan = p.id;
        if (usr.role === 'creator' && p.badge) usr.verified = true;
        if (p.monthlyTokens) {
          usr.tokens += p.monthlyTokens; rec.tokens = p.monthlyTokens;
          S.tokenLog.unshift({ userId: usr.id, delta: p.monthlyTokens, reason: `${p.name} · 30 günlük jeton`, t: Date.now() });
        }
        return `${p.name} aboneliğin aktif.${p.monthlyTokens ? ` ${p.monthlyTokens} jeton hesabına eklendi.` : ''}`;
      });
    });
    $('[data-cancel]', v)?.addEventListener('click', () => confirmBox('Aboneliği iptal et', 'Abonelik iptal edildiğinde FanMeet hesabın Free plana döner. (Demo: anında uygulanır.)', 'İptal Et', () => {
      u.plan = 'free';
      if (u.role === 'creator') u.verified = false;
      FM.notify(S, u.id, 'Aboneliğin iptal edildi.', 'bell', '#/abonelik');
      save(); refresh(); toast('Abonelik iptal edildi.');
    }, true));
  };

  /* ----- Ayarlar ----- */
  VIEWS.ayarlar = v => {
    const u = me();
    v.innerHTML = `<div class="settings">
      <section class="card card-pad"><div class="block-title"><h3>Gizlilik ve konum</h3>${icon('shield')}</div>
        <div class="set-row"><div class="grow"><b>Haritada Göster</b><span>Açık olması haritada kesin görüneceğin anlamına gelmez; abonelik, görünürlük ve sistem limitleri belirler.</span></div>
          <label class="toggle"><input type="checkbox" id="s-map" ${u.showOnMap ? 'checked' : ''}><span></span></label></div>
        <div style="padding-top:14px" id="loc">${locationSelects(u.city, u.district)}</div>
        <p class="hint" style="margin-top:10px">Harita konumun seçtiğin ilçe içinde rastgele oluşturulur. Gerçek GPS, canlı konum ve adres bilgisi kullanılmaz.</p>
        <button class="btn btn-dark btn-sm" id="s-loc" style="margin-top:12px">Konumu Kaydet</button>
      </section>
      <section class="card card-pad"><div class="block-title"><h3>Bildirimler</h3>${icon('bell')}</div>
        <div class="set-row"><div class="grow"><b>Site içi bildirimler</b><span>Mesaj istekleri, ilan ve fotoğraf kararları</span></div><label class="toggle"><input type="checkbox" data-pref="siteNotif" ${S.prefs.siteNotif ? 'checked' : ''}><span></span></label></div>
        <div class="set-row"><div class="grow"><b>E-posta bildirimleri</b><span>Önemli işlemler: onay/red, satın alma, abonelik</span></div><label class="toggle"><input type="checkbox" data-pref="emailNotif" ${S.prefs.emailNotif ? 'checked' : ''}><span></span></label></div>
      </section>
      <section class="card card-pad"><div class="block-title"><h3>Hesap</h3>${icon('user')}</div>
        <div class="info-list"><div><span>E-posta</span><b>${esc(u.email)}</b></div><div><span>Rol</span><b>${u.role === 'fan' ? 'Fan' : 'Creator'}</b></div>
        <div><span>Plan</span><b><a href="#/abonelik" style="color:var(--rose)">${plan(u).name} →</a></b></div><div><span>Jeton</span><b><a href="#/jeton" style="color:var(--rose)">${u.tokens} →</a></b></div>
        <div><span>Engellenen kullanıcılar</span><b>${S.blocked.length}</b></div></div>
        ${S.blocked.length ? `<button class="btn btn-ghost btn-sm" id="s-unblock" style="margin-top:10px">Engelleri kaldır</button>` : ''}
      </section>
      <section class="card card-pad" style="background:var(--grad-soft)"><div class="block-title"><h3>Demo kontrolleri</h3>${icon('zap')}</div>
        <p class="muted small">Bu bölüm yalnızca demo içindir. Uygulama ve admin paneli aynı tarayıcı verisini paylaşır; iki sekmeyi yan yana açıp akışları test edebilirsin.</p>
        <div class="row wrap" style="margin-top:14px"><div class="role-switch" style="width:180px"><button data-role="fan">Fan</button><button data-role="creator">Creator</button></div>
          <a class="btn btn-dark btn-sm" href="admin.html" target="_blank">Admin paneli ↗</a>
          <button class="btn btn-ghost btn-sm" id="s-reset">${icon('refresh', 'ic-sm')} Demo verisini sıfırla</button></div>
      </section>
      <section class="card card-pad"><div class="set-row"><div class="grow"><b style="color:var(--red)">Hesabı sil</b><span>Hesap silme talebi sistem kurallarına göre işlenir.</span></div><button class="btn btn-danger btn-sm" id="s-del">Hesabı Sil</button></div></section>
    </div>`;
    $$('[data-role]', v).forEach(b => b.classList.toggle('on', b.dataset.role === S.role));
    bindLocation($('#loc', v));
    $('#s-map', v).onchange = e => { u.showOnMap = e.target.checked; save(); toast(`Haritada Göster: ${u.showOnMap ? 'Açık' : 'Kapalı'}`); };
    $('#s-loc', v).onclick = () => {
      u.city = $('[name=city]', v).value; u.district = $('[name=district]', v).value;
      u.pos = FM.fuzz(u.id + Date.now(), u.country, u.city, u.district);
      save(); toast(`Konum güncellendi: ${u.district}, ${u.city}`);
    };
    $$('[data-pref]', v).forEach(i => i.onchange = () => { S.prefs[i.dataset.pref] = i.checked; save(); });
    $('#s-unblock', v)?.addEventListener('click', () => { S.blocked = []; save(); refresh(); toast('Engeller kaldırıldı.'); });
    $('#s-reset', v).onclick = () => confirmBox('Demo verisini sıfırla', 'Tüm demo verileri başlangıç haline döner.', 'Sıfırla', () => { S = FM.reset(); location.hash = '#/harita'; render(); toast('Demo verisi sıfırlandı.'); }, true);
    $('#s-del', v).onclick = () => confirmBox('Hesabı sil', 'Hesap silme talebin alınacak. (Demo: işlem yapılmaz.)', 'Talep Gönder', () => toast('Hesap silme talebin alındı (demo).'), true);
  };

  /* ---------- Başlat ---------- */
  window.addEventListener('hashchange', () => { closeModal(); render(); });
  window.addEventListener('scroll', () => $('.topbar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });
  render();
})();
