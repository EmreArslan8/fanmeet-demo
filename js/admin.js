/* FanMeet — admin paneli (merkezi yönetim) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { esc, ago, left, money, H } = FM;
  let S = FM.load();
  if (FM.expireListings(S)) FM.save(S);
  const save = () => FM.save(S);
  const ADMIN = 'admin@fanmeet';

  const user = id => S.users.find(u => u.id === id);
  const plan = u => FM.plan(S, u);
  const fmtDate = t => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const who = u => u ? `<div class="who"><img src="${esc(u.photo)}" alt=""><div><b>${esc(u.name)}</b><span class="xs muted">${u.role === 'creator' ? 'Creator' : 'Fan'} · ${esc(u.email)}</span></div></div>` : '<span class="muted">—</span>';
  const planChip = u => `<span class="chip ${{ free: '', premium: 'chip-rose', plus: 'chip-plum', pro: 'chip-gold' }[u.plan]}">${plan(u).name}</span>`;
  const STATUS_U = { active: ['chip-green', 'Aktif'], suspended: ['chip-amber', 'Geçici engelli'], banned: ['chip-red', 'Kalıcı engelli'], review: ['chip-blue', 'İncelemede'], application: ['chip-plum', 'Başvuru'], rejected: ['chip-red', 'Başvuru reddedildi'] };
  const STATUS_L = { pending: ['chip-amber', 'Pending'], approved: ['chip-green', 'Approved'], rejected: ['chip-red', 'Rejected'], revision: ['chip-blue', 'Revision Required'], expired: ['', 'Expired'], removed: ['chip-red', 'Removed'] };
  const STATUS_R = { new: ['chip-rose', 'New'], under_review: ['chip-amber', 'Under Review'], resolved: ['chip-green', 'Resolved'], dismissed: ['', 'Dismissed'], escalated: ['chip-red', 'Escalated'] };
  const chip = (map, k) => `<span class="chip ${map[k]?.[0] || ''}">${map[k]?.[1] || k}</span>`;

  function audit(action, target) {
    S.audit.unshift({ id: FM.uid('au'), admin: ADMIN, action, target, t: Date.now() });
  }
  function tell(u, text, icon, link, mail = true) {
    FM.notify(S, u.id, text, icon, link);
    if (mail) FM.email(S, u.email, text);
  }

  function toast(msg, err) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.innerHTML = icon(err ? 'alert' : 'check') + `<span>${msg}</span>`;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 3000);
  }
  function modal({ title = '', sub = '', body = '', foot = '', wide }) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><div><h3>${title}</h3>${sub ? `<p class="muted small" style="margin-top:4px">${sub}</p>` : ''}</div><button class="icon-btn" data-close aria-label="Kapat">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
    const back = root.firstElementChild;
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    return back.querySelector('.modal');
  }
  const close = () => { $('#modal-root').innerHTML = ''; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  function ask(title, label, placeholder, okLabel, cls, cb, preset = '') {
    const m = modal({
      title,
      body: `<label class="field"><span>${label}</span><textarea class="textarea" id="ask" placeholder="${esc(placeholder)}">${esc(preset)}</textarea></label><p class="hint">Kullanıcıya site içi bildirim + e-posta gönderilir.</p>`,
      foot: `<button class="btn btn-ghost" data-close>Vazgeç</button><button class="btn ${cls}" id="ask-ok">${okLabel}</button>`
    });
    $('#ask', m).focus();
    $('#ask-ok', m).onclick = () => {
      const v = $('#ask', m).value.trim();
      if (!v) return toast('Lütfen bir açıklama yaz.', true);
      close(); cb(v);
    };
  }

  /* ---------- Sayaçlar ---------- */
  const counts = () => ({
    listings: S.listings.filter(l => l.status === 'pending').length,
    photos: S.users.reduce((n, u) => n + u.photos.filter(p => p.status === 'pending').length, 0),
    apps: S.users.filter(u => u.status === 'application').length,
    reports: S.reports.filter(r => ['new', 'under_review', 'escalated'].includes(r.status)).length
  });

  const NAV = [
    ['Genel', [['dashboard', 'Dashboard', 'chart']]],
    ['Kullanıcılar', [['kullanicilar', 'Users', 'users'], ['fanlar', 'Fans', 'user'], ['creatorlar', 'Creators', 'star'], ['basvurular', 'Creator Applications', 'file', 'apps'], ['profil-olustur', 'Profil Oluştur', 'plus'], ['engelliler', 'Banned Users', 'ban']]],
    ['Moderasyon', [['ilan-talepleri', 'Listing Requests', 'megaphone', 'listings'], ['ilanlar', 'Listings', 'list'], ['fotograflar', 'Profile / Creator Photos', 'image', 'photos'], ['raporlar', 'Reports', 'flag', 'reports'], ['sohbetler', 'Messages / Chats', 'message']]],
    ['Gelir', [['abonelikler', 'Subscriptions', 'crown'], ['jetonlar', 'Tokens & Purchases', 'coin'], ['fanvue', 'Fanvue Ürünleri', 'card']]],
    ['Platform', [['harita', 'Map', 'map'], ['etiketler', 'Featured & Tags', 'tag'], ['bildirimler', 'Notifications & Emails', 'bell'], ['audit', 'Audit Logs', 'shield'], ['ayarlar', 'Settings', 'settings']]]
  ];
  const TITLE = Object.fromEntries(NAV.flatMap(g => g[1]).map(([k, t]) => [k, t]));

  function parse() {
    const [path, q = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const seg = (path || 'dashboard').split('/');
    return { name: V[seg[0]] ? seg[0] : 'dashboard', arg: seg[1], q: new URLSearchParams(q) };
  }
  const UI = { q: '', status: 'all', role: 'all', lstatus: 'all', rstatus: 'open', ptab: 'fan' };

  function render() {
    const R = parse();
    const c = counts();
    $('#adm-nav').innerHTML = NAV.map(([g, items]) => `<div class="adm-group">${g}</div>` + items.map(([k, t, i, cnt]) =>
      `<a class="adm-link ${R.name === k ? 'on' : ''}" href="#/${k}">${icon(i)}<span>${t}</span>${cnt && c[cnt] ? `<span class="count">${c[cnt]}</span>` : ''}</a>`).join('')).join('');
    $('#adm-title').textContent = TITLE[R.name] || 'Dashboard';
    $('#crumb').textContent = 'Admin / ' + (NAV.find(g => g[1].some(i => i[0] === R.name))?.[0] || 'Genel');
    $('#burger').innerHTML = icon('list');
    const v = $('#adm-view');
    v.innerHTML = '';
    V[R.name](v, R);
    $('#adm-side').classList.remove('open');
  }
  const refresh = () => { const y = scrollY; render(); scrollTo(0, y); };

  const V = {};

  /* ---------- Dashboard ---------- */
  V.dashboard = v => {
    const c = counts();
    const fans = S.users.filter(u => u.role === 'fan');
    const creators = S.users.filter(u => u.role === 'creator' && u.status !== 'application');
    const active = S.listings.filter(l => l.status === 'approved' && l.expiresAt > Date.now());
    const rev = S.purchases.filter(p => p.status === 'verified' && p.t > Date.now() - 30 * 24 * H).reduce((n, p) => n + p.amount, 0);
    const kpi = (lbl, val, ic, href, alert) => `<a class="card kpi ${alert ? 'alert' : ''}" href="${href}"><span class="lbl">${icon(ic)}${lbl}</span><span class="val">${val}</span></a>`;
    const planDist = ['free', 'premium', 'plus', 'pro'].map(p => [p, fans.filter(f => f.plan === p).length]);
    const maxP = Math.max(...planDist.map(x => x[1]), 1);
    v.innerHTML = `<div class="kpis">
        ${kpi('Bekleyen ilan', c.listings, 'megaphone', '#/ilan-talepleri', c.listings)}
        ${kpi('Bekleyen fotoğraf', c.photos, 'image', '#/fotograflar', c.photos)}
        ${kpi('Creator başvurusu', c.apps, 'file', '#/basvurular', c.apps)}
        ${kpi('Açık rapor', c.reports, 'flag', '#/raporlar', c.reports)}
        ${kpi('Toplam kullanıcı', S.users.length, 'users', '#/kullanicilar')}
        ${kpi('Fan / Creator', `${fans.length} / ${creators.length}`, 'user', '#/kullanicilar')}
        ${kpi('Aktif ilan', active.length, 'list', '#/ilanlar')}
        ${kpi('30 gün gelir', money(rev), 'coin', '#/jetonlar')}
      </div>
      <div class="cols">
        <section class="card"><div class="panel-head"><h3>Son admin işlemleri</h3><a class="btn btn-sm btn-ghost" href="#/audit">Audit Log</a></div>
          <div class="table-wrap"><table class="table"><tbody>${S.audit.slice(0, 7).map(a => `<tr><td><b>${esc(a.action)}</b><div class="xs muted">${esc(a.target)}</div></td><td class="xs muted">${esc(a.admin)}</td><td class="xs muted" style="white-space:nowrap">${ago(a.t)}</td></tr>`).join('')}</tbody></table></div></section>
        <section class="card"><div class="panel-head"><h3>Fan plan dağılımı</h3></div>
          <div class="bars">${planDist.map(([p, n]) => `<div class="bar"><span>${S.config.plans.fan.find(x => x.id === p).name}</span><span class="track"><i style="width:${n / maxP * 100}%"></i></span><b>${n}</b></div>`).join('')}</div>
          <div class="panel-head" style="border-top:1px solid var(--line)"><h3>Son satın alımlar</h3></div>
          <div class="table-wrap"><table class="table"><tbody>${S.purchases.slice(0, 5).map(p => `<tr><td>${esc(user(p.userId)?.name)}<div class="xs muted">${esc(p.item)}</div></td><td>${money(p.amount)}</td><td>${p.status === 'verified' ? '<span class="chip chip-green">Doğrulandı</span>' : '<span class="chip chip-red">Başarısız</span>'}</td></tr>`).join('')}</tbody></table></div>
        </section>
      </div>`;
  };

  /* ---------- Kullanıcılar ---------- */
  function usersTable(v, roleFixed) {
    const q = UI.q.toLocaleLowerCase('tr');
    const list = S.users.filter(u => u.status !== 'application' && (!roleFixed || u.role === roleFixed) && (roleFixed || UI.role === 'all' || u.role === UI.role) &&
      (UI.status === 'all' || u.status === UI.status) && (!q || (u.name + u.email + u.district).toLocaleLowerCase('tr').includes(q)));
    v.innerHTML = `<section class="card"><div class="panel-head"><div class="filters">
        <input class="input" id="uq" placeholder="İsim, e-posta, ilçe…" value="${esc(UI.q)}">
        ${roleFixed ? '' : `<select class="select" id="ur"><option value="all">Tüm roller</option><option value="fan" ${UI.role === 'fan' ? 'selected' : ''}>Fan</option><option value="creator" ${UI.role === 'creator' ? 'selected' : ''}>Creator</option></select>`}
        <select class="select" id="us"><option value="all">Tüm durumlar</option>${Object.entries(STATUS_U).filter(([k]) => k !== 'application').map(([k, [, t]]) => `<option value="${k}" ${UI.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div><span class="xs muted">${list.length} kayıt</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Kullanıcı</th><th>Plan</th><th>Durum</th><th>Konum</th><th>Jeton</th><th>${roleFixed === 'creator' ? 'Etiketler' : 'Takdir'}</th><th>Kayıt</th><th></th></tr></thead>
      <tbody>${list.map(u => `<tr><td>${who(u)}</td><td>${planChip(u)}</td><td>${chip(STATUS_U, u.status)}</td><td class="small">${esc(u.district)}, ${esc(u.city)}</td>
        <td>${u.tokens ?? 0}</td><td class="small">${u.role === 'creator' ? (u.tags.join(', ') || '—') : u.appreciated}</td><td class="xs muted">${ago(u.createdAt)}</td>
        <td><div class="acts"><button class="btn btn-sm btn-ghost" data-user="${u.id}">Yönet</button></div></td></tr>`).join('')}</tbody></table></div></section>`;
    $('#uq', v).oninput = e => { UI.q = e.target.value; const pos = e.target.selectionStart; usersTable(v, roleFixed); const i = $('#uq', v); i.focus(); i.setSelectionRange(pos, pos); };
    $('#ur', v)?.addEventListener('change', e => { UI.role = e.target.value; usersTable(v, roleFixed); });
    $('#us', v).onchange = e => { UI.status = e.target.value; usersTable(v, roleFixed); };
    $$('[data-user]', v).forEach(b => b.onclick = () => userDrawer(b.dataset.user));
  }
  V.kullanicilar = v => usersTable(v);
  V.fanlar = v => usersTable(v, 'fan');
  V.creatorlar = v => usersTable(v, 'creator');

  function userDrawer(id) {
    const u = user(id);
    const listings = S.listings.filter(l => l.ownerId === id);
    const reports = S.reports.filter(r => r.target === id || r.by === id);
    const tokens = S.tokenLog.filter(t => t.userId === id).slice(0, 6);
    const buys = S.purchases.filter(p => p.userId === id);
    const plans = S.config.plans[u.role];
    const m = modal({
      wide: true, title: esc(u.name), sub: `${u.id} · ${esc(u.email)} · ${u.age} yaş`,
      body: `<div class="row wrap">${chip(STATUS_U, u.status)}${planChip(u)}<span class="chip">${u.role === 'creator' ? 'Creator' : 'Fan'}</span>${u.showOnMap ? '<span class="chip chip-blue">Haritada Göster: Açık</span>' : '<span class="chip">Haritada Göster: Kapalı</span>'}</div>
        <div class="kv"><span>Konum</span><b>${esc(u.country)} / ${esc(u.city)} / ${esc(u.district)}</b><span>Bio</span><span style="color:var(--ink)">${esc(u.bio) || '—'}</span>
          <span>Sosyal</span><span style="color:var(--ink)">${Object.entries(u.socials).map(([k, x]) => `${k}: ${esc(x)}`).join(' · ') || '—'}</span>
          <span>Fotoğraflar</span><span style="color:var(--ink)">${u.photos.map(p => p.status).join(', ') || '—'}</span>
          <span>İlanlar</span><span style="color:var(--ink)">${listings.length ? listings.map(l => `${esc(l.title)} (${l.status})`).join(' · ') : '—'}</span>
          <span>Raporlar</span><span style="color:var(--ink)">${reports.length ? reports.map(r => `${r.reason} (${r.status})`).join(' · ') : '—'}</span>
          <span>Abonelik</span><span style="color:var(--ink)">${buys.filter(b => b.type === 'subscription').map(b => `${esc(b.item)} ${fmtDate(b.t)}`).join(' · ') || '—'}</span>
          <span>Jeton işlemleri</span><span style="color:var(--ink)">${tokens.map(t => `${t.delta > 0 ? '+' : ''}${t.delta} ${esc(t.reason)}`).join(' · ') || '—'}</span></div>
        <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label class="field"><span>Hesap durumu</span><select class="select" id="d-status">${['active', 'review', 'suspended', 'banned'].map(k => `<option value="${k}" ${u.status === k ? 'selected' : ''}>${STATUS_U[k][1]}</option>`).join('')}</select></label>
          <label class="field"><span>Abonelik (manuel)</span><select class="select" id="d-plan">${plans.map(p => `<option value="${p.id}" ${u.plan === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label>
          <label class="field"><span>Jeton düzeltme (+/-)</span><input class="input" id="d-tok" type="number" value="0"></label>
          <label class="field"><span>Mavi rozet</span><select class="select" id="d-ver" ${u.role !== 'creator' ? 'disabled' : ''}><option value="0">Yok</option><option value="1" ${u.verified ? 'selected' : ''}>Var</option></select></label>
        </div>`,
      foot: `<button class="btn btn-ghost" data-close>Kapat</button><button class="btn btn-dark" id="d-save">Kaydet</button>`
    });
    $('#d-save', m).onclick = () => {
      const st = $('#d-status', m).value, pl = $('#d-plan', m).value, tok = parseInt($('#d-tok', m).value, 10) || 0, ver = $('#d-ver', m).value === '1';
      const changes = [];
      if (st !== u.status) { changes.push(`durum: ${STATUS_U[st][1]}`); u.status = st; tell(u, `Hesap durumun güncellendi: ${STATUS_U[st][1]}`, 'alert', '#/ayarlar'); }
      if (pl !== u.plan) { changes.push(`plan: ${pl}`); u.plan = pl; }
      if (tok) { changes.push(`jeton ${tok > 0 ? '+' : ''}${tok}`); u.tokens = Math.max(0, (u.tokens || 0) + tok); S.tokenLog.unshift({ userId: u.id, delta: tok, reason: 'Admin düzeltmesi', t: Date.now() }); }
      if (u.role === 'creator' && ver !== !!u.verified) { changes.push(`rozet: ${ver ? 'var' : 'yok'}`); u.verified = ver; if (!ver) u.tags = u.tags.filter(t => t !== 'Verified'); }
      if (changes.length) { audit('Kullanıcı güncellendi (' + changes.join(', ') + ')', `${u.id} · ${u.name}`); save(); toast('Kullanıcı güncellendi.'); }
      close(); refresh();
    };
  }

  V.engelliler = v => {
    const list = S.users.filter(u => ['banned', 'suspended', 'review'].includes(u.status));
    v.innerHTML = `<section class="card"><div class="panel-head"><h3>Engellenen / incelemedeki hesaplar</h3></div>
      ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Kullanıcı</th><th>Durum</th><th>Rapor</th><th></th></tr></thead><tbody>${list.map(u => `<tr><td>${who(u)}</td><td>${chip(STATUS_U, u.status)}</td>
        <td>${S.reports.filter(r => r.target === u.id).length}</td><td><div class="acts"><button class="btn btn-sm btn-success" data-unban="${u.id}">Aktifleştir</button><button class="btn btn-sm btn-ghost" data-user="${u.id}">Yönet</button></div></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${icon('ban')}<h4>Engellenen hesap yok</h4><p>Kullanıcılar sayfasından hesap durumu değiştirilebilir.</p></div>`}</section>`;
    $$('[data-unban]', v).forEach(b => b.onclick = () => { const u = user(b.dataset.unban); u.status = 'active'; audit('Hesap aktifleştirildi', `${u.id} · ${u.name}`); tell(u, 'Hesabın yeniden aktif.', 'check'); save(); refresh(); });
    $$('[data-user]', v).forEach(b => b.onclick = () => userDrawer(b.dataset.user));
  };

  /* ---------- Creator başvuruları ---------- */
  V.basvurular = v => {
    const apps = S.users.filter(u => u.status === 'application');
    v.innerHTML = `<section class="card"><div class="panel-head"><h3>Creator başvuruları</h3><span class="xs muted">Onay/red sonucunda site içi bildirim + e-posta gönderilir</span></div>
      ${apps.length ? apps.map(u => `<div class="review"><div class="review-main">
          <div class="row" style="gap:14px"><img src="${esc(u.photos[0]?.url || u.photo)}" alt="" style="width:88px;height:88px;border-radius:18px;object-fit:cover">
          <div><h4>${esc(u.name)}, ${u.age}</h4><div class="xs muted">${esc(u.email)} · ${esc(u.district)}, ${esc(u.city)} · ${ago(u.createdAt)} başvurdu</div></div></div>
          <p>${esc(u.bio)}</p>
          <div class="kv"><span>Sosyal profiller</span><b>${Object.entries(u.socials).map(([k, x]) => `${k}: ${esc(x)}`).join(' · ')}</b><span>Fotoğraf</span><b>${u.photos.length} adet · ${u.photos.map(p => p.status).join(', ')}</b></div>
        </div><div class="review-side">
          <button class="btn btn-success" data-app-ok="${u.id}">${icon('check', 'ic-sm')} Onayla</button>
          <button class="btn btn-danger" data-app-no="${u.id}">${icon('x', 'ic-sm')} Reddet</button>
          <p class="xs muted">Onaylanınca Creator hesabı aktifleşir ve fotoğrafları onaylanır. Reddedilen kişi düzeltip tekrar başvurabilir.</p>
        </div></div>`).join('')
        : `<div class="empty">${icon('file')}<h4>Bekleyen başvuru yok</h4></div>`}</section>
      ${S.users.some(u => u.status === 'rejected') ? `<section class="card"><div class="panel-head"><h3>Reddedilen başvurular</h3></div><div class="table-wrap"><table class="table"><tbody>${S.users.filter(u => u.status === 'rejected').map(u => `<tr><td>${who(u)}</td><td class="small">${esc(u.rejectReason || '')}</td><td><div class="acts"><button class="btn btn-sm btn-ghost" data-reapply="${u.id}">Tekrar incelemeye al</button></div></td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
    $$('[data-app-ok]', v).forEach(b => b.onclick = () => {
      const u = user(b.dataset.appOk);
      u.status = 'active'; u.photos.forEach(p => { p.status = 'approved'; }); u.photo = u.photos[0]?.url || u.photo; u.tags = ['New Creator'];
      audit('Creator başvurusu onaylandı', `${u.id} · ${u.name}`); tell(u, 'Creator başvurun onaylandı. Hesabın aktif!', 'check', '#/profil');
      save(); refresh(); toast(`${esc(u.name)} onaylandı.`);
    });
    $$('[data-app-no]', v).forEach(b => b.onclick = () => ask('Başvuruyu reddet', 'Red sebebi', 'Örn. Sosyal profil doğrulanamadı.', 'Reddet', 'btn-danger', reason => {
      const u = user(b.dataset.appNo);
      u.status = 'rejected'; u.rejectReason = reason;
      audit('Creator başvurusu reddedildi', `${u.id} · ${u.name} · ${reason}`); tell(u, `Creator başvurun reddedildi: ${reason}`, 'x');
      save(); refresh();
    }));
    $$('[data-reapply]', v).forEach(b => b.onclick = () => { const u = user(b.dataset.reapply); u.status = 'application'; audit('Başvuru tekrar incelemeye alındı', u.id); save(); refresh(); });
  };

  /* ---------- Profil oluştur ---------- */
  V['profil-olustur'] = v => {
    const cities = Object.keys(FM.LOCATIONS['Türkiye']);
    v.innerHTML = `<section class="card" style="max-width:860px"><div class="panel-head"><h3>Admin tarafından profil oluştur</h3></div>
      <form class="modal-body" id="pf" style="padding:20px">
        <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label class="field"><span>Kullanıcı tipi</span><select class="select" name="role"><option value="fan">Fan</option><option value="creator">Creator</option></select></label>
          <label class="field"><span>Hesap durumu</span><select class="select" name="status"><option value="active">Aktif</option><option value="review">İncelemede</option></select></label>
          <label class="field"><span>İsim</span><input class="input" name="name" required></label>
          <label class="field"><span>Yaş (18+)</span><input class="input" name="age" type="number" min="18" value="25" required></label>
          <label class="field"><span>Ülke</span><select class="select" name="country"><option>Türkiye</option></select></label>
          <label class="field"><span>Şehir</span><select class="select" name="city">${cities.map(c => `<option>${c}</option>`).join('')}</select></label>
          <label class="field"><span>İlçe</span><select class="select" name="district">${Object.keys(FM.LOCATIONS['Türkiye'][cities[0]]).map(d => `<option>${d}</option>`).join('')}</select></label>
          <label class="field"><span>Profil fotoğrafı URL</span><input class="input" name="photo" value="https://randomuser.me/api/portraits/women/${Math.floor(Math.random() * 90)}.jpg"></label>
          <label class="field"><span>Instagram</span><input class="input" name="instagram" placeholder="@"></label>
          <label class="field"><span>Ödeme bağlantısı</span><input class="input" name="pay" placeholder="https://"></label>
          <label class="field"><span>Profil etiketi</span><select class="select" name="tag"><option value="">—</option>${['Featured', 'New Creator', 'Verified', 'Pro+ Recommended', 'Platform Selected', 'Special Profile'].map(t => `<option>${t}</option>`).join('')}</select></label>
          <label class="field"><span>Haritada göster</span><select class="select" name="map"><option value="1">Açık</option><option value="0">Kapalı</option></select></label>
        </div>
        <label class="field"><span>Bio</span><textarea class="textarea" name="bio"></textarea></label>
        <label class="row small"><input type="checkbox" name="platform" checked> Platform tarafından oluşturulmuş/temsili profil olarak işaretle (kullanıcıyı yanıltmamak için)</label>
        <div><button class="btn btn-dark" type="submit">Profili Oluştur</button></div>
      </form></section>`;
    const f = $('#pf', v);
    f.city.onchange = () => { f.district.innerHTML = Object.keys(FM.LOCATIONS['Türkiye'][f.city.value]).map(d => `<option>${d}</option>`).join(''); };
    f.onsubmit = e => {
      e.preventDefault();
      if (+f.age.value < 18) return toast('Yaş sınırı 18+.', true);
      const id = FM.uid('u');
      const tags = [f.tag.value, f.platform.checked ? 'Platform Profile' : ''].filter(Boolean);
      const u = {
        id, name: f.name.value.trim(), age: +f.age.value, role: f.role.value, plan: 'free', country: 'Türkiye', city: f.city.value, district: f.district.value,
        status: f.status.value, showOnMap: f.map.value === '1', verified: f.tag.value === 'Verified', tags, socials: f.instagram.value ? { instagram: f.instagram.value } : {},
        payments: f.pay.value ? [{ label: 'Destek Ol', url: f.pay.value }] : [], appreciated: 0, views: 0, lastActive: Date.now(), tokens: 0,
        photo: f.photo.value, photos: [{ id: FM.uid('ph'), url: f.photo.value, status: 'approved', t: Date.now() }], bio: f.bio.value, createdAt: Date.now(),
        email: `${id}@fanmeet.admin`
      };
      u.pos = FM.fuzz(u.id, u.country, u.city, u.district);
      S.users.push(u);
      audit('Admin profil oluşturdu', `${u.id} · ${u.name} (${u.role})`);
      save(); toast('Profil oluşturuldu.'); location.hash = '#/' + (u.role === 'creator' ? 'creatorlar' : 'fanlar');
    };
  };

  /* ---------- İlan talepleri ---------- */
  function decideListing(l, decision, note) {
    const o = user(l.ownerId);
    l.history = l.history || [];
    if (decision === 'approve') {
      Object.assign(l, { status: 'approved', approvedAt: Date.now(), expiresAt: Date.now() + l.hours * H, note: '' });
      tell(o, `"${l.title}" ilanın onaylandı ve ${l.hours} saat yayında.`, 'check', '#/ilanlar?tab=mine');
      audit('İlan onaylandı', `${l.id} · ${l.title}`);
    } else if (decision === 'reject') {
      Object.assign(l, { status: 'rejected', note, refunded: true });
      o.tokens = (o.tokens || 0) + l.cost;
      S.tokenLog.unshift({ userId: o.id, delta: l.cost, reason: `İade · reddedilen ilan`, t: Date.now() });
      tell(o, `"${l.title}" ilanın reddedildi: ${note} (${l.cost} jeton iade edildi)`, 'x', '#/ilanlar?tab=mine');
      audit('İlan reddedildi (jeton iade)', `${l.id} · ${l.title} · ${note}`);
    } else if (decision === 'revision') {
      Object.assign(l, { status: 'revision', note });
      tell(o, `"${l.title}" ilanın için düzeltme istendi: ${note}`, 'alert', '#/ilanlar?tab=mine');
      audit('İlan düzeltme istendi', `${l.id} · ${l.title}`);
    } else if (decision === 'remove') {
      Object.assign(l, { status: 'removed', note });
      tell(o, `"${l.title}" ilanın yayından kaldırıldı: ${note}`, 'x', '#/ilanlar?tab=mine');
      audit('İlan yayından kaldırıldı', `${l.id} · ${l.title} · ${note}`);
    }
    l.history.push({ t: Date.now(), action: decision, note: note || '', admin: ADMIN });
    save();
  }
  const SUSPICIOUS = /(ücretli|para|dm|whatsapp|telegram|iban|hızlı dönüş)/i;

  V['ilan-talepleri'] = v => {
    const list = S.listings.filter(l => l.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
    v.innerHTML = `<section class="card"><div class="panel-head"><h3>Onay bekleyen ilanlar</h3><span class="xs muted">Hiçbir ilan admin onayı olmadan yayınlanmaz</span></div>
      ${list.length ? list.map(l => {
        const o = user(l.ownerId);
        const prev = S.listings.filter(x => x.ownerId === o.id && x.id !== l.id);
        const reps = S.reports.filter(r => r.target === l.id || r.target === o.id);
        return `<div class="review"><div class="review-main">
          <div class="row wrap">${chip(STATUS_L, l.status)}<span class="chip">${l.hours} saat · ${l.cost} jeton</span>${SUSPICIOUS.test(l.title + ' ' + l.desc) ? `<span class="flag">${icon('alert')} Şüpheli ifade</span>` : ''}${l.history?.some(h => h.action === 'revision') ? '<span class="chip chip-blue">Düzeltilip tekrar gönderildi</span>' : ''}</div>
          <h4>${esc(l.title)}</h4><p>${esc(l.desc)}</p>
          <div class="kv"><span>Konum</span><b>${esc(l.district)}, ${esc(l.city)}</b><span>Oluşturulma</span><b>${fmtDate(l.createdAt)} (${ago(l.createdAt)})</b>
            <span>Jeton işlemi</span><b>-${l.cost} jeton · ödendi</b><span>Raporlar</span><b>${reps.length ? reps.map(r => r.reason).join(', ') : 'Yok'}</b>
            <span>Geçmiş kararlar</span><b>${(l.history || []).filter(h => h.admin).map(h => `${h.action} (${ago(h.t)})`).join(', ') || '—'}</b>
            <span>Kullanıcı ilanları</span><b>${prev.length} önceki ilan · ${prev.filter(x => x.status === 'rejected').length} red</b></div>
        </div><div class="review-side">
          ${who(o)}
          <div class="row wrap">${planChip(o)}${chip(STATUS_U, o.status)}</div>
          <button class="btn btn-success" data-l="approve" data-id="${l.id}">${icon('check', 'ic-sm')} Onayla</button>
          <button class="btn btn-ghost" data-l="revision" data-id="${l.id}">${icon('edit', 'ic-sm')} Düzeltme İste</button>
          <button class="btn btn-danger" data-l="reject" data-id="${l.id}">${icon('x', 'ic-sm')} Reddet (jeton iade)</button>
          <button class="btn btn-sm" data-user="${o.id}">Kullanıcıyı yönet →</button>
        </div></div>`;
      }).join('') : `<div class="empty">${icon('megaphone')}<h4>Onay bekleyen ilan yok</h4><p>Uygulamada yeni bir ilan oluşturduğunda burada görünür.</p></div>`}</section>`;
    bindListingActions(v);
  };
  function bindListingActions(v) {
    $$('[data-l]', v).forEach(b => b.onclick = () => {
      const l = S.listings.find(x => x.id === b.dataset.id);
      const d = b.dataset.l;
      if (d === 'approve') { decideListing(l, d); refresh(); toast('İlan onaylandı ve yayına alındı.'); return; }
      const cfg = {
        revision: ['Düzeltme iste', 'Kullanıcıya açıklama', 'İlan açıklamanız çok genel. Buluşmanın amacı ve şehir bilgisini daha açık belirtin.', 'Düzeltme İste', 'btn-dark'],
        reject: ['İlanı reddet', 'Red sebebi', 'Örn. Ücretli hizmet / spam içerik.', 'Reddet', 'btn-danger'],
        remove: ['Yayından kaldır', 'Kaldırma sebebi', 'Örn. Kullanıcı raporları sonrası kaldırıldı.', 'Kaldır', 'btn-danger']
      }[d];
      ask(cfg[0], cfg[1], cfg[2], cfg[3], cfg[4], note => { decideListing(l, d, note); refresh(); toast('İşlem kaydedildi.'); });
    });
    $$('[data-user]', v).forEach(b => b.onclick = () => userDrawer(b.dataset.user));
    $$('[data-ext]', v).forEach(b => b.onclick = () => {
      const l = S.listings.find(x => x.id === b.dataset.ext);
      l.expiresAt += (+b.dataset.h) * H;
      if (l.expiresAt < Date.now()) l.status = 'expired';
      audit(`İlan süresi düzenlendi (${b.dataset.h > 0 ? '+' : ''}${b.dataset.h} sa)`, `${l.id} · ${l.title}`);
      save(); refresh();
    });
  }

  V.ilanlar = v => {
    const q = UI.q.toLocaleLowerCase('tr');
    const list = S.listings.filter(l => (UI.lstatus === 'all' || l.status === UI.lstatus) && (!q || (l.title + l.desc).toLocaleLowerCase('tr').includes(q)))
      .sort((a, b) => b.createdAt - a.createdAt);
    const dup = new Set(S.listings.filter((l, i, a) => a.findIndex(x => x.ownerId === l.ownerId && x.title === l.title) !== i).map(l => l.id));
    v.innerHTML = `<section class="card"><div class="panel-head"><div class="filters">
        <input class="input" id="lq" placeholder="Başlık / açıklama ara…" value="${esc(UI.q)}">
        <select class="select" id="ls"><option value="all">Tüm durumlar</option>${Object.entries(STATUS_L).map(([k, [, t]]) => `<option value="${k}" ${UI.lstatus === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div><span class="xs muted">${list.length} ilan</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>İlan</th><th>Sahibi</th><th>Durum</th><th>Süre</th><th>Görüntülenme</th><th>Talep / tık</th><th></th></tr></thead>
      <tbody>${list.map(l => {
        const o = user(l.ownerId);
        return `<tr><td style="min-width:220px"><b>${esc(l.title)}</b>${dup.has(l.id) ? ` <span class="flag">${icon('alert')} Tekrarlayan</span>` : ''}${SUSPICIOUS.test(l.title + l.desc) ? ` <span class="flag">${icon('alert')} Şüpheli</span>` : ''}<div class="xs muted">${esc(l.district)} · ${l.hours} sa · ${fmtDate(l.createdAt)}</div></td>
          <td>${who(o)}</td><td>${chip(STATUS_L, l.status)}</td>
          <td class="small" style="white-space:nowrap">${l.status === 'approved' ? left(l.expiresAt) : '—'}</td><td>${l.views}</td><td>${l.requests} / ${l.clicks || 0}</td>
          <td><div class="acts">${l.status === 'pending' ? `<a class="btn btn-sm btn-dark" href="#/ilan-talepleri">İncele</a>` : ''}
            ${l.status === 'approved' ? `<button class="btn btn-sm btn-ghost" data-ext="${l.id}" data-h="12" title="+12 saat">+12s</button><button class="btn btn-sm btn-ghost" data-ext="${l.id}" data-h="-12" title="-12 saat">-12s</button><button class="btn btn-sm btn-danger" data-l="remove" data-id="${l.id}">Kaldır</button>` : ''}</div></td></tr>`;
      }).join('')}</tbody></table></div></section>`;
    $('#lq', v).oninput = e => { UI.q = e.target.value; const p = e.target.selectionStart; V.ilanlar(v); const i = $('#lq', v); i.focus(); i.setSelectionRange(p, p); };
    $('#ls', v).onchange = e => { UI.lstatus = e.target.value; V.ilanlar(v); };
    bindListingActions(v);
  };

  /* ---------- Fotoğraflar ---------- */
  V.fotograflar = (v, R) => {
    const tab = R.q.get('tab') || 'fan';
    const status = R.q.get('s') || 'pending';
    const items = S.users.filter(u => u.role === tab).flatMap(u => u.photos.map((p, i) => ({ u, p, i }))).filter(x => x.p.status === status);
    v.innerHTML = `<section class="card"><div class="panel-head">
        <div class="seg"><a class="${tab === 'fan' ? 'on' : ''}" href="#/fotograflar?tab=fan&s=${status}"><button class="${tab === 'fan' ? 'on' : ''}">Fan Photos</button></a><a href="#/fotograflar?tab=creator&s=${status}"><button class="${tab === 'creator' ? 'on' : ''}">Creator Photos</button></a></div>
        <div class="seg">${['pending', 'approved', 'rejected', 'removed'].map(s => `<a href="#/fotograflar?tab=${tab}&s=${s}"><button class="${status === s ? 'on' : ''}">${{ pending: 'Pending', approved: 'Approved', rejected: 'Rejected', removed: 'Removed' }[s]}</button></a>`).join('')}</div>
      </div>
      ${items.length ? `<div class="qgrid">${items.map(({ u, p, i }) => `<div class="qcard"><img src="${esc(p.url)}" alt="" loading="lazy"><div class="qb">
          ${who(u)}<div class="xs muted">${u.role === 'creator' ? `Creator ${i === 0 ? 'profil' : 'ek'} fotoğrafı ${i + 1}` : 'Fan profil fotoğrafı'} · ${ago(p.t)}</div>
          <div class="acts">${status === 'pending' ? `<button class="btn btn-sm btn-success" data-ph="approved" data-u="${u.id}" data-p="${p.id}">Approve</button><button class="btn btn-sm btn-danger" data-ph="rejected" data-u="${u.id}" data-p="${p.id}">Reject</button>`
            : status === 'approved' ? `<button class="btn btn-sm btn-danger" data-ph="removed" data-u="${u.id}" data-p="${p.id}">Remove</button>`
              : `<button class="btn btn-sm btn-ghost" data-ph="approved" data-u="${u.id}" data-p="${p.id}">Onayla</button>`}</div>
        </div></div>`).join('')}</div>`
        : `<div class="empty">${icon('image')}<h4>Bu kuyrukta fotoğraf yok</h4><p>Uygulamada profilden fotoğraf yüklediğinde "Pending" kuyruğuna düşer.</p></div>`}</section>`;
    $$('[data-ph]', v).forEach(b => b.onclick = () => {
      const u = user(b.dataset.u);
      const p = u.photos.find(x => x.id === b.dataset.p);
      p.status = b.dataset.ph;
      const firstApproved = u.photos.find(x => x.status === 'approved');
      if (p.status === 'approved' && (u.photos[0] === p || !firstApproved || firstApproved === p)) u.photo = p.url;
      if (p.status !== 'approved' && u.photo === p.url) u.photo = firstApproved?.url || u.photo;
      const label = { approved: 'onaylandı', rejected: 'reddedildi', removed: 'kaldırıldı' }[p.status];
      tell(u, `Fotoğrafın ${label}.`, p.status === 'approved' ? 'check' : 'x', '#/profil');
      audit(`Fotoğraf ${label}`, `${p.id} · ${u.name}`);
      save(); refresh();
    });
  };

  /* ---------- Raporlar ---------- */
  const targetLabel = r => {
    const u = user(r.target);
    if (u) return who(u);
    const l = S.listings.find(x => x.id === r.target);
    return l ? `<b>İlan:</b> ${esc(l.title)}` : esc(r.target);
  };
  V.raporlar = v => {
    const open = ['new', 'under_review', 'escalated'];
    const list = S.reports.filter(r => UI.rstatus === 'all' || (UI.rstatus === 'open' ? open.includes(r.status) : r.status === UI.rstatus));
    v.innerHTML = `<section class="card"><div class="panel-head"><div class="filters"><select class="select" id="rs">
        <option value="open" ${UI.rstatus === 'open' ? 'selected' : ''}>Açık raporlar</option><option value="all" ${UI.rstatus === 'all' ? 'selected' : ''}>Tümü</option>
        ${Object.entries(STATUS_R).map(([k, [, t]]) => `<option value="${k}" ${UI.rstatus === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <span class="xs muted">Her işlem Audit Log'a kaydedilir</span></div>
      ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Hedef</th><th>Tür</th><th>Sebep</th><th>Raporlayan</th><th>Durum</th><th>Karar</th></tr></thead>
      <tbody>${list.map(r => `<tr><td>${targetLabel(r)}</td><td class="small">${esc(r.targetType)}</td><td><b>${esc(r.reason)}</b><div class="xs muted">${esc(r.desc) || '—'}</div></td>
        <td class="small">${esc(user(r.by)?.name)}<div class="xs muted">${ago(r.t)}</div></td><td>${chip(STATUS_R, r.status)}</td>
        <td><select class="select inline-input" data-rep="${r.id}">${Object.entries(STATUS_R).map(([k, [, t]]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${icon('flag')}<h4>Rapor yok</h4></div>`}</section>`;
    $('#rs', v).onchange = e => { UI.rstatus = e.target.value; refresh(); };
    $$('[data-rep]', v).forEach(s => s.onchange = () => {
      const r = S.reports.find(x => x.id === s.dataset.rep);
      r.status = s.value; r.reviewedBy = ADMIN; r.reviewedAt = Date.now();
      audit(`Rapor durumu: ${STATUS_R[r.status][1]}`, `${r.id} · ${r.reason} · kim baktı: ${ADMIN}`);
      if (['resolved', 'dismissed'].includes(r.status)) FM.notify(S, r.by, `Raporun sonuçlandı: ${STATUS_R[r.status][1]}`, 'check');
      save(); refresh(); toast('Rapor güncellendi.');
    });
  };

  /* ---------- Sohbetler ---------- */
  V.sohbetler = (v, R) => {
    const c = R.arg && S.convos.find(x => x.id === R.arg);
    if (c) {
      const [a, b] = c.users.map(user);
      audit('Sohbet moderasyon amacıyla görüntülendi', `${c.id} · ${a.name} ↔ ${b.name}`); save();
      v.innerHTML = `<section class="card"><div class="panel-head"><div class="row">${who(a)}<span class="muted">↔</span>${who(b)}</div><a class="btn btn-sm btn-ghost" href="#/sohbetler">← Geri</a></div>
        <div style="padding:20px;display:grid;gap:12px"><p class="hint">${icon('shield', 'ic-sm')} Bu erişim rol bazlı yetki + moderasyon amacıyla yapılır ve Audit Log'a kaydedildi.</p>
        <div class="chat-log">${c.messages.map(m => `<div class="m ${m.from === b.id ? 'r' : ''}"><small>${esc(user(m.from).name)} · ${fmtDate(m.t)}</small>${m.type === 'text' ? esc(m.text) : `[${m.type}]`}</div>`).join('')}</div>
        <div class="acts" style="justify-content:flex-start"><button class="btn btn-sm btn-ghost" data-user="${a.id}">${esc(a.name)} yönet</button><button class="btn btn-sm btn-ghost" data-user="${b.id}">${esc(b.name)} yönet</button></div></div></section>`;
      $$('[data-user]', v).forEach(x => x.onclick = () => userDrawer(x.dataset.user));
      return;
    }
    const reqs = S.requests.slice(0, 12);
    v.innerHTML = `<section class="card"><div class="panel-head"><h3>Sohbetler</h3><span class="xs muted">İçeriğe yalnızca gerekli moderasyon durumlarında erişilir</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Taraflar</th><th>Mesaj</th><th>Son aktivite</th><th>Rapor</th><th></th></tr></thead>
      <tbody>${S.convos.map(c => {
        const [a, b] = c.users.map(user);
        const rep = S.reports.filter(r => c.users.includes(r.target)).length;
        return `<tr><td class="small"><b>${esc(a.name)}</b> ↔ <b>${esc(b.name)}</b></td><td>${c.messages.length}</td><td class="xs muted">${ago(c.messages[c.messages.length - 1]?.t || 0)}</td>
          <td>${rep ? `<span class="flag">${icon('flag')} ${rep}</span>` : '—'}</td><td><div class="acts"><a class="btn btn-sm btn-ghost" href="#/sohbetler/${c.id}">İncele</a></div></td></tr>`;
      }).join('')}</tbody></table></div></section>
      <section class="card"><div class="panel-head"><h3>Mesaj istekleri</h3></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Gönderen → Alıcı</th><th>Mesaj</th><th>Kaynak</th><th>Durum</th><th>Zaman</th></tr></thead>
      <tbody>${reqs.map(r => `<tr><td class="small"><b>${esc(user(r.from)?.name)}</b> → ${esc(user(r.to)?.name)}</td><td class="small">${esc(r.text)}</td><td class="small">${r.via === 'listing' ? 'İlan' : 'Direkt'}</td>
        <td><span class="chip ${{ pending: 'chip-amber', accepted: 'chip-green', rejected: 'chip-red' }[r.status]}">${r.status}</span></td><td class="xs muted">${ago(r.t)}</td></tr>`).join('')}</tbody></table></div></section>`;
  };

  /* ---------- Gelir ---------- */
  V.abonelikler = v => {
    const paid = S.users.filter(u => u.plan !== 'free');
    const tile = (role) => S.config.plans[role].map(p => `<div class="card kpi"><span class="lbl">${role === 'fan' ? 'Fan' : 'Creator'} · ${p.name}</span><span class="val">${S.users.filter(u => u.role === role && u.plan === p.id).length}</span><span class="xs muted">${p.price ? money(p.price) + ' / ay' : 'Ücretsiz'}</span></div>`).join('');
    v.innerHTML = `<div class="kpis">${tile('fan')}${tile('creator')}</div>
      <section class="card"><div class="panel-head"><h3>Ücretli aboneler</h3><span class="xs muted">Fanvue üzerinden 30 günlük yenileme</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Kullanıcı</th><th>Plan</th><th>Son ödeme</th><th>Durum</th><th></th></tr></thead>
      <tbody>${paid.map(u => { const last = S.purchases.find(p => p.userId === u.id && p.type === 'subscription'); return `<tr><td>${who(u)}</td><td>${planChip(u)}</td>
        <td class="small">${last ? `${last.tx} · ${fmtDate(last.t)}` : '<span class="muted">Seed / manuel</span>'}</td><td><span class="chip chip-green">Aktif</span></td>
        <td><div class="acts"><button class="btn btn-sm btn-ghost" data-user="${u.id}">Yönet</button></div></td></tr>`; }).join('')}</tbody></table></div></section>`;
    $$('[data-user]', v).forEach(b => b.onclick = () => userDrawer(b.dataset.user));
  };

  V.jetonlar = v => {
    const verified = S.purchases.filter(p => p.status === 'verified');
    v.innerHTML = `<div class="kpis">
        <div class="card kpi"><span class="lbl">${icon('coin')}Dolaşımdaki jeton</span><span class="val">${S.users.reduce((n, u) => n + (u.tokens || 0), 0)}</span></div>
        <div class="card kpi"><span class="lbl">${icon('card')}Doğrulanmış ödeme</span><span class="val">${verified.length}</span></div>
        <div class="card kpi"><span class="lbl">${icon('chart')}Toplam gelir</span><span class="val">${money(verified.reduce((n, p) => n + p.amount, 0))}</span></div>
        <div class="card kpi"><span class="lbl">${icon('alert')}Başarısız ödeme</span><span class="val">${S.purchases.length - verified.length}</span></div></div>
      <section class="card"><div class="panel-head"><h3>Token Purchases</h3><span class="xs muted">Her işlem benzersiz transaction ID ile tekil kontrol edilir</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>İşlem ID</th><th>Kullanıcı</th><th>Ürün</th><th>Tutar</th><th>Jeton</th><th>Durum</th><th>Zaman</th></tr></thead>
      <tbody>${S.purchases.map(p => `<tr><td><code>${p.tx}</code></td><td class="small">${esc(user(p.userId)?.name)}</td><td class="small">${esc(p.item)}</td><td>${money(p.amount)}</td><td>${p.tokens ? '+' + p.tokens : '—'}</td>
        <td>${p.status === 'verified' ? '<span class="chip chip-green">Verified</span>' : '<span class="chip chip-red">Failed</span>'}</td><td class="xs muted">${fmtDate(p.t)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="panel-head"><h3>Jeton hareketleri</h3></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Kullanıcı</th><th>İşlem</th><th>Miktar</th><th>Zaman</th></tr></thead>
      <tbody>${S.tokenLog.slice(0, 30).map(t => `<tr><td class="small">${esc(user(t.userId)?.name)}</td><td class="small">${esc(t.reason)}</td><td style="color:${t.delta > 0 ? 'var(--green)' : 'inherit'};font-weight:600">${t.delta > 0 ? '+' : ''}${t.delta}</td><td class="xs muted">${fmtDate(t.t)}</td></tr>`).join('')}</tbody></table></div></section>`;
  };

  V.fanvue = v => {
    v.innerHTML = `<section class="card"><div class="panel-head"><h3>Fanvue ürünleri ve Checkout Link'leri</h3><span class="xs muted">Link'ler kod içine gömülmez; buradan yönetilir</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>FanMeet ürünü</th><th>Tür</th><th>Fiyat ($)</th><th>Checkout Link</th><th>Referans</th><th>Aktif</th></tr></thead>
      <tbody>${S.products.map(p => `<tr><td><b>${esc(p.name)}</b>${p.tokens ? `<div class="xs muted">${p.tokens} jeton</div>` : ''}</td>
        <td><span class="chip ${p.type === 'token' ? 'chip-gold' : 'chip-plum'}">${p.type === 'token' ? 'Jeton' : 'Abonelik'}</span></td>
        <td><input class="input num" type="number" step="0.01" data-pp="${p.id}" value="${p.price}"></td>
        <td><input class="input inline-input" style="min-width:260px" data-pl="${p.id}" value="${esc(p.link)}"></td>
        <td class="xs muted">${p.id}</td>
        <td><label class="toggle"><input type="checkbox" data-pa="${p.id}" ${p.active ? 'checked' : ''}><span></span></label></td></tr>`).join('')}</tbody></table></div>
      <div style="padding:16px 20px"><button class="btn btn-dark" id="pv-save">Değişiklikleri Kaydet</button></div></section>
      <section class="card card-pad"><h3 class="serif" style="font-size:22px;margin-bottom:8px">Entegrasyon kuralı</h3>
        <p class="muted">Fanvue = ödeme ve ödeme doğrulama altyapısı. FanMeet = kullanıcı, abonelik, jeton ve ürün haklarının yönetildiği sistem. API anahtarları ve webhook bilgileri yalnızca backend'de saklanır; aynı işlem ID'si ikinci kez işlenmez.</p></section>`;
    $('#pv-save', v).onclick = () => {
      S.products.forEach(p => {
        p.price = parseFloat($(`[data-pp="${p.id}"]`, v).value) || p.price;
        p.link = $(`[data-pl="${p.id}"]`, v).value.trim();
        p.active = $(`[data-pa="${p.id}"]`, v).checked;
        const pk = S.config.packages.find(x => x.id === p.ref && p.type === 'token');
        if (pk) pk.price = p.price;
        if (p.type === 'subscription') { const pl = S.config.plans[p.role].find(x => x.id === p.ref); if (pl) pl.price = p.price; }
      });
      audit('Fanvue ürünleri güncellendi', `${S.products.length} ürün`);
      save(); toast('Ürünler kaydedildi. Uygulamada fiyatlar güncellendi.');
    };
  };

  /* ---------- Platform ---------- */
  V.harita = v => {
    const list = S.users.filter(u => u.status === 'active');
    v.innerHTML = `<section class="card"><div class="panel-head"><h3>Harita yönetimi</h3><span class="xs muted">Haritada Göster ayarı + abonelik/admin kuralları birlikte uygulanır</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Kullanıcı</th><th>İlçe</th><th>Plan</th><th>Kural sonucu</th><th>Haritada Göster</th></tr></thead>
      <tbody>${list.map(u => {
        const ok = u.role === 'creator' ? plan(u).map : u.plan !== 'free';
        return `<tr><td>${who(u)}</td><td class="small">${esc(u.district)}, ${esc(u.city)}<div class="xs muted">~${u.pos[0].toFixed(3)}, ${u.pos[1].toFixed(3)} (rastgele)</div></td><td>${planChip(u)}</td>
          <td>${ok ? '<span class="chip chip-green">Görünür</span>' : `<span class="chip">Plan izin vermiyor</span>`}</td>
          <td><label class="toggle"><input type="checkbox" data-map="${u.id}" ${u.showOnMap ? 'checked' : ''}><span></span></label></td></tr>`;
      }).join('')}</tbody></table></div></section>`;
    $$('[data-map]', v).forEach(i => i.onchange = () => { const u = user(i.dataset.map); u.showOnMap = i.checked; audit(`Harita görünürlüğü: ${i.checked ? 'açık' : 'kapalı'}`, u.id); save(); });
  };

  const TAGS = ['Featured', 'New Creator', 'Verified', 'Pro+ Recommended', 'Platform Selected', 'Special Profile'];
  V.etiketler = v => {
    const creators = S.users.filter(u => u.role === 'creator' && u.status === 'active');
    v.innerHTML = `<section class="card"><div class="panel-head"><h3>Öne çıkanlar ve profil etiketleri</h3><span class="xs muted">"Pro+ Recommended" profilde "Pro+ plan olmanız tavsiye edilir" olarak görünür</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Creator</th><th>Plan / slot</th><th>Etiketler</th><th>Özel etiket</th></tr></thead>
      <tbody>${creators.map(u => `<tr><td>${who(u)}</td><td>${planChip(u)}<div class="xs muted">${plan(u).featured} featured slot</div></td>
        <td><div class="tag-pick">${TAGS.map(t => `<label><input type="checkbox" data-tag="${u.id}" value="${t}" ${u.tags.includes(t) ? 'checked' : ''}>${t}</label>`).join('')}</div></td>
        <td><input class="input inline-input" data-custom="${u.id}" placeholder="Custom" value="${esc(u.tags.filter(t => !TAGS.includes(t)).join(', '))}"></td></tr>`).join('')}</tbody></table></div></section>`;
    const upd = id => {
      const u = user(id);
      const custom = $(`[data-custom="${id}"]`, v).value.split(',').map(s => s.trim()).filter(Boolean);
      u.tags = [...$$(`[data-tag="${id}"]:checked`, v).map(i => i.value), ...custom];
      u.verified = u.tags.includes('Verified') || u.plan === 'pro';
      audit('Profil etiketleri güncellendi', `${u.id} · ${u.tags.join(', ') || '—'}`);
      save(); toast('Etiketler kaydedildi.');
    };
    $$('[data-tag]', v).forEach(i => i.onchange = () => upd(i.dataset.tag));
    $$('[data-custom]', v).forEach(i => i.onchange = () => upd(i.dataset.custom));
  };

  V.bildirimler = v => {
    const emails = S.emails || [];
    v.innerHTML = `<div class="cols"><section class="card"><div class="panel-head"><h3>Site içi bildirimler</h3><span class="xs muted">${S.notifications.length}</span></div>
      <div class="table-wrap"><table class="table"><tbody>${S.notifications.slice(0, 40).map(n => `<tr><td class="small"><b>${esc(user(n.to)?.name)}</b><div>${esc(n.text)}</div></td><td>${n.read ? '<span class="chip">Okundu</span>' : '<span class="chip chip-rose">Yeni</span>'}</td><td class="xs muted" style="white-space:nowrap">${ago(n.t)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="panel-head"><h3>E-posta bildirimleri</h3><span class="xs muted">Simüle edilmiş gönderimler</span></div>
      ${emails.length ? `<div class="table-wrap"><table class="table"><tbody>${emails.slice(0, 40).map(e => `<tr><td class="small"><b>${esc(e.to)}</b><div>${esc(e.subject)}</div></td><td class="xs muted" style="white-space:nowrap">${ago(e.t)}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${icon('mail')}<p>Henüz e-posta gönderilmedi. İlan/fotoğraf kararı veya satın alma sonrası burada görünür.</p></div>`}</section></div>`;
  };

  V.audit = v => {
    v.innerHTML = `<section class="card"><div class="panel-head"><h3>Audit Log</h3><span class="xs muted">Kim baktı · ne zaman · hangi işlem · sonuç</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Zaman</th><th>Admin</th><th>İşlem</th><th>Hedef</th></tr></thead>
      <tbody>${S.audit.map(a => `<tr><td class="small" style="white-space:nowrap">${fmtDate(a.t)}</td><td class="small">${esc(a.admin)}</td><td><b>${esc(a.action)}</b></td><td class="small muted">${esc(a.target)}</td></tr>`).join('')}</tbody></table></div></section>`;
  };

  V.ayarlar = v => {
    const c = S.config;
    const fp = c.plans.fan;
    v.innerHTML = `<div class="settings-grid">
      <section class="card"><div class="panel-head"><h3>İlan süreleri ve jeton maliyeti</h3></div><div class="modal-body">
        ${c.durations.map((d, i) => `<div class="row between"><span><b>${d.h} saat</b></span><span class="row"><input class="input num" type="number" data-dur="${i}" value="${d.cost}"> jeton</span></div>`).join('')}
        <div class="row"><input class="input num" type="number" id="new-h" placeholder="saat"><input class="input num" type="number" id="new-c" placeholder="jeton"><button class="btn btn-sm btn-ghost" id="add-dur">${icon('plus', 'ic-sm')} Süre ekle</button></div>
      </div></section>
      <section class="card"><div class="panel-head"><h3>Kurallar</h3></div><div class="modal-body">
        <div class="row between"><span>Yeni mesaj isteği</span><span class="row"><input class="input num" type="number" id="c-req" value="${c.requestCost}"> jeton</span></div>
        <div class="row between"><span>Sosyal bağlantı açma</span><span class="row"><input class="input num" type="number" id="c-soc" value="${c.socialCost}"> jeton</span></div>
        <div class="row between"><span>24 saatte maks. ilan</span><input class="input num" type="number" id="c-lim" value="${c.dailyListingLimit}"></div>
        <div class="row between"><span>İlanlar arası bekleme</span><span class="row"><input class="input num" type="number" id="c-cool" value="${c.listingCooldownMin}"> dk</span></div>
        <div class="row between"><span>Takdir Et için creator mesajı</span><input class="input num" type="number" id="c-appr" value="${c.appreciateAfter}"></div>
      </div></section>
      <section class="card" style="grid-column:1/-1"><div class="panel-head"><h3>Fan abonelik limitleri</h3><span class="xs muted">Fiyatlar Fanvue Ürünleri sayfasından yönetilir</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Özellik</th>${fp.map(p => `<th>${p.name}</th>`).join('')}</tr></thead><tbody>
        ${[['discover', 'Günlük Discover profili'], ['map', 'Haritada görünen kişi'], ['monthlyRequests', 'Aylık mesaj isteği (boş = sınırsız)'], ['monthlyTokens', '30 günlük yeni jeton']].map(([k, t]) =>
          `<tr><td>${t}</td>${fp.map((p, i) => `<td><input class="input num" type="number" data-fp="${i}" data-k="${k}" value="${p[k] ?? ''}"></td>`).join('')}</tr>`).join('')}
        </tbody></table></div></section>
    </div>
    <div class="row"><button class="btn btn-dark btn-lg" id="cfg-save">Ayarları Kaydet</button><button class="btn btn-ghost" id="cfg-reset">${icon('refresh', 'ic-sm')} Tüm demo verisini sıfırla</button></div>`;
    $('#add-dur', v).onclick = () => {
      const h = +$('#new-h', v).value, cost = +$('#new-c', v).value;
      if (!h || !cost || c.durations.some(d => d.h === h)) return toast('Geçerli ve benzersiz bir süre gir.', true);
      c.durations.push({ h, cost }); c.durations.sort((a, b) => a.h - b.h);
      audit('Yeni ilan süresi eklendi', `${h} saat · ${cost} jeton`); save(); refresh();
    };
    $('#cfg-save', v).onclick = () => {
      $$('[data-dur]', v).forEach(i => { c.durations[+i.dataset.dur].cost = +i.value || c.durations[+i.dataset.dur].cost; });
      c.requestCost = +$('#c-req', v).value; c.socialCost = +$('#c-soc', v).value; c.dailyListingLimit = +$('#c-lim', v).value;
      c.listingCooldownMin = +$('#c-cool', v).value; c.appreciateAfter = +$('#c-appr', v).value;
      fp.forEach(p => { if (p.id !== 'pro') p.social = c.socialCost; });
      $$('[data-fp]', v).forEach(i => { const p = fp[+i.dataset.fp]; p[i.dataset.k] = i.value === '' ? null : +i.value; });
      audit('Sistem ayarları güncellendi', 'İlan/jeton/plan limitleri');
      save(); toast('Ayarlar kaydedildi.');
    };
    $('#cfg-reset', v).onclick = () => { S = FM.reset(); toast('Demo verisi sıfırlandı.'); render(); };
  };

  /* ---------- Başlat ---------- */
  $('#burger').onclick = () => $('#adm-side').classList.toggle('open');
  window.addEventListener('hashchange', () => { close(); render(); scrollTo(0, 0); });
  window.addEventListener('storage', e => {
    if (e.key !== FM.KEY) return;
    S = FM.load();
    if (!document.activeElement || !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) refresh();
  });
  render();
})();
