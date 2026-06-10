# node >=16.20.1 required by mongoose@8 (via @types/mongoose -> mongoose "*");
# 22 matches the locally verified build/test environment.
FROM node:22-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node . .

RUN yarn install

CMD [ "yarn", "distribute" ]
