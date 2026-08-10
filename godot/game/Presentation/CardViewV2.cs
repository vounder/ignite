using Godot;
using Zuendung.Domain;
using Zuendung.Domain.V2;

namespace Zuendung.Game.Presentation;

public partial class CardViewV2 : Button
{
    private static readonly Color Ivory = Color.Color8(240, 226, 190);
    private static readonly Color Ink = Color.Color8(28, 25, 22);
    private static readonly Color Burgundy = Color.Color8(91, 21, 29);
    private static readonly Color Brass = Color.Color8(194, 147, 57);
    private CardCopyV2? _copy;
    private CardDefinitionV2? _definition;
    private Texture2D? _texture;
    private Texture2D? _frame;
    private Texture2D? _back;
    private TextureRect? _specialIcon;
    private bool _faceDown;
    private bool _hovered;
    private float _lift;

    public float RestRotation { get; set; }
    public event Action<CardDefinitionV2, Vector2, ulong>? InspectRequested;
    public event Action<ulong>? InspectEnded;

    public long CopyId => _copy?.CopyId ?? 0;

    public override void _Ready()
    {
        Flat = true;
        foreach (var style in new[] { "normal", "hover", "pressed", "disabled", "focus" })
            AddThemeStyleboxOverride(style, new StyleBoxEmpty());
        if (CustomMinimumSize == Vector2.Zero) CustomMinimumSize = new Vector2(64, 90);
        SizeFlagsHorizontal = SizeFlags.ShrinkCenter;
        SizeFlagsVertical = SizeFlags.ShrinkCenter;
        TextureFilter = TextureFilterEnum.Nearest;
        _frame = ResourceLoader.Exists("res://Assets/Cards/Standard/card_front_v2.png")
            ? GD.Load<Texture2D>("res://Assets/Cards/Standard/card_front_v2.png")
            : null;
        _back = ResourceLoader.Exists("res://Assets/Cards/Standard/card_back_v2.png")
            ? GD.Load<Texture2D>("res://Assets/Cards/Standard/card_back_v2.png")
            : null;
        PivotOffset = Size / 2f;
        MouseEntered += () =>
        {
            _hovered = true;
            if (!_faceDown && _definition is not null) InspectRequested?.Invoke(_definition, GlobalPosition + Size / 2f, GetInstanceId());
        };
        MouseExited += () => { _hovered = false; InspectEnded?.Invoke(GetInstanceId()); };
        TreeExiting += () => InspectEnded?.Invoke(GetInstanceId());
        RefreshSpecialIcon();
        SetProcess(true);
    }

    public void Configure(CardCopyV2 copy, CardDefinitionV2 definition, bool faceDown = false)
    {
        _copy = copy;
        _definition = definition;
        _faceDown = faceDown;
        TooltipText = faceDown ? "Verdeckte Karte" : string.Empty;
        _texture = faceDown || !definition.IsSpecial ? null : LoadTexture(definition);
        if (IsNodeReady()) RefreshSpecialIcon();
        QueueRedraw();
    }

    public override void _Process(double delta)
    {
        var target = (_hovered || HasFocus()) && !Disabled ? 1f : 0f;
        _lift = Mathf.Lerp(_lift, target, 1f - Mathf.Exp(-12f * (float)delta));
        PivotOffset = Size / 2f;
        Scale = Vector2.One * (1f + 0.12f * _lift);
        Rotation = Mathf.Lerp(RestRotation, 0f, _lift * 0.82f);
        ZIndex = _lift > 0.05f ? 20 : 0;
        QueueRedraw();
    }

