# Use a lightweight Node.js image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json first to cache dependencies
COPY package*.json ./

# Install dependencies (express, socket.io, ioredis, pg)
RUN npm install

# Copy the rest of your code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"]