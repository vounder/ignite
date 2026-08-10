namespace Zuendung.Domain.V2;

public sealed partial class RunSessionV2
{
    private void ChooseCardReward(string? definitionId, List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.CardReward || _reward is null) throw new DomainRuleException("No card reward is available.");
        if (string.IsNullOrWhiteSpace(definitionId))
        {
            var amount = HasTrinket("trinket.ledger") ? 4 : _reward.SkipCardMoney;
            if (amount > 0) { Money += amount; events.Add(new MoneyChangedEventV2(amount, Money, "skip-card-reward")); }
        }
        else
        {
            if (!_reward.CardDefinitionIds.Contains(definitionId, StringComparer.Ordinal)) throw new DomainRuleException("That card is not in the reward.");
            var copy = CreatePersistentCopy(definitionId);
            _playerCollection.Add(copy);
            events.Add(new CardMovedEventV2(copy.CopyId, copy.DefinitionId, "reward", "collection", "reward"));
        }
        if (_reward.IncludesTrinketReward)
        {
            Phase = RunPhaseV2.TrinketReward;
            events.Add(new RunPhaseChangedEventV2(Phase));
        }
        else CompleteCurrentNode(events);
    }

    private void ChooseTrinketReward(string? trinketId, string? replaceTrinketId, List<RunEventV2> events)
    {
        if (Phase != RunPhaseV2.TrinketReward || _reward is null) throw new DomainRuleException("No trinket reward is available.");
        if (string.IsNullOrWhiteSpace(trinketId))
        {
            if (_reward.SkipTrinketMoney > 0)
            {
                Money += _reward.SkipTrinketMoney;
                events.Add(new MoneyChangedEventV2(_reward.SkipTrinketMoney, Money, "skip-trinket-reward"));
            }
        }
        else
        {
            if (!_reward.TrinketIds.Contains(trinketId, StringComparer.Ordinal)) throw new DomainRuleException("That trinket is not in the reward.");
            AddTrinket(trinketId, replaceTrinketId);
            events.Add(new ToastEventV2($"trinket.received.{trinketId}"));
        }
        CompleteCurrentNode(events);
    }

    private void AddTrinket(string trinketId, string? replaceTrinketId)
    {
        _ = _catalog.GetTrinket(trinketId);
        if (_trinkets.Contains(trinketId, StringComparer.Ordinal)) throw new DomainRuleException("That trinket is already owned.");
        if (_trinkets.Count >= MaximumTrinkets)
        {
            if (string.IsNullOrWhiteSpace(replaceTrinketId) || !_trinkets.Remove(replaceTrinketId))
                throw new DomainRuleException("Choose an owned trinket to replace.");
        }
        else if (!string.IsNullOrWhiteSpace(replaceTrinketId))
        {
            if (!_trinkets.Remove(replaceTrinketId)) throw new DomainRuleException("The replacement trinket is not owned.");
        }
        _trinkets.Add(trinketId);
    }

    private void FinishRun(List<RunEventV2> events)
    {
        if (Phase is not (RunPhaseV2.Victory or RunPhaseV2.Defeat)) throw new DomainRuleException("The run has not ended.");
        events.Add(new ToastEventV2(Phase == RunPhaseV2.Victory ? "run.finished.victory" : "run.finished.defeat"));
    }
}
