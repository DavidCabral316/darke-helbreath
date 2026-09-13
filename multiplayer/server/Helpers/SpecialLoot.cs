using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Server-owned procedural loot affixes stored in the existing per-instance effect payload.</summary>
public static class SpecialLoot {
    public const int Damage = 100, Defense = 101, AttackSpeed = 102, CriticalChance = 103,
        PoisonChance = 104, BurnChance = 105, FreezeChance = 106, ParalysisChance = 107,
        LifeSteal = 108, ManaSteal = 109, Health = 110, Mana = 111, GoldFind = 112,
        ExperienceFind = 113, RequiredLevel = 114, Rarity = 115;

    private static readonly HashSet<string> EquipmentTypes = new(StringComparer.Ordinal) {
        "weapon", "shield", "armor", "hauberk", "leggings", "helmet", "cape", "boots"
    };

    private sealed record Affix(int Effect, string Name, int Color, bool WeaponOnly = false, bool ArmorOnly = false);
    private static readonly Affix[] Affixes = {
        new(Damage, "Afilado", 0xffd166, WeaponOnly: true),
        new(AttackSpeed, "Ágil", 0x66f7ff, WeaponOnly: true),
        new(CriticalChance, "Crítico", 0xffe066, WeaponOnly: true),
        new(PoisonChance, "Venenoso", 0x43dc68, WeaponOnly: true),
        new(BurnChance, "Ígneo", 0xff5138, WeaponOnly: true),
        new(FreezeChance, "Glacial", 0x55aaff, WeaponOnly: true),
        new(ParalysisChance, "Fulminante", 0xb968ff, WeaponOnly: true),
        new(LifeSteal, "Vampírico", 0xdc3d77, WeaponOnly: true),
        new(ManaSteal, "Arcano", 0x5577ff, WeaponOnly: true),
        new(Defense, "Fortificado", 0xc9d2d9, ArmorOnly: true),
        new(Health, "Vital", 0xff7185, ArmorOnly: true),
        new(Mana, "Sabio", 0x668cff, ArmorOnly: true),
        new(GoldFind, "Próspero", 0xffc83d),
        new(ExperienceFind, "Iluminado", 0xe9e0ff),
    };

    public sealed record Roll(int ItemId, ItemEffectConfig[] Effects, string DisplayName, int RarityTier);

    public static Roll? TryRoll(GameWorldRef wr, MonsterReward reward) {
        var monsterTier = TierForExperience(reward.Experience);
        var chance = new[] { .0025, .0035, .005, .0075, .010, .014, .020, .030, .045 }[monsterTier - 1];
        if (Random.Shared.NextDouble() >= chance) return null;

        var levelCap = new[] { 10, 30, 50, 70, 90, 110, 130, 180, 190 }[monsterTier - 1];
        var levelFloor = Math.Max(1, levelCap - (monsterTier <= 2 ? 20 : 35));
        var candidates = Adventure.Rules.Equipment
            .Where(e => e.Value.Level >= levelFloor && e.Value.Level <= levelCap &&
                wr.ItemsById.TryGetValue(e.Key, out var item) && EquipmentTypes.Contains(item.ItemType))
            .ToArray();
        if (candidates.Length == 0) return null;
        var chosen = candidates[Random.Shared.Next(candidates.Length)];
        var itemDef = wr.ItemsById[chosen.Key];
        var isWeapon = itemDef.ItemType == "weapon";

        var rarity = RollRarity(monsterTier);
        var pool = Affixes.Where(a => !a.WeaponOnly || isWeapon).Where(a => !a.ArmorOnly || !isWeapon).OrderBy(_ => Random.Shared.Next()).ToArray();
        var affixCount = Math.Min(rarity, pool.Length);
        var effects = new List<ItemEffectConfig>(affixCount + 5);
        for (var i = 0; i < affixCount; i++) effects.Add(new ItemEffectConfig(pool[i].Effect, Magnitude(pool[i].Effect, chosen.Value.Level, rarity)));

        var primary = pool[0];
        effects.Add(new ItemEffectConfig(RequiredLevel, Math.Min(Adventure.MaxLevel, chosen.Value.Level + Math.Max(0, rarity - 1) * 2)));
        effects.Add(new ItemEffectConfig(Rarity, rarity));
        effects.Add(new ItemEffectConfig(3, primary.Color)); // GLOW
        effects.Add(new ItemEffectConfig(4, primary.Color)); // inventory tint
        effects.Add(new ItemEffectConfig(5, primary.Color)); // equipped tint
        var quality = rarity switch { 1 => "Superior", 2 => "Excepcional", 3 => "Heroico", _ => "Mítico" };
        return new Roll(chosen.Key, effects.ToArray(), $"{itemDef.Name} {primary.Name} · {quality}", rarity);
    }

    public static int Value(IEnumerable<ItemEffectConfig>? effects, int effect) =>
        effects?.FirstOrDefault(e => e.Effect == effect)?.EffectColor ?? 0;

    public static int RequiredLevelFor(InventoryItemState item, int catalogLevel) =>
        Math.Max(catalogLevel, Value(item.EffectOverrides, RequiredLevel));

    private static int TierForExperience(int xp) => xp switch {
        < 100 => 1, < 500 => 2, < 1500 => 3, < 5000 => 4, < 10000 => 5,
        < 20000 => 6, < 40000 => 7, < 80000 => 8, _ => 9
    };

    private static int RollRarity(int monsterTier) {
        var roll = Random.Shared.NextDouble();
        if (monsterTier >= 8 && roll < .04) return 4;
        if (monsterTier >= 5 && roll < .16) return 3;
        if (roll < .48) return 2;
        return 1;
    }

    private static int Magnitude(int effect, int level, int rarity) {
        var scale = Math.Max(1, level / 20 + 1);
        return effect switch {
            Damage => 1 + scale * rarity,
            Defense => 1 + Math.Max(1, scale / 2) * rarity,
            AttackSpeed => 8 + 5 * rarity + Math.Min(35, level / 4),
            CriticalChance => 20 + 12 * rarity + Math.Min(45, level / 3), // per mille
            PoisonChance => 18 + 10 * rarity + Math.Min(35, level / 4),
            BurnChance => 15 + 9 * rarity + Math.Min(30, level / 5),
            FreezeChance => 12 + 7 * rarity + Math.Min(24, level / 7),
            ParalysisChance => 8 + 5 * rarity + Math.Min(18, level / 9),
            LifeSteal => 2 + rarity * 2,
            ManaSteal => 1 + rarity * 2,
            Health => 10 + level * rarity / 2,
            Mana => 8 + level * rarity / 3,
            GoldFind => 3 + rarity * 3,
            ExperienceFind => 2 + rarity * 2,
            _ => rarity,
        };
    }
}
