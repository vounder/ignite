using Godot;
using Godot.Collections;

namespace Zuendung.Game.Content;

[GlobalClass]
public partial class StandardCardSetResource : Resource
{
    [Export] public string CatalogVersion { get; set; } = "standard-1";
    [Export] public Array<int> RankPrices { get; set; } = [];
    [Export(PropertyHint.Range, "1,10,1")] public int SevenDrawCount { get; set; } = 2;
    [Export(PropertyHint.Range, "1,5,1")] public int SevenSkipCount { get; set; } = 1;
    [Export(PropertyHint.Range, "1,5,1")] public int EightSkipCount { get; set; } = 1;
}
