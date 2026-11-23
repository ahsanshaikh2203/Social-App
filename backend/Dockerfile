FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend ./backend
RUN mkdir -p /app/backend/media
RUN npm run build --workspace backend
EXPOSE 8000
CMD ["sh","-c","npm run prisma:migrate --workspace backend && npm run seed --workspace backend && npm start --workspace backend"]
