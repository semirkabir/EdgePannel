export interface ManagedService {
  init(): Promise<void> | void;
  destroy(): void;
}

export interface ManagedServiceRegistry {
  register(name: string, service: ManagedService): void;
  initAll(): Promise<void>;
  destroyAll(): void;
}

export function createManagedServiceRegistry(): ManagedServiceRegistry {
  const services = new Map<string, ManagedService>();

  return {
    register(name: string, service: ManagedService) {
      services.set(name, service);
    },

    async initAll() {
      for (const [name, service] of services) {
        try {
          await service.init();
        } catch (err) {
          console.error(`[ManagedService] Failed to init "${name}":`, err);
        }
      }
    },

    destroyAll() {
      for (const [name, service] of services) {
        try {
          service.destroy();
        } catch (err) {
          console.error(`[ManagedService] Failed to destroy "${name}":`, err);
        }
      }
      services.clear();
    },
  };
}
