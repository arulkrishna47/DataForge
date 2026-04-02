# Base server
FROM node:20-alpine AS server
WORKDIR /usr/src/app
# Start without dependencies initially, volumes will sync and we install later
CMD ["sh", "-c", "npm install && npm run dev"]

# Base client
FROM node:20-alpine AS client
WORKDIR /usr/src/app
CMD ["sh", "-c", "npm install && npm run dev -- --host"]
