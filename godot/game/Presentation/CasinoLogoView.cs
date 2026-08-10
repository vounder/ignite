using Godot;

namespace Zuendung.Game.Presentation;

public partial class CasinoLogoView : Control
{
    private Texture2D? _texture;

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        TextureFilter = TextureFilterEnum.Nearest;
        _texture = ResourceLoader.Exists("res://Assets/UI/logo.png")
            ? GD.Load<Texture2D>("res://Assets/UI/logo.png")
            : null;
        QueueRedraw();
    }

    public override void _Draw()
    {
        if (_texture is null) return;
        // Draw explicitly into the control rectangle. TextureRect inherited the
        // 1536px source minimum in exported builds and pushed the logo offscreen.
        DrawTextureRect(_texture, new Rect2(Vector2.Zero, Size), false);
    }
}
