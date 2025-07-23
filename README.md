# 🏳️‍🌈 PrideSync - Pride Parade Coordination System

## 🎯 **Project Overview**

Real-time GPS tracking and coordination system for Pride parade boats using KPN webhooks, Railway backend, and Vercel frontend.

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   KPN GPS API   │───▶│  Railway API    │───▶│  Vercel Frontend│
│   (Webhooks)    │    │  (Backend)      │    │  (Dashboard)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  PostgreSQL     │
                       │  (Boat State)   │
                       └─────────────────┘
```

## 📁 **Project Structure**

```
pridesync/
├── backend/                 # Railway Node.js API
│   ├── src/
│   │   ├── routes/
│   │   │   └── webhooks.js  # KPN GPS webhook handler
│   │   ├── services/
│   │   │   ├── routeMapper.js
│   │   │   └── boatState.js
│   │   ├── models/
│   │   └── app.js
│   ├── package.json
│   └── railway.json
├── frontend/                # Vercel Next.js App
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── hooks/
│   ├── package.json
│   └── vercel.json
└── docs/
    └── api.md
```

## 🚀 **Deployment**

- **Backend**: Railway (https://railway.app)
- **Frontend**: Vercel (https://vercel.com)
- **Database**: Railway PostgreSQL
- **Integration**: Automatic env var sharing

## 🔗 **Key Endpoints**

- `POST /api/webhooks/kpn-gps` - Receive GPS updates from KPN
- `GET /api/boats` - Get all boat positions
- `GET /api/boats/:id` - Get specific boat status
- `GET /api/parade/status` - Get overall parade status

## 🧪 **Testing**

```bash
# Test webhook endpoint
curl -X POST https://your-railway-app.railway.app/api/webhooks/kpn-gps \
  -H "Content-Type: application/json" \
  -d '{
    "bootnummer": 11,
    "timestamp": "2025-07-21T14:36:00Z",
    "latitude": 52.37338,
    "longitude": 4.89075
  }'
```

## 📋 **Environment Variables**

### Railway Backend
```
DATABASE_URL=postgresql://...
NODE_ENV=production
PORT=3000
```

### Vercel Frontend
```
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
```
