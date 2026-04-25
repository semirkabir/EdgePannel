type TaskPriority = 'high' | 'normal' | 'low';

interface ScheduledTask<T> {
  id: number;
  name: string;
  group: string;
  priority: TaskPriority;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

interface ScheduleOptions {
  priority?: TaskPriority;
  group?: string;
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

function defaultConcurrency(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  if (cores <= 2) return 2;
  if (cores <= 4) return 3;
  return 5;
}

export class DataTaskScheduler {
  private nextId = 1;
  private active = 0;
  private readonly activeByGroup = new Map<string, number>();
  private readonly queue: ScheduledTask<unknown>[] = [];

  constructor(
    private readonly maxConcurrent = defaultConcurrency(),
    private readonly groupLimits: Record<string, number> = {},
  ) {}

  schedule<T>(name: string, run: () => Promise<T>, options: ScheduleOptions = {}): Promise<T> {
    const group = options.group ?? 'default';
    const priority = options.priority ?? 'normal';

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id: this.nextId++,
        name,
        group,
        priority,
        run,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.queue.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || a.id - b.id);
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.maxConcurrent) {
      const index = this.queue.findIndex(task => this.canStartGroup(task.group));
      if (index === -1) return;

      const [task] = this.queue.splice(index, 1);
      if (!task) return;

      this.active++;
      this.activeByGroup.set(task.group, (this.activeByGroup.get(task.group) ?? 0) + 1);

      task.run()
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.active--;
          const groupActive = (this.activeByGroup.get(task.group) ?? 1) - 1;
          if (groupActive > 0) this.activeByGroup.set(task.group, groupActive);
          else this.activeByGroup.delete(task.group);
          this.drain();
        });
    }
  }

  private canStartGroup(group: string): boolean {
    const limit = this.groupLimits[group] ?? this.maxConcurrent;
    return (this.activeByGroup.get(group) ?? 0) < limit;
  }
}

export const dataTaskScheduler = new DataTaskScheduler(defaultConcurrency(), {
  finnhub: 2,
  yahoo: 2,
  coingecko: 1,
  economic: 2,
});
