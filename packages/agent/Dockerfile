FROM docker.io/golang:1.26.5-alpine AS gog-builder

ARG GOGCLI_COMMIT=d4a1a6e94707b9d65ce2bc82ec9505b654670c38
ENV CGO_ENABLED=0

RUN apk add --no-cache bash ca-certificates git
RUN git clone --filter=blob:none https://github.com/openclaw/gogcli.git /src/gogcli \
  && cd /src/gogcli \
  && git checkout "${GOGCLI_COMMIT}"
COPY safety-profiles/google-workspace-agent-safe.yaml /src/gogcli/safety-profiles/google-workspace-agent-safe.yaml
WORKDIR /src/gogcli
RUN ./build-safe.sh safety-profiles/google-workspace-agent-safe.yaml -o /out/gog-agent-safe

FROM docker.io/cloudflare/sandbox:0.12.4

ARG BUN_VERSION=1.3.14
ENV BUN_INSTALL=/root/.bun
ENV PATH=/root/.bun/bin:$PATH

RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"

COPY --from=gog-builder /out/gog-agent-safe /usr/local/bin/gog-agent-safe

COPY site-template /opt/bee-sites-template
WORKDIR /opt/bee-sites-template
RUN bun install

WORKDIR /workspace
