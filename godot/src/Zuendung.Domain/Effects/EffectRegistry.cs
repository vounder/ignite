namespace Zuendung.Domain;

public interface IEffectResolver
{
    EffectKind Kind { get; }
    void Resolve(EffectDefinition definition, EffectContext context);
}

public sealed class EffectContext
{
    private readonly GameSession _session;
    private readonly List<DomainEvent> _events;

    internal EffectContext(GameSession session, Actor source, List<DomainEvent> events)
    {
        _session = session;
        Source = source;
        _events = events;
    }

    public Actor Source { get; }
    public Actor Target => Source == Actor.Player ? Actor.Opponent : Actor.Player;
    public void DrawTarget(int count) => _session.DrawCardsForEffect(Target, count, _events);
    public void SkipTarget(int count) => _session.SkipForEffect(Target, count, _events);
}

public sealed class EffectRegistry
{
    private readonly IReadOnlyDictionary<EffectKind, IEffectResolver> _resolvers;

    public EffectRegistry(IEnumerable<IEffectResolver> resolvers)
    {
        var materialized = resolvers.ToArray();
        var duplicate = materialized.GroupBy(resolver => resolver.Kind).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null) throw new InvalidOperationException($"Duplicate resolver: {duplicate.Key}");
        _resolvers = materialized.ToDictionary(resolver => resolver.Kind);
        foreach (var kind in Enum.GetValues<EffectKind>())
            if (!_resolvers.ContainsKey(kind)) throw new InvalidOperationException($"Missing resolver: {kind}");
    }

    public void Resolve(EffectDefinition definition, EffectContext context) =>
        _resolvers[definition.Kind].Resolve(definition, context);

    public static EffectRegistry CreateDefault() => new IEffectResolver[]
    {
        new DrawCardsEffectResolver(),
        new SkipTurnEffectResolver()
    }.ToRegistry();
}

internal static class EffectRegistryExtensions
{
    internal static EffectRegistry ToRegistry(this IEnumerable<IEffectResolver> resolvers) => new(resolvers);
}

public sealed class DrawCardsEffectResolver : IEffectResolver
{
    public EffectKind Kind => EffectKind.DrawCards;
    public void Resolve(EffectDefinition definition, EffectContext context) => context.DrawTarget(definition.Amount);
}

public sealed class SkipTurnEffectResolver : IEffectResolver
{
    public EffectKind Kind => EffectKind.SkipTurn;
    public void Resolve(EffectDefinition definition, EffectContext context) => context.SkipTarget(definition.Amount);
}
