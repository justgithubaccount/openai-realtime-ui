FROM node:18-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# We'll mount the rest of the application as a volume from the host
# for hot reloading during development

# Set development environment
ENV NODE_ENV=development
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Command to run the development server with the --dev flag
CMD ["npm", "run", "dev"] 