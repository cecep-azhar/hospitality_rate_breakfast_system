// Circuit breaker for external API calls (WA Gateway)

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuits: Map<string, CircuitState> = new Map();

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60 * 1000; // 1 minute

export function isCircuitOpen(name: string): boolean {
  const state = circuits.get(name);
  if (!state) return false;

  if (state.isOpen) {
    // Check if reset timeout has passed
    if (Date.now() - state.lastFailure > RESET_TIMEOUT_MS) {
      // Half-open state - allow one request
      state.isOpen = false;
      state.failures = 0;
      return false;
    }
    return true;
  }

  return false;
}

export function recordSuccess(name: string): void {
  const state = circuits.get(name);
  if (state) {
    state.failures = 0;
    state.isOpen = false;
  }
}

export function recordFailure(name: string): void {
  let state = circuits.get(name);

  if (!state) {
    state = { failures: 0, lastFailure: 0, isOpen: false };
    circuits.set(name, state);
  }

  state.failures++;
  state.lastFailure = Date.now();

  if (state.failures >= FAILURE_THRESHOLD) {
    state.isOpen = true;
  }
}

export function getCircuitStatus(name: string): { failures: number; isOpen: boolean } {
  const state = circuits.get(name);
  return {
    failures: state?.failures ?? 0,
    isOpen: state?.isOpen ?? false,
  };
}

export function resetCircuit(name: string): void {
  circuits.delete(name);
}