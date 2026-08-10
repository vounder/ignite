namespace Zuendung.Persistence;

/// <summary>Stable, explicit on-disk representation. Domain objects are deliberately not serialized.</summary>
public sealed class SaveDocumentV1
{
    public int SchemaVersion { get; set; } = 1;
    public required string CatalogVersion { get; init; }
    public required RandomDocument Random { get; init; }
    public long NextInstanceId { get; init; }
    public required string Phase { get; init; }
    public int Level { get; init; }
    public int Score { get; init; }
    public int Money { get; init; }
    public int PendingReward { get; init; }
    public bool RewardGranted { get; init; }
    public required List<string> OwnedDefinitionIds { get; init; }
    public RoundDocument? Round { get; init; }
    public ShopDocument? Shop { get; init; }
}

public sealed class RandomDocument { public ulong State { get; init; } public ulong Stream { get; init; } }
public sealed class CardDocument { public long InstanceId { get; init; } public required string DefinitionId { get; init; } }
public sealed class RoundDocument
{
    public required string ActiveActor { get; init; }
    public required string Outcome { get; init; }
    public required List<CardDocument> DrawPile { get; init; }
    public required List<CardDocument> DiscardPile { get; init; }
    public required List<CardDocument> PlayerHand { get; init; }
    public required List<CardDocument> OpponentHand { get; init; }
    public int PlayerSkips { get; init; }
    public int OpponentSkips { get; init; }
    public int TurnNumber { get; init; }
}
public sealed class ShopDocument
{
    public required List<ShopOfferDocument> Offers { get; init; }
    public int RerollCount { get; init; }
    public required List<string> PurchasedDefinitionIds { get; init; }
}
public sealed class ShopOfferDocument { public required string OfferId { get; init; } public required string DefinitionId { get; init; } public int Price { get; init; } public bool Purchased { get; init; } }
