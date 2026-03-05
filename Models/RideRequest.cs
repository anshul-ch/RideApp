namespace RideApp.Models;

public class RideRequest
{
    public string UserName { get; set; } = "";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string DriverId { get; set; } = "";
}
