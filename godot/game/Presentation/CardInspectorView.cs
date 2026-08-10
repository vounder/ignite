using Godot;
using Zuendung.Domain;
using Zuendung.Domain.V2;

namespace Zuendung.Game.Presentation;

public partial class CardInspectorView : PanelContainer
{
    private readonly Label _title = new();
    private readonly Label _kind = new();
    private readonly Label _rules = new();
    private readonly Label _affected = new();
    private readonly CardViewV2 _art = new();
    private ulong _sourceId;

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        CustomMinimumSize = new Vector2(200, 120);
        Size = CustomMinimumSize;
        var panel = new StyleBoxFlat
        {
            BgColor = Color.Color8(22, 42, 33, 248),
            BorderColor = Color.Color8(205, 157, 61),
            BorderWidthLeft = 2, BorderWidthRight = 2, BorderWidthTop = 2, BorderWidthBottom = 2,
            CornerRadiusTopLeft = 5, CornerRadiusTopRight = 5, CornerRadiusBottomLeft = 5, CornerRadiusBottomRight = 5,
            ShadowColor = new Color(0, 0, 0, 0.72f), ShadowSize = 5
        };
        AddThemeStyleboxOverride("panel", panel);

        var margin = new MarginContainer();
        foreach (var side in new[] { "margin_left", "margin_right", "margin_top", "margin_bottom" }) margin.AddThemeConstantOverride(side, 6);
        AddChild(margin);
        var row = new HBoxContainer(); row.AddThemeConstantOverride("separation", 8); margin.AddChild(row);
        _art.CustomMinimumSize = new Vector2(48, 68);
        _art.Size = new Vector2(48, 68);
        _art.Disabled = true;
        _art.MouseFilter = MouseFilterEnum.Ignore;
        row.AddChild(_art);

        var copy = new VBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill };
        copy.AddThemeConstantOverride("separation", 2); row.AddChild(copy);
        ConfigureLabel(_title, 8, Color.Color8(242, 216, 157));
        ConfigureLabel(_kind, 5, Color.Color8(231, 79, 25));
        ConfigureLabel(_rules, 6, Color.Color8(240, 226, 190));
        _rules.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        _rules.SizeFlagsVertical = SizeFlags.ExpandFill;
        ConfigureLabel(_affected, 5, Color.Color8(205, 157, 61));
        _affected.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        copy.AddChild(_title); copy.AddChild(_kind); copy.AddChild(_rules); copy.AddChild(_affected);
        Hide();
    }

    public void ShowCard(CardDefinitionV2 definition, Vector2 sourcePosition, ulong sourceId)
    {
        _sourceId = sourceId;
        _title.Text = definition.DisplayName.ToUpperInvariant();
        _kind.Text = definition.IsSpecial ? $"SPEZIAL · {RarityName(definition.Rarity)}" : "NORMALE SPIELKARTE";
        _rules.Text = InspectorRules(definition);
        _affected.Text = Affected(definition.Id);
        _art.Configure(new CardCopyV2(-999, definition.Id, CardOwnerV2.Neutral, PersistenceScopeV2.Neutral), definition);
        var horizontal = sourcePosition.X < 200 ? 220 : sourcePosition.X < 420 ? 8 : 220;
        var desired = new Vector2(horizontal, sourcePosition.Y > 180 ? 44 : 174);
        Position = new Vector2(Mathf.Clamp(desired.X, 8, 432), Mathf.Clamp(desired.Y, 42, 232));
        Show();
        MoveToFront();
    }

    public void HideCard(ulong sourceId)
    {
        if (_sourceId == sourceId) Hide();
    }

    public void Clear()
    {
        _sourceId = 0;
        Hide();
    }

    private static void ConfigureLabel(Label label, int size, Color color)
    {
        label.AddThemeFontSizeOverride("font_size", size);
        label.AddThemeColorOverride("font_color", color);
        label.MouseFilter = MouseFilterEnum.Ignore;
    }

    private static string RarityName(RarityV2 rarity) => rarity switch
    {
        RarityV2.Common => "GEWÖHNLICH", RarityV2.Uncommon => "UNGEWÖHNLICH",
        RarityV2.Rare => "SELTEN", _ => "LEGENDÄR"
    };

    private static string Affected(string id) => id switch
    {
        V2ContentIds.Stillstand => "BETROFFEN: NÄCHSTER GEGNERZUG",
        V2ContentIds.Addieren => "BETROFFEN: GEGNERHAND",
        V2ContentIds.Spion => "BETROFFEN: GEGNERHAND",
        V2ContentIds.Fluch => "BETROFFEN: GEGNERISCHES ZIEHEN",
        V2ContentIds.Hodl => "BETROFFEN: DEINE BANK",
        V2ContentIds.Zytokinese => "BETROFFEN: DIESE KARTE + DEINE HAND",
        V2ContentIds.Tausch => "BETROFFEN: BEIDE HÄNDE",
        V2ContentIds.Bonusgeld => "BETROFFEN: BANK-MULTIPLIKATOR",
        V2ContentIds.Opfer => "BETROFFEN: 2 HANDKARTEN + BANK",
        V2ContentIds.Zocken => "BETROFFEN: ZIEHSTAPEL + TISCH",
        V2ContentIds.Zytokinese2 => "BETROFFEN: DIESE KARTE + DEINE HAND",
        _ => "SPIELBAR AUF: GLEICHE FARBE ODER GLEICHER WERT"
    };

    private static string InspectorRules(CardDefinitionV2 definition)
    {
        if (definition.IsSpecial) return CardViewV2.Rules(definition.Id);
        return definition.Rank switch
        {
            Rank.Seven => "Passt auf Farbe oder Wert. Beim Ausspielen zieht der Gegner 2 Karten und setzt einmal aus.",
            Rank.Eight => "Passt auf Farbe oder Wert. Die Acht hat in Zündung keine zusätzliche Sonderwirkung.",
            _ => "Passt auf dieselbe Farbe oder denselben Wert. Diese Karte hat keine zusätzliche Sonderwirkung."
        };
    }

    private static Texture2D? LoadTexture(CardDefinitionV2 definition)
    {
        string path;
        if (definition.IsSpecial) path = $"res://Assets/Cards/Special/{definition.Id[8..].Replace('-', '_')}_v2.png";
        else
        {
            var rank = definition.Rank switch
            {
                Rank.Jack => "J", Rank.Queen => "Q", Rank.King => "K", Rank.Ace => "A",
                _ => ((int)definition.Rank!.Value).ToString("00")
            };
            path = $"res://Assets/Cards/Kenney/Small/card_{definition.Suit!.Value.ToString().ToLowerInvariant()}_{rank}.png";
        }
        return ResourceLoader.Exists(path) ? GD.Load<Texture2D>(path) : null;
    }
}
