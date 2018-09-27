FROM node:8 as builder

WORKDIR /opt/app

ENV REACT_APP_NETWORK_HOST %REACT_APP_NETWORK_HOST%
ENV REACT_APP_BLOCKCHAIN_PORT %REACT_APP_BLOCKCHAIN_PORT%

COPY package.json package-lock.json* ./
RUN npm install

# copy in our source code last, as it changes the most
COPY . .

# Build static files
RUN [ "npm", "run", "build" ]

# Use image 1.14-alpine due to an error in Docker image nginx:1-alpine 
FROM nginx:1.14-alpine
WORKDIR /var/www/app

EXPOSE 80

# Copy static files from the build stage to a location from which nginx will serve the web app
COPY --from=builder /opt/app/build .
COPY docker-entrypoint/entrypoint.sh /opt/entrypoint.sh
ENTRYPOINT ["sh", "/opt/entrypoint.sh"]
COPY nginx-config/webapp.conf /etc/nginx/conf.d/default.conf

CMD ["nginx-fe"]