using System.Text.Json;
using Xunit;

namespace Zuendung.Domain.Tests;

public sealed class GameSessionTests
{
    [Fact]
    public void DefaultCatalog_IsCompleteMatrix_WithOrderedSevenAndEightEffects()
    {
        var catalog = GameCatalog.CreateDefault();
        Assert.Equal(52, catalog.Cards.Count);
        Assert.Equal(52, catalog.Cards.Select(card => (card.Suit, card.Rank)).Distinct().Count());
        Assert.All(catalog.Cards.Where(card => card.Rank == Rank.Seven), card =>
            Assert.Equal([EffectKind.DrawCards, EffectKind.SkipTurn], card.Effects.Select(effect => effect.Kind)));
        Assert.All(catalog.Cards.Where(card => card.Rank == Rank.Eight), card =>
            Assert.Equal([EffectKind.SkipTurn], card.Effects.Select(effect => effect.Kind)));
    }

    [Fact]
    public void NewRound_DealsFourEach_AndConservesAllCards()
    {
        var snapshot = GameSession.CreateNew(123).Snapshot();
        Assert.NotNull(snapshot.Round);
        Assert.Equal(4, snapshot.Round.PlayerHand.Count);
        Assert.Equal(4, snapshot.Round.OpponentHand.Count);
        Assert.Single(snapshot.Round.DiscardPile);
        Assert.Equal(52, snapshot.Round.DrawPile.Count + snapshot.Round.DiscardPile.Count + snapshot.Round.PlayerHand.Count + snapshot.Round.OpponentHand.Count);
    }

    [Fact]
    public void LegalPlay_MatchesEitherSuitOrRank()
    {
        var session = GameSession.CreateNew(44);
        var snapshot = session.Snapshot();
        var top = GameCatalog.CreateDefault().GetCard(snapshot.Round!.DiscardPile[^1].DefinitionId);
        foreach (var instance in snapshot.Round.PlayerHand)
        {
            var card = GameCatalog.CreateDefault().GetCard(instance.DefinitionId);
            Assert.Equal(card.Suit == top.Suit || card.Rank == top.Rank, session.IsPlayable(instance));
        }
    }

    [Fact]
    public void DrawOne_EndsPlayerTurn()
    {
        var session = GameSession.CreateNew(12);
        var before = session.Snapshot().Round!.PlayerHand.Count;
        var events = session.Handle(new DrawCardAction(Actor.Player));
        var after = session.Snapshot();
        Assert.Equal(before + 1, after.Round!.PlayerHand.Count);
        Assert.Equal(Actor.Opponent, after.Round.ActiveActor);
        Assert.Contains(events, item => item.Kind == DomainEventKind.TurnChanged && item.Actor == Actor.Opponent);
    }

    [Fact]
    public void RejectedAction_DoesNotMutateStateOrConsumeRandomness()
    {
        var session = GameSession.CreateNew(88);
        var before = JsonSerializer.Serialize(session.Snapshot());
        Assert.Throws<DomainRuleException>(() => session.Handle(new DrawCardAction(Actor.Opponent)));
        Assert.Equal(before, JsonSerializer.Serialize(session.Snapshot()));
    }

    [Fact]
    public void SameSeedAndActions_ProduceIdenticalOrderedState()
    {
        var first = GameSession.CreateNew(2026);
        var second = GameSession.CreateNew(2026);
        for (var i = 0; i < 20 && first.Phase == RunPhase.InRound; i++)
        {
            var a = Step(first);
            var b = Step(second);
            Assert.Equal(JsonSerializer.Serialize(a), JsonSerializer.Serialize(b));
            Assert.Equal(JsonSerializer.Serialize(first.Snapshot()), JsonSerializer.Serialize(second.Snapshot()));
        }
    }

    [Fact]
    public void SnapshotRestore_ContinuesDeterministically()
    {
        var original = GameSession.CreateNew(777);
        for (var i = 0; i < 8 && original.Phase == RunPhase.InRound; i++) Step(original);
        var restored = GameSession.Restore(original.Snapshot());
        for (var i = 0; i < 20 && original.Phase == RunPhase.InRound; i++)
        {
            Assert.Equal(JsonSerializer.Serialize(Step(original)), JsonSerializer.Serialize(Step(restored)));
            Assert.Equal(JsonSerializer.Serialize(original.Snapshot()), JsonSerializer.Serialize(restored.Snapshot()));
        }
    }

    [Fact]
    public void Seven_DrawsTwoThenSkipsTarget_InDefinitionOrder()
    {
        var session = SessionWithPlayerCard("standard.hearts.seven");
        var card = session.Snapshot().Round!.PlayerHand[0];
        var events = session.Handle(new PlayCardAction(Actor.Player, card.InstanceId));
        var snapshot = session.Snapshot();

        Assert.Equal(4, snapshot.Round!.OpponentHand.Count);
        Assert.Equal(Actor.Player, snapshot.Round.ActiveActor);
        var ordered = events.ToArray();
        Assert.True(Array.FindIndex(ordered, item => item.Kind == DomainEventKind.CardsDrawn) <
                    Array.FindIndex(ordered, item => item.Kind == DomainEventKind.TurnSkipped));
        Assert.Contains(events, item => item.Kind == DomainEventKind.IgnitionTriggered);
    }

    [Fact]
    public void Eight_SkipsTargetWithoutDrawing()
    {
        var session = SessionWithPlayerCard("standard.hearts.eight");
        var card = session.Snapshot().Round!.PlayerHand[0];
        session.Handle(new PlayCardAction(Actor.Player, card.InstanceId));
        var snapshot = session.Snapshot();

        Assert.Equal(2, snapshot.Round!.OpponentHand.Count);
        Assert.Equal(Actor.Player, snapshot.Round.ActiveActor);
    }

