type GoogleHealthPowerupOperations = {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<unknown>;
  setEnabled: (enabled: boolean) => Promise<unknown>;
};

export async function updateGoogleHealthPowerup(
  enabled: boolean,
  operations: GoogleHealthPowerupOperations,
) {
  if (enabled) {
    await operations.setEnabled(true);
    try {
      const connected = await operations.connect();
      if (!connected) await operations.setEnabled(false);
      return connected;
    } catch (error) {
      await operations.setEnabled(false);
      throw error;
    }
  }

  await operations.disconnect();
  await operations.setEnabled(false);
  return true;
}
