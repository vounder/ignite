namespace Zuendung.Domain.V2;

public sealed partial class RunSessionV2
{
    private MapState GenerateMap()
    {
        var map = new MapState { Act = Act, EndlessCycle = EndlessCycle };
        var pattern = new[,]
        {
            { NodeTypeV2.Battle, NodeTypeV2.Battle, NodeTypeV2.Event },
            { NodeTypeV2.Battle, NodeTypeV2.Elite, NodeTypeV2.Lounge },
            { NodeTypeV2.Battle, NodeTypeV2.Shop, NodeTypeV2.Battle },
            { NodeTypeV2.Elite, NodeTypeV2.Battle, NodeTypeV2.Event }
        };

        for (var row = 0; row < 4; row++)
        for (var column = 0; column < 3; column++)
        {
            var id = NodeId(row, column);
            var next = row == 3
                ? new[] { NodeId(4, 0) }
                : NextColumns(column).Select(nextColumn => NodeId(row + 1, nextColumn)).ToArray();
            var type = pattern[row, column];
            map.Nodes.Add(new MapNodeV2(id, Act, row, column, type, ContentFor(type), next,
                row == 0 && column != 1 ? NodeVisitState.Available : NodeVisitState.Locked));
        }
        map.Nodes.Add(new MapNodeV2(NodeId(4, 0), Act, 4, 0, NodeTypeV2.Boss,
            ContentFor(NodeTypeV2.Boss), Array.Empty<string>(), NodeVisitState.Locked));
        return map;
    }

    private void ChooseNode(string nodeId, List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Map) throw new DomainRuleException("Nodes can only be chosen on the map.");
        var node = _map.Nodes.SingleOrDefault(item => item.NodeId == nodeId)
            ?? throw new DomainRuleException("Unknown map node.");
        if (node.VisitState != NodeVisitState.Available) throw new DomainRuleException("That map node is not available.");

