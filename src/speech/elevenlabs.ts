const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
const MODEL = "eleven_flash_v2_5"
export const SAMPLE_RATE = 24000

export const KEY_STORAGE = "elevenlabs-api-key"

export const storedApiKey = () => localStorage.getItem(KEY_STORAGE)?.trim()

export type SpeechRequest = { apiKey: string; text: string; signal: AbortSignal }

/** Streams 16-bit little-endian mono PCM at `SAMPLE_RATE`; chunks may split a sample. */
export async function* streamSpeech({ apiKey, text, signal }: SpeechRequest) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=pcm_${SAMPLE_RATE}`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({ text, model_id: MODEL }),
  })

  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
  if (!response.body) throw new Error("no response body")

  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) return
    yield value
  }
}
