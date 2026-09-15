namespace Server.Portal;

public static class LanAccess {
    public static bool IsAllowedWebSocketOrigin(string? origin, string requestHost, string configuredOrigin, bool lanMode) {
        if (string.Equals(origin, configuredOrigin, StringComparison.OrdinalIgnoreCase)) return true;
        if (!lanMode || !Uri.TryCreate(origin, UriKind.Absolute, out var originUri)) return false;
        return (originUri.Scheme is "http" or "https")
            && originUri.Port == 8080
            && string.Equals(originUri.Host, requestHost, StringComparison.OrdinalIgnoreCase);
    }
}
