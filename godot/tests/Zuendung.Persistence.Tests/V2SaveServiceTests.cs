using System.Text.Json.Nodes;
using System.Text.Json;
using Zuendung.Domain;
using Zuendung.Domain.V2;
using Zuendung.Persistence;
using Xunit;

namespace Zuendung.Persistence.Tests;

public sealed class V2SaveServiceTests : IDisposable
{
    private readonly string _directory = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "zuendung-v2-tests-" + Guid.NewGuid().ToString("N"));
    private string RunPath => System.IO.Path.Combine(_directory, "run-v2.json");
    private string ProfilePath => System.IO.Path.Combine(_directory, "profile.json");
    public V2SaveServiceTests() => Directory.CreateDirectory(_directory);
    public void Dispose() { if (Directory.Exists(_directory)) Directory.Delete(_directory, true); }

    [Fact]
    public void Run_round_trip_and_corrupt_primary_recovers_backup()
    {
        var service = new V2SaveService();
        var original = RunSessionV2.CreateNew(42);
        service.Save(RunPath, original); service.Save(RunPath, original);
        File.WriteAllText(RunPath, "not json");

        var result = service.Load(RunPath);

        Assert.True(result.IsSuccess); Assert.True(result.RecoveredFromBackup);
        Assert.Equal(JsonSerializer.Serialize(original.Snapshot()), JsonSerializer.Serialize(result.Session!.Snapshot()));
    }

    [Fact]
    public void Semantically_invalid_run_is_rejected_and_backup_is_used()
    {
        var service = new V2SaveService(); var run = RunSessionV2.CreateNew(7);
        service.Save(RunPath, run); service.Save(RunPath, run);
        var root = JsonNode.Parse(File.ReadAllText(RunPath))!.AsObject();
        root["run"]!.AsObject()["lives"] = 99;
        File.WriteAllText(RunPath, root.ToJsonString());

        var result = service.Load(RunPath);

        Assert.True(result.IsSuccess); Assert.True(result.RecoveredFromBackup);
    }

    [Fact]
    public void Unknown_current_map_node_is_rejected_and_backup_is_used()
    {
        var service = new V2SaveService(); var run = RunSessionV2.CreateNew(71);
        service.Save(RunPath, run); service.Save(RunPath, run);
        var root = JsonNode.Parse(File.ReadAllText(RunPath))!.AsObject();
        root["run"]!.AsObject()["map"]!.AsObject()["currentNodeId"] = "missing.node";
        File.WriteAllText(RunPath, root.ToJsonString());

        var result = service.Load(RunPath);

        Assert.True(result.IsSuccess); Assert.True(result.RecoveredFromBackup);
        Assert.Null(result.Session!.Snapshot().Map.CurrentNodeId);
    }

    [Fact]
    public void Unknown_shop_content_is_rejected_and_backup_is_used()
    {
        var service = new V2SaveService(); var run = RunSessionV2.CreateNew(72);
        var eventNode = run.Snapshot().Map.Nodes.Single(node => node.Row == 0 && node.Type == NodeTypeV2.Event);
        run.Handle(new ChooseNodeActionV2(eventNode.NodeId));
        run.Handle(new ChooseEventOptionActionV2(run.Snapshot().Event!.Options.Last().OptionId));
        var lounge = run.Snapshot().Map.Nodes.Single(node => node.VisitState == NodeVisitState.Available && node.Type == NodeTypeV2.Lounge);
        run.Handle(new ChooseNodeActionV2(lounge.NodeId));
        run.Handle(new ChooseLoungeActionV2(LoungeChoiceV2.TakeMoney));
        var shop = run.Snapshot().Map.Nodes.Single(node => node.VisitState == NodeVisitState.Available && node.Type == NodeTypeV2.Shop);
        run.Handle(new ChooseNodeActionV2(shop.NodeId));
        service.Save(RunPath, run); service.Save(RunPath, run);
        var root = JsonNode.Parse(File.ReadAllText(RunPath))!.AsObject();
        root["run"]!.AsObject()["shop"]!.AsObject()["offers"]!.AsArray()[0]!.AsObject()["contentId"] = "missing.content";
        File.WriteAllText(RunPath, root.ToJsonString());

        var result = service.Load(RunPath);

        Assert.True(result.IsSuccess); Assert.True(result.RecoveredFromBackup);
        Assert.Equal(RunPhaseV2.Shop, result.Session!.Phase);
    }

    [Fact]
    public void Profile_result_is_applied_exactly_once_and_unlocks_are_explicit()
    {
        var service = new ProfileSaveService();
        var profile = new ProfileSnapshotV1(1, [], [], [], [], 0, 0, 0);
        var result = new ProfileRunResultV1("run-1", 10, 2, true, new ProfileUnlockOptionsV1(["starter.classic"], ["trinket.lucky"], []));
        var applied = service.ApplyRunResult(profile, result);
        var duplicate = service.ApplyRunResult(applied, result);
        service.Save(ProfilePath, duplicate);

        var loaded = service.Load(ProfilePath);

        Assert.True(loaded.IsSuccess); Assert.Equal(JsonSerializer.Serialize(applied), JsonSerializer.Serialize(loaded.Profile));
        Assert.Equal(1, loaded.Profile!.RunsCompleted); Assert.Single(loaded.Profile.AppliedRunIds);
        Assert.Contains("starter.classic", loaded.Profile.UnlockedStarterDeckIds);
    }

    [Fact]
    public void V1_import_returns_fresh_valid_v2_run_and_rejects_bad_legacy_file()
    {
        var v1Path = System.IO.Path.Combine(_directory, "legacy.json");
        var legacy = new SaveService(); legacy.Save(v1Path, GameSession.CreateNew(8));
        var importer = new V1SaveImporter();

        var imported = importer.Import(v1Path, 123);
        File.WriteAllText(v1Path, "corrupt");
        var failed = importer.Import(v1Path, 123);

        Assert.True(imported.IsSuccess); Assert.Equal(RunPhaseV2.Map, imported.Session!.Phase);
        Assert.False(failed.IsSuccess);
    }
}
