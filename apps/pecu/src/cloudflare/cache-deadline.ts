export async function cacheDeadline<T>(operation: Promise<T>, timeoutMs = 1500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Public cache deadline exceeded")), timeoutMs);
  });
  try { return await Promise.race([operation, timeout]); }
  finally { clearTimeout(timer); }
}
