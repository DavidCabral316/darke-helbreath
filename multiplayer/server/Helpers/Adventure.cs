using System.Text.Json;
using Mmorpg.Network;
using Server.Portal;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

public sealed record ProgressState(int Level = 1, long Experience = 0, int Strength = 10,
    int Vitality = 10, int Intelligence = 10, int Agility = 10, int Points = 0,
    int Mana = 60, int Stamina = 100, int Kills = 0, int Gold = 0,
    int KnownSpellsMask = 0, PersistedInventoryItem[]? Warehouse = null, long TradeRevision = 0,
    int QuestRewardsMask = 0);
public sealed record LootRow(int ItemId, double Chance, int Min, int Max);
public sealed record MonsterReward(int Experience, LootRow[] Drops, int GoldMin = 0, int GoldMax = 0);
public sealed record EquipmentBonus(int Damage = 0, int Defense = 0, int Level = 1, int Magic = 0, int Mana = 0,
    int AttackSpeed = 0);
public sealed record SpellCost(int Level, int Mana, int Intelligence = 10, int PowerPercent = 100);
public sealed record AdventureRules(long[] LevelThresholds, int PointsPerLevel,
    Dictionary<string, MonsterReward> Monsters, Dictionary<int, EquipmentBonus> Equipment, Dictionary<int, SpellCost> Spells);

