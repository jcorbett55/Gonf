using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Gonf.Api.Models;

namespace Gonf.Api.Services;

public sealed partial class OpenAiChatCompletionProvider : IChatCompletionProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OpenAiChatCompletionProvider> _logger;

    public OpenAiChatCompletionProvider(HttpClient httpClient, IConfiguration configuration, ILogger<OpenAiChatCompletionProvider> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<ConversationTurnResult> GenerateConversationTurnAsync(ConversationTurnRequest request, CancellationToken cancellationToken)
    {
        var baseUrl = _configuration["ChatProvider:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return new ConversationTurnResult(
                false,
                null,
                "CHAT_PROVIDER_NOT_CONFIGURED",
                "Conversation provider is not configured. Set ChatProvider:BaseUrl."
            );
        }

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri))
        {
            return new ConversationTurnResult(
                false,
                null,
                "CHAT_PROVIDER_NOT_CONFIGURED",
                "Conversation provider base URL is invalid."
            );
        }

        var chatPath = _configuration["ChatProvider:ChatPath"] ?? "/v1/chat/completions";
        var model = _configuration["ChatProvider:Model"] ?? "gpt-4o-mini";
        var apiKey = _configuration["ChatProvider:ApiKey"];
        var requestUri = new Uri(baseUri, chatPath);

        var systemPrompt = BuildSystemPrompt(request);
        var userPrompt = BuildUserPrompt(request);
        _logger.LogWarning("DEBUG system prompt: {Prompt}", systemPrompt);
        _logger.LogWarning("DEBUG incoming characterMemory count: {Count}", request.CharacterMemory?.Count ?? -1);

        var maxTokens = int.TryParse(_configuration["ChatProvider:MaxResponseTokens"], out var parsedMaxTokens)
            ? parsedMaxTokens
            : 200;
        var contextWindow = int.TryParse(_configuration["ChatProvider:ContextWindow"], out var parsedContextWindow)
            ? parsedContextWindow
            : 2048;

        var payload = new
        {
            model,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt },
            },
            temperature = 0.9,
            max_tokens = maxTokens,
            options = new
            {
                num_predict = maxTokens,
                num_ctx = contextWindow,
            },
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = JsonContent.Create(payload),
        };

        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Chat completion request timed out.");
            return new ConversationTurnResult(false, null, "CHAT_GENERATION_TIMEOUT", "Conversation generation is still running. Please try again shortly.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat completion request failed.");
            return new ConversationTurnResult(false, null, "CHAT_GENERATION_FAILED", "Conversation generation request failed.");
        }

        using var _ = response;

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Chat provider returned status {StatusCode}. Body: {Body}", (int)response.StatusCode, body);
            return new ConversationTurnResult(false, null, "CHAT_GENERATION_FAILED", "Conversation provider rejected the request.");
        }

        try
        {
            using var document = JsonDocument.Parse(body);
            var content = document.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
            {
                return new ConversationTurnResult(false, null, "CHAT_GENERATION_FAILED", "Conversation provider returned an empty response.");
            }

            var lines = ParseConversationLines(content);
            if (lines is null || lines.Count == 0)
            {
                return new ConversationTurnResult(false, null, "CHAT_GENERATION_FAILED", "Conversation provider response could not be parsed.");
            }

            var filteredLines = lines
                .Select(line => ResolveSpeakerName(line, request.Characters) is { } resolvedName
                    ? line with { Speaker = resolvedName }
                    : null)
                .Where(line => line is not null)
                .Select(line => line!)
                .Distinct()
                .ToArray();

            if (filteredLines.Length == 0)
            {
                _logger.LogWarning(
                    "Chat provider returned speakers not present in the room. Raw speakers: {Speakers}",
                    string.Join(", ", lines.Select(line => line.Speaker)));
                return new ConversationTurnResult(false, null, "CHAT_GENERATION_FAILED", "Conversation provider response did not reference any character present in the room.");
            }

            var updatedMemory = RecordTurnMemory(request, filteredLines);
            return new ConversationTurnResult(true, filteredLines, null, null, updatedMemory);
        }
        catch (Exception ex)
        {

            return new ConversationTurnResult(false, null, "CHAT_GENERATION_FAILED", "Conversation provider response could not be parsed.");
        }
    }

    private static string? ResolveSpeakerName(ConversationLine line, IReadOnlyList<ConversationCharacterInfo> characters)
    {
        if (string.IsNullOrWhiteSpace(line.Speaker))
        {
            return null;
        }

        var exactMatch = characters.FirstOrDefault(character =>
            string.Equals(character.CharacterName, line.Speaker, StringComparison.OrdinalIgnoreCase));
        if (exactMatch is not null)
        {
            return exactMatch.CharacterName;
        }

        var speakerWords = line.Speaker
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var partialMatches = characters
            .Where(character => speakerWords.Any(word =>
                character.CharacterName.Contains(word, StringComparison.OrdinalIgnoreCase))
                || character.CharacterName.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Any(namePart => string.Equals(namePart, line.Speaker, StringComparison.OrdinalIgnoreCase)))
            .ToArray();

        return partialMatches.Length == 1 ? partialMatches[0].CharacterName : null;
    }

    internal static string BuildSystemPrompt(ConversationTurnRequest request)
    {
        var characterList = string.Join(
            "\n",
            request.Characters.Select(character =>
                $"- {character.CharacterName}: {character.CharacterDescription}{BuildCarriedItemsSuffix(character)}{BuildMemoryFactsSuffix(character)}"));

        return
            "You are role-playing as one or more characters inside a text adventure game. " +
            "Stay fully in character based on each character's description below, and never break the fourth wall. " +
            "Only the characters listed under 'Characters present' may speak in this response - these are the ONLY characters in the current scene. " +
            "Do not invent new characters, do not speak as the player, and do not use any character name that is not listed under 'Characters present', even if such a name appears elsewhere in this prompt. " +
            "Keep each line short (one or two sentences), conversational, and true to each character's personality. " +
            "This is critically important: match each character's emotional tone and demeanor exactly as described, even when that tone is rude, dismissive, angry, condescending, or hostile. " +
            "Do not soften, sanitize, or make a character politer, warmer, or more helpful than their description indicates. A character described as short-tempered, belligerent, aggressive, or prone to yelling should sound genuinely irritated or hostile in their dialogue (raised voice, insults, dismissiveness, interruptions), not merely dramatic or eccentric while remaining friendly underneath. " +
            "Being rude, blunt, or unhelpful in-character is expected and appropriate here; only avoid real-world slurs, graphic violence, or explicit self-harm content. " +
            "Not every character needs to respond on every turn - some turns only one character speaks, some turns nobody responds if they have nothing to add. " +
            "If a character's dialogue directly mentions or addresses another present character by name, that mentioned character should be noticeably more likely to respond next (to argue back, agree, or react), similar to a real group conversation. " +
            "Some characters listed above have items shown in parentheses after their description - these are the items that character is currently carrying. " +
            "If the player asks who has a specific item, or otherwise references an item that a present character is carrying, that character should acknowledge having it in character (for example, producing it, patting a pocket, or holding it up) rather than denying having it. " +
            "Do not have a character claim to carry an item that is not listed for them, and do not have a character give away, drop, or hand over an item merely by mentioning it in dialogue. " +
            "If the player asks a character what they are carrying or holding and that character has no items listed in parentheses, that character must clearly and explicitly state, in character, that they are not carrying or holding anything of note - do not have them deflect, change the subject, or speak vaguely about possessions in general. " +
            "Some characters listed above have remembered facts shown in square brackets after their description - these are things that character personally witnessed or was told about in-game. " +
            "A character may only reference a remembered fact that is listed for them - never reference an event, item interaction, or world event that is not listed as one of their remembered facts, even if it appears elsewhere in this prompt for a different character. " +
            "If a remembered fact for a character shows it has been asked about the same topic multiple times (a repeat count), that character should grow noticeably more impatient or annoyed each time, consistent with their described personality, rather than answering calmly every time as if it were the first time. " +
            "If information in 'Things already said' below covers what the player is asking about, do not repeat that exact line again - instead have the character briefly acknowledge they already said it (for example: I already told you..., Like I said...) or give a short new reaction, rather than restating the original line verbatim. " +
            $"Room: {request.RoomName}. Room description: {request.RoomDescription}.\n" +
            $"Characters present:\n{characterList}\n\n" +
            BuildPreviousLinesSection(request) +
            "Respond ONLY with strict JSON matching this shape, with no markdown fences or extra commentary: " +
            "{\"lines\":[{\"speaker\":\"CharacterName\",\"text\":\"Dialogue line\"}]}";
    }

    private static string BuildCarriedItemsSuffix(ConversationCharacterInfo character)
    {
        if (character.CarriedItems is not { Count: > 0 })
        {
            return string.Empty;
        }

        var itemNames = string.Join(", ", character.CarriedItems.Select(item => item.ItemName));
        return $" (carrying: {itemNames})";
    }

    private static string BuildMemoryFactsSuffix(ConversationCharacterInfo character)
    {
        var recallableMemories = CharacterMemoryService.FilterMemoriesForCharacter(character.CharacterId, character.MemoryFacts);
        if (recallableMemories.Count == 0)
        {
            return string.Empty;
        }

        var factDescriptions = recallableMemories.Select(memory => memory.IsCumulative
            ? $"{memory.FactText} (asked {memory.Count} times)"
            : memory.FactText);

        return $" [remembers: {string.Join("; ", factDescriptions)}]";
    }

    /// <summary>
    /// Records memory arising from this conversation turn: a shared PlayerStatement fact witnessed by
    /// all present characters, plus a RepeatedTopicQuery counter update for each present character based
    /// on the player's message. Merges the results into the caller-supplied existing memory using the
    /// default overwrite-by-FactKey rule.
    /// </summary>
    private static IReadOnlyList<CharacterMemoryEntry>? RecordTurnMemory(
        ConversationTurnRequest request,
        IReadOnlyList<ConversationLine> filteredLines)
    {
        if (request.Characters is not { Count: > 0 })
        {
            return request.CharacterMemory;
        }

        var timestampUtc = DateTimeOffset.UtcNow;
        var presentCharacterIds = request.Characters.Select(character => character.CharacterId).ToArray();

        var newEntries = new List<CharacterMemoryEntry>();
        newEntries.AddRange(CharacterMemoryService.RecordTurnMemories(presentCharacterIds, request.PlayerMessage, timestampUtc));

        foreach (var characterId in presentCharacterIds)
        {
            var repeatedTopicEntry = CharacterMemoryService.RecordRepeatedTopicQuery(
                characterId,
                request.PlayerMessage,
                request.CharacterMemory,
                timestampUtc);

            if (repeatedTopicEntry is not null)
            {
                newEntries.Add(repeatedTopicEntry);
            }
        }

        if (newEntries.Count == 0)
        {
            return request.CharacterMemory;
        }

        return CharacterMemoryService.MergeMemories(request.CharacterMemory, newEntries);
    }

    private static string BuildPreviousLinesSection(ConversationTurnRequest request)
    {
        if (request.PreviousLines is not { Count: > 0 })
        {
            return string.Empty;
        }

        var presentCharacterNames = new HashSet<string>(
            request.Characters.Select(character => character.CharacterName),
            StringComparer.OrdinalIgnoreCase);

        var relevantPreviousLines = request.PreviousLines
            .Where(line => presentCharacterNames.Contains(line.Speaker))
            .ToArray();

        if (relevantPreviousLines.Length == 0)
        {
            return string.Empty;
        }

        var previousLines = string.Join(
            "\n",
            relevantPreviousLines.Select(line => $"- {line.Speaker}: {line.Text}"));

        return $"Things already said by these characters earlier in this playthrough (do not repeat these verbatim):\n{previousLines}\n\n";
    }

    private static string BuildUserPrompt(ConversationTurnRequest request)
    {
        var builder = new StringBuilder();

        if (request.Transcript is { Count: > 0 })
        {
            builder.AppendLine("Conversation so far:");
            foreach (var entry in request.Transcript)
            {
                builder.AppendLine($"{entry.Speaker}: {entry.Text}");
            }
        }

        if (!string.IsNullOrWhiteSpace(request.PlayerMessage))
        {
            builder.AppendLine($"Player: {request.PlayerMessage}");
            builder.AppendLine("\nGenerate the character(s) response(s) to the player's latest message.");
        }
        else
        {
            builder.AppendLine("\nThe player has just entered the room. Generate an opening line of dialogue from one of the characters, in character, as if noticing the player arrive.");
        }

        return builder.ToString();
    }

    private static IReadOnlyList<ConversationLine>? ParseConversationLines(string content)
    {
        var trimmed = content.Trim();
        if (trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            var firstNewline = trimmed.IndexOf('\n');
            trimmed = firstNewline >= 0 ? trimmed[(firstNewline + 1)..] : trimmed;
            var lastFence = trimmed.LastIndexOf("```", StringComparison.Ordinal);
            if (lastFence >= 0)
            {
                trimmed = trimmed[..lastFence];
            }
        }

        var jsonObject = ExtractFirstJsonObject(trimmed);
        if (jsonObject is not null)
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<ConversationLinesEnvelope>(jsonObject, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                });

                var lines = parsed?.Lines?
                    .Where(line => !string.IsNullOrWhiteSpace(line.Speaker) && !string.IsNullOrWhiteSpace(line.Text))
                    .Select(line => new ConversationLine(line.Speaker!, line.Text!))
                    .ToArray();

                if (lines is { Length: > 0 })
                {
                    return lines;
                }
            }
            catch (JsonException)
            {
                // Fall through to salvage whatever complete "speaker"/"text" pairs we can find,
                // e.g. when the model response was truncated mid-array.
            }
        }

        return ExtractConversationLinesLoosely(trimmed);
    }

    private static IReadOnlyList<ConversationLine>? ExtractConversationLinesLoosely(string text)
    {
        var matches = ConversationLinePairPattern().Matches(text);
        if (matches.Count == 0)
        {
            return null;
        }

        var lines = matches
            .Select(match => new ConversationLine(
                Unescape(match.Groups["speaker"].Value),
                Unescape(match.Groups["text"].Value)))
            .Where(line => !string.IsNullOrWhiteSpace(line.Speaker) && !string.IsNullOrWhiteSpace(line.Text))
            .ToArray();

        return lines.Length > 0 ? lines : null;
    }

    private static string Unescape(string value) =>
        value.Replace("\\\"", "\"").Replace("\\n", "\n").Replace("\\\\", "\\");

    [GeneratedRegex(
        "\"speaker\"\\s*:\\s*\"(?<speaker>(?:[^\"\\\\]|\\\\.)*)\"\\s*,\\s*\"text\"\\s*:\\s*\"(?<text>(?:[^\"\\\\]|\\\\.)*)\"",
        RegexOptions.Singleline)]
    private static partial Regex ConversationLinePairPattern();

    private static string? ExtractFirstJsonObject(string text)
    {
        var start = text.IndexOf('{');
        if (start < 0)
        {
            return null;
        }

        var depth = 0;
        var inString = false;
        var isEscaped = false;

        for (var index = start; index < text.Length; index += 1)
        {
            var character = text[index];

            if (inString)
            {
                if (isEscaped)
                {
                    isEscaped = false;
                }
                else if (character == '\\')
                {
                    isEscaped = true;
                }
                else if (character == '"')
                {
                    inString = false;
                }

                continue;
            }

            if (character == '"')
            {
                inString = true;
                continue;
            }

            if (character == '{')
            {
                depth += 1;
            }
            else if (character == '}')
            {
                depth -= 1;
                if (depth == 0)
                {
                    return text[start..(index + 1)];
                }
            }
        }

        return null;
    }

    private sealed class ConversationLinesEnvelope
    {
        [JsonPropertyName("lines")]
        public List<ConversationLineDto>? Lines { get; set; }
    }

    private sealed class ConversationLineDto
    {
        [JsonPropertyName("speaker")]
        public string? Speaker { get; set; }

        [JsonPropertyName("text")]
        public string? Text { get; set; }
    }
}
