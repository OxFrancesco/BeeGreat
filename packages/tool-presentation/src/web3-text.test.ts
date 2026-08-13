import { describe, expect, test } from "bun:test";

import { humanizeWeb3Summary, projectTextWeb3Action } from "./web3-text";

describe("text-channel Web3 projection", () => {
  test("humanizes raw pool addresses", () => {
    expect(
      humanizeWeb3Summary(
        `Aerodrome claim emissions on Base: pool 0x${"ab".repeat(20)}`,
      ),
    ).toBe("Aerodrome claim emissions on Base · the selected pool");
  });

  test("routes linked-wallet authorization to BeeGreat instead of arming yes", () => {
    const projected = projectTextWeb3Action({
      kind: "execute_eoa_plan",
      status: "pending",
      autoConfirmed: false,
      summary: "Claim Aerodrome fees from your linked wallet",
    });

    expect(projected.text).toContain("Open BeeGreat to sign");
    expect(projected.text).not.toContain("Reply yes");
    expect(projected.links).toEqual(["https://beegreat.app"]);
    expect(projected.requiresTextConfirmation).toBe(false);
  });

  test("includes terminal detail and the final explorer link", () => {
    const projected = projectTextWeb3Action({
      kind: "socket_swap",
      status: "executed",
      autoConfirmed: true,
      summary: "Move 10 USDC from Base to Arbitrum",
      socketProgress: {
        detail: "Funds arrived on Arbitrum.",
        destinationExplorerLink: "https://arbiscan.io/tx/0x123",
      },
    });

    expect(projected.text).toContain("Funds arrived on Arbitrum.");
    expect(projected.links).toEqual(["https://arbiscan.io/tx/0x123"]);
  });
});
