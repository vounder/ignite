using System.Text.Json;

namespace Zuendung.Game.App;

public sealed class GamePreferences
{
    public int SchemaVersion { get; set; } = 2;
    public float AnimationSpeed { get; set; } = 1f;
    public float MusicVolume { get; set; } = 0.55f;
    public float SfxVolume { get; set; } = 0.75f;
    public bool Fullscreen { get; set; }

    public static GamePreferences Load(string path)
    {
        try
        {
            if (!File.Exists(path)) return new GamePreferences();
            var value = JsonSerializer.Deserialize<GamePreferences>(File.ReadAllText(path)) ?? new GamePreferences();
            // Version 1 shipped with ×2 as the implicit default. Migrate that
            // overly fast value once; deliberately chosen slower values remain.
            if (value.SchemaVersion < 2 && value.AnimationSpeed >= 1.5f) value.AnimationSpeed = 1f;
            value.SchemaVersion = 2;
            value.AnimationSpeed = Math.Clamp(value.AnimationSpeed, 0.5f, 2f);
            value.MusicVolume = Math.Clamp(value.MusicVolume, 0f, 1f);
            value.SfxVolume = Math.Clamp(value.SfxVolume, 0f, 1f);
            return value;
        }
        catch (Exception)
        {
            return new GamePreferences();
        }
    }

    public void Save(string path)
    {
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
        var temporary = path + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporary, path, true);
    }
}
