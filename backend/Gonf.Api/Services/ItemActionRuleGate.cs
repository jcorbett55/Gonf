namespace Gonf.Api.Services;

/// <summary>
/// Single, greppable decision point for whether an item action (e.g. a give/receive transfer
/// request) is allowed. In v1 there is no game rules engine yet, so every action is allowed.
/// A future game-rules-engine ticket should replace the body of <see cref="WillAllowAction"/>
/// with a real call into that engine - this is the only place that check belongs.
/// </summary>
public static class ItemActionRuleGate
{
    public static bool WillAllowAction(string action)
    {
        // TODO: GONF-0XX game rules engine
        var willDo = true;
        // willDo = gameRule.checkActionRule(action);
        return willDo;
    }
}
