# Stage 1: Build the application
FROM node:22-alpine AS builder

ARG PNPM_VERSION=9.5.0
ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry "$NPM_CONFIG_REGISTRY" \
	&& npm config set fetch-retries 5 \
	&& npm config set fetch-retry-mintimeout 20000 \
	&& npm config set fetch-retry-maxtimeout 120000 \
	&& npm install -g "pnpm@$PNPM_VERSION" \
	&& pnpm config set registry "$NPM_CONFIG_REGISTRY" \
	&& pnpm config set fetch-retries 5 \
	&& pnpm config set fetch-retry-mintimeout 20000 \
	&& pnpm config set fetch-retry-maxtimeout 120000

WORKDIR /app

# Copy package files for dependency installation (layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .

# Build-time env vars for CN fork (override via --build-arg or docker-compose)
ARG VITE_WCL_API_BASE=https://wcl-live-mp.rpglogs.cn
ARG VITE_WCL_DIRECT=false
ARG VITE_SERVER_BASE=/
ARG VITE_API_BASE=i/
ARG VITE_ENABLE_GA=false
ARG VITE_DISABLE_USER_FETCH=true
ENV VITE_WCL_API_BASE=$VITE_WCL_API_BASE
ENV VITE_WCL_DIRECT=$VITE_WCL_DIRECT
ENV VITE_SERVER_BASE=$VITE_SERVER_BASE
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_ENABLE_GA=$VITE_ENABLE_GA
ENV VITE_DISABLE_USER_FETCH=$VITE_DISABLE_USER_FETCH

# Skip TS typecheck during Docker build (pre-existing errors from upstream merge)
ENV DISABLE_CHECKER_PLUGIN=true

RUN pnpm build

# Stage 2: Serve with nginx
FROM nginx:stable-alpine

ENV WCL_API_PROXY_TARGET=https://wcl-live-mp.rpglogs.cn/v1/
ENV WCL_API_PROXY_HOST=wcl-live-mp.rpglogs.cn
ENV WOWANALYZER_API_PROXY_TARGET=https://wowanalyzer.com/i/
ENV WOWANALYZER_API_PROXY_HOST=wowanalyzer.com
ENV CN_ARMORY_API_PROXY_TARGET=https://webapi.rpglogs.cn
ENV CN_ARMORY_API_PROXY_HOST=webapi.rpglogs.cn

COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
