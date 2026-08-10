using Godot;

namespace Zuendung.Game.Presentation;

public enum ShopPropKind
{
    RerollMachine,
    Ashtray,
    Matchbox,
    ExitBell
}

public partial class ShopPropView : Button
{
    private ShopPropKind _kind;
    private string _caption = string.Empty;
    private string _price = string.Empty;
    private float _animation;
    private float _hover;
    private double _time;

    public float AnimationSpeed { get; set; } = 1f;
    public bool IntegratedHotspot { get; set; }

    public override void _Ready()
    {
        Flat = true;
        FocusMode = FocusModeEnum.All;
        foreach (var style in new[] { "normal", "hover", "pressed", "disabled", "focus" })
            AddThemeStyleboxOverride(style, new StyleBoxEmpty());
        MouseDefaultCursorShape = CursorShape.PointingHand;
        CustomMinimumSize = new Vector2(88, 68);
        PivotOffset = CustomMinimumSize / 2f;
        SetProcess(true);
    }

    public void Configure(ShopPropKind kind, string caption, string price)
    {
        _kind = kind;
        _caption = caption;
        _price = price;
        TooltipText = string.Empty;
        QueueRedraw();
    }

    public void PlayAnimation()
    {
        _animation = 1f;
        QueueRedraw();
    }

    public override void _Process(double delta)
    {
        _time += delta;
        _animation = Math.Max(0f, _animation - (float)delta * 0.95f * Mathf.Clamp(AnimationSpeed, 0.5f, 2f));
        var target = IsHovered() || HasFocus() ? 1f : 0f;
        _hover = Mathf.Lerp(_hover, target, 1f - Mathf.Exp(-12f * (float)delta));
        PivotOffset = Size / 2f;
        Scale = Vector2.One * (1f + _hover * 0.055f);
        ZIndex = _hover > 0.05f ? 10 : 0;
        QueueRedraw();
    }

    public override void _Draw()
    {
        var center = new Vector2(Size.X / 2f, 27);
        var brass = Disabled ? Color.Color8(94, 79, 58) : Color.Color8(203, 151, 52);
        if (IntegratedHotspot)
        {
            DrawIntegratedHotspot(center, brass);
            return;
        }
        switch (_kind)
        {
            case ShopPropKind.RerollMachine:
                DrawRect(new Rect2(center.X - 22, 8, 42, 34), Color.Color8(39, 29, 23));
                DrawRect(new Rect2(center.X - 19, 11, 36, 22), brass, false, 2);
                for (var i = 0; i < 3; i++)
                {
                    var value = _animation > 0 ? (int)(_time * 24 + i * 2) % 4 : i + 1;
                    DrawString(ThemeDB.FallbackFont, new Vector2(center.X - 17 + i * 12, 26), value % 2 == 0 ? "7" : "♦", HorizontalAlignment.Center, 10, 10, Color.Color8(238, 220, 178));
                }
                var angle = _animation > 0 ? Mathf.Sin((1f - _animation) * Mathf.Tau * 2f) * 0.8f : -0.3f;
                var leverStart = new Vector2(center.X + 23, 15);
                DrawLine(leverStart, leverStart + Vector2.FromAngle(angle) * 22, brass, 3);
                DrawCircle(leverStart + Vector2.FromAngle(angle) * 22, 4, Color.Color8(139, 36, 31));
                break;
            case ShopPropKind.Ashtray:
                DrawArc(center + new Vector2(0, 8), 22, 0, Mathf.Pi, 24, brass, 4);
                DrawLine(center + new Vector2(-22, 8), center + new Vector2(22, 8), brass, 2);
                if (_animation > 0)
                    for (var i = 0; i < 7; i++)
                    {
                        var flame = center + new Vector2((i - 3) * 5, 5 - Mathf.Sin((float)_time * 15 + i) * 8 * _animation);
                        DrawCircle(flame, 2 + i % 2, new Color(1f, 0.25f + i * 0.05f, 0.03f, _animation));
                    }
                break;
            case ShopPropKind.Matchbox:
                DrawRect(new Rect2(center.X - 28, 6, 56, 38), new Color(0, 0, 0, 0.48f));
                DrawRect(new Rect2(center.X - 26, 4, 52, 37), Color.Color8(101, 20, 29));
                DrawRect(new Rect2(center.X - 22, 8, 44, 29), Color.Color8(46, 27, 23));
                DrawRect(new Rect2(center.X - 22, 8, 44, 29), brass, false, 2);
                DrawString(GetThemeDefaultFont(), new Vector2(center.X - 20, 32), "+", HorizontalAlignment.Center, 40, 19, Color.Color8(242, 216, 157));
                if (_animation > 0)
                {
                    var progress = 1f - _animation;
                    var spark = center + new Vector2(-24 + progress * 48, 4);
                    DrawLine(center + new Vector2(-24, 5), spark, Color.Color8(244, 213, 151), 2);
                    DrawCircle(spark, 3 + 2 * _animation, new Color(1f, 0.42f, 0.04f, _animation));
                    DrawLine(spark, spark + new Vector2(-4, -7), new Color(1f, 0.72f, 0.18f, _animation), 2);
                }
                break;
            case ShopPropKind.ExitBell:
                var bellAngle = _animation > 0 ? Mathf.Sin((1f - _animation) * Mathf.Tau * 3f) * _animation * 0.28f : 0f;
                DrawSetTransform(center, bellAngle, Vector2.One);
                DrawArc(Vector2.Zero, 20, Mathf.Pi, Mathf.Tau, 24, brass, 5);
                DrawLine(new Vector2(-22, 0), new Vector2(22, 0), brass, 3);
                DrawCircle(new Vector2(0, -20), 3, brass);
                DrawSetTransform(Vector2.Zero, 0, Vector2.One);
                if (_animation > 0)
                {
                    var ring = new Color(brass, _animation * 0.7f);
                    DrawArc(center + new Vector2(-18, -15), 9 + (1f - _animation) * 7, 2.45f, 3.75f, 10, ring, 1.5f);
                    DrawArc(center + new Vector2(18, -15), 9 + (1f - _animation) * 7, -0.6f, 0.7f, 10, ring, 1.5f);
                }
                break;
        }
        DrawString(ThemeDB.FallbackFont, new Vector2(2, Size.Y - 15), _caption, HorizontalAlignment.Center, Size.X - 4, 8, Color.Color8(239, 222, 180));
        DrawString(ThemeDB.FallbackFont, new Vector2(2, Size.Y - 5), _price, HorizontalAlignment.Center, Size.X - 4, 7, brass);
    }

