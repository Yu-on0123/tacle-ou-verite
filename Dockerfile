# Étape 1 : construire l'interface web et compiler le serveur.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : image finale légère, avec seulement ce qu'il faut pour tourner.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Render fournit la variable PORT (10000 par défaut) ; le serveur la lit tout seul.
EXPOSE 10000
USER node
CMD ["node", "dist/server.js"]
