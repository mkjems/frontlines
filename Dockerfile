# The game's files and the two-player relay, served by one small Node server (server/relay.mjs).
FROM node:22-alpine

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/relay.mjs ./
COPY site/ /app/site/

USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "relay.mjs"]
