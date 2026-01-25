FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the app
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build the app
RUN bun run build

# Production image - use alpine for smaller size
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/generated ./generated
COPY --from=build /app/package.json ./

EXPOSE 3333

CMD ["bun", "run", ".output/server/index.mjs"]
