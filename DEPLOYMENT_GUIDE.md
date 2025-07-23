# 🚀 PrideSync Deployment Guide - Railway + Vercel

## 🎯 **Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   KPN GPS API   │───▶│  Railway API    │───▶│  Vercel Frontend│
│   (Webhooks)    │    │  (Backend)      │    │  (Dashboard)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  PostgreSQL     │
                       │  (Railway)      │
                       └─────────────────┘
```

## 🚂 **Railway Backend Deployment**

### **Step 1: Create Railway Project**
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub repository
4. Select the `backend` folder as root directory

### **Step 2: Configure Environment Variables**
```bash
# Required Variables
NODE_ENV=production
PORT=$PORT

# Database (Railway will provide)
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL

# CORS (for Vercel integration)
FRONTEND_URL=https://your-vercel-app.vercel.app

# Optional: KPN Webhook Security
KPN_WEBHOOK_SECRET=your_secret_here
```

### **Step 3: Railway Configuration**
The `backend/railway.json` is already configured:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health"
  }
}
```

### **Step 4: Add PostgreSQL**
1. In Railway dashboard: "New" → "Database" → "PostgreSQL"
2. Railway automatically sets `DATABASE_URL`
3. Tables are created automatically on first start

### **Step 5: Deploy**
```bash
git add .
git commit -m "Deploy PrideSync backend to Railway"
git push origin main
```

**Expected Railway URL:** `https://pridesync-backend-production.up.railway.app`

## ⚡ **Vercel Frontend Deployment**

### **Step 1: Create Vercel Project**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project" → Import from GitHub
3. Select your repository
4. Set **Root Directory** to `frontend`

### **Step 2: Configure Environment Variables**
```bash
# API Configuration (use your Railway URL)
NEXT_PUBLIC_API_URL=https://pridesync-backend-production.up.railway.app

# App Configuration
NEXT_PUBLIC_APP_NAME=PrideSync
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### **Step 3: Vercel Configuration**
The `frontend/vercel.json` is already configured:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ]
}
```

### **Step 4: Deploy**
Vercel automatically deploys on git push.

**Expected Vercel URL:** `https://pridesync-frontend.vercel.app`

## 🔗 **Railway ↔️ Vercel Integration**

### **Automatic Environment Variable Sharing**

#### **Option 1: Vercel Integration (Recommended)**
1. In Railway dashboard: "Settings" → "Integrations"
2. Add "Vercel Integration"
3. Connect your Vercel project
4. Railway automatically shares environment variables

#### **Option 2: Manual Configuration**
Update Railway CORS to include Vercel domain:
```javascript
// In backend/src/app.js
const allowedOrigins = [
  'http://localhost:3001',
  'https://pridesync-frontend.vercel.app',
  'https://*.vercel.app', // All Vercel preview deployments
  process.env.FRONTEND_URL
].filter(Boolean);
```

## 🧪 **Testing Deployment**

### **1. Test Railway Backend**
```bash
# Health check
curl https://pridesync-backend-production.up.railway.app/health

# Test webhook
curl -X POST https://pridesync-backend-production.up.railway.app/api/webhooks/kpn-gps \
  -H "Content-Type: application/json" \
  -d '{
    "bootnummer": 11,
    "timestamp": "2025-07-21T14:36:00Z",
    "latitude": 52.3851,
    "longitude": 4.8947
  }'

# Get boat data
curl https://pridesync-backend-production.up.railway.app/api/boats
```

### **2. Test Vercel Frontend**
1. Open `https://pridesync-frontend.vercel.app`
2. Navigate to "API Tester" tab
3. Click "Test Health Endpoint"
4. Click "Test GPS Webhook"
5. Verify data appears in "Boat Tracker" tab

### **3. Test Integration**
```bash
# Send GPS update via Railway
curl -X POST https://pridesync-backend-production.up.railway.app/api/webhooks/kpn-gps \
  -H "Content-Type: application/json" \
  -d '{
    "bootnummer": 25,
    "timestamp": "2025-07-21T15:00:00Z",
    "latitude": 52.3677,
    "longitude": 4.8951
  }'

# Verify in Vercel frontend
# Should show boat 25 with ~61% progress
```

## 🔐 **Production Security**

### **Environment Variables**
```bash
# Railway Backend
NODE_ENV=production
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
KPN_WEBHOOK_SECRET=your_production_secret
FRONTEND_URL=https://pridesync-frontend.vercel.app

# Vercel Frontend
NEXT_PUBLIC_API_URL=https://pridesync-backend-production.up.railway.app
```

### **CORS Configuration**
Railway backend automatically allows:
- All Vercel domains (`*.vercel.app`)
- Specific frontend URL from environment
- Preview deployments for testing

## 📊 **Monitoring & Logs**

### **Railway Monitoring**
- Health checks: `/health` endpoint
- Logs: Railway dashboard → "Deployments" → "Logs"
- Metrics: CPU, Memory, Network usage

### **Vercel Monitoring**
- Build logs: Vercel dashboard → "Deployments"
- Function logs: Real-time in dashboard
- Analytics: Page views, performance

## 🎯 **KPN Integration**

### **Webhook URL for KPN**
```
https://pridesync-backend-production.up.railway.app/api/webhooks/kpn-gps
```

### **Expected Payload Format**
```json
{
  "bootnummer": 11,
  "timestamp": "2025-07-21T14:36:00Z",
  "latitude": 52.37338,
  "longitude": 4.89075
}
```

### **Response Codes**
- `200 OK`: GPS position processed successfully
- `400 Bad Request`: Invalid payload format
- `422 Unprocessable Entity`: GPS position not on parade route
- `500 Internal Server Error`: Server error

## ✅ **Deployment Checklist**

### **Railway Backend**
- [ ] Repository connected
- [ ] Environment variables configured
- [ ] PostgreSQL database added
- [ ] Health check responding
- [ ] Webhook endpoint tested
- [ ] CORS configured for Vercel

### **Vercel Frontend**
- [ ] Repository connected
- [ ] Environment variables configured
- [ ] Build successful
- [ ] API connection working
- [ ] All tabs functional

### **Integration**
- [ ] Frontend can call Railway API
- [ ] Webhook creates data visible in frontend
- [ ] CORS allows all requests
- [ ] Error handling works
- [ ] Performance acceptable

## 🚀 **Go Live**

1. **Update KPN webhook URL** to Railway production endpoint
2. **Test with real GPS data** from parade boats
3. **Monitor logs** for any issues
4. **Scale if needed** (Railway auto-scales)

**Your PrideSync system is now live! 🏳️‍🌈**
