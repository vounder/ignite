namespace Zuendung.Domain.V2;

public sealed class RunCatalogV2
{
    private readonly IReadOnlyDictionary<string, CardDefinitionV2> _cards;
    private readonly IReadOnlyDictionary<string, TrinketDefinitionV2> _trinkets;
    private readonly IReadOnlyDictionary<string, StarterDeckDefinitionV2> _starterDecks;
    private readonly IReadOnlyDictionary<string, EnemyDefinitionV2> _enemies;

    public string Version { get; }
    public IReadOnlyList<CardDefinitionV2> Cards { get; }
    public IReadOnlyList<TrinketDefinitionV2> Trinkets { get; }
    public IReadOnlyList<StarterDeckDefinitionV2> StarterDecks { get; }
    public IReadOnlyList<EnemyDefinitionV2> Enemies { get; }
    public IReadOnlyList<string> PlayerSpecialPool { get; }
    public IReadOnlyList<string> EnemySpecialPool { get; }

    public RunCatalogV2(
        string version,
        IEnumerable<CardDefinitionV2> cards,
        IEnumerable<TrinketDefinitionV2> trinkets,
        IEnumerable<StarterDeckDefinitionV2> starterDecks,
        IEnumerable<EnemyDefinitionV2> enemies)
    {
        Version = string.IsNullOrWhiteSpace(version) ? throw new ArgumentException("Catalog version is required.") : version;
        Cards = cards.OrderBy(item => item.Id, StringComparer.Ordinal).ToArray();
        Trinkets = trinkets.OrderBy(item => item.Id, StringComparer.Ordinal).ToArray();
        StarterDecks = starterDecks.OrderBy(item => item.Id, StringComparer.Ordinal).ToArray();
        Enemies = enemies.OrderBy(item => item.Id, StringComparer.Ordinal).ToArray();
        _cards = Unique(Cards, item => item.Id, "card");
        _trinkets = Unique(Trinkets, item => item.Id, "trinket");
        _starterDecks = Unique(StarterDecks, item => item.Id, "starter deck");
        _enemies = Unique(Enemies, item => item.Id, "enemy");
        PlayerSpecialPool = Cards.Where(item => item.IsSpecial).Select(item => item.Id).ToArray();
        EnemySpecialPool =
        [
            V2ContentIds.Stillstand, V2ContentIds.Addieren, V2ContentIds.Fluch,
            V2ContentIds.Tausch, V2ContentIds.Opfer, V2ContentIds.Zocken
        ];
        Validate();
    }

    public CardDefinitionV2 GetCard(string id) => _cards.TryGetValue(id, out var value)
        ? value
        : throw new KeyNotFoundException($"Unknown V2 card id: {id}");
    public TrinketDefinitionV2 GetTrinket(string id) => _trinkets.TryGetValue(id, out var value)
        ? value
        : throw new KeyNotFoundException($"Unknown V2 trinket id: {id}");
    public StarterDeckDefinitionV2 GetStarterDeck(string id) => _starterDecks.TryGetValue(id, out var value)
        ? value
        : throw new KeyNotFoundException($"Unknown V2 starter deck id: {id}");
    public EnemyDefinitionV2 GetEnemy(string id) => _enemies.TryGetValue(id, out var value)
        ? value
        : throw new KeyNotFoundException($"Unknown V2 enemy id: {id}");
    public bool ContainsCard(string id) => _cards.ContainsKey(id);
    public bool ContainsTrinket(string id) => _trinkets.ContainsKey(id);

    private void Validate()
    {
        if (Cards.Count(item => !item.IsSpecial) != 32) throw new InvalidOperationException("V2 requires exactly 32 standard cards.");
        if (Cards.Count(item => item.IsSpecial) != 11) throw new InvalidOperationException("V2 requires exactly 11 special cards.");
        foreach (var card in Cards)
        {
            if (card.BasePrice < 0) throw new InvalidOperationException($"Negative card price: {card.Id}");
            var effectIds = card.Effects.Select(effect => effect.Id).ToArray();
            if (effectIds.Distinct(StringComparer.Ordinal).Count() != effectIds.Length)
                throw new InvalidOperationException($"Duplicate effect binding on {card.Id}.");
            foreach (var effect in card.Effects)
                if (!DefaultResolverIds.Contains(effect.ResolverId)) throw new InvalidOperationException($"Unknown effect resolver {effect.ResolverId} on {card.Id}.");
        }
        foreach (var deck in StarterDecks)
        {
            if (deck.DefinitionIds.Count != 32) throw new InvalidOperationException($"Starter deck {deck.Id} must contain 32 cards.");
            foreach (var id in deck.DefinitionIds) _ = GetCard(id);
        }
        foreach (var enemy in Enemies)
            foreach (var id in enemy.SpecialPool) _ = GetCard(id);
        foreach (var id in EnemySpecialPool) _ = GetCard(id);
    }

