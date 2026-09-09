using Server.Helpers;

namespace Server.World.Game;

public sealed partial class GameWorld {
    private void HandleGameMasterCommand(GameWorldPlayer player, string rawCommand) {
        if (!player.IsGameMaster) {
            Adventure.Send(gameWorldRef, player, "Este personaje no tiene permisos de Game Master.");
            return;
        }

        var parts = rawCommand.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length < 2 || !parts[0].Equals("/gm", StringComparison.OrdinalIgnoreCase)) return;

        var notice = "Comando GM no reconocido.";
        switch (parts[1].ToLowerInvariant()) {
            case "level" when parts.Length >= 3 && int.TryParse(parts[2], out var level):
                notice = player.GameMasterSetMinimumLevel(level)
                    ? $"GM: nivel elevado a {player.Progress.Level}."
                    : $"GM: elegí un nivel superior entre {player.Progress.Level + 1} y {Adventure.MaxLevel}.";
                Spawn.SendInitialState(gameWorldRef, player, includeSpells: true);
                break;
            case "heal":
                player.GameMasterRestore();
                notice = "GM: vida, maná y energía restaurados.";
                break;
            case "gold":
                var gold = parts.Length >= 3 && int.TryParse(parts[2], out var requestedGold)
                    ? Math.Clamp(requestedGold, 1, 1_000_000) : 10_000;
                player.AddGold(gold);
                notice = $"GM: +{gold:N0} oro de prueba.";
                break;
            case "spells":
                player.GameMasterUnlockSpells();
                Spawn.SendInitialState(gameWorldRef, player, includeSpells: true);
                notice = "GM: todos los hechizos de prueba fueron habilitados.";
                break;
            case "god":
                notice = player.ToggleGameMasterInvulnerability()
                    ? "GM: invulnerabilidad activada."
                    : "GM: invulnerabilidad desactivada.";
                break;
        }

        Adventure.Send(gameWorldRef, player, notice);
        Adventure.Checkpoint(gameWorldRef, player);
    }
}
