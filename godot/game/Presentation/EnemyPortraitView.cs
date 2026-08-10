using Godot;

namespace Zuendung.Game.Presentation;

public partial class EnemyPortraitView : Control
{
    private Texture2D? _portrait;
    private double _time;

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        TextureFilter = TextureFilterEnum.Nearest;
        PivotOffset = Size / 2f;
        _portrait = ResourceLoader.Exists("res://Assets/Characters/Enemies/falschspieler_v2.png")
            ? GD.Load<Texture2D>("res://Assets/Characters/Enemies/falschspieler_v2.png")
            : null;
        SetProcess(true);
    }

    public override void _Process(double delta)
    {
        _time += delta;
        PivotOffset = Size / 2f;
        Scale = new Vector2(1f + Mathf.Sin((float)_time * 1.25f) * 0.006f, 1f + Mathf.Sin((float)_time * 1.25f) * 0.012f);
        QueueRedraw();
    }

    public override void _Draw()
    {
        var bob = Mathf.Sin((float)_time * 1.25f) * 0.8f;
        var rect = new Rect2(0, bob, Size.X, Size.Y);
        DrawCircle(new Vector2(Size.X * 0.5f + 3, Size.Y * 0.55f + 5), Size.X * 0.42f, new Color(0, 0, 0, 0.55f));
        if (_portrait is not null) DrawTextureRect(_portrait, rect, false, Colors.White);
        else
        {
            DrawCircle(Size / 2f, Size.X * 0.43f, Color.Color8(65, 24, 25));
            DrawCircle(Size / 2f, Size.X * 0.43f, Color.Color8(194, 147, 57), false, 3f);
        }

        var smokePhase = (float)_time * 0.55f;
        for (var i = 0; i < 3; i++)
        {
            var p = Mathf.PosMod(smokePhase + i * 0.34f, 1f);
            var center = new Vector2(Size.X * 0.76f + Mathf.Sin(p * 7f + i) * 3f, Size.Y * 0.53f - p * 30f);
            DrawCircle(center, 1.5f + p * 2.3f, new Color(0.86f, 0.78f, 0.65f, (1f - p) * 0.16f));
        }
    }
}