    public override void _Draw()
    {
        var verticalLift = _lift * 5f;
        var rect = new Rect2(2, 2 - verticalLift, Size.X - 4, Size.Y - 5);
        DrawRect(new Rect2(rect.Position + new Vector2(3, 4), rect.Size), new Color(0, 0, 0, 0.54f));
        if (_faceDown)
        {
            if (_back is not null)
            {
                DrawCroppedCard(_back, rect);
                return;
            }
            DrawRect(rect, Color.Color8(76, 18, 27));
            DrawRect(rect.Grow(-2), Color.Color8(34, 83, 62));
            for (var x = 7; x < Size.X - 5; x += 6) DrawLine(new Vector2(x, 6), new Vector2(x - 12, Size.Y - 7), Brass, 1);
            DrawRect(rect, Brass, false, 2);
            DrawString(ThemeDB.FallbackFont, new Vector2(8, Size.Y / 2 + 4), "Z", HorizontalAlignment.Center, Size.X - 16, 14, Ivory);
            return;
        }
        if (_definition is null) return;
        if (!_definition.IsSpecial)
        {
            DrawCardFrame(rect);
            DrawStandardFace(rect, _definition);
            if (_definition.Effects.Count > 0) DrawRect(rect.Grow(-1), Brass, false, 2);
            return;
        }
        DrawCardFrame(rect);
        DrawRect(rect.Grow(-3), Burgundy, false, 1.5f);
        var title = ShortName(_definition.DisplayName);
        DrawString(ThemeDB.FallbackFont, new Vector2(5, 11), title, HorizontalAlignment.Center, Size.X - 10, 7, Burgundy);
        DrawString(ThemeDB.FallbackFont, new Vector2(5, Size.Y - 7), RuleGlyph(_definition.Id), HorizontalAlignment.Center, Size.X - 10, 7, Ink);
    }

    private static Texture2D? LoadTexture(CardDefinitionV2 definition)
    {
        string path;
        if (!definition.IsSpecial)
        {
            var rank = definition.Rank switch
            {
                Zuendung.Domain.Rank.Jack => "J", Zuendung.Domain.Rank.Queen => "Q", Zuendung.Domain.Rank.King => "K", Zuendung.Domain.Rank.Ace => "A",
                _ => ((int)definition.Rank!.Value).ToString("00")
            };
            path = $"res://Assets/Cards/Kenney/Small/card_{definition.Suit!.Value.ToString().ToLowerInvariant()}_{rank}.png";
        }
        else path = $"res://Assets/Cards/Special/{definition.Id[8..].Replace('-', '_')}_v2.png";
        return ResourceLoader.Exists(path) ? GD.Load<Texture2D>(path) : null;
    }

    private void RefreshSpecialIcon()
    {
        if (_specialIcon is not null && IsInstanceValid(_specialIcon)) _specialIcon.QueueFree();
        _specialIcon = null;
        if (_definition?.IsSpecial != true || _texture is null || _faceDown) return;
        _specialIcon = new TextureRect
        {
            Texture = _texture,
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCentered,
            MouseFilter = MouseFilterEnum.Ignore,
            TextureFilter = TextureFilterEnum.Nearest,
            ZIndex = 1
        };
        _specialIcon.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _specialIcon.OffsetLeft = 5; _specialIcon.OffsetTop = 12; _specialIcon.OffsetRight = -5; _specialIcon.OffsetBottom = -13;
        AddChild(_specialIcon);
    }

    private void DrawCardFrame(Rect2 rect)
    {
        if (_frame is null)
        {
            DrawRect(rect, Color.Color8(244, 231, 195));
            DrawRect(rect.Grow(-2), Brass, false, 2);
            return;
        }
        DrawCroppedCard(_frame, rect);
    }

    private void DrawCroppedCard(Texture2D texture, Rect2 rect)
    {
        var textureSize = texture.GetSize();
        var source = new Rect2(textureSize.X * 0.207f, textureSize.Y * 0.055f, textureSize.X * 0.586f, textureSize.Y * 0.89f);
        DrawTextureRectRegion(texture, rect, source);
    }

