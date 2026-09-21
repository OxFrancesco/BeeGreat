FROM oven/bun:1.4.2 AS bun-runtime
FROM docker.io/cloudflare/sandbox:0.12.9

COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
ENV PATH="/usr/local/bin:${PATH}"

# Pinned to the reviewed Safe wallet SDK snapshot.
ARG EVM_SDK_REPOSITORY=https://github.com/OxFrancesco/evmSDK.git
ARG EVM_SDK_COMMIT=80bdc8128f267a6ed96e1ce0cc92c9281e53a1e8

RUN git clone --no-checkout "$EVM_SDK_REPOSITORY" /opt/evm \
  && git -C /opt/evm checkout --detach "$EVM_SDK_COMMIT" \
  && rm -rf /opt/evm/.git
WORKDIR /opt/evm
RUN bun install --frozen-lockfile && bun run build && bun dist/cli.js discover > /dev/null

ENV EVM_DATABASE=/tmp/evm/operations.sqlite
LABEL org.pecu.runtime-revision="4"
