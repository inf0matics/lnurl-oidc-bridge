FROM node:24-slim
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.mjs .
EXPOSE 3000
CMD ["node", "server.mjs"]
