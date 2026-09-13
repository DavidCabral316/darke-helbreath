using Server.Helpers;

namespace Server.World.Game;

public partial class GameWorldPlayer {
    public ProgressState Progress { get; private set; } = new();
    public string PersistenceKey { get; private set; } = "";
    private int VeteranGrowth => Math.Max(0, Progress.Level - 50);
    private int EliteGrowth => Math.Max(0, Progress.Level - 100);
    private int MythicGrowth => Math.Max(0, Progress.Level - 150);
    public int MaxMana => 60 + (Progress.Intelligence - 10) * 5 + (Progress.Level - 1) * 4 + EliteGrowth * 2 + MythicGrowth * 2 + EquipmentMana;
    public int EquipmentMana { get; private set; }
    public int EquipmentMagic { get; private set; }
    public int EquipmentHealth { get; private set; }
    public int MaxStamina => 100 + (Progress.Agility - 10) * 3 + (Progress.Level - 1) * 3 + VeteranGrowth + MythicGrowth;
    // Intelligence is the principal source of spell power. Level contributes only
    // a modest baseline, so investing in Strength never improves magic damage.
    public int MagicDamage => 6 + Progress.Intelligence * 2 + Progress.Level / 4 + EliteGrowth / 2 + MythicGrowth + EquipmentMagic;
    public int MagicDamageForSpell(int spellId) => Adventure.Rules.Spells.TryGetValue(spellId, out var spell)
        ? Math.Max(1, MagicDamage * spell.PowerPercent / 100)
        : MagicDamage;
    public int Defense { get; private set; }
    private DateTimeOffset lastCombatAt, lastPotionAt, lastRecoveryAt;

