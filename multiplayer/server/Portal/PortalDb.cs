using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Server.World.Game;
using System.Text.Json;

namespace Server.Portal;

public class Account : IdentityUser {
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsGameMaster { get; set; }
}

public class Character {
    public Guid Id { get; set; } = Guid.NewGuid();
    public string AccountId { get; set; } = "";
    public Account Account { get; set; } = null!;
    public string Name { get; set; } = "";
    public string NormalizedName { get; set; } = "";
    public string Town { get; set; } = "aresden";
    public int Level { get; set; } = 1;
    public long Experience { get; set; }
    public string StateJson { get; set; } = "{}";
    public long StateVersion { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeletedAt { get; set; }
    public DateTimeOffset? LastPlayedAt { get; set; }
}

public class AuditEntry {
    public long Id { get; set; }
    public string AccountId { get; set; } = "";
    public string Action { get; set; } = "";
    public string Target { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}

public class PortalDb(DbContextOptions<PortalDb> options) : IdentityDbContext<Account>(options) {
    public DbSet<Character> Characters => Set<Character>();
    public DbSet<AuditEntry> Audit => Set<AuditEntry>();
    protected override void OnModelCreating(ModelBuilder builder) {
        base.OnModelCreating(builder);
        builder.Entity<Account>().HasIndex(x => x.NormalizedEmail).IsUnique();
        builder.Entity<Character>().HasIndex(x => x.NormalizedName).IsUnique();
        builder.Entity<Character>().Property(x => x.Name).HasMaxLength(16);
        builder.Entity<Character>().Property(x => x.NormalizedName).HasMaxLength(16);
        builder.Entity<Character>().Property(x => x.StateJson).HasColumnType("jsonb");
        builder.Entity<Character>().HasOne(x => x.Account).WithMany().HasForeignKey(x => x.AccountId);
    }
}

public class PortalDbFactory : IDesignTimeDbContextFactory<PortalDb> {
    public PortalDb CreateDbContext(string[] args) {
        var config = new ConfigurationBuilder().AddJsonFile(Path.GetFullPath("../../.run/portal.local.json"), optional: true).AddEnvironmentVariables().Build();
        return new PortalDb(new DbContextOptionsBuilder<PortalDb>().UseNpgsql(config.GetConnectionString("Portal") ?? "Host=127.0.0.1;Port=55432;Database=darke_portal").Options);
    }
}

// The existing world owns the snapshot. JSONB preserves the complete inventory/equipment
// atomically while accounts and character ownership use relational constraints.
public static class CharacterPersistence {
    public static IDbContextFactory<PortalDb> Factory { get; set; } = null!;
    public static PlayerPersistenceState? Load(string key) {
        using var db = Factory.CreateDbContext();
        var character = db.Characters.SingleOrDefault(x => x.Id == Guid.Parse(key) && x.DeletedAt == null);
        if (character is null) throw new InvalidOperationException("Character no longer available.");
        var state = JsonSerializer.Deserialize<PlayerPersistenceState>(character.StateJson)
            ?? throw new InvalidOperationException("Invalid character snapshot.");
        return state with { PersistenceKey = key };
    }
    public static void Save(string key, PlayerPersistenceState state) {
        using var db = Factory.CreateDbContext();
        var json = JsonSerializer.Serialize(state);
        db.Characters.Where(x => x.Id == Guid.Parse(key) && x.StateVersion < state.SnapshotVersion).ExecuteUpdate(s => s
            .SetProperty(x => x.StateJson, json).SetProperty(x => x.StateVersion, state.SnapshotVersion)
            .SetProperty(x => x.Level, state.Progress == null ? 1 : state.Progress.Level)
            .SetProperty(x => x.Experience, state.Progress == null ? 0 : state.Progress.Experience)
            .SetProperty(x => x.LastPlayedAt, DateTimeOffset.UtcNow));
    }
}
