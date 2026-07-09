using Gonf.Api.Models;
using Gonf.Api.Services;
using System.Text.Json;

const long MaxUploadBytes = 1 * 1024 * 1024;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddPolicy("gonf-frontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("GlobalException");
        var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;

        if (exception is not null)
        {
            logger.LogError(exception, "Unhandled exception while processing request.");
        }

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        var response = ApiResponse.CreateError(
            StatusCodes.Status500InternalServerError,
            "SERVER_ERROR",
            "We hit an unexpected problem while processing your request. Please try again."
        );

        await context.Response.WriteAsJsonAsync(response);
    });
});

app.UseStatusCodePages(async statusCodeContext =>
{
    var context = statusCodeContext.HttpContext;
    var status = context.Response.StatusCode;

    if (status is not (StatusCodes.Status404NotFound or StatusCodes.Status502BadGateway))
    {
        return;
    }

    if (!string.IsNullOrWhiteSpace(context.Response.ContentType))
    {
        return;
    }

    var error = status switch
    {
        StatusCodes.Status404NotFound => ApiResponse.CreateError(status, "NOT_FOUND", "The requested resource was not found."),
        StatusCodes.Status502BadGateway => ApiResponse.CreateError(status, "UPSTREAM_UNAVAILABLE", "A dependent service is unavailable. Please try again."),
        _ => ApiResponse.CreateError(status, "REQUEST_FAILED", "The request could not be completed.")
    };

    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(error);
});

app.UseCors("gonf-frontend");

app.MapPost("/api/schema/preview", async (HttpRequest request, ILogger<Program> logger) =>
{
    return await HandleSchemaPreviewRequestAsync(request, logger);
})
.WithName("GenerateSchemaPreview");

await app.RunAsync();

static async Task<IResult> HandleSchemaPreviewRequestAsync(HttpRequest request, ILogger logger)
{
    try
    {
        var form = await request.ReadFormAsync();
        var file = form.Files.GetFile("file");

        var validationResult = ValidateFile(file);
        if (validationResult is not null)
        {
            return validationResult;
        }

        using var stream = file!.OpenReadStream();
        using var document = await TryParseJsonAsync(stream, file.FileName, logger);

        if (document is null)
        {
            return CreateErrorResult("INVALID_JSON", "Uploaded file is not valid JSON.");
        }

        var schema = JsonSchemaPreviewService.Build(document.RootElement);
        return Results.Json(ApiResponse.CreateSuccess(schema), statusCode: StatusCodes.Status200OK);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to generate schema preview.");
        return CreateErrorResult("SERVER_ERROR", "We hit an unexpected problem while generating the schema preview.");
    }
}

static IResult? ValidateFile(IFormFile? file)
{
    if (file is null)
    {
        return CreateErrorResult("FILE_REQUIRED", "Please choose a JSON file to continue.");
    }

    if (file.Length == 0)
    {
        return CreateErrorResult("EMPTY_FILE", "The uploaded file is empty. Please upload a valid JSON file.");
    }

    if (!file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
    {
        return CreateErrorResult("INVALID_FILE_TYPE", "Only .json files are supported.");
    }

    if (file.Length > MaxUploadBytes)
    {
        return CreateErrorResult("PAYLOAD_TOO_LARGE", "The uploaded file exceeds the 1 MB limit.");
    }

    return null;
}

static async Task<JsonDocument?> TryParseJsonAsync(Stream stream, string fileName, ILogger logger)
{
    try
    {
        return await JsonDocument.ParseAsync(stream);
    }
    catch (JsonException ex)
    {
        logger.LogWarning(ex, "Invalid JSON payload uploaded in file {FileName}", fileName);
        return null;
    }
}

static IResult CreateErrorResult(string code, string message)
{
    const int StatusCode = StatusCodes.Status500InternalServerError;
    return Results.Json(ApiResponse.CreateError(StatusCode, code, message), statusCode: StatusCode);
}
