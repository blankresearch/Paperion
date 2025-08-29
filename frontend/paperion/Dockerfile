# Stage 1: Dependencies
FROM node:22-bookworm AS deps

# Install build deps for node-canvas (works on any Linux host)
RUN apt-get update && apt-get install -y \
	build-essential \
	python3 \
	pkg-config \
	libcairo2-dev \
	libpango1.0-dev \
	libjpeg-dev \
	libgif-dev \
	librsvg2-dev \
	libpixman-1-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
RUN npm rebuild lightningcss --update-binary
RUN npm install canvas

# Stage 2: Runtime
FROM node:22-bookworm

WORKDIR /frontend
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
