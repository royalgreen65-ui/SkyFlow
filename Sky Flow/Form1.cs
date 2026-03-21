using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Xml;
using System.Text.RegularExpressions;

namespace SkyFlow
{
    public partial class Form1 : Form
    {
        #region UI Controls
        private DataGridView dgvWeather;
        private Button btnLoadPln;
        private Button btnConnect;
        private Button btnSyncSelected;
        private Button btnSyncAll;
        private TextBox txtBriefing;

        // Dashboard specific controls
        private Label lblSimConnectStatus;
        private Label lblFsuipcStatus;
        private Label lblPosition;
        private Label lblAltitude;
        private Panel pnlSimConnect;
        private Panel pnlFsuipc;
        private System.Windows.Forms.Timer _syncTimer;
        #endregion

        #region Services and Data
        private List<WeatherInfo> _weatherInfos = new List<WeatherInfo>();
        private readonly WeatherService _weatherService = new WeatherService();
        private readonly PlnParser _plnParser = new PlnParser();
        private readonly SimConnectService _simConnectService = new SimConnectService();
        private readonly FsuipcService _fsuipcService = new FsuipcService();
        private SimConnectService.AircraftPosition _currentPosition;
        #endregion

        public Form1()
        {
            InitializeComponent();
            SetupDashboardUI();
            SetupSyncTimer();
            this.FormClosing += Form1_FormClosing;
        }

        private void SetupSyncTimer()
        {
            _syncTimer = new System.Windows.Forms.Timer();
            _syncTimer.Interval = 15 * 60 * 1000; // 15 minutes
            _syncTimer.Tick += (s, e) => BtnSyncAll_Click(this, EventArgs.Empty);
        }

        #region SimConnect Message Handling
        protected override void DefWndProc(ref Message m)
        {
            if (m.Msg == SimConnectService.WM_USER_SIMCONNECT)
            {
                _simConnectService?.ReceiveMessage();
            }
            else
            {
                base.DefWndProc(ref m);
            }
        }
        #endregion

        private void Form1_FormClosing(object sender, FormClosingEventArgs e)
        {
            _syncTimer?.Stop();
            _simConnectService?.Disconnect();
            _fsuipcService?.Disconnect();
        }

        #region UI Setup
        private void SetupDashboardUI()
        {
            this.Text = "Sky Flow Dashboard";
            this.MinimumSize = new Size(1024, 768);
            this.BackColor = Color.FromArgb(240, 240, 240);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point, ((byte)(0)));

