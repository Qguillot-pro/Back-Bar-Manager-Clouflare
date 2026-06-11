import { StockItem } from "../types";

export const analyzeStockWithAI = async (items: StockItem[]) => {
  try {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ANALYZE_STOCK', payload: { items } })
    });
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    const data = await response.json() as any;
    if (data.success && data.result) {
      return data.result;
    }
    return null;
  } catch (error) {
    console.error("Erreur back-end Gemini Stock Analysis:", error);
    return null;
  }
};

export const generateCocktailWithAI = async (cocktailName: string, availableItems: string[]) => {
  try {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GENERATE_COCKTAIL', payload: { cocktailName, availableItems } })
    });
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    const data = await response.json() as any;
    if (data.success && data.result) {
      return data.result;
    }
    return null;
  } catch (error) {
    console.error("Erreur back-end Gemini Cocktail:", error);
    return null;
  }
};

export const generateProductSheetWithAI = async (productName: string, type: string, specificFields: string[] = []) => {
  try {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GENERATE_PRODUCT_SHEET', payload: { productName, type, specificFields } })
    });
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    const data = await response.json() as any;
    if (data.success && data.result) {
      return data.result;
    }
    return null;
  } catch (error) {
    console.error("Erreur back-end Gemini Product Sheet:", error);
    return null;
  }
};
