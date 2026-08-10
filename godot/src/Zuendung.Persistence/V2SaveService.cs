using System.Text.Json;
using System.Text.Json.Serialization;
using Zuendung.Domain.V2;

namespace Zuendung.Persistence;

/// <summary>Durable storage for a V2 run.  The on-disk envelope deliberately has its own schema version.</summary>
public sealed class V2SaveService
{
    internal static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public void Save(string path, RunSessionV2 session)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        ArgumentNullException.ThrowIfNull(session);
        AtomicFile.Write(path, JsonSerializer.SerializeToUtf8Bytes(new RunSaveDocumentV2 { Run = session.Snapshot() }, Json));
    }

    public V2SaveLoadResult Load(string path, RunCatalogV2? catalog = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        var primary = Path.GetFullPath(path);
        if (TryLoad(primary, catalog, out var run, out var error)) return V2SaveLoadResult.Success(run!, false);
        if (TryLoad(primary + ".bak", catalog, out run, out var backupError)) return V2SaveLoadResult.Success(run!, true);
        return V2SaveLoadResult.Failure($"Unable to load primary '{primary}': {error}; backup '{primary}.bak': {backupError}.");
    }

    public RunSessionV2 LoadOrThrow(string path, RunCatalogV2? catalog = null)
    {
        var result = Load(path, catalog);
        return result.Session ?? throw new InvalidDataException(result.Error);
    }

    private static bool TryLoad(string path, RunCatalogV2? catalog, out RunSessionV2? run, out string error)
    {
        run = null;
        try
        {
            if (!File.Exists(path)) throw new FileNotFoundException("Save file does not exist.", path);
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var document = JsonSerializer.Deserialize<RunSaveDocumentV2>(stream, Json) ?? throw new InvalidDataException("Save document is empty.");
            if (document.SchemaVersion != RunSaveDocumentV2.CurrentSchemaVersion) throw new InvalidDataException($"Unsupported V2 run save schema {document.SchemaVersion}.");
            var snapshot = document.Run ?? throw new InvalidDataException("Run snapshot is missing.");
            ValidateEnums(snapshot);
            run = RunSessionV2.Restore(snapshot, catalog);
            error = string.Empty;
            return true;
        }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidDataException or ArgumentException or NullReferenceException or KeyNotFoundException)
        { error = ex.Message; return false; }
    }

    private static void ValidateEnums(RunSnapshotV2 s)
    {
        Valid(s.Phase, nameof(s.Phase)); Valid(s.Mode, nameof(s.Mode));
        foreach (var node in s.Map?.Nodes ?? throw new InvalidDataException("Map is missing.")) { Valid(node.Type, "Map.Node.Type"); Valid(node.VisitState, "Map.Node.VisitState"); }
        if (s.Encounter is { } e)
        {
            Valid(e.Kind, "Encounter.Kind"); Valid(e.ActiveActor, "Encounter.ActiveActor"); Valid(e.Outcome, "Encounter.Outcome"); Valid(e.ResolutionPhase, "Encounter.ResolutionPhase");
            foreach (var copy in e.Copies ?? throw new InvalidDataException("Encounter copies are missing.")) { Valid(copy.Owner, "Copy.Owner"); Valid(copy.PersistenceScope, "Copy.PersistenceScope"); }
            if (e.PendingDecision is { } decision) { Valid(decision.Kind, "Decision.Kind"); Valid(decision.Actor, "Decision.Actor"); }
        }
        foreach (var copy in s.PlayerCollection ?? throw new InvalidDataException("Player collection is missing.")) { Valid(copy.Owner, "Copy.Owner"); Valid(copy.PersistenceScope, "Copy.PersistenceScope"); }
    }
    private static void Valid<T>(T value, string name) where T : struct, Enum
    { if (!Enum.IsDefined(value)) throw new InvalidDataException($"Invalid {name}: {value}."); }
}

public sealed class RunSaveDocumentV2
{
    public const int CurrentSchemaVersion = 2;
    public int SchemaVersion { get; init; } = CurrentSchemaVersion;
    public RunSnapshotV2? Run { get; init; }
}

public sealed record V2SaveLoadResult(RunSessionV2? Session, bool RecoveredFromBackup, string? Error)
{
    public bool IsSuccess => Session is not null;
    public static V2SaveLoadResult Success(RunSessionV2 session, bool recoveredFromBackup) => new(session, recoveredFromBackup, null);
    public static V2SaveLoadResult Failure(string error) => new(null, false, error);
}
