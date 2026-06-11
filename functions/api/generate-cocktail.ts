import { GoogleGenAI } from "@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export async function onRequestPost(context: any) {
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Configuration échouée : GEMINI_API_KEY est manquante." }), 
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const { cocktailName, availableItems } = await context.request.json();
    
    // Initialisation du SDK à l'intérieur du handler de la requête
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const prompt = `Créé une recette précise pour le cocktail "${cocktailName}". 
Utilise de préférence les ingrédients de cette liste si possible : ${availableItems?.join(', ') || 'Tout'}.
Donne une description courte (max 150 chars) et une anecdote historique (max 150 chars).
Les unités doivent être 'cl' pour les liquides, 'dash' pour les bitters, 'piece' pour les fruits/oeufs.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash", 
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "object",
            properties: {
                description: { type: "string" },
                history: { type: "string" },
                technique: { type: "string" },
                decoration: { type: "string" },
                suggestedGlassware: { type: "string" },
                ingredients: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            quantity: { type: "number" },
                            unit: { type: "string" }
                        },
                        required: ["name", "quantity", "unit"]
                    }
                }
            },
            required: ["description", "history", "technique", "ingredients"]
        }
      }
    });

    return new Response(
      response.text, 
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Generate cocktail route error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Erreur interne lors de la génération du cocktail", 
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
