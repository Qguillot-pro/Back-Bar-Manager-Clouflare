
import { Pool } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
}

interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: Request | RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

type PagesFunction<Env = unknown, Params extends string = any, Data extends Record<string, unknown> = Record<string, unknown>> = (
  context: EventContext<Env, Params, Data>
) => Response | Promise<Response>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: "Configuration : DATABASE_URL manquante" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const pool = new Pool({ 
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 25000, 
    idleTimeoutMillis: 30000,
    max: 6 
  });

  // Migration V1.3: Product Types and Product Sheets updates
  try {
      await pool.query(`
          CREATE TABLE IF NOT EXISTS product_types (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              fields TEXT
          )
      `);
      await pool.query('ALTER TABLE product_sheets ADD COLUMN IF NOT EXISTS full_name TEXT');
      await pool.query('ALTER TABLE product_sheets ADD COLUMN IF NOT EXISTS custom_fields TEXT');
      await pool.query('ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()');
      await pool.query('ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS user_name TEXT');
      
      // Initial data for product_types if empty
      const typesCheck = await pool.query('SELECT COUNT(*) FROM product_types');
      if (parseInt(typesCheck.rows[0].count) === 0) {
          await pool.query(`
              INSERT INTO product_types (id, name, fields) VALUES 
              ('pt1', 'Vin', '["Cépage", "Millésime", "Degré"]'),
              ('pt2', 'Spiritueux', '["Âge", "Fût", "Degré"]'),
              ('pt3', 'Bière', '["Type", "Degré", "IBU"]'),
              ('pt4', 'Cocktail', '["Base", "Profil"]'),
              ('pt5', 'Autre', '[]')
              ON CONFLICT (id) DO NOTHING
          `);
      }
  } catch (e) {
      console.log("Migration V1.3 skipped or already done", e);
  }

  // Migration V1.4: Add tva_rate to recipes if missing
  try {
      await pool.query('ALTER TABLE recipes ADD COLUMN IF NOT EXISTS tva_rate NUMERIC');
  } catch (e) {
      console.log("Migration tva_rate recipes skipped or already done");
  }

  // Migration Users: Add show_in_meal_planning and profile_id if missing
  try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS show_in_meal_planning BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_id TEXT');
      // Migration V1.7: Add schedule_settings table
      await pool.query(`
          CREATE TABLE IF NOT EXISTS schedule_settings (
              id TEXT PRIMARY KEY DEFAULT 'default',
              max_amplitude INTEGER,
              max_worked_time INTEGER,
              max_split_time INTEGER,
              max_continuous_work_time INTEGER,
              custom_ai_rules TEXT,
              location TEXT,
              weather_refresh_minutes INTEGER,
              planning_weeks INTEGER,
              planning_scale INTEGER,
              opening_hours TEXT,
              setup_time_minutes INTEGER,
              closing_time_minutes INTEGER,
              default_break_minutes INTEGER,
              split_shift_allowed BOOLEAN,
              contract_type TEXT,
              rest_day_pattern TEXT
          )
      `);
      // Initialize with default if empty
      const settingsCheck = await pool.query('SELECT COUNT(*) FROM schedule_settings');
      if (parseInt(settingsCheck.rows[0].count) === 0) {
          await pool.query(`
              INSERT INTO schedule_settings (id, location, weather_refresh_minutes, max_amplitude, max_worked_time, max_split_time, max_continuous_work_time, planning_weeks, planning_scale, setup_time_minutes, closing_time_minutes, default_break_minutes, split_shift_allowed, contract_type, rest_day_pattern)
              VALUES ('default', 'Paris', 30, 780, 600, 240, 360, 1, 60, 30, 30, 30, false, '35H', 'CONTINUOUS')
          `);
      }
  } catch (e) {
      console.log("Migration V1.7 skipped or already done", e);
  }

  // Migration Messages: Add is_archived and read_by if missing
  try {
      await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by TEXT DEFAULT \'[]\'');
  } catch (e) {
      console.log("Migration messages columns skipped or already done");
  }

  // Migration Role Profiles: Add welcome_modal columns
  try {
      await pool.query('ALTER TABLE role_profiles ADD COLUMN IF NOT EXISTS welcome_modal_tiles TEXT');
      await pool.query('ALTER TABLE role_profiles ADD COLUMN IF NOT EXISTS welcome_modal_message TEXT');
  } catch (e) {
      console.log("Migration role_profiles columns skipped or already done");
  }

  // Migration V1.6: Add is_no_stock to items and app_config table
  try {
      await pool.query('ALTER TABLE items ADD COLUMN IF NOT EXISTS is_no_stock BOOLEAN DEFAULT FALSE');
      await pool.query(`
          CREATE TABLE IF NOT EXISTS app_config (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
          )
      `);
  } catch (e) {
      console.log("Migration V1.6 skipped or already done", e);
  }

  // Migration V1.5: Add work_shifts and activity_moments tables
  try {
      await pool.query(`
          CREATE TABLE IF NOT EXISTS staff_shifts (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              date TEXT NOT NULL,
              start_time TEXT NOT NULL,
              end_time TEXT NOT NULL,
              type TEXT NOT NULL,
              is_validated BOOLEAN DEFAULT FALSE,
              role TEXT
          )
      `);
      await pool.query('ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS role TEXT');
      
      await pool.query(`
          CREATE TABLE IF NOT EXISTS daily_affluence (
              id TEXT PRIMARY KEY,
              date TEXT NOT NULL,
              time TEXT NOT NULL,
              level TEXT NOT NULL
          )
      `);
      await pool.query(`
          CREATE TABLE IF NOT EXISTS activity_moments (
              id TEXT PRIMARY KEY,
              day_of_week INTEGER NOT NULL,
              start_time TEXT NOT NULL,
              end_time TEXT NOT NULL,
              level TEXT NOT NULL
          )
      `);
      await pool.query(`
          CREATE TABLE IF NOT EXISTS absence_requests (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              start_date TEXT NOT NULL,
              end_date TEXT NOT NULL,
              start_time TEXT,
              end_time TEXT,
              reason TEXT,
              status TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT NOW()
          )
      `);
      await pool.query(`
          CREATE TABLE IF NOT EXISTS meal_reservations (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              date TEXT NOT NULL,
              slot TEXT NOT NULL DEFAULT 'LUNCH',
              created_at TIMESTAMP DEFAULT NOW()
          )
      `);
      // Ensure slot column exists if table already existed
      try {
          await pool.query('ALTER TABLE meal_reservations ADD COLUMN IF NOT EXISTS slot TEXT NOT NULL DEFAULT \'LUNCH\'');
      } catch (e) {
          console.log("Migration slot meal_reservations skipped or already done");
      }
  } catch (e) {
      console.log("Migration work_shifts/activity_moments skipped or already done", e);
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname; 

    // --- 1. ROUTE PING ---
    if (request.method === 'GET' && path.includes('/ping')) {
        const result = await pool.query('SELECT NOW()');
        return new Response(JSON.stringify({ status: 'ok', time: result.rows[0] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    // --- 2. ROUTE INIT AUTH ---
    if (request.method === 'GET' && path.includes('/init')) {
        const [users, appConfig, roleProfiles, permissions, scheduleSettings] = await Promise.all([
            pool.query('SELECT * FROM users'),
            pool.query('SELECT * FROM app_config'),
            pool.query('SELECT * FROM role_profiles'),
            pool.query('SELECT * FROM permissions'),
            pool.query('SELECT * FROM schedule_settings WHERE id = \'default\'')
        ]);

        const configMap: any = { tempItemDuration: '14_DAYS', defaultMargin: 82 };
        appConfig.rows.forEach((row: any) => {
            if (row.key === 'temp_item_duration') configMap.tempItemDuration = row.value;
            if (row.key === 'default_margin') configMap.defaultMargin = parseInt(row.value);
            if (row.key === 'program_mapping') {
                try {
                    configMap.programMapping = JSON.parse(row.value);
                } catch (e) {
                    console.error("Error parsing program_mapping", e);
                    configMap.programMapping = {};
                }
            }
            if (row.key === 'program_thresholds') {
                try {
                    configMap.programThresholds = JSON.parse(row.value);
                } catch (e) {
                    console.error("Error parsing program_thresholds", e);
                    configMap.programThresholds = {};
                }
            }
            if (row.key === 'meal_reminder_times') {
                try {
                    configMap.mealReminderTimes = JSON.parse(row.value);
                } catch (e) {
                    configMap.mealReminderTimes = [];
                }
            }
            if (row.key === 'bar_day_start') configMap.barDayStart = row.value;
            if (row.key === 'email_sender') configMap.emailSender = row.value;
            if (row.key === 'tva_rates') {
                try {
                    configMap.tvaRates = JSON.parse(row.value);
                } catch (e) {
                    configMap.tvaRates = [5.5, 10, 20];
                }
            }
            if (row.key === 'schedule_config') {
                try {
                    configMap.scheduleConfig = JSON.parse(row.value);
                } catch (e) {
                    console.error("Error parsing schedule_config", e);
                }
            }
            if (row.key === 'welcome_modal_tiles') {
                try {
                    configMap.welcomeModalTiles = JSON.parse(row.value);
                } catch (e) {
                    configMap.welcomeModalTiles = ['cocktails', 'messages', 'tasks', 'meals'];
                }
            }
            if (row.key === 'welcome_modal_message') configMap.welcomeModalMessage = row.value;
        });

        if (scheduleSettings.rows.length > 0) {
            const s = scheduleSettings.rows[0];
            let openingHours = {};
            try { openingHours = JSON.parse(s.opening_hours || '{}'); } catch(e) {}
            
            configMap.scheduleConfig = {
                ...(configMap.scheduleConfig || {}),
                maxAmplitude: s.max_amplitude,
                maxWorkedTime: s.max_worked_time,
                maxSplitTime: s.max_split_time,
                maxContinuousWorkTime: s.max_continuous_work_time,
                customAiRules: s.custom_ai_rules,
                location: s.location,
                weatherRefreshMinutes: s.weather_refresh_minutes,
                planningWeeks: s.planning_weeks,
                planningScale: s.planning_scale,
                openingHours: Object.keys(openingHours).length > 0 ? openingHours : (configMap.scheduleConfig?.openingHours),
                setupTimeMinutes: s.setup_time_minutes,
                closingTimeMinutes: s.closing_time_minutes,
                defaultBreakMinutes: s.default_break_minutes,
                splitShiftAllowed: s.split_shift_allowed,
                contractType: s.contract_type,
                restDayPattern: s.rest_day_pattern
            };
        }
            if (row.key === 'temp_item_duration') configMap.tempItemDuration = row.value;
            if (row.key === 'default_margin') configMap.defaultMargin = parseInt(row.value);
            if (row.key === 'program_mapping') {
                try {
                    configMap.programMapping = JSON.parse(row.value);
                } catch (e) {
                    console.error("Error parsing program_mapping", e);
                    configMap.programMapping = {};
                }
            }
            if (row.key === 'program_thresholds') {
                try {
                    configMap.programThresholds = JSON.parse(row.value);
                } catch (e) {
                    console.error("Error parsing program_thresholds", e);
                    configMap.programThresholds = {};
                }
            }
            if (row.key === 'meal_reminder_times') {
                try {
                    configMap.mealReminderTimes = JSON.parse(row.value);
                } catch (e) {
                    configMap.mealReminderTimes = [];
                }
            }
            if (row.key === 'bar_day_start') configMap.barDayStart = row.value;
            if (row.key === 'email_sender') configMap.emailSender = row.value;
            if (row.key === 'tva_rates') {
                try {
                    configMap.tvaRates = JSON.parse(row.value);
                } catch (e) {
                    configMap.tvaRates = [5.5, 10, 20];
                }
            }
            if (row.key === 'schedule_config') {
                try {
                    configMap.scheduleConfig = JSON.parse(row.value);
                } catch (e) {
                    console.error("Error parsing schedule_config", e);
                }
            }
            if (row.key === 'welcome_modal_tiles') {
                try {
                    configMap.welcomeModalTiles = JSON.parse(row.value);
                } catch (e) {
                    configMap.welcomeModalTiles = ['cocktails', 'messages', 'tasks', 'meals'];
                }
            }
            if (row.key === 'welcome_modal_message') configMap.welcomeModalMessage = row.value;
        });

        // Les configurations de cycles
        appConfig.rows.forEach((row: any) => {
            if (row.key.startsWith('cycle_')) configMap[row.key] = row.value;
        });

        const profiles = roleProfiles.rows.map((p: any) => {
            const pPermissions: any = {};
            permissions.rows.filter((perm: any) => perm.role_profile_id === p.id).forEach((perm: any) => {
                pPermissions[perm.resource_name] = { view: perm.can_view, edit: perm.can_edit };
            });
            let welcomeModalTiles: string[] | undefined;
            try { if (p.welcome_modal_tiles) welcomeModalTiles = JSON.parse(p.welcome_modal_tiles); } catch (e) {}
            return { 
                id: p.id, 
                name: p.name, 
                permissions: pPermissions,
                welcomeModalTiles,
                welcomeModalMessage: p.welcome_modal_message
            };
        });

        const responseBody = {
            users: users.rows.map((u: any) => ({
                id: u.id,
                name: u.name,
                role: u.role,
                profileId: u.profile_id,
                pin: u.pin,
                showInMealPlanning: u.show_in_meal_planning !== false // Default true if null/undefined
            })),
            roleProfiles: profiles,
            appConfig: configMap
        };

        return new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    // --- NEW: ROUTE WEATHER RSS ---
    if (request.method === 'GET' && path.includes('/weather')) {
        try {
            const client = await pool.connect();
            let location = 'Paris';
            try {
                const configRes = await client.query("SELECT value FROM app_config WHERE key = 'schedule_config'");
                if (configRes.rows.length > 0) {
                    const config = JSON.parse(configRes.rows[0].value);
                    location = config.location || 'Paris';
                }
            } finally {
                client.release();
            }

            // Météo France RSS feed for the location (fallback to vigilance if city not found)
            const rssUrl = 'https://vigilance.meteofrance.fr/rss/vigilance.xml';
            const response = await fetch(rssUrl);
            const xml = await response.text();
            
            const titleMatch = xml.match(/<title>(.*?)<\/title>/);
            const descMatch = xml.match(/<description>(.*?)<\/description>/);
            
            return new Response(JSON.stringify({ 
                title: titleMatch ? titleMatch[1] : 'Météo France',
                description: descMatch ? descMatch[1] : 'Pas de données disponibles',
                location: location,
                raw: xml.substring(0, 1000)
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
        }
    }

    // --- 3. ROUTE DATA SYNC (SEGMENTÉE PAR SCOPE) ---
    if (request.method === 'GET' && path.includes('/data_sync')) {
        const scope = url.searchParams.get('scope'); 

        let query = '';

        if (scope === 'static') {
             query = `
                SELECT json_build_object(
                    'items', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM items ORDER BY sort_order) t),
                    'storages', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM storage_spaces ORDER BY sort_order, name) t),
                    'formats', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM formats ORDER BY sort_order) t),
                    'categories', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM categories ORDER BY sort_order) t),
                    'dlcProfiles', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM dlc_profiles) t),
                    'priorities', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM stock_priorities) t),
                    'techniques', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM techniques ORDER BY name) t),
                    'cocktailCategories', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM cocktail_categories) t),
                    'glassware', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM glassware ORDER BY name) t),
                    'recipes', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM recipes ORDER BY name) t),
                    'productSheets', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM product_sheets ORDER BY updated_at DESC) t),
                    'productTypes', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM product_types ORDER BY name) t),
                    'emailTemplates', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM email_templates ORDER BY name) t)
                ) as data;
            `;
        } else if (scope === 'stock') {
             query = `
                SELECT json_build_object(
                    'stockLevels', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM stock_levels) t),
                    'consignes', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM stock_consignes) t),
                    'dailyCocktails', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM daily_cocktails ORDER BY date DESC LIMIT 100) t),
                    'events', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM events WHERE start_time >= NOW() - INTERVAL '60 days') t),
                    'tasks', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM tasks ORDER BY created_at DESC LIMIT 200) t),
                    'unfulfilledOrders', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM unfulfilled_orders ORDER BY date DESC LIMIT 500) t),
                    'orders', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM orders WHERE status = 'PENDING' OR status = 'ORDERED') t),
                    'mealReservations', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM meal_reservations) t),
                    'staffShifts', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM staff_shifts WHERE date >= (CURRENT_DATE - INTERVAL '30 days')::text) t),
                    'dailyAffluence', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM daily_affluence WHERE date >= (CURRENT_DATE - INTERVAL '30 days')::text) t),
                    'activityMoments', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM activity_moments) t),
                    'absenceRequests', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM absence_requests) t),
                    'adminNotes', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM admin_notes ORDER BY created_at DESC LIMIT 50) t)
                ) as data;
            `;
        } else if (scope === 'history') {
             query = `
                SELECT json_build_object(
                    'transactions', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM transactions ORDER BY date DESC LIMIT 5000) t),
                    'archivedOrders', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM orders WHERE status = 'RECEIVED' OR status = 'ARCHIVED' ORDER BY date DESC LIMIT 1000) t),
                    'dlcHistory', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM dlc_history ORDER BY opened_at DESC LIMIT 1000) t),
                    'messages', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM messages ORDER BY date DESC LIMIT 200) t),
                    'losses', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM losses ORDER BY discarded_at DESC LIMIT 1000) t),
                    'dailyStockAlerts', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM daily_stock_alerts ORDER BY date DESC LIMIT 1000) t),
                    'eventComments', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM event_comments ORDER BY created_at DESC LIMIT 500) t),
                    'userLogs', (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT * FROM user_logs ORDER BY timestamp DESC LIMIT 200) t)
                ) as data;
            `;
        } else {
             return new Response(JSON.stringify({ error: "Paramètre 'scope' manquant (static, stock, history)" }), { status: 400, headers: corsHeaders });
        }

        const result = await pool.query(query);
        const rawData = result.rows[0].data;
        const responseBody: any = {};

        // MAPPING DES DONNÉES
        
        // --- STATIC ---
        if (rawData.items) responseBody.items = rawData.items.map((row: any) => ({
            id: row.id, articleCode: row.article_code, name: row.name, category: row.category, formatId: row.format_id,
            pricePerUnit: parseFloat(row.price_per_unit || '0'), lastUpdated: row.last_updated, createdAt: row.created_at,
            isDLC: row.is_dlc, dlcProfileId: row.dlc_profile_id, isConsigne: row.is_consigne, order: row.sort_order,
            isDraft: row.is_draft, isTemporary: row.is_temporary, isInventoryOnly: row.is_inventory_only, isNoStock: row.is_no_stock, inventoryLocation: row.inventory_location
        }));
        if (rawData.storages) responseBody.storages = rawData.storages.map((s: any) => ({ id: s.id, name: s.name, order: s.sort_order }));
        if (rawData.formats) responseBody.formats = rawData.formats.map((f: any) => ({ id: f.id, name: f.name, value: parseFloat(f.value || '0'), order: f.sort_order }));
        if (rawData.categories) responseBody.categories = rawData.categories.map((c: any) => c.name);
        if (rawData.dlcProfiles) responseBody.dlcProfiles = rawData.dlcProfiles.map((p: any) => ({ id: p.id, name: p.name, durationHours: p.duration_hours, type: p.type || 'OPENING' }));
        if (rawData.priorities) responseBody.priorities = rawData.priorities.map((p: any) => ({ itemId: p.item_id, storageId: p.storage_id, priority: p.priority }));
        if (rawData.techniques) responseBody.techniques = rawData.techniques.map((t: any) => ({ id: t.id, name: t.name }));
        if (rawData.cocktailCategories) responseBody.cocktailCategories = rawData.cocktailCategories.map((c: any) => ({ id: c.id, name: c.name }));
        if (rawData.glassware) responseBody.glassware = rawData.glassware.map((g: any) => ({ id: g.id, name: g.name, capacity: parseFloat(g.capacity || '0'), imageUrl: g.image_url, quantity: g.quantity || 0, lastUpdated: g.last_updated }));
        if (rawData.recipes) responseBody.recipes = rawData.recipes.map((r: any) => ({
            id: r.id, name: r.name, category: r.category, glasswareId: r.glassware_id, technique: r.technique, technicalDetails: r.technical_details, description: r.description,
            history: r.history, decoration: r.decoration, sellingPrice: parseFloat(r.selling_price || '0'), costPrice: parseFloat(r.cost_price || '0'),
            tvaRate: r.tva_rate,
            status: r.status, createdBy: r.created_by, createdAt: r.created_at, ingredients: r.ingredients
        }));
        // UPDATE: Product Sheets with new fields
        if (rawData.productSheets) responseBody.productSheets = rawData.productSheets.map((p: any) => {
            let customFieldsObj = {};
            try { customFieldsObj = JSON.parse(p.custom_fields || '{}'); } catch (e) {}
            
            return {
                id: p.id, itemId: p.item_id, fullName: p.full_name, type: p.type, region: p.region, country: p.country, 
                tastingNotes: p.tasting_notes, customFields: p.custom_fields,
                foodPairing: p.food_pairing, servingTemp: p.serving_temp, allergens: p.allergens, description: p.description, status: p.status, updatedAt: p.updated_at,
                glasswareIds: customFieldsObj['glasswareIds'] || [],
                salesFormat: customFieldsObj['salesFormat'] || 0,
                actualPrice: customFieldsObj['actualPrice'] || 0,
                marginRate: customFieldsObj['marginRate'],
                tvaRate: customFieldsObj['tvaRate']
            };
        });
        // NEW: Product Types
        if (rawData.productTypes) responseBody.productTypes = rawData.productTypes.map((t: any) => ({
            id: t.id, name: t.name, fields: JSON.parse(t.fields || '[]')
        }));
        if (rawData.emailTemplates) responseBody.emailTemplates = rawData.emailTemplates.map((t: any) => ({
            id: t.id, name: t.name, subject: t.subject, body: t.body
        }));

        // --- STOCK ---
        if (rawData.stockLevels) responseBody.stockLevels = rawData.stockLevels.map((row: any) => ({ itemId: row.item_id, storageId: row.storage_id, currentQuantity: parseFloat(row.quantity || row.current_quantity || '0'), order: row.order || 0 }));
        if (rawData.consignes) responseBody.consignes = rawData.consignes.map((row: any) => ({ 
            itemId: row.item_id, storageId: row.storage_id, minQuantity: parseFloat(row.min_quantity || '0'), maxCapacity: row.max_capacity ? parseFloat(row.max_capacity) : undefined 
        }));
        if (rawData.dailyCocktails) responseBody.dailyCocktails = rawData.dailyCocktails.map((d: any) => ({ id: d.id, date: d.date, type: d.type, recipeId: d.recipe_id, customName: d.custom_name, customDescription: d.custom_description }));
        if (rawData.events) responseBody.events = rawData.events.map((e: any) => ({ id: e.id, title: e.title, startTime: e.start_time, endTime: e.end_time, location: e.location, guestsCount: e.guests_count, description: e.description, productsJson: e.products_json, glasswareJson: e.glassware_json, createdAt: e.created_at }));
        // UPDATE: Admin Notes List (History)
        if (rawData.adminNotes) responseBody.adminNotes = rawData.adminNotes.map((n: any) => ({ 
            id: n.id, content: n.content, createdAt: n.created_at || n.updated_at, userName: n.user_name 
        }));
        
        if (rawData.tasks) responseBody.tasks = rawData.tasks.map((t: any) => ({ 
            id: t.id, content: t.content, createdBy: t.created_by, createdAt: t.created_at, isDone: t.is_done, doneBy: t.done_by, doneAt: t.done_at, recurrence: t.recurrence ? JSON.parse(t.recurrence) : undefined
        }));

        if (rawData.unfulfilledOrders) responseBody.unfulfilledOrders = rawData.unfulfilledOrders.map((u: any) => ({ 
            id: u.id, itemId: u.item_id, date: u.date, userName: u.user_name, quantity: parseFloat(u.quantity || '1') 
        }));
        if (rawData.mealReservations) responseBody.mealReservations = rawData.mealReservations.map((r: any) => ({ 
            id: r.id, userId: r.user_id, date: r.date, slot: r.slot 
        }));
        if (rawData.staffShifts) responseBody.staffShifts = rawData.staffShifts.map((s: any) => ({
            id: s.id, userId: s.user_id, date: s.date, startTime: s.start_time, endTime: s.end_time, type: s.type,
            isValidated: s.is_validated, role: s.role
        }));
        if (rawData.dailyAffluence) responseBody.dailyAffluence = rawData.dailyAffluence.map((a: any) => ({
            id: a.id, date: a.date, time: a.time, level: a.level
        }));
        if (rawData.activityMoments) responseBody.activityMoments = rawData.activityMoments.map((m: any) => ({
            id: m.id, dayOfWeek: m.day_of_week, startTime: m.start_time, endTime: m.end_time, level: m.level
        }));
        if (rawData.absenceRequests) responseBody.absenceRequests = rawData.absenceRequests.map((a: any) => ({
            id: a.id, userId: a.user_id, startDate: a.start_date, endDate: a.end_date, startTime: a.start_time, endTime: a.end_time, reason: a.reason, status: a.status, createdAt: a.created_at
        }));
        
        const orderMapper = (row: any) => ({ 
            id: row.id, itemId: row.item_id, quantity: parseFloat(row.quantity || '0'), initialQuantity: row.initial_quantity ? parseFloat(row.initial_quantity) : null,
            date: row.date, status: row.status, userName: row.user_name, ruptureDate: row.rupture_date, orderedAt: row.ordered_at, receivedAt: row.received_at
        });
        if (rawData.orders) responseBody.orders = rawData.orders.map(orderMapper);
        if (rawData.archivedOrders) responseBody.orders = (responseBody.orders || []).concat(rawData.archivedOrders.map(orderMapper));

        // --- HISTORY ---
        if (rawData.transactions) responseBody.transactions = rawData.transactions.map((t: any) => ({
            ...t, itemId: t.item_id, storageId: t.storage_id, quantity: parseFloat(t.quantity || '0'), isCaveTransfer: t.is_cave_transfer, isServiceTransfer: t.is_service_transfer, userName: t.user_name
        }));
        if (rawData.dlcHistory) responseBody.dlcHistory = rawData.dlcHistory.map((d: any) => ({...d, itemId: d.item_id, storageId: d.storage_id, openedAt: d.opened_at, userName: d.user_name}));
        if (rawData.messages) responseBody.messages = rawData.messages.map((m: any) => {
            let readBy: string[] = []; try { if (m.read_by) readBy = JSON.parse(m.read_by); } catch(e) {}
            return { id: m.id, content: m.content, userName: m.user_name, date: m.date, isArchived: m.is_archived, adminReply: m.admin_reply, replyDate: m.reply_date, readBy };
        });
        if (rawData.losses) responseBody.losses = rawData.losses.map((l: any) => ({ id: l.id, itemId: l.item_id, openedAt: l.opened_at, discardedAt: l.discarded_at, quantity: parseFloat(l.quantity || '0'), userName: l.user_name }));
        if (rawData.dailyStockAlerts) responseBody.dailyStockAlerts = rawData.dailyStockAlerts.map((a: any) => ({ id: a.id, date: a.date, type: a.type, itemId: a.item_id, quantity: parseFloat(a.quantity || '0'), consigne: parseFloat(a.consigne || '0') }));
        if (rawData.eventComments) responseBody.eventComments = rawData.eventComments.map((c: any) => ({ id: c.id, eventId: c.event_id, userName: c.user_name, content: c.content, createdAt: c.created_at }));
        if (rawData.userLogs) responseBody.userLogs = rawData.userLogs.map((l: any) => ({ id: l.id, userName: l.user_name, action: l.action, details: l.details, timestamp: l.timestamp }));

        return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // --- ACTION POST ---
    if (request.method === 'POST') {
      const bodyText = await request.text();
      const { action, payload } = JSON.parse(bodyText || '{}');

      if (!action) return new Response(JSON.stringify({ error: 'Action manquante' }), { status: 400, headers: corsHeaders });

      switch (action) {
        case 'SAVE_LOG': { await pool.query(`INSERT INTO user_logs (id, user_name, action, details, timestamp) VALUES ($1, $2, $3, $4, NOW())`, [payload.id, payload.userName, payload.action, payload.details]); break; }
        case 'SAVE_TASK': { const { id, content, createdBy, isDone, doneBy, doneAt, recurrence } = payload; await pool.query(`INSERT INTO tasks (id, content, created_by, is_done, done_by, done_at, recurrence, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) ON CONFLICT (id) DO UPDATE SET is_done = EXCLUDED.is_done, done_by = EXCLUDED.done_by, done_at = EXCLUDED.done_at, recurrence = EXCLUDED.recurrence`, [id, content, createdBy, isDone, doneBy, doneAt, recurrence ? JSON.stringify(recurrence) : null]); break; }
        case 'DELETE_TASK': { await pool.query('DELETE FROM tasks WHERE id = $1', [payload.id]); break; }
        case 'SAVE_EVENT': { const { id, title, startTime, endTime, location, guestsCount, description, productsJson, glasswareJson } = payload; await pool.query(`INSERT INTO events (id, title, start_time, end_time, location, guests_count, description, products_json, glassware_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, location = EXCLUDED.location, guests_count = EXCLUDED.guests_count, description = EXCLUDED.description, products_json = EXCLUDED.products_json, glassware_json = EXCLUDED.glassware_json`, [id, title, startTime, endTime, location, guestsCount, description, productsJson, glasswareJson]); break; }
        case 'DELETE_EVENT': { await pool.query('DELETE FROM events WHERE id = $1', [payload.id]); break; }
        case 'SAVE_EVENT_COMMENT': { await pool.query(`INSERT INTO event_comments (id, event_id, user_name, content, created_at) VALUES ($1, $2, $3, $4, NOW())`, [payload.id, payload.eventId, payload.userName, payload.content]); break; }
        case 'SAVE_DAILY_COCKTAIL': { const { id, date, type, recipeId, customName, customDescription } = payload; await pool.query(`INSERT INTO daily_cocktails (id, date, type, recipe_id, custom_name, custom_description) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET recipe_id = EXCLUDED.recipe_id, custom_name = EXCLUDED.custom_name, custom_description = EXCLUDED.custom_description`, [id, date, type, recipeId, customName, customDescription]); break; }
        case 'SAVE_SCHEDULE_SETTINGS': {
            const s = payload;
            await pool.query(`
                INSERT INTO schedule_settings (
                    id, max_amplitude, max_worked_time, max_split_time, max_continuous_work_time, 
                    custom_ai_rules, location, weather_refresh_minutes, planning_weeks, planning_scale, 
                    opening_hours, setup_time_minutes, closing_time_minutes, default_break_minutes, 
                    split_shift_allowed, contract_type, rest_day_pattern
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (id) DO UPDATE SET 
                    max_amplitude = EXCLUDED.max_amplitude,
                    max_worked_time = EXCLUDED.max_worked_time,
                    max_split_time = EXCLUDED.max_split_time,
                    max_continuous_work_time = EXCLUDED.max_continuous_work_time,
                    custom_ai_rules = EXCLUDED.custom_ai_rules,
                    location = EXCLUDED.location,
                    weather_refresh_minutes = EXCLUDED.weather_refresh_minutes,
                    planning_weeks = EXCLUDED.planning_weeks,
                    planning_scale = EXCLUDED.planning_scale,
                    opening_hours = EXCLUDED.opening_hours,
                    setup_time_minutes = EXCLUDED.setup_time_minutes,
                    closing_time_minutes = EXCLUDED.closing_time_minutes,
                    default_break_minutes = EXCLUDED.default_break_minutes,
                    split_shift_allowed = EXCLUDED.split_shift_allowed,
                    contract_type = EXCLUDED.contract_type,
                    rest_day_pattern = EXCLUDED.rest_day_pattern
            `, [
                'default', s.maxAmplitude, s.maxWorkedTime, s.maxSplitTime, s.maxContinuousWorkTime,
                s.customAiRules, s.location, s.weatherRefreshMinutes, s.planningWeeks, s.planningScale,
                JSON.stringify(s.openingHours), s.setupTimeMinutes, s.closingTimeMinutes, s.defaultBreakMinutes,
                s.splitShiftAllowed, s.contractType, s.restDayPattern
            ]);
            break;
        }
        case 'SAVE_CONFIG': { await pool.query(`INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [payload.key, String(payload.value)]); break; }
        case 'SAVE_ITEM': { const { id, name, articleCode, category, formatId, pricePerUnit, isDLC, dlcProfileId, isConsigne, order, isDraft, isTemporary, createdAt, isInventoryOnly, isNoStock, inventoryLocation } = payload; await pool.query(`INSERT INTO items (id, article_code, name, category, format_id, price_per_unit, is_dlc, dlc_profile_id, is_consigne, sort_order, is_draft, is_temporary, is_inventory_only, is_no_stock, inventory_location, created_at, last_updated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($16, NOW()), NOW()) ON CONFLICT (id) DO UPDATE SET article_code = EXCLUDED.article_code, name = EXCLUDED.name, category = EXCLUDED.category, format_id = EXCLUDED.format_id, price_per_unit = EXCLUDED.price_per_unit, is_dlc = EXCLUDED.is_dlc, dlc_profile_id = EXCLUDED.dlc_profile_id, is_consigne = EXCLUDED.is_consigne, sort_order = EXCLUDED.sort_order, is_draft = EXCLUDED.is_draft, is_temporary = EXCLUDED.is_temporary, is_inventory_only = EXCLUDED.is_inventory_only, is_no_stock = EXCLUDED.is_no_stock, inventory_location = EXCLUDED.inventory_location, last_updated = NOW()`, [id, articleCode, name, category, formatId, pricePerUnit, isDLC, dlcProfileId, isConsigne, order, isDraft, isTemporary, isInventoryOnly, isNoStock, inventoryLocation, createdAt]); break; }
        case 'DELETE_ITEM': { await pool.query('DELETE FROM items WHERE id = $1', [payload.id]); break; }
        case 'SAVE_STOCK': { await pool.query(`INSERT INTO stock_levels (item_id, storage_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (item_id, storage_id) DO UPDATE SET quantity = EXCLUDED.quantity`, [payload.itemId, payload.storageId, payload.currentQuantity]); break; }
        case 'SAVE_STOCK_LEVEL': { await pool.query(`INSERT INTO stock_levels (item_id, storage_id, quantity, "order") VALUES ($1, $2, $3, $4) ON CONFLICT (item_id, storage_id) DO UPDATE SET quantity = EXCLUDED.quantity, "order" = EXCLUDED."order"`, [payload.itemId, payload.storageId, payload.currentQuantity, payload.order || 0]); break; }
        case 'SAVE_TRANSACTION': { await pool.query(`INSERT INTO transactions (id, item_id, storage_id, type, quantity, date, note, is_cave_transfer, user_name, is_service_transfer) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [payload.id, payload.itemId, payload.storageId, payload.type, payload.quantity, payload.date, payload.note, payload.isCaveTransfer, payload.userName, payload.isServiceTransfer || false]); break; }
        case 'DELETE_TRANSACTION': { await pool.query('DELETE FROM transactions WHERE id = $1', [payload.id]); break; }
        case 'SAVE_ORDER': { const { id, itemId, quantity, initialQuantity, date, status, userName, ruptureDate, orderedAt, receivedAt } = payload; await pool.query(`INSERT INTO orders (id, item_id, quantity, initial_quantity, date, status, user_name, rupture_date, ordered_at, received_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, quantity = EXCLUDED.quantity, initial_quantity = EXCLUDED.initial_quantity, rupture_date = EXCLUDED.rupture_date, ordered_at = EXCLUDED.ordered_at, received_at = EXCLUDED.received_at`, [id, itemId, quantity, initialQuantity, date, status, userName, ruptureDate, orderedAt, receivedAt]); break; }
        case 'DELETE_ORDER': { await pool.query('DELETE FROM orders WHERE id = $1', [payload.id]); break; }
        case 'SAVE_UNFULFILLED_ORDER': { await pool.query(`INSERT INTO unfulfilled_orders (id, item_id, date, user_name, quantity) VALUES ($1, $2, $3, $4, $5)`, [payload.id, payload.itemId, payload.date, payload.userName, payload.quantity || 1]); break; }
        case 'SAVE_DLC_HISTORY': { 
            const { id, itemId, storageId, openedAt, userName, quantity, isNotOpened } = payload;
            await pool.query(`
                INSERT INTO dlc_history (id, item_id, storage_id, opened_at, user_name, quantity, is_not_opened) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET 
                storage_id = EXCLUDED.storage_id, 
                opened_at = EXCLUDED.opened_at, 
                user_name = EXCLUDED.user_name, 
                quantity = EXCLUDED.quantity, 
                is_not_opened = EXCLUDED.is_not_opened
            `, [id, itemId, storageId, openedAt, userName, quantity || 1, isNotOpened || false]); 
            break; 
        }
        case 'DELETE_DLC_HISTORY': { await pool.query('DELETE FROM dlc_history WHERE id = $1', [payload.id]); break; }
        case 'DELETE_DAILY_STOCK_ALERT': { await pool.query('DELETE FROM daily_stock_alerts WHERE id = $1', [payload.id]); break; }
        case 'SAVE_LOSS': { await pool.query(`INSERT INTO losses (id, item_id, opened_at, discarded_at, quantity, user_name) VALUES ($1, $2, $3, $4, $5, $6)`, [payload.id, payload.itemId, payload.openedAt, payload.discardedAt, payload.quantity, payload.userName]); break; }
        case 'SAVE_DAILY_STOCK_ALERT': { await pool.query(`INSERT INTO daily_stock_alerts (id, date, type, item_id, quantity, consigne) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`, [payload.id, payload.date, payload.type, payload.itemId, payload.quantity, payload.consigne]); break; }
        case 'SAVE_USER': { await pool.query(`INSERT INTO users (id, name, role, pin, show_in_meal_planning, profile_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, pin = EXCLUDED.pin, show_in_meal_planning = EXCLUDED.show_in_meal_planning, profile_id = EXCLUDED.profile_id`, [payload.id, payload.name, payload.role, payload.pin, payload.showInMealPlanning, payload.profileId]); break; }
        case 'SAVE_ROLE_PROFILE': {
            const { id, name, permissions, welcomeModalTiles, welcomeModalMessage } = payload;
            await pool.query('BEGIN');
            try {
                await pool.query(`
                    INSERT INTO role_profiles (id, name, welcome_modal_tiles, welcome_modal_message) 
                    VALUES ($1, $2, $3, $4) 
                    ON CONFLICT (id) DO UPDATE SET 
                    name = EXCLUDED.name, 
                    welcome_modal_tiles = EXCLUDED.welcome_modal_tiles, 
                    welcome_modal_message = EXCLUDED.welcome_modal_message
                `, [id, name, welcomeModalTiles ? JSON.stringify(welcomeModalTiles) : null, welcomeModalMessage]);
                await pool.query('DELETE FROM permissions WHERE role_profile_id = $1', [id]);
                for (const [res, perms] of Object.entries(permissions)) {
                    const p = perms as any;
                    await pool.query(`INSERT INTO permissions (role_profile_id, resource_name, can_view, can_edit) VALUES ($1, $2, $3, $4)`, [id, res, p.view, p.edit]);
                }
                await pool.query('COMMIT');
            } catch (e) {
                await pool.query('ROLLBACK');
                throw e;
            }
            break;
        }
        case 'DELETE_ROLE_PROFILE': { await pool.query('DELETE FROM role_profiles WHERE id = $1', [payload.id]); break; }
        case 'SAVE_STORAGE': { await pool.query(`INSERT INTO storage_spaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [payload.id, payload.name]); break; }
        case 'SAVE_STORAGE_ORDER': { await pool.query(`UPDATE storage_spaces SET sort_order = $2 WHERE id = $1`, [payload.id, payload.order]); break; }
        case 'DELETE_STORAGE': { await pool.query('DELETE FROM storage_spaces WHERE id = $1', [payload.id]); break; }
        case 'SAVE_FORMAT': { await pool.query(`INSERT INTO formats (id, name, value, sort_order) VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM formats)) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, value = EXCLUDED.value`, [payload.id, payload.name, payload.value]); break; }
        case 'DELETE_FORMAT': { await pool.query('DELETE FROM formats WHERE id = $1', [payload.id]); break; }
        case 'SAVE_CATEGORY': { await pool.query(`INSERT INTO categories (name, sort_order) VALUES ($1, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories)) ON CONFLICT (name) DO NOTHING`, [payload.name]); break; }
        case 'DELETE_CATEGORY': { await pool.query('DELETE FROM categories WHERE name = $1', [payload.name]); break; }
        case 'REORDER_CATEGORIES': { for (let i = 0; i < payload.categories.length; i++) await pool.query('UPDATE categories SET sort_order = $1 WHERE name = $2', [i, payload.categories[i]]); break; }
        case 'REORDER_FORMATS': { for (let i = 0; i < payload.formats.length; i++) await pool.query('UPDATE formats SET sort_order = $1 WHERE id = $2', [i, payload.formats[i]]); break; }
        case 'SAVE_PRIORITY': { await pool.query(`INSERT INTO stock_priorities (item_id, storage_id, priority) VALUES ($1, $2, $3) ON CONFLICT (item_id, storage_id) DO UPDATE SET priority = EXCLUDED.priority`, [payload.itemId, payload.storageId, payload.priority]); break; }
        case 'SAVE_CONSIGNE': { await pool.query(`INSERT INTO stock_consignes (item_id, storage_id, min_quantity, max_capacity) VALUES ($1, $2, $3, $4) ON CONFLICT (item_id, storage_id) DO UPDATE SET min_quantity = EXCLUDED.min_quantity, max_capacity = EXCLUDED.max_capacity`, [payload.itemId, payload.storageId, payload.minQuantity, payload.maxCapacity]); break; }
        case 'SAVE_DLC_PROFILE': { await pool.query(`INSERT INTO dlc_profiles (id, name, duration_hours, type) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, duration_hours = EXCLUDED.duration_hours, type = EXCLUDED.type`, [payload.id, payload.name, payload.durationHours, payload.type || 'OPENING']); break; }
        case 'DELETE_DLC_PROFILE': { await pool.query('DELETE FROM dlc_profiles WHERE id = $1', [payload.id]); break; }
        case 'SAVE_MESSAGE': { await pool.query(`INSERT INTO messages (id, content, user_name, date, is_archived, read_by) VALUES ($1, $2, $3, $4, $5, $6)`, [payload.id, payload.content, payload.userName, payload.date, payload.isArchived, JSON.stringify(payload.readBy || [])]); break; }
        case 'UPDATE_MESSAGE': { if (payload.adminReply !== undefined) await pool.query(`UPDATE messages SET admin_reply = $2, reply_date = $3 WHERE id = $1`, [payload.id, payload.adminReply, payload.replyDate]); if (payload.isArchived !== undefined) await pool.query(`UPDATE messages SET is_archived = $2 WHERE id = $1`, [payload.id, payload.isArchived]); break; }
        case 'MARK_MESSAGE_READ': { const res = await pool.query('SELECT read_by FROM messages WHERE id = $1', [payload.messageId]); if (res.rows.length > 0) { let currentReadBy: string[] = []; try { currentReadBy = JSON.parse(res.rows[0].read_by || '[]'); } catch(e) {} if (!currentReadBy.includes(payload.userId)) { currentReadBy.push(payload.userId); await pool.query('UPDATE messages SET read_by = $2 WHERE id = $1', [payload.messageId, JSON.stringify(currentReadBy)]); } } break; }
        case 'DELETE_MESSAGE': { await pool.query('DELETE FROM messages WHERE id = $1', [payload.id]); break; }
        case 'SAVE_GLASSWARE': { await pool.query(`INSERT INTO glassware (id, name, capacity, image_url, quantity, last_updated) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, capacity = EXCLUDED.capacity, image_url = EXCLUDED.image_url, quantity = EXCLUDED.quantity, last_updated = NOW()`, [payload.id, payload.name, payload.capacity, payload.imageUrl, payload.quantity]); break; }
        case 'DELETE_GLASSWARE': { await pool.query('DELETE FROM glassware WHERE id = $1', [payload.id]); break; }
        case 'SAVE_TECHNIQUE': { await pool.query(`INSERT INTO techniques (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [payload.id, payload.name]); break; }
        case 'DELETE_TECHNIQUE': { await pool.query('DELETE FROM techniques WHERE id = $1', [payload.id]); break; }
        case 'SAVE_COCKTAIL_CATEGORY': { await pool.query(`INSERT INTO cocktail_categories (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [payload.id, payload.name]); break; }
        case 'DELETE_COCKTAIL_CATEGORY': { await pool.query('DELETE FROM cocktail_categories WHERE id = $1', [payload.id]); break; }
        case 'SAVE_RECIPE': { const { id, name, category, glasswareId, technique, technicalDetails, description, history, decoration, sellingPrice, costPrice, status, createdBy, createdAt, ingredients, tvaRate } = payload; await pool.query(`INSERT INTO recipes (id, name, category, glassware_id, technique, technical_details, description, history, decoration, selling_price, cost_price, status, created_by, created_at, ingredients, tva_rate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, glassware_id = EXCLUDED.glassware_id, technique = EXCLUDED.technique, technical_details = EXCLUDED.technical_details, description = EXCLUDED.description, history = EXCLUDED.history, decoration = EXCLUDED.decoration, selling_price = EXCLUDED.selling_price, cost_price = EXCLUDED.cost_price, status = EXCLUDED.status, ingredients = EXCLUDED.ingredients, tva_rate = EXCLUDED.tva_rate`, [id, name, category, glasswareId, technique, technicalDetails, description, history, decoration, sellingPrice, costPrice, status, createdBy, createdAt, JSON.stringify(ingredients), tvaRate]); break; }
        case 'DELETE_RECIPE': { await pool.query('DELETE FROM recipes WHERE id = $1', [payload.id]); break; }
        case 'VALIDATE_RECIPE': { await pool.query('UPDATE recipes SET status = $2 WHERE id = $1', [payload.id, 'VALIDATED']); break; }
        case 'SAVE_EMAIL_TEMPLATE': { await pool.query(`INSERT INTO email_templates (id, name, subject, body) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, subject = EXCLUDED.subject, body = EXCLUDED.body`, [payload.id, payload.name, payload.subject, payload.body]); break; }
        case 'DELETE_EMAIL_TEMPLATE': { await pool.query('DELETE FROM email_templates WHERE id = $1', [payload.id]); break; }
        
        case 'SAVE_MEAL_RESERVATION': { await pool.query(`INSERT INTO meal_reservations (id, user_id, date, slot) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`, [payload.id, payload.userId, payload.date, payload.slot]); break; }
        case 'DELETE_MEAL_RESERVATION': { await pool.query('DELETE FROM meal_reservations WHERE id = $1', [payload.id]); break; }

        case 'SAVE_APP_CONFIG': {
            for (const [key, value] of Object.entries(payload)) {
                const dbKey = key === 'scheduleConfig' ? 'schedule_config' : 
                              key === 'tempItemDuration' ? 'temp_item_duration' :
                              key === 'defaultMargin' ? 'default_margin' : 
                              key === 'programMapping' ? 'program_mapping' :
                              key === 'programThresholds' ? 'program_thresholds' :
                              key === 'mealReminderTimes' ? 'meal_reminder_times' :
                              key === 'tvaRates' ? 'tva_rates' :
                              key === 'welcomeModalTiles' ? 'welcome_modal_tiles' : key;
                const dbValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                await pool.query(`
                    INSERT INTO app_config (key, value) 
                    VALUES ($1, $2) 
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                `, [dbKey, dbValue]);
            }
            break;
        }

        case 'SAVE_STAFF_SHIFT': {
            const { id, userId, date, startTime, endTime, type, isValidated, role } = payload;
            await pool.query(`
                INSERT INTO staff_shifts (id, user_id, date, start_time, end_time, type, is_validated, role)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                user_id = EXCLUDED.user_id, date = EXCLUDED.date, start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time, type = EXCLUDED.type, is_validated = EXCLUDED.is_validated,
                role = EXCLUDED.role
            `, [id, userId, date, startTime, endTime, type, isValidated || false, role]);
            break;
        }
        case 'DELETE_STAFF_SHIFT': { await pool.query('DELETE FROM staff_shifts WHERE id = $1', [payload.id]); break; }
        case 'SAVE_DAILY_AFFLUENCE': {
            const { id, date, time, level } = payload;
            await pool.query(`
                INSERT INTO daily_affluence (id, date, time, level)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE SET
                level = EXCLUDED.level
            `, [id, date, time, level]);
            break;
        }
        case 'SAVE_WORK_SHIFT': {
            const { id, userId, date, startTime, endTime, breakMinutes, isSplitShift } = payload;
            await pool.query(`
                INSERT INTO work_shifts (id, user_id, date, start_time, end_time, break_minutes, is_split_shift)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                user_id = EXCLUDED.user_id, date = EXCLUDED.date, start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time, break_minutes = EXCLUDED.break_minutes, is_split_shift = EXCLUDED.is_split_shift
            `, [id, userId, date, startTime, endTime, breakMinutes, isSplitShift || false]);
            break;
        }
        case 'DELETE_WORK_SHIFT': { await pool.query('DELETE FROM work_shifts WHERE id = $1', [payload.id]); break; }
        case 'SAVE_ACTIVITY_MOMENT': {
            const { id, dayOfWeek, startTime, endTime, level } = payload;
            await pool.query(`
                INSERT INTO activity_moments (id, day_of_week, start_time, end_time, level)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET
                day_of_week = EXCLUDED.day_of_week, start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time, level = EXCLUDED.level
            `, [id, dayOfWeek, startTime, endTime, level]);
            break;
        }
        case 'DELETE_ACTIVITY_MOMENT': { await pool.query('DELETE FROM activity_moments WHERE id = $1', [payload.id]); break; }
        case 'SAVE_ABSENCE_REQUEST': {
            const { id, userId, startDate, endDate, startTime, endTime, reason, status } = payload;
            await pool.query(`
                INSERT INTO absence_requests (id, user_id, start_date, end_date, start_time, end_time, reason, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                user_id = EXCLUDED.user_id, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
                start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, reason = EXCLUDED.reason, status = EXCLUDED.status
            `, [id, userId, startDate, endDate, startTime, endTime, reason, status]);
            break;
        }
        case 'DELETE_ABSENCE_REQUEST': { await pool.query('DELETE FROM absence_requests WHERE id = $1', [payload.id]); break; }

        // --- UPDATES V1.3 ---
        case 'SAVE_NOTE': {
            await pool.query(`INSERT INTO admin_notes (id, content, created_at, user_name) VALUES ($1, $2, NOW(), $3)`, [payload.id, payload.content, payload.userName]);
            break;
        }
        case 'SAVE_PRODUCT_SHEET': {
            const { id, itemId, fullName, type, region, country, tastingNotes, customFields, foodPairing, servingTemp, allergens, description, status, glasswareIds, salesFormat, actualPrice, marginRate, tvaRate } = payload;
            
            // Merge new fields into customFields
            let fieldsObj: any = {};
            try {
                fieldsObj = JSON.parse(customFields || '{}');
            } catch (e) {}
            
            if (glasswareIds) fieldsObj['glasswareIds'] = glasswareIds;
            if (salesFormat !== undefined) fieldsObj['salesFormat'] = salesFormat;
            if (actualPrice !== undefined) fieldsObj['actualPrice'] = actualPrice;
            if (marginRate !== undefined) fieldsObj['marginRate'] = marginRate;
            if (tvaRate !== undefined) fieldsObj['tvaRate'] = tvaRate;
            
            const finalCustomFields = JSON.stringify(fieldsObj);

            await pool.query(`
                INSERT INTO product_sheets (id, item_id, full_name, type, region, country, tasting_notes, custom_fields, food_pairing, serving_temp, allergens, description, status, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
                ON CONFLICT (id) DO UPDATE SET
                item_id = EXCLUDED.item_id, full_name = EXCLUDED.full_name, type = EXCLUDED.type, region = EXCLUDED.region, country = EXCLUDED.country, 
                tasting_notes = EXCLUDED.tasting_notes, custom_fields = EXCLUDED.custom_fields, food_pairing = EXCLUDED.food_pairing, 
                serving_temp = EXCLUDED.serving_temp, allergens = EXCLUDED.allergens, description = EXCLUDED.description, 
                status = EXCLUDED.status, updated_at = NOW()
            `, [id, itemId, fullName, type, region, country, tastingNotes, finalCustomFields, foodPairing, servingTemp, allergens, description, status]);
            break;
        }
        case 'DELETE_PRODUCT_SHEET': {
            await pool.query('DELETE FROM product_sheets WHERE id = $1', [payload.id]);
            break;
        }
        case 'SAVE_PRODUCT_TYPE': {
            await pool.query(`INSERT INTO product_types (id, name, fields) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, fields = EXCLUDED.fields`, [payload.id, payload.name, JSON.stringify(payload.fields)]);
            break;
        }
        case 'DELETE_PRODUCT_TYPE': {
            await pool.query('DELETE FROM product_types WHERE id = $1', [payload.id]);
            break;
        }
        case 'CHECK_DB_STRUCTURE': {
            const tables = ['items', 'storage_spaces', 'formats', 'categories', 'dlc_profiles', 'stock_priorities', 'stock_levels', 'stock_consignes', 'transactions', 'orders', 'unfulfilled_orders', 'dlc_history', 'messages', 'losses', 'daily_stock_alerts', 'user_logs', 'tasks', 'events', 'event_comments', 'daily_cocktails', 'glassware', 'techniques', 'cocktail_categories', 'recipes', 'email_templates', 'product_sheets', 'product_types', 'admin_notes', 'staff_shifts', 'daily_affluence', 'activity_moments', 'absence_requests', 'meal_reservations'];
            
            const results: any = {};
            for (const table of tables) {
                const res = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)", [table]);
                results[table] = res.rows[0].exists;
            }
            
            // Check specific columns for V1.3/V1.4
            const columnChecks = [
                { table: 'product_sheets', column: 'full_name' },
                { table: 'product_sheets', column: 'custom_fields' },
                { table: 'recipes', column: 'tva_rate' },
                { table: 'admin_notes', column: 'user_name' },
                { table: 'dlc_profiles', column: 'type' },
                { table: 'items', column: 'is_no_stock' }
            ];
            
            const colResults: any = {};
            for (const check of columnChecks) {
                const res = await pool.query("SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = $1 AND column_name = $2)", [check.table, check.column]);
                colResults[`${check.table}.${check.column}`] = res.rows[0].exists;
            }

            return new Response(JSON.stringify({ success: true, tables: results, columns: colResults }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        case 'EXECUTE_SQL': {
            const { query, params } = payload;
            try {
                const res = await pool.query(query, params || []);
                return new Response(JSON.stringify({ success: true, rows: res.rows, fields: res.fields, rowCount: res.rowCount }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
            } catch (e: any) {
                return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
            }
        }
        case 'SAVE_DLC_TRANSFER': {
            const { batchId, targetStorageId, newQuantity } = payload;
            await pool.query('UPDATE dlc_history SET storage_id = $1, quantity = $2 WHERE id = $3', [targetStorageId, newQuantity, batchId]);
            break;
        }

        default: return new Response(JSON.stringify({ error: 'Action inconnue' }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });

  } catch (error: any) {
    console.error('Erreur DB:', error);
    if (error.code === '42P01') {
       return new Response(JSON.stringify({ error: 'Structure DB Incomplète', details: "Tables manquantes. Veuillez réexécuter le script SQL complet." }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    return new Response(JSON.stringify({ error: 'Erreur Base de Données', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } finally {
    context.waitUntil(pool.end());
  }
};
