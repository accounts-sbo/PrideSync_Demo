# ⚡ Vercel Deployment Debug Guide

## Check These Settings:

### 1. Project Configuration
- **Root Directory**: Should be set to `frontend`
- **Framework**: Next.js (auto-detected)
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)

### 2. Environment Variables Required:
```
NEXT_PUBLIC_BACKEND_URL=https://your-railway-app.railway.app
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
```

### 3. Common Issues:

**Issue**: 404 on `/admin`
**Solutions**:
- Check if `frontend/app/admin/page.tsx` exists
- Verify build completed successfully
- Check if Next.js app router is working

**Issue**: "Failed to fetch" API errors
**Solutions**:
- Verify environment variables are set
- Check CORS settings on backend
- Test API endpoints directly

### 4. Manual Redeploy Steps:
1. Go to Vercel dashboard
2. Select your project
3. Go to "Deployments" tab
4. Click "..." on latest deployment
5. Click "Redeploy"

### 5. Check Build Logs:
- Look for TypeScript errors
- Check for missing dependencies
- Verify Next.js build success

### 6. Test Pages After Deploy:
- Landing: `https://your-app.vercel.app/`
- Admin: `https://your-app.vercel.app/admin`
- Voting: `https://your-app.vercel.app/2025`
