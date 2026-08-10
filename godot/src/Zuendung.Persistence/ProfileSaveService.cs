using System.Text.Json;
using Zuendung.Domain.V2;

namespace Zuendung.Persistence;

public sealed class ProfileSaveService
{
    public void Save(string path, ProfileSnapshotV1 profile)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path); ArgumentNullException.ThrowIfNull(profile);
        Validate(profile);
        AtomicFile.Write(path, JsonSerializer.SerializeToUtf8Bytes(new ProfileSaveDocumentV1 { Profile = profile }, V2SaveService.Json));
    }

    public ProfileLoadResult Load(string path)
    {
        var primary = Path.GetFullPath(path);
        if (TryLoad(primary, out var profile, out var error)) return ProfileLoadResult.Success(profile!, false);
        if (TryLoad(primary + ".bak", out profile, out var backupError)) return ProfileLoadResult.Success(profile!, true);
        return ProfileLoadResult.Failure($"Unable to load primary '{primary}': {error}; backup '{primary}.bak': {backupError}.");
    }

    /// <summary>Applies a completed run once.  Unlocks are accepted only from explicit result options.</summary>
    public ProfileSnapshotV1 ApplyRunResult(ProfileSnapshotV1 profile, ProfileRunResultV1 result)
    {
        ArgumentNullException.ThrowIfNull(profile); ArgumentNullException.ThrowIfNull(result); Validate(profile);
        if (string.IsNullOrWhiteSpace(result.RunId)) throw new InvalidDataException("Run id is required.");
        if (result.Score < 0 || result.EndlessCycle < 0) throw new InvalidDataException("Negative run result statistic.");
        if (profile.AppliedRunIds.Contains(result.RunId, StringComparer.Ordinal)) return profile;
        var options = result.UnlockOptions ?? ProfileUnlockOptionsV1.None;
        return new ProfileSnapshotV1(1,
            Union(profile.UnlockedStarterDeckIds, options.StarterDeckIds), Union(profile.UnlockedTrinketIds, options.TrinketIds), Union(profile.UnlockedCosmeticIds, options.CosmeticIds),
            profile.AppliedRunIds.Append(result.RunId).ToArray(), Math.Max(profile.BestScore, result.Score), Math.Max(profile.BestEndlessCycle, result.EndlessCycle),
            profile.RunsCompleted + (result.Completed ? 1 : 0));
    }

    private static bool TryLoad(string path, out ProfileSnapshotV1? profile, out string error)
    {
        profile = null;
        try
        {
            if (!File.Exists(path)) throw new FileNotFoundException("Profile file does not exist.", path);
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var document = JsonSerializer.Deserialize<ProfileSaveDocumentV1>(stream, V2SaveService.Json) ?? throw new InvalidDataException("Profile document is empty.");
            if (document.SchemaVersion != 1) throw new InvalidDataException($"Unsupported profile schema {document.SchemaVersion}.");
            profile = document.Profile ?? throw new InvalidDataException("Profile snapshot is missing."); Validate(profile);
            error = string.Empty;
            return true;
        }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidDataException or ArgumentException or NullReferenceException)
        { error = ex.Message; return false; }
    }
    private static IReadOnlyList<string> Union(IReadOnlyList<string> existing, IReadOnlyList<string> additions) => existing.Concat(additions).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
    private static void Validate(ProfileSnapshotV1 profile)
    {
        if (profile.SchemaVersion != 1) throw new InvalidDataException($"Unsupported profile schema {profile.SchemaVersion}.");
        if (profile.UnlockedStarterDeckIds is null || profile.UnlockedTrinketIds is null || profile.UnlockedCosmeticIds is null || profile.AppliedRunIds is null) throw new InvalidDataException("Profile collections are required.");
        if (profile.BestScore < 0 || profile.BestEndlessCycle < 0 || profile.RunsCompleted < 0) throw new InvalidDataException("Negative profile statistic.");
        foreach (var ids in new[] { profile.UnlockedStarterDeckIds, profile.UnlockedTrinketIds, profile.UnlockedCosmeticIds, profile.AppliedRunIds })
            if (ids.Any(string.IsNullOrWhiteSpace) || ids.Distinct(StringComparer.Ordinal).Count() != ids.Count) throw new InvalidDataException("Profile ids must be non-empty and unique.");
    }
}

public sealed class ProfileSaveDocumentV1 { public int SchemaVersion { get; init; } = 1; public ProfileSnapshotV1? Profile { get; init; } }
public sealed record ProfileUnlockOptionsV1(IReadOnlyList<string> StarterDeckIds, IReadOnlyList<string> TrinketIds, IReadOnlyList<string> CosmeticIds)
{ public static ProfileUnlockOptionsV1 None { get; } = new([], [], []); }
public sealed record ProfileRunResultV1(string RunId, int Score, int EndlessCycle, bool Completed, ProfileUnlockOptionsV1? UnlockOptions = null);
public sealed record ProfileLoadResult(ProfileSnapshotV1? Profile, bool RecoveredFromBackup, string? Error)
{ public bool IsSuccess => Profile is not null; public static ProfileLoadResult Success(ProfileSnapshotV1 profile, bool recovered) => new(profile, recovered, null); public static ProfileLoadResult Failure(string error) => new(null, false, error); }
