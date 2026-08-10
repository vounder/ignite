namespace Zuendung.Domain;

public abstract record GameAction;
public sealed record PlayCardAction(Actor Actor, long CardInstanceId) : GameAction;
public sealed record DrawCardAction(Actor Actor) : GameAction;
public sealed record AdvanceOpponentAction : GameAction;
public sealed record ClaimRewardAction : GameAction;
public sealed record BuyOfferAction(string OfferId) : GameAction;
public sealed record RerollShopAction : GameAction;
public sealed record LeaveShopAction : GameAction;

public enum DomainEventKind
{
    RoundStarted,
    CardPlayed,
    CardsDrawn,
    TurnSkipped,
    TurnChanged,
    DiscardRecycled,
    ScoreChanged,
    IgnitionTriggered,
    RoundEnded,
    RewardGranted,
    ShopOpened,
    OfferPurchased,
    ShopRerolled,
    RunEnded
}

public sealed record DomainEvent(
    DomainEventKind Kind,
    Actor? Actor = null,
    long? CardInstanceId = null,
    string? DefinitionId = null,
    int Amount = 0,
    string? Message = null);
