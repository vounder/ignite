using Godot;

namespace Zuendung.Game.Presentation;

public enum ManfredReaction
{
    Idle,
    Purchase,
    Reroll,
    Burn,
    Heal,
    Refuse,
    Goodbye
}

public partial class ManfredView : Control
{
    private static readonly Rect2 HeadRegion = new(0, 0, 1024, 610);
    private static readonly Rect2 BodyRegion = new(0, 455, 1024, 569);
    private static readonly Rect2 HandsRegion = new(365, 640, 525, 365);
    private Texture2D? _texture;
    private double _time;
    private float _reactionTime;
    private float _blink;
    private int _pose;

    public float AnimationSpeed { get; set; } = 1f;

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        CustomMinimumSize = new Vector2(215, 245);
        SetPose(0);
        SetProcess(true);
    }

    public void React(ManfredReaction reaction)
    {
        _reactionTime = reaction == ManfredReaction.Goodbye ? 1.8f : 1.45f;
        _pose = reaction switch
        {
            ManfredReaction.Purchase => 1,
            ManfredReaction.Reroll => 2,
            ManfredReaction.Burn => 3,
            ManfredReaction.Heal => 1,
            ManfredReaction.Refuse => 3,
            ManfredReaction.Goodbye => 2,
            _ => 0
        };
        SetPose(_pose);
    }

    public override void _Process(double delta)
    {
        _time += delta;
        if (_reactionTime > 0)
        {
            _reactionTime -= (float)delta * Mathf.Clamp(AnimationSpeed, 0.5f, 4f);
            if (_reactionTime <= 0) { _pose = 0; SetPose(0); }
        }

        var blinkPhase = Mathf.PosMod((float)_time, 4.3f);
        _blink = blinkPhase is > 3.98f and < 4.12f ? Mathf.Sin((blinkPhase - 3.98f) / 0.14f * Mathf.Pi) : 0f;
        QueueRedraw();
    }

    public override void _Draw()
    {
        if (_texture is null) return;
        var breath = Mathf.Sin((float)_time * 2.15f);

        // The body and head are rendered from independent regions of the pose.
        // This is a lightweight 2D puppet: breathing and looking happen between
        // key poses, so Manfred does not need dozens of full-size frames.
        var bodyDestination = new Rect2(0, 103 - breath * 0.9f, 215, 137 + breath * 1.1f);
        DrawTextureRectRegion(_texture, bodyDestination, BodyRegion);

        var headOffset = new Vector2(Mathf.Sin((float)_time * 0.67f) * 0.65f, breath * 0.65f);
        var headDestination = new Rect2(headOffset, new Vector2(215, 136));
        DrawTextureRectRegion(_texture, headDestination, HeadRegion);

        // The idle artwork already has both hands together. Re-rendering only
        // that section with a tiny opposing movement turns it into a convincing
        // hand-rub without needing dozens of full-body frames.
        var idleCycle = Mathf.PosMod((float)_time, 7.2f);
        if (_pose == 0 && idleCycle is > 5.25f and < 6.75f)
        {
            var envelope = Mathf.Sin((idleCycle - 5.25f) / 1.5f * Mathf.Pi);
            var rub = new Vector2(Mathf.Sin((float)_time * 25f) * 1.35f * envelope, Mathf.Sin((float)_time * 50f) * 0.35f * envelope);
            var handDestination = new Rect2(new Vector2(76.6f, 147.5f) + rub, new Vector2(110.3f, 88f));
            DrawTextureRectRegion(_texture, handDestination, HandsRegion);
            var glint = new Color(0.96f, 0.67f, 0.23f, envelope * 0.55f);
            DrawLine(new Vector2(136, 181) + rub, new Vector2(141, 177) + rub, glint, 1.2f);
            DrawLine(new Vector2(139, 187) - rub, new Vector2(145, 184) - rub, glint, 1.2f);
        }

        if (_blink > 0.05f && _pose == 0)
        {
            var skin = Color.Color8(128, 62, 31);
            DrawLine(new Vector2(102, 72), new Vector2(113, 73), skin, 1f + _blink * 2.2f);
            DrawLine(new Vector2(137, 72), new Vector2(147, 71), skin, 1f + _blink * 2.2f);
        }
    }

    private void SetPose(int pose)
    {
        var path = $"res://Assets/Characters/Manfred/manfred_{Mathf.Clamp(pose, 0, 4)}.png";
        if (!ResourceLoader.Exists(path)) return;
        _texture = GD.Load<Texture2D>(path);
        QueueRedraw();
    }
}
