export type TaskUpdateState = 'pending' | 'failed';

export class TaskUpdates {
  private states: Readonly<Partial<Record<string, TaskUpdateState>>> = {};
  private listeners = new Set<() => void>();

  getSnapshot = () => this.states;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(id: string, state?: TaskUpdateState) {
    const next = { ...this.states };
    if (state) next[id] = state;
    else delete next[id];
    this.states = next;
    this.listeners.forEach((listener) => listener());
  }

  async run(id: string, update: () => unknown | Promise<unknown>) {
    if (this.states[id] === 'pending') return;
    this.set(id, 'pending');
    try {
      await update();
      this.set(id);
    } catch {
      this.set(id, 'failed');
    }
  }
}
