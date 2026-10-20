# Small, non-root production image. No npm install needed: zero dependencies.
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 TRUST_PROXY=1
WORKDIR /app
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server.js"]
