using Godot;
using Zuendung.Domain;
using Zuendung.Domain.V2;
using Zuendung.Game.Presentation;
using Zuendung.Persistence;

namespace Zuendung.Game.App;

public partial class V2GameController : Node
{
    private static readonly Color Ivory = Color.Color8(240, 226, 190);
    private static readonly Color Brass = Color.Color8(194, 147, 57);
    private static readonly Color Felt = Color.Color8(22, 77, 54);
    private static readonly Color Burgundy = Color.Color8(91, 21, 29);
    private static readonly Color Ember = Color.Color8(231, 79, 25);
    private static readonly Color Muted = Color.Color8(174, 155, 124);
    private readonly RunCatalogV2 _catalog = RunCatalogV2.CreateDefault();
    private readonly V2SaveService _saveService = new();
    private readonly ProfileSaveService _profileService = new();
    private readonly HashSet<long> _decisionSelection = [];
    private string? _activeDecisionId;
    private RunSessionV2? _session;
    private ProfileSnapshotV1 _profile = DefaultProfile();
    private Control _root = null!;
    private Control? _screen;
    private Control? _pauseOverlay;
    private BackdropView _backdrop = null!;
    private IgnitionOverlay _ignition = null!;
    private CardInspectorView _cardInspector = null!;
    private Label _toast = null!;
    private AudioStreamPlayer _audio = null!;
    private AudioStreamPlayer _music = null!;
    private GamePreferences _preferences = new();
    private string _activeMusic = string.Empty;
    private string? _shopSpeech;
    private ManfredReaction? _shopReaction;
    private string _runPath = string.Empty;
    private string _profilePath = string.Empty;
    private string _legacyPath = string.Empty;
    private string _settingsPath = string.Empty;
    private bool _inputLocked;
    private bool _performanceTest;
    private readonly List<double> _frameTimes = [];
    private int _warmupFrames;

    public override void _Ready()
    {
        _runPath = ProjectSettings.GlobalizePath("user://run-v2.json");
        _profilePath = ProjectSettings.GlobalizePath("user://profile-v1.json");
        _legacyPath = ProjectSettings.GlobalizePath("user://run-v1.json");
        _settingsPath = ProjectSettings.GlobalizePath("user://settings-v1.json");
        _preferences = GamePreferences.Load(_settingsPath);
        foreach (var definition in _catalog.Cards.Where(card => card.IsSpecial))
        {
            var asset = $"res://Assets/Cards/Special/{definition.Id[8..].Replace('-', '_')}_v2.png";
            if (!ResourceLoader.Exists(asset)) throw new InvalidDataException($"Missing special-card art: {asset}");
        }
        LoadProfile();
        BuildShell();
        ApplyPreferences();
        ShowMenu();
        var args = OS.GetCmdlineArgs().Concat(OS.GetCmdlineUserArgs()).ToArray();
        var qaScreen = System.Environment.GetEnvironmentVariable("ZUENDUNG_QA_SCREEN");
        if (string.Equals(qaScreen, "map", StringComparison.OrdinalIgnoreCase) || args.Contains("--qa-map", StringComparer.Ordinal))
        {
            _session = RunSessionV2.CreateNew(17, "starter.igniter", _catalog);
            Render();
        }
        else if (args.Contains("--qa-special-overlay", StringComparer.Ordinal)) { PrepareQaEncounter(); _ = ShowQaSpecialOverlay(); }
        else if (args.Contains("--qa-card-inspector", StringComparer.Ordinal)) { PrepareQaEncounter(); _ = ShowQaCardInspector(); }
        else if (string.Equals(qaScreen, "encounter", StringComparison.OrdinalIgnoreCase) || args.Contains("--qa-encounter", StringComparer.Ordinal)) PrepareQaEncounter();
        else if (string.Equals(qaScreen, "shop", StringComparison.OrdinalIgnoreCase) || args.Contains("--qa-shop", StringComparer.Ordinal)) PrepareQaShop();
        else if (args.Contains("--smoke-test", StringComparer.Ordinal)) _ = RunSmokeTest();
        else if (args.Contains("--perf-test", StringComparer.Ordinal)) { _performanceTest = true; SetProcess(true); }
    }

    public override void _Process(double delta)
    {
        if (!_performanceTest) return;
        if (_warmupFrames++ < 60) return;
        _frameTimes.Add(delta * 1000.0);
        if (_frameTimes.Count < 600) return;
        _frameTimes.Sort();
        var p95 = _frameTimes[(int)Math.Floor((_frameTimes.Count - 1) * 0.95)];
        GD.Print($"ZUENDUNG_PERF_OK p95_ms={p95:F3} samples={_frameTimes.Count}");
        GetTree().Quit(p95 <= 20.0 ? 0 : 1);
        _performanceTest = false;
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        var escapePressed = @event is InputEventKey { Pressed: true, Echo: false } key &&
                            (key.Keycode == Key.Escape || key.PhysicalKeycode == Key.Escape);
        if (@event.IsActionPressed("pause_menu") || escapePressed)
        {
            TogglePauseMenu();
            GetViewport().SetInputAsHandled();
            return;
        }
        if (@event.IsActionPressed("save_run")) { SaveQuietly(true); GetViewport().SetInputAsHandled(); }
        if (@event.IsActionPressed("draw_card") && !_inputLocked && _session?.Phase == RunPhaseV2.Encounter &&
            _session.Snapshot().Encounter is { ActiveActor: Actor.Player, PendingDecision: null })
        {
            _ = Dispatch(new DrawCardActionV2(Actor.Player));
            GetViewport().SetInputAsHandled();
        }
    }

    public override void _Notification(int what)
    {
        if (what == NotificationWMCloseRequest) { SaveQuietly(); SaveProfile(); GetTree().Quit(); }
    }

    private void BuildShell()
    {
        _root = new Control { Theme = BuildTheme() };
        _root.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        AddChild(_root);
        _backdrop = new BackdropView();
        _root.AddChild(_backdrop);
        _music = new AudioStreamPlayer { Name = "Music" };
        _root.AddChild(_music);
        _audio = new AudioStreamPlayer { VolumeDb = -7f };
        _root.AddChild(_audio);
        _cardInspector = new CardInspectorView { Visible = false, ZIndex = 80 };
        _root.AddChild(_cardInspector);
        _ignition = new IgnitionOverlay { Visible = false, ZIndex = 90 };
        _root.AddChild(_ignition);
        _toast = Text("", 9, Brass);
        _toast.Visible = false; _toast.ZIndex = 100;
        _toast.SetAnchorsPreset(Control.LayoutPreset.CenterTop);
        _toast.Position = new Vector2(-150, 8); _toast.Size = new Vector2(300, 24);
        _root.AddChild(_toast);
    }

    private static Theme BuildTheme()
    {
        var theme = new Theme { DefaultFontSize = 10 };
        if (ResourceLoader.Exists("res://Assets/Fonts/casino_pixel.ttf")) theme.DefaultFont = GD.Load<Font>("res://Assets/Fonts/casino_pixel.ttf");
        theme.SetColor("font_color", "Label", Ivory);
        theme.SetColor("font_color", "Button", Ivory);
        theme.SetColor("font_hover_color", "Button", Colors.White);
        theme.SetColor("font_pressed_color", "Button", Brass);
        theme.SetStylebox("normal", "Button", Box(Color.Color8(55, 30, 20), Burgundy, 1, 2));
        theme.SetStylebox("hover", "Button", Box(Burgundy, Brass, 1, 2));
        theme.SetStylebox("pressed", "Button", Box(Color.Color8(30, 88, 61), Brass, 2, 2));
        theme.SetStylebox("disabled", "Button", Box(Color.Color8(35, 32, 27), Color.Color8(83, 70, 55), 1, 2));
        theme.SetStylebox("focus", "Button", Box(Colors.Transparent, Brass, 1, 2));
        return theme;
    }

    private void BeginScreen(string name, int margin = 8)
    {
        ClosePauseMenu();
        _cardInspector.Clear();
        if (_screen is not null && IsInstanceValid(_screen)) { _screen.Hide(); _screen.QueueFree(); }
        var container = new MarginContainer { Name = name, ZIndex = 10 };
        container.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        foreach (var side in new[] { "margin_left", "margin_right", "margin_top", "margin_bottom" }) container.AddThemeConstantOverride(side, margin);
        _root.AddChild(container);
        _screen = container;
    }

