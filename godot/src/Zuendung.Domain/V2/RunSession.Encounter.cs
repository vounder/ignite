namespace Zuendung.Domain.V2;

public sealed partial class RunSessionV2
{
    private const int MaximumTriggeredPlays = 8;
    private const int MaximumResolutionSteps = 128;

    private bool MigrateLegacySeparateEncounterDecks()
    {
        if (_encounter is null ||
            _encounter.OpponentDrawPile.Count == 0 &&
            _encounter.OpponentDiscardPile.Count == 0 &&
            _encounter.Copies.Count <= 48)
            return false;

        var legacy = _encounter;
        _playerCollection.Clear();
        _playerCollection.AddRange(legacy.CheckpointPlayerCollection);
        Money = legacy.CheckpointMoney;
        _encounter = null;
        StartEncounter(legacy.EnemyId, legacy.Kind, [], legacy.Attempt + 1);
        return true;
    }

    private void StartEncounter(string enemyId, EncounterKindV2 kind, List<RunEventV2> events, int attempt = 0)
    {
        var enemy = _catalog.GetEnemy(enemyId);
        var encounter = new EncounterState
        {
            EncounterId = $"{_map.CurrentNodeId ?? "encounter"}.try{attempt}",
            EnemyId = enemyId,
            Kind = kind,
            Attempt = attempt,
            ActiveActor = Actor.Player,
            Outcome = EncounterOutcomeV2.None,
            ResolutionPhase = ResolutionPhaseV2.AwaitingAction,
            CheckpointMoney = Money
        };
        encounter.CheckpointPlayerCollection.AddRange(_playerCollection);
        foreach (var copy in _playerCollection) encounter.Copies.Add(copy.CopyId, copy);

        // One Mau-Mau pack is shared by both actors. The run's persistent
        // cards occupy matching slots; enemy specials replace standards.
        var sharedDefinitions = _catalog.Cards.Where(card => !card.IsSpecial).Select(card => card.Id).ToList();
        foreach (var copy in _playerCollection)
        {
            var reserveIndex = sharedDefinitions.FindIndex(id => string.Equals(id, copy.DefinitionId, StringComparison.Ordinal));
            if (reserveIndex >= 0) sharedDefinitions.RemoveAt(reserveIndex);
        }

        var ownedOpeningPool = _playerCollection.Select(copy => copy.CopyId).ToList();
        _random["player-deck"].Shuffle(ownedOpeningPool);
        var ownedOpening = ownedOpeningPool.Take(OpeningHandSize).ToArray();
        encounter.PlayerDrawPile.AddRange(ownedOpeningPool.Skip(OpeningHandSize));

        _random["enemy-deck"].Shuffle(sharedDefinitions);
        var specialCount = Math.Min(OpponentSpecialCount(kind), sharedDefinitions.Count);
        for (var index = 0; index < specialCount; index++) sharedDefinitions.RemoveAt(sharedDefinitions.Count - 1);
        for (var index = 0; index < specialCount; index++)
        {
            var definitionId = enemy.SpecialPool[_random["enemy-deck"].NextInt(enemy.SpecialPool.Count)];
            var copy = CreateEncounterCopy(definitionId, CardOwnerV2.Opponent);
            encounter.Copies.Add(copy.CopyId, copy);
            encounter.PlayerDrawPile.Add(copy.CopyId);
        }

        var tableCandidates = sharedDefinitions.Where(id => _catalog.GetCard(id).Effects.Count == 0).ToArray();
        var tableDefinition = tableCandidates.Length > 0
            ? tableCandidates[_random["encounter"].NextInt(tableCandidates.Length)]
            : sharedDefinitions[_random["encounter"].NextInt(sharedDefinitions.Count)];
        sharedDefinitions.Remove(tableDefinition);
        var neutral = new CardCopyV2(_nextCopyId++, tableDefinition, CardOwnerV2.Neutral, PersistenceScopeV2.Neutral);
        encounter.Copies.Add(neutral.CopyId, neutral);
        encounter.TableCopyId = neutral.CopyId;

        foreach (var definitionId in sharedDefinitions)
        {
            var copy = CreateEncounterCopy(definitionId, CardOwnerV2.Neutral);
            encounter.Copies.Add(copy.CopyId, copy);
            encounter.PlayerDrawPile.Add(copy.CopyId);
        }

        _random["player-deck"].Shuffle(encounter.PlayerDrawPile);
        _encounter = encounter;
        Phase = RunPhaseV2.Encounter;
        events.Add(new RunPhaseChangedEventV2(Phase));

        foreach (var copyId in ownedOpening)
        {
            encounter.PlayerHand.Add(copyId);
            events.Add(new CardMovedEventV2(copyId, encounter.Copies[copyId].DefinitionId, "shared-draw", "player-hand", "opening"));
        }
        DrawIntoHand(Actor.Opponent, OpeningHandSize, "opening", events, applyCurse: false);
        var extraOpeningCards = NextEncounterExtraCards;
        NextEncounterExtraCards = 0;
        if (extraOpeningCards > 0) DrawIntoHand(Actor.Player, extraOpeningCards, "opening-bonus", events, applyCurse: false);
        if (enemy.PassiveId == "passive.boss-house")
            AddOrMergeStatus("status.curse", Actor.Player, charges: 1, amount: 1, events: events);
        if (HasTrinket("trinket.black-book")) AddOrMergeStatus("status.spy", Actor.Player, duration: 2, events: events);
        if (HasTrinket("trinket.ashtray"))
        {
            encounter.PendingDecision = new PendingDecisionV2(NewDecisionId("mulligan"), DecisionKindV2.OptionalCard, Actor.Player,
                "mulligan", 0, encounter.PlayerHand.ToArray(), 0, 1, "decision.mulligan");
            encounter.ResolutionPhase = ResolutionPhaseV2.AwaitingDecision;
            events.Add(new DecisionRequestedEventV2(encounter.PendingDecision));
        }
        else BeginTurn(Actor.Player, events);
    }

