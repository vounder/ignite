namespace Zuendung.Domain;

public enum Suit { Hearts, Diamonds, Spades, Clubs }
public enum Rank { Two = 2, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Jack, Queen, King, Ace }
public enum Actor { Player, Opponent }
public enum RunPhase { InRound, Reward, Shop, GameOver }
public enum RoundOutcome { None, PlayerWon, OpponentWon }
public enum EffectKind { DrawCards, SkipTurn }

public sealed record EffectDefinition(string Id, EffectKind Kind, int Amount);

public sealed record CardDefinition(
    string Id,
    Suit? Suit,
    Rank? Rank,
    int Price,
    IReadOnlyList<EffectDefinition> Effects)
{
    public bool IsWild => Suit is null && Rank is null;
}

public sealed record CardInstance(long InstanceId, string DefinitionId);

public sealed record ShopOffer(string OfferId, string DefinitionId, int Price, bool Purchased);

public sealed record RoundSnapshot(
    Actor ActiveActor,
    RoundOutcome Outcome,
    IReadOnlyList<CardInstance> DrawPile,
    IReadOnlyList<CardInstance> DiscardPile,
    IReadOnlyList<CardInstance> PlayerHand,
    IReadOnlyList<CardInstance> OpponentHand,
    int PlayerSkips,
    int OpponentSkips,
    int TurnNumber);

public sealed record ShopSnapshot(
    IReadOnlyList<ShopOffer> Offers,
    int RerollCount,
    IReadOnlyList<string> PurchasedDefinitionIds);

public sealed record GameSessionSnapshot(
    int SnapshotVersion,
    string CatalogVersion,
    RunPhase Phase,
    int Level,
    int Score,
    int Money,
    int PendingReward,
    bool RewardGranted,
    ulong RandomState,
    ulong RandomStream,
    long NextInstanceId,
    IReadOnlyList<string> OwnedDefinitionIds,
    RoundSnapshot? Round,
    ShopSnapshot? Shop);

public sealed class DomainRuleException(string message) : InvalidOperationException(message);
