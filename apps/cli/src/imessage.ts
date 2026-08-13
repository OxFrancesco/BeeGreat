type ImessageCommand = {
  action: "status" | "disconnect";
  address?: string;
};

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type ImessageConnection = {
  address: string;
  addressKind: "phone" | "email";
  connectedAt: number;
};

function errorMessage(body: unknown, fallback: string) {
  return body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : fallback;
}

async function imessageRequest<T>(
  agentUrl: string,
  accessToken: string,
  body: Record<string, unknown>,
  fetcher: Fetcher,
): Promise<T> {
  const response = await fetcher(
    `${agentUrl.replace(/\/$/, "")}/cli/imessage`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const result = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(
      errorMessage(
        result,
        `Bee iMessage request failed (HTTP ${response.status}).`,
      ),
    );
  }
  return result as T;
}

export async function runImessageCommand(
  command: ImessageCommand,
  config: { agentUrl: string; accessToken: string },
  dependencies: { fetch?: Fetcher } = {},
) {
  const fetcher = dependencies.fetch ?? fetch;

  if (command.action === "status") {
    const { connections } = await imessageRequest<{
      connections: ImessageConnection[];
    }>(config.agentUrl, config.accessToken, { action: "status" }, fetcher);
    if (!connections.length) {
      return "iMessage is not connected. Text Bee from Messages and open the link she replies with.";
    }
    return [
      `iMessage is connected for ${connections.length} address${connections.length === 1 ? "" : "es"}:`,
      ...connections.map(
        (connection) =>
          `  ${connection.address} (${connection.addressKind}, linked ${new Date(connection.connectedAt).toLocaleDateString()})`,
      ),
    ].join("\n");
  }

  const { disconnected } = await imessageRequest<{ disconnected: number }>(
    config.agentUrl,
    config.accessToken,
    {
      action: "disconnect",
      ...(command.address ? { address: command.address } : {}),
    },
    fetcher,
  );
  if (disconnected === 0) {
    return command.address
      ? `${command.address} was not linked to your account.`
      : "iMessage was not connected, so there was nothing to disconnect.";
  }
  return `Disconnected ${disconnected} iMessage address${disconnected === 1 ? "" : "es"} from BeeGreat.`;
}
