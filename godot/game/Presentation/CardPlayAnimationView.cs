using Godot;
using Zuendung.Domain;
using Zuendung.Domain.V2;

namespace Zuendung.Game.Presentation;

/// <summary>
/// A restrained, physical card-play animation. The carrier follows a curved
/// path while the card itself stays a regular CardViewV2, so animated cards
/// always use exactly the same art as cards in the hand and on the table.
/// </summary>
public partial class CardPlayAnimationView : Control
{
    private static readonly Vector2 CardSize = new(70, 98);
    private readonly Vector2[] _ellipse = new Vector2[28];
    private Control _carrier = null!;
    private CardViewV2 _card = null!;
    private CardCopyV2 _copy = null!;
    private CardDefinitionV2 _definition = null!;
    private Vector2 _startCenter;
    private Vector2 _controlCenter;
    private Vector2 _targetCenter;
    private float _startScale = 1f;
    private float _startRotation;
    private float _landRotation;
    private float _air;
    private float _contact;
    private int _style;
    private bool _opponent;
    private bool _revealed;

    public float PlaybackDuration { get; private set; }

    public void Configure(
        CardCopyV2 copy,
        CardDefinitionV2 definition,
        Actor actor,
        Vector2 startCenter,
        Vector2 sourceSize,
        float sourceRotation,
        Vector2 targetCenter,
        float animationSpeed)
    {
        _copy = copy;
        _definition = definition;
        _opponent = actor == Actor.Opponent;
        _startCenter = startCenter;
        _targetCenter = targetCenter;
        _startScale = Mathf.Clamp(sourceSize.X / CardSize.X, 0.52f, 1.12f);
        _startRotation = sourceRotation;
        _style = (int)(Math.Abs(copy.CopyId + (_opponent ? 17 : 0)) % 4);

        var direction = _style is 0 or 3 ? -1f : 1f;
        var lateral = new[] { 58f, 36f, 22f, 48f }[_style] * direction;
        var midpoint = (_startCenter + _targetCenter) * 0.5f;
        _controlCenter = _opponent
            ? new Vector2(midpoint.X + lateral, Math.Min(_startCenter.Y, _targetCenter.Y) - (12f + _style * 3f))
            : new Vector2(midpoint.X + lateral, Math.Min(_startCenter.Y, _targetCenter.Y) - (38f + _style * 6f));

        _landRotation = LandingRotation(copy.CopyId);
        var baseDuration = _style == 3 ? 0.94f : _style == 1 ? 0.88f : 0.8f;
        if (_opponent) baseDuration += 0.08f; // the reveal must remain readable
        PlaybackDuration = Mathf.Clamp(baseDuration / Mathf.Clamp(animationSpeed, 0.5f, 2f), 0.48f, 1.7f);
    }

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);

        _carrier = new Control
        {
            Size = CardSize,
            PivotOffset = CardSize / 2f,
            MouseFilter = MouseFilterEnum.Ignore
        };
        AddChild(_carrier);

        _card = new CardViewV2
        {
            Position = Vector2.Zero,
            Size = CardSize,
            CustomMinimumSize = CardSize,
            Disabled = true,
            MouseFilter = MouseFilterEnum.Ignore
        };
        _card.Configure(_copy, _definition, _opponent);
        _carrier.AddChild(_card);
        ApplyProgress(0f);
    }

    public async Task Play()
    {
        var tween = CreateTween();
        tween.TweenMethod(Callable.From<float>(ApplyProgress), 0f, 1f, PlaybackDuration)
            .SetTrans(Tween.TransitionType.Linear);
        await ToSignal(tween, Tween.SignalName.Finished);
        ApplyProgress(1f);
    }

    private void ApplyProgress(float progress)
    {
        if (_carrier is null) return;
        const float flightEnd = 0.78f;
        Vector2 center;
        float scale;
        float rotation;

        if (progress < flightEnd)
        {
            var raw = progress / flightEnd;
            var travel = EaseOutCubic(raw);
            center = QuadraticBezier(_startCenter, _controlCenter, _targetCenter, travel);
            _air = Mathf.Sin(raw * Mathf.Pi);
            scale = Mathf.Lerp(_startScale, 1f, EaseOutCubic(raw)) + _air * (_style == 3 ? 0.1f : 0.055f);
            var flourish = Mathf.Sin(raw * Mathf.Pi) * Mathf.DegToRad((_style is 0 or 2 ? -1 : 1) * (5f + _style * 1.5f));
            rotation = Mathf.LerpAngle(_startRotation, _landRotation, travel) + flourish;

            if (_opponent)
            {
                var flip = Mathf.Clamp((raw - 0.27f) / 0.42f, 0f, 1f);
                var flipWidth = Mathf.Abs(Mathf.Cos(flip * Mathf.Pi));
                if (!_revealed && flip >= 0.5f)
                {
                    _revealed = true;
                    _card.Configure(_copy, _definition, false);
                }
                _carrier.Scale = new Vector2(scale * Math.Max(0.08f, flipWidth), scale);
            }
            else _carrier.Scale = Vector2.One * scale;
            _contact = 0f;
        }
        else
        {
            var settle = Mathf.Clamp((progress - flightEnd) / (1f - flightEnd), 0f, 1f);
            var damping = 1f - settle;
            center = _targetCenter + new Vector2(0, -Mathf.Sin(settle * Mathf.Pi) * 5f * damping);
            scale = 1f + Mathf.Sin(settle * Mathf.Pi) * 0.035f * damping;
            rotation = _landRotation + Mathf.Sin(settle * Mathf.Pi * 2f) * Mathf.DegToRad(1.8f) * damping;
            _carrier.Scale = Vector2.One * scale;
            _air = 0f;
            _contact = Mathf.Sin(Mathf.Clamp(settle * 1.35f, 0f, 1f) * Mathf.Pi);
        }

        _carrier.Position = center - CardSize / 2f;
        _carrier.Rotation = rotation;
        QueueRedraw();
    }

    public override void _Draw()
    {
        if (_carrier is null) return;
        var center = _carrier.Position + CardSize / 2f;
        var shadowCenter = center + new Vector2(5f, 7f + _air * 7f);
        DrawEllipse(shadowCenter, new Vector2(31f + _air * 6f, 10f + _air * 3f), new Color(0, 0, 0, 0.28f - _air * 0.08f));
        if (_contact > 0.01f)
            DrawEllipse(_targetCenter + new Vector2(0, 35), new Vector2(38f + _contact * 8f, 11f + _contact * 2f), new Color(0.78f, 0.58f, 0.22f, 0.16f * _contact), false, 1.2f);
    }

    private void DrawEllipse(Vector2 center, Vector2 radius, Color color, bool filled = true, float width = -1f)
    {
        for (var index = 0; index < _ellipse.Length; index++)
        {
            var angle = Mathf.Tau * index / _ellipse.Length;
            _ellipse[index] = center + new Vector2(Mathf.Cos(angle) * radius.X, Mathf.Sin(angle) * radius.Y);
        }
        DrawPolyline(_ellipse, color, width, true);
        if (filled) DrawColoredPolygon(_ellipse, color);
    }

    private static Vector2 QuadraticBezier(Vector2 start, Vector2 control, Vector2 end, float t)
    {
        var inverse = 1f - t;
        return inverse * inverse * start + 2f * inverse * t * control + t * t * end;
    }

    private static float EaseOutCubic(float value) => 1f - Mathf.Pow(1f - Mathf.Clamp(value, 0f, 1f), 3f);

    public static float LandingRotation(long copyId)
    {
        var style = (int)(Math.Abs(copyId) % 4);
        var angleSign = style is 0 or 2 ? -1f : 1f;
        return Mathf.DegToRad(angleSign * (1.4f + style * 0.45f));
    }
}