    private int OpponentSpecialCount(EncounterKindV2 kind)
    {
        var campaignAct = Math.Clamp(Act, 1, 3);
        var baseCount = kind switch
        {
            EncounterKindV2.Battle => 2 + (campaignAct - 1) * 2,
            EncounterKindV2.Elite => 4 + (campaignAct - 1) * 2,
            _ => 6 + (campaignAct - 1) * 2
        };
        if (Mode == RunModeV2.Endless) baseCount += Math.Max(0, EndlessCycle - 1) * 2;
        return Math.Min(16, baseCount);
    }

    private void PlayCard(Actor actor, long copyId, List<RunEventV2> events)
    {
        RequireEncounterAction(actor);
        var encounter = _encounter!;
        if (!Hand(actor).Contains(copyId)) throw new DomainRuleException("The card is not in the active hand.");
        var copy = encounter.Copies[copyId];
        if (!IsPlayableByDefinition(copy, actor, ignoreMatch: false)) throw new DomainRuleException("That card cannot be played.");
        PlayFromZone(actor, copyId, "hand", events, triggered: false);
    }

    private void PlayFromZone(Actor actor, long copyId, string fromZone, List<RunEventV2> events, bool triggered, bool resolveNow = true)
    {
        var encounter = _encounter!;
        var hand = Hand(actor);
        if (fromZone == "hand") hand.Remove(copyId); else encounter.Staging.Remove(copyId);
        DisplaceTable(events);
        encounter.TableCopyId = copyId;
        var copy = encounter.Copies[copyId];
        events.Add(new CardMovedEventV2(copyId, copy.DefinitionId, fromZone, "table", triggered ? "triggered-play" : "play"));
        events.Add(new IgnitionEventV2(copyId, copy.DefinitionId, encounter.TriggeredPlayCount, actor));
        if (actor == Actor.Player)
        {
            var gained = 5 + (int)_catalog.GetCard(copy.DefinitionId).Rarity * 2;
            Score += gained;
            events.Add(new ScoreChangedEventV2(gained, Score));
        }
        encounter.RootActor ??= actor;
        encounter.ResolutionPhase = ResolutionPhaseV2.Resolving;
        encounter.ConsecutiveNoProgressTurns = 0;
        var definition = _catalog.GetCard(copy.DefinitionId);
        if (!triggered && actor == Actor.Player && definition.IsSpecial && HasUnusedTrinket("trinket.hot-wire"))
        {
            UseTrinket("trinket.hot-wire");
            encounter.RetainTurn = true;
        }
        foreach (var binding in definition.Effects)
            encounter.ResolutionQueue.Add(new ResolutionItemV2(binding.ResolverId, binding.Id, actor, copyId, binding.Amount, binding.Duration, binding.Reflectable));
        if (resolveNow) ResolveQueue(events);
    }

