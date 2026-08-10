namespace Zuendung.Domain.V2;

public enum RunPhaseV2 { Map, Encounter, CardReward, TrinketReward, Shop, Lounge, Event, Victory, Defeat }
public enum RunModeV2 { Campaign, Endless }
public enum NodeTypeV2 { Battle, Elite, Shop, Lounge, Event, Boss }
public enum NodeVisitState { Available, Locked, Current, Completed }
public enum EncounterKindV2 { Battle, Elite, Boss }
public enum EncounterOutcomeV2 { None, PlayerWon, OpponentWon, Stalemate }
public enum ResolutionPhaseV2 { AwaitingAction, Resolving, AwaitingDecision, Ended }
public enum DecisionKindV2 { SelectCards, SelectOneCard, OptionalCard }
public enum CardOwnerV2 { Player, Opponent, Neutral }
public enum PersistenceScopeV2 { Run, Encounter, Neutral }
public enum RarityV2 { Common, Uncommon, Rare, Legendary }
public enum LoungeChoiceV2 { Heal, RemoveCard, TakeMoney }

public static class V2ContentIds
{
    public const string Stillstand = "special.stillstand";
    public const string Addieren = "special.addieren";
    public const string Spion = "special.spion";
    public const string Fluch = "special.fluch";
    public const string Hodl = "special.hodl";
    public const string Zytokinese = "special.zytokinese";
    public const string Tausch = "special.tausch";
    public const string Bonusgeld = "special.bonusgeld";
    public const string Opfer = "special.opfer";
    public const string Zocken = "special.zocken";
    public const string Zytokinese2 = "special.zytokinese-2";

    public const string Draw = "effect.draw";
    public const string Skip = "effect.skip";
    public const string Spy = "effect.spy";
    public const string Curse = "effect.curse";
    public const string HodlEffect = "effect.hodl";
    public const string CreateStandard = "effect.create-standard";
    public const string Swap = "effect.swap";
    public const string Bonus = "effect.bonus";
    public const string Sacrifice = "effect.sacrifice";
    public const string Gamble = "effect.gamble";
    public const string CreateSpecial = "effect.create-special";
}

public sealed record EffectBindingV2(
    string Id,
    string ResolverId,
    int Amount = 0,
    int Duration = 0,
    bool Reflectable = false);

public sealed record CardDefinitionV2(
    string Id,
    string DisplayName,
    Suit? Suit,
    Rank? Rank,
    int BasePrice,
    RarityV2 Rarity,
    IReadOnlyList<EffectBindingV2> Effects)
{
    public bool IsSpecial => Suit is null && Rank is null;
    public bool IsWild => IsSpecial;
}

public sealed record TrinketDefinitionV2(
    string Id,
    string DisplayName,
    string Description,
    RarityV2 Rarity,
    int BasePrice);

public sealed record StarterDeckDefinitionV2(
    string Id,
    string DisplayName,
    int StartingMoney,
    IReadOnlyList<string> DefinitionIds);

public sealed record EnemyDefinitionV2(
    string Id,
    string DisplayName,
    string Archetype,
    string AiPolicyId,
    IReadOnlyList<string> SpecialPool,
    bool CanSeePlayerHand = false,
    string? PassiveId = null);

public sealed record CardCopyV2(
    long CopyId,
    string DefinitionId,
    CardOwnerV2 Owner,
    PersistenceScopeV2 PersistenceScope,
    bool RetireOnDisplace = false);

public sealed record StatusInstanceV2(
    string Id,
    Actor Target,
    int Stacks,
    int Charges,
    int Duration,
    int Amount,
    long? SourceCopyId,
    long Ordinal);

public sealed record ResolutionItemV2(
    string ResolverId,
    string BindingId,
    Actor Source,
    long SourceCopyId,
    int Amount,
    int Duration,
    bool Reflectable,
    bool Reflected = false);

public sealed record PendingDecisionV2(
    string DecisionId,
    DecisionKindV2 Kind,
    Actor Actor,
    string Context,
    long SourceCopyId,
    IReadOnlyList<long> OptionCopyIds,
    int MinimumSelections,
    int MaximumSelections,
    string PromptKey);

