export const codeTokenKey = (code: string, language: string) => JSON.stringify([language, code])

export class CodeTokenCache<T> {
  private entries = new Map<string, { value: T; size: number }>()
  private size = 0

  constructor(private readonly maxSize = 250_000, private readonly maxEntries = 64) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, size: number) {
    const previous = this.entries.get(key)
    if (previous) {
      this.size -= previous.size
      this.entries.delete(key)
    }
    if (size > this.maxSize) return
    while (this.size + size > this.maxSize || this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next()
      if (oldest.done) break
      this.size -= this.entries.get(oldest.value)?.size ?? 0
      this.entries.delete(oldest.value)
    }
    this.entries.set(key, { value, size })
    this.size += size
  }
}
