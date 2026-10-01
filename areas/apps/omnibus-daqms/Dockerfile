# Build context: the repository root, so the shared npm workspace lockfile and
# the in-repo @waterloorocketry/omnibus-ts are available:
#   docker build -f areas/apps/omnibus-daqms/Dockerfile .

# Stage 1: Build the React application
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching. npm ci needs every
# workspace's package.json, even ones this image doesn't build.
COPY package.json package-lock.json ./
COPY areas/sw_libs/omnibus-ts/package.json areas/sw_libs/omnibus-ts/
COPY areas/sw_libs/parsley-ts/package.json areas/sw_libs/parsley-ts/
COPY areas/apps/omnibus-daqms/package.json areas/apps/omnibus-daqms/

RUN npm ci

# Copy source files
COPY areas/sw_libs/omnibus-ts areas/sw_libs/omnibus-ts
COPY areas/apps/omnibus-daqms areas/apps/omnibus-daqms

# Accept commit hash as build argument
ARG VITE_COMMIT_HASH=unknown
ENV VITE_COMMIT_HASH=${VITE_COMMIT_HASH}

RUN npm run build -w @waterloorocketry/omnibus-ts && npm run build -w omnibus-daqms

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY areas/apps/omnibus-daqms/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/areas/apps/omnibus-daqms/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
