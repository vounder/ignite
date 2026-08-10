namespace Zuendung.Domain.Random;

/// <summary>A small, stable PRNG whose complete future-driving state is serializable.</summary>
public sealed class Pcg32
{
    private ulong _state;
    private readonly ulong _increment;

    public const string AlgorithmId = "pcg32-v1";
    public ulong State => _state;
    public ulong Stream => _increment;

    public Pcg32(ulong seed, ulong sequence = 54)
    {
        _increment = (sequence << 1) | 1;
        _state = 0;
        NextUInt();
        _state += seed;
        NextUInt();
    }

    private Pcg32(ulong state, ulong increment, bool raw)
    {
        _state = state;
        _increment = increment | 1;
    }

    public static Pcg32 Restore(ulong state, ulong stream) => new(state, stream, true);

    public uint NextUInt()
    {
        var oldState = _state;
        _state = unchecked(oldState * 6364136223846793005UL + _increment);
        var xorShifted = (uint)(((oldState >> 18) ^ oldState) >> 27);
        var rotation = (int)(oldState >> 59);
        return (xorShifted >> rotation) | (xorShifted << ((-rotation) & 31));
    }

    public int NextInt(int exclusiveMaximum)
    {
        if (exclusiveMaximum <= 0) throw new ArgumentOutOfRangeException(nameof(exclusiveMaximum));
        var bound = (uint)exclusiveMaximum;
        var threshold = unchecked((uint)(0 - bound)) % bound;
        while (true)
        {
            var value = NextUInt();
            if (value >= threshold) return (int)(value % bound);
        }
    }

    public void Shuffle<T>(IList<T> values)
    {
        for (var i = values.Count - 1; i > 0; i--)
        {
            var j = NextInt(i + 1);
            (values[i], values[j]) = (values[j], values[i]);
        }
    }
}
