using Zuendung.Domain.Random;

namespace Zuendung.Domain;

public sealed class GameSession
{
    public const int CurrentSnapshotVersion = 1;
    private const int OpeningHandSize = 4;
    private const int ShopOfferCount = 8;

    private readonly GameCatalog _catalog;
    private readonly EffectRegistry _effects;
    private Pcg32 _random;
    private readonly List<string> _ownedDefinitionIds;
    private long _nextInstanceId;
    private RoundState? _round;
    private ShopState? _shop;

    public RunPhase Phase { get; private set; }
    public int Level { get; private set; }
    public int Score { get; private set; }
    public int Money { get; private set; }
    public int PendingReward { get; private set; }
    public bool RewardGranted { get; private set; }

    private GameSession(GameCatalog catalog, EffectRegistry effects, Pcg32 random, IEnumerable<string> ownedIds)
    {
        _catalog = catalog;
        _effects = effects;
        _random = random;
        _ownedDefinitionIds = ownedIds.ToList();
    }

    public static GameSession CreateNew(ulong seed, GameCatalog? catalog = null, EffectRegistry? effects = null)
    {
        catalog ??= GameCatalog.CreateDefault();
        effects ??= EffectRegistry.CreateDefault();
        var session = new GameSession(catalog, effects, new Pcg32(seed), catalog.Cards.Select(card => card.Id))
        {
            Phase = RunPhase.InRound,
            Level = 1,
            Money = 12,
            _nextInstanceId = 1
        };
        session.StartRound(events: null);
        session.ValidateInvariants();
        return session;
    }

    public IReadOnlyList<DomainEvent> Handle(GameAction action)
    {
        ArgumentNullException.ThrowIfNull(action);
        ValidateAction(action);
        var events = new List<DomainEvent>();

        switch (action)
        {
            case PlayCardAction play:
                PlayCard(play.Actor, play.CardInstanceId, events);
                break;
            case DrawCardAction draw:
                DrawAndEndTurn(draw.Actor, events);
                break;
            case AdvanceOpponentAction:
                AdvanceOpponent(events);
                break;
            case ClaimRewardAction:
                ClaimReward(events);
                break;
            case BuyOfferAction buy:
                BuyOffer(buy.OfferId, events);
                break;
            case RerollShopAction:
                RerollShop(events);
                break;
            case LeaveShopAction:
                LeaveShop(events);
                break;
            default:
                throw new DomainRuleException($"Unsupported action: {action.GetType().Name}");
        }

        ValidateInvariants();
        return events;
    }

    public bool IsPlayable(CardInstance instance)
    {
        if (_round is null || _round.DiscardPile.Count == 0) return false;
        var candidate = _catalog.GetCard(instance.DefinitionId);
        var top = _catalog.GetCard(_round.DiscardPile[^1].DefinitionId);
        return candidate.IsWild || top.IsWild || candidate.Suit == top.Suit || candidate.Rank == top.Rank;
    }

    public GameSessionSnapshot Snapshot() => new(
        CurrentSnapshotVersion,
        _catalog.Version,
        Phase,
        Level,
        Score,
        Money,
        PendingReward,
        RewardGranted,
        _random.State,
        _random.Stream,
        _nextInstanceId,
        _ownedDefinitionIds.ToArray(),
        _round?.Snapshot(),
        _shop?.Snapshot());

    public static GameSession Restore(GameSessionSnapshot snapshot, GameCatalog? catalog = null, EffectRegistry? effects = null)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        catalog ??= GameCatalog.CreateDefault();
        effects ??= EffectRegistry.CreateDefault();
        if (snapshot.SnapshotVersion != CurrentSnapshotVersion)
            throw new InvalidDataException($"Unsupported snapshot version {snapshot.SnapshotVersion}.");
        if (!string.Equals(snapshot.CatalogVersion, catalog.Version, StringComparison.Ordinal))
            throw new InvalidDataException($"Catalog mismatch: {snapshot.CatalogVersion} != {catalog.Version}.");
        foreach (var id in snapshot.OwnedDefinitionIds)
            if (!catalog.Contains(id)) throw new InvalidDataException($"Unknown owned card id: {id}");
        if ((snapshot.RandomStream & 1UL) == 0) throw new InvalidDataException("The PCG32 stream increment must be odd.");

