using Zuendung.Domain;
using Zuendung.Domain.V2;

namespace Zuendung.Persistence;

/// <summary>Imports a readable V1 file into a fresh, valid V2 run. V1 combat state has no V2 equivalent and is intentionally not copied.</summary>
public sealed class V1SaveImporter
{
    public V1ImportResult Import(string path, ulong seed, string starterDeckId = "starter.classic", RunCatalogV2? catalog = null)
    {
        var legacy = new SaveService().Load(path);
        if (!legacy.IsSuccess) return V1ImportResult.Failure(legacy.Error!);
        return Import(legacy.Session!, seed, starterDeckId, catalog);
    }

    public V1ImportResult Import(GameSession legacy, ulong seed, string starterDeckId = "starter.classic", RunCatalogV2? catalog = null)
    {
        ArgumentNullException.ThrowIfNull(legacy);
        try { return V1ImportResult.Success(RunSessionV2.CreateNew(seed, starterDeckId, catalog)); }
        catch (Exception ex) when (ex is InvalidDataException or ArgumentException or KeyNotFoundException) { return V1ImportResult.Failure(ex.Message); }
    }
}

public sealed record V1ImportResult(RunSessionV2? Session, string? Error)
{ public bool IsSuccess => Session is not null; public static V1ImportResult Success(RunSessionV2 session) => new(session, null); public static V1ImportResult Failure(string error) => new(null, error); }
