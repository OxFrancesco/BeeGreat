FROM oven/bun:1.3.14
WORKDIR /app
COPY src/container/codex-server.ts ./src/container/
COPY src/cloudflare/codex-protocol.ts ./src/cloudflare/
USER bun
EXPOSE 8080
CMD ["bun", "src/container/codex-server.ts"]
