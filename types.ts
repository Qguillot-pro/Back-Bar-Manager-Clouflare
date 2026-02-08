
export enum DefaultCategory {
  SPIRITS = 'Spiritueux',
  WINE = 'Vins',
  BEER = 'Bières',
  SOFT = 'Softs',
  COCKTAIL_COMPONENTS = 'Ingrédients Cocktail',
  OTHER = 'Autre'
}

export const CATEGORY_ORDER = [
  'Spiritueux',
  'Vins',
  'Bières',
  'Softs',
  'Ingrédients Cocktail',
  'Autre'
];

export type Category = string;
export type UserRole = 'ADMIN' | 'BARMAN';

export interface AppConfig {
  tempItemDuration: '3_DAYS' | '7_DAYS' | '14_DAYS' | '1_MONTH' | '3_MONTHS' | 'INFINITE';
  defaultMargin?: number; // Pourcentage (ex: 82)
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
}

export interface DLCProfile {
  id: string;
  name: string;
  durationHours: number;
  type?: 'OPENING' | 'PRODUCTION'; // Nouveau champ
}

export interface StorageSpace {
  id: string;
  name: string;
  order?: number; // Ordre d'affichage des colonnes
}

export interface Format {
  id: string;
  name: string;
  value?: number; // Contenance ou quantité unitaire (ex: 70 pour 70cl)
}

export interface StockItem {
  id: string;
  articleCode?: string; // Nouveau champ pour le code article (ex: ID POS Astério)
  name: string;
  category: Category;
  formatId: string;
  pricePerUnit: number;
  lastUpdated: string;
  createdAt?: string; // Date de création pour gestion temporaire
  isDLC?: boolean;
  dlcProfileId?: string;
  isConsigne?: boolean; // Nouveau champ pour les produits consignés
  order: number;
  isDraft?: boolean;
  isTemporary?: boolean; // Indicateur produit non prévu
}

export interface DLCHistory {
  id: string;
  itemId: string;
  storageId: string;
  openedAt: string;
  userName?: string;
}

export interface Loss {
  id: string;
  itemId: string;
  openedAt: string;
  discardedAt: string;
  quantity: number;
  userName?: string;
}

export interface StockConsigne {
  itemId: string;
  storageId: string;
  minQuantity: number;
}

export interface StockPriority {
  itemId: string;
  storageId: string;
  priority: number; 
}

export interface StockLevel {
  itemId: string;
  storageId: string;
  currentQuantity: number;
}

export interface Transaction {
  id: string;
  itemId: string;
  storageId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  note?: string; 
  isCaveTransfer?: boolean;
  userName?: string;
}

export interface PendingOrder {
  id: string;
  itemId: string;
  quantity: number;
  initialQuantity?: number; // Quantité initialement commandée
  date: string;
  ruptureDate?: string;
  orderedAt?: string;
  status: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'ARCHIVED'; // Ajout de ARCHIVED
  receivedAt?: string;
  userName?: string;
}

export interface UnfulfilledOrder {
  id: string;
  itemId: string;
  date: string;
  userName?: string;
}

export interface Message {
  id: string;
  content: string;
  userName: string;
  date: string;
  isArchived: boolean;
  adminReply?: string;
  replyDate?: string;
  readBy?: string[]; // Liste des IDs utilisateurs ayant lu le message
}

// --- NOUVEAUX TYPES POUR LES RECETTES ---

export interface Glassware {
  id: string;
  name: string;
  capacity?: number; // en cl
  imageUrl?: string; // Base64 ou URL
  quantity?: number; // Nouveau
  lastUpdated?: string; // Nouveau
}

export interface Technique {
  id: string;
  name: string;
}

export interface RecipeIngredient {
  itemId?: string; // Lien vers StockItem si existant
  tempName?: string; // Nom si pas dans la base
  quantity: number;
  unit: 'cl' | 'ml' | 'dash' | 'piece' | 'cuillere';
}

export interface Recipe {
  id: string;
  name: string;
  category: string; // Ex: Signature, Classique, Mocktail
  glasswareId: string;
  technique: string;
  description: string; // Max 150 cars
  history?: string; // Max 150 cars
  ingredients: RecipeIngredient[];
  decoration?: string;
  sellingPrice?: number;
  costPrice?: number; // Calculé
  status: 'DRAFT' | 'VALIDATED';
  createdBy?: string;
  createdAt: string;
}
