# Web2 - Drugi projekt

Aplikacija za demonstraciju ranjivosti (JMBAG: 0036557863):
1. Cross-Site Scripting (Stored XSS) - 1 + JMBAG % 2 = 2
2. Nesigurna pohrana osjetljivih podataka (Sensitive Data Exposure) - 1 + JMBAG % 4 = 4

## Pokretanje lokalno

```bash
npm install
npm start
```

Aplikacija radi na `http://localhost:3000`.

Opcionalno se moze postaviti varijabla okoline `ENC_SECRET` (iz nje se izvodi AES kljuc).
Ako nije postavljena koristi se zadani kljuc, sto je ok samo za testiranje.

## Testiranje

### XSS
- Ranjivost ukljucena: u komentar upisati `<script>alert(document.cookie)</script>` i objaviti.
  Skripta se izvrsi i prikaze se kolacic `session_id`.
- Ranjivost iskljucena: isti komentar se prikaze kao obican tekst (escapa se), a kolacic
  dobiva `HttpOnly` pa ga JavaScript ne moze procitati.

### Sensitive Data Exposure
- Tablica prikazuje sadrzaj "baze" tocno onako kako je spremljen.
- Ranjivost ukljucena: lozinka, OIB i kartica su spremljeni kao obican tekst, a `/api/users`
  vraca sve podatke ukljucujuci lozinke.
- Ranjivost iskljucena: lozinka se hashira (scrypt + salt), OIB i kartica se sifriraju
  (AES-256-CBC), a `/api/users` vraca samo maskirane podatke bez lozinke.
  Kod iskljucivanja se i postojeci plaintext zapisi odmah zastite.
- Napomena: buduci da je hashiranje jednosmjerno, ako se ranjivost iskljuci pa ponovno ukljuci,
  stari zapisi ostaju hashirani/sifrirani dok se ne klikne "Resetiraj korisnike" ili doda novi korisnik.

Napomena: podaci se cuvaju u memoriji, pa se kod restarta servera (npr. kad se Render uspava)
vracaju na pocetno stanje. Prekidaci su globalni, tj. isti su za sve posjetitelje.
