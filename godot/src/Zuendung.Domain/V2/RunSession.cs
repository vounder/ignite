namespace Zuendung.Domain.V2;

public sealed partial class RunSessionV2
{
    public const int CurrentSnapshotVersion = 2;
    public const int MaximumTrinkets = 5;
    public const int StartingCollectionSize = 7;
    public const int OpeningHandSize = 7;
    public const int MinimumDeckSize = StartingCollectionSize;

    private readonly RunCatalogV2 _catalog;
    private NamedRandomStreams _random;
    private readonly List<CardCopyV2> _playerCollection = [];
    private readonly List<string> _trinkets = [];
    private MapState _map = null!;
    private EncounterState? _encounter;
    private RewardState? _reward;
    private ShopState? _shop;
    private EventState? _event;
    private long _nextCopyId;
    private long _nextDecisionId;
    private long _nextStatusOrdinal;

    public string RunId { get; private set; } = string.Empty;
    public RunPhaseV2 Phase { get; private set; }
    public RunModeV2 Mode { get; private set; }
    public int Act { get; private set; }
    public int EndlessCycle { get; private set; }
    public int Lives { get; private set; }
    public int Money { get; private set; }
    public int Score { get; private set; }
    public int RemovalCount { get; private set; }
    public int NextEncounterExtraCards { get; private set; }
    public string StarterDeckId { get; private set; } = string.Empty;
    public RunCatalogV2 Catalog => _catalog;
    public bool WasLegacyEncounterMigrated { get; private set; }

    private RunSessionV2(RunCatalogV2 catalog, NamedRandomStreams random)
    {
        _catalog = catalog;
        _random = random;
    }

    public static RunSessionV2 CreateNew(ulong seed, string starterDeckId = "starter.classic", RunCatalogV2? catalog = null)
    {
        catalog ??= RunCatalogV2.CreateDefault();
        var starter = catalog.GetStarterDeck(starterDeckId);
        var session = new RunSessionV2(catalog, new NamedRandomStreams(seed))
        {
            RunId = $"run-{seed:x16}",
            Phase = RunPhaseV2.Map,
            Mode = RunModeV2.Campaign,
            Act = 1,
            EndlessCycle = 0,
            Lives = 3,
            Money = starter.StartingMoney,
            StarterDeckId = starter.Id,
            _nextCopyId = 1,
            _nextDecisionId = 1,
            _nextStatusOrdinal = 1
        };
        var startingCandidates = starter.DefinitionIds.ToList();
        session._random["player-deck"].Shuffle(startingCandidates);
        foreach (var definitionId in startingCandidates.Take(StartingCollectionSize))
            session._playerCollection.Add(session.CreatePersistentCopy(definitionId));
        session._map = session.GenerateMap();
        session.ValidateInvariants();
        return session;
    }