    [Fact]
    public void AutomatedPlay_ReachesAValidTerminalPhase()
    {
        var session = GameSession.CreateNew(5);
        var safety = 0;
        while (session.Phase == RunPhase.InRound && safety++ < 5000) Step(session);
        Assert.True(safety < 5000, "The round did not terminate.");
        Assert.Contains(session.Phase, new[] { RunPhase.Reward, RunPhase.GameOver });
        if (session.Phase == RunPhase.Reward)
        {
            var reward = session.Snapshot().PendingReward;
            var money = session.Money;
            session.Handle(new ClaimRewardAction());
            Assert.Equal(money + reward, session.Money);
            Assert.Equal(RunPhase.Shop, session.Phase);
            Assert.Throws<DomainRuleException>(() => session.Handle(new ClaimRewardAction()));
        }
    }

    [Fact]
    public void FullSlice_WinRewardPurchaseAndNextRound_IsConsistent()
    {
        GameSession? winning = null;
        for (ulong seed = 1; seed <= 256 && winning is null; seed++)
        {
            var candidate = GameSession.CreateNew(seed);
            var safety = 0;
            while (candidate.Phase == RunPhase.InRound && safety++ < 5000) Step(candidate);
            if (candidate.Phase == RunPhase.Reward) winning = candidate;
        }
        Assert.NotNull(winning);

        var beforeOwned = winning.Snapshot().OwnedDefinitionIds.Count;
        winning.Handle(new ClaimRewardAction());
        var offer = winning.Snapshot().Shop!.Offers.First(item => item.Price <= winning.Money);
        winning.Handle(new BuyOfferAction(offer.OfferId));
        Assert.Throws<DomainRuleException>(() => winning.Handle(new BuyOfferAction(offer.OfferId)));
        winning.Handle(new LeaveShopAction());

        var next = winning.Snapshot();
        Assert.Equal(2, next.Level);
        Assert.Equal(RunPhase.InRound, next.Phase);
        Assert.Equal(beforeOwned + 1, next.OwnedDefinitionIds.Count);
        Assert.Equal(next.OwnedDefinitionIds.Count,
            next.Round!.DrawPile.Count + next.Round.DiscardPile.Count + next.Round.PlayerHand.Count + next.Round.OpponentHand.Count);
    }

    [Fact]
    public void PurchasedCard_RemainsAccountedForAfterShopReroll()
    {
        GameSession? winning = null;
        for (ulong seed = 1; seed <= 256 && winning is null; seed++)
        {
            var candidate = GameSession.CreateNew(seed);
            var safety = 0;
            while (candidate.Phase == RunPhase.InRound && safety++ < 5000) Step(candidate);
            if (candidate.Phase == RunPhase.Reward) winning = candidate;
        }
        Assert.NotNull(winning);
        winning.Handle(new ClaimRewardAction());
        var beforeOwned = winning.Snapshot().OwnedDefinitionIds.Count;
        var affordable = winning.Snapshot().Shop!.Offers.First(offer => offer.Price <= winning.Money - 2);
        winning.Handle(new BuyOfferAction(affordable.OfferId));

        winning.Handle(new RerollShopAction());

        var snapshot = winning.Snapshot();
        Assert.Equal(beforeOwned + 1, snapshot.OwnedDefinitionIds.Count);
        Assert.Single(snapshot.Shop!.PurchasedDefinitionIds);
        Assert.Equal(affordable.DefinitionId, snapshot.Shop.PurchasedDefinitionIds[0]);
        Assert.All(snapshot.Shop.Offers, offer => Assert.False(offer.Purchased));
        Assert.Equal(JsonSerializer.Serialize(snapshot), JsonSerializer.Serialize(GameSession.Restore(snapshot).Snapshot()));
    }

    private static IReadOnlyList<DomainEvent> Step(GameSession session)
    {
        var snapshot = session.Snapshot();
        if (snapshot.Round!.ActiveActor == Actor.Opponent) return session.Handle(new AdvanceOpponentAction());
        var playable = snapshot.Round.PlayerHand.FirstOrDefault(session.IsPlayable);
        return playable is null
            ? session.Handle(new DrawCardAction(Actor.Player))
            : session.Handle(new PlayCardAction(Actor.Player, playable.InstanceId));
    }

    private static GameSession SessionWithPlayerCard(string definitionId)
    {
        var zones = new[]
        {
            new CardInstance(1, definitionId),
            new CardInstance(2, "standard.clubs.three"),
            new CardInstance(3, "standard.spades.four"),
            new CardInstance(4, "standard.diamonds.five"),
            new CardInstance(5, "standard.hearts.nine"),
            new CardInstance(6, "standard.clubs.ten"),
            new CardInstance(7, "standard.diamonds.jack"),
            new CardInstance(8, "standard.hearts.two")
        };
        var round = new RoundSnapshot(
            Actor.Player,
            RoundOutcome.None,
            zones[4..7],
            [zones[7]],
            zones[0..2],
            zones[2..4],
            0,
            0,
            1);
        var snapshot = new GameSessionSnapshot(
            1,
            "standard-1",
            RunPhase.InRound,
            1,
            0,
            12,
            0,
            false,
            12345,
            109,
            9,
            zones.Select(card => card.DefinitionId).ToArray(),
            round,
            null);
        return GameSession.Restore(snapshot);
    }
}
