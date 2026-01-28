# 🗺️ Mapa zvuka (Sound Map)

**Odjek naše svakodnevice.**

Interaktivna karta zvučnih pejzaža grada. Ovaj projekt omogućuje korisnicima snimanje, upload i istraživanje zvukova iz okoline, kategoriziranih prema vrsti i osjećaju koji izazivaju.

## ✨ Značajke

-   **Interaktivna Mapa**: Bazirana na Leaflet.js, s custom markerima.
-   **Snimanje Zvuka**: Integrirani audio snimač direktno u pregledniku.
-   **Upload**: Jednostavno učitavanje audio datoteka putem Cloudinary servisa.
-   **Filtri**: Filtriranje točaka po osjećajima (Sretno, Opušteno, Stresno, Neutralno).
-   **Statistika Uživo**: "Status Bar" na dnu koji prikazuje puls grada (broj snimki, dominantna vibra) ovisno o pogledu.
-   **Teme**: Automatski Light/Dark mode ovisno o postavkama sustava.
-   **Caching**: Brzo učitavanje zahvaljujući LocalStorage predmemoriranju podataka.

## 🚀 Instalacija i Pokretanje

Ovaj projekt je statička web aplikacija (HTML/CSS/JS), što znači da ne zahtijeva složeni backend server za hostanje frontend dijela.

### Lokalno Pokretanje
1.  Klonirajte repozitorij ili preuzmite datoteke.
2.  Otvorite `index.html` u pregledniku.
    *   *Napomena:* Zbog sigurnosnih politika preglednika (CORS), funkcionalnosti poput mikrofona ili dohvaćanja JSON-a možda neće raditi ako samo otvorite file. Preporuča se korištenje lokalnog servera (npr. VS Code "Live Server" ekstenzija).

### GitHub Pages Deployment (Preporučeno)
1.  Uploadajte kod na GitHub repozitorij.
2.  Idite na **Settings** > **Pages**.
3.  Pod "Source" odaberite `main` (ili `master`) granu.
4.  Spremite. Vaša karta će biti dostupna na `https://vase-ime.github.io/ime-repozitorija/`.

## ⚙️ Konfiguracija

Projekt koristi `config.js` za vanjske servise.

### 1. Google Sheets (Baza podataka)
Podaci o markerima se čuvaju u Google Tablici. Google Apps Script služi kao API.
-   **URL**: Definiran u `CONFIG.APPS_SCRIPT_URL`.
-   Skripta mora biti objavljena kao "Web App" s pristupom "Anyone".

### 2. Cloudinary (Audio Hosting)
Audio datoteke se spremaju na Cloudinary.
-   **Cloud Name**: `CONFIG.CLOUDINARY_CLOUD_NAME`
-   **Upload Preset**: `CONFIG.CLOUDINARY_UPLOAD_PRESET` (Mora biti **Unsigned**).

## 📂 Struktura Projekta

-   `index.html` - Glavna struktura aplikacije.
-   `style.css` - Svi stilovi, animacije i teme.
-   `main.js` - Logika aplikacije (mapa, snimanje, dohvaćanje podataka).
-   `config.js` - Konfiguracijske varijable.
-   `logo.png` - Logotip aplikacije.

## 🛡️ Sigurnost

-   Cloudinary preset je "Unsigned", što omogućuje upload s klijentske strane bez otkrivanja tajnih API ključeva.
-   Google Apps Script URL je javan, ali samo za čitanje/pisanje na predviđeni način.

## 📄 Licenca

Ovaj projekt je otvorenog koda (Open Source).
