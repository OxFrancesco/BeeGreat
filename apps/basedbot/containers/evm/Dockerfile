FROM docker.io/cloudflare/sandbox:0.12.9

# Pinned to the evmSDK commit mirrored in resources/evm-sdk (codeview).
ARG EVM_SDK_REPOSITORY=https://github.com/OxFrancesco/evmSDK.git
ARG EVM_SDK_COMMIT=a7a4ed36343ba248e3a0424ad3fea8b3967f53e2

RUN git clone --no-checkout "$EVM_SDK_REPOSITORY" /opt/evm \
  && git -C /opt/evm checkout --detach "$EVM_SDK_COMMIT" \
  && rm -rf /opt/evm/.git
WORKDIR /opt/evm
RUN bun install --frozen-lockfile && bun run build && bun dist/cli.js discover > /dev/null

ENV EVM_DATABASE=/tmp/evm/operations.sqlite
LABEL org.basedbot.runtime-revision="2"
