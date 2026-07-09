namespace Gonf.Api.Models;

public sealed record ApiError(string Code, string Message);

public sealed record SchemaNode(
    string Path,
    string FieldName,
    string InferredType,
    bool IsArray,
    bool IsObject
);

public sealed record ApiResponse(int Code, bool Success, List<ApiError> Errors, List<SchemaNode> Schema)
{
    public static ApiResponse CreateSuccess(List<SchemaNode> schema)
    {
        return new ApiResponse(200, true, [], schema);
    }

    public static ApiResponse CreateError(int statusCode, string code, string message)
    {
        return new ApiResponse(statusCode, false, [new ApiError(code, message)], []);
    }
}