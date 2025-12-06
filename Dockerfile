FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    tor \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 5000

RUN chmod +x start-with-tor.sh

ENV NODE_ENV=production
ENV USE_TOR=true
ENV PROXY_URL=socks5://127.0.0.1:9050

CMD ["./start-with-tor.sh"]