    private void DrawCard(Actor actor, List<RunEventV2> events)
    {
        RequireEncounterAction(actor);
        var drawn = DrawIntoHand(actor, 1, "voluntary-draw", events);
        _encounter!.ConsecutiveNoProgressTurns = drawn == 0
            ? _encounter.ConsecutiveNoProgressTurns + 1
            : 0;
        FinishTurn(actor, events);
    }

    private void AdvanceOpponent(List<RunEventV2> events)
    {
        RequireEncounterAction(Actor.Opponent);
        var encounter = _encounter!;
        var playable = encounter.OpponentHand.Where(id => IsPlayableByDefinition(encounter.Copies[id], Actor.Opponent, false))
            .OrderByDescending(id => AiCardValue(encounter.Copies[id])).ThenBy(id => id).ToArray();
        if (playable.Length > 0) PlayFromZone(Actor.Opponent, playable[0], "hand", events, triggered: false);
        else DrawCard(Actor.Opponent, events);
    }

    private int AiCardValue(CardCopyV2 copy)
    {
        var definition = _catalog.GetCard(copy.DefinitionId);
        var enemy = _catalog.GetEnemy(_encounter!.EnemyId);
        var effectScore = definition.Effects.Count * 100;
        var policyScore = enemy.AiPolicyId switch
        {
            "ai.pressure" => definition.Effects.Sum(effect => effect.ResolverId switch
            {
                V2ContentIds.Draw => 180,
                V2ContentIds.Curse => 160,
                V2ContentIds.Skip => 140,
                _ => 20
            }),
            "ai.gamble" => definition.Effects.Sum(effect => effect.ResolverId is V2ContentIds.Gamble or V2ContentIds.Swap ? 190 : 35),
            "ai.counter" => definition.IsSpecial ? -30 : 90,
            "ai.house" => definition.IsSpecial ? 140 + (int)definition.Rarity * 40 : 30,
            _ => 0
        };
        var informationScore = enemy.CanSeePlayerHand ? CounterplayScore(definition) : 0;
        return effectScore + policyScore + informationScore + (definition.IsSpecial ? 50 : 0) + definition.BasePrice;
    }

    private int CounterplayScore(CardDefinitionV2 candidate)
    {
        if (candidate.IsWild) return 0;
        var replies = _encounter!.PlayerHand.Count(id =>
        {
            var reply = _catalog.GetCard(_encounter.Copies[id].DefinitionId);
            return reply.IsWild || reply.Suit == candidate.Suit || reply.Rank == candidate.Rank;
        });
        return -replies * 20;
    }

    private void SubmitDecision(SubmitDecisionActionV2 action, List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Encounter || _encounter is null || _encounter.PendingDecision is null)
            throw new DomainRuleException("No encounter decision is pending.");
        var decision = _encounter.PendingDecision;
        if (!string.Equals(decision.DecisionId, action.DecisionId, StringComparison.Ordinal)) throw new DomainRuleException("Stale decision id.");
        var selected = action.SelectedCopyIds.Distinct().ToArray();
        if (selected.Length < decision.MinimumSelections || selected.Length > decision.MaximumSelections)
            throw new DomainRuleException("Invalid number of selected cards.");
        if (selected.Any(id => !decision.OptionCopyIds.Contains(id))) throw new DomainRuleException("A selected card is not an option.");
        _encounter.PendingDecision = null;
        _encounter.ResolutionPhase = ResolutionPhaseV2.Resolving;

