const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

let xssUkljuceno = true;
let sdeUkljuceno = true;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashLozinka(lozinka) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.scryptSync(lozinka, salt, 16).toString('hex');
  return salt + ':' + hash;
}

const KLJUC = crypto.scryptSync(process.env.ENC_SECRET || 'lokalni-kljuc-za-testiranje', 'web2-lab2', 32);

function sifriraj(tekst) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KLJUC, iv);
  let enc = cipher.update(String(tekst), 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}

function desifriraj(zapis) {
  const [ivHex, encHex] = zapis.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', KLJUC, Buffer.from(ivHex, 'hex'));
  let dec = decipher.update(encHex, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function maskiraj(val) {
  const s = String(val).replace(/\s+/g, '');
  if (s.length <= 4) return '****';
  return '*'.repeat(s.length - 4) + s.slice(-4);
}

function napraviKorisnika(id, korisnik, lozinka, oib, kartica) {
  if (sdeUkljuceno) {
    return { id, korisnik, lozinka, oib, kartica, zasticeno: false };
  }
  return {
    id,
    korisnik,
    lozinka: hashLozinka(lozinka),
    oib: sifriraj(oib),
    kartica: sifriraj(kartica),
    zasticeno: true,
  };
}

function zastitiPostojece() {
  korisnici = korisnici.map((u) => {
    if (u.zasticeno) return u;
    return {
      id: u.id,
      korisnik: u.korisnik,
      lozinka: hashLozinka(u.lozinka),
      oib: sifriraj(u.oib),
      kartica: sifriraj(u.kartica),
      zasticeno: true,
    };
  });
}

function pocetniKorisnici() {
  return [
    napraviKorisnika(1, 'ana', 'tajna123', '12345678901', '4111222233334444'),
    napraviKorisnika(2, 'marko', 'lozinka456', '98765432109', '5500111122228888'),
  ];
}

let komentari = [
  { autor: 'ana', tekst: 'Pozdrav, ovo je obican komentar.' }
];

let korisnici = pocetniKorisnici();

app.get('/', (req, res) => {
  res.cookie('session_id', 'tajna_sjednica_0036557863', {
    httpOnly: !xssUkljuceno,
    path: '/',
  });

  const komentariHtml = komentari
    .map((k) => {
      const autor = xssUkljuceno ? k.autor : escapeHtml(k.autor);
      const tekst = xssUkljuceno ? k.tekst : escapeHtml(k.tekst);
      return `<p><b>${autor}:</b> ${tekst}</p>`;
    })
    .join('');

  const korisniciHtml = korisnici
    .map((u) => `
        <tr>
          <td>${u.id}</td>
          <td>${escapeHtml(u.korisnik)}</td>
          <td class="mali">${escapeHtml(u.lozinka)}</td>
          <td class="mali">${escapeHtml(u.oib)}</td>
          <td class="mali">${escapeHtml(u.kartica)}</td>
          <td>${u.zasticeno ? 'da' : 'NE'}</td>
        </tr>
      `)
    .join('');

  res.send(`<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8" />
  <title>Web2 - Lab 2</title>
  <style>
    body { font-family: Verdana, sans-serif; font-size: 14px; margin: 24px; background: #fcfcfc; }
    fieldset { border: 1px solid #999; padding: 14px 18px; margin-bottom: 20px; background: #fff; max-width: 850px; }
    legend { font-weight: bold; font-size: 16px; padding: 0 6px; }
    .upute { font-size: 13px; color: #333; margin-top: 4px; margin-bottom: 12px; }
    code { background: #eee; padding: 2px 5px; border: 1px solid #ddd; }
    form { margin-bottom: 10px; }
    .mali { font-family: monospace; font-size: 11px; word-break: break-all; max-width: 240px; }
  </style>
</head>
<body>
  <h1>Web2 - 2. laboratorijska vježba</h1>
  <p>JMBAG: 0036557863</p>

  <fieldset>
    <legend>1. Cross-Site Scripting (XSS)</legend>
    <p class="upute">
      <b>Upute:</b> Upisite komentar, a za testiranje XSS-a mozete upisati:
      <code>&lt;script&gt;alert(document.cookie)&lt;/script&gt;</code>.
      Kad je ranjivost ukljucena, skripta se izvrsi i prikaze kolacic. Kad je iskljucena, unos se escapa i kolacic dobiva HttpOnly.
    </p>

    <form action="/toggle-xss" method="POST">
      <label>
        <input type="checkbox" name="on" value="1" ${xssUkljuceno ? 'checked' : ''} onchange="this.form.submit()" />
        Omogući ranjivost (${xssUkljuceno ? 'uključeno' : 'isključeno'})
      </label>
    </form>

    <form action="/komentar" method="POST">
      Autor: <input type="text" name="autor" required />
      Komentar: <input type="text" name="tekst" size="40" required />
      <button type="submit">Objavi</button>
    </form>

    <form action="/komentari-reset" method="POST">
      <button type="submit">Obriši komentare</button>
    </form>

    <div>
      ${komentariHtml}
    </div>
  </fieldset>

  <fieldset>
    <legend>2. Nesigurna pohrana osjetljivih podataka (Sensitive Data Exposure)</legend>
    <p class="upute">
      <b>Upute:</b> Tablica ispod prikazuje sadrzaj baze tocno onako kako je spremljen.
      Kad je ranjivost ukljucena, lozinka, OIB i kartica se spremaju kao obican tekst i /api/users ih vraca sve.
      Kad je iskljucena, lozinka se hashira (scrypt + salt), OIB i kartica se sifriraju (AES-256-CBC),
      a /api/users vraca samo maskirane podatke bez lozinke. Iskljucivanjem ranjivosti se i postojeci zapisi odmah zastite.<br />
      <i>Napomena:</i> Buduci da je hashiranje jednosmjerno, ako nakon iskljucivanja ponovno ukljucite ranjivost, postojeci zapisi ostaju zasticeni dok ne dodate novog korisnika ili kliknete "Resetiraj korisnike".
    </p>

    <form action="/toggle-sde" method="POST">
      <label>
        <input type="checkbox" name="on" value="1" ${sdeUkljuceno ? 'checked' : ''} onchange="this.form.submit()" />
        Omogući ranjivost (${sdeUkljuceno ? 'uključeno' : 'isključeno'})
      </label>
    </form>

    <form action="/korisnik" method="POST">
      Korisnik: <input type="text" name="korisnik" size="10" required />
      Lozinka: <input type="password" name="lozinka" size="10" required />
      OIB: <input type="text" name="oib" size="12" required />
      Kartica: <input type="text" name="kartica" size="16" required />
      <button type="submit">Spremi korisnika</button>
    </form>

    <form action="/korisnici-reset" method="POST">
      <button type="submit">Resetiraj korisnike</button>
      <a href="/api/users" target="_blank">Prikaži /api/users (JSON)</a>
    </form>

    <table border="1" cellpadding="4" cellspacing="0">
      <tr>
        <th>ID</th>
        <th>Korisnik</th>
        <th>Lozinka</th>
        <th>OIB</th>
        <th>Kartica</th>
        <th>Zasticeno</th>
      </tr>
      ${korisniciHtml}
    </table>
  </fieldset>
</body>
</html>`);
});

app.post('/toggle-xss', (req, res) => {
  xssUkljuceno = req.body.on === '1';
  res.redirect('/');
});

app.post('/toggle-sde', (req, res) => {
  sdeUkljuceno = req.body.on === '1';
  if (!sdeUkljuceno) {
    zastitiPostojece();
  }
  komentari = [{ autor: 'ana', tekst: 'Pozdrav, ovo je obican komentar.' }];
  res.redirect('/');
});

app.post('/komentar', (req, res) => {
  const autor = (req.body.autor || '').trim();
  const tekst = (req.body.tekst || '').trim();
  if (autor && tekst) {
    komentari.push({ autor, tekst });
  }
  res.redirect('/');
});

app.post('/komentari-reset', (req, res) => {
  komentari = [{ autor: 'ana', tekst: 'Pozdrav, ovo je obican komentar.' }];
  res.redirect('/');
});

app.post('/korisnik', (req, res) => {
  const korisnik = (req.body.korisnik || '').trim();
  const lozinka = req.body.lozinka || '';
  const oib = (req.body.oib || '').trim();
  const kartica = (req.body.kartica || '').trim();

  if (korisnik && lozinka && oib && kartica) {
    korisnici.push(napraviKorisnika(korisnici.length + 1, korisnik, lozinka, oib, kartica));
  }
  komentari = [{ autor: 'ana', tekst: 'Pozdrav, ovo je obican komentar.' }];
  res.redirect('/');
});

app.post('/korisnici-reset', (req, res) => {
  korisnici = pocetniKorisnici();
  komentari = [{ autor: 'ana', tekst: 'Pozdrav, ovo je obican komentar.' }];
  res.redirect('/');
});

app.get('/api/users', (req, res) => {
  if (sdeUkljuceno) {
    return res.json(korisnici);
  }
  return res.json(
    korisnici.map((u) => ({
      id: u.id,
      korisnik: u.korisnik,
      oib: maskiraj(u.zasticeno ? desifriraj(u.oib) : u.oib),
      kartica: maskiraj(u.zasticeno ? desifriraj(u.kartica) : u.kartica),
    }))
  );
});

app.listen(PORT, () => {
  console.log('Server radi na portu ' + PORT);
});
