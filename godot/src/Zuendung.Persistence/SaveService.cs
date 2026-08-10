using System.Text.Json;
using Zuendung.Domain;

namespace Zuendung.Persistence;

public sealed class SaveService
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public void Save(string path, GameSession session)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path); ArgumentNullException.ThrowIfNull(session);
        var fullPath = Path.GetFullPath(path);
        var directory = Path.GetDirectoryName(fullPath) ?? throw new InvalidOperationException("Save path has no directory.");
        Directory.CreateDirectory(directory);
        var temporary = Path.Combine(directory, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.tmp");
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(SaveDocumentMapper.ToDocument(session.Snapshot()), Json);
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            {
                stream.Write(bytes);
                stream.Flush(flushToDisk: true);
            }
            if (!File.Exists(fullPath)) File.Move(temporary, fullPath);
            else Replace(fullPath, temporary, fullPath + ".bak");
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    public SaveLoadResult Load(string path, GameCatalog? catalog = null, EffectRegistry? effects = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        var primary = Path.GetFullPath(path); var backup = primary + ".bak";
        var primaryFailure = TryLoad(primary, catalog, effects, out var session, out var error);
        if (session is not null) return SaveLoadResult.Success(session, recoveredFromBackup: false);
        var backupFailure = TryLoad(backup, catalog, effects, out session, out var backupError);
        if (session is not null) return SaveLoadResult.Success(session, recoveredFromBackup: true);
        return SaveLoadResult.Failure($"Unable to load primary '{primary}': {error}; backup '{backup}': {backupError}.");
    }

    public GameSession LoadOrThrow(string path, GameCatalog? catalog = null, EffectRegistry? effects = null)
    {
        var result = Load(path, catalog, effects);
        return result.Session ?? throw new InvalidDataException(result.Error);
    }

    private static bool TryLoad(string path, GameCatalog? catalog, EffectRegistry? effects, out GameSession? session, out string error)
    {
        session = null;
        try
        {
            if (!File.Exists(path)) throw new FileNotFoundException("Save file does not exist.", path);
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var document = JsonSerializer.Deserialize<SaveDocumentV1>(stream, Json) ?? throw new InvalidDataException("Save document is empty.");
            session = GameSession.Restore(SaveDocumentMapper.ToSnapshot(document), catalog, effects);
            error = string.Empty; return true;
        }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidDataException or ArgumentException or NullReferenceException)
        { error = ex.Message; return false; }
    }

    private static void Replace(string primary, string temporary, string backup)
    {
        try { File.Replace(temporary, primary, backup, ignoreMetadataErrors: true); }
        catch (PlatformNotSupportedException) { PortableReplace(primary, temporary, backup); }
        catch (IOException) { PortableReplace(primary, temporary, backup); }
    }
    private static void PortableReplace(string primary, string temporary, string backup)
    {
        // Keep a complete last-known-good copy before replacing the primary.
        File.Copy(primary, backup, overwrite: true);
        File.Move(temporary, primary, overwrite: true);
    }
}

public sealed record SaveLoadResult(GameSession? Session, bool RecoveredFromBackup, string? Error)
{
    public bool IsSuccess => Session is not null;
    public static SaveLoadResult Success(GameSession session, bool recoveredFromBackup) => new(session, recoveredFromBackup, null);
    public static SaveLoadResult Failure(string error) => new(null, false, error);
}
