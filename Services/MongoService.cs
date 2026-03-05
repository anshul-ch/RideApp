using MongoDB.Driver;
using RideApp.Models;

namespace RideApp.Services;

public class MongoService
{
    public IMongoCollection<Driver> Drivers { get; }
    public IMongoCollection<Ride> Rides { get; }

    public MongoService(IConfiguration config)
    {
        var connStr = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING")
            ?? config["MongoDb:ConnectionString"];
        var dbName = Environment.GetEnvironmentVariable("MONGODB_DATABASE")
            ?? config["MongoDb:Database"];

        var db = new MongoClient(connStr).GetDatabase(dbName);
        Drivers = db.GetCollection<Driver>("Drivers");
        Rides = db.GetCollection<Ride>("Rides");
    }
}