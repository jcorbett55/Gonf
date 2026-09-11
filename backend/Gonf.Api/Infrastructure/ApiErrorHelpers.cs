using Gonf.Api.Models;

namespace Gonf.Api.Infrastructure;

public static class ApiErrorHelpers
{
    public static IResult CreateErrorResult(int statusCode, string code, string message)
    {
        return Results.Json(ApiResponse.CreateError(statusCode, code, message), statusCode: statusCode);
    }

    public static bool IsDiskFull(IOException exception)
    {
        var hResult = unchecked((uint)exception.HResult);
        return hResult == 0x80070070 || hResult == 0x80070027;
    }
}
