# PrideSync.nl Website

Dit is de hoofdwebsite voor PrideSync Nederland, het real-time coördinatiesysteem voor Pride parades.

## Structuur

- **/** - Hoofdpagina (www.pridesync.nl)
- **/2025** - Kijkers app voor publiek (stemmen op boten)
- **/skipper** - Schippers app voor positie-indicatie
- **/viewer** - Alias voor /2025

## Features

### Hoofdpagina (/)
- Welkomspagina met overzicht van alle apps
- Links naar verschillende functionaliteiten
- Systeem status informatie

### Kijkers App (/2025)
- Stemmen op favoriete boten
- Informatie over deelnemende boten
- Real-time parade status
- Mobiel geoptimaliseerd

### Schippers App (/skipper)
- 5-zone corridor systeem
- Real-time positie feedback
- Calamiteiten melding
- Emergency contact functionaliteit
- Volledig mobiel geoptimaliseerd (portrait)

## Corridor Systeem

De schippers app gebruikt een 5-zone systeem:

1. **Rood (Zone 1)** - Te ver vooruit: URGENT vertraag
2. **Oranje (Zone 2)** - Iets te vooruit: Langzamer varen
3. **Groen (Zone 3)** - Perfect: Handhaaf koers ✅
4. **Oranje (Zone 4)** - Iets te achter: Sneller varen
5. **Rood (Zone 5)** - Te ver achter: URGENT inhalen of calamiteit melden

## Deployment

Deze website is bedoeld om te draaien op:
- **Domein**: pridesync.nl
- **Platform**: Vercel
- **API Backend**: Railway (pridesyncDemo-production.up.railway.app)

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in je browser.

## Environment Variables

```
NEXT_PUBLIC_API_URL=https://pridesyncDemo-production.up.railway.app
```
