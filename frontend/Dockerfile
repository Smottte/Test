FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY public ./public
COPY src ./src
ENV PORT=3000
CMD ["npm", "start"]
