import { API_BASE_URL } from './shared'

/// <summary>
/// Fetches the GONF-013 synthesized clue item definitions for a playthrough (gonfName, saveId),
/// if a hidden mystery case file exists for it. This only returns item definitions
/// (name/description/location/etc.) - never guilt, clue, or witness information - so it is safe
/// for the player-facing client to consume directly (GONF-013 Business Rule 2). Returns an empty
/// array when the Gonf has no mystery case file (non-mystery Gonf) rather than throwing.
/// </summary>
export async function fetchSynthesizedItems({ gonfName, saveId }) {
  if (!gonfName || !saveId) {
    return []
  }

  const response = await fetch(
    `${API_BASE_URL}/api/gonf/${encodeURIComponent(gonfName)}/playstate/${encodeURIComponent(saveId)}/synthesized-items`,
  )

  if (!response.ok) {
    return []
  }

  const payload = await response.json().catch(() => null)
  if (!payload?.success) {
    return []
  }

  return Array.isArray(payload.data?.items) ? payload.data.items : []
}
