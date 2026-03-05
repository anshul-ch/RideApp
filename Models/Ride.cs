using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace RideApp.Models;

public class Ride
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    public string UserName { get; set; } = "";
    public Location UserLocation { get; set; } = new();
    public string DriverId { get; set; } = "";
    public string Status { get; set; } = "Requested";
}