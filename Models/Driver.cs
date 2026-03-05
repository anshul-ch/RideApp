using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace RideApp.Models
{
    public class Driver
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string Name { get; set; } = "";

        public string VehicleNumber { get; set; } = "";

        public bool IsAvailable { get; set; }

        public Location Location { get; set; } = new();
    }
}