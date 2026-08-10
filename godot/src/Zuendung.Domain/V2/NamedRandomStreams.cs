using Zuendung.Domain.Random;

namespace Zuendung.Domain.V2;

public sealed class NamedRandomStreams
{
    public const string AlgorithmId = "pcg32-named-fnv1a-v1";
    public static readonly string[] RequiredNames =
    [
        "map", "player-deck", "enemy-deck", "encounter", "ai", "effects", "shop", "reward"
    ];

    private readonly Dictionary<string, Pcg32> _streams;

    public NamedRandomStreams(ulong rootSeed)
    {
        _streams = RequiredNames.ToDictionary(
            name => name,
            name => new Pcg32(Mix(rootSeed ^ StableHash(name)), StableHash(name + ".sequence")),
            StringComparer.Ordinal);
    }

    private NamedRandomStreams(Dictionary<string, Pcg32> streams) => _streams = streams;

    public Pcg32 this[string name] => _streams.TryGetValue(name, out var stream)
        ? stream
        : throw new KeyNotFoundException($"Unknown random stream: {name}");

    public RandomStreamsSnapshotV2 Snapshot() => new(
        AlgorithmId,
        RequiredNames.Select(name => new NamedRandomStreamSnapshotV2(name, this[name].State, this[name].Stream)).ToArray());

    public static NamedRandomStreams Restore(RandomStreamsSnapshotV2 snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        if (!string.Equals(snapshot.AlgorithmId, AlgorithmId, StringComparison.Ordinal))
            throw new InvalidDataException($"Unsupported random profile: {snapshot.AlgorithmId}");
        var duplicate = snapshot.Streams.GroupBy(item => item.Name, StringComparer.Ordinal).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null) throw new InvalidDataException($"Duplicate random stream: {duplicate.Key}");
        var documents = snapshot.Streams.ToDictionary(item => item.Name, StringComparer.Ordinal);
        var streams = new Dictionary<string, Pcg32>(StringComparer.Ordinal);
        foreach (var name in RequiredNames)
        {
            if (!documents.TryGetValue(name, out var document)) throw new InvalidDataException($"Missing random stream: {name}");
            if ((document.Stream & 1UL) == 0) throw new InvalidDataException($"Random stream increment must be odd: {name}");
            streams[name] = Pcg32.Restore(document.State, document.Stream);
        }
        return new NamedRandomStreams(streams);
    }

    public static ulong StableHash(string value)
    {
        const ulong offset = 14695981039346656037UL;
        const ulong prime = 1099511628211UL;
        var hash = offset;
        foreach (var character in value)
        {
            hash ^= (byte)(character & 0xff);
            hash = unchecked(hash * prime);
            hash ^= (byte)(character >> 8);
            hash = unchecked(hash * prime);
        }
        return hash;
    }

    private static ulong Mix(ulong value)
    {
        value += 0x9E3779B97F4A7C15UL;
        value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9UL;
        value = (value ^ (value >> 27)) * 0x94D049BB133111EBUL;
        return value ^ (value >> 31);
    }
}
