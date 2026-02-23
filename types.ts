
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
  programMapping?: Record<string, string[]>; // Map ProgramType (OF_THE_DAY...) -> Array of Category Names
  mealReminderTimes?: string[]; // ["10:00", "17:00"]
  // Stockage des configurations de cycles en JSON string dans la DB, mais typé ici si besoin
  [key: string]: any; 
}

export interface MealReservation {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  slot: 'LUNCH' | 'DINNER';
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  showInMealPlanning?: boolean;
}

export interface UserLog {
  id: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface DLCProfile {
  id: string;
  name: string;
  durationHours: number;
  type?: 'OPENING' | 'PRODUCTION'; 
}

export interface StorageSpace {
  id: string;
  name: string;
  order?: number; 
}

export interface Format {
  id: string;
  name: string;
  value?: number;
  order?: number;
}

export interface StockItem {
  id: string;
  articleCode?: string; 
  name: string;
  category: Category;
  formatId: string;
  pricePerUnit: number;
  lastUpdated: string;
  createdAt?: string; 
  isDLC?: boolean;
  dlcProfileId?: string;
  isConsigne?: boolean; 
  order: number;
  isDraft?: boolean;
  isTemporary?: boolean; 
  isInventoryOnly?: boolean; 
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
  maxCapacity?: number; 
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
  isServiceTransfer?: boolean;
  userName?: string;
}

export interface PendingOrder {
  id: string;
  itemId: string;
  quantity: number;
  initialQuantity?: number; 
  date: string;
  ruptureDate?: string;
  orderedAt?: string;
  status: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'ARCHIVED'; 
  receivedAt?: string;
  userName?: string;
}

export interface UnfulfilledOrder {
  id: string;
  itemId: string;
  date: string;
  userName?: string;
  quantity?: number;
}

export interface Message {
  id: string;
  content: string;
  userName: string;
  date: string;
  isArchived: boolean;
  adminReply?: string;
  replyDate?: string;
  readBy?: string[]; 
}

// --- RECETTES ---

export interface Glassware {
  id: string;
  name: string;
  capacity?: number; 
  imageUrl?: string; 
  quantity?: number; 
  lastUpdated?: string; 
}

export interface Technique {
  id: string;
  name: string;
}

export interface CocktailCategory {
  id: string;
  name: string;
}

export interface RecipeIngredient {
  itemId?: string; 
  tempName?: string; 
  quantity: number;
  unit: 'cl' | 'ml' | 'dash' | 'piece' | 'cuillere';
}

export interface Recipe {
  id: string;
  name: string;
  category: string; 
  glasswareId: string;
  technique: string;
  technicalDetails?: string; 
  description: string; 
  history?: string; 
  ingredients: RecipeIngredient[];
  decoration?: string;
  sellingPrice?: number;
  costPrice?: number; 
  status: 'DRAFT' | 'VALIDATED';
  createdBy?: string;
  createdAt: string;
}

// --- VIE QUOTIDIENNE ---

export interface Task {
  id: string;
  content: string;
  createdBy: string;
  createdAt: string;
  isDone: boolean;
  doneBy?: string;
  doneAt?: string;
  recurrence?: number[]; // 0=Dimanche, 1=Lundi...
}

export interface EventComment {
  id: string;
  eventId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface EventProduct {
    itemId?: string; // Optional for temporary items
    name?: string;   // Mandatory for temporary items, optional if itemId exists (can be derived)
    quantity: number;
    isTemporary?: boolean;
}

export interface EventGlasswareNeed {
    glasswareId: string;
    quantity: number;
}

export interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  guestsCount?: number;
  description?: string; 
  productsJson?: string; // JSON array of EventProduct
  glasswareJson?: string; // JSON array of EventGlasswareNeed
  createdAt: string;
  productsStatus?: 'PENDING' | 'VALIDATED'; 
}

export type DailyCocktailType = 'OF_THE_DAY' | 'MOCKTAIL' | 'WELCOME' | 'THALASSO';
export type CycleFrequency = 'DAILY' | '2_DAYS' | 'MON_FRI' | 'WEEKLY' | '2_WEEKS';

export interface CycleConfig {
    frequency: CycleFrequency;
    recipeIds: string[]; // Ordered list of IDs
    startDate: string; // Reference date for modulo calculation
    isActive: boolean;
}

export interface DailyCocktail {
  id: string;
  date: string; // YYYY-MM-DD
  type: DailyCocktailType;
  recipeId?: string; // Link to recipe
  customName?: string; // For Welcome cocktail fallback
  customDescription?: string;
}

// --- NOUVEAUX MODULES ---

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string; // HTML/Text with placeholders like {TABLE}
}

export interface AdminNote {
    id: string;
    content: string;
    createdAt: string; // Historique: date de création
    userName?: string;
}

export interface ProductType {
    id: string;
    name: string;
    fields: string[]; // List of custom field names
}

export interface ProductSheet {
    id: string;
    itemId: string; // Link to StockItem
    fullName?: string; // Nom complet pour recherche
    type: string; // Correspond à ProductType.name
    region?: string;
    country?: string;
    tastingNotes?: string; // JSON string { nose: '', mouth: '', eye: '' }
    customFields?: string; // JSON string { 'Cepage': 'Merlot', ... }
    foodPairing?: string;
    servingTemp?: string;
    allergens?: string;
    description: string;
    status: 'DRAFT' | 'VALIDATED';
    updatedAt: string;
}
