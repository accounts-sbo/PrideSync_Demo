# 🚀 Quick Deploy Instructions

## 1. Push to GitHub
```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

## 2. Deploy Backend to Railway

1. **Go to [Railway.app](https://railway.app)**
2. **New Project** → **Deploy from GitHub repo**
3. **Select**: `accounts-sbo/PrideSync_Demo`
4. **Root Directory**: `backend`
5. **Add PostgreSQL**: New → Database → PostgreSQL
6. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```

## 3. Deploy Frontend to Vercel

1. **Go to [Vercel.com](https://vercel.com)**
2. **New Project** → **Import Git Repository**
3. **Select**: `accounts-sbo/PrideSync_Demo`
4. **Root Directory**: `frontend`
5. **Environment Variables**:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-railway-app.railway.app
   NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
   ```

## 4. Import Data

```bash
cd backend
node scripts/import-boats.js
```

## 5. Test URLs

- **Landing**: `https://your-vercel-app.vercel.app`
- **Admin**: `https://your-vercel-app.vercel.app/admin`
- **Voting**: `https://your-vercel-app.vercel.app/2025`
- **Device CMS**: `https://your-railway-app.railway.app/api/device-management/cms`

## 🎯 Ready for Demo!
