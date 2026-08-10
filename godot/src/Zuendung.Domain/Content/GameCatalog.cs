namespace Zuendung.Domain;

public sealed class GameCatalog
{
    private readonly IReadOnlyDictionary<string, CardDefinition> _cards;

    public string Version { get; }
    public IReadOnlyList<CardDefinition> Cards { get; }

    public GameCatalog(string version, IEnumerable<CardDefinition> cards)
    {
        Version = string.IsNullOrWhiteSpace(version) ? throw new ArgumentException("Catalog version is required.") : version;
        Cards = cards.OrderBy(card => card.Id, StringComparer.Ordinal).ToArray();
        var duplicate = Cards.GroupBy(card => card.Id, StringComparer.Ordinal).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null) throw new InvalidOperationException($"Duplicate card id: {duplicate.Key}");
        _cards = Cards.ToDictionary(card => card.Id, StringComparer.Ordinal);
        if (Cards.Count == 0) throw new InvalidOperationException("The card catalog is empty.");
    }

    public CardDefinition GetCard(string id) =>
        _cards.TryGetValue(id, out var card) ? card : throw new KeyNotFoundException($"Unknown card id: {id}");

    public bool Contains(string id) => _cards.ContainsKey(id);

    public static GameCatalog CreateDefault()
    {
        var cards = new List<CardDefinition>(52);
        foreach (var suit in Enum.GetValues<Suit>())
        foreach (var rank in Enum.GetValues<Rank>())
        {
            var effects = new List<EffectDefinition>();
            if (rank == Rank.Seven)
            {
                effects.Add(new EffectDefinition("standard.draw-two", EffectKind.DrawCards, 2));
                effects.Add(new EffectDefinition("standard.skip-after-draw", EffectKind.SkipTurn, 1));
            }
            else if (rank == Rank.Eight)
            {
                effects.Add(new EffectDefinition("standard.skip", EffectKind.SkipTurn, 1));
            }

            var id = $"standard.{suit.ToString().ToLowerInvariant()}.{rank.ToString().ToLowerInvariant()}";
            var price = 1 + ((int)rank - 2) / 3;
            cards.Add(new CardDefinition(id, suit, rank, price, effects));
        }

        return new GameCatalog("standard-1", cards);
    }
}
