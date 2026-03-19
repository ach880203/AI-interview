# ── 빌드 단계 ─────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── 서빙 단계 (Nginx 경량 이미지) ────────────────────────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# React Router를 위한 fallback 설정 (SPA 새로고침 404 방지)
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
