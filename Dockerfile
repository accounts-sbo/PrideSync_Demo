FROM node:18-alpine

WORKDIR /app

# Copy package.json files
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd backend && npm ci --only=production

# Copy backend code
COPY backend ./backend/

# Create logs directory
RUN mkdir -p backend/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "backend/src/app.js"]
