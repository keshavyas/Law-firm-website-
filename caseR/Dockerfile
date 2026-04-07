# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# install dev deps for build
RUN npm ci
COPY . .
# allow passing VITE_API_URL at build time
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Production stage - nginx serving static assets and proxying /api
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]