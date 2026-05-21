export type EffectHandler = (
  characterId: string,
  itemId: string,
  data: Record<string, unknown>,
) => Promise<{ success: boolean; data?: Record<string, unknown> }>

export class RuntimeEffectRegistry {
  private readonly handlers = new Map<string, EffectHandler>()

  register(eventName: string, handler: EffectHandler): void {
    this.handlers.set(eventName, handler)
  }

  async execute(
    eventName: string,
    characterId: string,
    itemId: string,
    data: Record<string, unknown> = {},
  ): Promise<{ success: boolean; data?: Record<string, unknown> }> {
    const handler = this.handlers.get(eventName)
    if (!handler) {
      // No handler registered — emit-only event, succeed silently
      return { success: true }
    }
    try {
      return await handler(characterId, itemId, data)
    } catch {
      // Effect failures are non-fatal — the DB use has already committed.
      return { success: false }
    }
  }

  has(eventName: string): boolean {
    return this.handlers.has(eventName)
  }

  unregister(eventName: string): void {
    this.handlers.delete(eventName)
  }
}
