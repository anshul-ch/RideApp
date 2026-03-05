using Microsoft.AspNetCore.Mvc;
using RideApp.Models;
using RideApp.Services;

namespace RideApp.Controllers
{
    public class RideController : Controller
    {
        private readonly RideService _service;

        public RideController(RideService s)
        {
            _service = s;
        }

        [HttpPost]
        public async Task<IActionResult> RegisterDriver([FromBody] Driver driver)
        {
            var result = await _service.RegisterDriver(driver);
            return Json(result);
        }

        [HttpPost]
        public async Task<IActionResult> FindDrivers([FromBody] Location location)
        {
            var drivers = await _service.GetNearbyDrivers(location.Latitude, location.Longitude);
            return Json(drivers);
        }

        [HttpPost]
        public async Task<IActionResult> RequestRide([FromBody] RideRequest request)
        {
            var ride = await _service.RequestRide(request.UserName, request.Latitude, request.Longitude, request.DriverId);
            return Json(ride);
        }

        [HttpGet]
        public async Task<IActionResult> RideStatus(string id)
        {
            var ride = await _service.GetRide(id);
            if (ride == null) return NotFound();
            return Json(ride);
        }

        [HttpGet]
        public async Task<IActionResult> RideDetails(string id)
        {
            var ride = await _service.GetRide(id);
            if (ride == null) return NotFound();
            var driver = await _service.GetDriver(ride.DriverId);
            return Json(new
            {
                ride.Id,
                ride.UserName,
                userLocation = ride.UserLocation,
                ride.DriverId,
                ride.Status,
                driverName = driver?.Name,
                driverVehicle = driver?.VehicleNumber,
                driverLocation = driver?.Location
            });
        }

        [HttpGet]
        public async Task<IActionResult> DriverLocation(string driverId)
        {
            var driver = await _service.GetDriver(driverId);
            if (driver == null) return NotFound();
            return Json(driver.Location);
        }

        [HttpGet]
        public async Task<IActionResult> PendingRides(string driverId)
        {
            var rides = await _service.GetPendingRidesForDriver(driverId);
            return Json(rides);
        }

        [HttpPost]
        public async Task<IActionResult> AcceptRide(string id)
        {
            var success = await _service.AcceptRide(id);
            return Json(new { success });
        }

        [HttpPost]
        public async Task<IActionResult> RejectRide(string id)
        {
            var success = await _service.RejectRide(id);
            return Json(new { success });
        }

        [HttpPost]
        public async Task<IActionResult> UpdateDriverLocation([FromBody] DriverLocationUpdate update)
        {
            await _service.UpdateDriverLocation(update.DriverId, update.Latitude, update.Longitude);
            return Json(new { success = true });
        }
    }
}