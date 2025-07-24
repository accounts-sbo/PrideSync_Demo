# PrideSync.nl Deployment Guide

## 🚀 Vercel Deployment

### 1. Voorbereiding
```bash
cd pridesync-website
npm install
npm run build  # Test lokaal
```

### 2. Vercel CLI Deployment
```bash
npx vercel --prod
```

### 3. Domein Configuratie
In Vercel Dashboard:
1. Ga naar Project Settings
2. Klik op "Domains"
3. Voeg toe: `pridesync.nl`
4. Voeg toe: `www.pridesync.nl`

### 4. Environment Variables
In Vercel Dashboard → Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL = https://pridesyncDemo-production.up.railway.app
```

### 5. DNS Configuratie
Bij je DNS provider (waar pridesync.nl is geregistreerd):

**A Records:**
```
@ → 76.76.19.61
www → 76.76.19.61
```

**CNAME Records:**
```
pridesync.nl → cname.vercel-dns.com
www.pridesync.nl → cname.vercel-dns.com
```

## 📱 URL Structuur

- **https://pridesync.nl** → Hoofdpagina
- **https://pridesync.nl/2025** → Kijkers app (publiek stemmen)
- **https://pridesync.nl/skipper** → Schippers app (corridor systeem)
- **https://pridesync.nl/privacy** → Privacy verklaring
- **https://pridesync.nl/support** → Support & help

## 🔧 Features per App

### Hoofdpagina (/)
- ✅ Welkomspagina met Pride branding
- ✅ Links naar alle sub-apps
- ✅ Systeem status indicator
- ✅ Real-time klok
- ✅ Responsive design

### Kijkers App (/2025)
- ✅ Stemmen op favoriete boten
- ✅ Boot informatie modal
- ✅ Real-time vote counts
- ✅ Mobiel geoptimaliseerd
- ✅ Pride 2025 branding

### Schippers App (/skipper)
- ✅ 5-zone corridor systeem
- ✅ Real-time positie feedback
- ✅ Calamiteiten melding
- ✅ Emergency contact
- ✅ Volledig portrait mobiel
- ✅ Grote, duidelijke zones

## 🎨 Design System

### Kleuren
- **Pride Gradient**: Regenboog kleuren
- **Corridor Rood**: #dc2626 (urgent)
- **Corridor Oranje**: #ea580c (let op)
- **Corridor Groen**: #16a34a (perfect)

### Responsive
- **Desktop**: Volledig responsive
- **Mobile**: Geoptimaliseerd voor portrait
- **Skipper App**: 100vh mobile-first

## 🔗 Integraties

### Backend API
- **URL**: https://pridesyncDemo-production.up.railway.app
- **Health**: /health
- **Boats**: /api/boats
- **GPS**: /api/webhooks/kpn-gps

### External Links
- **Control Dashboard**: Verwijst naar bestaande Vercel app
- **Emergency**: Tel links naar 112 en Pride Control

## 📊 Monitoring

### Vercel Analytics
Automatisch enabled voor:
- Page views
- Performance metrics
- Error tracking

### Custom Metrics
- Stemmen per boot (kijkers app)
- Calamiteiten meldingen (schippers app)
- Zone distributie (corridor systeem)

## 🚨 Emergency Procedures

### Calamiteit Flow
1. Schipper drukt op "CALAMITEIT" knop
2. Selecteert reden uit lijst
3. Melding wordt verstuurd naar backend
4. Pride Control wordt genotificeerd
5. Status wordt getoond in Control Dashboard

### Contact Nummers
- **Noodgevallen**: 112
- **Pride Control**: +31 6 1234 5678 (placeholder)
- **Tech Support**: +31 6 1234 5679 (placeholder)

## ✅ Pre-Launch Checklist

- [ ] Domein pridesync.nl gekoppeld
- [ ] SSL certificaat actief
- [ ] Alle apps getest op mobiel
- [ ] Backend API verbinding getest
- [ ] Emergency procedures getest
- [ ] Contact nummers bijgewerkt
- [ ] Privacy verklaring compleet
- [ ] Support pagina bijgewerkt

## 🎯 Post-Launch

1. Monitor Vercel Analytics
2. Test alle functionaliteiten
3. Verzamel feedback van gebruikers
4. Optimaliseer performance
5. Update documentatie
