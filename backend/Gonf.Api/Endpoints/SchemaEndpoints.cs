using static Gonf.Api.Infrastructure.UploadHandlers;

namespace Gonf.Api.Endpoints;

public static class SchemaEndpoints
{
    public static WebApplication MapSchemaEndpoints(this WebApplication app)
    {
        app.MapPost("/api/schema/preview", async (HttpRequest request, ILogger<Program> logger) =>
        {
            return await HandleSchemaPreviewRequestAsync(request, logger);
        })
        .WithName("GenerateSchemaPreview");

        return app;
    }
}
