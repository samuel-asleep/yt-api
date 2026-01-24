FROM node:20-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip pipx ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && pipx ensurepath

# pipx installs binaries into /root/.local/bin
ENV PATH="/root/.local/bin:${PATH}"

RUN pipx install yt-dlp

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000
CMD ["node", "dist/server.js"]
