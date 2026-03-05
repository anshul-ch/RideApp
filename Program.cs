using Microsoft.AspNetCore.HttpOverrides;
using RideApp.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddSingleton<MongoService>();
builder.Services.AddSingleton<RideService>();

var port = Environment.GetEnvironmentVariable("PORT");
if (port != null)
    builder.WebHost.UseUrls($"http://+:{port}");

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
else
{
    app.UseHttpsRedirection();
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");

app.Run();