    private void ShowMenu()
    {
        if (_inputLocked) return;
        BeginScreen("MainMenu", 0);
        _backdrop.SetScene(CasinoScene.Menu);
        SetMusic("res://Assets/Audio/menu.wav");
        var stage = new Control(); stage.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); _screen!.AddChild(stage);
        if (ResourceLoader.Exists("res://Assets/UI/logo.png"))
        {
            var logo = new CasinoLogoView { Position = new Vector2(200, 8), Size = new Vector2(240, 145) };
            stage.AddChild(logo);
        }
        else
        {
            var title = Text("ZÜNDUNG", 34, Ivory); title.Position = new Vector2(170, 62); title.Size = new Vector2(300, 60); stage.AddChild(title);
        }
        var subtitle = Text("MAU-MAU IM HINTERZIMMER", 8, Brass); subtitle.Position = new Vector2(190, 145); subtitle.Size = new Vector2(260, 20); stage.AddChild(subtitle);
        var menu = Column(5); menu.Position = new Vector2(220, 177); menu.Size = new Vector2(200, 145); stage.AddChild(menu);
        menu.AddChild(MenuChoice("NEUER RUN", () => StartNewRun("starter.classic")));
        var resume = MenuChoice("FORTSETZEN", ContinueRun); resume.Disabled = !File.Exists(_runPath) && !File.Exists(_runPath + ".bak"); menu.AddChild(resume);
        menu.AddChild(MenuChoice("EINSTELLUNGEN", ShowSettings));
        if (File.Exists(_legacyPath)) menu.AddChild(MenuChoice("ALTEN RUN IMPORTIEREN", ImportLegacy));
        menu.AddChild(MenuChoice("BEENDEN", () => { SaveQuietly(); SaveProfile(); GetTree().Quit(); }));
        var hint = Text("ESC Menü  ·  Leertaste ziehen  ·  Strg+S speichern", 7, Muted); hint.Position = new Vector2(135, 332); hint.Size = new Vector2(370, 18); stage.AddChild(hint);
    }

    private void ShowStarterSelection()
    {
        BeginScreen("StarterDecks"); _backdrop.SetScene(CasinoScene.Route); SetMusic("res://Assets/Audio/menu.wav");
        var column = Column(6); _screen!.AddChild(column);
        column.AddChild(Header("SIEBEN KARTEN", "Zu Beginn werden sieben Karten aus dem normalen 32er Blatt gezogen."));
        var grid = new GridContainer { Columns = 2, SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        grid.AddThemeConstantOverride("h_separation", 6); grid.AddThemeConstantOverride("v_separation", 6);
        foreach (var starter in _catalog.StarterDecks)
        {
            var unlocked = _profile.UnlockedStarterDeckIds.Contains(starter.Id, StringComparer.Ordinal);
            var button = Button($"{starter.DisplayName.ToUpperInvariant()}\n7 ZUFALLSKARTEN · {starter.StartingMoney} MARK",
                () => StartNewRun(starter.Id));
            button.Disabled = !unlocked; button.CustomMinimumSize = new Vector2(250, 70);
            if (!unlocked) button.Text += "\nNOCH GESPERRT";
            grid.AddChild(button);
        }
        column.AddChild(grid);
        column.AddChild(Button("ZURÜCK", ShowMenu, true));
    }

    private void StartNewRun(string starterDeckId)
    {
        _session = RunSessionV2.CreateNew((ulong)Time.GetUnixTimeFromSystem() ^ (ulong)Time.GetTicksUsec(), starterDeckId, _catalog);
        SaveQuietly(); Render();
    }

    private void ContinueRun()
    {
        var loaded = _saveService.Load(_runPath, _catalog);
        if (!loaded.IsSuccess) { Toast("Spielstand unlesbar; Dateien wurden nicht verändert.", true); return; }
        _session = loaded.Session;
        if (_session!.WasLegacyEncounterMigrated) SaveQuietly();
        Render();
        Toast(_session.WasLegacyEncounterMigrated
            ? "Alter Doppelstapel ersetzt: jetzt 7 gegen 7 mit gemeinsamem Ziehstapel."
            : loaded.RecoveredFromBackup ? "Backup wiederhergestellt." : "Run geladen.");
        ScheduleAi();
    }

    private void ImportLegacy()
    {
        var imported = new V1SaveImporter().Import(_legacyPath, (ulong)Time.GetTicksUsec(), catalog: _catalog);
        if (!imported.IsSuccess) { Toast("V1-Import fehlgeschlagen.", true); return; }
        _session = imported.Session; SaveQuietly(); Render(); Toast("Alter Spielstand als frischer V2-Run übernommen.");
    }

    private void Render()
    {
        if (_session is null) { ShowMenu(); return; }
        switch (_session.Phase)
        {
            case RunPhaseV2.Map: ShowMap(); break;
            case RunPhaseV2.Encounter: ShowEncounter(); break;
            case RunPhaseV2.CardReward: ShowCardReward(); break;
            case RunPhaseV2.TrinketReward: ShowTrinketReward(); break;
            case RunPhaseV2.Shop: ShowShop(); break;
            case RunPhaseV2.Lounge: ShowLounge(); break;
            case RunPhaseV2.Event: ShowEvent(); break;
            case RunPhaseV2.Victory: ShowRunEnd(true); break;
            case RunPhaseV2.Defeat: ShowRunEnd(false); break;
        }
    }

    private void ShowMap()
    {
        _shopSpeech = null; _shopReaction = null;
        var snapshot = _session!.Snapshot(); BeginScreen("RunMap", 0);
        _backdrop.SetScene(CasinoScene.Route); SetMusic("res://Assets/Audio/menu.wav");
        var stage = new Control(); stage.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); _screen!.AddChild(stage);
        AddHudToStage(stage, snapshot, snapshot.Mode == RunModeV2.Campaign ? $"AKT {snapshot.Act}" : $"NACHGLUT {snapshot.EndlessCycle}");

        var progress = Text(string.Join("  ", Enumerable.Range(0, 5).Select(index => index <= snapshot.Map.LastCompletedRow ? "●" : "○")), 12, Brass);
        progress.Position = new Vector2(245, 38); progress.Size = new Vector2(150, 22); stage.AddChild(progress);
        var prompt = Text("NÄCHSTER TISCH", 10, Ivory); prompt.Position = new Vector2(235, 62); prompt.Size = new Vector2(170, 24);
        prompt.AddThemeStyleboxOverride("normal", Box(new Color(0.04f, 0.02f, 0.012f, 0.78f), Brass, 1, 3)); stage.AddChild(prompt);

        var available = snapshot.Map.Nodes.Where(node => node.VisitState == NodeVisitState.Available).OrderBy(node => node.Column).ToArray();
        var shopNode = available.FirstOrDefault(node => node.Type == NodeTypeV2.Shop);
        var roomNodes = available.Where(node => node.Type != NodeTypeV2.Shop).Take(2).ToArray();
        var width = roomNodes.Length == 1 ? 150f : 338f;
        for (var index = 0; index < roomNodes.Length; index++)
        {
            var node = roomNodes[index]; var captured = node.NodeId;
            var invitation = new RoomInvitationView { Position = new Vector2(320 - width / 2 + index * 188, 104), Size = new Vector2(150, 205), FloatPhase = index * 1.7f };
            invitation.Configure(RoomTitle(node), RoomSubtitle(node), RoomReward(node));
            invitation.Pressed += () => _ = Dispatch(new ChooseNodeActionV2(captured));
            stage.AddChild(invitation);
        }
        if (shopNode is not null)
        {
            var captured = shopNode.NodeId;
            var bell = new ShopPropView { Position = new Vector2(529, 267), Size = new Vector2(94, 73), AnimationSpeed = _preferences.AnimationSpeed };
            bell.Configure(ShopPropKind.ExitBell, "MANFRED", "LADEN");
            bell.Pressed += () => _ = Dispatch(new ChooseNodeActionV2(captured));
            stage.AddChild(bell);
        }
        var trinkets = Text(snapshot.TrinketIds.Count == 0 ? "Noch keine Trinkets" : string.Join("  ·  ", snapshot.TrinketIds.Select(TrinketName)), 7, Muted);
        trinkets.Position = new Vector2(130, 331); trinkets.Size = new Vector2(380, 18); stage.AddChild(trinkets);
    }

    private void ShowEncounter()
    {
        var snapshot = _session!.Snapshot(); var encounter = snapshot.Encounter!; BeginScreen("Encounter", 0);
        _backdrop.SetScene(CasinoScene.Table); SetMusic("res://Assets/Audio/game.wav");
        var stage = new Control(); stage.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); _screen!.AddChild(stage);
        var enemy = _catalog.GetEnemy(encounter.EnemyId);
        AddHudToStage(stage, snapshot, string.Empty);
        var portrait = new EnemyPortraitView { Position = new Vector2(277, 1), Size = new Vector2(86, 86), ZIndex = 2 }; stage.AddChild(portrait);
        var enemyName = Text(enemy.DisplayName.ToUpperInvariant(), 9, Brass); enemyName.Position = new Vector2(366, 12); enemyName.Size = new Vector2(170, 25);
        enemyName.AddThemeStyleboxOverride("normal", Box(new Color(0.035f, 0.017f, 0.01f, 0.78f), Brass, 1, 3)); stage.AddChild(enemyName);
        var enemyMood = Text(encounter.Kind == EncounterKindV2.Boss ? "DAS HAUS" : encounter.Kind == EncounterKindV2.Elite ? "HOHER EINSATZ" : "MAU-MAU", 7, Muted);
        enemyMood.Position = new Vector2(375, 40); enemyMood.Size = new Vector2(150, 18); stage.AddChild(enemyMood);

        var spy = encounter.Statuses.Any(status => status.Id == "status.spy" && status.Target == Actor.Player);
        AddCardFan(stage, encounter, encounter.OpponentHand.Take(12).ToArray(), opponent: true, faceUp: spy);

        var drawEnabled = !_inputLocked && encounter.ActiveActor == Actor.Player && encounter.PendingDecision is null;
        var draw = new DeckPileView { Position = new Vector2(226, 142), Size = new Vector2(70, 96) };
        draw.Configure(encounter.PlayerDrawPile.Count, drawEnabled); draw.Pressed += () => _ = Dispatch(new DrawCardActionV2(Actor.Player)); stage.AddChild(draw);
        var tableCard = Card(encounter.Copies.Single(copy => copy.CopyId == encounter.TableCopyId), true, false);
        tableCard.Position = new Vector2(344, 142); tableCard.Size = new Vector2(70, 98); tableCard.CustomMinimumSize = tableCard.Size; stage.AddChild(tableCard);
        tableCard.RestRotation = CardPlayAnimationView.LandingRotation(tableCard.CopyId);
        tableCard.Rotation = tableCard.RestRotation;
        var turnText = encounter.PendingDecision is not null ? "ENTSCHEIDUNG" : encounter.ActiveActor == Actor.Player ? "DEIN EINSATZ" : "DAS HAUS SPIELT";
        var statusText = string.Join(" · ", encounter.Statuses.Select(StatusLabel));
        var turn = Text(turnText, 8, encounter.ActiveActor == Actor.Player ? Brass : Ivory); turn.Position = new Vector2(242, 115); turn.Size = new Vector2(156, 24);
        turn.AddThemeStyleboxOverride("normal", Box(new Color(0.035f, 0.017f, 0.01f, 0.76f), Brass, 1, 3)); stage.AddChild(turn);
        if (statusText.Length > 0)
        {
            var statuses = Text(statusText, 7, Ember); statuses.Position = new Vector2(175, 232); statuses.Size = new Vector2(290, 18); stage.AddChild(statuses);
        }
        var bank = Text($"BANK  {encounter.BankedMarks} M\nBONUS  ×{encounter.BonusMultiplier}", 8, Brass, false);
        bank.Position = new Vector2(20, 170); bank.Size = new Vector2(116, 46);
        bank.AddThemeStyleboxOverride("normal", Box(new Color(0.035f, 0.017f, 0.01f, 0.78f), Brass, 1, 3)); stage.AddChild(bank);

        if (encounter.PendingDecision is { } decision)
        {
            var choice = BuildDecision(encounter, decision); choice.Position = new Vector2(55, 255); choice.Size = new Vector2(530, 92); stage.AddChild(choice);
        }
        else AddCardFan(stage, encounter, encounter.PlayerHand.ToArray(), opponent: false, faceUp: true);
    }

    private Control BuildDecision(EncounterSnapshotV2 encounter, PendingDecisionV2 decision)
    {
        if (!string.Equals(_activeDecisionId, decision.DecisionId, StringComparison.Ordinal))
        {
            _activeDecisionId = decision.DecisionId;
            _decisionSelection.Clear();
        }
        var panel = Panel(new Vector2(0, 82)); var row = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center }; row.AddThemeConstantOverride("separation", 3); panel.AddChild(row);
        row.AddChild(Text(decision.Context == "sacrifice" ? "OPFER: 2 WÄHLEN" : decision.Context == "gamble" ? "ZOCKEN: 1 SPIELEN" : "MULLIGAN", 8, Brass));
        foreach (var id in decision.OptionCopyIds)
        {
            var copy = encounter.Copies.Single(item => item.CopyId == id);
            var card = new CardViewV2 { ToggleMode = true, CustomMinimumSize = new Vector2(36, 50) };
            card.Configure(copy, _catalog.GetCard(copy.DefinitionId));
            WireCardInspector(card);
            card.ToggleMode = true;
            card.Toggled += pressed => { if (pressed) _decisionSelection.Add(id); else _decisionSelection.Remove(id); ShowEncounter(); };
            card.ButtonPressed = _decisionSelection.Contains(id); row.AddChild(card);
        }
        var valid = _decisionSelection.Count >= decision.MinimumSelections && _decisionSelection.Count <= decision.MaximumSelections;
        var confirm = Button("BESTÄTIGEN", () => _ = Dispatch(new SubmitDecisionActionV2(decision.DecisionId, _decisionSelection.ToArray())), true);
        confirm.Disabled = !valid; row.AddChild(confirm);
        if (decision.MinimumSelections == 0) row.AddChild(Button("NICHT TAUSCHEN", () => _ = Dispatch(new SubmitDecisionActionV2(decision.DecisionId, [])), true));
        return panel;
    }

    private void ShowCardReward()
    {
        var snapshot = _session!.Snapshot(); var reward = snapshot.Reward!; BeginScreen("CardReward"); _backdrop.SetScene(CasinoScene.Table); SetMusic("res://Assets/Audio/game.wav");
        var column = Column(8); _screen!.AddChild(column); column.AddChild(Hud(snapshot, "NEUE KARTE"));
        column.AddChild(Text("Wähle eine Karte für dein persönliches Deck.", 10, Muted));
        var cards = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center, SizeFlagsVertical = Control.SizeFlags.ExpandFill }; cards.AddThemeConstantOverride("separation", 18);
        foreach (var id in reward.CardDefinitionIds)
        {
            var card = CreatePreviewCard(id, new Vector2(82, 116)); var captured = id; card.Pressed += () => _ = Dispatch(new ChooseCardRewardActionV2(captured)); cards.AddChild(card);
        }
        column.AddChild(cards); column.AddChild(Button($"ABLEHNEN · +{(snapshot.TrinketIds.Contains("trinket.ledger") ? 4 : reward.SkipCardMoney)} MARK", () => _ = Dispatch(new ChooseCardRewardActionV2(null)), true));
    }

    private void ShowTrinketReward()
    {
        var snapshot = _session!.Snapshot(); var reward = snapshot.Reward!; BeginScreen("TrinketReward"); _backdrop.SetScene(CasinoScene.Table); SetMusic("res://Assets/Audio/game.wav");
        var column = Column(8); _screen!.AddChild(column); column.AddChild(Hud(snapshot, "TRINKET"));
        var row = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center, SizeFlagsVertical = Control.SizeFlags.ExpandFill }; row.AddThemeConstantOverride("separation", 10);
        foreach (var id in reward.TrinketIds)
        {
            var definition = _catalog.GetTrinket(id); var captured = id;
            var button = Button($"{definition.DisplayName.ToUpperInvariant()}\n{definition.Description}",
                () => ChooseTrinketSlot(captured, replacement => _ = Dispatch(new ChooseTrinketRewardActionV2(captured, replacement))), true);
            button.Disabled = snapshot.TrinketIds.Contains(id, StringComparer.Ordinal);
            button.CustomMinimumSize = new Vector2(180, 90); row.AddChild(button);
        }
        column.AddChild(row); column.AddChild(Button($"ABLEHNEN · +{reward.SkipTrinketMoney} MARK", () => _ = Dispatch(new ChooseTrinketRewardActionV2(null)), true));
    }

    private void ShowShop()
    {
        var snapshot = _session!.Snapshot(); var shop = snapshot.Shop!; BeginScreen("Shop", 0);
        _backdrop.SetScene(CasinoScene.Shop); SetMusic("res://Assets/Audio/shop.wav");
        var stage = new Control(); stage.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); _screen!.AddChild(stage);
        AddHudToStage(stage, snapshot, "MANFREDS LADEN");
        var manfred = new ManfredView { Position = new Vector2(420, 57), Size = new Vector2(215, 270), AnimationSpeed = _preferences.AnimationSpeed }; stage.AddChild(manfred);
        var speech = Text("Na los. Such dir was Feines aus.", 8, Color.Color8(55, 30, 20));
        speech.Position = new Vector2(398, 34); speech.Size = new Vector2(224, 48);
        speech.AddThemeStyleboxOverride("normal", Box(Color.Color8(238, 220, 181), Brass, 2, 4)); stage.AddChild(speech);
        if (_shopReaction is { } rememberedReaction)
        {
            manfred.React(rememberedReaction);
            speech.Text = _shopSpeech ?? speech.Text;
        }

        var cardOffers = shop.Offers.Where(offer => !offer.IsTrinket).ToArray();
        for (var index = 0; index < cardOffers.Length; index++)
        {
            var offer = cardOffers[index]; var captured = offer;
            var effectivePrice = !offer.IsTrinket && shop.FirstCardDiscountAvailable ? Math.Max(0, offer.Price - 2) : offer.Price;
            var card = new ShopOfferView { Position = new Vector2(11 + index * 91, 73), Size = new Vector2(88, 143), CustomMinimumSize = new Vector2(88, 143) };
            card.Configure(_catalog.GetCard(offer.ContentId), effectivePrice, offer.Purchased);
            card.InspectRequested += (definition, position, sourceId) => _cardInspector.ShowCard(definition, position, sourceId);
            card.InspectEnded += sourceId => _cardInspector.HideCard(sourceId);
            card.Disabled = offer.Purchased || snapshot.Money < effectivePrice;
            card.Pressed += () =>
            {
                if (snapshot.Money < effectivePrice) { manfred.React(ManfredReaction.Refuse); speech.Text = "Für Luft und Liebe verkauf ich nix."; return; }
                _ = ShopMoment(manfred, speech, ManfredReaction.Purchase, "Gute Wahl. Die hat Feuer.", new BuyShopOfferActionV2(captured.OfferId));
            };
            stage.AddChild(card);
        }

        var trinketOffers = shop.Offers.Where(offer => offer.IsTrinket).ToArray();
        for (var index = 0; index < trinketOffers.Length; index++)
        {
            var offer = trinketOffers[index]; var captured = offer; var definition = _catalog.GetTrinket(offer.ContentId);
            var token = new ShopPropView { Position = new Vector2(92 + index * 150, 225), Size = new Vector2(128, 62), AnimationSpeed = _preferences.AnimationSpeed };
            token.Configure(ShopPropKind.Matchbox, definition.DisplayName.ToUpperInvariant(), $"{offer.Price} M");
            token.Disabled = offer.Purchased || snapshot.Money < offer.Price;
            token.Pressed += () => { token.PlayAnimation(); ChooseTrinketSlot(captured.ContentId, replacement => _ = ShopMoment(manfred, speech, ManfredReaction.Purchase, "Das Stück bringt Glück.", new BuyShopOfferActionV2(captured.OfferId, replacement))); };
            stage.AddChild(token);
        }

        var rerollPrice = 3 + 2 * shop.RerollCount;
        var reroll = new ShopPropView { Position = new Vector2(374, 269), Size = new Vector2(86, 76), AnimationSpeed = _preferences.AnimationSpeed, IntegratedHotspot = true }; reroll.Configure(ShopPropKind.RerollMachine, "NEU MISCHEN", $"{rerollPrice} M"); reroll.Disabled = snapshot.Money < rerollPrice;
        reroll.Pressed += () => { reroll.PlayAnimation(); _ = ShopMoment(manfred, speech, ManfredReaction.Reroll, "Einmal drehen. Nichts anfassen.", new RerollShopActionV2(), 0.9f); }; stage.AddChild(reroll);
        var removable = snapshot.PlayerCollection.FirstOrDefault(copy => !_catalog.GetCard(copy.DefinitionId).IsSpecial);
        var removePrice = 7 + 3 * snapshot.RemovalCount;
        var remove = new ShopPropView { Position = new Vector2(472, 269), Size = new Vector2(86, 76), AnimationSpeed = _preferences.AnimationSpeed, IntegratedHotspot = true }; remove.Configure(ShopPropKind.Ashtray, "VERBRENNEN", $"{removePrice} M");
        remove.Disabled = removable is null || snapshot.PlayerCollection.Count <= RunSessionV2.MinimumDeckSize || snapshot.Money < removePrice || shop.RemovalUsed;
        remove.Pressed += () => { remove.PlayAnimation(); _ = ShopMoment(manfred, speech, ManfredReaction.Burn, "Weg damit. Die Asche behalt ich.", new RemoveCardAtShopActionV2(removable!.CopyId), 0.85f); }; stage.AddChild(remove);
        var heal = new ShopPropView { Position = new Vector2(279, 286), Size = new Vector2(88, 63), AnimationSpeed = _preferences.AnimationSpeed }; heal.Configure(ShopPropKind.Matchbox, "STREICHHOLZ", "8 M"); heal.Disabled = snapshot.Lives >= 3 || snapshot.Money < 8 || shop.HealingUsed;
        heal.Pressed += () => { heal.PlayAnimation(); _ = ShopMoment(manfred, speech, ManfredReaction.Heal, "Wieder wie neu. Fast.", new HealAtShopActionV2()); }; stage.AddChild(heal);
        var exit = new ShopPropView { Position = new Vector2(558, 283), Size = new Vector2(72, 65), AnimationSpeed = _preferences.AnimationSpeed, IntegratedHotspot = true }; exit.Configure(ShopPropKind.ExitBell, "VERLASSEN", "");
        exit.Pressed += () => { exit.PlayAnimation(); _ = ShopMoment(manfred, speech, ManfredReaction.Goodbye, "Bis zum nächsten Hinterzimmer.", new LeaveShopActionV2(), 0.65f); }; stage.AddChild(exit);
    }

    private void ShowLounge()
    {
        var snapshot = _session!.Snapshot(); BeginScreen("Lounge"); _backdrop.SetScene(CasinoScene.Lounge); SetMusic("res://Assets/Audio/menu.wav"); var column = Column(8); _screen!.AddChild(column); column.AddChild(Hud(snapshot, "DIE LOUNGE"));
        column.AddChild(Text("Samt, Rauch und ein Moment vor dem nächsten Einsatz.", 10, Muted));
        var row = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center, SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        var heal = Button("EIN STREICHHOLZ\nREPARIEREN", () => _ = Dispatch(new ChooseLoungeActionV2(LoungeChoiceV2.Heal))); heal.Disabled = snapshot.Lives >= 3; row.AddChild(heal);
        var removable = snapshot.PlayerCollection.FirstOrDefault(copy => !_catalog.GetCard(copy.DefinitionId).IsSpecial);
        var remove = Button("EINE STANDARDKARTE\nVERBRENNEN", () => _ = Dispatch(new ChooseLoungeActionV2(LoungeChoiceV2.RemoveCard, removable?.CopyId))); remove.Disabled = removable is null || snapshot.PlayerCollection.Count <= RunSessionV2.MinimumDeckSize; row.AddChild(remove);
        row.AddChild(Button("5 MARK\nMITNEHMEN", () => _ = Dispatch(new ChooseLoungeActionV2(LoungeChoiceV2.TakeMoney)))); column.AddChild(row);
    }

    private void ShowEvent()
    {
        var snapshot = _session!.Snapshot(); var eventState = snapshot.Event!; BeginScreen("Event"); _backdrop.SetScene(CasinoScene.Event); SetMusic("res://Assets/Audio/menu.wav"); var column = Column(8); _screen!.AddChild(column); column.AddChild(Hud(snapshot, eventState.DisplayName.ToUpperInvariant()));
        column.AddChild(Text("Im Hinterzimmer gilt nur, was auf dem Filz liegt.", 10, Muted));
        var row = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center, SizeFlagsVertical = Control.SizeFlags.ExpandFill }; row.AddThemeConstantOverride("separation", 8);
        foreach (var option in eventState.Options)
        {
            var captured = option;
            var selectedCopy = option.RequiresCardSelection ? snapshot.PlayerCollection.FirstOrDefault(copy => !_catalog.GetCard(copy.DefinitionId).IsSpecial)?.CopyId : null;
            var button = Button(option.DisplayText.ToUpperInvariant(), () => _ = Dispatch(new ChooseEventOptionActionV2(captured.OptionId, selectedCopy)));
            button.Disabled = option.MoneyDelta < 0 && snapshot.Money < -option.MoneyDelta || option.RequiresCardSelection && selectedCopy is null;
            button.CustomMinimumSize = new Vector2(180, 80); row.AddChild(button);
        }
        column.AddChild(row);
    }

    private void ShowRunEnd(bool victory)
    {
        var snapshot = _session!.Snapshot(); ApplyRunToProfile(victory); BeginScreen(victory ? "Victory" : "Defeat", 18); _backdrop.SetScene(CasinoScene.Finale); SetMusic("res://Assets/Audio/menu.wav");
        var center = new CenterContainer(); _screen!.AddChild(center); var panel = Panel(new Vector2(380, 270)); center.AddChild(panel); var column = Column(9); panel.AddChild(column);
        column.AddChild(Text(victory ? "DAS HAUS SCHWEIGT" : "DIE GLUT ERLISCHT", 10, victory ? Brass : Ember));
        column.AddChild(Text(victory ? "AUSGEZAHLT" : "RUN VORBEI", 28, Ivory));
        column.AddChild(Text($"{snapshot.Score:N0} PUNKTE · {snapshot.Money} MARK", 12, Brass));
        if (victory && snapshot.Mode == RunModeV2.Campaign) column.AddChild(Button("NACHGLUT · ENDLOS WEITERSPIELEN", () => _ = Dispatch(new EnterEndlessActionV2())));
        column.AddChild(Button("NEUER RUN", () => StartNewRun("starter.classic"))); column.AddChild(Button("ZUM MENÜ", ShowMenu));
    }

    private async Task Dispatch(RunActionV2 action)
    {
        if (_inputLocked || _session is null) return;
        _inputLocked = true; var active = _session;
        try
        {
            var result = active.Handle(action); SaveQuietly(); await Present(result.Events);
            if (!ReferenceEquals(active, _session)) return;
            Render();
            while (active.Phase == RunPhaseV2.Encounter && active.Snapshot().Encounter is { ActiveActor: Actor.Opponent, PendingDecision: null })
            {
                await ToSignal(GetTree().CreateTimer(Math.Max(0.3, 0.65 / _preferences.AnimationSpeed)), SceneTreeTimer.SignalName.Timeout);
                var ai = active.Handle(new AdvanceOpponentActionV2()); SaveQuietly(); await Present(ai.Events); Render();
            }
        }
        catch (DomainRuleException exception) { Toast(exception.Message, true); }
        finally { _inputLocked = false; if (ReferenceEquals(active, _session)) Render(); }
    }

    private async Task Present(IReadOnlyList<RunEventV2> events)
    {
        var playedCards = await PresentCardPlays(events);
        var ignition = events.OfType<IgnitionEventV2>().FirstOrDefault();
        if (ignition is not null)
        {
            var effectTarget = events.OfType<EffectResolvedEventV2>().FirstOrDefault(effect => effect.SourceCopyId == ignition.CopyId)?.Target;
            _ignition.Trigger(ignition.DefinitionId, 1 + ignition.ChainDepth, _preferences.AnimationSpeed, ignition.Source, effectTarget);
            _audio.Stream = ProceduralAudio.CreateIgnition(1 + ignition.ChainDepth); _audio.Play();
            await ToSignal(GetTree().CreateTimer(_ignition.PlaybackDuration + 0.04f), SceneTreeTimer.SignalName.Timeout);
        }
        foreach (var toast in events.OfType<ToastEventV2>().TakeLast(1)) Toast(TranslateToast(toast.MessageKey), toast.IsError);
        foreach (var playedCard in playedCards)
            if (IsInstanceValid(playedCard)) playedCard.QueueFree();
    }

    private async Task<List<CardPlayAnimationView>> PresentCardPlays(IReadOnlyList<RunEventV2> events)
    {
        var presentations = new List<CardPlayAnimationView>();
        var moves = events.OfType<CardMovedEventV2>()
            .Where(card => card.ToZone == "table" && card.Cause is "play" or "triggered-play")
            .ToArray();
        foreach (var move in moves)
        {
            var ignition = events.OfType<IgnitionEventV2>().FirstOrDefault(item => item.CopyId == move.CopyId);
            if (ignition is null) continue;
            _cardInspector.Clear();
            var source = FindCardView(_screen, move.CopyId);
            var startCenter = ignition.Source == Actor.Player ? new Vector2(320, 302) : new Vector2(320, 82);
            var sourceSize = ignition.Source == Actor.Player ? new Vector2(68, 96) : new Vector2(40, 57);
            var sourceRotation = 0f;
            if (source is not null)
            {
                startCenter = source.GetGlobalRect().GetCenter();
                sourceSize = source.Size;
                sourceRotation = source.Rotation;
                source.Visible = false;
            }

            var copy = _session!.Snapshot().Encounter?.Copies.FirstOrDefault(item => item.CopyId == move.CopyId)
                ?? new CardCopyV2(move.CopyId, move.DefinitionId,
                    ignition.Source == Actor.Player ? CardOwnerV2.Player : CardOwnerV2.Opponent,
                    PersistenceScopeV2.Encounter);
            var animation = new CardPlayAnimationView { ZIndex = 70 };
            animation.Configure(copy, _catalog.GetCard(move.DefinitionId), ignition.Source, startCenter, sourceSize,
                sourceRotation, new Vector2(379, 191), _preferences.AnimationSpeed);
            _root.AddChild(animation);
            presentations.Add(animation);
            var style = (int)(Math.Abs(move.CopyId + (ignition.Source == Actor.Opponent ? 17 : 0)) % 4);
            _audio.Stream = ProceduralAudio.CreateCardPlay(ignition.Source == Actor.Opponent, style);
            _audio.Play();
            await animation.Play();
        }
        return presentations;
    }

    private static CardViewV2? FindCardView(Node? root, long copyId)
    {
        if (root is null) return null;
        foreach (var child in root.GetChildren())
        {
            if (child is CardViewV2 card && card.CopyId == copyId) return card;
            var nested = FindCardView(child, copyId);
            if (nested is not null) return nested;
        }
        return null;
    }

    private void ScheduleAi()
    {
        if (_session?.Snapshot().Encounter is { ActiveActor: Actor.Opponent, PendingDecision: null }) _ = Dispatch(new AdvanceOpponentActionV2());
    }

    private Control Hud(RunSnapshotV2 snapshot, string center)
    {
        var row = new HBoxContainer(); row.AddThemeConstantOverride("separation", 8);
        row.AddChild(Text($"{new string('▮', snapshot.Lives)}{new string('▯', 3 - snapshot.Lives)}", 11, Ember, false));
        row.AddChild(Text(center, 11, Brass, true, true));
        row.AddChild(Text($"{snapshot.Money} M  ·  {snapshot.Score} P", 9, Ivory, false));
        return row;
    }

    private void AddHudToStage(Control stage, RunSnapshotV2 snapshot, string center)
    {
        var hearts = Text(string.Join(" ", Enumerable.Range(0, 3).Select(index => index < snapshot.Lives ? "♥" : "♡")), 14, Ember, false);
        hearts.Position = new Vector2(14, 8); hearts.Size = new Vector2(118, 30);
        hearts.AddThemeStyleboxOverride("normal", HudBox()); stage.AddChild(hearts);
        if (!string.IsNullOrWhiteSpace(center))
        {
            var title = Text(center, 10, Brass); title.Position = new Vector2(225, 8); title.Size = new Vector2(190, 30);
            title.AddThemeStyleboxOverride("normal", HudBox()); stage.AddChild(title);
        }
        var money = Text($"{snapshot.Money} M   {snapshot.Score} P", 9, Ivory, false);
        money.HorizontalAlignment = HorizontalAlignment.Right; money.Position = new Vector2(486, 8); money.Size = new Vector2(140, 30);
        money.AddThemeStyleboxOverride("normal", HudBox()); stage.AddChild(money);
    }

    private void AddCardFan(Control stage, EncounterSnapshotV2 encounter, IReadOnlyList<long> ids, bool opponent, bool faceUp)
    {
        if (ids.Count == 0) return;
        var size = opponent ? new Vector2(40, 57) : new Vector2(68, 96);
        var maximumSpan = opponent ? 260f : 450f;
        var preferred = opponent ? 24f : 56f;
        var spacing = ids.Count <= 1 ? 0f : Math.Min(preferred, (maximumSpan - size.X) / (ids.Count - 1));
        var total = size.X + spacing * (ids.Count - 1);
        var startX = 320f - total / 2f;
        for (var index = 0; index < ids.Count; index++)
        {
            var id = ids[index];
            var offset = index - (ids.Count - 1) / 2f;
            var copy = encounter.Copies.Single(item => item.CopyId == id);
            var playable = !opponent && _session!.IsPlayable(id) && encounter.ActiveActor == Actor.Player && encounter.PendingDecision is null && !_inputLocked;
            var view = Card(copy, faceUp, playable, compact: opponent);
            var rotation = Mathf.DegToRad(offset * (opponent ? 2.2f : 4.2f));
            view.RestRotation = rotation; view.Rotation = rotation;
            view.Position = new Vector2(startX + index * spacing, opponent ? 88 + Math.Abs(offset) * 1.1f : 253 + Math.Abs(offset) * 2.2f);
            view.Size = size; view.CustomMinimumSize = size; view.ZIndex = index;
            stage.AddChild(view);
        }
    }

    private static string RoomTitle(MapNodeV2 node) => node.Type switch
    {
        NodeTypeV2.Battle => "MAU-MAU SALON", NodeTypeV2.Elite => "HINTERZIMMER", NodeTypeV2.Lounge => "DIE LOUNGE",
        NodeTypeV2.Event => "GEHEIMTISCH", NodeTypeV2.Boss => "ZÜNDUNGS-TISCH", _ => "MANFREDS LADEN"
    };

    private static string RoomSubtitle(MapNodeV2 node) => node.Type switch
    {
        NodeTypeV2.Battle => "Ruhiger Tisch", NodeTypeV2.Elite => "Hoher Einsatz", NodeTypeV2.Lounge => "Verschnaufen",
        NodeTypeV2.Event => "Das Haus entscheidet", NodeTypeV2.Boss => "Letzter Einsatz", _ => "Karten & Trinkets"
    };

    private static string RoomReward(MapNodeV2 node) => node.Type switch
    {
        NodeTypeV2.Battle => "♣", NodeTypeV2.Elite => "♠", NodeTypeV2.Lounge => "♥", NodeTypeV2.Event => "?", NodeTypeV2.Boss => "★", _ => "M"
    };

    private async Task ShopMoment(ManfredView manfred, Label speech, ManfredReaction reaction, string line, RunActionV2 action, float delay = 0.55f)
    {
        if (_inputLocked) return;
        _shopReaction = reaction; _shopSpeech = line;
        manfred.React(reaction); speech.Text = line;
        await ToSignal(GetTree().CreateTimer(Math.Max(0.3, delay / _preferences.AnimationSpeed)), SceneTreeTimer.SignalName.Timeout);
        await Dispatch(action);
    }

    private void SetMusic(string path)
    {
        if (!ResourceLoader.Exists(path) || string.Equals(_activeMusic, path, StringComparison.Ordinal) && _music.Playing) return;
        var stream = GD.Load<AudioStream>(path);
        if (stream is AudioStreamWav wav) wav.LoopMode = AudioStreamWav.LoopModeEnum.Forward;
        _activeMusic = path;
        _music.Stream = stream;
        _music.Play();
    }

    private void ApplyPreferences()
    {
        _music.VolumeDb = _preferences.MusicVolume <= 0.001f ? -80f : Mathf.LinearToDb(_preferences.MusicVolume);
        _audio.VolumeDb = _preferences.SfxVolume <= 0.001f ? -80f : Mathf.LinearToDb(_preferences.SfxVolume);
        DisplayServer.WindowSetMode(_preferences.Fullscreen ? DisplayServer.WindowMode.Fullscreen : DisplayServer.WindowMode.Windowed);
    }

    private void SavePreferences()
    {
        try { _preferences.Save(_settingsPath); }
        catch (IOException exception) { GD.PushError(exception.ToString()); }
        ApplyPreferences();
    }

    private void ShowSettings() => ShowSettings(ShowMenu);

    private void ShowSettings(Action back)
    {
        BeginScreen("Settings", 0); _backdrop.SetScene(CasinoScene.Menu); SetMusic("res://Assets/Audio/menu.wav");
        var center = new CenterContainer(); center.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); _screen!.AddChild(center);
        var panel = Panel(new Vector2(350, 292)); center.AddChild(panel);
        var column = Column(8); panel.AddChild(column);
        column.AddChild(Text("EINSTELLUNGEN", 18, Brass));
        column.AddChild(Text("Animationen", 8, Muted, false));
        var speed = MenuChoice($"GESCHWINDIGKEIT  ×{_preferences.AnimationSpeed:0.#}", () => { });
        speed.Pressed += () =>
        {
            var values = new[] { 0.5f, 0.75f, 1f, 1.5f, 2f };
            var index = Array.FindIndex(values, value => Math.Abs(value - _preferences.AnimationSpeed) < 0.01f);
            _preferences.AnimationSpeed = values[(index + 1 + values.Length) % values.Length];
            speed.Text = $"GESCHWINDIGKEIT  ×{_preferences.AnimationSpeed:0.#}"; SavePreferences();
        };
        column.AddChild(speed);
        column.AddChild(Text("Musik", 8, Muted, false));
        var music = new HSlider { MinValue = 0, MaxValue = 1, Step = 0.05, Value = _preferences.MusicVolume, CustomMinimumSize = new Vector2(280, 24) };
        music.ValueChanged += value => { _preferences.MusicVolume = (float)value; SavePreferences(); }; column.AddChild(music);
        column.AddChild(Text("Effekte", 8, Muted, false));
        var sfx = new HSlider { MinValue = 0, MaxValue = 1, Step = 0.05, Value = _preferences.SfxVolume, CustomMinimumSize = new Vector2(280, 24) };
        sfx.ValueChanged += value => { _preferences.SfxVolume = (float)value; SavePreferences(); }; column.AddChild(sfx);
        var fullscreen = MenuChoice(_preferences.Fullscreen ? "VOLLBILD  AN" : "VOLLBILD  AUS", () => { });
        fullscreen.Pressed += () => { _preferences.Fullscreen = !_preferences.Fullscreen; fullscreen.Text = _preferences.Fullscreen ? "VOLLBILD  AN" : "VOLLBILD  AUS"; SavePreferences(); };
        column.AddChild(fullscreen);
        column.AddChild(MenuChoice("ZURÜCK", back));
    }

    private void TogglePauseMenu()
    {
        if (_pauseOverlay is not null) { ClosePauseMenu(); return; }
        if (_inputLocked) return;
        _inputLocked = true;
        var shade = new ColorRect { Color = new Color(0.015f, 0.008f, 0.006f, 0.86f), MouseFilter = Control.MouseFilterEnum.Stop, ZIndex = 500 };
        shade.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); _root.AddChild(shade); _pauseOverlay = shade;
        var center = new CenterContainer(); center.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); shade.AddChild(center);
        var panel = Panel(new Vector2(310, 290)); center.AddChild(panel);
        var column = Column(7); panel.AddChild(column);
        column.AddChild(Text("PAUSE", 22, Brass));
        column.AddChild(MenuChoice("WEITERSPIELEN", ClosePauseMenu));
        column.AddChild(MenuChoice("EINSTELLUNGEN", () => { ClosePauseMenu(); ShowSettings(Render); }));
        var save = MenuChoice("SPEICHERN", () => SaveQuietly(true)); save.Disabled = _session is null; column.AddChild(save);
        column.AddChild(MenuChoice("ZUM HAUPTMENÜ", () => { SaveQuietly(); ClosePauseMenu(); ShowMenu(); }));
        column.AddChild(MenuChoice("SPEICHERN & BEENDEN", () => { SaveQuietly(); SaveProfile(); GetTree().Quit(); }));
    }

    private void ClosePauseMenu()
    {
        if (_pauseOverlay is null) return;
        _pauseOverlay.Hide(); _pauseOverlay.QueueFree(); _pauseOverlay = null; _inputLocked = false;
    }

    private CardViewV2 Card(CardCopyV2 copy, bool faceUp, bool enabled, bool compact = false)
    {
        var view = new CardViewV2 { Disabled = !enabled, MouseFilter = faceUp ? Control.MouseFilterEnum.Stop : Control.MouseFilterEnum.Ignore };
        if (compact) view.CustomMinimumSize = new Vector2(36, 50);
        view.Configure(copy, _catalog.GetCard(copy.DefinitionId), !faceUp);
        WireCardInspector(view);
        if (enabled) { var id = copy.CopyId; view.Pressed += () => _ = Dispatch(new PlayCardActionV2(Actor.Player, id)); }
        return view;
    }

    private CardViewV2 CreatePreviewCard(string definitionId, Vector2 size)
    {
        var view = new CardViewV2 { CustomMinimumSize = size };
        view.Configure(new CardCopyV2(-1, definitionId, CardOwnerV2.Neutral, PersistenceScopeV2.Neutral), _catalog.GetCard(definitionId));
        WireCardInspector(view);
        return view;
    }

    private void WireCardInspector(CardViewV2 view)
    {
        view.InspectRequested += (definition, position, sourceId) => _cardInspector.ShowCard(definition, position, sourceId);
        view.InspectEnded += sourceId => _cardInspector.HideCard(sourceId);
    }

    private void ChooseTrinketSlot(string incomingTrinketId, Action<string?> choose)
    {
        var owned = _session!.Snapshot().TrinketIds;
        if (owned.Count < RunSessionV2.MaximumTrinkets) { choose(null); return; }

        BeginScreen("ReplaceTrinket");
        var column = Column(8); _screen!.AddChild(column);
        column.AddChild(Hud(_session.Snapshot(), "TRINKET-ABLAGE"));
        column.AddChild(Text($"{TrinketName(incomingTrinketId).ToUpperInvariant()} braucht einen freien Platz.\nWelches Trinket soll gehen?", 10, Muted));
        var row = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center, SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        row.AddThemeConstantOverride("separation", 6);
        foreach (var id in owned)
        {
            var captured = id;
            var definition = _catalog.GetTrinket(id);
            var button = Button($"{definition.DisplayName.ToUpperInvariant()}\n{definition.Description}", () => choose(captured), true);
            button.CustomMinimumSize = new Vector2(116, 76); row.AddChild(button);
        }
        column.AddChild(row);
        column.AddChild(Button("ABBRECHEN", Render, true));
    }
    private string TrinketName(string id) => _catalog.GetTrinket(id).DisplayName;
    private static string StatusLabel(StatusInstanceV2 status) => status.Id switch { "status.skip" => $"AUSSETZEN {status.Charges}", "status.curse" => $"FLUCH {status.Charges}", "status.spy" => $"SPION {status.Duration}", "status.hodl" => $"HODL {status.Duration}", _ => status.Id };
    private static string NodeLabel(MapNodeV2 node) => node.Type switch { NodeTypeV2.Battle => "♣ KAMPF", NodeTypeV2.Elite => "♠ ELITE", NodeTypeV2.Shop => "$ SHOP", NodeTypeV2.Lounge => "♥ LOUNGE", NodeTypeV2.Event => "? EREIGNIS", _ => "★ BOSS" };
    private static string TranslateToast(string key) => key.StartsWith("reshuffle", StringComparison.Ordinal) ? "Ablage neu gemischt." : key.StartsWith("trinket", StringComparison.Ordinal) ? "Trinket ausgelöst." : key;

    private void SaveQuietly(bool toast = false)
    {
        if (_session is null) return;
        try { _saveService.Save(_runPath, _session); if (toast) Toast("Run gespeichert."); }
        catch (IOException exception) { GD.PushError(exception.ToString()); if (toast) Toast("Speichern fehlgeschlagen.", true); }
    }

    private void LoadProfile()
    {
        var loaded = _profileService.Load(_profilePath);
        if (loaded.IsSuccess) _profile = loaded.Profile!;
    }

    private void SaveProfile()
    {
        try { _profileService.Save(_profilePath, _profile); } catch (IOException exception) { GD.PushError(exception.ToString()); }
    }

    private void ApplyRunToProfile(bool completed)
    {
        if (_session is null) return; var snapshot = _session.Snapshot();
        var unlocks = new List<string>();
        var order = new[] { "starter.igniter", "starter.cheater", "starter.alchemist" };
        var next = order.FirstOrDefault(id => !_profile.UnlockedStarterDeckIds.Contains(id, StringComparer.Ordinal)); if (completed && next is not null) unlocks.Add(next);
        _profile = _profileService.ApplyRunResult(_profile, new ProfileRunResultV1(snapshot.RunId, snapshot.Score, snapshot.EndlessCycle, completed, new ProfileUnlockOptionsV1(unlocks, [], [])));
        SaveProfile();
    }

    private void Toast(string message, bool error = false)
    {
        _toast.Text = message; _toast.AddThemeColorOverride("font_color", error ? Ember : Brass); _toast.Show();
        var tween = CreateTween(); tween.TweenInterval(2.2); tween.TweenCallback(Callable.From(_toast.Hide));
    }

    private async Task RunSmokeTest()
    {
        try
        {
            await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            RunSessionV2? session = null;
            HashSet<string>? bosses = null;
            var steps = 0;
            for (ulong seed = 1; seed <= 64 && session is null; seed++)
            {
                var candidate = RunSessionV2.CreateNew(seed, catalog: _catalog);
                var visited = new HashSet<string>(StringComparer.Ordinal);
                if (!DriveAutomatedCampaign(candidate, visited, out steps)) continue;
                session = candidate;
                bosses = visited;
            }
            if (session is null || bosses is null) throw new InvalidOperationException("V2 smoke campaign did not reach victory.");
            if (!new[] { "boss.shark", "boss.madame-smoke", "boss.house" }.All(bosses.Contains))
                throw new InvalidOperationException("V2 smoke campaign did not visit all three bosses.");
            _saveService.Save(ProjectSettings.GlobalizePath("user://smoke-v2.json"), session);
            var loaded = _saveService.Load(ProjectSettings.GlobalizePath("user://smoke-v2.json"), _catalog);
            if (!loaded.IsSuccess) throw new InvalidOperationException("V2 smoke save/load failed.");
            session.Handle(new EnterEndlessActionV2());
            if (session.Phase != RunPhaseV2.Map || session.Snapshot().Mode != RunModeV2.Endless)
                throw new InvalidOperationException("V2 smoke failed to enter Nachglut.");
            GD.Print($"ZUENDUNG_V2_SMOKE_OK phase={session.Phase} mode={session.Snapshot().Mode} bosses={bosses.Count} steps={steps}"); GetTree().Quit(0);
        }
        catch (Exception exception) { GD.PushError(exception.ToString()); GetTree().Quit(1); }
    }

    private static bool DriveAutomatedCampaign(RunSessionV2 session, HashSet<string> bosses, out int steps)
    {
        for (steps = 0; steps < 250000; steps++)
        {
            var snapshot = session.Snapshot();
            switch (snapshot.Phase)
            {
                case RunPhaseV2.Map:
                    var node = snapshot.Map.Nodes.Where(item => item.VisitState == NodeVisitState.Available)
                        .OrderBy(item => item.Type switch { NodeTypeV2.Event => 0, NodeTypeV2.Lounge => 1, NodeTypeV2.Shop => 2, NodeTypeV2.Battle => 3, NodeTypeV2.Elite => 4, _ => 5 })
                        .ThenBy(item => item.Column).First();
                    session.Handle(new ChooseNodeActionV2(node.NodeId));
                    break;
                case RunPhaseV2.Encounter:
                    var encounter = snapshot.Encounter!;
                    if (encounter.Kind == EncounterKindV2.Boss) bosses.Add(encounter.EnemyId);
                    if (encounter.PendingDecision is { } decision)
                        session.Handle(new SubmitDecisionActionV2(decision.DecisionId, decision.OptionCopyIds.Take(decision.MinimumSelections).ToArray()));
                    else if (encounter.ActiveActor == Actor.Opponent)
                        session.Handle(new AdvanceOpponentActionV2());
                    else
                    {
                        var playable = encounter.PlayerHand.FirstOrDefault(session.IsPlayable);
                        session.Handle(playable == 0 ? new DrawCardActionV2(Actor.Player) : new PlayCardActionV2(Actor.Player, playable));
                    }
                    break;
                case RunPhaseV2.CardReward:
                    session.Handle(new ChooseCardRewardActionV2(snapshot.Reward!.CardDefinitionIds[0]));
                    break;
                case RunPhaseV2.TrinketReward:
                    var trinket = snapshot.Reward!.TrinketIds.FirstOrDefault();
                    var replacement = trinket is not null && snapshot.TrinketIds.Count >= RunSessionV2.MaximumTrinkets ? snapshot.TrinketIds[0] : null;
                    session.Handle(new ChooseTrinketRewardActionV2(trinket, replacement));
                    break;
                case RunPhaseV2.Shop:
                    session.Handle(new LeaveShopActionV2());
                    break;
                case RunPhaseV2.Lounge:
                    session.Handle(new ChooseLoungeActionV2(LoungeChoiceV2.TakeMoney));
                    break;
                case RunPhaseV2.Event:
                    var eventState = snapshot.Event!;
                    var option = eventState.EventId == "event.open-tab" && snapshot.Lives > 1
                        ? eventState.Options.First(item => item.OptionId == "event.tab.risk")
                        : eventState.Options.Last();
                    session.Handle(new ChooseEventOptionActionV2(option.OptionId));
                    break;
                case RunPhaseV2.Victory:
                    return true;
                case RunPhaseV2.Defeat:
                    return false;
            }
        }
        throw new InvalidOperationException("Automated V2 campaign exceeded its action guard.");
    }

    private void PrepareQaEncounter()
    {
        var run = RunSessionV2.CreateNew(7, "starter.classic", _catalog);
        var battle = run.Snapshot().Map.Nodes.First(node => node.VisitState == NodeVisitState.Available && node.Type == NodeTypeV2.Battle);
        run.Handle(new ChooseNodeActionV2(battle.NodeId));
        _session = run;
        Render();
    }

    private async Task ShowQaSpecialOverlay()
    {
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        _ignition.TriggerForQa(V2ContentIds.Stillstand, Actor.Player, Actor.Opponent);
    }

    private async Task ShowQaCardInspector()
    {
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        _cardInspector.ShowCard(_catalog.GetCard(V2ContentIds.Stillstand), new Vector2(500, 300), ulong.MaxValue);
    }

    private void PrepareQaShop()
    {
        var run = RunSessionV2.CreateNew(11, "starter.classic", _catalog);
        var firstEvent = run.Snapshot().Map.Nodes.Single(node => node.Row == 0 && node.Type == NodeTypeV2.Event && node.VisitState == NodeVisitState.Available);
        run.Handle(new ChooseNodeActionV2(firstEvent.NodeId));
        var eventOption = run.Snapshot().Event!.Options.Last();
        run.Handle(new ChooseEventOptionActionV2(eventOption.OptionId));
        var lounge = run.Snapshot().Map.Nodes.Single(node => node.Row == 1 && node.Type == NodeTypeV2.Lounge && node.VisitState == NodeVisitState.Available);
        run.Handle(new ChooseNodeActionV2(lounge.NodeId));
        run.Handle(new ChooseLoungeActionV2(LoungeChoiceV2.TakeMoney));
        var shop = run.Snapshot().Map.Nodes.Single(node => node.Row == 2 && node.Type == NodeTypeV2.Shop && node.VisitState == NodeVisitState.Available);
        run.Handle(new ChooseNodeActionV2(shop.NodeId));
        _session = run;
        Render();
    }

    private static ProfileSnapshotV1 DefaultProfile() => new(1, ["starter.classic"], [], [], [], 0, 0, 0);
    private static VBoxContainer Column(int separation) { var value = new VBoxContainer { Alignment = BoxContainer.AlignmentMode.Center }; value.AddThemeConstantOverride("separation", separation); return value; }
    private static Control Header(string title, string subtitle) { var value = Column(1); value.AddChild(Text(title, 17, Brass)); value.AddChild(Text(subtitle, 8, Muted)); return value; }
    private static PanelContainer Panel(Vector2 minimum)
    {
        var value = new PanelContainer { CustomMinimumSize = minimum };
        var style = Box(new Color(0.045f, 0.021f, 0.014f, 0.96f), Brass, 2, 5);
        style.ShadowColor = new Color(0, 0, 0, 0.72f);
        style.ShadowSize = 8;
        value.AddThemeStyleboxOverride("panel", style);
        return value;
    }
    private static StyleBoxFlat HudBox() => Box(new Color(0.035f, 0.017f, 0.01f, 0.82f), new Color(0.76f, 0.56f, 0.22f, 0.78f), 1, 3);
    private static StyleBoxFlat Box(Color fill, Color border, int width, int radius) => new() { BgColor = fill, BorderColor = border, BorderWidthLeft = width, BorderWidthRight = width, BorderWidthTop = width, BorderWidthBottom = width, CornerRadiusTopLeft = radius, CornerRadiusTopRight = radius, CornerRadiusBottomLeft = radius, CornerRadiusBottomRight = radius, ContentMarginLeft = 7, ContentMarginRight = 7, ContentMarginTop = 5, ContentMarginBottom = 5 };
    private static Label Text(string text, int size, Color color, bool centered = true, bool expand = false) { var value = new Label { Text = text, HorizontalAlignment = centered ? HorizontalAlignment.Center : HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Center, AutowrapMode = TextServer.AutowrapMode.WordSmart, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill }; value.AddThemeFontSizeOverride("font_size", size); value.AddThemeColorOverride("font_color", color); return value; }
    private static Button Button(string text, Action action, bool compact = false) { var value = new Button { Text = text, CustomMinimumSize = compact ? new Vector2(110, 28) : new Vector2(230, 38), FocusMode = Control.FocusModeEnum.All }; value.Pressed += action; return value; }
    private static Button MenuChoice(string text, Action action)
    {
        var value = new Button { Text = text, Flat = true, CustomMinimumSize = new Vector2(200, 26), FocusMode = Control.FocusModeEnum.All, MouseDefaultCursorShape = Control.CursorShape.PointingHand };
        value.AddThemeFontSizeOverride("font_size", 10);
        value.AddThemeColorOverride("font_color", Ivory);
        value.AddThemeColorOverride("font_hover_color", Brass);
        value.AddThemeStyleboxOverride("normal", Box(new Color(0.06f, 0.025f, 0.015f, 0.45f), new Color(0.72f, 0.52f, 0.2f, 0.35f), 1, 2));
        value.AddThemeStyleboxOverride("hover", Box(new Color(0.31f, 0.07f, 0.09f, 0.92f), Brass, 1, 2));
        value.Pressed += action;
        return value;
    }
}
