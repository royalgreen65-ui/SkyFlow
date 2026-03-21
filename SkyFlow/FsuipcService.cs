using System;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using FSUIPC; // Uncommented to use the FSUIPC library

namespace SkyFlow
{
    // FSUIPC Offsets for wind data. These are example offsets and may need to be
    // verified against the FSUIPC SDK documentation for your specific simulator version.
    public static class FsuipcOffsets
    {
        // Example: Wind Direction (degrees)
        public const int WindDirection = 0x0C80; 
        // Example: Wind Speed (knots)
        public const int WindSpeed = 0x0C84;
        // Example: Gust Speed (knots) - often mapped to speed if no separate gust offset
        public const int WindGust = 0x0C88; 
        // Example: Turbulence (0-255 range, 0 = None, 255 = Extreme)
        public const int WindTurbulence = 0x0C8C; 
    }

    public class FsuipcService
    {
        private bool _isConnected = false;

        // FSUIPC Offset declarations
        private Offset<short> windDirection = new Offset<short>(0x0C80);
        private Offset<short> windSpeed = new Offset<short>(0x0C84);

        public void Connect()
        {
            try
            {
                FSUIPCConnection.Open();
                _isConnected = FSUIPCConnection.IsOpen;
            }
            catch (Exception)
            {
                _isConnected = false;
            }
        }

        public void Disconnect()
        {
            if (FSUIPCConnection.IsOpen)
            {
                FSUIPCConnection.Close();
            }
            _isConnected = false;
        }

        public bool IsConnected()
        {
            _isConnected = FSUIPCConnection.IsOpen;
            return _isConnected;
        }

        public void InjectWind(string windString)
        {
            if (!IsConnected()) return;

            if (string.IsNullOrWhiteSpace(windString) || windString.Equals("N/A", StringComparison.OrdinalIgnoreCase)) return;

            try
            {
                var match = Regex.Match(windString, @"(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT", RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    int direction = 0;
                    if (match.Groups[1].Value != "VRB")
                    {
                        direction = int.Parse(match.Groups[1].Value);
                    }

                    int speed = int.Parse(match.Groups[2].Value);

                    // Update offset values
                    windDirection.Value = (short)direction;
                    windSpeed.Value = (short)speed;
                    
                    // Process the FSUIPC operations
                    FSUIPCConnection.Process();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to inject wind to FSUIPC: {ex.Message}", "FSUIPC Wind Error");
            }
        }
    }
}
