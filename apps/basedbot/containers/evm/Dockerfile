FROM oven/bun:1.4.2 AS bun-runtime
FROM docker.io/cloudflare/sandbox:0.12.9

COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
ENV PATH="/usr/local/bin:${PATH}"

# Pinned to the reviewed public SDK snapshot with Effect v4 rc.115.
ARG EVM_SDK_REPOSITORY=https://github.com/OxFrancesco/evmSDK.git
ARG EVM_SDK_COMMIT=28c19859eb8d72301277ed2b1271e2e6183206d7

RUN git clone --no-checkout "$EVM_SDK_REPOSITORY" /opt/evm \
  && git -C /opt/evm checkout --detach "$EVM_SDK_COMMIT" \
  && rm -rf /opt/evm/.git
WORKDIR /opt/evm
RUN bun install --frozen-lockfile && bun run build && bun dist/cli.js discover > /dev/null

ENV EVM_DATABASE=/tmp/evm/operations.sqlite
LABEL org.basedbot.runtime-revision="3"
