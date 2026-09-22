using Gonf.Api.Endpoints;
using Gonf.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.AddGonfServices();
builder.AddGonfCors();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseGonfExceptionHandling();
app.UseGonfStatusCodePages();

app.UseCors("gonf-frontend");

app.MapSchemaEndpoints();
app.MapGonfEndpoints();
app.MapRoomImageEndpoints();
app.MapCharacterImageEndpoints();
app.MapItemImageEndpoints();
app.MapPlayerSaveStateEndpoints();
app.MapConversationEndpoints();
app.MapItemTransferEndpoints();

await app.RunAsync();

public partial class Program { }