    private void DrawIntegratedHotspot(Vector2 center, Color brass)
    {
        var pulse = 0.45f + Mathf.Sin((float)_time * 3.2f) * 0.12f;
        if (_hover > 0.01f)
        {
            DrawRect(new Rect2(3, 3, Size.X - 6, Size.Y - 7), new Color(brass, _hover * 0.62f), false, 2f);
            DrawCircle(center, 24 + _hover * 3, new Color(1f, 0.48f, 0.08f, _hover * 0.07f));
        }
        if (_animation > 0 && _kind == ShopPropKind.RerollMachine)
        {
            for (var i = 0; i < 3; i++)
            {
                var y = 8 + Mathf.PosMod((float)_time * 90 + i * 13, 30f);
                DrawLine(new Vector2(center.X - 18 + i * 18, y), new Vector2(center.X - 18 + i * 18, y + 8), new Color(1f, 0.75f, 0.22f, _animation), 2f);
            }
        }
        else if (_animation > 0 && _kind == ShopPropKind.Ashtray)
        {
            for (var i = 0; i < 6; i++)
            {
                var flame = center + new Vector2((i - 2.5f) * 6, 5 - Mathf.Sin((float)_time * 14 + i) * 9 * _animation);
                DrawCircle(flame, 2 + i % 2, new Color(1f, 0.22f + i * 0.05f, 0.02f, _animation));
            }
        }
        else if (_kind == ShopPropKind.ExitBell && _hover > 0.01f)
        {
            DrawArc(center + new Vector2(0, -4), 23 + _hover * 3, Mathf.Pi, Mathf.Tau, 20, new Color(brass, pulse * _hover), 2f);
        }

        var labelRect = new Rect2(2, Size.Y - 29, Size.X - 4, 27);
        DrawRect(labelRect, new Color(0.035f, 0.017f, 0.01f, 0.86f));
        DrawRect(labelRect, new Color(brass, 0.72f), false, 1f);
        DrawString(GetThemeDefaultFont(), new Vector2(3, Size.Y - 16), _caption, HorizontalAlignment.Center, Size.X - 6, 5, Color.Color8(239, 222, 180));
        DrawString(GetThemeDefaultFont(), new Vector2(3, Size.Y - 5), _price, HorizontalAlignment.Center, Size.X - 6, 5, brass);
    }
}
