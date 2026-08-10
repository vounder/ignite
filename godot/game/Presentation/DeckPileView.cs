using Godot;

namespace Zuendung.Game.Presentation;

public partial class DeckPileView : Button
{
    private int _count;
    private float _hover;
    private Texture2D? _back;

    public override void _Ready()
    {
        Flat = true;
        foreach (var style in new[] { "normal", "hover", "pressed", "disabled", "focus" })
            AddThemeStyleboxOverride(style, new StyleBoxEmpty());
        FocusMode = FocusModeEnum.All;
        MouseDefaultCursorShape = CursorShape.PointingHand;
        CustomMinimumSize = new Vector2(70, 96);
        PivotOffset = CustomMinimumSize / 2f;
        TooltipText = "Eine Karte ziehen";
        TextureFilter = TextureFilterEnum.Nearest;
        _back = ResourceLoader.Exists("res://Assets/Cards/Standard/card_back_v2.png")
            ? GD.Load<Texture2D>("res://Assets/Cards/Standard/card_back_v2.png")
            : null;
        SetProcess(true);
    }

    public override void _Process(double delta)
    {
        var target = IsHovered() || HasFocus() ? 1f : 0f;
        _hover = Mathf.Lerp(_hover, target, 1f - Mathf.Exp(-12f * (float)delta));
        PivotOffset = Size / 2f;
        Scale = Vector2.One * (1f + 0.06f * _hover);
        Rotation = Mathf.DegToRad(-1.2f * _hover);
        QueueRedraw();
    }

    public void Configure(int count, bool enabled)
    {
        _count = count;
        Disabled = !enabled;
        QueueRedraw();
    }

    public override void _Draw()
    {
        for (var layer = 3; layer >= 0; layer--)
        {
            var offset = new Vector2(layer * 2f, -layer * 1.5f - _hover * (3 - layer) * 0.7f);
            var rect = new Rect2(5 + offset.X, 6 + offset.Y, Size.X - 17, Size.Y - 20);
            if (_back is not null)
            {
                var textureSize = _back.GetSize();
                var source = new Rect2(textureSize.X * 0.207f, textureSize.Y * 0.055f, textureSize.X * 0.586f, textureSize.Y * 0.89f);
                DrawTextureRectRegion(_back, rect, source, Disabled ? new Color(0.55f, 0.50f, 0.44f) : Colors.White);
            }
            else
            {
                DrawRect(rect, layer == 0 ? Color.Color8(70, 20, 28) : Color.Color8(32, 23, 19));
                DrawRect(rect.Grow(-3), Color.Color8(20, 78, 54));
                DrawRect(rect, Disabled ? Color.Color8(87, 76, 59) : Color.Color8(205, 157, 61), false, layer == 0 ? 2f : 1f);
            }
        }
        DrawCircle(new Vector2(Size.X - 10, Size.Y - 11), 11, Color.Color8(34, 22, 15));
        DrawCircle(new Vector2(Size.X - 10, Size.Y - 11), 10, Color.Color8(191, 139, 46), false, 2);
        DrawString(ThemeDB.FallbackFont, new Vector2(Size.X - 20, Size.Y - 7), _count.ToString(), HorizontalAlignment.Center, 20, 10, Color.Color8(244, 225, 177));
    }
}
