using Godot;
using Zuendung.Domain;
using Zuendung.Game.Content;
using Zuendung.Game.Presentation;
using Zuendung.Persistence;

namespace Zuendung.Game.App;

public partial class GameController : Node
{
    private static readonly Color Ember = new(0.96f, 0.29f, 0.09f);
    private static readonly Color Gold = new(1f, 0.71f, 0.28f);
    private static readonly Color Paper = new(0.96f, 0.91f, 0.79f);

    private readonly SaveService _saveService = new();
    private GameCatalog _catalog = null!;
    private EnemyDefinitionResource _enemy = null!;
    private GameSession? _session;
    private Control _root = null!;
    private Control _screen = null!;
    private IgnitionOverlay _ignition = null!;
    private AudioStreamPlayer _audio = null!;
    private Label _toast = null!;
    private bool _inputLocked;
    private string _savePath = string.Empty;

    public override void _Ready()
    {
        var cardSet = GD.Load<StandardCardSetResource>("res://Content/standard_cards.tres")
            ?? throw new InvalidDataException("standard_cards.tres could not be loaded.");
        _enemy = GD.Load<EnemyDefinitionResource>("res://Content/ember_croupier.tres")
            ?? throw new InvalidDataException("ember_croupier.tres could not be loaded.");
        _catalog = CatalogMapper.Map(cardSet);
        ValidateContent();
        _savePath = ProjectSettings.GlobalizePath("user://run-v1.json");
        BuildShell();
        ShowMenu();

        var arguments = OS.GetCmdlineArgs().Concat(OS.GetCmdlineUserArgs()).ToArray();
        if (arguments.Contains("--smoke-test", StringComparer.Ordinal)) _ = RunSmokeTest();
    }

