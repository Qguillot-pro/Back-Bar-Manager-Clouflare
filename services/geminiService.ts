import { StockItem } from "../types";

const handleBadResponse = async (response: Response, functionName: string) => {
  let errorMsg = `Server error: ${response.status}`;
  try {
    const errorJson = await response.json() as any;
    if (errorJson && (errorJson.error || errorJson.details)) {
      errorMsg = `${errorJson.error || ''} ${errorJson.details || ''}`.trim() || errorMsg;
    }
  } catch (e) {
    try {
      const errorText = await response.text();
      if (errorText) errorMsg = errorText;
    } catch (_) {}
  }
  throw new Error(errorMsg);
};

export const analyzeStockWithAI = async (items: StockItem[]) => {
  try {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ANALYZE_STOCK', payload: { items } })
    });
    if (!response.ok) {
      await handleBadResponse(response, "analyzeStockWithAI");
    }
    const data = await response.json() as any;
    if (data.success && data.result) {
      return data.result;
    }
    return null;
  } catch (error: any) {
    console.error("Erreur back-end Gemini Stock Analysis:", error?.message || error);
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
      await handleBadResponse(response, "generateCocktailWithAI");
    }
    const data = await response.json() as any;
    if (data.success && data.result) {
      return data.result;
    }
    return null;
  } catch (error: any) {
    console.error("Erreur back-end Gemini Cocktail:", error?.message || error);
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
      await handleBadResponse(response, "generateProductSheetWithAI");
    }
    const data = await response.json() as any;
    if (data.success && data.result) {
      return data.result;
    }
    return null;
  } catch (error: any) {
    console.error("Erreur back-end Gemini Product Sheet:", error?.message || error);
    return null;
  }
};
