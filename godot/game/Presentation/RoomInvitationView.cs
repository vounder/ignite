using Godot;

namespace Zuendung.Game.Presentation;

public partial class RoomInvitationView : Button
{
    private string _title = string.Empty;
    private string _subtitle = string.Empty;
    private string _reward = string.Empty;
    private Texture2D? _paper;
    private float _hover;
    private double _time;
    private Vector2 _restPosition;

    public float FloatPhase { get; set; }

    public override void _Ready()
    {
        Flat = true;
        FocusMode = FocusModeEnum.All;
        MouseDefaultCursorShape = CursorShape.PointingHand;
        foreach (var style in new[] { "normal", "hover", "pressed", "disabled", "focus" })
            AddThemeStyleboxOverride(style, new StyleBoxEmpty());
        CustomMinimumSize = new Vector2(150, 205);
        PivotOffset = CustomMinimumSize / 2f;
        _restPosition = Position;
        TextureFilter = TextureFilterEnum.Nearest;
        _paper = ResourceLoader.Exists("res://Assets/UI/route_invitation_v2.png")
            ? GD.Load<Texture2D>("res://Assets/UI/route_invitation_v2.png")
            : null;
        SetProcess(true);
    }

    public void Configure(string title, string subtitle, string reward)
    {
        _title = title;
        _subtitle = subtitle;
        _reward = reward;
        TooltipText = string.Empty;
        QueueRedraw();
    }

    public override void _Process(double delta)
    {
        _time += delta;
        var target = IsHovered() || HasFocus() ? 1f : 0f;
        _hover = Mathf.Lerp(_hover, target, 1f - Mathf.Exp(-11f * (float)delta));
        Scale = Vector2.One * (1f + _hover * 0.055f);
        Position = _restPosition + new Vector2(0, Mathf.Sin((float)_time * 0.9f + FloatPhase) * 1.2f - _hover * 5f);
        var idleTilt = Mathf.Sin((float)_time * 0.85f + FloatPhase) * 0.35f;
        Rotation = Mathf.DegToRad((_hover - 0.15f) * -1.4f + idleTilt);
        ZIndex = _hover > 0.05f ? 5 : 0;
        QueueRedraw();
    }

    public override void _Draw()
    {
        var rect = new Rect2(0, 0, Size.X, Size.Y);
        if (_hover > 0.01f)
            DrawRect(rect.Grow(2), new Color(0.95f, 0.66f, 0.18f, _hover * 0.18f), false, 2f);
        if (_paper is not null) DrawTextureRect(_paper, rect, false, Colors.White);
        else DrawRect(rect.Grow(-8), Color.Color8(226, 207, 164));

        var font = GetThemeDefaultFont();
        DrawString(font, new Vector2(14, 57), _title, HorizontalAlignment.Center, Size.X - 32, 6, Color.Color8(55, 28, 19));
        DrawLine(new Vector2(27, 67), new Vector2(Size.X - 46, 67), new Color(0.35f, 0.18f, 0.09f, 0.55f), 1f);
        DrawString(font, new Vector2(20, 88), _subtitle, HorizontalAlignment.Center, Size.X - 52, 5, Color.Color8(104, 55, 31));
        DrawString(font, new Vector2(25, 126), _reward, HorizontalAlignment.Center, 58, 17, Color.Color8(111, 23, 29));
        DrawString(font, new Vector2(20, 165), _hover > 0.5f ? "EINTRETEN" : "WÄHLEN", HorizontalAlignment.Center, Size.X - 52, 5, Color.Color8(92, 46, 27));

        if (_hover > 0.01f)
        {
            var glintX = 102f + Mathf.PosMod((float)_time * 38f, 18f);
            DrawLine(new Vector2(glintX, 50), new Vector2(glintX + 5, 43), new Color(1f, 0.88f, 0.47f, _hover * 0.75f), 1.5f);
            DrawCircle(new Vector2(71, 178), 13f + _hover * 2f, new Color(1f, 0.39f, 0.12f, _hover * 0.2f), false, 1.5f);
        }
    }
}
