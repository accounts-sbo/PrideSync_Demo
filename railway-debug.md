# 🚂 Railway Deployment Debug Guide

## Check These Settings:

### 1. Project Configuration
- **Root Directory**: Should be set to `backend`
- **Build Command**: `npm install` (auto-detected)
- **Start Command**: `npm start` (from package.json)

### 2. Environment Variables Required:
```
NODE_ENV=production
PORT=$PORT
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### 3. Common Issues:

**Issue**: "Not Found" on `/api/device-management/cms`
**Solution**: 
- Check if Railway is using the correct root directory (`backend`)
- Verify the build completed successfully
- Check deployment logs for errors

**Issue**: Build fails
**Solution**:
- Check if `package.json` is in the `backend` folder
- Verify all dependencies are listed
- Check Node.js version compatibility

### 4. Manual Redeploy Steps:
1. Go to Railway dashboard
2. Select your project
3. Go to "Deployments" tab
4. Click "..." on latest deployment
5. Click "Redeploy"

### 5. Check Logs:
- Build logs: Shows npm install process
- Deploy logs: Shows application startup
- Application logs: Shows runtime errors

### 6. Test Endpoints After Deploy:
- Health: `https://your-app.railway.app/health`
- CMS: `https://your-app.railway.app/api/device-management/cms`
- API: `https://your-app.railway.app/api/boats`
