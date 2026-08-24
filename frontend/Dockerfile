FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

ARG PUBLIC_API_URL
ARG PUBLIC_MAP_PMTILES_URL
ARG PUBLIC_MAP_ASSET_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL
ENV PUBLIC_MAP_PMTILES_URL=$PUBLIC_MAP_PMTILES_URL
ENV PUBLIC_MAP_ASSET_URL=$PUBLIC_MAP_ASSET_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
