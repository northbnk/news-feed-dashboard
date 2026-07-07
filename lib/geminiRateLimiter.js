export function createGeminiRateLimiter(maxRequestsPerMinute = 5) {
  const windowMs = 60_000;
  const timestamps = [];

  const prune = (now) => {
    while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
      timestamps.shift();
    }
  };

  return {
    tryReserveSlot() {
      const now = Date.now();
      prune(now);
      if (timestamps.length >= maxRequestsPerMinute) {
        return false;
      }
      timestamps.push(now);
      return true;
    },

    async waitForSlot() {
      while (!this.tryReserveSlot()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    },

    reset() {
      timestamps.length = 0;
    }
  };
}
