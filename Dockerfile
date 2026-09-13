# --- deps ---------------------------------------------------------------
FROM node:26-alpine AS deps
WORKDIR /app
# better-sqlite3 is native: build it here, in the stage that is thrown away.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# --- build --------------------------------------------------------------
FROM node:26-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A build-time value only; the real URL comes from the runtime environment.
ENV DATABASE_URL="file:./dev.db"
RUN npx prisma generate && npm run build

# --- runtime ------------------------------------------------------------
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# The SQLite file lives on a volume, not in the image.
ENV DATABASE_URL="file:/data/relaystand.db"

RUN apk add --no-cache openssl && mkdir -p /data

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Needed so `prisma migrate deploy` can run on start. Prisma 7 keeps the
# connection URL in prisma.config.ts, not in the schema, so that ships too.
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
# Migrate then serve — a new deploy applies pending migrations by itself.
# The Prisma CLI is invoked by path: the standalone output has no node_modules/.bin.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
