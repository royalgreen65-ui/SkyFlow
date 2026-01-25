
import { GoogleGenAI, Type } from "@google/genai";
import { MetarData, FlightPlan } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchMetarData = async (icao: string): Promise<MetarData> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a realistic aviation METAR for ${icao} as of right now. Make it slightly complex with some cloud layers. Return it in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          icao: { type: Type.STRING },
          raw: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          temperature: { type: Type.NUMBER },
          dewpoint: { type: Type.NUMBER },
          windDirection: { type: Type.NUMBER },
          windSpeed: { type: Type.NUMBER },
          visibility: { type: Type.STRING },
          altimeter: { type: Type.STRING },
          clouds: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                cover: { type: Type.STRING },
                altitude: { type: Type.NUMBER }
              }
            }
          }
        },
        required: ["icao", "raw", "temperature", "windSpeed", "clouds"]
      }
    }
  });

  return JSON.parse(response.text.trim());
};

export const generateBriefing = async (plan: FlightPlan, departureMetar: MetarData, arrivalMetar: MetarData): Promise<string> => {
  const prompt = `
    Generate a professional aviation flight briefing for:
    Aircraft: ${plan.aircraft}
    Route: ${plan.departure} to ${plan.arrival}
    Departure Weather: ${departureMetar.raw}
    Arrival Weather: ${arrivalMetar.raw}
    Cruise: FL${Math.round(plan.cruiseAltitude / 100)}
    
    Format the briefing with sections: OVERVIEW, DEPARTURE ANALYSIS, ENROUTE HAZARDS, ARRIVAL ADVISORY, and FUEL/WEIGHT ASSESSMENT. 
    Be concise but professional.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt
  });

  return response.text;
};
