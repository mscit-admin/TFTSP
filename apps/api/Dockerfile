# TFTSP API — multi-stage build. Build context is apps/api (self-contained).
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist

EXPOSE 3000
# Apply migrations (as the owner via DATABASE_MIGRATION_URL) then start the API.
CMD ["sh", "-c", "DATABASE_URL=\"$DATABASE_MIGRATION_URL\" npx prisma migrate deploy && node dist/main.js"]
