
import { GoogleGenAI, Type } from "@google/genai";
import { MetarData } from "../types";

export const fetchMetarData = async (icao: string): Promise<MetarData> => {
  // Use the pre-configured API key from the environment directly in the constructor
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a hyper-realistic aviation METAR for ${icao}. Include temperature, wind, and complex cloud layers. Return as JSON.`,
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
