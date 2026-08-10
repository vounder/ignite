using System.Text.Json;
using Xunit;
using Zuendung.Domain.V2;

namespace Zuendung.Domain.Tests;

public sealed class RunSessionV2Tests
{
    [Fact]
    public void Catalog_HasExpectedDeckSpecialsAndStandaloneSkip()
    {
        var catalog = RunCatalogV2.CreateDefault();
        Assert.Equal(32, catalog.Cards.Count(card => !card.IsSpecial));
        Assert.Equal(11, catalog.Cards.Count(card => card.IsSpecial));
        Assert.Empty(catalog.GetCard(RunCatalogV2.StandardId(Suit.Hearts, Rank.Eight)).Effects);
        Assert.Equal([V2ContentIds.Draw, V2ContentIds.Skip],
            catalog.GetCard(RunCatalogV2.StandardId(Suit.Hearts, Rank.Seven)).Effects.Select(effect => effect.ResolverId));
        Assert.Equal(V2ContentIds.Skip, Assert.Single(catalog.GetCard(V2ContentIds.Stillstand).Effects).ResolverId);
        Assert.Equal(32, catalog.GetStarterDeck("starter.classic").DefinitionIds.Count);
        Assert.Equal(7, RunSessionV2.StartingCollectionSize);
        Assert.Equal(5, RunSessionV2.MaximumTrinkets);
    }

    [Fact]
    public void SameSeed_ProducesIdenticalMapAndRandomFuture()
    {
        var first = RunSessionV2.CreateNew(0xCAFE);
        var second = RunSessionV2.CreateNew(0xCAFE);
        Assert.Equal(Json(first.Snapshot()), Json(second.Snapshot()));
        var node = first.Snapshot().Map.Nodes.First(item => item.VisitState == NodeVisitState.Available && item.Type == NodeTypeV2.Battle);
        first.Handle(new ChooseNodeActionV2(node.NodeId));
        second.Handle(new ChooseNodeActionV2(node.NodeId));
        Assert.Equal(Json(first.Snapshot()), Json(second.Snapshot()));
        Assert.Equal(Json(first.Snapshot()), Json(RunSessionV2.Restore(first.Snapshot()).Snapshot()));
    }

    [Fact]
    public void Stillstand_IsWildStandaloneSkip_AndLeavesEightNeutral()
    {
        var session = StartWithOnly(V2ContentIds.Stillstand);
        var before = session.Snapshot().Encounter!;
        var card = before.PlayerHand[0];
        session.Handle(new PlayCardActionV2(Actor.Player, card));
        var after = session.Snapshot().Encounter!;
        Assert.Equal(Actor.Player, after.ActiveActor);
        Assert.DoesNotContain(after.Statuses, status => status.Id == "status.skip" && status.Target == Actor.Opponent);
        Assert.Equal(before.OpponentHand.Count, after.OpponentHand.Count);
    }

    [Fact]
    public void Opfer_RequestsExactlyTwoExplicitCards_AndBanksMarks()
    {
        var session = StartWithOnly(V2ContentIds.Opfer);
        var source = session.Snapshot().Encounter!.PlayerHand[0];
        var result = session.Handle(new PlayCardActionV2(Actor.Player, source));
        var decision = Assert.IsType<PendingDecisionV2>(result.PendingDecision);
        Assert.Equal("sacrifice", decision.Context);
        Assert.Equal(2, decision.MinimumSelections);
        Assert.Equal(2, decision.MaximumSelections);
        session.Handle(new SubmitDecisionActionV2(decision.DecisionId, decision.OptionCopyIds.Take(2).ToArray()));
        var after = session.Snapshot().Encounter!;
        Assert.Equal(5, after.BankedMarks);
        Assert.Equal(4, after.PlayerHand.Count);
    }

    [Theory]
    [InlineData(V2ContentIds.Zytokinese)]
    [InlineData(V2ContentIds.Zytokinese2)]
    public void Zytokinese_RetiresSourceAndCreatesTwoPersistentCopies(string definitionId)
    {
        var session = StartWithOnly(definitionId);
        var source = session.Snapshot().Encounter!.PlayerHand[0];
        session.Handle(new PlayCardActionV2(Actor.Player, source));
        var snapshot = session.Snapshot();
        Assert.Equal(8, snapshot.PlayerCollection.Count);
        Assert.DoesNotContain(snapshot.PlayerCollection, copy => copy.CopyId == source);
        Assert.Equal(8, snapshot.Encounter!.PlayerHand.Count);
        Assert.Equal(Json(snapshot), Json(RunSessionV2.Restore(snapshot, session.Catalog).Snapshot()));
    }