    public void RecalculateAdventureStats() {
        var weapon = 0; var armor = 0; var weaponSpeed = 0; EquipmentMana = 0; EquipmentMagic = 0; EquipmentHealth = 0;
        foreach (var item in inventoryManager.EquippedItems.Values) {
            if (Adventure.Rules.Equipment.TryGetValue(item.ItemId, out var bonus)) { weapon += bonus.Damage; armor += bonus.Defense; EquipmentMana += bonus.Mana; EquipmentMagic += bonus.Magic; weaponSpeed += bonus.AttackSpeed; }
            weapon += SpecialLoot.Value(item.EffectOverrides, SpecialLoot.Damage);
            armor += SpecialLoot.Value(item.EffectOverrides, SpecialLoot.Defense);
            weaponSpeed -= SpecialLoot.Value(item.EffectOverrides, SpecialLoot.AttackSpeed);
            EquipmentHealth += SpecialLoot.Value(item.EffectOverrides, SpecialLoot.Health);
            EquipmentMana += SpecialLoot.Value(item.EffectOverrides, SpecialLoot.Mana);
        }
        maxHp = 100 + (Progress.Vitality - 10) * 5 + (Progress.Level - 1) * 12 + VeteranGrowth * 3 + EliteGrowth * 5 + MythicGrowth * 8 + EquipmentHealth;
        hp = Math.Clamp(hp, 0, maxHp);
        damage = 6 + Progress.Strength / 2 + Progress.Level / 3 + EliteGrowth / 2 + MythicGrowth + weapon;
        Defense = (Progress.Agility - 10) / 3 + (Progress.Vitality - 10) / 4 + armor;
        attackRangeCells = 1;
        attackSpeedMs = Math.Clamp(600 - (Progress.Agility - 10) * 4 + weaponSpeed, 250, 900);
        castSpeedMs = Math.Clamp(1200 - (Progress.Intelligence - 10) * 8, 600, 1200);
        Progress = Progress with { Mana = Math.Clamp(Progress.Mana, 0, MaxMana), Stamina = Math.Clamp(Progress.Stamina, 0, MaxStamina) };
    }
    public bool TryAllocateAttribute(string attribute) {
        if (IsDead || Progress.Points < 1) return false;
        var p = Progress;
        p = attribute switch {
            "strength" => p with { Strength = p.Strength + 1 }, "vitality" => p with { Vitality = p.Vitality + 1 },
            "intelligence" => p with { Intelligence = p.Intelligence + 1 }, "agility" => p with { Agility = p.Agility + 1 }, _ => p
        };
        if (p == Progress) return false;
        Progress = p with { Points = p.Points - 1 }; RecalculateAdventureStats(); return true;
    }
    public void AwardExperience(int amount) {
        if (amount <= 0 || IsDead) return;
        var p = Progress;
        var xp = Math.Min(Adventure.Rules.LevelThresholds[^1], p.Experience + amount);
        var level = p.Level;
        while (level < Adventure.MaxLevel && xp >= Adventure.Rules.LevelThresholds[level]) level++;
        Progress = p with { Experience = xp, Level = level, Points = p.Points + (level - p.Level) * Adventure.Rules.PointsPerLevel, Kills = p.Kills + 1 };
        RecalculateAdventureStats();
        if (level > p.Level) { hp = maxHp; Progress = Progress with { Mana = MaxMana, Stamina = MaxStamina }; }
    }
    public bool CanUseSpell(int spellId) => (Progress.KnownSpellsMask & (1 << spellId)) != 0 && Adventure.Rules.Spells.TryGetValue(spellId, out var rule) &&
        (IsGameMaster || (Progress.Level >= rule.Level && Progress.Intelligence >= rule.Intelligence && Progress.Mana >= rule.Mana)) && !IsDead;
    public bool SpendSpellMana(int spellId) {
        if (!CanUseSpell(spellId)) return false;
        if (!IsGameMaster) Progress = Progress with { Mana = Progress.Mana - Adventure.Rules.Spells[spellId].Mana };
        MarkCombat(); return true;
    }
    public void MarkCombat() => lastCombatAt = DateTimeOffset.UtcNow;
    public bool CanTrade => !IsDead && !Disconnected && (DateTimeOffset.UtcNow - lastCombatAt).TotalSeconds >= 8;
    public void AddGold(int amount) { if (amount > 0) Progress = Progress with { Gold = (int)Math.Min(1000000000L, (long)Progress.Gold + amount) }; }
    public int ApplyGoldFind(int amount) => amount + amount * EquippedAffixTotal(SpecialLoot.GoldFind) / 100;
    public int ApplyExperienceFind(int amount) => amount + amount * EquippedAffixTotal(SpecialLoot.ExperienceFind) / 100;
    public int EquippedAffixTotal(int effect) => inventoryManager.EquippedItems.Values.Sum(i => SpecialLoot.Value(i.EffectOverrides, effect));
    public int RollWeaponDamage(out global::Server.AttackType procType, out int procStunMs, out bool critical) {
        procType = global::Server.AttackType.NoInterrupt; procStunMs = 0; critical = RollPermille(EquippedAffixTotal(SpecialLoot.CriticalChance));
        var result = critical ? Damage * 2 : Damage;
        if (RollPermille(EquippedAffixTotal(SpecialLoot.PoisonChance))) result += Math.Max(1, Damage / 6);
        if (RollPermille(EquippedAffixTotal(SpecialLoot.BurnChance))) result += Math.Max(1, Damage / 4);
        if (RollPermille(EquippedAffixTotal(SpecialLoot.ParalysisChance))) { procType = global::Server.AttackType.Stun; procStunMs = 1400; }
        else if (RollPermille(EquippedAffixTotal(SpecialLoot.FreezeChance))) { procType = global::Server.AttackType.Stun; procStunMs = 750; }
        return result;
    }
    public bool ApplyWeaponLeech(int actualDamage) {
        if (actualDamage <= 0) return false;
        var life = EquippedAffixTotal(SpecialLoot.LifeSteal);
        var manaGain = EquippedAffixTotal(SpecialLoot.ManaSteal);
        var oldHp = hp; var oldMana = Progress.Mana;
        if (life > 0) hp = Math.Min(maxHp, hp + Math.Max(1, actualDamage * life / 100));
        if (manaGain > 0) Progress = Progress with { Mana = Math.Min(MaxMana, Progress.Mana + manaGain) };
        return hp != oldHp || Progress.Mana != oldMana;
    }
    private static bool RollPermille(int chance) => chance > 0 && Random.Shared.Next(1000) < Math.Min(500, chance);
    public bool GameMasterSetMinimumLevel(int targetLevel) {
        if (!IsGameMaster || targetLevel <= Progress.Level || targetLevel > Adventure.MaxLevel) return false;
        var gained = targetLevel - Progress.Level;
        Progress = Progress with {
            Level = targetLevel,
            Experience = Math.Max(Progress.Experience, Adventure.Rules.LevelThresholds[targetLevel - 1]),
            Points = Progress.Points + gained * Adventure.Rules.PointsPerLevel,
        };
        RecalculateAdventureStats(); hp = maxHp;
        Progress = Progress with { Mana = MaxMana, Stamina = MaxStamina };
        return true;
    }
    public void GameMasterRestore() {
        if (!IsGameMaster) return;
        hp = maxHp; Progress = Progress with { Mana = MaxMana, Stamina = MaxStamina };
    }
    public void GameMasterUnlockSpells() {
        if (!IsGameMaster) return;
        var mask = Adventure.Rules.Spells.Keys.Aggregate(0, (value, spellId) => value | (1 << spellId));
        Progress = Progress with { KnownSpellsMask = mask };
    }
    public void SetEconomyProgress(ProgressState progress) { Progress = progress; RecalculateAdventureStats(); }
    public bool TrySpendStamina() {
        if (IsDead || Progress.Stamina < 2) return false;
        Progress = Progress with { Stamina = Progress.Stamina - 2 }; MarkCombat(); return true;
    }
    public bool CanDrinkPotion(int id) => !IsDead && (DateTimeOffset.UtcNow - lastPotionAt).TotalSeconds >= 2 &&
        ((id is 36 or 164 or 307 && Hp < MaxHp) || (id is 165 or 166 or 308 && Progress.Mana < MaxMana));
    public void DrinkPotion(int id) {
        lastPotionAt = DateTimeOffset.UtcNow;
        if (id == 36) hp = Math.Min(maxHp, hp + 50);
        if (id == 164) hp = Math.Min(maxHp, hp + 180);
        if (id == 307) hp = Math.Min(maxHp, hp + 500);
        if (id == 165) Progress = Progress with { Mana = Math.Min(MaxMana, Progress.Mana + 40) };
        if (id == 166) Progress = Progress with { Mana = Math.Min(MaxMana, Progress.Mana + 150) };
        if (id == 308) Progress = Progress with { Mana = Math.Min(MaxMana, Progress.Mana + 420) };
    }
    public void RecoverResources(bool sanctuary) {
        var now = DateTimeOffset.UtcNow;
        if (IsDead || Disconnected || (now - lastRecoveryAt).TotalSeconds < 1) return;
        lastRecoveryAt = now;
        Progress = Progress with { Stamina = Math.Min(MaxStamina, Progress.Stamina + 4) };
        if ((now - lastCombatAt).TotalSeconds < 8) return;
        hp = Math.Min(maxHp, hp + (sanctuary ? 10 : 2));
        Progress = Progress with { Mana = Math.Min(MaxMana, Progress.Mana + (sanctuary ? 8 : 2)) };
    }
}
