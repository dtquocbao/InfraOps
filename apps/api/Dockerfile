FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai-tools/package.json ./packages/ai-tools/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build -w @infraops/shared && npm run build -w @infraops/ai-tools
RUN npm run db:generate -w @infraops/api
RUN npm run build -w @infraops/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/ai-tools/dist ./packages/ai-tools/dist
COPY --from=build /app/packages/ai-tools/package.json ./packages/ai-tools/
COPY --from=build /app/package.json ./
COPY --from=build /app/seed ./seed
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate -w @infraops/api && npm run db:seed -w @infraops/api && npm run start -w @infraops/api"]
