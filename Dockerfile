FROM node:20-alpine

# --- Install dependencies ---
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

# --- Env variables ---
ENV PORT=3000
ENV DATABASE_URL="file:/usr/src/app/sqlite.db"

# --- Metadata ---
LABEL maintainer="Quentin Laffont <contact@qlaffont.com>"

# --- Global install PNPM ---
RUN npm install -g pnpm@9.14.4

# --- Create work directory ---
WORKDIR /usr/src/app

# --- Copy only dependency files first (for caching) ---
COPY package*.json ./
COPY pnpm-lock.yaml ./

# --- Install dependencies ---
RUN pnpm install --frozen-lockfile

# --- Copy rest of the source code ---
COPY . .

# --- Generate Prisma client ---
# Use pnpm exec to access local prisma binary inside node_modules
RUN pnpm exec prisma generate

# --- Expose port ---
EXPOSE $PORT

# --- Default command ---
CMD ["pnpm", "run", "dev"]
