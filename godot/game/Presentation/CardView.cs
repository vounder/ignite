using Godot;
using Zuendung.Domain;

namespace Zuendung.Game.Presentation;

public partial class CardView : Button
{
    private CardDefinition? _definition;
    private bool _faceDown;
    private bool _hovered;
    private float _spring;
    private float _velocity;
    private ShaderMaterial? _material;
    private Vector2 _pointer = new(0.5f, 0.5f);

    public long InstanceId { get; private set; }

    public override void _Ready()
    {
        Flat = true;
        CustomMinimumSize = new Vector2(132, 190);
        PivotOffset = CustomMinimumSize / 2f;
        MouseEntered += () => _hovered = true;
        MouseExited += () => _hovered = false;
        var shader = GD.Load<Shader>("res://Presentation/Shaders/card.gdshader");
        _material = new ShaderMaterial { Shader = shader };
        Material = _material;
        SetProcess(true);
        QueueRedraw();
    }

    public void Configure(CardInstance instance, CardDefinition definition, bool faceDown = false)
    {
        InstanceId = instance.InstanceId;
        _definition = definition;
        _faceDown = faceDown;
        TooltipText = faceDown ? "Verdeckte Karte" : $"{RankText(definition.Rank)} {SuitText(definition.Suit)}";
        QueueRedraw();
    }

    public override void _GuiInput(InputEvent @event)
    {
        if (@event is InputEventMouseMotion motion && Size.X > 0 && Size.Y > 0)
            _pointer = new Vector2(Mathf.Clamp(motion.Position.X / Size.X, 0, 1), Mathf.Clamp(motion.Position.Y / Size.Y, 0, 1));
        base._GuiInput(@event);
    }

    public override void _Process(double delta)
    {
        var target = (_hovered || HasFocus()) && !Disabled ? 1f : 0f;
        var dt = (float)Math.Min(delta, 0.05);
        _velocity += (target - _spring) * 34f * dt;
        _velocity *= Mathf.Exp(-9f * dt);
        _spring += _velocity;
        Scale = Vector2.One * (1f + 0.08f * _spring);
        Rotation = (_pointer.X - 0.5f) * 0.09f * _spring;
        ZIndex = _spring > 0.05f ? 20 : 0;
        _material?.SetShaderParameter("hover_strength", _spring);
        _material?.SetShaderParameter("pointer", _pointer);
        QueueRedraw();
    }

    public override void _Draw()
    {
        var rect = new Rect2(8, 6, Math.Max(1, Size.X - 16), Math.Max(1, Size.Y - 14));
        DrawStyleBox(Rounded(new Color(0, 0, 0, 0.42f), 16), rect with { Position = rect.Position + new Vector2(5, 8) });
        if (_faceDown || _definition is null)
        {
            DrawStyleBox(Rounded(new Color(0.12f, 0.035f, 0.035f), 15, new Color(0.95f, 0.31f, 0.11f), 2), rect);
            for (var y = 22; y < rect.Size.Y - 10; y += 18)
                DrawLine(new Vector2(22, y), new Vector2(Size.X - 22, y + 28), new Color(0.85f, 0.2f, 0.08f, 0.38f), 3);
            DrawString(ThemeDB.FallbackFont, new Vector2(30, Size.Y / 2 + 8), "Z", HorizontalAlignment.Center, Size.X - 60, 34, new Color(1f, 0.67f, 0.25f));
            return;
        }

        var suitColor = _definition.Suit is Suit.Hearts or Suit.Diamonds
            ? new Color(0.88f, 0.12f, 0.12f)
            : new Color(0.08f, 0.07f, 0.1f);
        DrawStyleBox(Rounded(new Color(0.96f, 0.91f, 0.79f), 15, new Color(0.93f, 0.56f, 0.16f), _definition.Effects.Count > 0 ? 4 : 2), rect);
        var rank = RankText(_definition.Rank);
        var suit = SuitGlyph(_definition.Suit);
        DrawString(ThemeDB.FallbackFont, new Vector2(22, 39), rank, HorizontalAlignment.Left, -1, 25, suitColor);
        DrawString(ThemeDB.FallbackFont, new Vector2(22, 66), suit, HorizontalAlignment.Left, -1, 24, suitColor);
        DrawString(ThemeDB.FallbackFont, new Vector2(22, Size.Y / 2 + 22), suit, HorizontalAlignment.Center, Size.X - 44, 52, suitColor);
        if (_definition.Effects.Count > 0)
            DrawString(ThemeDB.FallbackFont, new Vector2(18, Size.Y - 25), "ZÜNDUNG", HorizontalAlignment.Center, Size.X - 36, 13, new Color(0.6f, 0.16f, 0.04f));
    }

    private static StyleBoxFlat Rounded(Color fill, int radius, Color? border = null, int width = 0) => new()
    {
        BgColor = fill,
        CornerRadiusTopLeft = radius,
        CornerRadiusTopRight = radius,
        CornerRadiusBottomLeft = radius,
        CornerRadiusBottomRight = radius,
        BorderColor = border ?? Colors.Transparent,
        BorderWidthLeft = width,
        BorderWidthTop = width,
        BorderWidthRight = width,
        BorderWidthBottom = width
    };

    public static string RankText(Rank? rank) => rank switch
    {
        Rank.Jack => "B", Rank.Queen => "D", Rank.King => "K", Rank.Ace => "A", null => "★", _ => ((int)rank.Value).ToString()
    };
    public static string SuitText(Suit? suit) => suit switch
    {
        Suit.Hearts => "Herz", Suit.Diamonds => "Karo", Suit.Spades => "Pik", Suit.Clubs => "Kreuz", _ => "Joker"
    };
    public static string SuitGlyph(Suit? suit) => suit switch
    {
        Suit.Hearts => "♥", Suit.Diamonds => "♦", Suit.Spades => "♠", Suit.Clubs => "♣", _ => "★"
    };
}
