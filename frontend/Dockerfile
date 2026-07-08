# ==========================================
# Stage 1: Build Frontend (Vite)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json and lockfile for caching dependencies
COPY package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy all root files (Vite configuration, source code, etc.)
COPY . .

# Build Arguments for Vite Environment Variables
# These variables will be embedded into the static client bundle at build-time.
ARG VITE_API_URL=/api
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID

# Expose them to the build process
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID

# Build Vite frontend to /app/dist
RUN npm run build

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Copy backend package files first to leverage caching
COPY backend/package*.json ./backend/

# Install ONLY production dependencies for backend
RUN cd backend && npm ci --only=production

# Copy backend files
COPY backend/ ./backend/

# Copy the built frontend static assets from builder stage
COPY --from=builder /app/dist ./dist

# Set the working directory to the backend folder
WORKDIR /app/backend

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Expose the API port
EXPOSE 5000

# Run migrations, then start the Express server
CMD ["sh", "-c", "npm run migrate && npm start"]