        foreach (var skipped in _map.Nodes.Where(item => item.NodeId != node.NodeId && item.VisitState == NodeVisitState.Available).ToArray())
            SetNode(skipped with { VisitState = NodeVisitState.Locked }, events);
        SetNode(node with { VisitState = NodeVisitState.Current }, events);
        _map.CurrentNodeId = node.NodeId;
        switch (node.Type)
        {
            case NodeTypeV2.Battle: StartEncounter(node.ContentId, EncounterKindV2.Battle, events); break;
            case NodeTypeV2.Elite: StartEncounter(node.ContentId, EncounterKindV2.Elite, events); break;
            case NodeTypeV2.Boss: StartEncounter(node.ContentId, EncounterKindV2.Boss, events); break;
            case NodeTypeV2.Shop: OpenShop(events); break;
            case NodeTypeV2.Lounge:
                Phase = RunPhaseV2.Lounge;
                events.Add(new RunPhaseChangedEventV2(Phase));
                break;
            case NodeTypeV2.Event: OpenEvent(events); break;
            default: throw new DomainRuleException("Unsupported map node.");
        }
    }

    // Called by the encounter flow after a player win.
    private void CompleteEncounterNode(EncounterKindV2 kind, List<RunEventV2> events)
    {
        var node = CurrentNode();
        if (kind == EncounterKindV2.Boss && node.Type != NodeTypeV2.Boss)
            throw new DomainRuleException("Boss outcome does not match the current node.");
        if (kind != EncounterKindV2.Boss && node.Type is not (NodeTypeV2.Battle or NodeTypeV2.Elite))
            throw new DomainRuleException("Encounter outcome does not match the current node.");

        var money = kind switch
        {
            EncounterKindV2.Battle => 4 + Act,
            EncounterKindV2.Elite => 8 + 2 * Act,
            _ => 14 + 3 * Act
        };
        Money += money;
        events.Add(new MoneyChangedEventV2(money, Money, "encounter-win"));

        _reward = new RewardState
        {
            IncludesTrinketReward = kind is EncounterKindV2.Elite or EncounterKindV2.Boss,
            IsBossReward = kind == EncounterKindV2.Boss,
            SkipCardMoney = 2 + Act,
            SkipTrinketMoney = 3 + Act
        };
        var minimumRarity = kind == EncounterKindV2.Boss ? RarityV2.Rare : kind == EncounterKindV2.Elite ? RarityV2.Uncommon : RarityV2.Common;
        _reward.CardDefinitionIds.AddRange(CreateRewardCards(3, kind == EncounterKindV2.Battle ? 1 : kind == EncounterKindV2.Elite ? 2 : 3, minimumRarity));
        if (_reward.IncludesTrinketReward)
            _reward.TrinketIds.AddRange(PickDistinct(_catalog.Trinkets.Where(item => item.Rarity >= minimumRarity && !_trinkets.Contains(item.Id, StringComparer.Ordinal)).Select(item => item.Id), 3, "reward"));
        Phase = RunPhaseV2.CardReward;
        events.Add(new RunPhaseChangedEventV2(Phase));
    }

    // Reward, shop, lounge and event flows call this after their interaction has resolved.
    private void CompleteCurrentNode(List<RunEventV2> events)
    {
        var current = CurrentNode();
        SetNode(current with { VisitState = NodeVisitState.Completed }, events);
        _map.LastCompletedRow = current.Row;
        _map.CurrentNodeId = null;
        foreach (var nextId in current.NextNodeIds)
        {
            var next = _map.Nodes.Single(item => item.NodeId == nextId);
            if (next.VisitState == NodeVisitState.Locked)
                SetNode(next with { VisitState = NodeVisitState.Available }, events);
        }
        _shop = null;
        _event = null;
        _reward = null;
        if (current.Type == NodeTypeV2.Boss)
        {
            if (Mode == RunModeV2.Campaign && Act >= 3)
            {
                Phase = RunPhaseV2.Victory;
                events.Add(new RunPhaseChangedEventV2(Phase));
                return;
            }
            Act++;
            if (Mode == RunModeV2.Endless) EndlessCycle++;
            _map = GenerateMap();
        }
        Phase = RunPhaseV2.Map;
        events.Add(new RunPhaseChangedEventV2(Phase));
    }

    private void OpenShop(List<RunEventV2> events)
    {
        _shop = new ShopState { RemovalCountAtOpen = RemovalCount, FirstCardDiscountAvailable = _trinkets.Contains("trinket.false-bottom", StringComparer.Ordinal) };
        PopulateShopOffers(_shop);
        Phase = RunPhaseV2.Shop;
        events.Add(new RunPhaseChangedEventV2(Phase));
    }

    private void RerollShop(List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Shop || _shop is null) throw new DomainRuleException("No shop is open.");
        var price = 3 + 2 * _shop.RerollCount;
        Spend(price, "shop-reroll", events);
        _shop.RerollCount++;
        _shop.Offers.Clear();
        PopulateShopOffers(_shop);
    }

    private void BuyShopOffer(string offerId, string? replaceTrinketId, List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Shop || _shop is null) throw new DomainRuleException("No shop is open.");
        var offer = _shop.Offers.SingleOrDefault(item => item.OfferId == offerId) ?? throw new DomainRuleException("Unknown shop offer.");
        if (offer.Purchased) throw new DomainRuleException("That offer was already purchased.");
        if (offer.IsTrinket && _trinkets.Count >= MaximumTrinkets && string.IsNullOrWhiteSpace(replaceTrinketId)) throw new DomainRuleException("Choose a trinket to replace.");
        var price = offer.Price;
        if (!offer.IsTrinket && _shop.FirstCardDiscountAvailable) { price = Math.Max(0, price - 2); _shop.FirstCardDiscountAvailable = false; }
        Spend(price, "shop-buy", events);
        if (offer.IsTrinket)
        {
            if (!string.IsNullOrWhiteSpace(replaceTrinketId)) _trinkets.Remove(replaceTrinketId);
            if (!_trinkets.Contains(offer.ContentId, StringComparer.Ordinal)) _trinkets.Add(offer.ContentId);
        }
        else _playerCollection.Add(CreatePersistentCopy(offer.ContentId));
        ReplaceOffer(offer with { Purchased = true });
    }

    private void RemoveAtShop(long copyId, List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Shop || _shop is null || _shop.RemovalUsed) throw new DomainRuleException("Card removal is unavailable.");
        if (_playerCollection.Count <= MinimumDeckSize) throw new DomainRuleException("The deck cannot be reduced further.");
        var card = _playerCollection.SingleOrDefault(item => item.CopyId == copyId) ?? throw new DomainRuleException("Unknown player card.");
        Spend(7 + 3 * RemovalCount, "shop-remove", events);
        _playerCollection.Remove(card); RemovalCount++; _shop.RemovalUsed = true;
        events.Add(new CardMovedEventV2(card.CopyId, card.DefinitionId, "collection", "removed", "shop-remove"));
    }

    private void HealAtShop(List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Shop || _shop is null || _shop.HealingUsed) throw new DomainRuleException("Healing is unavailable.");
        if (Lives >= 3) throw new DomainRuleException("All matches are intact.");
        Spend(8, "shop-heal", events); _shop.HealingUsed = true;
        Heal(1, "shop-heal", events);
    }

    private void LeaveShop(List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Shop) throw new DomainRuleException("No shop is open.");
        CompleteCurrentNode(events);
    }

    private void ChooseLounge(ChooseLoungeActionV2 action, List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Lounge) throw new DomainRuleException("No lounge is open.");
        switch (action.Choice)
        {
            case LoungeChoiceV2.Heal:
                if (Lives >= 3) throw new DomainRuleException("All matches are intact.");
                Heal(1, "lounge", events); break;
            case LoungeChoiceV2.RemoveCard:
                if (action.CopyId is null || _playerCollection.Count <= MinimumDeckSize) throw new DomainRuleException("That card cannot be removed.");
                var card = _playerCollection.SingleOrDefault(item => item.CopyId == action.CopyId.Value) ?? throw new DomainRuleException("Unknown player card.");
                _playerCollection.Remove(card); RemovalCount++;
                events.Add(new CardMovedEventV2(card.CopyId, card.DefinitionId, "collection", "removed", "lounge"));
                break;
            case LoungeChoiceV2.TakeMoney:
                Money += 5; events.Add(new MoneyChangedEventV2(5, Money, "lounge")); break;
            default: throw new DomainRuleException("Unknown lounge choice.");
        }
        CompleteCurrentNode(events);
    }

    private void OpenEvent(List<RunEventV2> events)
    {
        _event = _random["encounter"].NextInt(4) switch
        {
            0 => Event("event.quiet-table", "Der stille Tisch",
                new EventOptionV2("event.quiet.remove", "Eine Karte lautlos verschwinden lassen", RequiresCardSelection: true),
                new EventOptionV2("event.quiet.heal", "Ein Streichholz flicken", LivesDelta: 1)),
            1 => _trinkets.Count < MaximumTrinkets
                ? Event("event.fence", "Der Hehler",
                    new EventOptionV2("event.fence.buy", "Unterm Tisch ein Trinket kaufen · 8 Mark", MoneyDelta: -8, TrinketId: RandomUnownedTrinket()),
                    new EventOptionV2("event.fence.leave", "Dem Blick des Hehlers ausweichen"))
                : Event("event.fence", "Der Hehler",
                    new EventOptionV2("event.fence.full", "Volle Taschen · 3 Mark mitnehmen", MoneyDelta: 3),
                    new EventOptionV2("event.fence.leave", "Dem Blick des Hehlers ausweichen")),
            2 => Event("event.open-tab", "Die offene Rechnung",
                new EventOptionV2("event.tab.risk", "Ein Streichholz setzen · 12 Mark", MoneyDelta: 12, LivesDelta: -1),
                new EventOptionV2("event.tab.pay", "6 Mark zahlen und durchatmen", MoneyDelta: -6, LivesDelta: 1)),
            _ => Event("event.rigged-box", "Die gezinkte Schatulle",
                new EventOptionV2("event.box.open", "Spezialkarte wählen · nächster Kampf +1 Karte", GrantsSpecialDraft: true, NextEncounterExtraCards: 1),
                new EventOptionV2("event.box.decline", "Nicht anfassen · 3 Mark", MoneyDelta: 3))
        };
        Phase = RunPhaseV2.Event;
        events.Add(new RunPhaseChangedEventV2(Phase));
    }

    private void ChooseEvent(ChooseEventOptionActionV2 action, List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Event || _event is null) throw new DomainRuleException("No event is open.");
        var option = _event.Options.SingleOrDefault(item => item.OptionId == action.OptionId) ?? throw new DomainRuleException("Unknown event option.");
        if (option.MoneyDelta < 0) Spend(-option.MoneyDelta, "event", events); else if (option.MoneyDelta > 0) { Money += option.MoneyDelta; events.Add(new MoneyChangedEventV2(option.MoneyDelta, Money, "event")); }
        if (option.LivesDelta > 0) Heal(option.LivesDelta, "event", events);
        if (option.LivesDelta < 0)
        {
            Lives = Math.Max(0, Lives + option.LivesDelta);
            events.Add(new LivesChangedEventV2(option.LivesDelta, Lives, "event"));
            if (Lives == 0) { _event = null; Phase = RunPhaseV2.Defeat; events.Add(new RunPhaseChangedEventV2(Phase)); return; }
        }
        if (!string.IsNullOrWhiteSpace(option.TrinketId))
        {
            if (_trinkets.Count >= MaximumTrinkets) throw new DomainRuleException("No space for an event trinket.");
            _ = _catalog.GetTrinket(option.TrinketId);
            if (!_trinkets.Contains(option.TrinketId, StringComparer.Ordinal)) _trinkets.Add(option.TrinketId);
        }
        if (option.RequiresCardSelection)
        {
            if (action.CopyId is null) throw new DomainRuleException("Choose a card for this event.");
            var selected = _playerCollection.SingleOrDefault(item => item.CopyId == action.CopyId.Value) ?? throw new DomainRuleException("Unknown player card.");
            if (_playerCollection.Count <= MinimumDeckSize) throw new DomainRuleException("The deck cannot be reduced further.");
            _playerCollection.Remove(selected);
            events.Add(new CardMovedEventV2(selected.CopyId, selected.DefinitionId, "collection", "removed", "event"));
        }
        if (option.NextEncounterExtraCards > 0) NextEncounterExtraCards += option.NextEncounterExtraCards;
        if (option.GrantsSpecialDraft)
        {
            _reward = new RewardState { SkipCardMoney = 0 };
            _reward.CardDefinitionIds.AddRange(PickDistinct(_catalog.PlayerSpecialPool, 3, "reward"));
            _event = null;
            Phase = RunPhaseV2.CardReward;
            events.Add(new RunPhaseChangedEventV2(Phase));
            return;
        }
        CompleteCurrentNode(events);
    }

    private void EnterEndless(List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.Victory || Mode != RunModeV2.Campaign) throw new DomainRuleException("Endless mode is not available.");
        Mode = RunModeV2.Endless; Act = 4; EndlessCycle = 1; _map = GenerateMap();
        Phase = RunPhaseV2.Map;
        events.Add(new RunPhaseChangedEventV2(Phase));
    }

    private string ContentFor(NodeTypeV2 type)
    {
        if (type is NodeTypeV2.Shop or NodeTypeV2.Lounge or NodeTypeV2.Event) return type.ToString().ToLowerInvariant();
        if (type == NodeTypeV2.Boss && Mode == RunModeV2.Campaign)
            return Act switch { 1 => "boss.shark", 2 => "boss.madame-smoke", _ => "boss.house" };
        var prefix = type switch { NodeTypeV2.Battle => "enemy.", NodeTypeV2.Elite => "elite.", _ => "boss." };
        var candidates = _catalog.Enemies.Where(enemy => enemy.Id.StartsWith(prefix, StringComparison.Ordinal)).Select(enemy => enemy.Id).ToArray();
        return candidates[_random["map"].NextInt(candidates.Length)];
    }

    private static EventState Event(string id, string name, params EventOptionV2[] options)
    {
        var state = new EventState { EventId = id, DisplayName = name };
        state.Options.AddRange(options);
        return state;
    }

    private string RandomUnownedTrinket()
    {
        var pool = _catalog.Trinkets.Select(item => item.Id).Where(id => !_trinkets.Contains(id, StringComparer.Ordinal)).ToArray();
        return pool[_random["encounter"].NextInt(pool.Length)];
    }

    private IEnumerable<string> CreateRewardCards(int count, int minimumSpecials, RarityV2 minimumSpecialRarity)
    {
        var specials = _catalog.PlayerSpecialPool.Where(id => _catalog.GetCard(id).Rarity >= minimumSpecialRarity).ToArray();
        var result = PickDistinct(specials, minimumSpecials, "reward").ToList();
        result.AddRange(PickDistinct(_catalog.Cards.Select(card => card.Id), count - result.Count, "reward", result));
        return result;
    }

    private List<string> PickDistinct(IEnumerable<string> candidates, int count, string stream, IEnumerable<string>? excluded = null)
    {
        var pool = candidates.Where(id => excluded is null || !excluded.Contains(id, StringComparer.Ordinal)).Distinct(StringComparer.Ordinal).ToList();
        _random[stream].Shuffle(pool);
        return pool.Take(Math.Min(count, pool.Count)).ToList();
    }

    private void PopulateShopOffers(ShopState shop)
    {
        var cards = PickDistinct(_catalog.Cards.Select(card => card.Id), 4, "shop");
        var trinkets = PickDistinct(_catalog.Trinkets.Select(item => item.Id).Where(id => !_trinkets.Contains(id, StringComparer.Ordinal)), 2, "shop");
        var index = 0;
        foreach (var id in cards) shop.Offers.Add(new ShopOfferV2($"shop.card.{shop.RerollCount}.{index++}", id, false, _catalog.GetCard(id).BasePrice, false));
        foreach (var id in trinkets) shop.Offers.Add(new ShopOfferV2($"shop.trinket.{shop.RerollCount}.{index++}", id, true, _catalog.GetTrinket(id).BasePrice, false));
    }

    private void Spend(int amount, string cause, List<RunEventV2> events)
    {
        if (amount < 0 || Money < amount) throw new DomainRuleException("Not enough money.");
        Money -= amount; events.Add(new MoneyChangedEventV2(-amount, Money, cause));
    }
    private void Heal(int amount, string cause, List<RunEventV2> events)
    {
        var healed = Math.Min(amount, 3 - Lives); if (healed == 0) return;
        Lives += healed; events.Add(new LivesChangedEventV2(healed, Lives, cause));
    }
    private MapNodeV2 CurrentNode() => _map.CurrentNodeId is { } id ? _map.Nodes.Single(node => node.NodeId == id) : throw new DomainRuleException("No current map node.");
    private void SetNode(MapNodeV2 node, List<RunEventV2> events) { var index = _map.Nodes.FindIndex(item => item.NodeId == node.NodeId); _map.Nodes[index] = node; events.Add(new NodeChangedEventV2(node.NodeId, node.VisitState)); }
    private void ReplaceOffer(ShopOfferV2 offer)
    {
        var index = _shop!.Offers.FindIndex(item => item.OfferId == offer.OfferId);
        if (index < 0) throw new DomainRuleException("Unknown shop offer.");
        _shop.Offers[index] = offer;
    }
    private string NodeId(int row, int column) => $"a{Act}.c{EndlessCycle}.r{row}.n{column}";
    private static IEnumerable<int> NextColumns(int column) => column switch { 0 => [0, 1], 1 => [0, 2], _ => [1, 2] };
}