    private void DrawStandardFace(Rect2 rect, CardDefinitionV2 definition)
    {
        if (definition.Suit is null || definition.Rank is null) return;
        var red = definition.Suit is Suit.Hearts or Suit.Diamonds;
        var ink = red ? Color.Color8(146, 25, 34) : Color.Color8(31, 37, 34);
        var rank = RankGlyph(definition.Rank.Value);
        var suit = SuitGlyph(definition.Suit.Value);
        var font = GetThemeDefaultFont();
        var indexSize = Math.Max(7, Mathf.RoundToInt(rect.Size.X * 0.18f));
        var suitSize = Math.Max(8, Mathf.RoundToInt(rect.Size.X * 0.19f));
        var centerSize = Math.Max(16, Mathf.RoundToInt(rect.Size.X * 0.43f));
        DrawString(font, new Vector2(rect.Position.X + 7, rect.Position.Y + 15), rank, HorizontalAlignment.Left, rect.Size.X * 0.35f, indexSize, ink);
        DrawString(font, new Vector2(rect.Position.X + 7, rect.Position.Y + 28), suit, HorizontalAlignment.Left, rect.Size.X * 0.35f, suitSize, ink);
        DrawString(font, new Vector2(rect.Position.X + rect.Size.X * 0.24f, rect.Position.Y + rect.Size.Y * 0.64f), suit,
            HorizontalAlignment.Center, rect.Size.X * 0.52f, centerSize, ink);
        DrawString(font, new Vector2(rect.Position.X + rect.Size.X * 0.59f, rect.End.Y - 8), rank,
            HorizontalAlignment.Center, rect.Size.X * 0.28f, indexSize, ink);
    }

    private static string SuitGlyph(Suit suit) => suit switch
    {
        Suit.Hearts => "♥", Suit.Diamonds => "♦", Suit.Spades => "♠", _ => "♣"
    };

    private static string RankGlyph(Rank rank) => rank switch
    {
        Rank.Jack => "J", Rank.Queen => "Q", Rank.King => "K", Rank.Ace => "A", _ => ((int)rank).ToString()
    };

    private static string ShortName(string name) => name.Length <= 11 ? name.ToUpperInvariant() : name[..10].ToUpperInvariant();
    private static string RuleGlyph(string id) => id switch
    {
        V2ContentIds.Stillstand => "AUSSETZEN", V2ContentIds.Addieren => "+2 KARTEN", V2ContentIds.Spion => "HAND SEHEN",
        V2ContentIds.Fluch => "FLUCH 3", V2ContentIds.Hodl => "+6 SPÄTER", V2ContentIds.Zytokinese => "1 → 2",
        V2ContentIds.Tausch => "HANDTAUSCH", V2ContentIds.Bonusgeld => "GELD ×2", V2ContentIds.Opfer => "2 → 5 M",
        V2ContentIds.Zocken => "3 AUFDECKEN", V2ContentIds.Zytokinese2 => "1 → 2 SPEZ.", _ => ""
    };

    public static string Rules(string id) => id switch
    {
        V2ContentIds.Stillstand => "Der Gegner setzt seinen nächsten Zug aus.",
        V2ContentIds.Addieren => "Der Gegner zieht zwei Karten.",
        V2ContentIds.Spion => "Zeigt die Gegnerhand für zwei eigene Züge.",
        V2ContentIds.Fluch => "Die nächsten drei Ziehbefehle des Gegners ziehen je eine Karte mehr.",
        V2ContentIds.Hodl => "Bankt nach zwei eigenen Zügen 6 Mark für den Sieg.",
        V2ContentIds.Zytokinese => "Diese Karte verbrennt und erzeugt zwei Standardkarten.",
        V2ContentIds.Tausch => "Tauscht beide Hände; Karten kehren in den Stapel ihres Besitzers zurück.",
        V2ContentIds.Bonusgeld => "Verdoppelt das in diesem Kampf gebankte Geld.",
        V2ContentIds.Opfer => "Wähle zwei weitere Handkarten und banke 5 Mark.",
        V2ContentIds.Zocken => "Decke drei Karten auf, spiele eine passende und wirf den Rest ab.",
        V2ContentIds.Zytokinese2 => "Diese Karte verbrennt und erzeugt zwei Spezialkarten.",
        _ => "Standardkarte. Passt auf Farbe oder Wert. Sieben: +2 und Aussetzen. Acht: neutral."
    };
}
