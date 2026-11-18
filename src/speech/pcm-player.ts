import { SAMPLE_RATE } from "./elevenlabs.ts"

/** Plays streamed 16-bit mono PCM gaplessly by scheduling each chunk right after the previous one on the audio clock. */
export function createPcmPlayer() {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE })
  const playing = new Set<AudioBufferSourceNode>()
  let nextStart = 0

  for (const type of ["pointerdown", "keydown"]) addEventListener(type, () => void context.resume(), { capture: true })

  return { play, stop }

  /** Resolves when the whole stream is scheduled, not when it has finished sounding. */
  async function play(chunks: AsyncIterable<Uint8Array>, signal: AbortSignal) {
    let leftover = new Uint8Array(0)
    for await (const chunk of chunks) {
      if (signal.aborted) return
      const bytes = concat(leftover, chunk)
      const whole = bytes.length - (bytes.length % 2)
      leftover = bytes.slice(whole)
      if (whole) schedule(new Int16Array(bytes.buffer, bytes.byteOffset, whole / 2))
    }
  }

  function stop() {
    for (const source of playing) source.stop()
    playing.clear()
    nextStart = 0
  }

  function schedule(samples: Int16Array) {
    const buffer = context.createBuffer(1, samples.length, SAMPLE_RATE)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768

    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.onended = () => playing.delete(source)
    nextStart = Math.max(nextStart, context.currentTime + 0.05)
    source.start(nextStart)
    nextStart += buffer.duration
    playing.add(source)
  }
}

function concat(a: Uint8Array, b: Uint8Array) {
  const joined = new Uint8Array(a.length + b.length)
  joined.set(a)
  joined.set(b, a.length)
  return joined
}
