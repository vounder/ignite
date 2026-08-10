using Zuendung.Domain;

namespace Zuendung.Game.Content;

public static class CatalogMapper
{
    public static GameCatalog Map(StandardCardSetResource resource)
    {
        ArgumentNullException.ThrowIfNull(resource);
        var cards = new List<CardDefinition>(52);
        foreach (var suit in Enum.GetValues<Suit>())
        foreach (var rank in Enum.GetValues<Rank>())
        {
            var effects = new List<EffectDefinition>();
            if (rank == Rank.Seven)
            {
                effects.Add(new EffectDefinition("standard.draw-two", EffectKind.DrawCards, resource.SevenDrawCount));
                effects.Add(new EffectDefinition("standard.skip-after-draw", EffectKind.SkipTurn, resource.SevenSkipCount));
            }
            else if (rank == Rank.Eight)
            {
                effects.Add(new EffectDefinition("standard.skip", EffectKind.SkipTurn, resource.EightSkipCount));
            }

            var priceIndex = (int)rank - 2;
            var price = resource.RankPrices.Count > priceIndex ? resource.RankPrices[priceIndex] : 1 + priceIndex / 3;
            cards.Add(new CardDefinition(
                $"standard.{suit.ToString().ToLowerInvariant()}.{rank.ToString().ToLowerInvariant()}",
                suit,
                rank,
                price,
                effects));
        }
        return new GameCatalog(resource.CatalogVersion, cards);
    }
}
