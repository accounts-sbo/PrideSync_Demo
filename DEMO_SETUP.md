# 🏳️‍🌈 PrideSync Demo Setup Guide

Complete demo setup voor GPS tracking, device management en voting systeem.

## 🚀 Quick Start

### 1. Backend Setup & Data Import

```bash
cd backend

# Install dependencies
npm install

# Import all Pride boats into database
npm run import-boats

# Start the backend server
npm run dev
```

### 2. Device Management CMS

Open in je browser: `http://localhost:3001/api/device-management/cms`

**Demo IMEI nummers voor koppeling:**
- `353760970649317` → Boat 1 (Spread the Word Intersex Collective)
- `353760970649318` → Boat 2 (Trans Pride powered by Rabobank)  
- `353760970649319` → Boat 3 (Amnesty International)
- `353760970649320` → Boat 4 (Roze Stadsdorp Amsterdam)
- `353760970649321` → Boat 5 (Pink Ladies)
- `353760970649322` → Boat 10 (COC Nederland)
- `353760970649323` → Boat 15 (Equal Rights Coalition)
- `353760970649324` → Boat 20 (MADAME CLAIRE BERLIN)
- `353760970649325` → Boat 25 (3 Layers)
- `353760970649326` → Boat 30 (Gemeente Amsterdam)

### 3. GPS Simulator

```bash
# Start GPS simulator (sends updates every second)
npm run simulate-gps

# Or with custom settings:
node scripts/gps-simulator.js http://localhost:3001/api/webhooks/tracker-gps 2000
```

### 4. Frontend (Pride Boat Ballot 2025)

```bash
cd frontend
npm run dev
```

Open: `http://localhost:3000/2025`

## 📡 API Endpoints

### Webhooks
- `POST /api/webhooks/tracker-gps` - Tracker device GPS data
- `POST /api/webhooks/kpn-gps` - KPN GPS data (legacy)

### Device Management
- `GET /api/device-management/cms` - CMS interface
- `GET /api/device-management/mappings` - All device mappings
- `POST /api/device-management/mappings` - Create mapping
- `PUT /api/device-management/mappings/:id` - Update mapping

### Voting (2025 App)
- `GET /api/voting/boats` - All boats with vote counts
- `POST /api/voting/vote` - Cast vote (heart/star)
- `GET /api/voting/user/:session` - User voting history
- `GET /api/voting/leaderboard` - Top boats
- `POST /api/voting/ideas` - Submit WorldPride 2026 idea

## 🧪 Testing the Flow

### 1. Setup Device Mappings
1. Open CMS: `http://localhost:3001/api/device-management/cms`
2. Add mappings voor de demo IMEI nummers
3. Controleer dat ze actief zijn

### 2. Start GPS Simulation
```bash
npm run simulate-gps
```

Je ziet nu elke seconde GPS updates in de backend logs:
```
GPS update received for boat 1 (Spread the Word Intersex Collective)
GPS update received for boat 2 (Trans Pride powered by Rabobank)
...
```

### 3. Test Voting App
1. Open: `http://localhost:3000/2025`
2. Tap op hartjes en sterren
3. Bekijk leaderboard en achievements
4. Test ideeën formulier

### 4. Monitor Backend
- Health check: `http://localhost:3001/health`
- Logs in console tonen alle activiteit
- Database wordt automatisch gevuld

## 🗄️ Database Schema

### Boats Table
```sql
- id (SERIAL PRIMARY KEY)
- boat_number (INTEGER UNIQUE)
- name (VARCHAR)
- organisation (VARCHAR)
- theme (TEXT)
- mac_address (VARCHAR)
```

### Device Mappings Table
```sql
- id (SERIAL PRIMARY KEY)
- boat_number (INTEGER)
- device_imei (VARCHAR UNIQUE)
- mac_address (VARCHAR)
- is_active (BOOLEAN)
```

### Votes Table
```sql
- id (SERIAL PRIMARY KEY)
- boat_number (INTEGER)
- vote_type ('heart' | 'star')
- user_session (VARCHAR)
- ip_address (INET)
- timestamp (TIMESTAMP)
```

