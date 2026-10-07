import { API_BASE_URL } from './shared'

const DEFAULT_SAVE_ID = 'default'

/// <summary>
/// Posts an accusation to the server-side mystery resolution endpoint (GONF-014 Business Rules
/// 6-7) and returns whether the accusation was correct, plus the guilty character's motive text
/// when correct (GONF-015: used to build the guilty character's confession rant). The hidden
/// guilty character id itself is never returned to the client.
/// </summary>
export async function postAccusation({ gonfName, saveId, accusedCharacterId }) {
  const response = await fetch(
    `${API_BASE_URL}/api/gonf/${encodeURIComponent(gonfName)}/playstate/${encodeURIComponent(saveId ?? DEFAULT_SAVE_ID)}/accuse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accusedCharacterId }),
    },
  )

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.[0]?.message ?? 'Could not reach the mystery accusation service.'
    throw new Error(message)
  }

  return { correct: Boolean(payload.data?.correct), motive: payload.data?.motive ?? null }
}