    private static readonly HashSet<string> DefaultResolverIds =
    [
        V2ContentIds.Draw, V2ContentIds.Skip, V2ContentIds.Spy, V2ContentIds.Curse,
        V2ContentIds.HodlEffect, V2ContentIds.CreateStandard, V2ContentIds.Swap,
        V2ContentIds.Bonus, V2ContentIds.Sacrifice, V2ContentIds.Gamble, V2ContentIds.CreateSpecial
    ];

    private static IReadOnlyDictionary<string, T> Unique<T>(IEnumerable<T> values, Func<T, string> id, string kind)
    {
        var materialized = values.ToArray();
        var duplicate = materialized.GroupBy(id, StringComparer.Ordinal).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null) throw new InvalidOperationException($"Duplicate {kind} id: {duplicate.Key}");
        return materialized.ToDictionary(id, StringComparer.Ordinal);
    }

    public static RunCatalogV2 CreateDefault()
    {
        var cards = CreateStandardCards().Concat(CreateSpecialCards()).ToArray();
        var standardIds = cards.Where(card => !card.IsSpecial).Select(card => card.Id).ToArray();
        var starterDecks = new[]
        {
            new StarterDeckDefinitionV2("starter.classic", "Klassisch", 12, standardIds),
            new StarterDeckDefinitionV2("starter.igniter", "Zündler", 8, standardIds),
            new StarterDeckDefinitionV2("starter.cheater", "Falschspieler", 8, standardIds),
            new StarterDeckDefinitionV2("starter.alchemist", "Alchemist", 6, standardIds)
        };

        var commonEnemy = new[] { V2ContentIds.Stillstand, V2ContentIds.Addieren };
        var curseEnemy = new[] { V2ContentIds.Fluch, V2ContentIds.Addieren, V2ContentIds.Stillstand };
        var gambleEnemy = new[] { V2ContentIds.Tausch, V2ContentIds.Opfer, V2ContentIds.Zocken };
        var enemies = new[]
        {
            new EnemyDefinitionV2("enemy.ember-croupier", "Glut-Croupier", "balanced", "ai.greedy", commonEnemy),
            new EnemyDefinitionV2("enemy.curse-dealer", "Fluchdealer", "curse", "ai.pressure", curseEnemy),
            new EnemyDefinitionV2("enemy.cheater", "Falschspieler", "gamble", "ai.gamble", gambleEnemy),
            new EnemyDefinitionV2("elite.card-counter", "Kartenzähler", "elite", "ai.counter", commonEnemy.Concat(gambleEnemy).ToArray(), true),
            new EnemyDefinitionV2("elite.double-igniter", "Doppelzünder", "elite", "ai.pressure", curseEnemy, PassiveId: "passive.amplify-first-draw"),
            new EnemyDefinitionV2("boss.shark", "Der Schieber", "boss", "ai.gamble", commonEnemy.Concat(gambleEnemy).ToArray(), PassiveId: "passive.boss-shark"),
            new EnemyDefinitionV2("boss.madame-smoke", "Madame Rauch", "boss", "ai.counter", curseEnemy.Concat(gambleEnemy).ToArray(), true, "passive.boss-smoke"),
            new EnemyDefinitionV2("boss.house", "Der Hausherr", "boss", "ai.house", commonEnemy.Concat(curseEnemy).Concat(gambleEnemy).Distinct().ToArray(), PassiveId: "passive.boss-house")
        };

        return new RunCatalogV2("v2.0.0", cards, CreateTrinkets(), starterDecks, enemies);
    }

    private static IEnumerable<CardDefinitionV2> CreateStandardCards()
    {
        var ranks = new[] { Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace };
        foreach (var suit in Enum.GetValues<Suit>())
        foreach (var rank in ranks)
        {
            var effects = rank == Rank.Seven
                ? new[]
                {
                    new EffectBindingV2("standard.seven.draw", V2ContentIds.Draw, 2, Reflectable: true),
                    new EffectBindingV2("standard.seven.skip", V2ContentIds.Skip, 1, Reflectable: true)
                }
                : Array.Empty<EffectBindingV2>();
            var price = rank switch { Rank.Seven => 5, Rank.Eight => 3, Rank.Nine or Rank.Ten => 2, Rank.Jack or Rank.Queen => 3, _ => 4 };
            yield return new CardDefinitionV2(StandardId(suit, rank), $"{SuitName(suit)} {RankName(rank)}", suit, rank, price, RarityV2.Common, effects);
        }
    }

    private static IEnumerable<CardDefinitionV2> CreateSpecialCards()
    {
        yield return Special(V2ContentIds.Stillstand, "Stillstand", 5, RarityV2.Common, new EffectBindingV2("stillstand.skip", V2ContentIds.Skip, 1, Reflectable: true));
        yield return Special(V2ContentIds.Addieren, "Addieren", 6, RarityV2.Common, new EffectBindingV2("addieren.draw", V2ContentIds.Draw, 2, Reflectable: true));
        yield return Special(V2ContentIds.Spion, "Spion", 6, RarityV2.Common, new EffectBindingV2("spion.reveal", V2ContentIds.Spy, Duration: 2));
        yield return Special(V2ContentIds.Fluch, "Fluch", 8, RarityV2.Uncommon, new EffectBindingV2("fluch.apply", V2ContentIds.Curse, 1, 3, true));
        yield return Special(V2ContentIds.Hodl, "HODL", 7, RarityV2.Uncommon, new EffectBindingV2("hodl.contract", V2ContentIds.HodlEffect, 6));
        yield return Special(V2ContentIds.Zytokinese, "Zytokinese", 8, RarityV2.Uncommon, new EffectBindingV2("zyto.standard", V2ContentIds.CreateStandard, 2));
        yield return Special(V2ContentIds.Tausch, "Tausch", 10, RarityV2.Rare, new EffectBindingV2("tausch.hands", V2ContentIds.Swap));
        yield return Special(V2ContentIds.Bonusgeld, "Bonusgeld", 12, RarityV2.Rare, new EffectBindingV2("bonus.double", V2ContentIds.Bonus, 2));
        yield return Special(V2ContentIds.Opfer, "Opfer", 10, RarityV2.Rare, new EffectBindingV2("opfer.select", V2ContentIds.Sacrifice, 5));
        yield return Special(V2ContentIds.Zocken, "Zocken", 11, RarityV2.Rare, new EffectBindingV2("zocken.reveal", V2ContentIds.Gamble, 3));
        yield return Special(V2ContentIds.Zytokinese2, "Zytokinese II", 18, RarityV2.Legendary, new EffectBindingV2("zyto.special", V2ContentIds.CreateSpecial, 2));
    }

    private static CardDefinitionV2 Special(string id, string name, int price, RarityV2 rarity, params EffectBindingV2[] effects) =>
        new(id, name, null, null, price, rarity, effects);

    private static IEnumerable<TrinketDefinitionV2> CreateTrinkets()
    {
        yield return Trinket("trinket.lucky-chip", "Glückschip", "+2 Mark nach jedem Sieg.", RarityV2.Common, 8);
        yield return Trinket("trinket.ashtray", "Aschenbecher", "Ein optionaler Mulligan zu Kampfbeginn.", RarityV2.Common, 8);
        yield return Trinket("trinket.false-bottom", "Doppelboden", "Erster Kartenkauf im Shop kostet 2 weniger.", RarityV2.Common, 8);
        yield return Trinket("trinket.ledger", "Kassenbuch", "Übersprungene Kartenwahl gibt 4 Mark.", RarityV2.Common, 8);
        yield return Trinket("trinket.brass-knuckles", "Messingknöchel", "Erster eigener Zieheffekt erhält +1.", RarityV2.Uncommon, 12);
        yield return Trinket("trinket.pocket-watch", "Taschenuhr", "Erster gegnerischer Skip wird ignoriert.", RarityV2.Uncommon, 12);
        yield return Trinket("trinket.loaded-die", "Gezinkter Würfel", "Zocken deckt vier Karten auf.", RarityV2.Uncommon, 12);
        yield return Trinket("trinket.velvet-glove", "Samthandschuh", "Opfer bankt zusätzlich 3 Mark.", RarityV2.Uncommon, 12);
        yield return Trinket("trinket.black-book", "Schwarzes Notizbuch", "Gegnerhand zwei Züge sichtbar.", RarityV2.Rare, 18);
        yield return Trinket("trinket.smoke-mirror", "Rauchspiegel", "Erster reflektierbarer Effekt geht zurück.", RarityV2.Rare, 18);
        yield return Trinket("trinket.hot-wire", "Heißer Draht", "Erstes eigenes Special beendet den Zug nicht.", RarityV2.Rare, 18);
        yield return Trinket("trinket.golden-match", "Goldenes Streichholz", "Verhindert einmal den Verlust des letzten Lebens.", RarityV2.Legendary, 26);
    }

    private static TrinketDefinitionV2 Trinket(string id, string name, string description, RarityV2 rarity, int price) => new(id, name, description, rarity, price);

    public static string StandardId(Suit suit, Rank rank) => $"standard.{suit.ToString().ToLowerInvariant()}.{rank.ToString().ToLowerInvariant()}";
    private static string SuitName(Suit suit) => suit switch { Suit.Hearts => "Herz", Suit.Diamonds => "Karo", Suit.Spades => "Pik", _ => "Kreuz" };
    private static string RankName(Rank rank) => rank switch { Rank.Jack => "Bube", Rank.Queen => "Dame", Rank.King => "König", Rank.Ace => "Ass", _ => ((int)rank).ToString() };
}
