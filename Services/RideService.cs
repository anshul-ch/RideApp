using MongoDB.Driver;
using RideApp.Models;

namespace RideApp.Services;

public class RideService(MongoService mongo)
{
    public async Task<Driver> RegisterDriver(Driver driver)
    {
        driver.IsAvailable = true;
        await mongo.Drivers.InsertOneAsync(driver);
        return driver;
    }

    public async Task<List<Driver>> GetNearbyDrivers(double lat, double lng)
    {
        return await mongo.Drivers.Find(d => d.IsAvailable).ToListAsync();
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
        await mongo.Rides.InsertOneAsync(ride);
        return ride;
    }

    public async Task<Ride?> GetRide(string id) =>
        await mongo.Rides.Find(r => r.Id == id).FirstOrDefaultAsync();

    public async Task<Driver?> GetDriver(string id) =>
        await mongo.Drivers.Find(d => d.Id == id).FirstOrDefaultAsync();

    public async Task<List<Ride>> GetPendingRides(string driverId) =>
        await mongo.Rides.Find(r => r.DriverId == driverId && r.Status == "Requested").ToListAsync();

    public async Task<bool> SetRideStatus(string rideId, string status)
    {
        var result = await mongo.Rides.UpdateOneAsync(
            r => r.Id == rideId,
            Builders<Ride>.Update.Set(r => r.Status, status));
        return result.ModifiedCount > 0;
    }

    public async Task UpdateDriverLocation(string driverId, double lat, double lng)
    {
        await mongo.Drivers.UpdateOneAsync(
            d => d.Id == driverId,
            Builders<Driver>.Update.Set(d => d.Location, new Location { Latitude = lat, Longitude = lng }));
    }

    public async Task UpdateUserLocation(string rideId, double lat, double lng)
    {
        await mongo.Rides.UpdateOneAsync(
            r => r.Id == rideId,
            Builders<Ride>.Update.Set(r => r.UserLocation, new Location { Latitude = lat, Longitude = lng }));
    }

    static double DistanceKm(double lat1, double lng1, double lat2, double lng2)
    {
        var dLat = Rad(lat2 - lat1);
        var dLng = Rad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 6371 * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    static double Rad(double deg) => deg * Math.PI / 180;
}