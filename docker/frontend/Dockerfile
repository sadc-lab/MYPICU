FROM node:22.19.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm install --prefix /opt/xlsx --no-save xlsx@0.18.5 \
    && ln -s /opt/xlsx/node_modules/xlsx node_modules/xlsx
COPY . .
ARG ANON_KEY
ARG SUPABASE_API_URL
# Patch only this disposable build copy, never the frontend in the repository.
# `vite build` does not type-check, so a missing import still bundles and only
# fails at runtime in the browser. Type-check first, then build.
RUN node docker/frontend/configure.cjs \
    && npx tsc --noEmit -p tsconfig.app.json \
    && npm run build

FROM node:22.19.0-alpine
RUN npm install -g serve@14.2.5
WORKDIR /app
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000", "--no-clipboard"]
