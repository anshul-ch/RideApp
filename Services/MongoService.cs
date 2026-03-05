using MongoDB.Driver;
using RideApp.Models;

namespace RideApp.Services
{
    public class MongoService
    {
        public IMongoCollection<Driver> Drivers;
        public IMongoCollection<Ride> Rides;

        public MongoService(IConfiguration config)
        {
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING")
                ?? config["MongoDb:ConnectionString"];

            var database = Environment.GetEnvironmentVariable("MONGODB_DATABASE")
                ?? config["MongoDb:Database"];

            var client = new MongoClient(connectionString);
            var db = client.GetDatabase(database);

            Drivers = db.GetCollection<Driver>("Drivers");
            Rides = db.GetCollection<Ride>("Rides");
        }
    }
}