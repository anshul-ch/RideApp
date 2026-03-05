using Microsoft.AspNetCore.Mvc;
using RideApp.Models;
using RideApp.Services;

namespace RideApp.Controllers;

public class RideController(RideService service) : Controller
{
    [HttpPost]
    public async Task<IActionResult> RegisterDriver([FromBody] Driver driver) =>
        Json(await service.RegisterDriver(driver));

    [HttpPost]
    public async Task<IActionResult> FindDrivers([FromBody] Location loc) =>
        Json(await service.GetNearbyDrivers(loc.Latitude, loc.Longitude));

    [HttpPost]
    public async Task<IActionResult> RequestRide([FromBody] RideRequest req) =>
        Json(await service.RequestRide(req.UserName, req.Latitude, req.Longitude, req.DriverId));

    [HttpGet]
    public async Task<IActionResult> RideDetails(string id)
    {
        var ride = await service.GetRide(id);
        if (ride == null) return NotFound();
        var driver = await service.GetDriver(ride.DriverId);
        return Json(new
        {
            ride.Id, ride.UserName, ride.UserLocation, ride.DriverId, ride.Status,
            driverName = driver?.Name,
            driverVehicle = driver?.VehicleNumber,
            driverLocation = driver?.Location
        });
    }

    [HttpGet]
    public async Task<IActionResult> DriverLocation(string driverId)
    {
        var driver = await service.GetDriver(driverId);
        return driver == null ? NotFound() : Json(driver.Location);
    }

    [HttpGet]
    public async Task<IActionResult> PendingRides(string driverId) =>
        Json(await service.GetPendingRides(driverId));

    [HttpPost]
    public async Task<IActionResult> AcceptRide(string id) =>
        Json(new { success = await service.SetRideStatus(id, "Accepted") });

    [HttpPost]
    public async Task<IActionResult> RejectRide(string id) =>
        Json(new { success = await service.SetRideStatus(id, "Rejected") });

    [HttpPost]
    public async Task<IActionResult> UpdateDriverLocation([FromBody] DriverLocationUpdate req)
    {
        await service.UpdateDriverLocation(req.DriverId, req.Latitude, req.Longitude);
        return Json(new { success = true });
    }
}