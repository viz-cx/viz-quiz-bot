FROM node:alpine3.11

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node . .

EXPOSE 3000

RUN yarn install

CMD [ "yarn", "distribute" ]
