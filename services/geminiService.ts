
import { StockItem } from "../types";

export const analyzeStockWithAI = async (items: StockItem[]) => {
  try {
    const response = await fetch('/api/analyze-stock', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Erreur Backend Analyze Stock:", error);
    return null;
  }
};

export const generateCocktailWithAI = async (cocktailName: string, availableItems: string[]) => {
    try {
        const response = await fetch('/api/generate-cocktail', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cocktailName, availableItems })
        });
        
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Erreur Backend Cocktail:", error);
        return null;
    }
};

export const generateProductSheetWithAI = async (productName: string, type: string, specificFields: string[] = []) => {
    try {
        const response = await fetch('/api/generate-product-sheet', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productName, type, specificFields })
        });
        
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Erreur Backend Product Sheet:", error);
        return null;
    }
};
