type Listener = (payload: any) => void

const listeners = new Map<string, Set<Listener>>()

export const bridge = {
  touch: { up: false, down: false, left: false, right: false, interact: false, handbrake: false, boost: false },
  paused: false,
  quality: 'high' as 'high' | 'low',
  emit(event: string, payload?: any) {
    for (const listener of listeners.get(event) ?? []) listener(payload)
  },
  on(event: string, listener: Listener) {
    const bucket = listeners.get(event) ?? new Set<Listener>()
    listeners.set(event, bucket)
    bucket.add(listener)
    return () => { bucket.delete(listener) }
  },
  resetTouch() {
    for (const key of Object.keys(this.touch) as (keyof typeof this.touch)[]) this.touch[key] = false
  },
}
