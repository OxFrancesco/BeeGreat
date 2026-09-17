export const chatGptConnectionUrl = "https://pecu.app/agent#chatgpt";
export const chatGptConnectionRequired = `Connect your ChatGPT subscription to use AI chat: ${chatGptConnectionUrl}. Wallet commands still work.`;

const legacyConnectionRequired = "Connect your ChatGPT subscription in your Pecu profile at https://pecu.app/agent to use AI chat. Wallet commands still work.";

export function needsChatGptConnection(reply: { text: string; recovery?: "connect_chatgpt" }) {
  return reply.recovery === "connect_chatgpt" || reply.text === chatGptConnectionRequired || reply.text === legacyConnectionRequired;
}

export function chatGptUserCode(instructions: string): string | undefined {
  return /^Enter code:\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*$/i.exec(instructions)?.[1];
}
