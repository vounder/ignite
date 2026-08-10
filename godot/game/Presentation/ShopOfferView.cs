using Godot;
using Zuendung.Domain.V2;

namespace Zuendung.Game.Presentation;

public partial class ShopOfferView : Button
{
    private Texture2D? _stand;
    private CardDefinitionV2? _definition;
    private CardViewV2? _card;
    private int _price;
    private bool _purchased;
    private bool _hovered;
    private float _hover;
    private double _time;
    private Vector2 _restPosition;
    public event Action<CardDefinitionV2, Vector2, ulong>? InspectRequested;
    public event Action<ulong>? InspectEnded;

    public override void _Ready()
    {
        Flat = true;
        FocusMode = FocusModeEnum.All;
        MouseDefaultCursorShape = CursorShape.PointingHand;
        foreach (var style in new[] { "normal", "hover", "pressed", "disabled", "focus" })
            AddThemeStyleboxOverride(style, new StyleBoxEmpty());
        TextureFilter = TextureFilterEnum.Nearest;
        if (CustomMinimumSize == Vector2.Zero) CustomMinimumSize = new Vector2(112, 168);
        _restPosition = Position;
        PivotOffset = Size / 2f;
        _stand = ResourceLoader.Exists("res://Assets/UI/shop_offer_v2.png")
            ? GD.Load<Texture2D>("res://Assets/UI/shop_offer_v2.png")
            : null;
        MouseEntered += () =>
        {
            _hovered = true;
            if (_definition is not null) InspectRequested?.Invoke(_definition, GlobalPosition + Size / 2f, GetInstanceId());
        };
        MouseExited += () => { _hovered = false; InspectEnded?.Invoke(GetInstanceId()); };
        TreeExiting += () => InspectEnded?.Invoke(GetInstanceId());
        BuildCard();
        SetProcess(true);
    }

    public void Configure(CardDefinitionV2 definition, int price, bool purchased)
    {
        _definition = definition;
        _price = price;
        _purchased = purchased;
        TooltipText = string.Empty;
        if (IsNodeReady()) BuildCard();
        QueueRedraw();
    }

    public override void _Process(double delta)
    {
        _time += delta;
        var target = (_hovered || HasFocus()) && !Disabled ? 1f : 0f;
        _hover = Mathf.Lerp(_hover, target, 1f - Mathf.Exp(-10f * (float)delta));
        Position = _restPosition + new Vector2(0, -_hover * 7f + Mathf.Sin((float)_time * 0.85f + _restPosition.X) * 0.45f);
        PivotOffset = Size / 2f;
        Scale = Vector2.One * (1f + _hover * 0.06f);
        Rotation = Mathf.DegToRad(Mathf.Sin((float)_time * 0.7f + _restPosition.X) * 0.18f - _hover * 0.7f);
        ZIndex = _hover > 0.05f ? 12 : 2;
        QueueRedraw();
    }

    public override void _Draw()
    {
        var rect = new Rect2(Vector2.Zero, Size);
        DrawRect(new Rect2(7, 8, Size.X - 14, Size.Y - 10), new Color(0, 0, 0, 0.45f));
        if (_stand is not null) DrawTextureRect(_stand, rect, false, _purchased ? new Color(0.48f, 0.42f, 0.36f) : Colors.White);

        var font = GetThemeDefaultFont();
        var priceText = _purchased ? "VERKAUFT" : $"{_price} M";
        DrawString(font, new Vector2(Size.X * 0.2f, Size.Y * 0.89f), priceText, HorizontalAlignment.Center, Size.X * 0.6f, 8,
            _purchased ? Color.Color8(135, 116, 91) : Color.Color8(242, 217, 155));
        if (_hover > 0.01f)
        {
            var shine = Mathf.PosMod((float)_time * 55f, Size.X + 30f) - 15f;
            DrawLine(new Vector2(shine, 12), new Vector2(shine - 12, 42), new Color(1f, 0.84f, 0.39f, _hover * 0.48f), 1.4f);
            DrawRect(rect.Grow(-3), new Color(1f, 0.67f, 0.17f, _hover * 0.48f), false, 1.5f);
        }
        if (_purchased)
        {
            DrawLine(new Vector2(27, 24), new Vector2(Size.X - 27, 112), new Color(0.55f, 0.08f, 0.10f, 0.7f), 4f);
            DrawLine(new Vector2(Size.X - 27, 24), new Vector2(27, 112), new Color(0.55f, 0.08f, 0.10f, 0.7f), 4f);
        }
    }

    private void BuildCard()
    {
        if (_card is not null && IsInstanceValid(_card)) _card.QueueFree();
        if (_definition is null) return;
        _card = new CardViewV2
        {
            Position = new Vector2(Size.X * 0.26f, Size.Y * 0.12f),
            Size = new Vector2(Size.X * 0.48f, Size.Y * 0.48f),
            CustomMinimumSize = new Vector2(Size.X * 0.48f, Size.Y * 0.48f),
            Disabled = true,
            MouseFilter = MouseFilterEnum.Ignore,
            ZIndex = 1
        };
        _card.Configure(new CardCopyV2(-1, _definition.Id, CardOwnerV2.Neutral, PersistenceScopeV2.Neutral), _definition);
        AddChild(_card);
    }
}
