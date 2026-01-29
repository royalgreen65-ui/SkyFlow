
import { GoogleGenAI, Type } from "@google/genai";
import { MetarData } from "../types";

export const fetchMetarData = async (icao: string): Promise<MetarData> => {
  // Retrieve the key injected into the window object by the App component
  const apiKey = (window as any).SKYFLOW_API_KEY;
  if (!apiKey) throw new Error("No API Key configured");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a realistic aviation METAR for ${icao} as of right now. Make it slightly complex. Return JSON.`,
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
