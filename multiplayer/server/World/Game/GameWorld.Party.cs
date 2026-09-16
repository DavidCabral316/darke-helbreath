using Server.Helpers;
using Server.Utils;

namespace Server.World.Game;

/// <summary>
/// Minimal two-player party support. Parties live on one map for this first LAN iteration
/// and are dissolved when either member changes map or leaves the world.
/// </summary>
public sealed partial class GameWorld {
    private readonly Dictionary<long, long> partyPartners = new();
    private readonly Dictionary<long, long> pendingPartyInviters = new();

    private void HandlePartyCommand(GameWorldPlayer player, string rawCommand) {
        var parts = rawCommand.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length < 2) {
            SendPartyNotice(player, "Usá Invitar, Aceptar o Salir desde el panel Grupo del chat.");
            return;
        }

        switch (parts[1].ToLowerInvariant()) {
            case "invitar" when parts.Length >= 3:
                InviteToParty(player, string.Join(' ', parts.Skip(2)));
                break;
            case "aceptar":
                AcceptPartyInvite(player);
                break;
            case "rechazar":
                RejectPartyInvite(player);
                break;
            case "salir":
                LeaveParty(player, notifyPlayer: true);
                break;
            default:
                SendPartyNotice(player, "Comando de grupo no reconocido.");
                break;
        }
    }

    private void InviteToParty(GameWorldPlayer inviter, string targetName) {
        if (partyPartners.ContainsKey(inviter.PlayerId)) {
            SendPartyNotice(inviter, "Ya estás en un grupo. Salí antes de crear otro.");
            return;
        }

        var target = playersMap.Values.FirstOrDefault(candidate =>
            !candidate.Disconnected && candidate.PlayerId != inviter.PlayerId &&
            candidate.CharacterName.Equals(targetName.Trim(), StringComparison.OrdinalIgnoreCase));
        if (target is null) {
            SendPartyNotice(inviter, $"No encontré a {targetName.Trim()} en este mapa.");
            return;
        }
        if (partyPartners.ContainsKey(target.PlayerId)) {
            SendPartyNotice(inviter, $"{target.CharacterName} ya está en otro grupo.");
            return;
        }

        pendingPartyInviters[target.PlayerId] = inviter.PlayerId;
        SendPartyNotice(inviter, $"Invitación enviada a {target.CharacterName}.");
        SendPartyNotice(target, $"{inviter.CharacterName} te invitó a su grupo. Presioná Aceptar en el panel Grupo del chat.");
    }

    private void AcceptPartyInvite(GameWorldPlayer invited) {
        if (!pendingPartyInviters.Remove(invited.PlayerId, out var inviterId) ||
            !playersMap.TryGetValue(inviterId, out var inviter) || inviter.Disconnected) {
            SendPartyNotice(invited, "No tenés una invitación de grupo vigente.");
            return;
        }
        if (partyPartners.ContainsKey(invited.PlayerId) || partyPartners.ContainsKey(inviter.PlayerId)) {
            SendPartyNotice(invited, "Uno de los jugadores ya pertenece a otro grupo.");
            return;
        }

        partyPartners[invited.PlayerId] = inviter.PlayerId;
        partyPartners[inviter.PlayerId] = invited.PlayerId;
        SendPartyNotice(inviter, $"¡{invited.CharacterName} se unió a tu grupo! La XP cercana ahora se comparte.");
        SendPartyNotice(invited, $"¡Te uniste al grupo de {inviter.CharacterName}! La XP cercana ahora se comparte.");
        SendPartyStatus(inviter);
        SendPartyStatus(invited);
        NotifyPartyMemberMoved(inviter);
        NotifyPartyMemberMoved(invited);
    }

    private void RejectPartyInvite(GameWorldPlayer invited) {
        if (!pendingPartyInviters.Remove(invited.PlayerId, out var inviterId)) {
            SendPartyNotice(invited, "No tenés una invitación de grupo vigente.");
            return;
        }
        SendPartyNotice(invited, "Invitación rechazada.");
        if (playersMap.TryGetValue(inviterId, out var inviter) && !inviter.Disconnected)
            SendPartyNotice(inviter, $"{invited.CharacterName} rechazó la invitación.");
    }

    private void LeaveParty(GameWorldPlayer player, bool notifyPlayer) {
        pendingPartyInviters.Remove(player.PlayerId);
        foreach (var inviteeId in pendingPartyInviters.Where(entry => entry.Value == player.PlayerId).Select(entry => entry.Key).ToArray())
            pendingPartyInviters.Remove(inviteeId);

        if (!partyPartners.Remove(player.PlayerId, out var partnerId)) {
            if (notifyPlayer) SendPartyNotice(player, "No estás en ningún grupo.");
            return;
        }

        partyPartners.Remove(partnerId);
        if (notifyPlayer && !player.Disconnected) SendPartyNotice(player, "Saliste del grupo.");
        if (!player.Disconnected)
            NetworkManager.SendToPlayer(player, NetworkManager.CreatePartyStatusUpdated(false, 0, string.Empty));
        if (playersMap.TryGetValue(partnerId, out var partner) && !partner.Disconnected) {
            if (notifyPlayer || !player.Disconnected)
                SendPartyNotice(partner, $"{player.CharacterName} salió del grupo.");
            NetworkManager.SendToPlayer(partner, NetworkManager.CreatePartyStatusUpdated(false, 0, string.Empty));
        }
    }

    private static void SendPartyNotice(GameWorldPlayer player, string message) =>
        NetworkManager.SendToPlayer(player, NetworkManager.CreateChatMessageReceived("Grupo", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), message));

    /// <summary>True when both players are currently partnered together.</summary>
    public bool IsInSameParty(long firstPlayerId, long secondPlayerId) =>
        partyPartners.TryGetValue(firstPlayerId, out var partnerId) && partnerId == secondPlayerId;

    /// <summary>Returns the living partner eligible for shared XP around this kill.</summary>
    public GameWorldPlayer? FindEligiblePartyPartner(GameWorldPlayer player, int x, int y, int radius = 24) {
        if (!partyPartners.TryGetValue(player.PlayerId, out var partnerId) ||
            !playersMap.TryGetValue(partnerId, out var partner) || partner.Disconnected || partner.IsDead)
            return null;
        return Math.Abs(partner.PosX - x) <= radius && Math.Abs(partner.PosY - y) <= radius ? partner : null;
    }

    public bool TryGetPartyPartner(long playerId, out GameWorldPlayer? partner) {
        partner = null;
        return partyPartners.TryGetValue(playerId, out var partnerId) &&
            playersMap.TryGetValue(partnerId, out partner) && !partner.Disconnected;
    }

    /// <summary>Loot reserved for one member can also be picked up by their current party partner.</summary>
    public bool CanPickupSharedLoot(string? ownerKey, GameWorldPlayer picker) {
        if (string.IsNullOrEmpty(ownerKey) || ownerKey == picker.PersistenceKey) return true;
        var owner = playersMap.Values.FirstOrDefault(candidate =>
            !candidate.Disconnected && candidate.PersistenceKey == ownerKey);
        if (owner is null) return false; // Unknown or offline owner: reservation still blocks pickup.
        return IsInSameParty(owner.PlayerId, picker.PlayerId);
    }

    private void SendPartyStatus(GameWorldPlayer player) {
        if (player.Disconnected) return;
        if (TryGetPartyPartner(player.PlayerId, out var partner) && partner is not null)
            NetworkManager.SendToPlayer(player, NetworkManager.CreatePartyStatusUpdated(true, partner.PlayerId, partner.CharacterName));
        else
            NetworkManager.SendToPlayer(player, NetworkManager.CreatePartyStatusUpdated(false, 0, string.Empty));
    }

    /// <summary>Pushes the mover's authoritative cell to their partner, even when out of visibility range.</summary>
    public void NotifyPartyMemberMoved(GameWorldPlayer movedPlayer) {
        if (movedPlayer.Disconnected) return;
        if (!TryGetPartyPartner(movedPlayer.PlayerId, out var partner) || partner is null) return;
        NetworkManager.SendToPlayer(partner, NetworkManager.CreatePartyMemberMoved(
            movedPlayer.PlayerId, movedPlayer.CharacterName, movedPlayer.PosX, movedPlayer.PosY));
    }

}