            // Main Layout
            var mainLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2 };
            mainLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 350F));
            mainLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 60F));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            this.Controls.Add(mainLayout);

            // 1. Top Action Bar
            var topBar = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(5), FlowDirection = FlowDirection.LeftToRight };
            mainLayout.Controls.Add(topBar, 0, 0);
            mainLayout.SetColumnSpan(topBar, 2);

            btnLoadPln = new Button { Text = "Load Flight Plan", Size = new Size(130, 40), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(0, 122, 204), ForeColor = Color.White };
            btnConnect = new Button { Text = "Connect to Sim", Size = new Size(130, 40), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(83, 170, 9), ForeColor = Color.White };
            btnSyncSelected = new Button { Text = "Sync Selected", Size = new Size(130, 40), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(202, 81, 0), ForeColor = Color.White };
            btnSyncAll = new Button { Text = "Sync All", Size = new Size(130, 40), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(104, 33, 122), ForeColor = Color.White };
            topBar.Controls.AddRange(new Control[] { btnLoadPln, btnConnect, btnSyncSelected, btnSyncAll });

            // 2. Left Column Layout
            var leftColumnLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            leftColumnLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 180F));
            leftColumnLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            mainLayout.Controls.Add(leftColumnLayout, 0, 1);
            
            // 2a. Status Panel
            var statusGroup = new GroupBox { Text = "Sim Status", Dock = DockStyle.Fill, Padding = new Padding(10) };
            var statusLayout = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown };
            
            pnlSimConnect = new Panel { Size = new Size(20, 20), BackColor = Color.Gray, Margin = new Padding(3) };
            lblSimConnectStatus = new Label { Text = "SimConnect: Disconnected", AutoSize = true, Margin = new Padding(3) };
            var scFlow = new FlowLayoutPanel { FlowDirection = FlowDirection.LeftToRight, AutoSize = true};
            scFlow.Controls.AddRange(new Control[] { pnlSimConnect, lblSimConnectStatus });

            pnlFsuipc = new Panel { Size = new Size(20, 20), BackColor = Color.Gray, Margin = new Padding(3) };
            lblFsuipcStatus = new Label { Text = "FSUIPC: Disconnected", AutoSize = true, Margin = new Padding(3) };
            var fsFlow = new FlowLayoutPanel { FlowDirection = FlowDirection.LeftToRight, AutoSize = true};
            fsFlow.Controls.AddRange(new Control[] { pnlFsuipc, lblFsuipcStatus });

            lblPosition = new Label { Text = "Pos: --, --", AutoSize = true, Margin = new Padding(3), Font = new Font(this.Font, FontStyle.Bold) };
            lblAltitude = new Label { Text = "Alt: -- ft", AutoSize = true, Margin = new Padding(3), Font = new Font(this.Font, FontStyle.Bold) };

            statusLayout.Controls.AddRange(new Control[] { scFlow, fsFlow, lblPosition, lblAltitude });
            statusGroup.Controls.Add(statusLayout);
            leftColumnLayout.Controls.Add(statusGroup, 0, 0);

            // 2b. Flight Plan Panel
            var planGroup = new GroupBox { Text = "Flight Plan Airports", Dock = DockStyle.Fill, Padding = new Padding(10) };
            dgvWeather = new DataGridView { Dock = DockStyle.Fill, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill, ReadOnly = true, AllowUserToAddRows = false, SelectionMode = DataGridViewSelectionMode.FullRowSelect, BackgroundColor = Color.White, BorderStyle = BorderStyle.None };
            planGroup.Controls.Add(dgvWeather);
            leftColumnLayout.Controls.Add(planGroup, 0, 1);

            // 3. Right Column (Briefing/Log)
            var briefingGroup = new GroupBox { Text = "Briefing & Injection Log", Dock = DockStyle.Fill, Padding = new Padding(10) };
            txtBriefing = new TextBox { Dock = DockStyle.Fill, Multiline = true, ScrollBars = ScrollBars.Vertical, ReadOnly = true, Font = new Font("Consolas", 10F), BackColor = Color.White, BorderStyle = BorderStyle.None };
            briefingGroup.Controls.Add(txtBriefing);
            mainLayout.Controls.Add(briefingGroup, 1, 1);

            // Wire up events
            btnLoadPln.Click += BtnLoadPln_Click;
            btnConnect.Click += BtnConnect_Click;
            btnSyncSelected.Click += BtnSyncWeather_Click;
            btnSyncAll.Click += BtnSyncAll_Click;

            _simConnectService.OnPositionUpdated += OnPositionUpdated;
        }
        #endregion

        #region Event Handlers
        private void OnPositionUpdated(SimConnectService.AircraftPosition pos)
        {
            _currentPosition = pos;
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => UpdatePositionUI(pos)));
            }
            else
            {
                UpdatePositionUI(pos);
            }
        }

        private void UpdatePositionUI(SimConnectService.AircraftPosition pos)
        {
            lblPosition.Text = $"Pos: {pos.Latitude:F4}, {pos.Longitude:F4}";
            lblAltitude.Text = $"Alt: {pos.Altitude:F0} ft";
        }

        private void BtnConnect_Click(object sender, EventArgs e)
        {
            _simConnectService.Connect(this.Handle);
            pnlSimConnect.BackColor = Color.Green;
            lblSimConnectStatus.Text = "SimConnect: Connected";

            _fsuipcService.Connect();
            if (_fsuipcService.IsConnected())
            {
                pnlFsuipc.BackColor = Color.Green;
                lblFsuipcStatus.Text = "FSUIPC: Connected";
            }
            else
            {
                pnlFsuipc.BackColor = Color.Red;
                lblFsuipcStatus.Text = "FSUIPC: Not Found";
            }

            // Start polling for position
            var pollTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            pollTimer.Tick += (s, ev) => _simConnectService.RequestPosition();
            pollTimer.Start();

            _syncTimer.Start();
            Log("Connected and auto-sync (15m) started.");
        }

        private async void BtnSyncAll_Click(object sender, EventArgs e)
        {
            if (_weatherInfos.Count == 0) { MessageBox.Show("Please load a flight plan first.", "No Data"); return; }
            
            Log("[GLOBAL SYNC] Starting injection sequence...");
            _simConnectService.SetWeatherModeCustom();

            // 1. Inject GLOB METAR (Global Weather)
            // Use the nearest station or first airport as a global baseline
            var firstWeather = _weatherInfos.FirstOrDefault();
            if (firstWeather != null && !string.IsNullOrWhiteSpace(firstWeather.RawMetar))
            {
                // FSX SimConnect uses 'GLOB' to set global conditions
                string globMetar = firstWeather.RawMetar.Replace(firstWeather.Icao, "GLOB");
                _simConnectService.InjectWeather(globMetar);
                Log("Global weather (GLOB) injected.");
                await Task.Delay(500); // 500ms delay as seen in FSrealWX
            }

            // 2. Inject Individual Stations
            int count = 0;
            foreach (var weather in _weatherInfos)
            {
                if (string.IsNullOrWhiteSpace(weather.RawMetar)) continue;

                _simConnectService.InjectWeather(weather.RawMetar);
                Log($"Injected station: {weather.Icao}");
                
                count++;
                await Task.Delay(500); // Wait 500ms between stations for stability
            }

            // 3. Inject Wind to FSUIPC (DWC style)
            if (firstWeather != null)
            {
                _fsuipcService.InjectWind(firstWeather.Wind);
            }

            Log($"[SYNC COMPLETE] Injected {count} stations. Sim weather mode set to Custom.");
        }

        private void BtnSyncWeather_Click(object sender, EventArgs e)
        {
            if (dgvWeather.SelectedRows.Count == 0) { MessageBox.Show("Please select an airport from the table.", "No Airport Selected"); return; }
            
            var selectedRow = dgvWeather.SelectedRows[0];
            string icao = selectedRow.Cells["ICAO"].Value.ToString();
            var weatherInfo = _weatherInfos.FirstOrDefault(w => w.Icao == icao);

            if (weatherInfo == null || string.IsNullOrWhiteSpace(weatherInfo.RawMetar)) { Log($"No METAR data for {icao}."); return; }

            _simConnectService.InjectWeather(weatherInfo.RawMetar);
            _fsuipcService.InjectWind(weatherInfo.Wind);

            Log($"[LOCAL SYNC: {icao}] METAR sent to SimConnect, Wind sent to FSUIPC.");
        }

        private async void BtnLoadPln_Click(object sender, EventArgs e)
        {
            using (var ofd = new OpenFileDialog { Filter = "FSX Flight Plan (*.pln)|*.pln|All files (*.*)|*.*", Title = "Select Flight Plan" })
            {
                if (ofd.ShowDialog() != DialogResult.OK) return;

                try
                {
                    Log("Loading flight plan...");
                    var icaos = _plnParser.ExtractIcaos(ofd.FileName);
                    if (icaos.Count == 0) { Log("No ICAO codes found in flight plan."); return; }

                    Log($"Found {icaos.Count} airports. Fetching live Sky Flow data...");
                    _weatherInfos = await _weatherService.GetWeatherAsync(icaos);

                    dgvWeather.DataSource = new BindingList<WeatherInfo>(_weatherInfos);
                    if (dgvWeather.Columns.Contains("RawMetar")) dgvWeather.Columns["RawMetar"].Visible = false;
                    
                    Log("Briefing complete. Ready to connect and sync weather.");
                }
                catch (Exception ex) { Log($"Error loading flight plan: {ex.Message}"); }
            }
        }

        private void Log(string message)
        {
            txtBriefing.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}\r\n");
        }
        #endregion
    }
}