    public static RunSessionV2 Restore(RunSnapshotV2 snapshot, RunCatalogV2? catalog = null)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        catalog ??= RunCatalogV2.CreateDefault();
        var session = new RunSessionV2(catalog, NamedRandomStreams.Restore(snapshot.Random));
        session.ApplySnapshot(snapshot);
        session.WasLegacyEncounterMigrated = session.MigrateLegacySeparateEncounterDecks();
        session.ValidateInvariants();
        return session;
    }

    public ActionResultV2 Handle(RunActionV2 action)
    {
        ArgumentNullException.ThrowIfNull(action);
        var before = Snapshot();
        var events = new List<RunEventV2>();
        try
        {
            switch (action)
            {
                case ChooseNodeActionV2 choose: ChooseNode(choose.NodeId, events); break;
                case PlayCardActionV2 play: PlayCard(play.Actor, play.CopyId, events); break;
                case DrawCardActionV2 draw: DrawCard(draw.Actor, events); break;
                case AdvanceOpponentActionV2: AdvanceOpponent(events); break;
                case SubmitDecisionActionV2 decision: SubmitDecision(decision, events); break;
                case ChooseCardRewardActionV2 reward: ChooseCardReward(reward.DefinitionId, events); break;
                case ChooseTrinketRewardActionV2 reward: ChooseTrinketReward(reward.TrinketId, reward.ReplaceTrinketId, events); break;
                case BuyShopOfferActionV2 buy: BuyShopOffer(buy.OfferId, buy.ReplaceTrinketId, events); break;
                case RerollShopActionV2: RerollShop(events); break;
                case RemoveCardAtShopActionV2 remove: RemoveAtShop(remove.CopyId, events); break;
                case HealAtShopActionV2: HealAtShop(events); break;
                case LeaveShopActionV2: LeaveShop(events); break;
                case ChooseLoungeActionV2 lounge: ChooseLounge(lounge, events); break;
                case ChooseEventOptionActionV2 eventAction: ChooseEvent(eventAction, events); break;
                case EnterEndlessActionV2: EnterEndless(events); break;
                case FinishRunActionV2: FinishRun(events); break;
                default: throw new DomainRuleException($"Unsupported V2 action: {action.GetType().Name}");
            }
            ValidateInvariants();
            var snapshot = Snapshot();
            return new ActionResultV2(events, snapshot, snapshot.Encounter?.PendingDecision);
        }
        catch
        {
            ApplySnapshot(before);
            throw;
        }
    }

    public RunSnapshotV2 Snapshot() => new(
        CurrentSnapshotVersion,
        RunId,
        Phase,
        Mode,
        Act,
        EndlessCycle,
        Lives,
        Money,
        Score,
        RemovalCount,
        StarterDeckId,
        _nextCopyId,
        _nextDecisionId,
        _nextStatusOrdinal,
        _playerCollection.ToArray(),
        _trinkets.ToArray(),
        _map.Snapshot(),
        _encounter?.Snapshot(),
        _reward?.Snapshot(),
        _shop?.Snapshot(),
        _event?.Snapshot(),
        NextEncounterExtraCards,
        _random.Snapshot());

    public bool IsPlayable(long copyId)
    {
        if (_encounter is null || _encounter.ResolutionPhase != ResolutionPhaseV2.AwaitingAction) return false;
        if (!_encounter.Copies.TryGetValue(copyId, out var copy)) return false;
        var hand = Hand(_encounter.ActiveActor);
        return hand.Contains(copyId) && IsPlayableByDefinition(copy, _encounter.ActiveActor, ignoreMatch: false);
    }

    private void ApplySnapshot(RunSnapshotV2 snapshot)
    {
        if (snapshot.SnapshotVersion != CurrentSnapshotVersion)
            throw new InvalidDataException($"Unsupported V2 snapshot version {snapshot.SnapshotVersion}.");
        ArgumentNullException.ThrowIfNull(snapshot.PlayerCollection);
        ArgumentNullException.ThrowIfNull(snapshot.TrinketIds);
        ArgumentNullException.ThrowIfNull(snapshot.Map);
        ArgumentNullException.ThrowIfNull(snapshot.Random);
        RunId = Required(snapshot.RunId, nameof(snapshot.RunId));
        Phase = snapshot.Phase;
        Mode = snapshot.Mode;
        Act = snapshot.Act;
        EndlessCycle = snapshot.EndlessCycle;
        Lives = snapshot.Lives;
        Money = snapshot.Money;
        Score = snapshot.Score;
        RemovalCount = snapshot.RemovalCount;
        StarterDeckId = Required(snapshot.StarterDeckId, nameof(snapshot.StarterDeckId));
        _nextCopyId = snapshot.NextCopyId;
        _nextDecisionId = snapshot.NextDecisionId;
        _nextStatusOrdinal = snapshot.NextStatusOrdinal;
        NextEncounterExtraCards = snapshot.NextEncounterExtraCards;
        _playerCollection.Clear();
        _playerCollection.AddRange(snapshot.PlayerCollection);
        _trinkets.Clear();
        _trinkets.AddRange(snapshot.TrinketIds);
        _map = MapState.Restore(snapshot.Map);
        _encounter = snapshot.Encounter is null ? null : EncounterState.Restore(snapshot.Encounter);
        _reward = snapshot.Reward is null ? null : RewardState.Restore(snapshot.Reward);
        _shop = snapshot.Shop is null ? null : ShopState.Restore(snapshot.Shop);
        _event = snapshot.Event is null ? null : EventState.Restore(snapshot.Event);
        _random = NamedRandomStreams.Restore(snapshot.Random);
    }

    private CardCopyV2 CreatePersistentCopy(string definitionId)
    {
        _ = _catalog.GetCard(definitionId);
        return new CardCopyV2(_nextCopyId++, definitionId, CardOwnerV2.Player, PersistenceScopeV2.Run);
    }

    private CardCopyV2 CreateEncounterCopy(string definitionId, CardOwnerV2 owner)
    {
        _ = _catalog.GetCard(definitionId);
        return new CardCopyV2(_nextCopyId++, definitionId, owner, PersistenceScopeV2.Encounter);
    }

    private string NewDecisionId(string context) => $"{RunId}.{context}.{_nextDecisionId++}";

    private void ValidateInvariants()
    {
        if (string.IsNullOrWhiteSpace(RunId)) throw new InvalidDataException("Run id is missing.");
        if (!Enum.IsDefined(Phase) || !Enum.IsDefined(Mode)) throw new InvalidDataException("Invalid run phase or mode.");
        if (Act < 1 || EndlessCycle < 0) throw new InvalidDataException("Invalid run progression.");
        if (Mode == RunModeV2.Campaign && (Act > 3 || EndlessCycle != 0)) throw new InvalidDataException("Invalid campaign progression.");
        if (Mode == RunModeV2.Endless && (Act < 4 || EndlessCycle < 1)) throw new InvalidDataException("Invalid endless progression.");
        if (Lives < 0 || Lives > 3) throw new InvalidDataException("Lives are outside 0..3.");
        if (Money < 0 || Score < 0 || RemovalCount < 0 || NextEncounterExtraCards < 0) throw new InvalidDataException("Negative run value.");
        if (_nextCopyId < 1 || _nextDecisionId < 1 || _nextStatusOrdinal < 1) throw new InvalidDataException("Invalid id counter.");
        _ = _catalog.GetStarterDeck(StarterDeckId);
        if (_playerCollection.Count < MinimumDeckSize) throw new InvalidDataException("Player deck is below the minimum size.");
        if (_playerCollection.Any(copy => copy.Owner != CardOwnerV2.Player || copy.PersistenceScope != PersistenceScopeV2.Run))
            throw new InvalidDataException("Player collection contains a non-player or temporary copy.");
        var duplicateCopies = _playerCollection.GroupBy(copy => copy.CopyId).FirstOrDefault(group => group.Count() > 1);
        if (duplicateCopies is not null) throw new InvalidDataException($"Duplicate player copy id {duplicateCopies.Key}.");
        foreach (var copy in _playerCollection) _ = _catalog.GetCard(copy.DefinitionId);
        if (_trinkets.Count > MaximumTrinkets || _trinkets.Distinct(StringComparer.Ordinal).Count() != _trinkets.Count)
            throw new InvalidDataException("Invalid trinket inventory.");
        foreach (var id in _trinkets) _ = _catalog.GetTrinket(id);
        _map.Validate(Act, EndlessCycle, _catalog);
        var currentNode = _map.CurrentNodeId is null ? null : _map.Nodes.Single(node => node.NodeId == _map.CurrentNodeId);
        if (Phase == RunPhaseV2.Map && currentNode is not null) throw new InvalidDataException("Map phase cannot have a current node.");
        if (Phase == RunPhaseV2.Map && !_map.Nodes.Any(node => node.VisitState == NodeVisitState.Available))
            throw new InvalidDataException("Map phase has no available node.");
        if (Phase is RunPhaseV2.Encounter or RunPhaseV2.CardReward or RunPhaseV2.TrinketReward or RunPhaseV2.Shop or RunPhaseV2.Lounge or RunPhaseV2.Event && currentNode is null)
            throw new InvalidDataException("Node phase without a current map node.");
        if (Phase == RunPhaseV2.Encounter && currentNode?.Type is not (NodeTypeV2.Battle or NodeTypeV2.Elite or NodeTypeV2.Boss))
            throw new InvalidDataException("Encounter phase on a non-encounter node.");
        if (Phase == RunPhaseV2.Shop && currentNode?.Type != NodeTypeV2.Shop) throw new InvalidDataException("Shop phase on a non-shop node.");
        if (Phase == RunPhaseV2.Lounge && currentNode?.Type != NodeTypeV2.Lounge) throw new InvalidDataException("Lounge phase on a non-lounge node.");
        if (Phase == RunPhaseV2.Event && currentNode?.Type != NodeTypeV2.Event) throw new InvalidDataException("Event phase on a non-event node.");
        if (Phase == RunPhaseV2.Encounter && _encounter is null) throw new InvalidDataException("Encounter phase without encounter.");
        if (Phase != RunPhaseV2.Encounter && _encounter is not null && _encounter.Outcome == EncounterOutcomeV2.None)
            throw new InvalidDataException("Active encounter outside encounter phase.");
        _encounter?.Validate(_catalog, _playerCollection);
        if (Phase is RunPhaseV2.CardReward or RunPhaseV2.TrinketReward && _reward is null)
            throw new InvalidDataException("Reward phase without reward.");
        if (Phase is not (RunPhaseV2.CardReward or RunPhaseV2.TrinketReward) && _reward is not null)
            throw new InvalidDataException("Reward state outside a reward phase.");
        _reward?.Validate(_catalog, Phase);
        if (Phase == RunPhaseV2.Shop && _shop is null) throw new InvalidDataException("Shop phase without shop.");
        if (Phase != RunPhaseV2.Shop && _shop is not null) throw new InvalidDataException("Shop state outside shop phase.");
        _shop?.Validate(_catalog, RemovalCount);
        if (Phase == RunPhaseV2.Event && _event is null) throw new InvalidDataException("Event phase without event.");
        if (Phase != RunPhaseV2.Event && _event is not null) throw new InvalidDataException("Event state outside event phase.");
        _event?.Validate(_catalog);
        if (Phase == RunPhaseV2.Defeat && Lives != 0) throw new InvalidDataException("Defeat requires zero lives.");
        var encounterCopyIds = _encounter is null ? Enumerable.Empty<long>() : _encounter.Copies.Keys;
        var maximumCopyId = _playerCollection.Select(copy => copy.CopyId).Concat(encounterCopyIds).DefaultIfEmpty(0).Max();
        if (_nextCopyId <= maximumCopyId) throw new InvalidDataException("Next copy id would collide with an existing card.");
    }

    private static string Required(string? value, string name) => string.IsNullOrWhiteSpace(value)
        ? throw new InvalidDataException($"{name} is required.")
        : value;

    private sealed class MapState
    {
        public int Act;
        public int EndlessCycle;
        public readonly List<MapNodeV2> Nodes = [];
        public string? CurrentNodeId;
        public int LastCompletedRow = -1;

        public RunMapSnapshotV2 Snapshot() => new(Act, EndlessCycle, Nodes.ToArray(), CurrentNodeId, LastCompletedRow);
        public static MapState Restore(RunMapSnapshotV2 snapshot)
        {
            ArgumentNullException.ThrowIfNull(snapshot.Nodes);
            var state = new MapState { Act = snapshot.Act, EndlessCycle = snapshot.EndlessCycle, CurrentNodeId = snapshot.CurrentNodeId, LastCompletedRow = snapshot.LastCompletedRow };
            state.Nodes.AddRange(snapshot.Nodes);
            return state;
        }
        public void Validate(int act, int endlessCycle, RunCatalogV2 catalog)
        {
            if (Act != act || EndlessCycle != endlessCycle) throw new InvalidDataException("Map progression mismatch.");
            if (Nodes.Count != 13) throw new InvalidDataException("A run map must contain twelve row nodes and one boss.");
            if (LastCompletedRow is < -1 or > 4) throw new InvalidDataException("Invalid completed map row.");
            if (Nodes.Select(node => node.NodeId).Distinct(StringComparer.Ordinal).Count() != Nodes.Count)
                throw new InvalidDataException("Duplicate map node id.");
            foreach (var node in Nodes)
            {
                if (node.Act != act || node.Row is < 0 or > 4 || node.Column < 0 || node.Column > 2 || !Enum.IsDefined(node.Type) || !Enum.IsDefined(node.VisitState))
                    throw new InvalidDataException($"Invalid map node {node.NodeId}.");
                var expectedId = $"a{Act}.c{EndlessCycle}.r{node.Row}.n{node.Column}";
                if (!string.Equals(node.NodeId, expectedId, StringComparison.Ordinal)) throw new InvalidDataException($"Invalid map node id {node.NodeId}.");
                if (node.Row == 4 && (node.Column != 0 || node.Type != NodeTypeV2.Boss)) throw new InvalidDataException("Invalid boss node.");
                if (node.Row < 4 && node.Type == NodeTypeV2.Boss) throw new InvalidDataException("Boss placed before the boss row.");
                if (node.Type is NodeTypeV2.Battle or NodeTypeV2.Elite or NodeTypeV2.Boss)
                {
                    var prefix = node.Type switch { NodeTypeV2.Battle => "enemy.", NodeTypeV2.Elite => "elite.", _ => "boss." };
                    if (!node.ContentId.StartsWith(prefix, StringComparison.Ordinal)) throw new InvalidDataException($"Invalid encounter content for {node.NodeId}.");
                    _ = catalog.GetEnemy(node.ContentId);
                }
                else if (!string.Equals(node.ContentId, node.Type.ToString().ToLowerInvariant(), StringComparison.Ordinal))
                    throw new InvalidDataException($"Invalid content for map node {node.NodeId}.");
                foreach (var next in node.NextNodeIds)
                {
                    var target = Nodes.SingleOrDefault(candidate => candidate.NodeId == next) ?? throw new InvalidDataException($"Unknown map edge {next}.");
                    if (target.Row != node.Row + 1 || node.Row < 3 && Math.Abs(target.Column - node.Column) > 1 || node.Row == 3 && target.Type != NodeTypeV2.Boss)
                        throw new InvalidDataException($"Invalid map edge {node.NodeId} -> {next}.");
                }
                if (node.Row < 4 && node.NextNodeIds.Count == 0) throw new InvalidDataException($"Map node {node.NodeId} has no successor.");
                if (node.Row == 4 && node.NextNodeIds.Count != 0) throw new InvalidDataException("Boss node cannot have a successor.");
            }
            for (var row = 0; row < 4; row++)
                if (Nodes.Count(node => node.Row == row) != 3) throw new InvalidDataException($"Map row {row} is incomplete.");
            if (Nodes.Count(node => node.Row == 4) != 1) throw new InvalidDataException("Map boss row is invalid.");
            var currentNodes = Nodes.Where(node => node.VisitState == NodeVisitState.Current).ToArray();
            if (CurrentNodeId is null && currentNodes.Length != 0) throw new InvalidDataException("Current map node id is missing.");
            if (CurrentNodeId is not null && (currentNodes.Length != 1 || currentNodes[0].NodeId != CurrentNodeId))
                throw new InvalidDataException("Current map node is inconsistent.");
            if (CurrentNodeId is not null && Nodes.All(node => node.NodeId != CurrentNodeId)) throw new InvalidDataException("Unknown current map node.");
            var completedByRow = Nodes.Where(node => node.VisitState == NodeVisitState.Completed).GroupBy(node => node.Row).ToArray();
            if (completedByRow.Any(group => group.Count() != 1) || completedByRow.Any(group => group.Key > LastCompletedRow))
                throw new InvalidDataException("Map contains an invalid completed path.");
            if (completedByRow.Length != LastCompletedRow + 1) throw new InvalidDataException("Completed map path has a gap.");
            var available = Nodes.Where(node => node.VisitState == NodeVisitState.Available).ToArray();
            if (available.Length > 0 && available.Any(node => node.Row != LastCompletedRow + 1))
                throw new InvalidDataException("Available nodes are outside the next map row.");
            if (currentNodes.Length == 1 && currentNodes[0].Row != LastCompletedRow + 1)
                throw new InvalidDataException("Current node is outside the next map row.");
        }
    }

    private sealed class EncounterState
    {
        public string EncounterId = string.Empty;
        public string EnemyId = string.Empty;
        public EncounterKindV2 Kind;
        public int Attempt;
        public Actor ActiveActor;
        public EncounterOutcomeV2 Outcome;
        public ResolutionPhaseV2 ResolutionPhase;
        public readonly Dictionary<long, CardCopyV2> Copies = [];
        public readonly List<long> PlayerDrawPile = [];
        public readonly List<long> OpponentDrawPile = [];
        public readonly List<long> PlayerDiscardPile = [];
        public readonly List<long> OpponentDiscardPile = [];
        public List<long> PlayerHand = [];
        public List<long> OpponentHand = [];
        public readonly List<long> Staging = [];
        public long TableCopyId;
        public readonly List<StatusInstanceV2> Statuses = [];
        public readonly List<ResolutionItemV2> ResolutionQueue = [];
        public PendingDecisionV2? PendingDecision;
        public Actor? RootActor;
        public bool RetainTurn;
        public int TriggeredPlayCount;
        public int ConsecutiveNoProgressTurns;
        public int PlayerTurnsStarted;
        public int OpponentTurnsStarted;
        public int BankedMarks;
        public int BonusMultiplier = 1;
        public readonly HashSet<string> UsedTrinketIds = new(StringComparer.Ordinal);
        public readonly List<CardCopyV2> CheckpointPlayerCollection = [];
        public int CheckpointMoney;

        public EncounterSnapshotV2 Snapshot() => new(
            EncounterId, EnemyId, Kind, Attempt, ActiveActor, Outcome, ResolutionPhase,
            Copies.Values.OrderBy(copy => copy.CopyId).ToArray(), PlayerDrawPile.ToArray(), OpponentDrawPile.ToArray(),
            PlayerDiscardPile.ToArray(), OpponentDiscardPile.ToArray(), PlayerHand.ToArray(), OpponentHand.ToArray(),
            Staging.ToArray(), TableCopyId, Statuses.ToArray(), ResolutionQueue.ToArray(), PendingDecision, RootActor,
            RetainTurn, TriggeredPlayCount, ConsecutiveNoProgressTurns, PlayerTurnsStarted, OpponentTurnsStarted,
            BankedMarks, BonusMultiplier, UsedTrinketIds.Order(StringComparer.Ordinal).ToArray(),
            CheckpointPlayerCollection.ToArray(), CheckpointMoney);

        public static EncounterState Restore(EncounterSnapshotV2 snapshot)
        {
            var state = new EncounterState
            {
                EncounterId = snapshot.EncounterId, EnemyId = snapshot.EnemyId, Kind = snapshot.Kind, Attempt = snapshot.Attempt,
                ActiveActor = snapshot.ActiveActor, Outcome = snapshot.Outcome, ResolutionPhase = snapshot.ResolutionPhase,
                PlayerHand = snapshot.PlayerHand.ToList(), OpponentHand = snapshot.OpponentHand.ToList(),
                TableCopyId = snapshot.TableCopyId, PendingDecision = snapshot.PendingDecision, RootActor = snapshot.RootActor,
                RetainTurn = snapshot.RetainTurn, TriggeredPlayCount = snapshot.TriggeredPlayCount,
                ConsecutiveNoProgressTurns = snapshot.ConsecutiveNoProgressTurns, PlayerTurnsStarted = snapshot.PlayerTurnsStarted,
                OpponentTurnsStarted = snapshot.OpponentTurnsStarted, BankedMarks = snapshot.BankedMarks,
                BonusMultiplier = snapshot.BonusMultiplier, CheckpointMoney = snapshot.CheckpointMoney
            };
            foreach (var copy in snapshot.Copies) state.Copies.Add(copy.CopyId, copy);
            state.PlayerDrawPile.AddRange(snapshot.PlayerDrawPile); state.OpponentDrawPile.AddRange(snapshot.OpponentDrawPile);
            state.PlayerDiscardPile.AddRange(snapshot.PlayerDiscardPile); state.OpponentDiscardPile.AddRange(snapshot.OpponentDiscardPile);
            state.Staging.AddRange(snapshot.Staging); state.Statuses.AddRange(snapshot.Statuses);
            state.ResolutionQueue.AddRange(snapshot.ResolutionQueue); state.UsedTrinketIds.UnionWith(snapshot.UsedTrinketIds);
            state.CheckpointPlayerCollection.AddRange(snapshot.CheckpointPlayerCollection);
            return state;
        }

        public void Validate(RunCatalogV2 catalog, IReadOnlyList<CardCopyV2> playerCollection)
        {
            if (string.IsNullOrWhiteSpace(EncounterId) || string.IsNullOrWhiteSpace(EnemyId)) throw new InvalidDataException("Encounter identity is missing.");
            _ = catalog.GetEnemy(EnemyId);
            if (!Copies.ContainsKey(TableCopyId)) throw new InvalidDataException("Table card is missing.");
            var zones = PlayerDrawPile.Concat(OpponentDrawPile).Concat(PlayerDiscardPile).Concat(OpponentDiscardPile)
                .Concat(PlayerHand).Concat(OpponentHand).Concat(Staging).Append(TableCopyId).ToArray();
            if (zones.Distinct().Count() != zones.Length) throw new InvalidDataException("A card copy occupies multiple encounter zones.");
            if (zones.Any(id => !Copies.ContainsKey(id))) throw new InvalidDataException("Encounter zone references an unknown copy.");
            foreach (var copy in Copies.Values) _ = catalog.GetCard(copy.DefinitionId);
            var nonRetiredPlayerCopies = Copies.Values.Where(copy => copy.Owner == CardOwnerV2.Player && copy.PersistenceScope == PersistenceScopeV2.Run && !copy.RetireOnDisplace).Select(copy => copy.CopyId).ToHashSet();
            var collectionIds = playerCollection.Select(copy => copy.CopyId).ToHashSet();
            if (!nonRetiredPlayerCopies.SetEquals(collectionIds)) throw new InvalidDataException("Encounter/player collection conservation failed.");
            if (ResolutionPhase == ResolutionPhaseV2.AwaitingDecision && PendingDecision is null) throw new InvalidDataException("Decision phase without decision.");
            if (ResolutionPhase != ResolutionPhaseV2.AwaitingDecision && PendingDecision is not null) throw new InvalidDataException("Pending decision outside decision phase.");
            if (BonusMultiplier < 1 || Attempt < 0 || BankedMarks < 0) throw new InvalidDataException("Invalid encounter counters.");
        }
    }

    private sealed class RewardState
    {
        public readonly List<string> CardDefinitionIds = [];
        public readonly List<string> TrinketIds = [];
        public bool IncludesTrinketReward;
        public bool IsBossReward;
        public int SkipCardMoney;
        public int SkipTrinketMoney;
        public CardRewardSnapshotV2 Snapshot() => new(CardDefinitionIds.ToArray(), TrinketIds.ToArray(), IncludesTrinketReward, IsBossReward, SkipCardMoney, SkipTrinketMoney);
        public static RewardState Restore(CardRewardSnapshotV2 snapshot)
        {
            ArgumentNullException.ThrowIfNull(snapshot.CardDefinitionIds);
            ArgumentNullException.ThrowIfNull(snapshot.TrinketIds);
            var state = new RewardState { IncludesTrinketReward = snapshot.IncludesTrinketReward, IsBossReward = snapshot.IsBossReward, SkipCardMoney = snapshot.SkipCardMoney, SkipTrinketMoney = snapshot.SkipTrinketMoney };
            state.CardDefinitionIds.AddRange(snapshot.CardDefinitionIds); state.TrinketIds.AddRange(snapshot.TrinketIds); return state;
        }
        public void Validate(RunCatalogV2 catalog, RunPhaseV2 phase)
        {
            if (SkipCardMoney < 0 || SkipTrinketMoney < 0 || IsBossReward && !IncludesTrinketReward) throw new InvalidDataException("Invalid reward values.");
            if (CardDefinitionIds.Count == 0 || CardDefinitionIds.Distinct(StringComparer.Ordinal).Count() != CardDefinitionIds.Count)
                throw new InvalidDataException("Invalid card reward options.");
            foreach (var id in CardDefinitionIds) _ = catalog.GetCard(id);
            if (TrinketIds.Distinct(StringComparer.Ordinal).Count() != TrinketIds.Count) throw new InvalidDataException("Duplicate trinket reward option.");
            foreach (var id in TrinketIds) _ = catalog.GetTrinket(id);
            if (phase == RunPhaseV2.TrinketReward && !IncludesTrinketReward)
                throw new InvalidDataException("Trinket reward phase is not enabled.");
        }
    }

    private sealed class ShopState
    {
        public readonly List<ShopOfferV2> Offers = [];
        public int RerollCount;
        public int RemovalCountAtOpen;
        public bool RemovalUsed;
        public bool HealingUsed;
        public bool FirstCardDiscountAvailable;
        public ShopSnapshotV2 Snapshot() => new(Offers.ToArray(), RerollCount, RemovalCountAtOpen, RemovalUsed, HealingUsed, FirstCardDiscountAvailable);
        public static ShopState Restore(ShopSnapshotV2 snapshot)
        {
            ArgumentNullException.ThrowIfNull(snapshot.Offers);
            var state = new ShopState { RerollCount = snapshot.RerollCount, RemovalCountAtOpen = snapshot.RemovalCountAtOpen, RemovalUsed = snapshot.RemovalUsed, HealingUsed = snapshot.HealingUsed, FirstCardDiscountAvailable = snapshot.FirstCardDiscountAvailable };
            state.Offers.AddRange(snapshot.Offers); return state;
        }
        public void Validate(RunCatalogV2 catalog, int removalCount)
        {
            if (RerollCount < 0 || RemovalCountAtOpen < 0 || RemovalCountAtOpen > removalCount || Offers.Count == 0)
                throw new InvalidDataException("Invalid shop counters or empty shop.");
            if (Offers.Select(offer => offer.OfferId).Distinct(StringComparer.Ordinal).Count() != Offers.Count)
                throw new InvalidDataException("Duplicate shop offer id.");
            foreach (var offer in Offers)
            {
                if (string.IsNullOrWhiteSpace(offer.OfferId) || offer.Price < 0) throw new InvalidDataException("Invalid shop offer.");
                var expectedPrice = offer.IsTrinket ? catalog.GetTrinket(offer.ContentId).BasePrice : catalog.GetCard(offer.ContentId).BasePrice;
                if (offer.Price != expectedPrice) throw new InvalidDataException("Shop offer price does not match the catalog.");
            }
        }
    }

    private sealed class EventState
    {
        public string EventId = string.Empty;
        public string DisplayName = string.Empty;
        public readonly List<EventOptionV2> Options = [];
        public EventSnapshotV2 Snapshot() => new(EventId, DisplayName, Options.ToArray());
        public static EventState Restore(EventSnapshotV2 snapshot)
        {
            ArgumentNullException.ThrowIfNull(snapshot.Options);
            var state = new EventState { EventId = snapshot.EventId, DisplayName = snapshot.DisplayName };
            state.Options.AddRange(snapshot.Options); return state;
        }
        public void Validate(RunCatalogV2 catalog)
        {
            var knownEvents = new[] { "event.quiet-table", "event.fence", "event.open-tab", "event.rigged-box" };
            if (!knownEvents.Contains(EventId, StringComparer.Ordinal) || string.IsNullOrWhiteSpace(DisplayName) || Options.Count == 0)
                throw new InvalidDataException("Invalid event identity or options.");
            if (Options.Select(option => option.OptionId).Distinct(StringComparer.Ordinal).Count() != Options.Count)
                throw new InvalidDataException("Duplicate event option id.");
            foreach (var option in Options)
            {
                if (string.IsNullOrWhiteSpace(option.OptionId) || string.IsNullOrWhiteSpace(option.DisplayText) || option.NextEncounterExtraCards < 0)
                    throw new InvalidDataException("Invalid event option.");
                if (!string.IsNullOrWhiteSpace(option.TrinketId)) _ = catalog.GetTrinket(option.TrinketId);
            }
        }
    }
}
