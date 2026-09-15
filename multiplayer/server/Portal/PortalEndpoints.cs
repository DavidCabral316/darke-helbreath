using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Server.World.Game;

namespace Server.Portal;

public static class PortalEndpoints {
    private static readonly SemaphoreSlim LifecycleGate = new(1, 1);
    public static async Task<IDisposable> LockCharacters() { await LifecycleGate.WaitAsync(); return new GateLease(); }
    private sealed class GateLease : IDisposable { public void Dispose() => LifecycleGate.Release(); }
    public static Func<Guid, bool> IsOnline { get; set; } = _ => false;
    public static Action<string> DisconnectAccount { get; set; } = _ => { };
    public static Action RequestShutdown { get; set; } = () => { };
    public static Func<object> Status { get; set; } = () => new { online = true };
    public static IReadOnlyDictionary<int, ItemConfig> ItemCatalog { get; set; } = new Dictionary<int, ItemConfig>();

    public static void AddPortal(this WebApplicationBuilder builder) {
        builder.Configuration.AddJsonFile(Path.GetFullPath("../../.run/portal.local.json"), optional: true).AddEnvironmentVariables();
        var connection = builder.Configuration.GetConnectionString("Portal")
            ?? throw new InvalidOperationException("Run scripts/Initialize-WebDatabase.ps1 first.");
        var local = builder.Configuration.GetValue<bool>("Portal:LocalDevelopment");
        builder.Services.AddDbContextFactory<PortalDb>(o => o.UseNpgsql(connection));
        builder.Services.AddAuthorization();
        builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
        builder.Services.AddIdentity<Account, IdentityRole>(o => {
            o.Password.RequiredLength = 12;
            o.Password.RequireDigit = false;
            o.Password.RequireLowercase = false;
            o.Password.RequireUppercase = false;
            o.Password.RequireNonAlphanumeric = false;
            o.User.RequireUniqueEmail = true;
            o.Lockout.MaxFailedAccessAttempts = 5;
            o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
        }).AddEntityFrameworkStores<PortalDb>().AddDefaultTokenProviders();
        builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
        builder.Services.ConfigureApplicationCookie(o => {
            o.Cookie.Name = "darke.session";
            o.Cookie.HttpOnly = true;
            o.Cookie.SameSite = SameSiteMode.Strict;
            o.Cookie.SecurePolicy = local ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
            o.ExpireTimeSpan = TimeSpan.FromDays(7);
            o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
            o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
        });
        builder.Services.AddAntiforgery(o => {
            o.HeaderName = "X-CSRF-TOKEN";
            o.Cookie.Name = "darke.csrf";
            o.Cookie.SameSite = SameSiteMode.Strict;
            o.Cookie.SecurePolicy = local ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        });
        builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.GetFullPath("../../.run/keys"))).SetApplicationName("DarkeHelbreath");
        builder.Services.AddRateLimiter(o => {
            o.RejectionStatusCode = 429;
            o.AddPolicy("account", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions {
                PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
            }));
            o.AddPolicy("read", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions {
                PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
            }));
        });
    }

    public static async Task UsePortal(this WebApplication app) {
        CharacterPersistence.Factory = app.Services.GetRequiredService<IDbContextFactory<PortalDb>>();
        await using (var db = await CharacterPersistence.Factory.CreateDbContextAsync()) await db.Database.MigrateAsync();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();
        app.Use(async (context, next) => {
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            if (context.Request.Path.StartsWithSegments("/api")) {
                context.Response.Headers.CacheControl = "no-store";
                if (HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsDelete(context.Request.Method)) {
                    try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
                    catch (AntiforgeryValidationException) {
                        context.Response.StatusCode = 400;
                        await context.Response.WriteAsJsonAsync(new { error = "La sesión del formulario venció. Recargá la página." });
                        return;
                    }
                }
            }
            await next();
        });
        app.MapGet("/api/csrf", (HttpContext ctx, IAntiforgery antiforgery) => new { token = antiforgery.GetAndStoreTokens(ctx).RequestToken });
        app.MapGet("/api/status", () => Status());
        app.MapGet("/api/game/equipment-rules", () => new {
            equipment = ItemCatalog.Values.Where(item => Server.Helpers.SpecialLoot.IsEquipmentType(item.ItemType)).ToDictionary(item => item.Id, item => {
                var bonus = Server.Helpers.Adventure.Rules.Equipment.GetValueOrDefault(item.Id) ?? new Server.Helpers.EquipmentBonus();
                return new {
                    bonus.Damage, bonus.Defense, bonus.Level, bonus.Magic,
                    bonus.Mana, bonus.AttackSpeed,
                    ItemLevel = Server.Helpers.SpecialLoot.CalculateItemLevel(bonus)
                };
            })
        }).RequireAuthorization();
        app.MapGet("/api/game/economy", () => Server.Helpers.Economy.Rules).RequireAuthorization();
        var auth = app.MapGroup("/api/account").RequireRateLimiting("account");
        auth.MapPost("/register", async (RegisterRequest request, UserManager<Account> users, PortalDb db) => {
            if (!request.AcceptRules || !Regex.IsMatch(request.Username ?? "", "^[a-zA-Z0-9_]{3,24}$") ||
                !System.Net.Mail.MailAddress.TryCreate(request.Email, out var address) || address.Address != request.Email ||
                request.Email.Length > 254 || request.Password is null || request.Password.Length is < 12 or > 128)
                return Results.BadRequest(new { error = "Usá un usuario de 3–24 letras/números, correo válido y contraseña de 12–128 caracteres. Aceptá las reglas." });
            var account = new Account { UserName = request.Username, Email = request.Email };
            try {
                var result = await users.CreateAsync(account, request.Password);
                if (!result.Succeeded) return Results.BadRequest(new { error = "No se pudo crear la cuenta. Revisá los datos o intentá iniciar sesión." });
                db.Audit.Add(new AuditEntry { AccountId = account.Id, Action = "account.register" });
                await db.SaveChangesAsync();
                return Results.Ok(new { created = true });
            } catch (DbUpdateException) { return Results.BadRequest(new { error = "No se pudo crear la cuenta con esos datos." }); }
        });
        auth.MapPost("/login", async (LoginRequest request, SignInManager<Account> signIn, UserManager<Account> users) => {
            if (request.Username is null || request.Password is null || request.Password.Length > 128) return Results.Unauthorized();
            var user = request.Username.Contains('@') ? await users.FindByEmailAsync(request.Username) : await users.FindByNameAsync(request.Username);
            if (user is null) return Results.Json(new { error = "Credenciales incorrectas o cuenta temporalmente bloqueada." }, statusCode: 401);
            var result = await signIn.PasswordSignInAsync(user, request.Password, request.Remember, lockoutOnFailure: true);
            return result.Succeeded ? Results.Ok(new { signedIn = true }) : Results.Json(new { error = "Credenciales incorrectas o cuenta temporalmente bloqueada." }, statusCode: 401);
        });
        auth.MapGet("/me", async (ClaimsPrincipal principal, UserManager<Account> users) => {
            var user = await users.GetUserAsync(principal);
            return user is null ? Results.Unauthorized() : Results.Ok(new { user.UserName, user.Email, user.IsGameMaster });
        }).RequireAuthorization().RequireRateLimiting("read");
        auth.MapPost("/logout", async (ClaimsPrincipal principal, SignInManager<Account> signIn, UserManager<Account> users) => {
            var user = await users.GetUserAsync(principal);
            if (user is not null) { await users.UpdateSecurityStampAsync(user); DisconnectAccount(user.Id); }
            await signIn.SignOutAsync();
            return Results.Ok(new { signedOut = true });
        }).RequireAuthorization();
        auth.MapPost("/forgot", async (ForgotRequest request, UserManager<Account> users) => {
            var user = await users.FindByEmailAsync(request.Email ?? "");
            if (user is not null) {
                var token = await users.GeneratePasswordResetTokenAsync(user);
                var origin = app.Configuration["Portal:Origin"] ?? "http://localhost:8080";
                var link = $"{origin}/reset-password?email={Uri.EscapeDataString(user.Email!)}&token={Uri.EscapeDataString(token)}";
                // Local delivery is deliberately outside the web root. Never expose recovery tokens through an API.
                if (app.Configuration.GetValue<bool>("Portal:LocalDevelopment")) {
                    var directory = Path.GetFullPath("../../.run/mail");
                    Directory.CreateDirectory(directory);
                    await File.WriteAllTextAsync(Path.Combine(directory, $"{Guid.NewGuid():N}.txt"), $"Para: {user.Email}\nRecuperar contraseña de Darke Helbreath:\n{link}\n");
                } else {
                    using var smtp = new System.Net.Mail.SmtpClient(app.Configuration["Mail:Host"], app.Configuration.GetValue("Mail:Port", 587)) {
                        EnableSsl = true,
                        Credentials = new System.Net.NetworkCredential(app.Configuration["Mail:Username"], app.Configuration["Mail:Password"])
                    };
                    await smtp.SendMailAsync(app.Configuration["Mail:From"]!, user.Email!, "Recuperar contraseña — Darke Helbreath", link);
                }
            }
            return Results.Ok(new { message = "Si el correo corresponde a una cuenta, recibirás instrucciones para recuperarla." });
        });
        auth.MapPost("/reset", async (ResetRequest request, UserManager<Account> users) => {
            var user = await users.FindByEmailAsync(request.Email ?? "");
            if (user is null || request.Password is null || request.Password.Length is < 12 or > 128 || string.IsNullOrEmpty(request.Token))
                return Results.BadRequest(new { error = "El enlace no es válido o la contraseña no cumple los requisitos." });
            var result = await users.ResetPasswordAsync(user, request.Token, request.Password);
            if (!result.Succeeded) return Results.BadRequest(new { error = "El enlace venció o ya se utilizó." });
            DisconnectAccount(user.Id);
            return Results.Ok(new { reset = true });
        });
        var characters = app.MapGroup("/api/characters").RequireAuthorization().RequireRateLimiting("read");
        characters.MapGet("", async (ClaimsPrincipal principal, PortalDb db) => {
            var id = principal.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var list = await db.Characters.AsNoTracking().Where(c => c.AccountId == id).OrderBy(c => c.CreatedAt).ToListAsync();
            return Results.Ok(list.Where(c => c.DeletedAt == null || c.DeletedAt > DateTimeOffset.UtcNow.AddDays(-7)).Select(ToResponse));
        });
        characters.MapPost("", async (CharacterRequest request, ClaimsPrincipal principal, PortalDb db) => {
            if (!Regex.IsMatch(request.Name ?? "", "^[a-zA-Z][a-zA-Z0-9]{2,15}$") || request.Town is not ("aresden" or "elvine") ||
                request.Gender is < 0 or > 1 || request.Skin is < 0 or > 2 || request.Hair is < 0 or > 7 || request.Clothes is < 0 or > 7)
                return Results.BadRequest(new { error = "Nombre de 3–16 letras/números y apariencia válida requeridos." });
            var id = principal.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await using var transaction = await db.Database.BeginTransactionAsync();
            // Serialize slot operations per account, including simultaneous browser requests.
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({id}))");
            var cutoff = DateTimeOffset.UtcNow.AddDays(-7);
            if (await db.Characters.CountAsync(c => c.AccountId == id && (c.DeletedAt == null || c.DeletedAt > cutoff)) >= 3)
                return Results.Conflict(new { error = "Tu cuenta ya tiene tres personajes. Los eliminados reservan su ranura durante siete días." });
            // Characters enter their faction's shared city from the first session.
            // The old isolated `training` world made players see a different monster population.
            var state = new PlayerPersistenceState(request.Town, 150, 150, 220, 1200, 600, 1, 16, 500, 2, true, true, true,
                request.Gender, request.Skin, request.Hair, request.Clothes, 4,
                new[] { new PersistedInventoryItem(36, BitConverter.ToInt64(Guid.NewGuid().ToByteArray()) & long.MaxValue, 0, 0, 5, 0, null), new PersistedInventoryItem(165, BitConverter.ToInt64(Guid.NewGuid().ToByteArray()) & long.MaxValue, 35, 0, 3, 1, null) },
                new[] { new PersistedEquippedInventoryItem("weapon", new PersistedEquippedItem(3, BitConverter.ToInt64(Guid.NewGuid().ToByteArray()) & long.MaxValue, null, null, null)) }, request.Name!, 100, 100, Progress: new Server.Helpers.ProgressState(KnownSpellsMask: 1), HomeTown: request.Town);
            var character = new Character { AccountId = id, Name = request.Name!, NormalizedName = request.Name!.ToUpperInvariant(), Town = request.Town, StateJson = JsonSerializer.Serialize(state) };
            db.Characters.Add(character);
            db.Audit.Add(new AuditEntry { AccountId = id, Action = "character.create", Target = character.Id.ToString() });
            try { await db.SaveChangesAsync(); await transaction.CommitAsync(); }
            catch (DbUpdateException) { return Results.Conflict(new { error = "Ese nombre ya está reservado." }); }
            return Results.Ok(ToResponse(character));
        });
        characters.MapPost("/{id:guid}/delete", async (Guid id, DeleteRequest request, ClaimsPrincipal principal, PortalDb db) => {
            using var lifecycle = await LockCharacters();
            var account = principal.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var character = await db.Characters.SingleOrDefaultAsync(c => c.Id == id && c.AccountId == account && c.DeletedAt == null);
            if (character is null) return Results.NotFound();
            if (IsOnline(id)) return Results.Conflict(new { error = "Salí del juego y esperá a que termine la desconexión antes de eliminarlo." });
            if (request.Name != character.Name) return Results.BadRequest(new { error = "Escribí el nombre exacto para confirmar." });
            character.DeletedAt = DateTimeOffset.UtcNow;
            db.Audit.Add(new AuditEntry { AccountId = account, Action = "character.delete", Target = id.ToString() });
            await db.SaveChangesAsync();
            return Results.Ok(new { deleted = true });
        });
        characters.MapPost("/{id:guid}/restore", async (Guid id, ClaimsPrincipal principal, PortalDb db) => {
            var account = principal.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var cutoff = DateTimeOffset.UtcNow.AddDays(-7);
            var character = await db.Characters.SingleOrDefaultAsync(c => c.Id == id && c.AccountId == account && c.DeletedAt > cutoff);
            if (character is null) return Results.NotFound();
            character.DeletedAt = null;
            db.Audit.Add(new AuditEntry { AccountId = account, Action = "character.restore", Target = id.ToString() });
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(character));
        });
        // Local lifecycle control uses a secret header, never the public portal.
        app.MapPost("/internal/shutdown", (HttpContext ctx) => {
            var expected = app.Configuration["Portal:ShutdownKey"];
            if (string.IsNullOrEmpty(expected) || ctx.Request.Headers["X-Shutdown-Key"] != expected ||
                ctx.Connection.RemoteIpAddress is null || !System.Net.IPAddress.IsLoopback(ctx.Connection.RemoteIpAddress)) return Results.NotFound();
            RequestShutdown();
            return Results.Ok();
        });
    }

    public static object ToResponse(Character c) {
        var state = JsonSerializer.Deserialize<PlayerPersistenceState>(c.StateJson)!;
        return new { c.Id, c.Name, c.Town, c.Level, c.Experience, c.DeletedAt, c.LastPlayedAt,
            world = state.GameWorldId, gender = state.GenderValue, skin = state.SkinColorValue, hair = state.HairStyleIndex, clothes = state.UnderwearColorIndex,
            isGameMaster = state.IsGameMaster, online = IsOnline(c.Id) };
    }
    public record RegisterRequest(string Username, string Email, string Password, bool AcceptRules);
    public record LoginRequest(string Username, string Password, bool Remember);
    public record ForgotRequest(string Email);
    public record ResetRequest(string Email, string Token, string Password);
    public record CharacterRequest(string Name, string Town, int Gender, int Skin, int Hair, int Clothes);
    public record DeleteRequest(string Name);
}
