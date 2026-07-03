FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai-tools/package.json ./packages/ai-tools/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build -w @infraops/shared && npm run build -w @infraops/ai-tools
RUN npm run db:generate -w @infraops/api
RUN npm run build -w @infraops/worker

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/ai-tools/dist ./packages/ai-tools/dist
COPY --from=build /app/packages/ai-tools/package.json ./packages/ai-tools/
COPY --from=build /app/package.json ./
CMD ["npm", "run", "start", "-w", "@infraops/worker"]
