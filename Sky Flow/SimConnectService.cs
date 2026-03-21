using System;
using System.Windows.Forms;
using Microsoft.FlightSimulator.SimConnect;
using System.Runtime.InteropServices;

namespace SkyFlow
{
    public class SimConnectService
    {
        public const int WM_USER_SIMCONNECT = 0x0402;
        private SimConnect simconnect = null;

        // Data structure for aircraft position
        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        public struct AircraftPosition
        {
            public double Latitude;
            public double Longitude;
            public double Altitude;
        }

        public enum DEFINITIONS
        {
            AircraftPosition
        }

        public enum DATA_REQUESTS
        {
            AircraftPositionRequest
        }

        public event Action<AircraftPosition> OnPositionUpdated;

        public void Connect(IntPtr handle)
        {
            try
            {
                simconnect = new SimConnect("Sky Flow", handle, WM_USER_SIMCONNECT, null, 0);
                
                simconnect.OnRecvOpen += new SimConnect.RecvOpenEventHandler(SimConnect_OnRecvOpen);
                simconnect.OnRecvQuit += new SimConnect.RecvQuitEventHandler(SimConnect_OnRecvQuit);
                simconnect.OnRecvException += new SimConnect.RecvExceptionEventHandler(SimConnect_OnRecvException);
                simconnect.OnRecvSimobjectData += new SimConnect.RecvSimobjectDataEventHandler(SimConnect_OnRecvSimobjectData);

                RegisterDataDefinitions();
            }
            catch (COMException ex)
            {
                MessageBox.Show("Unable to connect to SimConnect: " + ex.Message);
            }
        }

        private void RegisterDataDefinitions()
        {
            simconnect.AddToDataDefinition(DEFINITIONS.AircraftPosition, "PLANE LATITUDE", "degrees", SIMCONNECT_DATATYPE.FLOAT64, 0.0f, SimConnect.SIMCONNECT_UNUSED);
            simconnect.AddToDataDefinition(DEFINITIONS.AircraftPosition, "PLANE LONGITUDE", "degrees", SIMCONNECT_DATATYPE.FLOAT64, 0.0f, SimConnect.SIMCONNECT_UNUSED);
            simconnect.AddToDataDefinition(DEFINITIONS.AircraftPosition, "PLANE ALTITUDE", "feet", SIMCONNECT_DATATYPE.FLOAT64, 0.0f, SimConnect.SIMCONNECT_UNUSED);

            simconnect.RegisterDataDefineStruct<AircraftPosition>(DEFINITIONS.AircraftPosition);
        }

        public void RequestPosition()
        {
            if (simconnect != null)
            {
                simconnect.RequestDataOnSimObject(DATA_REQUESTS.AircraftPositionRequest, DEFINITIONS.AircraftPosition, SimConnect.SIMCONNECT_OBJECT_ID_USER, SIMCONNECT_PERIOD.ONCE, SIMCONNECT_DATA_REQUEST_FLAG.DEFAULT, 0, 0, 0);
            }
        }

        private void SimConnect_OnRecvSimobjectData(SimConnect sender, SIMCONNECT_RECV_SIMOBJECT_DATA data)
        {
            if (data.dwRequestID == (uint)DATA_REQUESTS.AircraftPositionRequest)
            {
                AircraftPosition pos = (AircraftPosition)data.dwData[0];
                OnPositionUpdated?.Invoke(pos);
            }
        }

        public void Disconnect()
        {
            if (simconnect != null)
            {
                simconnect.Dispose();
                simconnect = null;
            }
        }

        private void SimConnect_OnRecvOpen(SimConnect sender, SIMCONNECT_RECV_OPEN data)
        {
            // Connected successfully
        }

        private void SimConnect_OnRecvQuit(SimConnect sender, SIMCONNECT_RECV data)
        {
            Disconnect();
        }

        private void SimConnect_OnRecvException(SimConnect sender, SIMCONNECT_RECV_EXCEPTION data)
        {
            // Silent for now, or log
        }

        public void SetWeatherModeCustom()
        {
            if (simconnect != null)
            {
                simconnect.WeatherSetModeCustom();
            }
        }

        public void InjectWeather(string metar)
        {
            if (simconnect != null && !string.IsNullOrWhiteSpace(metar))
            {
                // Ensure the METAR string is trimmed and formatted correctly for SimConnect
                simconnect.WeatherSetObservation(0, metar.Trim());
            }
        }

        public void ReceiveMessage()
        {
            if (simconnect != null)
            {
                simconnect.ReceiveMessage();
            }
        }
    }
}


