FROM node:18-alpine As build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY --from=build /usr/src/app/dist ./dist

EXPOSE 4000

CMD ["npm", "run", "start:prod"]
