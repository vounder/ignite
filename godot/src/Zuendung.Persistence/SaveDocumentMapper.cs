using Zuendung.Domain;

namespace Zuendung.Persistence;

public static class SaveDocumentMapper
{
    public static SaveDocumentV1 ToDocument(GameSessionSnapshot s) => new()
    {
        CatalogVersion = s.CatalogVersion, Random = new() { State = s.RandomState, Stream = s.RandomStream }, NextInstanceId = s.NextInstanceId,
        Phase = s.Phase.ToString(), Level = s.Level, Score = s.Score, Money = s.Money, PendingReward = s.PendingReward, RewardGranted = s.RewardGranted,
        OwnedDefinitionIds = s.OwnedDefinitionIds.ToList(), Round = s.Round is null ? null : ToDocument(s.Round), Shop = s.Shop is null ? null : ToDocument(s.Shop)
    };

    public static GameSessionSnapshot ToSnapshot(SaveDocumentV1 d)
    {
        if (d.SchemaVersion != 1) throw new InvalidDataException($"Unsupported save schema version {d.SchemaVersion}.");
        if (d.Random is null) throw new InvalidDataException("Missing random state.");
        if (d.OwnedDefinitionIds is null) throw new InvalidDataException("Missing owned card ids.");
        var ownedIds = d.OwnedDefinitionIds.Select((id, index) => Required(id, $"OwnedDefinitionIds[{index}]")).ToArray();
        return new(1, Required(d.CatalogVersion, nameof(d.CatalogVersion)), Parse<RunPhase>(d.Phase, nameof(d.Phase)), d.Level, d.Score, d.Money, d.PendingReward, d.RewardGranted,
            d.Random.State, d.Random.Stream, d.NextInstanceId, ownedIds, d.Round is null ? null : ToSnapshot(d.Round), d.Shop is null ? null : ToSnapshot(d.Shop));
    }
    private static RoundDocument ToDocument(RoundSnapshot s) => new() { ActiveActor = s.ActiveActor.ToString(), Outcome = s.Outcome.ToString(), DrawPile = Cards(s.DrawPile), DiscardPile = Cards(s.DiscardPile), PlayerHand = Cards(s.PlayerHand), OpponentHand = Cards(s.OpponentHand), PlayerSkips = s.PlayerSkips, OpponentSkips = s.OpponentSkips, TurnNumber = s.TurnNumber };
    private static ShopDocument ToDocument(ShopSnapshot s) => new() { RerollCount = s.RerollCount, Offers = s.Offers.Select(x => new ShopOfferDocument { OfferId=x.OfferId, DefinitionId=x.DefinitionId, Price=x.Price, Purchased=x.Purchased }).ToList(), PurchasedDefinitionIds = s.PurchasedDefinitionIds.ToList() };
    private static List<CardDocument> Cards(IReadOnlyList<CardInstance> c) => c.Select(x => new CardDocument { InstanceId=x.InstanceId, DefinitionId=x.DefinitionId }).ToList();
    private static RoundSnapshot ToSnapshot(RoundDocument d) => new(Parse<Actor>(d.ActiveActor, nameof(d.ActiveActor)), Parse<RoundOutcome>(d.Outcome, nameof(d.Outcome)), Cards(d.DrawPile), Cards(d.DiscardPile), Cards(d.PlayerHand), Cards(d.OpponentHand), d.PlayerSkips, d.OpponentSkips, d.TurnNumber);
    private static ShopSnapshot ToSnapshot(ShopDocument d)
    {
        if (d.Offers is null) throw new InvalidDataException("Missing shop offers.");
        if (d.PurchasedDefinitionIds is null) throw new InvalidDataException("Missing purchased card ids.");
        var purchasedIds = d.PurchasedDefinitionIds.Select((id, index) => Required(id, $"PurchasedDefinitionIds[{index}]")).ToArray();
        return new ShopSnapshot(d.Offers.Select((offer, index) => offer is null
            ? throw new InvalidDataException($"Null shop offer at index {index}.")
            : new ShopOffer(Required(offer.OfferId, $"Offers[{index}].OfferId"), Required(offer.DefinitionId, $"Offers[{index}].DefinitionId"), offer.Price, offer.Purchased)).ToArray(), d.RerollCount, purchasedIds);
    }
    private static IReadOnlyList<CardInstance> Cards(List<CardDocument>? cards)
    {
        if (cards is null) throw new InvalidDataException("Missing card zone.");
        return cards.Select((card, index) => card is null
            ? throw new InvalidDataException($"Null card at zone index {index}.")
            : new CardInstance(card.InstanceId, Required(card.DefinitionId, $"Card[{index}].DefinitionId"))).ToArray();
    }
    private static T Parse<T>(string? value, string name) where T : struct, Enum => Enum.TryParse<T>(value, false, out var result) && Enum.IsDefined(result) ? result : throw new InvalidDataException($"Invalid {name}: {value ?? "<null>"}.");
    private static string Required(string? value, string name) => !string.IsNullOrWhiteSpace(value) ? value : throw new InvalidDataException($"Missing {name}.");
}
