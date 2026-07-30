FROM node:24.18.0-alpine AS build-stage

WORKDIR /app
ENV COFOUNDRY_OPERATIONS_TOKEN=container-build-worker-token-not-for-runtime \
    NODE_ENV=production \
    NUXT_PUBLIC_APP_URL=https://cofoundry.jacobdanderson.net \
    NUXT_PUBLIC_BACKEND_MODE=mock \
    NUXT_PUBLIC_BILLING_MODE=mock \
    NUXT_PUBLIC_ENABLE_DEMO_ACCESS=false \
    PUPPETEER_SKIP_DOWNLOAD=true \
    SESSION_SIGNING_SECRET=container-build-session-secret-not-for-runtime

COPY .npmrc package.json package-lock.json tsconfig.base.json ./
COPY front-end/package.json ./front-end/package.json
COPY back-end/package.json ./back-end/package.json
RUN npm i -g npm@11.16.0 && npm -v
RUN npm ci
RUN npm run verify:install-scripts

COPY . .
RUN npm run -w front-end prepare
RUN npm run build

FROM node:24.18.0-alpine AS production-stage

WORKDIR /app
ENV NODE_ENV=production

RUN mkdir -p /app/.data && chown node:node /app/.data
COPY --chown=node:node --from=build-stage /app/front-end/.output ./front-end/.output

USER node

EXPOSE 3000

CMD ["node", "front-end/.output/server/index.mjs"]