### Positions Table
```sql
- id (SERIAL PRIMARY KEY)
- boat_number (INTEGER)
- device_imei (VARCHAR)
- latitude/longitude (DECIMAL)
- speed, heading, altitude
- gps_timestamp, received_timestamp
```

## 🔧 Troubleshooting

### Database Issues
```bash
# Check if PostgreSQL is running
# Database wordt automatisch aangemaakt als DATABASE_URL is ingesteld
# Anders gebruikt het in-memory storage
```

### GPS Simulator Not Working
```bash
# Check backend is running on port 3001
curl http://localhost:3001/health

# Check webhook endpoint
curl -X POST http://localhost:3001/api/webhooks/tracker-gps \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Frontend API Calls Failing
- Controleer dat backend draait op port 3001
- Check CORS instellingen in backend
- Bekijk browser console voor errors

## 📊 Demo Data

**80 Pride boats** zijn geïmporteerd met:
- Officiële namen en organisaties
- Thema's en beschrijvingen
- Boot nummers 0-80

**10 Demo devices** met IMEI nummers voor GPS simulatie

**GPS Route** volgt Amsterdam Pride Canal Route:
- Start: Westerdok
- Via: Brouwersgracht, Herengracht, Keizersgracht
- Finish: Magere Brug

## 🎯 Next Steps

1. **Real GPS Integration**: Vervang simulator met echte tracker devices
2. **WebSocket Updates**: Real-time frontend updates
3. **Advanced Analytics**: Route analysis, speed monitoring
4. **Mobile App**: Native iOS/Android app
5. **Admin Dashboard**: Comprehensive management interface

## 🏆 Features Demonstrated

✅ **GPS Tracking**: Tracker device webhook integration  
✅ **Device Management**: CMS voor IMEI → Boot mapping  
✅ **Real-time Simulation**: GPS data elke seconde  
✅ **Voting System**: Hearts & stars met limits  
✅ **Database Integration**: PostgreSQL met fallbacks  
✅ **API Architecture**: RESTful endpoints  
✅ **Frontend Integration**: Next.js met real API calls  
✅ **Error Handling**: Graceful degradation  
✅ **Logging**: Comprehensive activity tracking  

**Perfect voor demonstratie aan stakeholders! 🎉**

## 🚀 Production Deployment

### Backend (Railway)

1. **Create Railway Project:**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login and create project
   railway login
   railway init
   ```

2. **Add PostgreSQL Database:**
   - Go to Railway dashboard
   - Add PostgreSQL service
   - Copy DATABASE_URL to environment variables

3. **Deploy Backend:**
   ```bash
   cd backend
   railway up
   ```

4. **Environment Variables in Railway:**
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=(auto-provided by PostgreSQL service)
   FRONTEND_URL=https://your-frontend.vercel.app
   ```

### Frontend (Vercel)

1. **Connect GitHub Repository:**
   - Go to Vercel dashboard
   - Import GitHub repository
   - Select frontend folder as root

2. **Environment Variables in Vercel:**
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-railway-app.railway.app
   NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
   ```

3. **Deploy:**
   - Vercel auto-deploys on git push
   - Check deployment logs for any issues

### Post-Deployment Setup

1. **Import Boat Data:**
   ```bash
   # SSH into Railway container or run locally with production DB
   npm run import-boats
   ```

2. **Configure Device Mappings:**
   - Open: `https://your-railway-app.railway.app/api/device-management/cms`
   - Add IMEI → Boat mappings

3. **Test GPS Simulation:**
   ```bash
   # Run locally pointing to production
   node scripts/gps-simulator.js https://your-railway-app.railway.app/api/webhooks/tracker-gps
   ```

### Live URLs

- **Frontend**: `https://your-frontend.vercel.app`
- **Admin Dashboard**: `https://your-frontend.vercel.app/admin`
- **Voting App**: `https://your-frontend.vercel.app/2025`
- **Device CMS**: `https://your-railway-app.railway.app/api/device-management/cms`
- **API Health**: `https://your-railway-app.railway.app/health`

**Perfect voor demonstratie aan stakeholders! 🎉**
