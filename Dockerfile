FROM node:20-alpine

# Install ffmpeg and other dependencies
RUN apk update && \
    apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    py3-setuptools \
    alpine-sdk \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    build-base

# Set environment variables for configuration
ENV PORT=3000
ENV DATABASE_URL="file:/usr/src/app/sqlite.db"

LABEL maintainer="Quentin Laffont <contact@qlaffont.com>"

RUN npm install -g pnpm

WORKDIR /usr/src/app

COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

COPY . .

RUN pnpm generate

EXPOSE $PORT

CMD ["pnpm", "run", "dev"]
