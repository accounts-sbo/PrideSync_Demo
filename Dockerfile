FROM node:18-alpine

WORKDIR /app

# Copy package.json files
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --only=production

# Go back to app directory and copy backend code
WORKDIR /app
COPY backend ./backend/

# Create logs directory
RUN mkdir -p backend/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Set working directory to backend for runtime
WORKDIR /app/backend

# Start the app
CMD ["node", "src/app.js"]
