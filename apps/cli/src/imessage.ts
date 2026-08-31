import {
  isFiniteJsonNumber,
  isJsonObject,
  isJsonString,
  type JsonValue,
} from "./json";

type ImessageCommand = {
  action: "status" | "disconnect";
  address?: string;
};

/** A request to unlink iMessage senders, optionally scoped to one address. */
type ImessageDisconnectRequest = {
  action: "disconnect";
  address?: string;
};

/** Every request body the CLI iMessage route accepts. */
type ImessageChannelRequest = { action: "status" } | ImessageDisconnectRequest;

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type ImessageConnection = {
  address: string;
  addressKind: "phone" | "email";
  connectedAt: number;
};

function errorMessage(body: JsonValue, fallback: string) {
  return isJsonObject(body) && isJsonString(body.error) ? body.error : fallback;
}

const ADDRESS_KINDS = ["phone", "email"] as const;

/** Reads the agent's list of linked iMessage senders. */
function parseConnections(payload: JsonValue): ImessageConnection[] {
  if (!isJsonObject(payload) || !Array.isArray(payload.connections)) {
    throw new Error("Bee returned an invalid iMessage status.");
  }
  return payload.connections.map((entry) => {
    const addressKind = isJsonObject(entry)
      ? ADDRESS_KINDS.find((known) => known === entry.addressKind)
      : undefined;
    if (
      !isJsonObject(entry) ||
      !isJsonString(entry.address) ||
      !isFiniteJsonNumber(entry.connectedAt) ||
      !addressKind
    ) {
      throw new Error("Bee returned an invalid iMessage connection.");
    }
    return {
      address: entry.address,
      addressKind,
      connectedAt: entry.connectedAt,
    };
  });
}

/** Reads how many iMessage senders the agent unlinked. */
function parseDisconnectedCount(payload: JsonValue): number {
  if (isJsonObject(payload) && isFiniteJsonNumber(payload.disconnected)) {
    return payload.disconnected;
  }
  throw new Error("Bee returned an invalid iMessage disconnect response.");
}

async function imessageRequest<T>(
  agentUrl: string,
  accessToken: string,
  body: ImessageChannelRequest,
  fetcher: Fetcher,
  parse: (payload: JsonValue) => T,
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
  const result: JsonValue = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      errorMessage(
        result,
        `Bee iMessage request failed (HTTP ${response.status}).`,
      ),
    );
  }
  return parse(result);
}

export async function runImessageCommand(
  command: ImessageCommand,
  config: { agentUrl: string; accessToken: string },
  dependencies: { fetch?: Fetcher } = {},
) {
  const fetcher = dependencies.fetch ?? fetch;

  if (command.action === "status") {
    const connections = await imessageRequest(
      config.agentUrl,
      config.accessToken,
      { action: "status" },
      fetcher,
      parseConnections,
    );
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

  const disconnectRequest: ImessageDisconnectRequest = {
    action: "disconnect",
  };
  if (command.address) disconnectRequest.address = command.address;
  const disconnected = await imessageRequest(
    config.agentUrl,
    config.accessToken,
    disconnectRequest,
    fetcher,
    parseDisconnectedCount,
  );
  if (disconnected === 0) {
    return command.address
      ? `${command.address} was not linked to your account.`
      : "iMessage was not connected, so there was nothing to disconnect.";
  }
  return `Disconnected ${disconnected} iMessage address${disconnected === 1 ? "" : "es"} from BeeGreat.`;
}
