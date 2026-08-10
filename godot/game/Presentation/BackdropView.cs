using Godot;

namespace Zuendung.Game.Presentation;

public enum CasinoScene
{
    Menu,
    Table,
    Route,
    Shop,
    Lounge,
    Event,
    Finale
}

public partial class BackdropView : Control
{
    private Texture2D? _room;
    private readonly Dictionary<CasinoScene, Texture2D> _sceneRooms = [];
    private double _time;
    private Vector2 _parallax;
    private CasinoScene _scene;

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _room = ResourceLoader.Exists("res://Assets/Environment/casino_room.png")
            ? GD.Load<Texture2D>("res://Assets/Environment/casino_room.png")
            : null;
        LoadSceneRoom(CasinoScene.Table, "res://Assets/Environment/Scenes/table_room_v2.png");
        LoadSceneRoom(CasinoScene.Route, "res://Assets/Environment/Scenes/route_room_v2.png");
        LoadSceneRoom(CasinoScene.Shop, "res://Assets/Environment/Scenes/shop_room_v2.png");
        TextureFilter = TextureFilterEnum.Nearest;
        SetProcess(true);
    }

    public void SetScene(CasinoScene scene)
    {
        _scene = scene;
        QueueRedraw();
    }

    public override void _Process(double delta)
    {
        _time += delta;
        var mouse = GetViewport().GetMousePosition();
        var normalized = new Vector2(mouse.X / Math.Max(Size.X, 1f) - 0.5f, mouse.Y / Math.Max(Size.Y, 1f) - 0.5f);
        _parallax = _parallax.Lerp(normalized * 7f, 1f - Mathf.Exp(-3f * (float)delta));
        QueueRedraw();
    }

    public override void _Draw()
    {
        DrawRect(new Rect2(Vector2.Zero, Size), Color.Color8(14, 8, 6));
        DrawRoom();
        var hasScenePlate = _sceneRooms.ContainsKey(_scene);
        var shade = _scene switch
        {
            CasinoScene.Menu => 0.32f,
            CasinoScene.Shop when hasScenePlate => 0.035f,
            CasinoScene.Route when hasScenePlate => 0.045f,
            CasinoScene.Table when hasScenePlate => 0.025f,
            CasinoScene.Shop => 0.22f,
            CasinoScene.Route => 0.28f,
            _ => 0.18f
        };
        DrawRect(new Rect2(Vector2.Zero, Size), new Color(0.025f, 0.012f, 0.008f, shade));

        if (!hasScenePlate && _scene is CasinoScene.Table or CasinoScene.Route) DrawTable(_scene == CasinoScene.Route);
        if (!hasScenePlate && _scene == CasinoScene.Shop) DrawShopCounter();
        DrawPracticalLights();
        DrawEmbers();
        DrawVignette();
    }

    private void DrawRoom()
    {
        var texture = _sceneRooms.GetValueOrDefault(_scene) ?? _room;
        if (texture is null) return;
        var textureSize = texture.GetSize();
        var viewAspect = Size.X / Math.Max(Size.Y, 1f);
        var overscan = _sceneRooms.ContainsKey(_scene) ? 0.985f : 1f;
        var sourceWidth = textureSize.X * overscan;
        var sourceHeight = sourceWidth / viewAspect;
        if (sourceHeight > textureSize.Y)
        {
            sourceHeight = textureSize.Y * overscan;
            sourceWidth = sourceHeight * viewAspect;
        }
        var maxX = Math.Max(0f, textureSize.X - sourceWidth);
        var maxY = Math.Max(0f, textureSize.Y - sourceHeight);
        var source = new Rect2(
            Mathf.Clamp(maxX * 0.5f + _parallax.X * 0.7f, 0f, maxX),
            Mathf.Clamp(maxY * 0.5f + _parallax.Y * 0.55f, 0f, maxY),
            sourceWidth,
            sourceHeight);
        var tint = _sceneRooms.ContainsKey(_scene) ? Colors.White : new Color(0.78f, 0.72f, 0.64f);
        DrawTextureRectRegion(texture, new Rect2(Vector2.Zero, Size), source, tint);
    }

    private void LoadSceneRoom(CasinoScene scene, string path)
    {
        if (ResourceLoader.Exists(path)) _sceneRooms[scene] = GD.Load<Texture2D>(path);
    }

    private void DrawPracticalLights()
    {
        var pulse = 0.92f + Mathf.Sin((float)_time * 4.1f) * 0.08f;
        if (_scene == CasinoScene.Table)
        {
            DrawGlow(new Vector2(Size.X * 0.963f, Size.Y * 0.225f), 36f, new Color(1f, 0.45f, 0.08f, 0.045f * pulse));
            DrawGlow(new Vector2(Size.X * 0.852f, Size.Y * 0.842f), 25f, new Color(1f, 0.20f, 0.035f, 0.035f * pulse));
        }
        else if (_scene == CasinoScene.Route)
        {
            DrawGlow(new Vector2(Size.X * 0.225f, Size.Y * 0.055f), 40f, new Color(1f, 0.42f, 0.07f, 0.04f * pulse));
            DrawGlow(new Vector2(Size.X * 0.775f, Size.Y * 0.055f), 40f, new Color(1f, 0.42f, 0.07f, 0.04f * pulse));
        }
        else if (_scene == CasinoScene.Shop)
        {
            foreach (var x in new[] { 0.22f, 0.42f, 0.58f })
                DrawGlow(new Vector2(Size.X * x, Size.Y * 0.08f), 34f, new Color(1f, 0.50f, 0.10f, 0.034f * pulse));
            DrawGlow(new Vector2(Size.X * 0.82f, Size.Y * 0.74f), 32f, new Color(1f, 0.22f, 0.035f, 0.045f * pulse));
        }
    }

    private void DrawGlow(Vector2 center, float radius, Color color)
    {
        for (var layer = 4; layer >= 1; layer--)
        {
            var layerColor = color;
            layerColor.A *= (5 - layer) * 0.38f;
            DrawCircle(center, radius * layer / 4f, layerColor);
        }
    }

    private void DrawTable(bool route)
    {
        var center = new Vector2(Size.X * 0.5f, route ? Size.Y * 0.73f : Size.Y * 0.69f);
        var width = Size.X * (route ? 0.55f : 0.52f);
        var height = Size.Y * (route ? 0.35f : 0.32f);
        DrawEllipse(center + new Vector2(0, 5), width + 15, height + 14, new Color(0.02f, 0.01f, 0.005f, 0.72f));
        DrawEllipse(center, width + 10, height + 10, Color.Color8(74, 37, 21));
        DrawEllipse(center, width + 4, height + 5, Color.Color8(189, 137, 48));
        DrawEllipse(center, width, height, Color.Color8(17, 73, 50));
        DrawEllipse(center, width - 8, height - 7, Color.Color8(21, 91, 61));
        DrawArc(center, width * 0.42f, 0.12f, Mathf.Pi - 0.12f, 40, new Color(0.9f, 0.72f, 0.3f, 0.35f), 1.2f);
    }

    private void DrawShopCounter()
    {
        var counter = new Rect2(0, Size.Y * 0.78f, Size.X, Size.Y * 0.22f);
        DrawRect(counter, Color.Color8(48, 25, 16));
        DrawRect(new Rect2(counter.Position, new Vector2(counter.Size.X, 5)), Color.Color8(185, 132, 47));
        for (var x = 0f; x < Size.X; x += 48f)
            DrawLine(new Vector2(x, counter.Position.Y + 6), new Vector2(x - 22, Size.Y), new Color(0.17f, 0.07f, 0.035f, 0.7f), 2f);
    }

    private void DrawEmbers()
    {
        var count = _scene is CasinoScene.Table or CasinoScene.Shop ? 11 : 5;
        for (var i = 0; i < count; i++)
        {
            var phase = (float)(_time * (0.08 + i % 5 * 0.018) + i * 0.61);
            var x = Mathf.PosMod(i * 97f + Mathf.Sin(phase) * 14f, Math.Max(Size.X, 1f));
            var y = Size.Y - Mathf.PosMod(phase * 34f + i * 29f, Math.Max(Size.Y, 1f));
            DrawCircle(new Vector2(x, y), 0.8f + i % 2, new Color(1f, 0.36f, 0.08f, 0.10f + i % 3 * 0.035f));
        }
    }

    private void DrawVignette()
    {
        const float strip = 22f;
        DrawRect(new Rect2(0, 0, Size.X, strip), new Color(0, 0, 0, 0.28f));
        DrawRect(new Rect2(0, Size.Y - strip, Size.X, strip), new Color(0, 0, 0, 0.32f));
        DrawRect(new Rect2(0, 0, strip, Size.Y), new Color(0, 0, 0, 0.24f));
        DrawRect(new Rect2(Size.X - strip, 0, strip, Size.Y), new Color(0, 0, 0, 0.24f));
    }

    private void DrawEllipse(Vector2 center, float radiusX, float radiusY, Color color)
    {
        var points = new Vector2[64];
        for (var i = 0; i < points.Length; i++)
        {
            var angle = Mathf.Tau * i / points.Length;
            points[i] = center + new Vector2(Mathf.Cos(angle) * radiusX, Mathf.Sin(angle) * radiusY);
        }
        DrawColoredPolygon(points, color);
    }
}
