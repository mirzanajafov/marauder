FROM node:22-alpine AS system
RUN apk add --no-cache openssl
WORKDIR /repo

FROM system AS base
ENV COREPACK_HOME=/usr/local/share/corepack
COPY package.json ./
RUN corepack enable && corepack install

FROM base AS store
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

FROM store AS manifests
COPY apps/api/package.json apps/api/
COPY apps/simulator/package.json apps/simulator/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/env/package.json packages/env/

FROM manifests AS build
RUN pnpm install --offline --frozen-lockfile
COPY . .
RUN pnpm --filter "./packages/*" build && pnpm --filter @marauder/api exec prisma generate
RUN pnpm --filter @marauder/api build && pnpm --filter @marauder/simulator build
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/
RUN VITE_API_URL="$VITE_API_URL" VITE_WS_URL="$VITE_WS_URL" pnpm --filter @marauder/web build

FROM manifests AS production
RUN rm -rf node_modules && pnpm install --offline --frozen-lockfile --prod --filter @marauder/api... --filter @marauder/simulator...
COPY apps/api/prisma apps/api/prisma
RUN pnpm --filter @marauder/api exec prisma generate
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/env/dist packages/env/dist

FROM system AS runtime
COPY --from=production /repo ./

FROM runtime AS api
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM runtime AS simulator
COPY --from=build /repo/apps/simulator/dist apps/simulator/dist
WORKDIR /repo/apps/simulator
USER node
CMD ["node", "dist/main.js"]

FROM nginx:1.30-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
