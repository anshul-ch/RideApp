using RideApp.Models;
using MongoDB.Driver;

namespace RideApp.Services
{
    public class RideService
    {
        private readonly MongoService _mongo;

        public RideService(MongoService m)
        {
            _mongo = m;
        }

        public async Task<Driver> RegisterDriver(Driver driver)
        {
            driver.IsAvailable = true;
            await _mongo.Drivers.InsertOneAsync(driver);
            return driver;
        }

        public async Task<List<Driver>> GetNearbyDrivers(double lat, double lng, double radiusKm = 5)
        {
            var allAvailable = await _mongo.Drivers
                .Find(d => d.IsAvailable)
                .ToListAsync();

            return allAvailable
                .Where(d => GetDistanceKm(lat, lng, d.Location.Latitude, d.Location.Longitude) <= radiusKm)
                .ToList();
        }

        public async Task<Ride> RequestRide(string userName, double lat, double lng, string driverId)
        {
            var ride = new Ride
            {
                UserName = userName,
                UserLocation = new Location { Latitude = lat, Longitude = lng },
                DriverId = driverId,
                Status = "Requested"
            };
            await _mongo.Rides.InsertOneAsync(ride);
            return ride;
        }

        public async Task<Ride?> GetRide(string rideId)
        {
            return await _mongo.Rides
                .Find(r => r.Id == rideId)
                .FirstOrDefaultAsync();
        }

        public async Task<List<Ride>> GetPendingRidesForDriver(string driverId)
        {
            return await _mongo.Rides
                .Find(r => r.DriverId == driverId && r.Status == "Requested")
                .ToListAsync();
        }

        public async Task<bool> AcceptRide(string rideId)
        {
            var update = Builders<Ride>.Update.Set(r => r.Status, "Accepted");
            var result = await _mongo.Rides.UpdateOneAsync(r => r.Id == rideId, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> RejectRide(string rideId)
        {
            var update = Builders<Ride>.Update.Set(r => r.Status, "Rejected");
            var result = await _mongo.Rides.UpdateOneAsync(r => r.Id == rideId, update);
            return result.ModifiedCount > 0;
        }

        private static double GetDistanceKm(double lat1, double lng1, double lat2, double lng2)
        {
            const double R = 6371;
            var dLat = ToRadians(lat2 - lat1);
            var dLng = ToRadians(lng2 - lng1);
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                    Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return R * c;
        }

        private static double ToRadians(double degrees) => degrees * Math.PI / 180;
    }
}