public static class Adventure {
    public const string TrainingWorld = "training";
    public const int SpawnX = 150, SpawnY = 150;
    public static AdventureRules Rules { get; } = LoadRules();
    public static int MaxLevel => Rules.LevelThresholds.Length;
    private static AdventureRules LoadRules() {
        var rules = JsonSerializer.Deserialize<AdventureRules>(File.ReadAllText("Config/Adventure.json"), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        if (rules.LevelThresholds.Length < 2 || rules.LevelThresholds[0] != 0 || rules.PointsPerLevel < 1 ||
            rules.LevelThresholds.Zip(rules.LevelThresholds.Skip(1)).Any(p => p.Second <= p.First) ||
            rules.Monsters.Values.Any(m => m.Experience < 1 || m.Drops.Any(d => d.Chance < 0 || d.Chance > 1 || d.Min < 1 || d.Max < d.Min || d.Max > 100)) ||
            rules.Spells.Values.Any(s => s.Level < 1 || s.Mana < 1 || s.Intelligence < 10 || s.PowerPercent < 1))
            throw new InvalidOperationException("Invalid Adventure.json rules.");
        return rules;
    }
    public static bool IsSanctuary(GameWorldRef wr, GameWorldPlayer player) =>
        Economy.IsInterior(wr.WorldId) || (wr.WorldId == TrainingWorld && Math.Abs(player.PosX - SpawnX) <= 5 && Math.Abs(player.PosY - SpawnY) <= 5);

    public static void Send(GameWorldRef wr, GameWorldPlayer player, string notice = "") {
        var p = player.Progress;
        NetworkManager.SendToPlayer(player, new ServerMessage { ProgressionUpdated = new ProgressionUpdated {
            Level = p.Level, Experience = p.Experience, LevelStart = Rules.LevelThresholds[p.Level - 1],
            NextLevel = p.Level < MaxLevel ? Rules.LevelThresholds[p.Level] : p.Experience,
            MaxLevel = MaxLevel, Strength = p.Strength, Vitality = p.Vitality, Intelligence = p.Intelligence,
            Agility = p.Agility, Points = p.Points, Hp = player.Hp, MaxHp = player.MaxHp,
            Mana = p.Mana, MaxMana = player.MaxMana, Stamina = p.Stamina, MaxStamina = player.MaxStamina,
            Damage = player.Damage, Defense = player.Defense, MagicDamage = player.MagicDamage,
            Kills = p.Kills, Notice = notice, Sanctuary = IsSanctuary(wr, player), X = player.PosX, Y = player.PosY,
            Gold = p.Gold, TradeRevision = p.TradeRevision, QuestRewardsMask = p.QuestRewardsMask,
            KnownSpells = { Rules.Spells.Keys.Where(id => (p.KnownSpellsMask & (1 << id)) != 0) }, Service = Economy.ServiceAt(wr, player), WorldId = wr.WorldId,
            Warehouse = { (p.Warehouse ?? Array.Empty<PersistedInventoryItem>()).Select(i => NetworkManager.ToInventoryItemEntry(InventoryItemState.FromPersistedItem(i))) }
        }});
    }
    public static bool Checkpoint(GameWorldRef wr, GameWorldPlayer player) {
        if (string.IsNullOrEmpty(player.PersistenceKey)) return true;
        try { CharacterPersistence.Save(player.PersistenceKey, player.CreatePersistenceState(wr.WorldId)); return true; }
        catch (Exception ex) { Console.Error.WriteLine($"[Adventure] Pending save for {player.PlayerId}: {ex.Message}"); Send(wr, player, "Guardado pendiente: el servidor volverá a intentarlo."); return false; }
    }
    public static void Allocate(GameWorldRef wr, GameWorldPlayer player, string attribute) {
        if (!player.TryAllocateAttribute(attribute)) { Send(wr, player, "No se pudo asignar ese punto."); return; }
        Spawn.SendInitialState(wr, player, includeSpells: true);
        Send(wr, player, "Atributo mejorado."); Checkpoint(wr, player);
    }
    // Actual damage, not reported client damage. The largest eligible contributor receives
    // this solo-stage reward. A monster lifetime can be rewarded exactly once in this world.
    public static void RecordHit(GameWorldRef wr, GameWorldMonster monster, GameWorldPlayer? attacker, int actualDamage) {
        if (attacker is not null && actualDamage > 0) {
            monster.Contributions.TryGetValue(attacker.PlayerId, out var total);
            monster.Contributions[attacker.PlayerId] = total + actualDamage;
        }
        if (!monster.Dead || monster.RewardClaimed) return;
        monster.RewardClaimed = true;
        if (!Rules.Monsters.TryGetValue(monster.Name, out var reward)) return;
        GameWorldPlayer? winner = null;
        foreach (var contribution in monster.Contributions.OrderByDescending(x => x.Value).ThenBy(x => x.Key)) {
            if (wr.World.TryGetConnectedPlayerById(contribution.Key, out var candidate) && !candidate.IsDead &&
                Math.Abs(candidate.PosX - monster.PosX) <= 24 && Math.Abs(candidate.PosY - monster.PosY) <= 24) { winner = candidate; break; }
        }
        if (winner is null) return;
        var before = winner.Progress.Level;
        var experience = winner.ApplyExperienceFind(reward.Experience);
        winner.AwardExperience(experience);
        var gold = winner.ApplyGoldFind(Random.Shared.Next(reward.GoldMin, reward.GoldMax + 1));
        winner.AddGold(gold);
        foreach (var drop in reward.Drops) {
            if (Random.Shared.NextDouble() < drop.Chance) wr.World.DropAdventureLoot(monster, winner, drop.ItemId, Random.Shared.Next(drop.Min, drop.Max + 1));
        }
        var special = SpecialLoot.TryRoll(wr, reward);
        if (special is not null) wr.World.DropAdventureLoot(monster, winner, special.ItemId, 1, special.Effects);
        if (winner.Progress.Level != before) Spawn.SendInitialState(wr, winner, includeSpells: true);
        Send(wr, winner, special is not null ? $"✦ HALLAZGO ESPECIAL: {special.DisplayName}" : winner.Progress.Level > before ? $"¡Nivel {winner.Progress.Level}! Tenés {winner.Progress.Points} puntos para distribuir." :
            winner.Progress.Level == MaxLevel ? $"+{gold} oro · Seguí explorando y consiguiendo equipo." : $"+{experience} XP · +{gold} oro · {monster.Name}");
        Checkpoint(wr, winner);
    }
}
