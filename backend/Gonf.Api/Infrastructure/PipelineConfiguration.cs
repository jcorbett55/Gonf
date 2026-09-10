using Gonf.Api.Models;

namespace Gonf.Api.Infrastructure;

public static class PipelineConfiguration
{
    public static WebApplication UseGonfExceptionHandling(this WebApplication app)
    {
        app.UseExceptionHandler(errorApp =>
        {
            errorApp.Run(async context =>
            {
                var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("GlobalException");
                var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;

                if (exception is BadHttpRequestException badRequestException)
                {
                    logger.LogWarning(badRequestException, "Invalid request payload.");

                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    context.Response.ContentType = "application/json";

                    var badRequestResponse = ApiResponse.CreateError(
                        StatusCodes.Status400BadRequest,
                        "INVALID_REQUEST_BODY",
                        "The request body contains invalid or out-of-range values. Please review item and character fields and try again."
                    );

                    await context.Response.WriteAsJsonAsync(badRequestResponse);
                    return;
                }

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

        return app;
    }

    public static WebApplication UseGonfStatusCodePages(this WebApplication app)
    {
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

        return app;
    }
}
