FROM node:24.18.1-alpine3.24@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS build-stage

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
RUN npm i -g npm@12.0.2 --allow-scripts=npm && npm -v
RUN npm ci
RUN npm run verify:install-scripts

COPY . .
RUN npm run -w front-end prepare
RUN npm run build

FROM node:24.18.1-alpine3.24@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS production-stage

WORKDIR /app
ENV NODE_ENV=production

RUN mkdir -p /app/.data \
    && chown node:node /app/.data \
    && rm -rf /opt/yarn-v1.22.22 /root/.npm /usr/local/lib/node_modules/corepack /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --chown=node:node --from=build-stage /app/front-end/.output ./front-end/.output

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(4000)}).then(response=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "front-end/.output/server/index.mjs"]
