const args = ["xurl", "auth", "oauth2", "--headless"];
if (Bun.env.XURL_APP) args.push("--app", Bun.env.XURL_APP);
console.log("Open the authorization URL printed below in Helium, then return here to finish OAuth.");
const child = Bun.spawn(args, { stdin: "inherit", stdout: "inherit", stderr: "inherit", env: Bun.env });
process.exitCode = await child.exited;
export {};
