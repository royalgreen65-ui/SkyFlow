
import React from 'react';
import { Scenario } from './types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'delta-191',
    title: 'Delta Flight 191',
    description: 'A tragic encounter with a powerful microburst during approach to Dallas/Fort Worth. Experience the sudden shift from extreme headwind to tailwind.',
    date: 'August 2, 1985',
    location: 'Dallas/Fort Worth, TX',
    icao: 'KDFW',
    weatherAnomaly: 'Microburst / Windshear',
    severity: 'Extreme',
    imageUrl: 'https://picsum.photos/seed/delta191/800/450'
  },
  {
    id: 'jfk-jr',
    title: 'JFK Jr. Disorientation',
    description: 'Loss of visual references due to heavy haze and dark night conditions over the Atlantic. Simulate the onset of spatial disorientation.',
    date: 'July 16, 1999',
    location: 'Martha\'s Vineyard, MA',
    icao: 'KMVY',
    weatherAnomaly: 'IMC / Heavy Haze',
    severity: 'Severe',
    imageUrl: 'https://picsum.photos/seed/jfkjr/800/450'
  },
  {
    id: 'southern-242',
    title: 'Southern Airways 242',
    description: 'In-flight loss of both engines after flying through a massive thunderstorm with intense hail and water ingestion.',
    date: 'April 4, 1977',
    location: 'New Hope, GA',
    icao: 'KATL',
    weatherAnomaly: 'Supercell / Hail',
    severity: 'Extreme',
    imageUrl: 'https://picsum.photos/seed/so242/800/450'
  },
  {
    id: 'air-florida-90',
    title: 'Air Florida 90',
    description: 'The failure to clear ice from the wings and improper engine de-icing led to a stall during takeoff from Washington National.',
    date: 'January 13, 1982',
    location: 'Washington, D.C.',
    icao: 'KDCA',
    weatherAnomaly: 'Heavy Snow / Icing',
    severity: 'Severe',
    imageUrl: 'https://picsum.photos/seed/af90/800/450'
  },
  {
    id: 'eastern-66',
    title: 'Eastern Air Lines 66',
    description: 'One of the first accidents to highlight the extreme danger of thunderstorms microbursts during landing approach at JFK.',
    date: 'June 24, 1975',
    location: 'New York City, NY',
    icao: 'KJFK',
    weatherAnomaly: 'Microburst',
    severity: 'Severe',
    imageUrl: 'https://picsum.photos/seed/e66/800/450'
  }
];

export const FSX_AIRCRAFT = [
  "Boeing 737-800",
  "Cessna C172SP Skyhawk",
  "Beechcraft King Air 350",
  "Douglas DC-3",
  "Learjet 45",
  "Bombardier CRJ700",
  "Airbus A321"
];
