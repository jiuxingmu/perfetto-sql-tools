FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_APP_BASE=/
ENV VITE_APP_BASE=$VITE_APP_BASE
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "server/index.mjs"]