namespace Zuendung.Domain.V2;

public abstract record RunActionV2;
public sealed record ChooseNodeActionV2(string NodeId) : RunActionV2;
public sealed record PlayCardActionV2(Actor Actor, long CopyId) : RunActionV2;
public sealed record DrawCardActionV2(Actor Actor) : RunActionV2;
public sealed record AdvanceOpponentActionV2 : RunActionV2;
public sealed record SubmitDecisionActionV2(string DecisionId, IReadOnlyList<long> SelectedCopyIds) : RunActionV2;
public sealed record ChooseCardRewardActionV2(string? DefinitionId) : RunActionV2;
public sealed record ChooseTrinketRewardActionV2(string? TrinketId, string? ReplaceTrinketId = null) : RunActionV2;
public sealed record BuyShopOfferActionV2(string OfferId, string? ReplaceTrinketId = null) : RunActionV2;
public sealed record RerollShopActionV2 : RunActionV2;
public sealed record RemoveCardAtShopActionV2(long CopyId) : RunActionV2;
public sealed record HealAtShopActionV2 : RunActionV2;
public sealed record LeaveShopActionV2 : RunActionV2;
public sealed record ChooseLoungeActionV2(LoungeChoiceV2 Choice, long? CopyId = null) : RunActionV2;
public sealed record ChooseEventOptionActionV2(string OptionId, long? CopyId = null) : RunActionV2;
public sealed record EnterEndlessActionV2 : RunActionV2;
public sealed record FinishRunActionV2 : RunActionV2;

public abstract record RunEventV2;
public sealed record RunPhaseChangedEventV2(RunPhaseV2 Phase) : RunEventV2;
public sealed record CardMovedEventV2(long CopyId, string DefinitionId, string FromZone, string ToZone, string Cause) : RunEventV2;
public sealed record EffectResolvedEventV2(string ResolverId, Actor Source, Actor Target, int Amount, long SourceCopyId) : RunEventV2;
public sealed record DecisionRequestedEventV2(PendingDecisionV2 Decision) : RunEventV2;
public sealed record StatusChangedEventV2(string StatusId, Actor Target, int Charges, int Duration, int Amount) : RunEventV2;
public sealed record MoneyChangedEventV2(int Delta, int Total, string Cause) : RunEventV2;
public sealed record LivesChangedEventV2(int Delta, int Total, string Cause) : RunEventV2;
public sealed record ScoreChangedEventV2(int Delta, int Total) : RunEventV2;
public sealed record NodeChangedEventV2(string NodeId, NodeVisitState State) : RunEventV2;
public sealed record EncounterEndedEventV2(EncounterOutcomeV2 Outcome, string EnemyId) : RunEventV2;
public sealed record IgnitionEventV2(long CopyId, string DefinitionId, int ChainDepth, Actor Source) : RunEventV2;
public sealed record ToastEventV2(string MessageKey, bool IsError = false) : RunEventV2;

public sealed record ActionResultV2(
    IReadOnlyList<RunEventV2> Events,
    RunSnapshotV2 Snapshot,
    PendingDecisionV2? PendingDecision);
