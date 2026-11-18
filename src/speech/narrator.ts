/** Remainders longer than this are a fast scrub, not reading, so they are skipped in silence. */
const MAX_BACKLOG_CHARS = 400

export type SpeechSource = {
  /** Streams audio for `text`. Must stop (by throwing or returning) once `signal` aborts. */
  speak(text: string, signal: AbortSignal): AsyncIterable<Uint8Array>
}

export type Player = {
  play(chunks: AsyncIterable<Uint8Array>, signal: AbortSignal): Promise<void>
  stop(): void
}

/**
 * Reads aloud the text the knob has revealed, one finished sentence at a time.
 * Moving the knob back past what was read silences it; the sentences it crosses again going forward are read once more.
 */
export function createNarrator({ source, player }: { source: SpeechSource; player: Player }) {
  let isOn = true
  let spoken = ""
  let pending = ""
  let controller: AbortController | undefined
  let isRunning = false

  return { update, setOn }

  function setOn(on: boolean) {
    isOn = on
    if (!on) cancel()
  }

  /** `shown` is everything the knob has revealed so far. */
  function update(shown: string) {
    const settled = settledPrefix(shown)
    if (!settled.startsWith(spoken)) {
      cancel()
      spoken = settled
      return
    }

    const next = settled.slice(spoken.length)
    if (!next.trim()) return
    spoken = settled
    if (!isOn) return
    if (next.length > MAX_BACKLOG_CHARS) return cancel()
    pending += next
    void run()
  }

  function cancel() {
    controller?.abort()
    controller = undefined
    pending = ""
    player.stop()
  }

  async function run() {
    if (isRunning) return
    isRunning = true
    const own = (controller = new AbortController())
    try {
      while (pending.trim() && !own.signal.aborted) {
        const text = pending
        pending = ""
        await player.play(source.speak(text, own.signal), own.signal)
      }
    } catch (error) {
      if (!own.signal.aborted) console.error("speech failed", error)
    } finally {
      isRunning = false
      if (pending.trim()) void run()
    }
  }
}

/** The text up to its last sentence end that is followed by whitespace, so a sentence still being revealed is not read yet. */
export function settledPrefix(text: string) {
  const ends = [...text.matchAll(/[.!?…]["'”’)\]]*(?=\s)/g)]
  const last = ends.at(-1)
  return last ? text.slice(0, last.index + last[0].length) : ""
}
