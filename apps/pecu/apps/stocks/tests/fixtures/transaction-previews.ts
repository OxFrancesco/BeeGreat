import type { z } from "zod";
import type { previewSchema } from "../../../../src/web-contract";

const address = "0x1234567890123456789012345678901234567890";
const fee = "Network fee: not estimated yet.";
export const transactionPreviews: Array<z.infer<typeof previewSchema>> = [
  {
    title: "Swap",
    text: `Swap 0.05 ETH for about 120.00 USDC on Base.\nMinimum received: 119.40 USDC\n${fee}`,
  },
  { title: "Send 250 USDC", text: `Send 250.00 USDC to ${address}\n${fee}` },
  {
    title: "Approve USDC",
    text: `Approve ${address} to spend 150.00 USDC\n${fee}`,
  },
  {
    title: "Revoke USDC",
    text: `Revoke USDC allowance for ${address}\n${fee}`,
  },
  {
    title: "Buy NVDAc · Buy AAPLc",
    text: `100 USDC → about 0.452492 NVDAc\nMinimum received: 0.447967 NVDAc\n\n100 USDC → about 0.297571 AAPLc\nMinimum received: 0.294595 AAPLc\n${fee}`,
  },
  {
    title: "Add liquidity",
    text: `Deposit on Base\nToken 0: ETH\nAmount 0: 0.05\nToken 1: USDC\nAmount 1: 120.00\nMinimum liquidity: 240\n${fee}`,
  },
  {
    title: "Aave token approval",
    text: `Aave token approval on Base. Amount: 150 USDC.\nToken: ${address}\nThis only approves token spending. After confirmation, ask me to continue the original Aave action.\n${fee}`,
  },
  {
    title: "Contract call",
    text: `Call deposit on Base\nContract: ${address}\nArguments 1: 12345678901234567890123456789012345678901234567890\nSend: 0.000000000000000001 ETH\nWarning: Review the contract before confirming.\n${fee}`,
  },
  {
    title: "Swap",
    text: `Swap 12345678901234567890.123456789012345678 LONGTOKENSYMBOL for about 0.000000000000000001 USDC on Base.\nMinimum received: 0.000000000000000001 USDC\n${fee}`,
  },
  {
    title: "Remove liquidity",
    text: `Withdraw on Base\nPosition: 123\nMinimum amount 0: 0.0248 ETH\nMinimum amount 1: 59.70 USDC\n${fee}`,
  },
  { title: "Stake position", text: `Stake on Base\nPosition: 123\n${fee}` },
  { title: "Claim fees", text: `Claim fees on Base\nPosition: 123\n${fee}` },
  {
    title: "Aave supply",
    text: `Aave supply on Base. Amount: 150 USDC.\nToken: ${address}\nHealth factor after: 1.85\nWarning: Your position can be liquidated if collateral falls.\n${fee}`,
  },
].map((preview, index) => ({
  ...preview,
  code: (0xabc120 + index).toString(16).toUpperCase(),
  state: "pending",
  expiresAt: 1_900_000_000_000,
}));
