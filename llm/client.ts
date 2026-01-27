
import { GoogleGenAI } from '@google/genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// Inicijalizirajte GoogleGenAI klijent koristeći API ključ iz okruženja.
// process.env.API_KEY je dostupan putem Vite konfiguracije za frontend.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * llmClient je LangChain-kompatibilni chat model.
 * Koristi se za supervizorsko planiranje i kompleksne zadatke.
 * Odabran je 'gemini-3-pro-preview' zbog naprednih mogućnosti rezoniranja.
 */
export const llmClient = new ChatGoogleGenerativeAI({
  model: 'gemini-3-pro-preview', // Preporučeni model za složene zadatke planiranja
  // Možete dodati i druge konfiguracije ovdje, npr. temperature, topK, topP
  // temperature: 0.7,
  // topK: 64,
  // topP: 0.95,
});

