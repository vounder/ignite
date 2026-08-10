using Godot;

namespace Zuendung.Game.Content;

[GlobalClass]
public partial class EnemyDefinitionResource : Resource
{
    [Export] public string Id { get; set; } = "croupier.ember";
    [Export] public string DisplayName { get; set; } = "Der Croupier";
    [Export(PropertyHint.Range, "0.05,2.0,0.05")] public float ThinkDelaySeconds { get; set; } = 0.45f;
    [Export] public Color AccentColor { get; set; } = new(0.94f, 0.31f, 0.13f);
}
