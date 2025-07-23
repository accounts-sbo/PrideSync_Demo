# 🧪 PrideSync API Testing Guide

## 🚀 **Quick Start**

### **Backend (Railway)**
```bash
cd backend
npm install
npm start
# Server runs on http://localhost:3000
```

### **Frontend (Vercel)**
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3001
```

## 📡 **API Endpoints**

### **Health Check**
```bash
GET http://localhost:3000/health
```
**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-07-21T12:41:34.971Z",
  "version": "1.0.0",
  "environment": "development"
}
```

### **KPN GPS Webhook**
```bash
POST http://localhost:3000/api/webhooks/kpn-gps
Content-Type: application/json

{
  "bootnummer": 11,
  "timestamp": "2025-07-21T14:36:00Z",
  "latitude": 52.3851,
  "longitude": 4.8947
}
```

**PowerShell Test:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/webhooks/kpn-gps" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"bootnummer": 11, "timestamp": "2025-07-21T14:36:00Z", "latitude": 52.3851, "longitude": 4.8947}'
```

**Success Response:**
```json
{
  "success": true,
  "bootnummer": 11,
  "processed": {
    "timestamp": "2025-07-21T12:41:28.756Z",
    "routeProgress": "0.00%",
    "routeDistance": "0m",
    "processingTimeMs": 2
  }
}
```

### **Boat Data**
```bash
# Get all boats
GET http://localhost:3000/api/boats

# Get specific boat
GET http://localhost:3000/api/boats/11

# Get boat history
GET http://localhost:3000/api/boats/11/history
```

### **Parade Information**
```bash
# Parade status
GET http://localhost:3000/api/parade/status

# Parade route
GET http://localhost:3000/api/parade/route

# Parade summary
GET http://localhost:3000/api/parade/summary

# Leaderboard
GET http://localhost:3000/api/parade/leaderboard

# Incidents
GET http://localhost:3000/api/parade/incidents
```

## 🗺️ **Amsterdam Pride Route Coordinates**

### **Valid Test Coordinates (on route):**
```json
[
  {"lat": 52.3851, "lng": 4.8947, "name": "Start: Westerdok"},
  {"lat": 52.3836, "lng": 4.8842, "name": "Prinsengracht"},
  {"lat": 52.3758, "lng": 4.8835, "name": "Prinsengracht South"},
  {"lat": 52.3677, "lng": 4.8951, "name": "Amstel River"},
  {"lat": 52.3648, "lng": 4.8978, "name": "Amstel South"},
  {"lat": 52.3668, "lng": 4.9015, "name": "Zwanenburgwal"},
  {"lat": 52.3712, "lng": 4.9058, "name": "Oudeschans"},
  {"lat": 52.3742, "lng": 4.9089, "name": "Finish: Oosterdok"}
]
```

## 🧪 **Test Scenarios**

### **Scenario 1: Boat Registration**
```bash
# Send GPS update for new boat
POST /api/webhooks/kpn-gps
{
  "bootnummer": 25,
  "timestamp": "2025-07-21T14:36:00Z",
  "latitude": 52.3851,
  "longitude": 4.8947
}

# Verify boat was created
GET /api/boats/25
```

### **Scenario 2: Route Progress**
```bash
# Send boat to middle of route
POST /api/webhooks/kpn-gps
{
  "bootnummer": 25,
  "timestamp": "2025-07-21T14:40:00Z",
  "latitude": 52.3677,
  "longitude": 4.8951
}

# Check progress
GET /api/boats/25
# Should show ~61% progress
```

### **Scenario 3: Out of Corridor**
```bash
# Send boat far from route
POST /api/webhooks/kpn-gps
{
  "bootnummer": 25,
  "timestamp": "2025-07-21T14:45:00Z",
  "latitude": 52.3700,
  "longitude": 4.8800
}

# Should return 422 error: "GPS position could not be mapped to parade route"
```

### **Scenario 4: Parade Completion**
```bash
# Send boat to finish
POST /api/webhooks/kpn-gps
{
  "bootnummer": 25,
  "timestamp": "2025-07-21T15:00:00Z",
  "latitude": 52.3742,
  "longitude": 4.9089
}

# Check status
GET /api/boats/25
# Should show status: "finished", progress: 100%
```

## 🎯 **Expected Results**

### **✅ Working Features:**
- ✅ KPN GPS webhook receives and validates payloads
- ✅ GPS coordinates mapped to Amsterdam Pride route
- ✅ Boat state management (in-memory + database ready)
- ✅ Route progress calculation (0-100%)
- ✅ Corridor detection and warnings
- ✅ Speed and heading calculation
- ✅ RESTful API for boat data
- ✅ Parade statistics and leaderboard
- ✅ Health monitoring and logging
- ✅ CORS configured for Vercel integration

### **🔄 Next Steps:**
- Add PostgreSQL/Redis for production
- Implement WebSocket for real-time updates
- Add boat incident detection
- Create comprehensive frontend components
- Deploy to Railway and Vercel

## 🚀 **Deployment Ready**

The system is ready for Railway + Vercel deployment with:
- Environment variable configuration
- Database integration (PostgreSQL + Redis)
- Automatic CORS for Vercel domains
- Health checks and monitoring
- Scalable architecture
