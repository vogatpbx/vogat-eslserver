# Stage 1: Build the TypeScript application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package.json and lock file
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the build script (e.g., tsc defined in package.json)
# Ensure your package.json has a "build" script
RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package.json and lock file
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy compiled code from the builder stage
# Adjust the path if your build output is different (e.g., ./build instead of ./dist)
COPY --from=builder /usr/src/app/dist ./dist



# Make port 8080 available (if this service needs its own API/WebSockets)
EXPOSE 8080

# Define the command to run your compiled app
# Adjust the path if your compiled entry point is different
CMD [ "node", "dist/index.js" ]