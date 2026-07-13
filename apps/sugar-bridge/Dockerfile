FROM oven/bun:1.2.23

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 python3-pip \
  && pip3 install --break-system-packages "git+https://github.com/velodrome-finance/sugar-sdk.git@e8f7c6a8c069aa23376837fb4eafc53b1377bfdd" \
  && apt-get purge -y git \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock ./
COPY apps/sugar-bridge/package.json apps/sugar-bridge/package.json
COPY packages/sugar/package.json packages/sugar/package.json
RUN bun install --frozen-lockfile --filter @beegreat/sugar-bridge

COPY apps/sugar-bridge apps/sugar-bridge
COPY packages/sugar packages/sugar

ENV NODE_ENV=production
EXPOSE 3000
USER bun
CMD ["bun", "run", "--cwd", "apps/sugar-bridge", "start"]
