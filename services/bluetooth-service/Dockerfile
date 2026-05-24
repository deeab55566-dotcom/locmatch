FROM node:20-alpine

WORKDIR /app

# Install shared dependencies
COPY shared/package*.json ./shared/
WORKDIR /app/shared
RUN npm install

# Copy shared source
WORKDIR /app
COPY shared/ ./shared/

# Install service dependencies first (layer caching)
COPY services/bluetooth-service/package*.json ./services/bluetooth-service/
WORKDIR /app/services/bluetooth-service
RUN npm install

# Copy service source
COPY services/bluetooth-service/ .

EXPOSE 3005

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
