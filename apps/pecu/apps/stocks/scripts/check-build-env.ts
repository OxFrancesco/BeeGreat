const key = process.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!key || !/^pk_(live|test)_[A-Za-z0-9_-]+$/.test(key)) {
  throw new Error("Set VITE_CLERK_PUBLISHABLE_KEY in the build environment before building Pecu.");
}
console.log("Pecu build configuration checked.");
