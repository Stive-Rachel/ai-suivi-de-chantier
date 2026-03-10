FROM node:22-slim AS build

WORKDIR /app

COPY package.json ./
RUN npm install --include=dev

COPY . .
RUN npm run build

FROM node:22-slim AS production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]
