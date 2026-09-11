# Local Chat Provider Setup (Ollama)

The character conversation feature (`POST /api/conversation/turn`) calls out to any
OpenAI-compatible chat-completion HTTP endpoint via `IChatCompletionProvider` /
`OpenAiChatCompletionProvider`. For local development we don't need a cloud API key —
we can run a small model locally with **Ollama**, which exposes an OpenAI-compatible
`/v1/chat/completions` endpoint out of the box.

This mirrors the same "local IMPS-style server" pattern already used for image
generation (`ImageProvider:Imps`), just for chat instead of images.

## 1. Install Ollama

1. Download and install Ollama for Windows: https://ollama.com/download
2. After installing, Ollama runs as a background service on `http://localhost:11434`.
3. Verify it's running:

   ```powershell
   curl http://localhost:11434
   ```

   You should get a short "Ollama is running" response.

## 2. Pull a model

Pick a small, fast, instruction-tuned model to start with (good balance of quality vs.
speed on a typical dev machine). Recommended starting point:

```powershell
ollama pull llama3.1:8b
```

Other good options if you want something smaller/faster or larger/better quality:

```powershell
ollama pull phi3:mini      # smaller/faster, lower quality
ollama pull llama3.1:70b   # much higher quality, needs a strong GPU/lots of RAM
```

## 3. Point Gonf at your local Ollama instance

Ollama's OpenAI-compatible endpoint lives at `/v1/chat/completions` on the default
port `11434`. Update `backend/Gonf.Api/appsettings.Development.json`:

```json
"ChatProvider": {
  "BaseUrl": "http://localhost:11434",
  "ChatPath": "/v1/chat/completions",
  "Model": "llama3.1:8b",
  "ApiKey": "",
  "TimeoutSeconds": 60
}
```

- `ApiKey` can stay empty — Ollama doesn't require one locally.
- `Model` must match the exact tag you pulled (e.g. `llama3.1:8b`, `phi3:mini`).
- If responses are slow on first use, that's normal — Ollama loads the model into
  memory on first request. Subsequent requests are faster.

## 4. Restart the backend

Restart `Gonf.Api` so it picks up the new `ChatProvider` configuration.

## 5. Live-test end to end

1. Start `frontend-player` and load a Gonf file that has at least one room containing
   a character with a description.
2. Navigate into that room — the conversation panel should auto-fetch an opening line
   from the character(s) present.
3. Type a reply in the conversation input and press Send — you should get an
   in-character AI-generated response back.

If you get a `503 CHAT_PROVIDER_NOT_CONFIGURED` error, double check `ChatProvider:BaseUrl`
is set and the backend was restarted. If you get a `502 CHAT_GENERATION_FAILED` error,
check the backend console logs — it logs the raw response body from the chat provider
on failure, which usually points to a bad model name or Ollama not running.

## 6. Swapping to OpenAI later

When you're ready to move to OpenAI (or another hosted OpenAI-compatible provider),
just update the same three settings — no code changes required:

```json
"ChatProvider": {
  "BaseUrl": "https://api.openai.com",
  "ChatPath": "/v1/chat/completions",
  "Model": "gpt-4o-mini",
  "ApiKey": "<your-api-key>",
  "TimeoutSeconds": 60
}
```
