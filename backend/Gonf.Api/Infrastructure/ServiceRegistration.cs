using Gonf.Api.Services;

namespace Gonf.Api.Infrastructure;

public static class ServiceRegistration
{
    public static WebApplicationBuilder AddGonfServices(this WebApplicationBuilder builder)
    {
        builder.Services.AddOpenApi();
        builder.Services.AddHttpClient<IImageGenerationProvider, OpenAiImageProvider>((services, client) =>
        {
            var configuration = services.GetRequiredService<IConfiguration>();
            var timeoutSeconds = int.TryParse(configuration["ImageProvider:Imps:TimeoutSeconds"], out var parsedTimeoutSeconds)
                ? parsedTimeoutSeconds
                : 600;

            client.Timeout = TimeSpan.FromSeconds(Math.Max(30, timeoutSeconds));
        });

        builder.Services.AddSingleton<RoomImageGenerationJobService>();
        builder.Services.AddSingleton<IRoomImageGenerationJobService>(static services => services.GetRequiredService<RoomImageGenerationJobService>());
        builder.Services.AddHostedService(static services => services.GetRequiredService<RoomImageGenerationJobService>());

        builder.Services.AddSingleton<CharacterImageGenerationJobService>();
        builder.Services.AddSingleton<ICharacterImageGenerationJobService>(static services => services.GetRequiredService<CharacterImageGenerationJobService>());
        builder.Services.AddHostedService(static services => services.GetRequiredService<CharacterImageGenerationJobService>());

        builder.Services.AddSingleton<ItemImageGenerationJobService>();
        builder.Services.AddSingleton<IItemImageGenerationJobService>(static services => services.GetRequiredService<ItemImageGenerationJobService>());
        builder.Services.AddHostedService(static services => services.GetRequiredService<ItemImageGenerationJobService>());

        builder.Services.AddHttpClient<IChatCompletionProvider, OpenAiChatCompletionProvider>((services, client) =>
        {
            var configuration = services.GetRequiredService<IConfiguration>();
            var timeoutSeconds = int.TryParse(configuration["ChatProvider:TimeoutSeconds"], out var parsedTimeoutSeconds)
                ? parsedTimeoutSeconds
                : 60;

            client.Timeout = TimeSpan.FromSeconds(Math.Max(10, timeoutSeconds));
        });

        builder.Services.AddSingleton<PlayerSaveStateService>();

        return builder;
    }

    public static WebApplicationBuilder AddGonfCors(this WebApplicationBuilder builder)
    {
        var configuredCorsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        var configuredCorsOriginSet = new HashSet<string>(configuredCorsOrigins, StringComparer.OrdinalIgnoreCase);

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("gonf-frontend", policy =>
            {
                if (builder.Environment.IsDevelopment())
                {
                    policy.SetIsOriginAllowed(origin => CorsHelpers.IsLoopbackOrigin(origin) || configuredCorsOriginSet.Contains(origin))
                          .AllowAnyHeader()
                          .AllowAnyMethod();
                    return;
                }

                if (configuredCorsOrigins.Length > 0)
                {
                    policy.WithOrigins(configuredCorsOrigins)
                          .AllowAnyHeader()
                          .AllowAnyMethod();
                    return;
                }

                policy.SetIsOriginAllowed(_ => false);
            });
        });

        return builder;
    }
}
