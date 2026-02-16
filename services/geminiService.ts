
import { GoogleGenAI, Type } from "@google/genai";
import { StockItem, Category, Format } from "../types";

export const analyzeStockWithAI = async (items: StockItem[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const prompt = `Analyse l'état des stocks pour ce bar d'hôtel. Voici les données: ${JSON.stringify(items)}. Fournis un résumé, des alertes et des recommandations.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "alerts", "recommendations"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      return null;
    }
    
    return JSON.parse(responseText.trim());
  } catch (error) {
    console.error("Erreur Gemini (Fetch ou API):", error);
    return null;
  }
};

export const generateCocktailWithAI = async (cocktailName: string, availableItems: string[]) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const prompt = `Créé une recette précise pour le cocktail "${cocktailName}". 
        Utilise de préférence les ingrédients de cette liste si possible : ${availableItems.join(', ')}.
        Donne une description courte (max 150 chars) et une anecdote historique (max 150 chars).
        Pour la technique, choisis parmi : Shaker, Verre à mélange, Construit, Blender, Throwing.
        Les unités doivent être 'cl' pour les liquides, 'dash' pour les bitters, 'piece' pour les fruits/oeufs.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        history: { type: Type.STRING },
                        technique: { type: Type.STRING },
                        decoration: { type: Type.STRING },
                        suggestedGlassware: { type: Type.STRING },
                        ingredients: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    quantity: { type: Type.NUMBER },
                                    unit: { type: Type.STRING }
                                },
                                required: ["name", "quantity", "unit"]
                            }
                        }
                    },
                    required: ["description", "history", "technique", "ingredients"]
                }
            }
        });

        const responseText = response.text;
        if (!responseText) return null;
        return JSON.parse(responseText.trim());

    } catch (error) {
        console.error("Erreur Gemini Cocktail:", error);
        return null;
    }
};

export const generateProductSheetWithAI = async (productName: string, type: string) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const prompt = `Génère une fiche technique professionnelle pour le produit "${productName}" de type ${type} (Vin, Spiritueux, Bière...).
        Sois précis et commercial. Pour les vins, indique la région et le cépage probable.
        Tasting notes : 3 mots clés max par champ.
        Food pairing : 1 suggestion courte.
        Temp : en degrés celsius.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        region: { type: Type.STRING },
                        country: { type: Type.STRING },
                        eye: { type: Type.STRING },
                        nose: { type: Type.STRING },
                        mouth: { type: Type.STRING },
                        pairing: { type: Type.STRING },
                        temp: { type: Type.STRING }
                    },
                    required: ["description", "region", "country", "eye", "nose", "mouth", "pairing"]
                }
            }
        });

        const responseText = response.text;
        if (!responseText) return null;
        return JSON.parse(responseText.trim());

    } catch (error) {
        console.error("Erreur Gemini Product Sheet:", error);
        return null;
    }
};
