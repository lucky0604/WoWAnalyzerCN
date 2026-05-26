# Stage 1: Build the application
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

WORKDIR /app

# Copy package files for dependency installation (layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .

# Build-time env vars for CN fork (override via --build-arg or docker-compose)
ARG VITE_WCL_DIRECT=true
ARG VITE_SERVER_BASE=/
ARG VITE_ENABLE_GA=false
ENV VITE_WCL_DIRECT=$VITE_WCL_DIRECT
ENV VITE_SERVER_BASE=$VITE_SERVER_BASE
ENV VITE_ENABLE_GA=$VITE_ENABLE_GA

RUN pnpm build

# Stage 2: Serve with nginx
FROM nginx:stable-alpine

COPY default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