    [Fact]
    public void RejectedV2Action_IsAtomicIncludingRandomStreams()
    {
        var session = RunSessionV2.CreateNew(42);
        var before = Json(session.Snapshot());
        Assert.Throws<DomainRuleException>(() => session.Handle(new DrawCardActionV2(Actor.Player)));
        Assert.Equal(before, Json(session.Snapshot()));
    }

    [Fact]
    public void NewRun_OwnsSevenRandomStandardCards_AndDealsThemAsOpeningHand()
    {
        var session = RunSessionV2.CreateNew(0x7132);
        var initial = session.Snapshot();
        Assert.Equal(7, initial.PlayerCollection.Count);
        Assert.All(initial.PlayerCollection, copy => Assert.False(session.Catalog.GetCard(copy.DefinitionId).IsSpecial));
        Assert.Equal(7, initial.PlayerCollection.Select(copy => copy.DefinitionId).Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(2, initial.Map.Nodes.Count(node => node.VisitState == NodeVisitState.Available));

        var node = initial.Map.Nodes.First(item => item.VisitState == NodeVisitState.Available && item.Type == NodeTypeV2.Battle);
        session.Handle(new ChooseNodeActionV2(node.NodeId));
        var encounter = session.Snapshot().Encounter!;
        Assert.Equal(7, encounter.PlayerHand.Count);
        Assert.Equal(7, encounter.OpponentHand.Count);
        Assert.Equal(initial.PlayerCollection.Select(copy => copy.CopyId).Order(), encounter.PlayerHand.Order());
        Assert.Equal(17, encounter.PlayerDrawPile.Count);
        Assert.Empty(encounter.OpponentDrawPile);
        Assert.Empty(encounter.OpponentDiscardPile);
        Assert.Equal(32, encounter.Copies.Count);
    }

    [Fact]
    public void BothActors_DrawFromTheSameSeventeenCardReserve()
    {
        var session = RunSessionV2.CreateNew(0x517A);
        var node = session.Snapshot().Map.Nodes.First(item => item.VisitState == NodeVisitState.Available && item.Type == NodeTypeV2.Battle);
        session.Handle(new ChooseNodeActionV2(node.NodeId));

        session.Handle(new DrawCardActionV2(Actor.Player));
        Assert.Equal(16, session.Snapshot().Encounter!.PlayerDrawPile.Count);
        session.Handle(new DrawCardActionV2(Actor.Opponent));

        var encounter = session.Snapshot().Encounter!;
        Assert.Equal(15, encounter.PlayerDrawPile.Count);
        Assert.Empty(encounter.OpponentDrawPile);
        Assert.Empty(encounter.OpponentDiscardPile);
    }

    [Fact]
    public void Restore_ReDealsALegacySeparateDeckEncounterAsSharedMauMauPack()
    {
        var session = RunSessionV2.CreateNew(0x0D32);
        var node = session.Snapshot().Map.Nodes.First(item => item.VisitState == NodeVisitState.Available && item.Type == NodeTypeV2.Battle);
        session.Handle(new ChooseNodeActionV2(node.NodeId));
        var snapshot = session.Snapshot();
        var encounter = snapshot.Encounter!;
        var moved = encounter.PlayerDrawPile[0];
        var legacyEncounter = encounter with
        {
            PlayerDrawPile = encounter.PlayerDrawPile.Skip(1).ToArray(),
            OpponentDrawPile = new[] { moved }
        };

        var restored = RunSessionV2.Restore(snapshot with { Encounter = legacyEncounter }, session.Catalog);
        var migrated = restored.Snapshot().Encounter!;

        Assert.True(restored.WasLegacyEncounterMigrated);
        Assert.Equal(7, migrated.PlayerHand.Count);
        Assert.Equal(7, migrated.OpponentHand.Count);
        Assert.Equal(17, migrated.PlayerDrawPile.Count);
        Assert.Empty(migrated.OpponentDrawPile);
    }

    [Theory]
    [InlineData(V2ContentIds.Stillstand)]
    [InlineData(V2ContentIds.Addieren)]
    [InlineData(V2ContentIds.Spion)]
    [InlineData(V2ContentIds.Fluch)]
    [InlineData(V2ContentIds.Hodl)]
    [InlineData(V2ContentIds.Zytokinese)]
    [InlineData(V2ContentIds.Tausch)]
    [InlineData(V2ContentIds.Bonusgeld)]
    [InlineData(V2ContentIds.Opfer)]
    [InlineData(V2ContentIds.Zocken)]
    [InlineData(V2ContentIds.Zytokinese2)]
    public void EverySpecialCard_ResolvesToAValidRestorableState(string definitionId)
    {
        var session = StartWithOnly(definitionId);
        var source = session.Snapshot().Encounter!.PlayerHand[0];
        var result = session.Handle(new PlayCardActionV2(Actor.Player, source));
        if (result.PendingDecision is { } decision)
            session.Handle(new SubmitDecisionActionV2(decision.DecisionId, decision.OptionCopyIds.Take(decision.MinimumSelections).ToArray()));
        var snapshot = session.Snapshot();
        Assert.Equal(Json(snapshot), Json(RunSessionV2.Restore(snapshot, session.Catalog).Snapshot()));
    }

    [Fact]
    public void AutomatedEncounter_ReachesRewardOrDefeat()
    {
        var session = RunSessionV2.CreateNew(77);
        var node = session.Snapshot().Map.Nodes.First(item => item.VisitState == NodeVisitState.Available && item.Type == NodeTypeV2.Battle);
        session.Handle(new ChooseNodeActionV2(node.NodeId));
        var guard = 0;
        while (session.Phase == RunPhaseV2.Encounter && guard++ < 20000)
        {
            var snapshot = session.Snapshot();
            var encounter = snapshot.Encounter!;
            if (encounter.PendingDecision is { } decision)
            {
                session.Handle(new SubmitDecisionActionV2(decision.DecisionId, decision.OptionCopyIds.Take(decision.MinimumSelections).ToArray()));
                continue;
            }
            if (encounter.ActiveActor == Actor.Opponent) { session.Handle(new AdvanceOpponentActionV2()); continue; }
            var playable = encounter.PlayerHand.FirstOrDefault(session.IsPlayable);
            if (playable != 0) session.Handle(new PlayCardActionV2(Actor.Player, playable));
            else session.Handle(new DrawCardActionV2(Actor.Player));
        }
        Assert.True(guard < 20000, "V2 encounter did not terminate.");
        Assert.Contains(session.Phase, new[] { RunPhaseV2.CardReward, RunPhaseV2.Defeat });
    }

    [Fact]
    public void SuccessfulVoluntaryDraws_DoNotCauseAnImmediateStalemate()
    {
        var session = RunSessionV2.CreateNew(901);
        var node = session.Snapshot().Map.Nodes.First(item => item.VisitState == NodeVisitState.Available && item.Type == NodeTypeV2.Battle);
        session.Handle(new ChooseNodeActionV2(node.NodeId));
        var opening = session.Snapshot().Encounter!;

        session.Handle(new DrawCardActionV2(Actor.Player));
        session.Handle(new DrawCardActionV2(Actor.Opponent));

        var after = session.Snapshot().Encounter!;
        Assert.Equal(RunPhaseV2.Encounter, session.Phase);
        Assert.Equal(0, after.ConsecutiveNoProgressTurns);
        Assert.Equal(opening.PlayerHand.Count + 1, after.PlayerHand.Count);
        Assert.Equal(opening.OpponentHand.Count + 1, after.OpponentHand.Count);
    }

    [Fact]
    public void CompletingOneMapNode_LocksItsSiblingBranches()
    {
        var session = RunSessionV2.CreateNew(77);
        var eventNode = session.Snapshot().Map.Nodes.Single(node => node.Row == 0 && node.Type == NodeTypeV2.Event);
        session.Handle(new ChooseNodeActionV2(eventNode.NodeId));
        var eventState = session.Snapshot().Event!;
        var safeOption = eventState.Options.Last();
        session.Handle(new ChooseEventOptionActionV2(safeOption.OptionId));

        var map = session.Snapshot().Map;
        Assert.All(map.Nodes.Where(node => node.Row == 0 && node.NodeId != eventNode.NodeId), node => Assert.Equal(NodeVisitState.Locked, node.VisitState));
        Assert.All(map.Nodes.Where(node => node.VisitState == NodeVisitState.Available), node => Assert.Equal(1, node.Row));
        var skippedSibling = map.Nodes.First(node => node.Row == 0 && node.NodeId != eventNode.NodeId);
        Assert.Throws<DomainRuleException>(() => session.Handle(new ChooseNodeActionV2(skippedSibling.NodeId)));
    }

    [Fact]
    public void AutomatedCampaign_VisitsAllThreeBosses_ReachesVictory_AndEntersEndless()
    {
        RunSessionV2? completed = null;
        HashSet<string>? bosses = null;
        for (ulong seed = 1; seed <= 64 && completed is null; seed++)
        {
            var candidate = RunSessionV2.CreateNew(seed);
            var visitedBosses = new HashSet<string>(StringComparer.Ordinal);
            if (!DriveCampaign(candidate, visitedBosses)) continue;
            completed = candidate;
            bosses = visitedBosses;
        }

        Assert.NotNull(completed);
        Assert.Equal(new[] { "boss.house", "boss.madame-smoke", "boss.shark" }, bosses!.Order(StringComparer.Ordinal));
        Assert.Equal(RunPhaseV2.Victory, completed!.Phase);
        completed.Handle(new EnterEndlessActionV2());
        var endless = completed.Snapshot();
        Assert.Equal(RunPhaseV2.Map, endless.Phase);
        Assert.Equal(RunModeV2.Endless, endless.Mode);
        Assert.Equal(4, endless.Act);
        Assert.Equal(1, endless.EndlessCycle);
    }

    private static bool DriveCampaign(RunSessionV2 session, HashSet<string> bosses)
    {
        for (var guard = 0; guard < 250000; guard++)
        {
            var snapshot = session.Snapshot();
            switch (snapshot.Phase)
            {
                case RunPhaseV2.Map:
                    var node = snapshot.Map.Nodes.Where(item => item.VisitState == NodeVisitState.Available)
                        .OrderBy(item => item.Type switch { NodeTypeV2.Event => 0, NodeTypeV2.Lounge => 1, NodeTypeV2.Shop => 2, NodeTypeV2.Battle => 3, NodeTypeV2.Elite => 4, _ => 5 })
                        .ThenBy(item => item.Column).First();
                    session.Handle(new ChooseNodeActionV2(node.NodeId));
                    break;
                case RunPhaseV2.Encounter:
                    var encounter = snapshot.Encounter!;
                    if (encounter.Kind == EncounterKindV2.Boss) bosses.Add(encounter.EnemyId);
                    if (encounter.PendingDecision is { } decision)
                        session.Handle(new SubmitDecisionActionV2(decision.DecisionId, decision.OptionCopyIds.Take(decision.MinimumSelections).ToArray()));
                    else if (encounter.ActiveActor == Actor.Opponent)
                        session.Handle(new AdvanceOpponentActionV2());
                    else
                    {
                        var playable = encounter.PlayerHand.FirstOrDefault(session.IsPlayable);
                        session.Handle(playable == 0 ? new DrawCardActionV2(Actor.Player) : new PlayCardActionV2(Actor.Player, playable));
                    }
                    break;
                case RunPhaseV2.CardReward:
                    session.Handle(new ChooseCardRewardActionV2(snapshot.Reward!.CardDefinitionIds[0]));
                    break;
                case RunPhaseV2.TrinketReward:
                    var trinket = snapshot.Reward!.TrinketIds.FirstOrDefault();
                    var replacement = trinket is not null && snapshot.TrinketIds.Count >= RunSessionV2.MaximumTrinkets ? snapshot.TrinketIds[0] : null;
                    session.Handle(new ChooseTrinketRewardActionV2(trinket, replacement));
                    break;
                case RunPhaseV2.Shop:
                    session.Handle(new LeaveShopActionV2());
                    break;
                case RunPhaseV2.Lounge:
                    session.Handle(new ChooseLoungeActionV2(LoungeChoiceV2.TakeMoney));
                    break;
                case RunPhaseV2.Event:
                    var eventState = snapshot.Event!;
                    var option = eventState.EventId == "event.open-tab" && snapshot.Lives > 1
                        ? eventState.Options.First(item => item.OptionId == "event.tab.risk")
                        : eventState.Options.Last();
                    session.Handle(new ChooseEventOptionActionV2(option.OptionId));
                    break;
                case RunPhaseV2.Victory:
                    return true;
                case RunPhaseV2.Defeat:
                    return false;
            }
        }
        throw new Xunit.Sdk.XunitException("Automated campaign exceeded its action guard.");
    }

    private static RunSessionV2 StartWithOnly(string definitionId)
    {
        var catalog = RunCatalogV2.CreateDefault();
        var custom = new RunCatalogV2(catalog.Version, catalog.Cards, catalog.Trinkets,
            [new StarterDeckDefinitionV2("starter.test", "Test", 12, Enumerable.Repeat(definitionId, 32).ToArray())], catalog.Enemies);
        var session = RunSessionV2.CreateNew(123, "starter.test", custom);
        var node = session.Snapshot().Map.Nodes.First(item => item.VisitState == NodeVisitState.Available && item.Type == NodeTypeV2.Battle);
        session.Handle(new ChooseNodeActionV2(node.NodeId));
        return session;
    }

    private static string Json(object value) => JsonSerializer.Serialize(value);
}
