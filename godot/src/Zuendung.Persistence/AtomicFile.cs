namespace Zuendung.Persistence;

internal static class AtomicFile
{
    public static void Write(string path, byte[] bytes)
    {
        var primary = Path.GetFullPath(path);
        var directory = Path.GetDirectoryName(primary) ?? throw new InvalidOperationException("Save path has no directory.");
        Directory.CreateDirectory(directory);
        var temporary = Path.Combine(directory, $".{Path.GetFileName(primary)}.{Guid.NewGuid():N}.tmp");
        try
        {
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            { stream.Write(bytes); stream.Flush(flushToDisk: true); }
            if (!File.Exists(primary)) File.Move(temporary, primary);
            else Replace(primary, temporary, primary + ".bak");
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }

    private static void Replace(string primary, string temporary, string backup)
    {
        try { File.Replace(temporary, primary, backup, ignoreMetadataErrors: true); }
        catch (PlatformNotSupportedException) { PortableReplace(primary, temporary, backup); }
        catch (IOException) { PortableReplace(primary, temporary, backup); }
    }
    private static void PortableReplace(string primary, string temporary, string backup)
    { File.Copy(primary, backup, overwrite: true); File.Move(temporary, primary, overwrite: true); }
}