    public override void _Notification(int what)
    {
        if (what == NotificationWMCloseRequest)
        {
            SaveQuietly();
            GetTree().Quit();
        }
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event.IsActionPressed("save_run"))
        {
            SaveQuietly(showToast: true);
            GetViewport().SetInputAsHandled();
            return;
        }
        if (@event.IsActionPressed("draw_card") && !_inputLocked && _session?.Phase == RunPhase.InRound && _session.Snapshot().Round?.ActiveActor == Actor.Player)
        {
            _ = Dispatch(new DrawCardAction(Actor.Player));
            GetViewport().SetInputAsHandled();
        }
    }

    private void ValidateContent()
    {
        if (_catalog.Cards.Count != 52) throw new InvalidDataException("The standard catalog must contain 52 cards.");
        if (_catalog.Cards.Select(card => card.Id).Distinct(StringComparer.Ordinal).Count() != 52)
            throw new InvalidDataException("Card ids are not unique.");
        _ = EffectRegistry.CreateDefault();
    }

    private void BuildShell()
    {
        _root = new Control { Name = "AppRoot" };
        _root.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        _root.Theme = BuildTheme();
        AddChild(_root);

        _root.AddChild(new BackdropView { Name = "Backdrop" });
        _audio = new AudioStreamPlayer { Name = "IgnitionAudio", VolumeDb = -5f };
        _root.AddChild(_audio);
        _ignition = new IgnitionOverlay { Name = "IgnitionOverlay", Visible = false, ZIndex = 90 };
        _root.AddChild(_ignition);
        _toast = new Label
        {
            Name = "Toast",
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            MouseFilter = Control.MouseFilterEnum.Ignore,
            ZIndex = 100,
            Visible = false
        };
        _toast.SetAnchorsPreset(Control.LayoutPreset.CenterTop);
        _toast.Position = new Vector2(-220, 24);
        _toast.Size = new Vector2(440, 48);
        _toast.AddThemeColorOverride("font_color", Gold);
        _toast.AddThemeFontSizeOverride("font_size", 18);
        _root.AddChild(_toast);
    }

    private Theme BuildTheme()
    {
        var theme = new Theme { DefaultFontSize = 20 };
        theme.SetColor("font_color", "Label", Paper);
        theme.SetColor("font_color", "Button", Paper);
        theme.SetColor("font_hover_color", "Button", Colors.White);
        theme.SetColor("font_pressed_color", "Button", Gold);
        theme.SetStylebox("normal", "Button", Box(new Color(0.12f, 0.045f, 0.055f, 0.95f), 12, new Color(0.46f, 0.12f, 0.08f), 1));
        theme.SetStylebox("hover", "Button", Box(new Color(0.28f, 0.07f, 0.055f, 0.98f), 12, Ember, 2));
        theme.SetStylebox("pressed", "Button", Box(new Color(0.42f, 0.1f, 0.045f, 1f), 12, Gold, 2));
        theme.SetStylebox("disabled", "Button", Box(new Color(0.07f, 0.04f, 0.05f, 0.7f), 12, new Color(0.2f, 0.12f, 0.12f), 1));
        theme.SetStylebox("focus", "Button", Box(Colors.Transparent, 12, Gold, 2));
        return theme;
    }

    private static StyleBoxFlat Box(Color color, int radius, Color border, int borderWidth) => new()
    {
        BgColor = color,
        CornerRadiusTopLeft = radius,
        CornerRadiusTopRight = radius,
        CornerRadiusBottomLeft = radius,
        CornerRadiusBottomRight = radius,
        BorderColor = border,
        BorderWidthLeft = borderWidth,
        BorderWidthTop = borderWidth,
        BorderWidthRight = borderWidth,
        BorderWidthBottom = borderWidth,
        ContentMarginLeft = 18,
        ContentMarginRight = 18,
        ContentMarginTop = 12,
        ContentMarginBottom = 12
    };

    private void BeginScreen(string name)
    {
        if (IsInstanceValid(_screen))
        {
            // Screen changes can originate from a button signal. Defer disposal so
            // the signal emitter and its parent stay alive until emission finishes.
            _screen.Visible = false;
            _screen.MouseFilter = Control.MouseFilterEnum.Ignore;
            _screen.QueueFree();
        }
        var margin = new MarginContainer { Name = name, ZIndex = 10 };
        margin.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        margin.AddThemeConstantOverride("margin_left", 54);
        margin.AddThemeConstantOverride("margin_right", 54);
        margin.AddThemeConstantOverride("margin_top", 38);
        margin.AddThemeConstantOverride("margin_bottom", 38);
        _root.AddChild(margin);
        _screen = margin;
    }

    private void ShowMenu()
    {
        // A dispatch owns the session until its ordered event presentation and
        // optional AI response have completed. Navigation must not replace that
        // session while the async flow is suspended.
        if (_inputLocked) return;
        BeginScreen("MainMenuScreen");
        var center = new CenterContainer();
        _screen.AddChild(center);
        var panel = Panel(new Vector2(620, 680));
        center.AddChild(panel);
        var column = new VBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
        column.AddThemeConstantOverride("separation", 20);
        panel.AddChild(column);

        var eyebrow = Text("EIN MAU-MAU-ROGUELIKE", 16, Gold);
        var title = Text("ZÜNDUNG", 76, Paper);
        var subtitle = Text("Karten. Ketten. Kontrollierter Funkenflug.", 19, new Color(0.83f, 0.66f, 0.54f));
        column.AddChild(eyebrow); column.AddChild(title); column.AddChild(subtitle);
        column.AddChild(new HSeparator());
        column.AddChild(ActionButton("NEUER RUN", StartNewRun));
        var continueButton = ActionButton("FORTSETZEN", ContinueRun);
        continueButton.Disabled = !File.Exists(_savePath) && !File.Exists(_savePath + ".bak");
        column.AddChild(continueButton);
        column.AddChild(ActionButton("SPIEL BEENDEN", () => { SaveQuietly(); GetTree().Quit(); }));
        var footer = Text("Maus · Tastatur · Leertaste zieht · Strg+S speichert", 14, new Color(0.58f, 0.5f, 0.48f));
        column.AddChild(footer);
    }

    private void StartNewRun()
    {
        if (_inputLocked) return;
        var seed = (ulong)Time.GetUnixTimeFromSystem() ^ (ulong)Time.GetTicksUsec();
        _session = GameSession.CreateNew(seed, _catalog);
        SaveQuietly();
        RenderCurrentPhase();
    }

    private void ContinueRun()
    {
        if (_inputLocked) return;
        var result = _saveService.Load(_savePath, _catalog);
        if (!result.IsSuccess)
        {
            Toast("Spielstand konnte nicht geladen werden. Dateien bleiben unverändert.", error: true);
            return;
        }
        _session = result.Session;
        RenderCurrentPhase();
        Toast(result.RecoveredFromBackup ? "Backup-Spielstand wiederhergestellt." : "Spielstand geladen.");
        ScheduleAiIfNeeded();
    }

    private void RenderCurrentPhase()
    {
        if (_session is null) { ShowMenu(); return; }
        switch (_session.Phase)
        {
            case RunPhase.InRound: ShowRound(); break;
            case RunPhase.Reward: ShowReward(); break;
            case RunPhase.Shop: ShowShop(); break;
            case RunPhase.GameOver: ShowGameOver(); break;
        }
    }

    private void ShowRound()
    {
        var session = _session!;
        var snapshot = session.Snapshot();
        var round = snapshot.Round!;
        BeginScreen("RoundScreen");
        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", 14);
        _screen.AddChild(column);

        var hud = new HBoxContainer();
        hud.AddThemeConstantOverride("separation", 18);
        hud.AddChild(Text($"RUN {snapshot.Level:00}", 19, Gold, alignCenter: false));
        hud.AddChild(Text($"PUNKTE  {snapshot.Score:N0}", 19, Paper, alignCenter: false, expand: true));
        hud.AddChild(Text($"MARK  {snapshot.Money}", 19, Gold, alignCenter: false));
        hud.AddChild(ActionButton("SPEICHERN", () => SaveQuietly(showToast: true), compact: true));
        hud.AddChild(ActionButton("MENÜ", ShowMenu, compact: true));
        column.AddChild(hud);
        column.AddChild(new HSeparator());

        var opponent = new VBoxContainer { SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        opponent.AddChild(Text($"{_enemy.DisplayName.ToUpperInvariant()} · {round.OpponentHand.Count} KARTEN", 17, new Color(0.82f, 0.56f, 0.46f)));
        var backs = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
        backs.AddThemeConstantOverride("separation", -76);
        foreach (var card in round.OpponentHand.Take(12))
        {
            var view = new CardView { CustomMinimumSize = new Vector2(78, 112), MouseFilter = Control.MouseFilterEnum.Ignore };
            view.Configure(card, _catalog.GetCard(card.DefinitionId), faceDown: true);
            backs.AddChild(view);
        }
        opponent.AddChild(backs);
        column.AddChild(opponent);

        var table = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center, SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        table.AddThemeConstantOverride("separation", 28);
        var drawButton = ActionButton($"ZIEHEN\n{round.DrawPile.Count}", () => _ = Dispatch(new DrawCardAction(Actor.Player)));
        drawButton.CustomMinimumSize = new Vector2(150, 190);
        drawButton.Disabled = round.ActiveActor != Actor.Player || _inputLocked;
        table.AddChild(drawButton);
        var topInstance = round.DiscardPile[^1];
        var top = new CardView();
        top.Configure(topInstance, _catalog.GetCard(topInstance.DefinitionId));
        top.MouseFilter = Control.MouseFilterEnum.Ignore;
        table.AddChild(top);
        var hint = Text(round.ActiveActor == Actor.Player ? "DEIN ZUG" : "DER CROUPIER DENKT …", 18, round.ActiveActor == Actor.Player ? Gold : Paper);
        hint.CustomMinimumSize = new Vector2(240, 0);
        table.AddChild(hint);
        column.AddChild(table);

        var handTitle = Text("DEINE HAND", 15, new Color(0.72f, 0.58f, 0.5f));
        column.AddChild(handTitle);
        var hand = new HFlowContainer { Alignment = FlowContainer.AlignmentMode.Center };
        hand.AddThemeConstantOverride("h_separation", -16);
        hand.AddThemeConstantOverride("v_separation", 10);
        foreach (var instance in round.PlayerHand)
        {
            var view = new CardView();
            var definition = _catalog.GetCard(instance.DefinitionId);
            view.Configure(instance, definition);
            view.Disabled = round.ActiveActor != Actor.Player || !session.IsPlayable(instance) || _inputLocked;
            var capturedId = instance.InstanceId;
            view.Pressed += () => _ = Dispatch(new PlayCardAction(Actor.Player, capturedId));
            hand.AddChild(view);
        }
        column.AddChild(hand);
    }

    private void ShowReward()
    {
        BeginScreen("RewardScreen");
        var center = new CenterContainer();
        _screen.AddChild(center);
        var panel = Panel(new Vector2(720, 500));
        center.AddChild(panel);
        var column = new VBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
        column.AddThemeConstantOverride("separation", 24);
        panel.AddChild(column);
        column.AddChild(Text("DIE RUNDE BRENNT", 18, Ember));
        column.AddChild(Text("ZÜNDUNG!", 62, Gold));
        column.AddChild(Text($"+{_session!.PendingReward} MARK", 34, Paper));
        column.AddChild(Text("Der Croupier öffnet den Hinterzimmer-Shop.", 18, new Color(0.72f, 0.6f, 0.54f)));
        column.AddChild(ActionButton("BELOHNUNG NEHMEN", () => _ = Dispatch(new ClaimRewardAction())));
    }

    private void ShowShop()
    {
        var snapshot = _session!.Snapshot();
        var shop = snapshot.Shop!;
        BeginScreen("ShopScreen");
        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", 14);
        _screen.AddChild(column);
        var header = new HBoxContainer();
        header.AddChild(Text("HINTERZIMMER", 34, Gold, alignCenter: false, expand: true));
        header.AddChild(Text($"{snapshot.Money} MARK", 22, Paper, alignCenter: false));
        column.AddChild(header);
        column.AddChild(Text("Jede gekaufte Karte mischt sich ab der nächsten Runde in dein Deck.", 16, new Color(0.73f, 0.6f, 0.53f), alignCenter: false));
        var grid = new GridContainer { Columns = 4, SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        grid.AddThemeConstantOverride("h_separation", 16);
        grid.AddThemeConstantOverride("v_separation", 16);
        foreach (var offer in shop.Offers)
        {
            var card = _catalog.GetCard(offer.DefinitionId);
            var item = Panel(new Vector2(260, 280));
            var itemColumn = new VBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
            item.AddChild(itemColumn);
            itemColumn.AddChild(Text($"{CardView.RankText(card.Rank)} {CardView.SuitText(card.Suit)}", 18, Paper));
            itemColumn.AddChild(Text(card.Effects.Count > 0 ? "ZÜNDUNGSKARTE" : "STANDARDKARTE", 13, card.Effects.Count > 0 ? Ember : new Color(0.65f, 0.54f, 0.48f)));
            var buy = ActionButton(offer.Purchased ? "VERKAUFT" : $"KAUFEN · {offer.Price} M", () => _ = Dispatch(new BuyOfferAction(offer.OfferId)), compact: true);
            buy.Disabled = offer.Purchased || snapshot.Money < offer.Price || _inputLocked;
            itemColumn.AddChild(buy);
            grid.AddChild(item);
        }
        column.AddChild(grid);
        var actions = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
        var rerollPrice = 2 + snapshot.Level * shop.RerollCount;
        var reroll = ActionButton($"NEU MISCHEN · {rerollPrice} M", () => _ = Dispatch(new RerollShopAction()));
        reroll.Disabled = snapshot.Money < rerollPrice || _inputLocked;
        actions.AddChild(reroll);
        actions.AddChild(ActionButton("NÄCHSTE RUNDE", () => _ = Dispatch(new LeaveShopAction())));
        column.AddChild(actions);
    }

    private void ShowGameOver()
    {
        BeginScreen("GameOverScreen");
        var center = new CenterContainer();
        _screen.AddChild(center);
        var panel = Panel(new Vector2(650, 500));
        center.AddChild(panel);
        var column = new VBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
        column.AddThemeConstantOverride("separation", 22);
        panel.AddChild(column);
        column.AddChild(Text("DIE GLUT ERLISCHT", 19, Ember));
        column.AddChild(Text("RUN VORBEI", 56, Paper));
        column.AddChild(Text($"{_session!.Score:N0} PUNKTE · RUNDE {_session.Level}", 22, Gold));
        column.AddChild(ActionButton("NOCH EIN RUN", StartNewRun));
        column.AddChild(ActionButton("ZURÜCK ZUM MENÜ", ShowMenu));
    }

    private async Task Dispatch(GameAction action)
    {
        if (_inputLocked || _session is null) return;
        _inputLocked = true;
        var dispatchedSession = _session;
        try
        {
            var events = dispatchedSession.Handle(action);
            SaveQuietly();
            await PresentEvents(events);
            if (!ReferenceEquals(_session, dispatchedSession)) return;
            RenderCurrentPhase();

            while (dispatchedSession.Phase == RunPhase.InRound && dispatchedSession.Snapshot().Round!.ActiveActor == Actor.Opponent)
            {
                await ToSignal(GetTree().CreateTimer(_enemy.ThinkDelaySeconds), SceneTreeTimer.SignalName.Timeout);
                if (!ReferenceEquals(_session, dispatchedSession)) return;
                var aiEvents = dispatchedSession.Handle(new AdvanceOpponentAction());
                SaveQuietly();
                await PresentEvents(aiEvents);
                if (!ReferenceEquals(_session, dispatchedSession)) return;
                RenderCurrentPhase();
            }
        }
        catch (DomainRuleException exception)
        {
            Toast(exception.Message, error: true);
        }
        finally
        {
            _inputLocked = false;
            if (ReferenceEquals(_session, dispatchedSession) && dispatchedSession.Phase == RunPhase.InRound) ShowRound();
        }
    }

    private async Task PresentEvents(IReadOnlyList<DomainEvent> events)
    {
        var ignition = events.FirstOrDefault(item => item.Kind == DomainEventKind.IgnitionTriggered);
        if (ignition is not null)
        {
            _ignition.Trigger(Math.Max(1, ignition.Amount));
            _audio.Stream = ProceduralAudio.CreateIgnition(Math.Max(1, ignition.Amount));
            _audio.Play();
            var origin = _screen.Position;
            var tween = CreateTween();
            tween.TweenProperty(_screen, "position", origin + new Vector2(8, -5), 0.045);
            tween.TweenProperty(_screen, "position", origin + new Vector2(-6, 4), 0.045);
            tween.TweenProperty(_screen, "position", origin, 0.07);
            await ToSignal(GetTree().CreateTimer(0.24), SceneTreeTimer.SignalName.Timeout);
        }
        else
        {
            await ToSignal(GetTree().CreateTimer(0.08), SceneTreeTimer.SignalName.Timeout);
        }
    }

    private void ScheduleAiIfNeeded()
    {
        if (_session?.Phase == RunPhase.InRound && _session.Snapshot().Round!.ActiveActor == Actor.Opponent)
            _ = Dispatch(new AdvanceOpponentAction());
    }

    private void SaveQuietly(bool showToast = false)
    {
        if (_session is null) return;
        try
        {
            _saveService.Save(_savePath, _session);
            if (showToast) Toast("Run gespeichert.");
        }
        catch (IOException exception)
        {
            GD.PushError(exception.ToString());
            if (showToast) Toast("Speichern fehlgeschlagen.", error: true);
        }
    }

    private void Toast(string message, bool error = false)
    {
        _toast.Text = message;
        _toast.AddThemeColorOverride("font_color", error ? new Color(1f, 0.34f, 0.24f) : Gold);
        _toast.Visible = true;
        var tween = CreateTween();
        tween.TweenInterval(2.2);
        tween.TweenCallback(Callable.From(() => _toast.Visible = false));
    }

    private static PanelContainer Panel(Vector2 minimumSize)
    {
        var panel = new PanelContainer { CustomMinimumSize = minimumSize };
        panel.AddThemeStyleboxOverride("panel", Box(new Color(0.055f, 0.025f, 0.04f, 0.94f), 22, new Color(0.44f, 0.12f, 0.08f, 0.9f), 2));
        return panel;
    }

    private static Label Text(string text, int size, Color color, bool alignCenter = true, bool expand = false)
    {
        var label = new Label
        {
            Text = text,
            HorizontalAlignment = alignCenter ? HorizontalAlignment.Center : HorizontalAlignment.Left,
            VerticalAlignment = VerticalAlignment.Center,
            SizeFlagsHorizontal = expand ? Control.SizeFlags.ExpandFill : Control.SizeFlags.ShrinkCenter
        };
        label.AddThemeFontSizeOverride("font_size", size);
        label.AddThemeColorOverride("font_color", color);
        return label;
    }

    private static Button ActionButton(string text, Action action, bool compact = false)
    {
        var button = new Button
        {
            Text = text,
            CustomMinimumSize = compact ? new Vector2(130, 46) : new Vector2(300, 58),
            FocusMode = Control.FocusModeEnum.All
        };
        button.Pressed += action;
        return button;
    }

    private async Task RunSmokeTest()
    {
        try
        {
            await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            var lockedScreen = _screen;
            _inputLocked = true;
            ShowMenu();
            if (!ReferenceEquals(_screen, lockedScreen))
                throw new InvalidOperationException("Input lock allowed a lifecycle-changing navigation.");
            _inputLocked = false;
            var steps = 0;
            for (ulong seed = 1; seed <= 256; seed++)
            {
                var candidate = GameSession.CreateNew(seed, _catalog);
                var candidateSteps = 0;
                while (candidate.Phase == RunPhase.InRound && candidateSteps++ < 5000)
                {
                    var round = candidate.Snapshot().Round!;
                    if (round.ActiveActor == Actor.Opponent) candidate.Handle(new AdvanceOpponentAction());
                    else
                    {
                        var playable = round.PlayerHand.FirstOrDefault(candidate.IsPlayable);
                        candidate.Handle(playable is null ? new DrawCardAction(Actor.Player) : new PlayCardAction(Actor.Player, playable.InstanceId));
                    }
                }
                if (candidateSteps >= 5000) throw new InvalidOperationException("Smoke round did not terminate.");
                steps += candidateSteps;
                if (candidate.Phase == RunPhase.Reward) { _session = candidate; break; }
            }
            if (_session is null) throw new InvalidOperationException("No deterministic winning smoke seed was found.");
            ShowRound();
            RenderCurrentPhase();
            if (_session.Phase == RunPhase.Reward)
            {
                _session.Handle(new ClaimRewardAction());
                ShowShop();
                var affordable = _session.Snapshot().Shop!.Offers.FirstOrDefault(offer => offer.Price <= _session.Money);
                if (affordable is not null) _session.Handle(new BuyOfferAction(affordable.OfferId));
                _session.Handle(new LeaveShopAction());
                ShowRound();
                if (_session.Level != 2) throw new InvalidOperationException("The next round did not start.");
            }
            var smokePath = ProjectSettings.GlobalizePath("user://smoke-v1.json");
            _saveService.Save(smokePath, _session);
            var loaded = _saveService.Load(smokePath, _catalog);
            if (!loaded.IsSuccess || loaded.Session!.Phase != _session.Phase)
                throw new InvalidOperationException("Smoke save/load failed.");
            GD.Print($"ZUENDUNG_SMOKE_OK phase={_session.Phase} level={_session.Level} steps={steps}");
            GetTree().Quit(0);
        }
        catch (Exception exception)
        {
            GD.PushError(exception.ToString());
            GetTree().Quit(1);
        }
    }
}
