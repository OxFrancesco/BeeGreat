FROM docker.io/cloudflare/sandbox:0.12.4

ARG BUN_VERSION=1.3.14
ENV BUN_INSTALL=/root/.bun
ENV PATH=/root/.bun/bin:$PATH

RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"

COPY site-template /opt/bee-sites-template
WORKDIR /opt/bee-sites-template
RUN bun install

WORKDIR /workspace