        var session = new GameSession(catalog, effects, Pcg32.Restore(snapshot.RandomState, snapshot.RandomStream), snapshot.OwnedDefinitionIds)
        {
            Phase = snapshot.Phase,
            Level = snapshot.Level,
            Score = snapshot.Score,
            Money = snapshot.Money,
            PendingReward = snapshot.PendingReward,
            RewardGranted = snapshot.RewardGranted,
            _nextInstanceId = snapshot.NextInstanceId,
            _round = snapshot.Round is null ? null : RoundState.Restore(snapshot.Round, catalog),
            _shop = snapshot.Shop is null ? null : ShopState.Restore(snapshot.Shop, catalog)
        };
        session.ValidateInvariants();
        return session;
    }

    private void ValidateAction(GameAction action)
    {
        switch (action)
        {
            case PlayCardAction play:
                RequireRoundTurn(play.Actor);
                var hand = Hand(play.Actor);
                var card = hand.FirstOrDefault(item => item.InstanceId == play.CardInstanceId)
                    ?? throw new DomainRuleException("The card is not in the active hand.");
                if (!IsPlayable(card)) throw new DomainRuleException("The card does not match rank or suit.");
                break;
            case DrawCardAction draw:
                RequireRoundTurn(draw.Actor);
                break;
            case AdvanceOpponentAction:
                RequireRoundTurn(Actor.Opponent);
                break;
            case ClaimRewardAction when Phase != RunPhase.Reward || RewardGranted:
                throw new DomainRuleException("No reward is available.");
            case BuyOfferAction buy:
                RequireShop();
                var offer = _shop!.Offers.FirstOrDefault(item => item.OfferId == buy.OfferId)
                    ?? throw new DomainRuleException("Unknown shop offer.");
                if (offer.Purchased) throw new DomainRuleException("The offer was already purchased.");
                if (Money < offer.Price) throw new DomainRuleException("Not enough money.");
                break;
            case RerollShopAction:
                RequireShop();
                if (Money < RerollPrice()) throw new DomainRuleException("Not enough money to reroll.");
                break;
            case LeaveShopAction:
                RequireShop();
                break;
        }
    }

    private void RequireRoundTurn(Actor actor)
    {
        if (Phase != RunPhase.InRound || _round is null || _round.Outcome != RoundOutcome.None)
            throw new DomainRuleException("There is no active round.");
        if (_round.ActiveActor != actor) throw new DomainRuleException("It is not this actor's turn.");
    }

    private void RequireShop()
    {
        if (Phase != RunPhase.Shop || _shop is null) throw new DomainRuleException("The shop is not open.");
    }

    private void StartRound(List<DomainEvent>? events)
    {
        var drawPile = _ownedDefinitionIds.Select(CreateInstance).ToList();
        _random.Shuffle(drawPile);
        var round = new RoundState(drawPile);
        _round = round;
        _shop = null;
        Phase = RunPhase.InRound;
        PendingReward = 0;
        RewardGranted = false;

        for (var i = 0; i < OpeningHandSize; i++)
        {
            DrawOne(Actor.Player, events);
            DrawOne(Actor.Opponent, events);
        }
        if (round.DrawPile.Count == 0) throw new InvalidOperationException("The deck cannot provide a top discard.");
        round.DiscardPile.Add(round.DrawPile[^1]);
        round.DrawPile.RemoveAt(round.DrawPile.Count - 1);
        events?.Add(new DomainEvent(DomainEventKind.RoundStarted, Amount: Level, DefinitionId: round.DiscardPile[^1].DefinitionId));
    }

    private CardInstance CreateInstance(string definitionId) => new(_nextInstanceId++, definitionId);

    private List<CardInstance> Hand(Actor actor) => actor == Actor.Player ? _round!.PlayerHand : _round!.OpponentHand;

    private void PlayCard(Actor actor, long instanceId, List<DomainEvent> events)
    {
        var hand = Hand(actor);
        var index = hand.FindIndex(card => card.InstanceId == instanceId);
        var instance = hand[index];
        hand.RemoveAt(index);
        _round!.DiscardPile.Add(instance);
        var definition = _catalog.GetCard(instance.DefinitionId);
        events.Add(new DomainEvent(DomainEventKind.CardPlayed, actor, instanceId, definition.Id));

        if (actor == Actor.Player)
        {
            var amount = (10 + definition.Price) * Level;
            Score += amount;
            events.Add(new DomainEvent(DomainEventKind.ScoreChanged, actor, instanceId, definition.Id, amount));
        }

        if (definition.Effects.Count > 0)
            events.Add(new DomainEvent(DomainEventKind.IgnitionTriggered, actor, instanceId, definition.Id, definition.Effects.Count));
        var context = new EffectContext(this, actor, events);
        foreach (var effect in definition.Effects) _effects.Resolve(effect, context);

        if (TryEndRound(events)) return;
        AdvanceTurn(events);
    }

    private void DrawAndEndTurn(Actor actor, List<DomainEvent> events)
    {
        DrawOne(actor, events);
        if (TryEndRound(events)) return;
        AdvanceTurn(events);
    }

    private void AdvanceOpponent(List<DomainEvent> events)
    {
        var legal = _round!.OpponentHand.Where(IsPlayable).OrderBy(card => card.InstanceId).ToArray();
        if (legal.Length == 0)
        {
            DrawAndEndTurn(Actor.Opponent, events);
            return;
        }
        PlayCard(Actor.Opponent, legal[_random.NextInt(legal.Length)].InstanceId, events);
    }

    private void AdvanceTurn(List<DomainEvent> events)
    {
        var next = Other(_round!.ActiveActor);
        while (SkipCount(next) > 0)
        {
            SetSkipCount(next, SkipCount(next) - 1);
            events.Add(new DomainEvent(DomainEventKind.TurnSkipped, next));
            next = Other(next);
        }
        _round.ActiveActor = next;
        _round.TurnNumber++;
        events.Add(new DomainEvent(DomainEventKind.TurnChanged, next, Amount: _round.TurnNumber));
    }

    internal void DrawCardsForEffect(Actor actor, int count, List<DomainEvent> events)
    {
        var drawn = 0;
        for (var i = 0; i < count; i++) if (DrawOne(actor, events: null)) drawn++;
        if (drawn > 0) events.Add(new DomainEvent(DomainEventKind.CardsDrawn, actor, Amount: drawn));
    }

    internal void SkipForEffect(Actor actor, int count, List<DomainEvent> events)
    {
        if (count <= 0) return;
        SetSkipCount(actor, SkipCount(actor) + count);
    }

    private bool DrawOne(Actor actor, List<DomainEvent>? events)
    {
        if (_round!.DrawPile.Count == 0) RecycleDiscard(events);
        if (_round.DrawPile.Count == 0) return false;
        var card = _round.DrawPile[^1];
        _round.DrawPile.RemoveAt(_round.DrawPile.Count - 1);
        Hand(actor).Add(card);
        events?.Add(new DomainEvent(DomainEventKind.CardsDrawn, actor, card.InstanceId, card.DefinitionId, 1));
        return true;
    }

    private void RecycleDiscard(List<DomainEvent>? events)
    {
        if (_round!.DiscardPile.Count <= 1) return;
        var top = _round.DiscardPile[^1];
        var recycled = _round.DiscardPile.Take(_round.DiscardPile.Count - 1).ToList();
        _round.DiscardPile.Clear();
        _round.DiscardPile.Add(top);
        _random.Shuffle(recycled);
        _round.DrawPile.AddRange(recycled);
        events?.Add(new DomainEvent(DomainEventKind.DiscardRecycled, Amount: recycled.Count));
    }

    private bool TryEndRound(List<DomainEvent> events)
    {
        RoundOutcome outcome;
        if (_round!.PlayerHand.Count == 0) outcome = RoundOutcome.PlayerWon;
        else if (_round.OpponentHand.Count == 0 || Score < 0) outcome = RoundOutcome.OpponentWon;
        else return false;

        _round.Outcome = outcome;
        if (outcome == RoundOutcome.PlayerWon)
        {
            PendingReward = Math.Max(3, (int)Math.Ceiling(Score / (800d / Math.Sqrt(Level + 1d))));
            Phase = RunPhase.Reward;
        }
        else
        {
            Phase = RunPhase.GameOver;
        }
        events.Add(new DomainEvent(DomainEventKind.RoundEnded, Amount: (int)outcome));
        if (Phase == RunPhase.GameOver) events.Add(new DomainEvent(DomainEventKind.RunEnded, Message: "Der Gegner hat die Runde gewonnen."));
        return true;
    }

    private void ClaimReward(List<DomainEvent> events)
    {
        Money += PendingReward;
        RewardGranted = true;
        events.Add(new DomainEvent(DomainEventKind.RewardGranted, Amount: PendingReward));
        OpenShop(events);
    }

    private void OpenShop(List<DomainEvent> events)
    {
        _shop = new ShopState(CreateOffers());
        Phase = RunPhase.Shop;
        events.Add(new DomainEvent(DomainEventKind.ShopOpened, Amount: _shop.Offers.Count));
    }

    private List<ShopOffer> CreateOffers()
    {
        var offers = new List<ShopOffer>(ShopOfferCount);
        for (var i = 0; i < ShopOfferCount; i++)
        {
            var card = _catalog.Cards[_random.NextInt(_catalog.Cards.Count)];
            offers.Add(new ShopOffer($"L{Level}-R{_shop?.RerollCount ?? 0}-O{i}", card.Id, card.Price + Level / 2, false));
        }
        return offers;
    }

    private void BuyOffer(string offerId, List<DomainEvent> events)
    {
        var index = _shop!.Offers.FindIndex(offer => offer.OfferId == offerId);
        var offer = _shop.Offers[index];
        Money -= offer.Price;
        _ownedDefinitionIds.Add(offer.DefinitionId);
        _shop.PurchasedDefinitionIds.Add(offer.DefinitionId);
        _shop.Offers[index] = offer with { Purchased = true };
        events.Add(new DomainEvent(DomainEventKind.OfferPurchased, DefinitionId: offer.DefinitionId, Amount: offer.Price, Message: offer.OfferId));
    }

    private int RerollPrice() => 2 + Level * _shop!.RerollCount;

    private void RerollShop(List<DomainEvent> events)
    {
        var price = RerollPrice();
        Money -= price;
        _shop!.RerollCount++;
        _shop.Offers.Clear();
        _shop.Offers.AddRange(CreateOffers());
        events.Add(new DomainEvent(DomainEventKind.ShopRerolled, Amount: price));
    }

    private void LeaveShop(List<DomainEvent> events)
    {
        Level++;
        StartRound(events);
    }

    private int SkipCount(Actor actor) => actor == Actor.Player ? _round!.PlayerSkips : _round!.OpponentSkips;
    private void SetSkipCount(Actor actor, int value)
    {
        if (actor == Actor.Player) _round!.PlayerSkips = value;
        else _round!.OpponentSkips = value;
    }
    private static Actor Other(Actor actor) => actor == Actor.Player ? Actor.Opponent : Actor.Player;

    private void ValidateInvariants()
    {
        if (Level < 1) throw new InvalidDataException("Level must be positive.");
        if (Score < 0) throw new InvalidDataException("Score cannot be negative.");
        if (Money < 0) throw new InvalidDataException("Money cannot be negative.");
        if (PendingReward < 0) throw new InvalidDataException("Pending reward cannot be negative.");
        if (_nextInstanceId < 1) throw new InvalidDataException("Invalid instance id counter.");
        if (_ownedDefinitionIds.Count == 0) throw new InvalidDataException("The owned deck is empty.");
        if (Phase == RunPhase.InRound && (_round is null || _round.Outcome != RoundOutcome.None || _shop is not null || PendingReward != 0 || RewardGranted))
            throw new InvalidDataException("In-round phase state is inconsistent.");
        if (Phase == RunPhase.Reward && (_round is null || _round.Outcome != RoundOutcome.PlayerWon || _shop is not null || PendingReward <= 0 || RewardGranted))
            throw new InvalidDataException("Reward phase state is inconsistent.");
        if (Phase == RunPhase.Shop && (_round is null || _round.Outcome != RoundOutcome.PlayerWon || _shop is null || PendingReward <= 0 || !RewardGranted))
            throw new InvalidDataException("Shop phase state is inconsistent.");
        if (Phase == RunPhase.GameOver && (_round is null || _round.Outcome != RoundOutcome.OpponentWon || _shop is not null || PendingReward != 0 || RewardGranted))
            throw new InvalidDataException("Game-over phase state is inconsistent.");
        if (_round is not null)
        {
            var zones = _round.DrawPile.Concat(_round.DiscardPile).Concat(_round.PlayerHand).Concat(_round.OpponentHand).ToArray();
            var duplicate = zones.GroupBy(card => card.InstanceId).FirstOrDefault(group => group.Count() > 1);
            if (duplicate is not null) throw new InvalidDataException($"Card {duplicate.Key} exists in more than one zone.");
            foreach (var card in zones)
                if (!_catalog.Contains(card.DefinitionId)) throw new InvalidDataException($"Unknown card in round: {card.DefinitionId}");
            if (_round.DiscardPile.Count == 0) throw new InvalidDataException("A round needs a top discard.");
            if (_round.PlayerSkips < 0 || _round.OpponentSkips < 0 || _round.TurnNumber < 1)
                throw new InvalidDataException("Round counters cannot be negative.");
            if (zones.Any(card => card.InstanceId < 1) || zones.Any(card => card.InstanceId >= _nextInstanceId))
                throw new InvalidDataException("Card instance ids exceed the deterministic id counter.");

            var ownedCounts = _ownedDefinitionIds.GroupBy(id => id, StringComparer.Ordinal).ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);
            var zoneCounts = zones.GroupBy(card => card.DefinitionId, StringComparer.Ordinal).ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);
            foreach (var (definitionId, count) in zoneCounts)
                if (!ownedCounts.TryGetValue(definitionId, out var owned) || owned < count)
                    throw new InvalidDataException($"Round contains unowned card copies: {definitionId}");

            if (Phase != RunPhase.Shop && zones.Length != _ownedDefinitionIds.Count)
                throw new InvalidDataException("Card-zone conservation failed.");
            if (Phase == RunPhase.Shop)
            {
                if (_shop!.RerollCount < 0) throw new InvalidDataException("Shop reroll count cannot be negative.");
                if (_shop.Offers.Count != ShopOfferCount) throw new InvalidDataException($"Shop must contain {ShopOfferCount} offers.");
                var duplicateOffer = _shop.Offers.GroupBy(offer => offer.OfferId, StringComparer.Ordinal).FirstOrDefault(group => group.Count() > 1);
                if (duplicateOffer is not null) throw new InvalidDataException($"Duplicate shop offer id: {duplicateOffer.Key}");
                foreach (var offer in _shop.Offers)
                {
                    if (string.IsNullOrWhiteSpace(offer.OfferId)) throw new InvalidDataException("Shop offer id is missing.");
                    if (!_catalog.Contains(offer.DefinitionId)) throw new InvalidDataException($"Unknown shop card: {offer.DefinitionId}");
                    if (offer.Price < 0) throw new InvalidDataException("Shop offer price cannot be negative.");
                }
                foreach (var purchasedId in _shop.PurchasedDefinitionIds)
                    if (!_catalog.Contains(purchasedId)) throw new InvalidDataException($"Unknown purchased card: {purchasedId}");
                var purchasedCounts = _shop.PurchasedDefinitionIds.GroupBy(id => id, StringComparer.Ordinal).ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);
                foreach (var (definitionId, owned) in ownedCounts)
                {
                    zoneCounts.TryGetValue(definitionId, out var inRound);
                    purchasedCounts.TryGetValue(definitionId, out var purchased);
                    if (owned - inRound != purchased) throw new InvalidDataException($"Purchased-card accounting failed: {definitionId}");
                }
            }
        }
    }

    private sealed class RoundState
    {
        public Actor ActiveActor { get; set; } = Actor.Player;
        public RoundOutcome Outcome { get; set; }
        public List<CardInstance> DrawPile { get; }
        public List<CardInstance> DiscardPile { get; } = [];
        public List<CardInstance> PlayerHand { get; } = [];
        public List<CardInstance> OpponentHand { get; } = [];
        public int PlayerSkips { get; set; }
        public int OpponentSkips { get; set; }
        public int TurnNumber { get; set; } = 1;

        public RoundState(List<CardInstance> drawPile) => DrawPile = drawPile;

        public RoundSnapshot Snapshot() => new(ActiveActor, Outcome, DrawPile.ToArray(), DiscardPile.ToArray(), PlayerHand.ToArray(), OpponentHand.ToArray(), PlayerSkips, OpponentSkips, TurnNumber);

        public static RoundState Restore(RoundSnapshot snapshot, GameCatalog catalog)
        {
            foreach (var card in snapshot.DrawPile.Concat(snapshot.DiscardPile).Concat(snapshot.PlayerHand).Concat(snapshot.OpponentHand))
                if (!catalog.Contains(card.DefinitionId)) throw new InvalidDataException($"Unknown restored card: {card.DefinitionId}");
            var state = new RoundState(snapshot.DrawPile.ToList())
            {
                ActiveActor = snapshot.ActiveActor,
                Outcome = snapshot.Outcome,
                PlayerSkips = snapshot.PlayerSkips,
                OpponentSkips = snapshot.OpponentSkips,
                TurnNumber = snapshot.TurnNumber
            };
            state.DiscardPile.AddRange(snapshot.DiscardPile);
            state.PlayerHand.AddRange(snapshot.PlayerHand);
            state.OpponentHand.AddRange(snapshot.OpponentHand);
            return state;
        }
    }

    private sealed class ShopState
    {
        public List<ShopOffer> Offers { get; }
        public List<string> PurchasedDefinitionIds { get; } = [];
        public int RerollCount { get; set; }
        public ShopState(List<ShopOffer> offers) => Offers = offers;
        public ShopSnapshot Snapshot() => new(Offers.ToArray(), RerollCount, PurchasedDefinitionIds.ToArray());
        public static ShopState Restore(ShopSnapshot snapshot, GameCatalog catalog)
        {
            foreach (var offer in snapshot.Offers)
                if (!catalog.Contains(offer.DefinitionId)) throw new InvalidDataException($"Unknown restored offer: {offer.DefinitionId}");
            foreach (var definitionId in snapshot.PurchasedDefinitionIds)
                if (!catalog.Contains(definitionId)) throw new InvalidDataException($"Unknown restored purchase: {definitionId}");
            var state = new ShopState(snapshot.Offers.ToList()) { RerollCount = snapshot.RerollCount };
            state.PurchasedDefinitionIds.AddRange(snapshot.PurchasedDefinitionIds);
            return state;
        }
    }
}
