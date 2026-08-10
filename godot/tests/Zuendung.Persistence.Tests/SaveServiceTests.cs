using Zuendung.Domain;
using Zuendung.Persistence;
using Xunit;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Zuendung.Persistence.Tests;

public sealed class SaveServiceTests : IDisposable
{
    private readonly string _directory = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "zuendung-tests-" + Guid.NewGuid().ToString("N"));
    private string Path => System.IO.Path.Combine(_directory, "run.json");
    public SaveServiceTests() => Directory.CreateDirectory(_directory);
    public void Dispose() { if (Directory.Exists(_directory)) Directory.Delete(_directory, true); }

    [Fact]
    public void Round_trip_preserves_mid_round_state_and_future_events()
    {
        var original = GameSession.CreateNew(42);
        var card = original.Snapshot().Round!.PlayerHand.First(x => original.IsPlayable(x));
        original.Handle(new PlayCardAction(Actor.Player, card.InstanceId));
        var service = new SaveService(); service.Save(Path, original);
        var restored = Assert.IsType<GameSession>(service.Load(Path).Session);
        AssertSameSnapshot(original, restored);
        Assert.Equal(original.Handle(new AdvanceOpponentAction()), restored.Handle(new AdvanceOpponentAction()));
    }

    [Fact]
    public void Corrupt_primary_recovers_from_backup()
    {
        var service = new SaveService(); var session = GameSession.CreateNew(9);
        service.Save(Path, session); service.Save(Path, session);
        File.WriteAllText(Path, "not json");
        var result = service.Load(Path);
        Assert.True(result.IsSuccess); Assert.True(result.RecoveredFromBackup);
    }

    [Fact]
    public void Dual_corruption_is_non_destructive()
    {
        File.WriteAllText(Path, "bad-primary"); File.WriteAllText(Path + ".bak", "bad-backup");
        var result = new SaveService().Load(Path);
        Assert.False(result.IsSuccess); Assert.Contains("primary", result.Error!);
        Assert.Equal("bad-primary", File.ReadAllText(Path)); Assert.Equal("bad-backup", File.ReadAllText(Path + ".bak"));
    }

    [Fact]
    public void Replacing_save_creates_backup_and_leaves_no_temp_file()
    {
        var service = new SaveService(); var one = GameSession.CreateNew(1); var two = GameSession.CreateNew(2);
        service.Save(Path, one); service.Save(Path, two);
        Assert.True(File.Exists(Path + ".bak"));
        AssertSameSnapshot(one, Assert.IsType<GameSession>(service.Load(Path + ".bak").Session));
        Assert.Empty(Directory.EnumerateFiles(_directory, "*.tmp"));
    }

    [Fact]
    public void Mapper_rejects_unknown_schema()
    {
        var document = SaveDocumentMapper.ToDocument(GameSession.CreateNew(1).Snapshot());
        document.SchemaVersion = 99;
        Assert.Throws<InvalidDataException>(() => SaveDocumentMapper.ToSnapshot(document));
    }

    [Fact]
    public void Reward_and_shop_phases_round_trip()
    {
        var winning = FindWinningSession();
        var service = new SaveService();
        service.Save(Path, winning);
        AssertSameSnapshot(winning, Assert.IsType<GameSession>(service.Load(Path).Session));

        winning.Handle(new ClaimRewardAction());
        var offer = winning.Snapshot().Shop!.Offers.First(item => item.Price <= winning.Money - 2);
        winning.Handle(new BuyOfferAction(offer.OfferId));
        winning.Handle(new RerollShopAction());
        service.Save(Path, winning);
        var shop = Assert.IsType<GameSession>(service.Load(Path).Session);
        Assert.Equal(RunPhase.Shop, shop.Phase);
        Assert.Single(shop.Snapshot().Shop!.PurchasedDefinitionIds);
        AssertSameSnapshot(winning, shop);
    }

    [Fact]
    public void Unknown_content_id_is_rejected_without_overwriting_save()
    {
        var document = SaveDocumentMapper.ToDocument(GameSession.CreateNew(1).Snapshot());
        document.OwnedDefinitionIds[0] = "missing.card";
        var json = JsonSerializer.Serialize(document, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        File.WriteAllText(Path, json);

        var result = new SaveService().Load(Path);
        Assert.False(result.IsSuccess);
        Assert.Contains("missing.card", result.Error!);
        Assert.Equal(json, File.ReadAllText(Path));
    }

    [Fact]
    public void Null_zone_element_recovers_from_valid_backup()
    {
        var service = new SaveService();
        var session = GameSession.CreateNew(14);
        service.Save(Path, session);
        service.Save(Path, session);
        var malformed = SaveDocumentMapper.ToDocument(session.Snapshot());
        malformed.Round!.DrawPile[0] = null!;
        File.WriteAllText(Path, JsonSerializer.Serialize(malformed, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));

        var result = service.Load(Path);
        Assert.True(result.IsSuccess);
        Assert.True(result.RecoveredFromBackup);
    }

    [Fact]
    public void Semantically_invalid_primary_recovers_from_valid_backup()
    {
        var service = new SaveService();
        var session = GameSession.CreateNew(15);
        service.Save(Path, session);
        service.Save(Path, session);
        var root = JsonNode.Parse(File.ReadAllText(Path))!.AsObject();
        root["pendingReward"] = -10;
        File.WriteAllText(Path, root.ToJsonString());

        var result = service.Load(Path);
        Assert.True(result.IsSuccess);
        Assert.True(result.RecoveredFromBackup);
    }

    private static GameSession FindWinningSession()
    {
        for (ulong seed = 1; seed <= 256; seed++)
        {
            var session = GameSession.CreateNew(seed);
            var safety = 0;
            while (session.Phase == RunPhase.InRound && safety++ < 5000)
            {
                var round = session.Snapshot().Round!;
                if (round.ActiveActor == Actor.Opponent) session.Handle(new AdvanceOpponentAction());
                else
                {
                    var playable = round.PlayerHand.FirstOrDefault(session.IsPlayable);
                    session.Handle(playable is null ? new DrawCardAction(Actor.Player) : new PlayCardAction(Actor.Player, playable.InstanceId));
                }
            }
            if (session.Phase == RunPhase.Reward) return session;
        }
        throw new InvalidOperationException("No deterministic winning seed found.");
    }

    private static void AssertSameSnapshot(GameSession expected, GameSession actual) =>
        Assert.Equal(JsonSerializer.Serialize(SaveDocumentMapper.ToDocument(expected.Snapshot())), JsonSerializer.Serialize(SaveDocumentMapper.ToDocument(actual.Snapshot())));
}
