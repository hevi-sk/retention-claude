# Hevisleep Retention Dashboard

Multi-shop retention & cohort analytics dashboard for StretchFit e-shops (SK, CZ, DK, HU).

## Features

- **Shop filter** — prepínanie medzi All / SK / CZ / DK / HU
- **Product filter** — filtrovanie podľa produktu v 1., 2., alebo 3. objednávke
- **Kohortová analýza** — 30/60/90-dňová retencia po kohortách
- **Čas do 2. objednávky** — medián, distribúcia, percentily
- **Produktová retencia** — ktoré produkty vedú k opakovaným nákupom
- **Product journey** — aké produkty kupujú zákazníci v 1. → 2. → 3. objednávke
- **Trendy** — tržby, AOV, repeat podiel v čase

## Tech Stack

- **Next.js 14** (App Router)
- **React** + **Recharts** pre grafy
- **Tailwind CSS** pre styling
- **Google Sheets API** ako data source (read-only)
- **Vercel** pre hosting

## Setup

### 1. Google Sheets

Vytvor Google Sheet s rovnakou štruktúrou ako Shopify Funnel export:
- `Order Name`, `Date`, `Customer ID`, `Customer Order Index`, `Product Title`, `E-shop`, `Total Sales (EUR)`, `Orders`

Nastav sheet ako **"Anyone with the link can view"**.

Sheet ID nájdeš v URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

### 2. Google Sheets API

1. Choď na [Google Cloud Console](https://console.cloud.google.com/)
2. Vytvor nový projekt
3. Zapni **Google Sheets API**
4. Vytvor **Service Account** → stiahni JSON kľúč
5. Zdieľaj Google Sheet s emailom service accountu

### 3. Environment Variables

Vytvor `.env.local`:

```
GOOGLE_SHEETS_ID=your_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Otvor `http://localhost:3000`

### 5. Deploy na Vercel

```bash
npm i -g vercel
vercel
```

Nastav environment variables vo Vercel dashboarde.

## Automatický refresh dát

Dashboard načítava dáta z Google Sheets pri každom requeste (s ISR cache 1 hodina).
Keď aktualizuješ Sheet (manuálne alebo cez Shopify automatizáciu), dashboard sa automaticky aktualizuje.

## Shopify → Google Sheets automatizácia

Odporúčané možnosti:
1. **Shopify Flow + Google Sheets** — natívne, zadarmo
2. **Matrixify** — Shopify appka na scheduled exports
3. **Google Apps Script** — custom skript, ktorý ťahá cez Shopify Admin API
4. **Make.com / Zapier** — no-code automatizácia
