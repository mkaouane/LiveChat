FROM node:20-alpine

# Install ffmpeg and other dependencies
RUN apk update && \
    apk add --no-cache \
    ffmpeg \
    python3 \
    alpine-sdk \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev

# Set environment variables for configuration
ENV PORT=3000
ENV DATABASE_URL="file:/usr/src/app/sqlite.db"

# Add maintainer label
LABEL maintainer="Quentin Laffont <contact@qlaffont.com>"

RUN npm install pnpm -g

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install app dependencies
RUN pnpm install

# Copy the rest of the application code
COPY . .

# Generate the Prisma database
RUN pnpm generate

# Expose the port the app runs on
EXPOSE $PORT

# Command to run the app
CMD ["pnpm", "run", "dev"]