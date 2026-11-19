FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY src ./src
CMD ["node", "server.mjs"]
