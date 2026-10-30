# SoilPilot Frontend - Production Next.js Dockerfile for Koyeb
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build Next.js application for production
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npm run start -- -p ${PORT:-3000}"]
