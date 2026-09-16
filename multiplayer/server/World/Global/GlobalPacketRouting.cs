using Mmorpg.Network;
using Server.World;
using Server.World.Game;

namespace Server.World.Global;

/// <summary>
/// Central allowlist for client packet payloads that should be handled by <see cref="GlobalWorld"/> instead of a playable <see cref="GameWorld"/>.
/// </summary>
public static class GlobalPacketRouting {
    private static readonly HashSet<ClientMessage.PayloadOneofCase> globalPayloadCases = new() {
        ClientMessage.PayloadOneofCase.ChatMessageSendRequest,
    };

    public static bool ShouldRouteToGlobalWorld(ClientMessage message) {
        ArgumentNullException.ThrowIfNull(message);
        // GM and party commands use the existing bounded chat envelope but are handled only
        // by the current game world, where the selected character permission is verified.
        if (message.PayloadCase == ClientMessage.PayloadOneofCase.ChatMessageSendRequest) {
            var text = message.ChatMessageSendRequest.Message.TrimStart();
            if (text.StartsWith("/gm ", StringComparison.OrdinalIgnoreCase) ||
                text.Equals("/party", StringComparison.OrdinalIgnoreCase) ||
                text.StartsWith("/party ", StringComparison.OrdinalIgnoreCase)) {
                return false;
            }
        }
        return ShouldRouteToGlobalWorld(message.PayloadCase);
    }

    public static bool ShouldRouteToGlobalWorld(ClientMessage.PayloadOneofCase payloadCase) {
        return globalPayloadCases.Contains(payloadCase);
    }
}
