using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Linq;

namespace SkyFlow
{
    public class WeatherInfo
    {
        public string Icao { get; set; } = string.Empty;
        public string RawMetar { get; set; } = string.Empty;
        public string Wind { get; set; } = "N/A";
        public string Visibility { get; set; } = "N/A";
        public string Clouds { get; set; } = "Clear";
        public string TempF { get; set; } = "N/A";
        public string TempDew { get; set; } = "N/A";
        public string Altimeter { get; set; } = "N/A";
    }

    public class WeatherService
    {
        private static readonly HttpClient _httpClient = new HttpClient();

        public async Task<List<WeatherInfo>> GetWeatherAsync(IEnumerable<string> icaos)
        {
            var results = new List<WeatherInfo>();
            var searchIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            
            foreach(var id in icaos)
            {
                string cleanId = id.Trim().ToUpper();
                if (string.IsNullOrEmpty(cleanId)) continue;
                
                // Specific handling for Royal Field (KRLF)
                if (cleanId == "KRLF" || cleanId == "RLF")
                {
                    searchIds.Add("KDTO"); // Fallback to Denton
                }
                else
                {
                    searchIds.Add(cleanId);
                    if (cleanId.Length == 3 && !cleanId.StartsWith("K")) searchIds.Add("K" + cleanId);
                }
            }

            string ids = string.Join(",", searchIds);
            if (string.IsNullOrWhiteSpace(ids)) return results;

            try
            {
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0");
                
                string url = $"https://aviationweather.gov/api/data/metar?ids={ids}";
                string data = await _httpClient.GetStringAsync(url);

                var lines = data.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var line in lines)
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    results.Add(ParseMetar(line));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error fetching weather: {ex.Message}");
            }

            return results;
        }

        private WeatherInfo ParseMetar(string metar)
        {
            var info = new WeatherInfo { RawMetar = metar.Trim() };
            string cleanLine = Regex.Replace(metar, @"^(METAR|SPECI)\s+", "", RegexOptions.IgnoreCase).Trim();
            var icaoMatch = Regex.Match(cleanLine, @"^([A-Z0-9]{3,4})\s");
            if (icaoMatch.Success) info.Icao = icaoMatch.Groups[1].Value;

            var windMatch = Regex.Match(cleanLine, @"(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT");
            if (windMatch.Success) info.Wind = windMatch.Value;

            var visMatch = Regex.Match(cleanLine, @"\s(\d+|M?\d+/\d+)SM");
            if (visMatch.Success) info.Visibility = visMatch.Groups[1].Value + " SM";

            var cloudMatches = Regex.Matches(cleanLine, @"(FEW|SCT|BKN|OVC|VV)(\d{3})");
            if (cloudMatches.Count > 0)
            {
                var cloudList = new List<string>();
                foreach (Match m in cloudMatches) 
                {
                    int feet = int.Parse(m.Groups[2].Value) * 100;
                    cloudList.Add($"{m.Groups[1].Value} @ {feet}ft");
                }
                info.Clouds = string.Join(", ", cloudList);
            }

            var tempMatch = Regex.Match(cleanLine, @"\s(M?\d{2})/(M?\d{2})\s");
            if (tempMatch.Success) 
            {
                int celsius = ParseTemp(tempMatch.Groups[1].Value);
                int fahrenheit = (int)Math.Round(celsius * 9.0 / 5.0 + 32);
                info.TempDew = $"{celsius}°C";
                info.TempF = $"{fahrenheit}°F";
            }

            var altMatch = Regex.Match(cleanLine, @"\s(A|Q)(\d{4})");
            if (altMatch.Success) 
            {
                if (altMatch.Groups[1].Value == "A")
                {
                    info.Altimeter = altMatch.Groups[2].Value.Insert(2, ".") + " inHg";
                }
                else
                {
                    double hpa = double.Parse(altMatch.Groups[2].Value);
                    double inhg = hpa * 0.02953;
                    info.Altimeter = inhg.ToString("F2") + " inHg";
                }
            }

            return info;
        }

        public static string DecodeFdCode(string code, int alt)
        {
            code = code.Trim();
            if (string.IsNullOrEmpty(code) || code == "....") return "No Data";
            if (code == "9900") return "Light & Variable";

            try
            {
                string dirPart = code.Substring(0, 2);
                string spdPart = code.Substring(2, 2);
                int dir = int.Parse(dirPart) * 10;
                int spd = int.Parse(spdPart);

                if (dir > 360) 
                {
                    dir -= 500;
                    spd += 100;
                }

                string tempStr = "";
                if (code.Length >= 6) // e.g. 2415+05 or 2415-05
                {
                    tempStr = code.Substring(4);
                }
                else if (code.Length == 4 && alt > 3000)
                {
                    // Some codes might be 4 digits but temps are implicit
                }

                // Above 24,000ft temps are always negative
                string sign = (alt >= 24000) ? "-" : "";
                if (!string.IsNullOrEmpty(tempStr))
                {
                    if (tempStr.StartsWith("+") || tempStr.StartsWith("-"))
                        tempStr = $", Temp {tempStr}C";
                    else
                        tempStr = $", Temp {sign}{tempStr}C";
                }

                return $"{dir:D3}deg @ {spd}kt{tempStr}";
            }
            catch { return code; }
        }

        private int ParseTemp(string tempStr)
        {
            if (tempStr.StartsWith("M"))
                return -int.Parse(tempStr.Substring(1));
            return int.Parse(tempStr);
        }
    }
}
