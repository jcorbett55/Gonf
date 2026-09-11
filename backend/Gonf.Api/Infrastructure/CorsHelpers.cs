using System.Net;

namespace Gonf.Api.Infrastructure;

public static class CorsHelpers
{
    public static bool IsLoopbackOrigin(string origin)
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        {
            return false;
        }

        // Allow any loopback host (localhost, 127.0.0.1, ::1) for local development.
        var isLocalHost = uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                          || (IPAddress.TryParse(uri.Host, out var ip) && IPAddress.IsLoopback(ip));

        return isLocalHost && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}