        switch (decision.Context)
        {
            case "mulligan": ResolveMulligan(selected, events); break;
            case "sacrifice": ResolveSacrifice(decision.Actor, selected, decision.SourceCopyId, events, resumeResolution: true); break;
            case "gamble": ResolveGambleChoice(decision.Actor, selected.Single(), events, resumeResolution: true); break;
            default: throw new DomainRuleException("Unknown decision context.");
        }
    }

    private void ResolveMulligan(IReadOnlyList<long> selected, List<RunEventV2> events)
    {
        if (selected.Count == 1)
        {
            var id = selected[0];
            _encounter!.PlayerHand.Remove(id);
            _encounter.PlayerDiscardPile.Add(id);
            events.Add(new CardMovedEventV2(id, _encounter.Copies[id].DefinitionId, "player-hand", "shared-discard", "mulligan"));
            DrawIntoHand(Actor.Player, 1, "mulligan", events, applyCurse: false);
        }
        BeginTurn(Actor.Player, events);
    }

    private void ResolveSacrifice(Actor actor, IReadOnlyList<long> selected, long sourceCopyId, List<RunEventV2> events, bool resumeResolution)
    {
        var hand = Hand(actor);
        foreach (var id in selected)
        {
            if (!hand.Remove(id)) throw new DomainRuleException("Sacrifice selection left the hand.");
            PutInOwnerDiscard(id, "sacrifice", events);
        }
        _encounter!.BankedMarks += 5;
        if (actor == Actor.Player && HasTrinket("trinket.velvet-glove")) _encounter.BankedMarks += 3;
        events.Add(new EffectResolvedEventV2(V2ContentIds.Sacrifice, actor, actor, _encounter.BankedMarks, sourceCopyId));
        if (resumeResolution) ResolveQueue(events);
    }

    private void ResolveGambleChoice(Actor actor, long selectedCopyId, List<RunEventV2> events, bool resumeResolution)
    {
        var encounter = _encounter!;
        foreach (var id in encounter.Staging.ToArray())
        {
            if (id == selectedCopyId) continue;
            encounter.Staging.Remove(id);
            PutInOwnerDiscard(id, "gamble-discard", events);
        }
        if (++encounter.TriggeredPlayCount > MaximumTriggeredPlays) throw new DomainRuleException("Triggered play limit exceeded.");
        PlayFromZone(actor, selectedCopyId, "staging", events, triggered: true, resolveNow: resumeResolution);
    }

    private void ResolveQueue(List<RunEventV2> events)
    {
        var encounter = _encounter!;
        var steps = 0;
        while (encounter.PendingDecision is null && encounter.ResolutionQueue.Count > 0)
        {
            if (++steps > MaximumResolutionSteps) throw new DomainRuleException("Resolution step limit exceeded.");
            var item = encounter.ResolutionQueue[0];
            encounter.ResolutionQueue.RemoveAt(0);
            ResolveEffect(item, events);
        }
        if (encounter.PendingDecision is not null) return;
        if (encounter.ResolutionQueue.Count == 0) CompleteResolution(events);
    }

    private void ResolveEffect(ResolutionItemV2 item, List<RunEventV2> events)
    {
        var target = Opposite(item.Source);
        if (item.Reflectable && !item.Reflected && item.Source == Actor.Player &&
            EnemyHasUnusedPassive("passive.boss-smoke"))
        {
            UseEnemyPassive("passive.boss-smoke");
            item = item with { Source = Actor.Opponent, Reflected = true };
            target = Actor.Player;
        }
        else if (item.Reflectable && !item.Reflected && target == Actor.Player && HasUnusedTrinket("trinket.smoke-mirror"))
        {
            UseTrinket("trinket.smoke-mirror");
            item = item with { Source = target, Reflected = true };
            target = Opposite(item.Source);
        }
        switch (item.ResolverId)
        {
            case V2ContentIds.Draw:
                var drawAmount = item.Amount;
                if (item.Source == Actor.Opponent && EnemyHasUnusedPassive("passive.amplify-first-draw"))
                {
                    UseEnemyPassive("passive.amplify-first-draw");
                    drawAmount++;
                }
                if (item.Source == Actor.Player && HasUnusedTrinket("trinket.brass-knuckles"))
                {
                    UseTrinket("trinket.brass-knuckles"); drawAmount++;
                }
                DrawIntoHand(target, drawAmount, "effect-draw", events);
                break;
            case V2ContentIds.Skip:
                if (target == Actor.Player && HasUnusedTrinket("trinket.pocket-watch")) UseTrinket("trinket.pocket-watch");
                else AddOrMergeStatus("status.skip", target, charges: Math.Max(1, item.Amount), events: events);
                break;
            case V2ContentIds.Spy: AddOrMergeStatus("status.spy", item.Source, duration: Math.Max(1, item.Duration), events: events); break;
            case V2ContentIds.Curse: AddOrMergeStatus("status.curse", target, charges: Math.Max(1, item.Duration), amount: Math.Max(1, item.Amount), events: events); break;
            case V2ContentIds.HodlEffect: AddOrMergeStatus("status.hodl", item.Source, duration: 2, amount: Math.Max(1, item.Amount), sourceCopyId: item.SourceCopyId, events: events); break;
            case V2ContentIds.CreateStandard: CreateCards(item.Source, item.SourceCopyId, item.Amount, false, events); break;
            case V2ContentIds.CreateSpecial: CreateCards(item.Source, item.SourceCopyId, item.Amount, true, events); break;
            case V2ContentIds.Swap:
                (_encounter!.PlayerHand, _encounter.OpponentHand) = (_encounter.OpponentHand, _encounter.PlayerHand);
                events.Add(new EffectResolvedEventV2(item.ResolverId, item.Source, target, 0, item.SourceCopyId));
                break;
            case V2ContentIds.Bonus:
                if (item.Source == Actor.Player) _encounter!.BonusMultiplier *= Math.Max(2, item.Amount);
                events.Add(new EffectResolvedEventV2(item.ResolverId, item.Source, item.Source, _encounter!.BonusMultiplier, item.SourceCopyId));
                break;
            case V2ContentIds.Sacrifice: RequestSacrifice(item, events); return;
            case V2ContentIds.Gamble: RequestGamble(item, events); return;
            default: throw new DomainRuleException($"Unknown effect resolver {item.ResolverId}.");
        }
        if (item.ResolverId is not (V2ContentIds.Swap or V2ContentIds.Bonus))
            events.Add(new EffectResolvedEventV2(item.ResolverId, item.Source, target, item.Amount, item.SourceCopyId));
    }

    private void RequestSacrifice(ResolutionItemV2 item, List<RunEventV2> events)
    {
        var options = Hand(item.Source).Where(id => id != item.SourceCopyId).ToArray();
        if (options.Length < 2) throw new DomainRuleException("Opfer requires two other hand cards.");
        if (item.Source == Actor.Opponent)
        {
            ResolveSacrifice(item.Source, options.OrderBy(id => AiCardValue(_encounter!.Copies[id])).Take(2).ToArray(), item.SourceCopyId, events, resumeResolution: false);
            return;
        }
        SetDecision(new PendingDecisionV2(NewDecisionId("sacrifice"), DecisionKindV2.SelectCards, item.Source, "sacrifice",
            item.SourceCopyId, options, 2, 2, "decision.sacrifice"), events);
    }

    private void RequestGamble(ResolutionItemV2 item, List<RunEventV2> events)
    {
        var amount = item.Amount + (item.Source == Actor.Player && HasTrinket("trinket.loaded-die") ? 1 : 0);
        for (var index = 0; index < amount; index++)
        {
            var id = TakeFromDrawPile(item.Source, events, "gamble");
            if (id is null) break;
            _encounter!.Staging.Add(id.Value);
        }
        var options = _encounter!.Staging.Where(id =>
        {
            var definition = _catalog.GetCard(_encounter.Copies[id].DefinitionId);
            return definition.Id != V2ContentIds.Zocken && IsPlayableByDefinition(_encounter.Copies[id], item.Source, true) &&
                   (definition.Id != V2ContentIds.Opfer || Hand(item.Source).Count >= 2);
        }).ToArray();
        if (options.Length == 0)
        {
            foreach (var id in _encounter.Staging.ToArray()) { _encounter.Staging.Remove(id); PutInOwnerDiscard(id, "gamble-empty", events); }
            return;
        }
        if (item.Source == Actor.Opponent)
        {
            ResolveGambleChoice(item.Source, options.OrderByDescending(id => AiCardValue(_encounter.Copies[id])).First(), events, resumeResolution: false);
            return;
        }
        SetDecision(new PendingDecisionV2(NewDecisionId("gamble"), DecisionKindV2.SelectOneCard, item.Source, "gamble",
            item.SourceCopyId, options, 1, 1, "decision.gamble"), events);
    }

    private void SetDecision(PendingDecisionV2 decision, List<RunEventV2> events)
    {
        _encounter!.PendingDecision = decision;
        _encounter.ResolutionPhase = ResolutionPhaseV2.AwaitingDecision;
        events.Add(new DecisionRequestedEventV2(decision));
    }

    private void CreateCards(Actor actor, long sourceCopyId, int amount, bool specials, List<RunEventV2> events)
    {
        var encounter = _encounter!;
        if (encounter.TableCopyId == sourceCopyId)
        {
            var source = encounter.Copies[sourceCopyId] with { RetireOnDisplace = true };
            encounter.Copies[sourceCopyId] = source;
            if (source.Owner == CardOwnerV2.Player && source.PersistenceScope == PersistenceScopeV2.Run)
                _playerCollection.RemoveAll(copy => copy.CopyId == sourceCopyId);
        }
        var pool = (specials ? _catalog.Cards.Where(card => card.IsSpecial) : _catalog.Cards.Where(card => !card.IsSpecial)).Select(card => card.Id).ToArray();
        for (var index = 0; index < amount; index++)
        {
            var definitionId = pool[_random["effects"].NextInt(pool.Length)];
            CardCopyV2 copy;
            if (actor == Actor.Player)
            {
                copy = CreatePersistentCopy(definitionId);
                _playerCollection.Add(copy);
            }
            else copy = CreateEncounterCopy(definitionId, CardOwnerV2.Opponent);
            encounter.Copies.Add(copy.CopyId, copy);
            Hand(actor).Add(copy.CopyId);
            events.Add(new CardMovedEventV2(copy.CopyId, copy.DefinitionId, "created", ZoneName(actor, "hand"), specials ? "zytokinese-2" : "zytokinese"));
        }
    }

    private void CompleteResolution(List<RunEventV2> events)
    {
        var encounter = _encounter!;
        if (Hand(encounter.RootActor ?? encounter.ActiveActor).Count == 0)
        {
            EndEncounter((encounter.RootActor ?? encounter.ActiveActor) == Actor.Player ? EncounterOutcomeV2.PlayerWon : EncounterOutcomeV2.OpponentWon, events);
            return;
        }
        var actor = encounter.RootActor ?? encounter.ActiveActor;
        encounter.RootActor = null;
        encounter.TriggeredPlayCount = 0;
        if (encounter.RetainTurn)
        {
            encounter.RetainTurn = false;
            BeginTurn(actor, events);
        }
        else FinishTurn(actor, events);
    }

    private void FinishTurn(Actor actor, List<RunEventV2> events)
    {
        if (_encounter is null || _encounter.Outcome != EncounterOutcomeV2.None) return;
        if (_encounter.ConsecutiveNoProgressTurns >= 2)
        {
            var playerCount = _encounter.PlayerHand.Count;
            var opponentCount = _encounter.OpponentHand.Count;
            EndEncounter(playerCount < opponentCount ? EncounterOutcomeV2.PlayerWon : EncounterOutcomeV2.Stalemate, events);
            return;
        }
        BeginTurn(Opposite(actor), events);
    }

    private void BeginTurn(Actor actor, List<RunEventV2> events, int skipGuard = 0)
    {
        if (_encounter is null || _encounter.Outcome != EncounterOutcomeV2.None) return;
        if (skipGuard > 4) throw new DomainRuleException("Turn skip loop exceeded.");
        _encounter.ActiveActor = actor;
        _encounter.ResolutionPhase = ResolutionPhaseV2.AwaitingAction;
        if (actor == Actor.Player) _encounter.PlayerTurnsStarted++; else _encounter.OpponentTurnsStarted++;
        TickTurnStatuses(actor, events);
        var skip = FindStatus("status.skip", actor);
        if (skip is not null && skip.Charges > 0)
        {
            ReplaceStatus(skip with { Charges = skip.Charges - 1 }, events);
            BeginTurn(Opposite(actor), events, skipGuard + 1);
        }
    }

    private void TickTurnStatuses(Actor actor, List<RunEventV2> events)
    {
        var statuses = _encounter!.Statuses.Where(status => status.Target == actor && status.Duration > 0).OrderBy(status => status.Ordinal).ToArray();
        foreach (var status in statuses)
        {
            var updated = status with { Duration = status.Duration - 1 };
            if (updated.Id == "status.hodl" && updated.Duration == 0 && actor == Actor.Player)
            {
                _encounter.BankedMarks += updated.Amount;
                events.Add(new EffectResolvedEventV2(V2ContentIds.HodlEffect, actor, actor, updated.Amount, updated.SourceCopyId ?? 0));
            }
            ReplaceStatus(updated, events);
        }
    }

    private void EndEncounter(EncounterOutcomeV2 outcome, List<RunEventV2> events)
    {
        var encounter = _encounter!;
        encounter.Outcome = outcome;
        encounter.ResolutionPhase = ResolutionPhaseV2.Ended;
        events.Add(new EncounterEndedEventV2(outcome, encounter.EnemyId));
        if (outcome == EncounterOutcomeV2.PlayerWon)
        {
            var payout = encounter.BankedMarks * encounter.BonusMultiplier + (HasTrinket("trinket.lucky-chip") ? 2 : 0);
            if (payout > 0) { Money += payout; events.Add(new MoneyChangedEventV2(payout, Money, "encounter-effects")); }
            _playerCollection.Clear();
            _playerCollection.AddRange(encounter.Copies.Values.Where(copy => copy.Owner == CardOwnerV2.Player && copy.PersistenceScope == PersistenceScopeV2.Run && !copy.RetireOnDisplace).OrderBy(copy => copy.CopyId));
            var kind = encounter.Kind;
            _encounter = null;
            CompleteEncounterNode(kind, events);
            return;
        }

        _playerCollection.Clear();
        _playerCollection.AddRange(encounter.CheckpointPlayerCollection);
        Money = encounter.CheckpointMoney;
        var prevented = Lives == 1 && HasTrinket("trinket.golden-match");
        if (prevented)
        {
            _trinkets.Remove("trinket.golden-match");
            events.Add(new ToastEventV2("trinket.golden-match.saved"));
        }
        else
        {
            Lives--;
            events.Add(new LivesChangedEventV2(-1, Lives, "encounter-loss"));
        }
        if (Lives <= 0)
        {
            _encounter = null;
            Phase = RunPhaseV2.Defeat;
            events.Add(new RunPhaseChangedEventV2(Phase));
            return;
        }
        var enemyId = encounter.EnemyId;
        var kindRetry = encounter.Kind;
        var attempt = encounter.Attempt + 1;
        _encounter = null;
        StartEncounter(enemyId, kindRetry, events, attempt);
    }

    private int DrawIntoHand(Actor actor, int amount, string cause, List<RunEventV2> events, bool applyCurse = true)
    {
        if (applyCurse)
        {
            var curse = FindStatus("status.curse", actor);
            if (curse is not null && curse.Charges > 0)
            {
                amount += Math.Max(1, curse.Amount);
                ReplaceStatus(curse with { Charges = curse.Charges - 1 }, events);
            }
        }
        var drawn = 0;
        for (var index = 0; index < amount; index++)
        {
            var id = TakeFromDrawPile(actor, events, cause);
            if (id is null) break;
            Hand(actor).Add(id.Value);
            drawn++;
            events.Add(new CardMovedEventV2(id.Value, _encounter!.Copies[id.Value].DefinitionId, "shared-draw", ZoneName(actor, "hand"), cause));
        }
        return drawn;
    }

    private long? TakeFromDrawPile(Actor actor, List<RunEventV2> events, string cause)
    {
        var draw = DrawPile(actor);
        if (draw.Count == 0)
        {
            var discard = DiscardPile(actor);
            if (discard.Count == 0) return null;
            draw.AddRange(discard);
            discard.Clear();
            _random["player-deck"].Shuffle(draw);
            events.Add(new ToastEventV2($"reshuffle.shared.{cause}"));
        }
        var id = draw[^1];
        draw.RemoveAt(draw.Count - 1);
        return id;
    }

    private void DisplaceTable(List<RunEventV2> events)
    {
        var encounter = _encounter!;
        var previous = encounter.Copies[encounter.TableCopyId];
        if (previous.RetireOnDisplace)
        {
            encounter.Copies.Remove(previous.CopyId);
            events.Add(new CardMovedEventV2(previous.CopyId, previous.DefinitionId, "table", "retired", "zytokinese"));
        }
        else PutInOwnerDiscard(previous.CopyId, "displaced", events);
    }

    private void PutInOwnerDiscard(long copyId, string cause, List<RunEventV2> events)
    {
        var copy = _encounter!.Copies[copyId];
        DiscardPile(Actor.Player).Add(copyId);
        events.Add(new CardMovedEventV2(copyId, copy.DefinitionId, "table-or-staging", "shared-discard", cause));
    }

    private bool IsPlayableByDefinition(CardCopyV2 copy, Actor actor, bool ignoreMatch)
    {
        var definition = _catalog.GetCard(copy.DefinitionId);
        if (definition.Id == V2ContentIds.Opfer && Hand(actor).Count(id => id != copy.CopyId) < 2) return false;
        if (ignoreMatch || definition.IsWild) return true;
        var top = _catalog.GetCard(_encounter!.Copies[_encounter.TableCopyId].DefinitionId);
        if (top.IsWild) return true;
        return definition.Suit == top.Suit || definition.Rank == top.Rank;
    }

    private void RequireEncounterAction(Actor actor)
    {
        if (Phase != RunPhaseV2.Encounter || _encounter is null || _encounter.Outcome != EncounterOutcomeV2.None)
            throw new DomainRuleException("No encounter is active.");
        if (_encounter.ResolutionPhase != ResolutionPhaseV2.AwaitingAction || _encounter.PendingDecision is not null)
            throw new DomainRuleException("The encounter is resolving.");
        if (_encounter.ActiveActor != actor) throw new DomainRuleException("It is not that actor's turn.");
    }

    private void AddOrMergeStatus(string id, Actor target, int stacks = 1, int charges = 0, int duration = 0, int amount = 0, long? sourceCopyId = null, List<RunEventV2>? events = null)
    {
        var existing = FindStatus(id, target);
        if (existing is null)
        {
            var status = new StatusInstanceV2(id, target, stacks, charges, duration, amount, sourceCopyId, _nextStatusOrdinal++);
            _encounter!.Statuses.Add(status);
            events?.Add(new StatusChangedEventV2(id, target, charges, duration, amount));
        }
        else ReplaceStatus(existing with { Stacks = existing.Stacks + stacks, Charges = existing.Charges + charges, Duration = Math.Max(existing.Duration, duration), Amount = Math.Max(existing.Amount, amount) }, events);
    }

    private StatusInstanceV2? FindStatus(string id, Actor target) => _encounter?.Statuses.FirstOrDefault(status => status.Id == id && status.Target == target);

    private void ReplaceStatus(StatusInstanceV2 status, List<RunEventV2>? events)
    {
        var index = _encounter!.Statuses.FindIndex(item => item.Ordinal == status.Ordinal);
        if (index < 0) return;
        if (status.Charges <= 0 && status.Duration <= 0) _encounter.Statuses.RemoveAt(index); else _encounter.Statuses[index] = status;
        events?.Add(new StatusChangedEventV2(status.Id, status.Target, Math.Max(0, status.Charges), Math.Max(0, status.Duration), status.Amount));
    }

    private bool HasTrinket(string id) => _trinkets.Contains(id, StringComparer.Ordinal);
    private bool HasUnusedTrinket(string id) => HasTrinket(id) && !_encounter!.UsedTrinketIds.Contains(id);
    private void UseTrinket(string id) => _encounter!.UsedTrinketIds.Add(id);
    private bool EnemyHasUnusedPassive(string id) => _catalog.GetEnemy(_encounter!.EnemyId).PassiveId == id && !_encounter.UsedTrinketIds.Contains(id);
    private void UseEnemyPassive(string id) => _encounter!.UsedTrinketIds.Add(id);
    private List<long> Hand(Actor actor) => actor == Actor.Player ? _encounter!.PlayerHand : _encounter!.OpponentHand;
    private List<long> DrawPile(Actor actor) => _encounter!.PlayerDrawPile;
    private List<long> DiscardPile(Actor actor) => _encounter!.PlayerDiscardPile;
    private static Actor Opposite(Actor actor) => actor == Actor.Player ? Actor.Opponent : Actor.Player;
    private static string ZoneName(Actor actor, string zone) => $"{actor.ToString().ToLowerInvariant()}-{zone}";
}