public sealed record EncounterSnapshotV2(
    string EncounterId,
    string EnemyId,
    EncounterKindV2 Kind,
    int Attempt,
    Actor ActiveActor,
    EncounterOutcomeV2 Outcome,
    ResolutionPhaseV2 ResolutionPhase,
    IReadOnlyList<CardCopyV2> Copies,
    IReadOnlyList<long> PlayerDrawPile,
    IReadOnlyList<long> OpponentDrawPile,
    IReadOnlyList<long> PlayerDiscardPile,
    IReadOnlyList<long> OpponentDiscardPile,
    IReadOnlyList<long> PlayerHand,
    IReadOnlyList<long> OpponentHand,
    IReadOnlyList<long> Staging,
    long TableCopyId,
    IReadOnlyList<StatusInstanceV2> Statuses,
    IReadOnlyList<ResolutionItemV2> ResolutionQueue,
    PendingDecisionV2? PendingDecision,
    Actor? RootActor,
    bool RetainTurn,
    int TriggeredPlayCount,
    int ConsecutiveNoProgressTurns,
    int PlayerTurnsStarted,
    int OpponentTurnsStarted,
    int BankedMarks,
    int BonusMultiplier,
    IReadOnlyList<string> UsedTrinketIds,
    IReadOnlyList<CardCopyV2> CheckpointPlayerCollection,
    int CheckpointMoney);

public sealed record MapNodeV2(
    string NodeId,
    int Act,
    int Row,
    int Column,
    NodeTypeV2 Type,
    string ContentId,
    IReadOnlyList<string> NextNodeIds,
    NodeVisitState VisitState);

public sealed record RunMapSnapshotV2(
    int Act,
    int EndlessCycle,
    IReadOnlyList<MapNodeV2> Nodes,
    string? CurrentNodeId,
    int LastCompletedRow);

public sealed record CardRewardSnapshotV2(
    IReadOnlyList<string> CardDefinitionIds,
    IReadOnlyList<string> TrinketIds,
    bool IncludesTrinketReward,
    bool IsBossReward,
    int SkipCardMoney,
    int SkipTrinketMoney);

public sealed record ShopOfferV2(
    string OfferId,
    string ContentId,
    bool IsTrinket,
    int Price,
    bool Purchased);

public sealed record ShopSnapshotV2(
    IReadOnlyList<ShopOfferV2> Offers,
    int RerollCount,
    int RemovalCountAtOpen,
    bool RemovalUsed,
    bool HealingUsed,
    bool FirstCardDiscountAvailable);

public sealed record EventOptionV2(
    string OptionId,
    string DisplayText,
    int MoneyDelta = 0,
    int LivesDelta = 0,
    bool RequiresCardSelection = false,
    bool GrantsSpecialDraft = false,
    string? TrinketId = null,
    int NextEncounterExtraCards = 0);

public sealed record EventSnapshotV2(
    string EventId,
    string DisplayName,
    IReadOnlyList<EventOptionV2> Options);

public sealed record NamedRandomStreamSnapshotV2(string Name, ulong State, ulong Stream);
public sealed record RandomStreamsSnapshotV2(string AlgorithmId, IReadOnlyList<NamedRandomStreamSnapshotV2> Streams);

public sealed record RunSnapshotV2(
    int SnapshotVersion,
    string RunId,
    RunPhaseV2 Phase,
    RunModeV2 Mode,
    int Act,
    int EndlessCycle,
    int Lives,
    int Money,
    int Score,
    int RemovalCount,
    string StarterDeckId,
    long NextCopyId,
    long NextDecisionId,
    long NextStatusOrdinal,
    IReadOnlyList<CardCopyV2> PlayerCollection,
    IReadOnlyList<string> TrinketIds,
    RunMapSnapshotV2 Map,
    EncounterSnapshotV2? Encounter,
    CardRewardSnapshotV2? Reward,
    ShopSnapshotV2? Shop,
    EventSnapshotV2? Event,
    int NextEncounterExtraCards,
    RandomStreamsSnapshotV2 Random);

public sealed record ProfileSnapshotV1(
    int SchemaVersion,
    IReadOnlyList<string> UnlockedStarterDeckIds,
    IReadOnlyList<string> UnlockedTrinketIds,
    IReadOnlyList<string> UnlockedCosmeticIds,
    IReadOnlyList<string> AppliedRunIds,
    int BestScore,
    int BestEndlessCycle,
    int RunsCompleted);
