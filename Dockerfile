# Stage 1: build the static bundle
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json tsconfig.e2e.json vite.config.ts vitest.config.ts playwright.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY tests ./tests
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
HEALTHCHECK --interval=2s --timeout=3s --retries=15 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
