FROM node:20-alpine AS build-stage

WORKDIR /app

COPY .npmrc package.json package-lock.json tsconfig.base.json ./
COPY front-end/package.json ./front-end/package.json
COPY back-end/package.json ./back-end/package.json
RUN npm ci --ignore-scripts

COPY . .
RUN npm run -w front-end prepare
RUN npm run build

FROM node:20-alpine AS production-stage

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build-stage /app/front-end/.output ./front-end/.output

EXPOSE 3000

CMD ["node", "front-end/.output/server/index.mjs"]
