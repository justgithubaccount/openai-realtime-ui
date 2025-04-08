# Build stage
FROM node:18-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application for production (client and server builds)
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:18-slim

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy the dist directory containing the built client and server
COPY --from=build /app/dist ./dist

# Copy server.js and other necessary files
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/docs ./docs
COPY --from=build /app/client ./client
COPY --from=build /app/public ./public

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Add health check for Coolify
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the application in production mode (using the npm start script)
CMD ["npm", "start"] 