# --- Stage 1: Client build ---
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Stage 2: Server runtime ---
FROM node:20-slim
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/index.js"]
