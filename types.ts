
export interface MetarData {
  icao: string;
  raw: string;
  timestamp: string;
  temperature: number;
  dewpoint: number;
  windDirection: number;
  windSpeed: number;
  visibility: string;
  altimeter: string;
  clouds: CloudLayer[];
  conditions?: string;
}

export interface CloudLayer {
  cover: 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'SKC';
  altitude: number;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  icao: string;
  weatherAnomaly: string;
  severity: 'Moderate' | 'Severe' | 'Extreme';
  imageUrl: string;
}

export interface FlightPlan {
  departure: string;
  arrival: string;
  alternate: string;
  aircraft: string;
  cruiseAltitude: number;
  fuelWeight: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
}

export enum FlightPhase {
  GROUND = 'Ground Operations',
  DEPARTURE = 'Departure Phase',
  ENROUTE = 'En-Route Cruise',
  APPROACH = 'Approach (Locked)',
  LANDED = 'Landed'
}

export enum NavigationTab {
  DASHBOARD = 'Dashboard',
  PLANNER = 'Flight Planner',
  BRIEFING = 'Briefing',
  SCENARIOS = 'Historical Scenarios',
  XGAUGE = 'XGauge Config',
  SETUP = 'Setup Guide',
  SETTINGS = 'System Settings'
}