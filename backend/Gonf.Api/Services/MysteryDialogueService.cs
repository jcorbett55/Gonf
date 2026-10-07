using Gonf.Api.Models;

namespace Gonf.Api.Services;

/// <summary>
/// Builds GONF-014 mystery-flavored prompt fragments from a hidden <see cref="MysteryCaseFile"/>:
/// a shared premise fact for every present character, an escalation/do-not-reveal instruction for
/// the guilty character scaled by how many of their relevant clues the player currently holds, and
/// witness-gated clue facts for innocent characters. Kept independent of the LLM call itself so it
/// can be exercised with fixed case-file fixtures in unit tests (GONF-014 Non-Functional
/// Requirement 1, QA Notes 1-4).
/// </summary>
public static class MysteryDialogueService
{
    /// <summary>
    /// The shared world-event premise every character is aware of from the start of the
    /// playthrough (GONF-014 Business Rule 1). In this implementation the premise text itself is
    /// authored generically; a future ticket may source it from the case file directly.
    /// </summary>
    public const string SharedPremiseFactText =
        "Everyone present is aware of the mysterious event that has unfolded and may be privately wondering who is responsible.";

    /// <summary>
    /// Returns the shared-premise sentence appended to every present character's prompt context
    /// (GONF-014 Business Rule 1, Acceptance Criteria 1), plus the anti-uniformity instruction
    /// (Business Rule 2) as a single instruction fragment for the overall system prompt.
    /// </summary>
    /// <param name="goalText">
    /// The authored Gonf's Goal text (for example, the pizza/anchovies premise), when available.
    /// Including the concrete premise text - rather than only the generic
    /// <see cref="SharedPremiseFactText"/> - gives weaker/local models a specific incident to
    /// reference instead of a vague "mysterious event", which measurably improves whether
    /// characters actually bring it up unprompted.
    /// </param>
    public static string BuildSharedPremiseInstruction(string? goalText = null)
    {
        var concretePremise = string.IsNullOrWhiteSpace(goalText)
            ? SharedPremiseFactText
            : $"{SharedPremiseFactText} Specifically: {goalText.Trim()}";

        return
            $"IMPORTANT SHARED MYSTERY PREMISE (every character present is already aware of this - it is common knowledge in this world, not a secret): {concretePremise} " +
            "Every character should show at least some awareness of this event when the topic comes up naturally (for example, gossiping about it unprompted, having an opinion about who might be responsible, or reacting when the player brings up the pizza, the anchovies, or any related clue) - do not treat it as unknown or irrelevant news. " +
            "Each character must react to this premise and to any clue discussed only through their own personality as described - " +
            "never phrase a reaction to the premise or a clue identically to how another character would phrase it.";
    }

    /// <summary>
    /// Counts how many of the guilty character's clues are currently "relevant" - i.e. the
    /// corresponding clue item is present in <paramref name="playerHeldItemIds"/> - and returns
    /// null when <paramref name="characterId"/> is not the case file's guilty character (GONF-014
    /// Business Rule 3, Acceptance Criteria 2/3).
    /// </summary>
    public static int? CountRelevantKnownClues(
        MysteryCaseFile caseFile,
        int characterId,
        IReadOnlyList<int>? playerHeldItemIds)
    {
        if (caseFile.GuiltyCharacterId != characterId)
        {
            return null;
        }

        if (playerHeldItemIds is not { Count: > 0 } || caseFile.Clues.Count == 0)
        {
            return 0;
        }

        var heldItemIds = new HashSet<int>(playerHeldItemIds);
        return caseFile.Clues.Count(clue => heldItemIds.Contains(clue.ItemId));
    }

    /// <summary>
    /// Builds the guilty character's escalation instruction: identical to innocent baseline when
    /// zero relevant clues are known (Acceptance Criteria 2), progressively more evasive as the
    /// known-relevant-clue count grows (Acceptance Criteria 3), plateauing once every relevant
    /// clue is known (Edge Case 3), and always including the explicit do-not-reveal list (Business
    /// Rule 4) regardless of clue count.
    /// </summary>
    public static string BuildGuiltyCharacterInstruction(MysteryCaseFile caseFile, string guiltyCharacterName, int relevantKnownClueCount)
    {
        var doNotReveal = BuildDoNotRevealList(caseFile, guiltyCharacterName);
        var doNotRevealText =
            $"{guiltyCharacterName} must never say or imply any of the following, under any circumstances: {string.Join("; ", doNotReveal)}. " +
            $"{guiltyCharacterName} must never confess or admit responsibility for the mystery, no matter how many clues the player has found.";

        if (relevantKnownClueCount <= 0)
        {
            return
                $"{guiltyCharacterName} is secretly responsible for the mystery, but the player has not yet found any clue relevant to them. " +
                $"{guiltyCharacterName} must answer exactly as an innocent character would - calm, unremarkable, no hint of guilt. {doNotRevealText}";
        }

        var totalRelevantClues = caseFile.Clues.Count(clue => true);
        var isMaxedOut = totalRelevantClues > 0 && relevantKnownClueCount >= totalRelevantClues;

        var escalationDescriptor = isMaxedOut
            ? "at their most nervous and evasive - visibly uncomfortable, deflecting, and prone to slipping a specific detail, but still stopping short of confessing"
            : $"noticeably more evasive and nervous than baseline (the player has found {relevantKnownClueCount} relevant clue(s)), and may let slip one specific, non-incriminating detail";

        return
            $"{guiltyCharacterName} is secretly responsible for the mystery. The player has discovered clues relevant to them, so {guiltyCharacterName} should now be {escalationDescriptor}. " +
            doNotRevealText;
    }

    /// <summary>
    /// The deterministic do-not-reveal phrase list for a guilty character (GONF-014 Business Rule
    /// 4): their own name in a confession context, explicit confession words, and their specific
    /// motive text. Exposed separately so <see cref="MysteryDialogueGuard"/> can scan against the
    /// same list used to build the prompt instruction.
    /// </summary>
    public static IReadOnlyList<string> BuildDoNotRevealList(MysteryCaseFile caseFile, string guiltyCharacterName)
    {
        return new[]
        {
            $"{guiltyCharacterName} did it",
            "guilty",
            "confess",
            "I did it",
            caseFile.Motive,
        };
    }

    /// <summary>
    /// Returns the clue facts an innocent character may reference: only clues where the case file
    /// assigns them (by <paramref name="characterId"/>) as the witness (GONF-014 Business Rule 5,
    /// Acceptance Criteria 5).
    /// </summary>
    public static IReadOnlyList<string> BuildWitnessedClueFacts(MysteryCaseFile caseFile, int characterId)
    {
        return caseFile.Clues
            .Where(clue => clue.WitnessCharacterId == characterId)
            .Select(clue => $"witnessed something involving item #{clue.ItemId} in room #{clue.RoomId}")
            .ToArray();
    }
}
