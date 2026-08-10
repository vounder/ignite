using Godot;
using Zuendung.Domain;
using Zuendung.Domain.V2;

namespace Zuendung.Game.Presentation;

public partial class IgnitionOverlay : Control
{
    private enum AffectedZone { None, OpponentArea, PlayerArea, DrawPile, Bank, BothHands, PlayerAndBank, DrawAndTable }

    private float _remaining;
    private float _duration;
    private float _strength;
    private string _definitionId = string.Empty;
    private string _displayName = string.Empty;
    private string _line1 = string.Empty;
    private string _line2 = string.Empty;
    private string _affected = string.Empty;
    private AffectedZone _zone;
    private Texture2D? _texture;
    private Font _font = null!;

    public float PlaybackDuration => _duration;
    public bool IsSpecial => _definitionId.StartsWith("special.", StringComparison.Ordinal);

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Stop;
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _font = ResourceLoader.Exists("res://Assets/Fonts/casino_pixel.ttf")
            ? GD.Load<Font>("res://Assets/Fonts/casino_pixel.ttf")
            : ThemeDB.FallbackFont;
        SetProcess(true);
    }

    public void Trigger(string definitionId, int chainLength, float animationSpeed = 1f) =>
        Trigger(definitionId, chainLength, animationSpeed, Actor.Player, null);

    public void Trigger(string definitionId, int chainLength, float animationSpeed, Actor source, Actor? effectTarget)
    {
        _definitionId = definitionId;
        _strength = Mathf.Clamp(chainLength, 1, 8);
        var speed = Mathf.Clamp(animationSpeed, 0.5f, 2f);
        var special = IsSpecial;
        _duration = special ? Mathf.Clamp(2.8f / speed, 1.4f, 4.2f) : Mathf.Max(0.28f, 0.52f / speed);
        _remaining = _duration;
        if (special)
        {
            _displayName = DisplayName(definitionId);
            (_line1, _line2) = Explanation(definitionId);
            _affected = AffectedLabel(definitionId, source, effectTarget);
            _zone = ZoneFor(definitionId, source, effectTarget);
            var path = $"res://Assets/Cards/Special/{definitionId[8..].Replace('-', '_')}_v2.png";
            _texture = ResourceLoader.Exists(path) ? GD.Load<Texture2D>(path) : null;
        }
        else
        {
            _displayName = _line1 = _line2 = _affected = string.Empty;
            _zone = AffectedZone.None;
            _texture = null;
        }
        Show();
        QueueRedraw();
    }

    public void Trigger(int chainLength) => Trigger(string.Empty, chainLength);

    public void TriggerForQa(string definitionId, Actor source, Actor target)
    {
        Trigger(definitionId, 1, 1f, source, target);
        _duration = 12f;
        _remaining = 12f;
    }

    public override void _Process(double delta)
    {
        if (_remaining <= 0) return;
        _remaining -= (float)delta;
        if (_remaining <= 0) Hide();
        QueueRedraw();
    }

    public override void _Draw()
    {
        if (_remaining <= 0) return;
        var life = Mathf.Clamp(_remaining / Math.Max(_duration, 0.01f), 0f, 1f);
        var progress = 1f - life;
        if (!IsSpecial)
        {
            DrawSparks(Size / 2f, life, progress);
            return;
        }

        var fadeIn = Mathf.Clamp(progress / 0.09f, 0f, 1f);
        var fadeOut = Mathf.Clamp(life / 0.12f, 0f, 1f);
        var alpha = Math.Min(fadeIn, fadeOut);
        DrawRect(new Rect2(Vector2.Zero, Size), new Color(0.02f, 0.01f, 0.008f, 0.69f * alpha));
        DrawAffectedZone(progress, alpha);

        var panel = new Rect2(78, 84, 484, 190);
        DrawRect(new Rect2(panel.Position + new Vector2(5, 7), panel.Size), new Color(0, 0, 0, 0.62f * alpha));
        DrawRect(panel, new Color(0.055f, 0.13f, 0.095f, 0.98f * alpha));
        DrawRect(panel, new Color(0.82f, 0.61f, 0.23f, alpha), false, 3);
        DrawRect(panel.Grow(-6), new Color(0.42f, 0.10f, 0.12f, 0.8f * alpha), false, 1);

        var artRect = new Rect2(99, 109, 112, 112);
        DrawRect(artRect.Grow(5), new Color(0.09f, 0.04f, 0.025f, 0.9f * alpha));
        DrawRect(artRect.Grow(5), new Color(0.78f, 0.57f, 0.19f, alpha), false, 2);
        if (_texture is not null) DrawTextureRect(_texture, artRect, false);
        var iconCenter = artRect.GetCenter();
        DrawSparks(iconCenter, life * alpha, progress * 0.65f);
        DrawSignature(iconCenter, progress, alpha);

        var ivory = new Color(0.95f, 0.88f, 0.70f, alpha);
        var brass = new Color(0.96f, 0.70f, 0.20f, alpha);
        var ember = new Color(1f, 0.27f, 0.055f, alpha);
        DrawString(_font, new Vector2(231, 120), "SPEZIALKARTE", HorizontalAlignment.Left, 305, 7, ember);
        DrawString(_font, new Vector2(228, 145), _displayName, HorizontalAlignment.Left, 310, 17, brass);
        DrawString(_font, new Vector2(229, 174), _line1, HorizontalAlignment.Left, 306, 9, ivory);
        if (_line2.Length > 0) DrawString(_font, new Vector2(229, 193), _line2, HorizontalAlignment.Left, 306, 9, ivory);
        DrawRect(new Rect2(226, 211, 314, 34), new Color(0.16f, 0.055f, 0.05f, 0.88f * alpha));
        DrawRect(new Rect2(226, 211, 314, 34), new Color(0.82f, 0.61f, 0.23f, alpha), false, 1);
        DrawString(_font, new Vector2(236, 233), _affected, HorizontalAlignment.Left, 294, 8, brass);

        DrawRect(new Rect2(99, 253, 441, 5), new Color(0, 0, 0, 0.55f * alpha));
        DrawRect(new Rect2(99, 253, 441 * life, 5), new Color(0.92f, 0.55f, 0.12f, alpha));
    }

    private void DrawAffectedZone(float progress, float alpha)
    {
        var pulse = 2f + (Mathf.Sin(progress * Mathf.Tau * 5f) + 1f) * 1.8f;
        switch (_zone)
        {
            case AffectedZone.OpponentArea: Highlight(new Rect2(176, 31, 288, 99), pulse, alpha); break;
            case AffectedZone.PlayerArea: Highlight(new Rect2(66, 240, 508, 112), pulse, alpha); break;
            case AffectedZone.DrawPile: Highlight(new Rect2(226, 121, 101, 126), pulse, alpha); break;
            case AffectedZone.Bank: Highlight(new Rect2(14, 143, 150, 85), pulse, alpha); break;
            case AffectedZone.BothHands:
                Highlight(new Rect2(176, 31, 288, 99), pulse, alpha);
                Highlight(new Rect2(66, 240, 508, 112), pulse, alpha);
                break;
            case AffectedZone.PlayerAndBank:
                Highlight(new Rect2(66, 240, 508, 112), pulse, alpha);
                Highlight(new Rect2(14, 143, 150, 85), pulse, alpha);
                break;
            case AffectedZone.DrawAndTable:
                Highlight(new Rect2(226, 121, 101, 126), pulse, alpha);
                Highlight(new Rect2(316, 121, 98, 126), pulse, alpha);
                break;
        }
    }

    private void Highlight(Rect2 rect, float pulse, float alpha)
    {
        var target = rect.Grow(pulse);
        DrawRect(target, new Color(1f, 0.28f, 0.04f, 0.075f * alpha));
        var brass = new Color(1f, 0.69f, 0.16f, 0.92f * alpha);
        const float corner = 17f;
        DrawLine(target.Position, target.Position + Vector2.Right * corner, brass, 2.5f);
        DrawLine(target.Position, target.Position + Vector2.Down * corner, brass, 2.5f);
        DrawLine(new Vector2(target.End.X, target.Position.Y), new Vector2(target.End.X - corner, target.Position.Y), brass, 2.5f);
        DrawLine(new Vector2(target.End.X, target.Position.Y), new Vector2(target.End.X, target.Position.Y + corner), brass, 2.5f);
        DrawLine(new Vector2(target.Position.X, target.End.Y), new Vector2(target.Position.X + corner, target.End.Y), brass, 2.5f);
        DrawLine(new Vector2(target.Position.X, target.End.Y), new Vector2(target.Position.X, target.End.Y - corner), brass, 2.5f);
        DrawLine(target.End, target.End - Vector2.Right * corner, brass, 2.5f);
        DrawLine(target.End, target.End - Vector2.Down * corner, brass, 2.5f);
    }

    private void DrawSignature(Vector2 center, float progress, float alpha)
    {
        var brass = new Color(0.98f, 0.74f, 0.25f, 0.82f * alpha);
        var ember = new Color(1f, 0.22f, 0.035f, 0.84f * alpha);
        switch (_definitionId)
        {
            case V2ContentIds.Stillstand: DrawClock(center, brass, progress); break;
            case V2ContentIds.Addieren: DrawPlusCards(center, brass, ember, progress); break;
            case V2ContentIds.Spion: DrawEye(center, brass, progress); break;
            case V2ContentIds.Fluch: DrawCurse(center, ember, progress); break;
            case V2ContentIds.Hodl: DrawLock(center, brass, progress); break;
            case V2ContentIds.Zytokinese: DrawSplit(center, brass, false, progress); break;
            case V2ContentIds.Tausch: DrawSwap(center, brass, progress); break;
            case V2ContentIds.Bonusgeld: DrawCoins(center, brass, progress); break;
            case V2ContentIds.Opfer: DrawFlame(center, ember, progress); break;
            case V2ContentIds.Zocken: DrawDice(center, brass, progress); break;
            case V2ContentIds.Zytokinese2: DrawSplit(center, brass, true, progress); break;
        }
    }

    private void DrawSparks(Vector2 center, float life, float progress)
    {
        for (var i = 0; i < 18; i++)
        {
            var angle = i * Mathf.Tau / 18f + progress * 0.9f;
            var distance = progress * (30f + (i % 5) * 6f) * (0.8f + _strength * 0.06f);
            var position = center + Vector2.FromAngle(angle) * distance;
            DrawLine(position, position - Vector2.FromAngle(angle) * (4f + i % 3 * 2f), new Color(1f, 0.3f + i % 3 * 0.14f, 0.04f, life), 1f + i % 2);
        }
    }

    private static string DisplayName(string id) => id switch
    {
        V2ContentIds.Stillstand => "STILLSTAND", V2ContentIds.Addieren => "ADDIEREN", V2ContentIds.Spion => "SPION",
        V2ContentIds.Fluch => "FLUCH", V2ContentIds.Hodl => "HODL", V2ContentIds.Zytokinese => "ZYTOKINESE",
        V2ContentIds.Tausch => "TAUSCH", V2ContentIds.Bonusgeld => "BONUSGELD", V2ContentIds.Opfer => "OPFER",
        V2ContentIds.Zocken => "ZOCKEN", V2ContentIds.Zytokinese2 => "ZYTOKINESE II", _ => "SPEZIALKARTE"
    };

    private static (string, string) Explanation(string id) => id switch
    {
        V2ContentIds.Stillstand => ("Der nächste Zug wird", "vollständig übersprungen."),
        V2ContentIds.Addieren => ("Die betroffene Hand zieht", "sofort 2 zusätzliche Karten."),
        V2ContentIds.Spion => ("Die Gegnerhand bleibt", "für 2 eigene Züge sichtbar."),
        V2ContentIds.Fluch => ("Die nächsten 3 Ziehbefehle", "ziehen jeweils +1 Karte."),
        V2ContentIds.Hodl => ("Nach 2 eigenen Zügen", "landen 6 Mark in der Bank."),
        V2ContentIds.Zytokinese => ("Diese Karte verbrennt und", "erzeugt 2 Standardkarten."),
        V2ContentIds.Tausch => ("Spieler- und Gegnerhand", "wechseln vollständig die Seiten."),
        V2ContentIds.Bonusgeld => ("Der aktuelle Bank-Multiplikator", "wird sofort verdoppelt."),
        V2ContentIds.Opfer => ("Wähle 2 weitere Handkarten:", "Sie verbrennen für 5 Mark."),
        V2ContentIds.Zocken => ("Decke 3 Karten auf und", "spiele davon eine passende."),
        V2ContentIds.Zytokinese2 => ("Diese Karte verbrennt und", "erzeugt 2 Spezialkarten."),
        _ => ("Spezialeffekt wird ausgelöst.", string.Empty)
    };

    private static string AffectedLabel(string id, Actor source, Actor? target)
    {
        var resolvedTarget = target ?? Opposite(source);
        return id switch
        {
            V2ContentIds.Stillstand => resolvedTarget == Actor.Player ? "BETROFFEN: DEIN NÄCHSTER ZUG" : "BETROFFEN: NÄCHSTER GEGNERZUG",
            V2ContentIds.Addieren => resolvedTarget == Actor.Player ? "BETROFFEN: DEINE HAND (+2)" : "BETROFFEN: GEGNERHAND (+2)",
            V2ContentIds.Spion => source == Actor.Player ? "BETROFFEN: GEGNERHAND" : "BETROFFEN: DEINE HAND",
            V2ContentIds.Fluch => resolvedTarget == Actor.Player ? "BETROFFEN: DEINE NÄCHSTEN 3 ZIEHBEFEHLE" : "BETROFFEN: GEGNERISCHES ZIEHEN",
            V2ContentIds.Hodl => source == Actor.Player ? "BETROFFEN: DEINE BANK (+6 M)" : "BETROFFEN: GEGNERSTATUS",
            V2ContentIds.Zytokinese => source == Actor.Player ? "BETROFFEN: DIESE KARTE + DEINE HAND" : "BETROFFEN: GEGNERHAND",
            V2ContentIds.Tausch => "BETROFFEN: BEIDE HÄNDE",
            V2ContentIds.Bonusgeld => source == Actor.Player ? "BETROFFEN: DEIN BANK-MULTIPLIKATOR" : "BETROFFEN: GEGNERBONUS",
            V2ContentIds.Opfer => source == Actor.Player ? "BETROFFEN: 2 HANDKARTEN + DEINE BANK" : "BETROFFEN: GEGNERHAND",
            V2ContentIds.Zocken => "BETROFFEN: ZIEHSTAPEL + TISCH",
            V2ContentIds.Zytokinese2 => source == Actor.Player ? "BETROFFEN: DIESE KARTE + DEINE HAND" : "BETROFFEN: GEGNERHAND",
            _ => "BETROFFEN: SPIELFELD"
        };
    }

    private static AffectedZone ZoneFor(string id, Actor source, Actor? target)
    {
        var resolvedTarget = target ?? Opposite(source);
        return id switch
        {
            V2ContentIds.Stillstand or V2ContentIds.Addieren or V2ContentIds.Fluch => resolvedTarget == Actor.Player ? AffectedZone.PlayerArea : AffectedZone.OpponentArea,
            V2ContentIds.Spion => source == Actor.Player ? AffectedZone.OpponentArea : AffectedZone.PlayerArea,
            V2ContentIds.Hodl or V2ContentIds.Bonusgeld => source == Actor.Player ? AffectedZone.Bank : AffectedZone.OpponentArea,
            V2ContentIds.Zytokinese or V2ContentIds.Zytokinese2 => source == Actor.Player ? AffectedZone.PlayerArea : AffectedZone.OpponentArea,
            V2ContentIds.Tausch => AffectedZone.BothHands,
            V2ContentIds.Opfer => source == Actor.Player ? AffectedZone.PlayerAndBank : AffectedZone.OpponentArea,
            V2ContentIds.Zocken => source == Actor.Player ? AffectedZone.DrawAndTable : AffectedZone.OpponentArea,
            _ => AffectedZone.None
        };
    }

    private static Actor Opposite(Actor actor) => actor == Actor.Player ? Actor.Opponent : Actor.Player;

    private void DrawClock(Vector2 c, Color color, float p) { DrawCircle(c, 25, color, false, 4); DrawLine(c, c + Vector2.Up * 16, color, 4); DrawLine(c, c + Vector2.FromAngle(-0.35f - p * 2.4f) * 18, color, 4); }
    private void DrawPlusCards(Vector2 c, Color color, Color accent, float p) { DrawRect(new Rect2(c + new Vector2(-28 - p * 8, -22), new Vector2(25, 36)), color, false, 3); DrawRect(new Rect2(c + new Vector2(3 + p * 8, -14), new Vector2(25, 36)), color, false, 3); DrawString(_font, c + new Vector2(-20, 8), "+2", HorizontalAlignment.Center, 40, 19, accent); }
    private void DrawEye(Vector2 c, Color color, float p) { var points = new[] { c + new Vector2(-32, 0), c + new Vector2(-14, -15), c, c + new Vector2(14, -15), c + new Vector2(32, 0), c + new Vector2(14, 15), c, c + new Vector2(-14, 15) }; DrawPolyline(points, color, 3); DrawCircle(c, 9 + p * 3, color); }
    private void DrawCurse(Vector2 c, Color color, float p) { for (var i = 0; i < 5; i++) DrawLine(c + new Vector2((i - 2) * 8, 25), c + new Vector2(Mathf.Sin(i * 2 + p * 6) * 17, -26 - i * 2), color, 3); }
    private void DrawLock(Vector2 c, Color color, float p) { DrawArc(c + new Vector2(0, -9), 15, Mathf.Pi, Mathf.Tau, 20, color, 5); DrawRect(new Rect2(c + new Vector2(-23, -5), new Vector2(46, 34)), color, false, 5); }
    private void DrawSplit(Vector2 c, Color color, bool legendary, float p) { DrawRect(new Rect2(c + new Vector2(-12, -22), new Vector2(24, 40)), color, false, 3); DrawLine(c + new Vector2(0, 18), c + new Vector2(-25 - p * 8, 28), color, 3); DrawLine(c + new Vector2(0, 18), c + new Vector2(25 + p * 8, 28), color, 3); DrawRect(new Rect2(c + new Vector2(-40 - p * 5, 20), new Vector2(18, 27)), color, false, legendary ? 5 : 3); DrawRect(new Rect2(c + new Vector2(22 + p * 5, 20), new Vector2(18, 27)), color, false, legendary ? 5 : 3); }
    private void DrawSwap(Vector2 c, Color color, float p) { DrawLine(c + new Vector2(-30, -10), c + new Vector2(24, -10), color, 4); DrawLine(c + new Vector2(24, -10), c + new Vector2(14, -20), color, 4); DrawLine(c + new Vector2(30, 12), c + new Vector2(-24, 12), color, 4); DrawLine(c + new Vector2(-24, 12), c + new Vector2(-14, 22), color, 4); }
    private void DrawCoins(Vector2 c, Color color, float p) { for (var i = 0; i < 7; i++) DrawCircle(c + Vector2.FromAngle(i * Mathf.Tau / 7 + p) * (13 + p * 24), 7, color, false, 3); DrawString(_font, c + new Vector2(-25, 8), "×2", HorizontalAlignment.Center, 50, 19, color); }
    private void DrawFlame(Vector2 c, Color color, float p) { var points = new[] { c + new Vector2(0, -31), c + new Vector2(22, 3), c + new Vector2(12, 28), c + new Vector2(0, 17), c + new Vector2(-12, 28), c + new Vector2(-22, 3) }; DrawColoredPolygon(points, new Color(color, 0.68f)); }
    private void DrawDice(Vector2 c, Color color, float p) { DrawSetTransform(c, p * Mathf.Tau, Vector2.One); DrawRect(new Rect2(-22, -22, 44, 44), color, false, 4); foreach (var dot in new[] { new Vector2(-11, -11), new Vector2(11, -11), Vector2.Zero, new Vector2(-11, 11), new Vector2(11, 11) }) DrawCircle(dot, 3, color); DrawSetTransform(Vector2.Zero, 0, Vector2.One); }
}
