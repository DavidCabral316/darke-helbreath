using System.Net;

namespace Server.Portal;

public static class LanAccess {
    public static bool IsAllowedWebSocketOrigin(string? origin, string requestHost, string configuredOrigin, bool lanMode) {
        if (string.Equals(origin, configuredOrigin, StringComparison.OrdinalIgnoreCase)) return true;
        if (!lanMode || !Uri.TryCreate(origin, UriKind.Absolute, out var originUri)) return false;
        return (originUri.Scheme is "http" or "https")
            && originUri.Port == 8080
            && (string.Equals(originUri.Host, requestHost, StringComparison.OrdinalIgnoreCase) || IsPrivateNetworkHost(originUri.Host));
    }

    private static bool IsPrivateNetworkHost(string host) {
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)) return true;
        if (!IPAddress.TryParse(host, out var address)) return false;
        if (IPAddress.IsLoopback(address)) return true;
        var bytes = address.GetAddressBytes();
        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
            return bytes[0] == 10 || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31) || (bytes[0] == 192 && bytes[1] == 168);
        return address.IsIPv6LinkLocal || (bytes[0] & 0xfe) == 0xfc;
    }
}
