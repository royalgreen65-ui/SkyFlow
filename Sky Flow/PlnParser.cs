using System;
using System.Collections.Generic;
using System.Xml;
using System.IO;
using System.Text.RegularExpressions;

namespace SkyFlow
{
    public class PlnParser
    {
        public List<string> ExtractIcaos(string filePath)
        {
            var icaos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!File.Exists(filePath)) return new List<string>();

            try
            {
                XmlDocument doc = new XmlDocument();
                doc.Load(filePath);

                var nodes = doc.SelectNodes("//ICAOIdent | //DepartureID | //DestinationID");
                if (nodes != null)
                {
                    foreach (XmlNode node in nodes)
                    {
                        string icao = node.InnerText.Trim();
                        if (IsValidIcao(icao)) icaos.Add(icao);
                    }
                }

                var waypointNodes = doc.SelectNodes("//ATCWaypoint[@id]");
                if (waypointNodes != null)
                {
                    foreach (XmlNode node in waypointNodes)
                    {
                        string icao = node.Attributes["id"]?.Value?.Trim() ?? "";
                        if (IsValidIcao(icao)) icaos.Add(icao);
                    }
                }
            }
            catch { }

            string fileName = Path.GetFileNameWithoutExtension(filePath);
            var matches = Regex.Matches(fileName, @"[A-Z0-9]{3,4}");
            foreach (Match m in matches)
            {
                if (IsValidIcao(m.Value)) icaos.Add(m.Value.ToUpper());
            }

            return new List<string>(icaos);
        }

        private bool IsValidIcao(string icao)
        {
            if (string.IsNullOrEmpty(icao)) return false;
            string upper = icao.ToUpper();
            
            // Explicitly ignore VFR, IFR, and other common non-ICAO flight plan terms
            if (upper == "VFR" || upper == "IFR" || upper == "ATC" || upper == "GPS") return false;

            return icao.Length >= 3 && icao.Length <= 4 && Regex.IsMatch(icao, @"^[A-Z0-9]+$");
        }
    }
}


