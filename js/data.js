/* FanMeet demo — mock backend (localStorage). Uygulama ve admin paneli aynı state'i paylaşır. */
(function (w) {
  const KEY = 'fanmeet_demo_v1';
  const H = 3600e3;
  const pic = (g, n) => `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

  const LOCATIONS = {
    'Türkiye': {
      'İstanbul': {
        'Kadıköy': [40.990, 29.028], 'Beşiktaş': [41.043, 29.007], 'Şişli': [41.060, 28.987],
        'Beyoğlu': [41.034, 28.977], 'Üsküdar': [41.023, 29.030], 'Ataşehir': [40.984, 29.107],
        'Bakırköy': [40.980, 28.873], 'Sarıyer': [41.150, 29.050]
      },
      'Ankara': { 'Çankaya': [39.900, 32.860], 'Keçiören': [39.980, 32.860] },
      'İzmir': { 'Konak': [38.419, 27.128], 'Karşıyaka': [38.460, 27.110] }
    }
  };

  // İlçe merkezine deterministik (id bazlı) rastgele sapma: gerçek konum asla kullanılmaz
  function fuzz(id, country, city, district) {
    const base = LOCATIONS[country]?.[city]?.[district] || [41.01, 28.98];
    let s = 0; for (const c of id) s = (s * 31 + c.charCodeAt(0)) % 100000;
    const r1 = ((s % 1000) / 1000 - 0.5) * 0.022;
    const r2 = (((s / 7) % 1000) / 1000 - 0.5) * 0.028;
    return [base[0] + r1, base[1] + r2];
  }

  const CONFIG = {
    durations: [{ h: 12, cost: 30 }, { h: 24, cost: 50 }, { h: 48, cost: 90 }],
    requestCost: 20,
    socialCost: 10,
    dailyListingLimit: 3,
    listingCooldownMin: 60,
    appreciateAfter: 10,
    packages: [
      { id: 'p50', name: 'Başlangıç', tokens: 50, price: 9.90 },
      { id: 'p140', name: 'Popüler', tokens: 140, price: 24.90, tag: 'En çok tercih edilen' },
      { id: 'p300', name: 'Büyük Paket', tokens: 300, price: 44.90 },
      { id: 'p700', name: 'Avantajlı Paket', tokens: 700, price: 89.90, tag: 'En iyi fiyat' }
    ],
    plans: {
      fan: [
        { id: 'free', name: 'Free', price: 0, discover: 10, map: 30, monthlyRequests: 2, social: 10, mapAdv: false, discoverPri: false, visits: false, monthlyTokens: 0 },
        { id: 'premium', name: 'Premium', price: 9.90, discover: 30, map: 50, monthlyRequests: null, social: 10, mapAdv: true, discoverPri: false, visits: false, monthlyTokens: 150 },
        { id: 'plus', name: 'Plus', price: 24.90, discover: 50, map: 100, monthlyRequests: null, social: 10, mapAdv: true, discoverPri: true, visits: true, monthlyTokens: 250 },
        { id: 'pro', name: 'Pro+', price: 49.90, discover: 100, map: 200, monthlyRequests: null, social: 0, mapAdv: true, discoverPri: true, visits: true, monthlyTokens: 400 }
      ],
      creator: [
        { id: 'free', name: 'Free Creator', price: 0, map: false, mapPri: 'Yok', discoverPri: 'Normal', featuredArea: false, featured: 0, boost: 1, stats: 'Temel', payments: false, badge: false },
        { id: 'plus', name: 'Plus Creator', price: 19.90, map: true, mapPri: 'Artırılmış', discoverPri: 'Artırılmış', featuredArea: true, featured: 1, boost: 2, stats: 'Gelişmiş', payments: true, badge: false },
        { id: 'pro', name: 'Pro+ Creator', price: 39.90, map: true, mapPri: 'Yüksek', discoverPri: 'Yüksek', featuredArea: true, featured: 3, boost: 3, stats: 'Gelişmiş+', payments: true, badge: true }
      ]
    }
  };

  function products() {
    const list = [];
    CONFIG.packages.forEach(p => list.push({ id: 'fv_' + p.id, type: 'token', name: `${p.tokens} Jeton`, ref: p.id, price: p.price, tokens: p.tokens, link: `https://fanvue.com/checkout/fm-${p.id}`, active: true }));
    ['fan', 'creator'].forEach(r => CONFIG.plans[r].filter(p => p.price).forEach(p =>
      list.push({ id: `fv_${r}_${p.id}`, type: 'subscription', role: r, name: p.name + (r === 'fan' ? ' (Fan)' : ''), ref: p.id, price: p.price, link: `https://fanvue.com/checkout/fm-${r}-${p.id}`, active: true })));
    return list;
  }

  function user(o) {
    const u = Object.assign({
      country: 'Türkiye', city: 'İstanbul', status: 'active', showOnMap: true, verified: false,
      tags: [], socials: {}, payments: [], appreciated: 0, views: 0, lastActive: Date.now() - 5 * H,
      photos: [], bio: '', createdAt: Date.now() - 40 * 24 * H, email: ''
    }, o);
    u.email = u.email || u.name.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '') + '@mail.com';
    u.pos = fuzz(u.id, u.country, u.city, u.district);
    return u;
  }
  const ph = (id, url, status = 'approved') => ({ id, url, status, t: Date.now() - 20 * H });

  function seed() {
    const t = Date.now();
    const creators = [
      ['c1', 'Luna Aksoy', 24, 'Kadıköy', 'pro', 'women', 44, 'Seyahat ve yaşam vlogları. Hafta sonları Moda sahilinde kahve turları.', { instagram: '@luna.aksoy', tiktok: '@lunaaksoy', youtube: 'Luna Aksoy' }, ['Featured', 'Verified']],
      ['c2', 'Mert Demir', 28, 'Beşiktaş', 'plus', 'men', 32, 'Fitness koçu. Sabah koşuları ve antrenman içerikleri.', { instagram: '@mertfit', youtube: 'MertFit' }, ['Platform Selected']],
      ['c3', 'Selin Arda', 26, 'Beyoğlu', 'pro', 'women', 68, 'Sokak fotoğrafçısı. Galata çevresinde foto yürüyüşleri.', { instagram: '@selin.frames', x: '@selinarda' }, ['Verified']],
      ['c4', 'Kaan Yücel', 30, 'Şişli', 'free', 'men', 45, 'Oyun yayıncısı, akşamları Kick\'te canlıdayım.', { kick: 'kaanplays', x: '@kaanyucel' }, ['New Creator']],
      ['c5', 'Irmak Tan', 23, 'Üsküdar', 'plus', 'women', 65, 'Dans ve koreografi. Stüdyo çalışmaları.', { tiktok: '@irmakdance', instagram: '@irmak.tan' }, []],
      ['c6', 'Ada Şahin', 27, 'Ataşehir', 'plus', 'women', 21, 'Yemek içerikleri, İstanbul\'un gizli lezzet durakları.', { youtube: 'AdaYiyor', instagram: '@adayiyor' }, ['Pro+ Recommended']],
      ['c7', 'Emir Koç', 25, 'Sarıyer', 'free', 'men', 76, 'Doğa yürüyüşleri ve kamp. Belgrad Ormanı rehberi.', { instagram: '@emirkoc.outdoor' }, []],
      ['c8', 'Defne Uslu', 29, 'Bakırköy', 'pro', 'women', 50, 'Müzisyen. Akustik setler ve söyleşiler.', { youtube: 'Defne Uslu Music', instagram: '@defneuslu' }, ['Featured', 'Verified']],
      ['c9', 'Bora Sezer', 31, 'Kadıköy', 'plus', 'men', 52, 'Podcast sunucusu. Teknoloji ve girişimcilik sohbetleri.', { x: '@borasezer', youtube: 'Bora Konuşuyor' }, []],
      ['c10', 'Nil Erdem', 22, 'Beşiktaş', 'free', 'women', 90, 'Moda ve stil. Vintage mağaza turları.', { instagram: '@nilerdem', tiktok: '@nilstyle' }, ['New Creator']]
    ].map(([id, name, age, district, plan, g, n, bio, socials, tags]) => user({
      id, name, age, district, plan, role: 'creator', bio, socials, tags,
      verified: plan === 'pro', views: 200 + n * 13,
      photo: pic(g, n),
      photos: [ph(id + 'p1', pic(g, n)), ph(id + 'p2', `https://picsum.photos/seed/${id}a/600/800`), ph(id + 'p3', `https://picsum.photos/seed/${id}b/600/800`)],
      payments: plan === 'free' ? [] : [{ label: 'Destek Ol', url: `https://buymeacoffee.com/${id}` }],
      lastActive: t - (n % 5) * 20 * H
    }));

    const fans = [
      ['f1', 'Cem Aydın', 29, 'Kadıköy', 'plus', 'men', 12, 4], ['f2', 'Zeynep Kurt', 24, 'Beşiktaş', 'pro', 'women', 17, 9],
      ['f3', 'Burak Öz', 33, 'Şişli', 'premium', 'men', 22, 1], ['f4', 'Elif Çelik', 21, 'Üsküdar', 'free', 'women', 29, 0],
      ['f5', 'Onur Gök', 27, 'Ataşehir', 'plus', 'men', 36, 2], ['f6', 'Melis Ay', 26, 'Beyoğlu', 'premium', 'women', 37, 5],
      ['f7', 'Tolga Er', 35, 'Bakırköy', 'free', 'men', 41, 0], ['f8', 'Sude Bal', 23, 'Sarıyer', 'pro', 'women', 57, 7]
    ].map(([id, name, age, district, plan, g, n, appreciated]) => user({
      id, name, age, district, plan, role: 'fan', appreciated, photo: pic(g, n),
      photos: [ph(id + 'p1', pic(g, n))], bio: 'Konserleri, kahveyi ve yeni insanlarla tanışmayı seviyorum.',
      lastActive: t - (n % 4) * 30 * H
    }));

    const me = [
      user({ id: 'me_fan', name: 'Deniz Kaya', age: 27, district: 'Beşiktaş', plan: 'free', role: 'fan', tokens: 60, appreciated: 3,
        photo: pic('men', 75), photos: [ph('mfp1', pic('men', 75))], bio: 'Yayınları takip ediyorum, yeni şehir planlarına açığım.', lastActive: t, email: 'deniz@demo.com' }),
      user({ id: 'me_creator', name: 'Ece Yıldız', age: 25, district: 'Kadıköy', plan: 'plus', role: 'creator', tokens: 120, views: 842,
        photo: pic('women', 33), bio: 'Lifestyle & seyahat içerik üreticisi. Hafta sonları şehir turları.',
        photos: [ph('mcp1', pic('women', 33)), ph('mcp2', 'https://picsum.photos/seed/ece2/600/800'), ph('mcp3', 'https://picsum.photos/seed/ece3/600/800', 'pending')],
        socials: { instagram: '@ece.yildiz', tiktok: '@eceyildiz', youtube: 'Ece Yıldız' },
        payments: [{ label: 'Destek Ol', url: 'https://buymeacoffee.com/ece' }], tags: ['New Creator'], lastActive: t, email: 'ece@demo.com' })
    ];

    const applicants = [
      user({ id: 'a1', name: 'Yağmur Tekin', age: 24, district: 'Şişli', plan: 'free', role: 'creator', status: 'application', photo: pic('women', 8),
        photos: [ph('a1p1', pic('women', 8), 'pending')], socials: { instagram: '@yagmurtekin', tiktok: '@yagmur.t' }, bio: 'Makyaj ve güzellik içerikleri.', createdAt: t - 5 * H }),
      user({ id: 'a2', name: 'Arda Kılıç', age: 27, district: 'Kadıköy', plan: 'free', role: 'creator', status: 'application', photo: pic('men', 18),
        photos: [ph('a2p1', pic('men', 18), 'pending')], socials: { kick: 'ardakilic', youtube: 'Arda Oynuyor' }, bio: 'FPS oyun yayıncısı.', createdAt: t - 26 * H })
    ];
    const pendingFanPhoto = user({ id: 'f9', name: 'Kerem Yıldırım', age: 30, district: 'Konak', city: 'İzmir', plan: 'free', role: 'fan', photo: pic('men', 61),
      photos: [ph('f9p1', pic('men', 61), 'pending')], createdAt: t - 3 * H });

    const users = [...me, ...creators, ...fans, ...applicants, pendingFanPhoto];

    const L = (id, ownerId, title, desc, hours, ageH, extra = {}) => {
      const o = users.find(u => u.id === ownerId);
      return Object.assign({
        id, ownerId, title, desc, hours, cost: CONFIG.durations.find(d => d.h === hours).cost,
        city: o.city, district: o.district, status: 'approved', createdAt: t - ageH * H - H,
        approvedAt: t - ageH * H, expiresAt: t - ageH * H + hours * H,
        views: Math.round(40 + (hours * 7 + ageH * 13) % 300), requests: Math.round(2 + (hours + ageH * 3) % 25), clicks: 0, note: '', history: []
      }, extra);
    };
    const listings = [
      L('l1', 'c1', 'Bugün Moda\'da kahve turu', 'Bugün öğleden sonra Moda sahilinde kahve turu yapacağım. Bana katılmak isteyenler mesaj atabilir, küçük bir grupla takılalım.', 24, 3),
      L('l2', 'c2', 'Sabah koşusu — Bebek sahili', 'Yarın sabah 07:00\'de Bebek\'ten Arnavutköy\'e 8 km tempolu koşu. Birlikte koşmak isteyen var mı?', 12, 2),
      L('l3', 'c3', 'Galata\'da gün batımı foto yürüyüşü', 'Kamera ya da telefon fark etmez. Gün batımında Galata ve Karaköy sokaklarında kare avına çıkıyoruz.', 48, 10),
      L('l4', 'f2', 'Bu akşam konser için arkadaş arıyorum', 'Zorlu PSM\'deki akustik konsere tek başıma gitmek istemiyorum, müzik seven biriyle gitmek isterim.', 12, 1),
      L('l5', 'c8', 'Akustik set sonrası söyleşi', 'Cuma akşamı Bakırköy\'de küçük bir set yapıyorum. Sonrasında dinleyicilerle sohbet edeceğiz.', 48, 30),
      L('l6', 'c6', 'Kadıköy çarşı lezzet turu', 'Kadıköy çarşısında 5 durakta lezzet turu çekiyorum. Kameraya girmek isteyen 2 kişi arıyorum.', 24, 18),
      L('l7', 'f5', 'Birlikte spor yapmak isteyen var mı?', 'Ataşehir\'de akşamları salona gidiyorum, antrenman partneri arıyorum.', 24, 6),
      L('l8', 'c9', 'Canlı podcast kaydına konuk', 'Girişimcilik bölümü için dinleyici sorusu soracak 3 kişi arıyorum. Stüdyo Kadıköy\'de.', 48, 40),
      L('l9', 'c5', 'Dans atölyesi — başlangıç seviyesi', 'Pazar günü Üsküdar\'daki stüdyoda ücretsiz tanışma atölyesi yapıyorum.', 24, 26, { status: 'expired' }),
      L('l10', 'c4', 'Turnuva izleme buluşması', 'Final maçını birlikte izleyelim, Şişli\'de bir kafede büyük ekran ayarladım.', 12, 0, { status: 'pending', approvedAt: null, expiresAt: null, createdAt: t - 0.5 * H, views: 0, requests: 0 }),
      L('l11', 'f7', 'Ücretli hizmet veriyorum, yazın', 'Detaylar için DM. Hızlı dönüş.', 24, 0, { status: 'pending', approvedAt: null, expiresAt: null, createdAt: t - 2 * H, views: 0, requests: 0 }),
      L('l12', 'me_fan', 'Hafta sonu müze gezisi', 'Müze.', 24, 0, { status: 'revision', approvedAt: null, expiresAt: null, createdAt: t - 20 * H, views: 0, requests: 0,
        note: 'İlan açıklamanız çok genel. Buluşmanın amacı ve şehir bilgisini daha açık belirtin.' })
    ];

    const msg = (from, text, agoMin, type = 'text') => ({ id: 'm' + Math.random().toString(36).slice(2, 9), from, type, text, t: t - agoMin * 60e3 });
    const convos = [
      { id: 'cv1', users: ['me_fan', 'c1'], messages: [
        msg('me_fan', 'Merhaba Luna! Moda turu ilanını gördüm, katılmak isterim.', 300),
        msg('c1', 'Selam Deniz, çok iyi! Saat 15:00 gibi başlıyoruz 😊', 280),
        msg('me_fan', 'Harika, orada olurum.', 270),
        msg('c1', 'Buluşma noktasını birazdan paylaşırım.', 40)] },
      { id: 'cv2', users: ['me_fan', 'c3'], messages: [
        msg('me_fan', 'Fotoğraflarınız çok iyi, yürüyüşe acemiler de katılabilir mi?', 1500),
        msg('c3', 'Tabii ki! Telefon kamerası bile yeterli.', 1440)] },
      { id: 'cv3', users: ['me_creator', 'f1'], messages: Array.from({ length: 12 }, (_, i) =>
        msg(i % 2 ? 'f1' : 'me_creator', i % 2 ? ['Çok teşekkürler!', 'Harika bir içerikti.', 'Bir sonraki tur ne zaman?', 'Kesinlikle katılırım.', 'Görüşmek üzere!', '👋'][i >> 1] :
          ['Merhaba Cem, isteğini kabul ettim.', 'Cumartesi turumuz var.', 'Kadıköy iskelede buluşuyoruz.', 'Saat 14:00 uygun mu?', 'Süper, listeye ekledim.', 'Görüşürüz!'][i >> 1], 900 - i * 60))
        .concat(Array.from({ length: 5 }, (_, i) => msg('me_creator', ['Bu arada rota hazır.', 'Yanına rahat ayakkabı al.', 'Hava güzel görünüyor.', 'Kahve molası da var.', 'Yarın hatırlatırım.'][i], 200 - i * 10))) },
      { id: 'cv4', users: ['me_creator', 'f2'], messages: [
        msg('f2', 'Merhaba Ece, turuna katılabilir miyim?', 600),
        msg('me_creator', 'Merhaba Zeynep, tabii ki!', 590),
        msg('me_creator', 'Detayları yakında paylaşacağım.', 580)] }
    ];

    const requests = [
      { id: 'r1', from: 'c8', to: 'me_fan', text: 'Merhaba! Cuma setime ilgini gördüm, gelmek ister misin?', t: t - 2 * H, status: 'pending', via: 'direct' },
      { id: 'r2', from: 'f3', to: 'me_creator', text: 'Selam Ece, Kadıköy turu ilanın için yazıyorum. Yerin kaldı mı?', t: t - 1 * H, status: 'pending', via: 'listing', listingId: null },
      { id: 'r3', from: 'f6', to: 'me_creator', text: 'İçeriklerini çok seviyorum, tanışmak isterim!', t: t - 5 * H, status: 'pending', via: 'direct' },
      { id: 'r4', from: 'f8', to: 'me_creator', text: 'Merhaba, bir sonraki şehir turu ne zaman?', t: t - 9 * H, status: 'pending', via: 'direct' }
    ];

    const appreciations = [{ creatorId: 'me_creator', fanId: 'f2', active: false, at: null, withdrawnAt: null }];

    const notifications = [
      { id: 'n1', to: 'me_fan', icon: 'alert', text: 'İlanınız için düzeltme istendi: "Hafta sonu müze gezisi"', t: t - 19 * H, read: false, link: '#/ilanlar?tab=mine' },
      { id: 'n2', to: 'me_fan', icon: 'mail', text: 'Defne Uslu size mesaj isteği gönderdi.', t: t - 2 * H, read: false, link: '#/mesajlar?tab=requests' },
      { id: 'n3', to: 'me_creator', icon: 'check', text: 'Fotoğrafınız onaylandı.', t: t - 30 * H, read: true, link: '#/profil' },
      { id: 'n4', to: 'me_creator', icon: 'mail', text: '3 yeni mesaj isteğiniz var.', t: t - 1 * H, read: false, link: '#/mesajlar?tab=requests' }
    ];

    const reports = [
      { id: 'rp1', by: 'f4', target: 'l11', targetType: 'İlan', reason: 'Spam', desc: 'Ücretli hizmet reklamı gibi duruyor.', status: 'new', t: t - 1.5 * H },
      { id: 'rp2', by: 'c5', target: 'f7', targetType: 'Kullanıcı davranışı', reason: 'Taciz', desc: 'Sürekli aynı mesajı atıyor.', status: 'under_review', t: t - 20 * H },
      { id: 'rp3', by: 'f1', target: 'c10', targetType: 'Profil fotoğrafı', reason: 'Sahte profil', desc: '', status: 'dismissed', t: t - 70 * H }
    ];

    const purchases = [
      { tx: 'FV-8H2K91', userId: 'f2', item: 'Pro+ (Fan)', type: 'subscription', amount: 49.90, tokens: 400, status: 'verified', t: t - 50 * H },
      { tx: 'FV-3JD01A', userId: 'f1', item: '140 Jeton', type: 'token', amount: 24.90, tokens: 140, status: 'verified', t: t - 30 * H },
      { tx: 'FV-9QW7ZP', userId: 'c1', item: 'Pro+ Creator', type: 'subscription', amount: 39.90, tokens: 0, status: 'verified', t: t - 90 * H },
      { tx: 'FV-5KX22M', userId: 'f5', item: '300 Jeton', type: 'token', amount: 44.90, tokens: 300, status: 'verified', t: t - 8 * H },
      { tx: 'FV-1PL0QS', userId: 'f6', item: 'Premium (Fan)', type: 'subscription', amount: 9.90, tokens: 150, status: 'failed', t: t - 4 * H }
    ];

    const tokenLog = [
      { userId: 'me_fan', delta: -50, reason: 'İlan (24 saat)', t: t - 20 * H },
      { userId: 'me_fan', delta: -20, reason: 'Mesaj isteği · Luna Aksoy', t: t - 6 * H },
      { userId: 'me_creator', delta: -30, reason: 'İlan (12 saat)', t: t - 40 * H }
    ];

    const audit = [
      { id: 'au1', admin: 'admin@fanmeet', action: 'İlan düzeltme istendi', target: 'l12 · Hafta sonu müze gezisi', t: t - 19 * H },
      { id: 'au2', admin: 'admin@fanmeet', action: 'Rapor geçersiz bulundu', target: 'rp3', t: t - 60 * H },
      { id: 'au3', admin: 'mod@fanmeet', action: 'Fotoğraf onaylandı', target: 'mcp2 · Ece Yıldız', t: t - 30 * H }
    ];

    return {
      v: 1, role: 'fan', config: CONFIG, products: products(), users, listings, convos, requests, appreciations,
      notifications, reports, purchases, tokenLog, audit, unlocked: { me_fan: ['c1'], me_creator: [] },
      discover: {}, blocked: [], prefs: { emailNotif: true, siteNotif: true }
    };
  }

  const FM = {
    LOCATIONS, H, fuzz,
    load() {
      try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) { /* yok say */ }
      const s = seed(); FM.save(s); return s;
    },
    save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* yok say */ } },
    reset() { try { localStorage.removeItem(KEY); } catch (e) { /* yok say */ } return FM.load(); },
    KEY,
    uid: (p = 'x') => p + Math.random().toString(36).slice(2, 8),
    tx: () => 'FV-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    expireListings(s) {
      let changed = false;
      s.listings.forEach(l => { if (l.status === 'approved' && l.expiresAt < Date.now()) { l.status = 'expired'; changed = true; } });
      return changed;
    },
    plan(s, u) { return s.config.plans[u.role].find(p => p.id === u.plan) || s.config.plans[u.role][0]; },
    notify(s, to, text, icon = 'bell', link = '') {
      s.notifications.unshift({ id: FM.uid('n'), to, icon, text, t: Date.now(), read: false, link });
    },
    // Uygulamanın e-posta kanalını simüle eder (admin > E-postalar)
    email(s, to, subject) { (s.emails = s.emails || []).unshift({ to, subject, t: Date.now() }); },
    // Ortak yardımcılar
    esc: v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    ago(t) {
      const d = (Date.now() - t) / 60e3;
      if (d < 1) return 'şimdi'; if (d < 60) return Math.floor(d) + ' dk önce';
      if (d < 1440) return Math.floor(d / 60) + ' sa önce'; return Math.floor(d / 1440) + ' gün önce';
    },
    left(t) {
      const m = Math.max(0, (t - Date.now()) / 60e3);
      if (m <= 0) return 'Süresi doldu';
      const h = Math.floor(m / 60), mm = Math.floor(m % 60);
      return h ? `${h} sa ${mm} dk` : `${mm} dk`;
    },
    money: n => '$' + n.toFixed(2).replace('.', ',')
  };
  w.FM = FM;
})(window);
