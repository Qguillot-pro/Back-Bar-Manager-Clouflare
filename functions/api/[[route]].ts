
import { Client } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
}

interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
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
    return new Response(JSON.stringify({ error: "ERREUR FATALE : Variable DATABASE_URL introuvable dans les réglages Cloudflare." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Utilisation de Client au lieu de Pool pour une connexion directe et unique (plus stable pour les init lourds)
  const client = new Client({ 
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 10000 // 10 secondes max pour se connecter
  });

  try {
    const url = new URL(request.url);
    const path = url.pathname; 

    await client.connect();

    // --- GET ROUTE: INITIALISATION (/api/init) ---
    if (request.method === 'GET' && path.includes('/init')) {
      
      // CHARGEMENT SEQUENTIEL STRICT (Pour éviter le timeout CPU Cloudflare)
      
      // 1. Configuration & Utilisateurs
      const appConfig = await client.query('SELECT * FROM app_config');
      const users = await client.query('SELECT * FROM users');
      const formats = await client.query('SELECT * FROM formats');
      
      // 2. Structure Stock
      const categories = await client.query('SELECT * FROM categories ORDER BY sort_order ASC');
      const storages = await client.query('SELECT * FROM storage_spaces ORDER BY sort_order ASC, name ASC');
      const dlcProfiles = await client.query('SELECT * FROM dlc_profiles');
      
      // 3. Données Items & Niveaux (Lourd)
      const items = await client.query('SELECT * FROM items ORDER BY sort_order ASC');
      const stockLevels = await client.query('SELECT * FROM stock_levels');
      const consignes = await client.query('SELECT * FROM stock_consignes');
      const priorities = await client.query('SELECT * FROM stock_priorities');

      // 4. Historique (LIMITÉ STRICTEMENT pour la performance initiale)
      // On réduit à 50 pour garantir le chargement.
      const transactions = await client.query('SELECT * FROM transactions ORDER BY date DESC LIMIT 50'); 
      const orders = await client.query('SELECT * FROM orders ORDER BY date DESC LIMIT 50');
      const dlcHistory = await client.query('SELECT * FROM dlc_history ORDER BY opened_at DESC LIMIT 50');
      
      // 5. Modules Annexes
      const unfulfilledOrders = await client.query('SELECT * FROM unfulfilled_orders ORDER BY date DESC LIMIT 50');
      const messages = await client.query('SELECT * FROM messages ORDER BY date DESC LIMIT 20');
      
      // 6. Recettes & Events
      const glassware = await client.query('SELECT * FROM glassware ORDER BY name ASC');
      const recipes = await client.query('SELECT * FROM recipes ORDER BY name ASC');
      const techniques = await client.query('SELECT * FROM techniques ORDER BY name ASC');
      const cocktailCats = await client.query('SELECT * FROM cocktail_categories');
      const dailyCocktails = await client.query('SELECT * FROM daily_cocktails WHERE date >= NOW() - INTERVAL \'3 days\'');
      
      const losses = await client.query('SELECT * FROM losses ORDER BY discarded_at DESC LIMIT 20');
      const logs = await client.query('SELECT * FROM user_logs ORDER BY timestamp DESC LIMIT 20');
      const tasks = await client.query('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 20');
      const events = await client.query('SELECT * FROM events ORDER BY start_time ASC LIMIT 20');
      const comments = await client.query('SELECT * FROM event_comments ORDER BY created_at ASC LIMIT 50');

      const configMap: any = { tempItemDuration: '14_DAYS', defaultMargin: 82 };
      appConfig.rows.forEach((row: any) => {
          if (row.key === 'temp_item_duration') configMap.tempItemDuration = row.value;
          if (row.key === 'default_margin') configMap.defaultMargin = parseInt(row.value);
      });

      const responseBody = {
          items: items.rows.map((row: any) => ({
            id: row.id,
            articleCode: row.article_code,
            name: row.name,
            category: row.category,
            formatId: row.format_id,
            pricePerUnit: parseFloat(row.price_per_unit || '0'),
            lastUpdated: row.last_updated,
            createdAt: row.created_at,
            isDLC: row.is_dlc,
            dlcProfileId: row.dlc_profile_id,
            isConsigne: row.is_consigne,
            order: row.sort_order,
            isDraft: row.is_draft,
            isTemporary: row.is_temporary,
            isInventoryOnly: row.is_inventory_only
          })),
          users: users.rows,
          storages: storages.rows.map((s: any) => ({ id: s.id, name: s.name, order: s.sort_order })),
          stockLevels: stockLevels.rows.map((row: any) => ({ itemId: row.item_id, storageId: row.storage_id, currentQuantity: parseFloat(row.quantity || '0') })),
          consignes: consignes.rows.map((row: any) => ({ 
              itemId: row.item_id, 
              storageId: row.storage_id, 
              minQuantity: parseFloat(row.min_quantity || '0'),
              maxCapacity: row.max_capacity ? parseFloat(row.max_capacity) : undefined 
          })),
          transactions: transactions.rows.map((t: any) => ({
              ...t, 
              itemId: t.item_id, 
              storageId: t.storage_id, 
              quantity: parseFloat(t.quantity || '0'),
              isCaveTransfer: t.is_cave_transfer, 
              userName: t.user_name
          })),
          orders: orders.rows.map((row: any) => ({ 
              id: row.id, 
              itemId: row.item_id, 
              quantity: parseFloat(row.quantity || '0'),
              initialQuantity: row.initial_quantity ? parseFloat(row.initial_quantity) : null,
              date: row.date, 
              status: row.status, 
              userName: row.user_name,
              ruptureDate: row.rupture_date,
              orderedAt: row.ordered_at,
              receivedAt: row.received_at
          })),
          dlcHistory: dlcHistory.rows.map((d: any) => ({...d, itemId: d.item_id, storageId: d.storage_id, openedAt: d.opened_at, userName: d.user_name})),
          formats: formats.rows.map((f: any) => ({ id: f.id, name: f.name, value: parseFloat(f.value || '0') })),
          categories: categories.rows.map((c: any) => c.name),
          priorities: priorities.rows.map((p: any) => ({ itemId: p.item_id, storageId: p.storage_id, priority: p.priority })),
          dlcProfiles: dlcProfiles.rows.map((p: any) => ({ id: p.id, name: p.name, durationHours: p.duration_hours, type: p.type || 'OPENING' })),
          unfulfilledOrders: unfulfilledOrders.rows.map((u: any) => ({ 
              id: u.id, 
              itemId: u.item_id, 
              date: u.date, 
              userName: u.user_name,
              quantity: parseFloat(u.quantity || '1') 
          })),
          appConfig: configMap,
          messages: messages.rows.map((m: any) => {
             let readBy: string[] = [];
             try { if (m.read_by) readBy = JSON.parse(m.read_by); } catch(e) {}
             return { id: m.id, content: m.content, userName: m.user_name, date: m.date, isArchived: m.is_archived, adminReply: m.admin_reply, replyDate: m.reply_date, readBy };
          }),
          glassware: glassware.rows.map((g: any) => ({
              id: g.id, name: g.name, capacity: parseFloat(g.capacity || '0'), imageUrl: g.image_url, quantity: g.quantity || 0, lastUpdated: g.last_updated
          })),
          recipes: recipes.rows.map((r: any) => ({
              id: r.id, name: r.name, category: r.category, glasswareId: r.glassware_id, technique: r.technique, description: r.description, history: r.history, decoration: r.decoration, sellingPrice: parseFloat(r.selling_price || '0'), costPrice: parseFloat(r.cost_price || '0'), status: r.status, createdBy: r.created_by, createdAt: r.created_at, ingredients: r.ingredients
          })),
          techniques: techniques.rows.map((t: any) => ({ id: t.id, name: t.name })),
          cocktailCategories: cocktailCats.rows.map((c: any) => ({ id: c.id, name: c.name })),
          dailyCocktails: dailyCocktails.rows.map((d: any) => ({ id: d.id, date: d.date, type: d.type, recipeId: d.recipe_id, customName: d.custom_name, customDescription: d.custom_description })),
          losses: losses.rows.map((l: any) => ({ id: l.id, itemId: l.item_id, openedAt: l.opened_at, discardedAt: l.discarded_at, quantity: parseFloat(l.quantity || '0'), userName: l.user_name })),
          userLogs: logs.rows.map((l: any) => ({ id: l.id, userName: l.user_name, action: l.action, details: l.details, timestamp: l.timestamp })),
          tasks: tasks.rows.map((t: any) => ({ id: t.id, content: t.content, createdBy: t.created_by, createdAt: t.created_at, isDone: t.is_done, doneBy: t.done_by, doneAt: t.done_at })),
          events: events.rows.map((e: any) => ({ id: e.id, title: e.title, startTime: e.start_time, endTime: e.end_time, location: e.location, guestsCount: e.guests_count, description: e.description, productsJson: e.products_json, createdAt: e.created_at })),
          eventComments: comments.rows.map((c: any) => ({ id: c.id, eventId: c.event_id, userName: c.user_name, content: c.content, createdAt: c.created_at }))
      };

      // Cleanup asynchrone (ne bloque pas la réponse)
      context.waitUntil((async () => {
          // Petit nettoyage si nécessaire, mais on ne bloque pas
      })());

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // --- POST ROUTE: ACTIONS (/api/action) ---
    if (request.method === 'POST') {
      const bodyText = await request.text();
      const { action, payload } = JSON.parse(bodyText || '{}');

      if (!action) return new Response(JSON.stringify({ error: 'Action manquante' }), { status: 400, headers: corsHeaders });

      // Reuse client for actions
      switch (action) {
        case 'SAVE_LOG': {
            await client.query(`INSERT INTO user_logs (id, user_name, action, details, timestamp) VALUES ($1, $2, $3, $4, NOW())`, [payload.id, payload.userName, payload.action, payload.details]);
            break;
        }
        case 'SAVE_TASK': {
            const { id, content, createdBy, isDone, doneBy, doneAt } = payload;
            await client.query(`
                INSERT INTO tasks (id, content, created_by, is_done, done_by, done_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (id) DO UPDATE SET is_done = EXCLUDED.is_done, done_by = EXCLUDED.done_by, done_at = EXCLUDED.done_at
            `, [id, content, createdBy, isDone, doneBy, doneAt]);
            break;
        }
        case 'DELETE_TASK': {
            await client.query('DELETE FROM tasks WHERE id = $1', [payload.id]);
            break;
        }
        case 'SAVE_EVENT': {
            const { id, title, startTime, endTime, location, guestsCount, description, productsJson } = payload;
            await client.query(`
                INSERT INTO events (id, title, start_time, end_time, location, guests_count, description, products_json, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, location = EXCLUDED.location, guests_count = EXCLUDED.guests_count, description = EXCLUDED.description, products_json = EXCLUDED.products_json
            `, [id, title, startTime, endTime, location, guestsCount, description, productsJson]);
            break;
        }
        case 'DELETE_EVENT': {
            await client.query('DELETE FROM events WHERE id = $1', [payload.id]);
            break;
        }
        case 'SAVE_EVENT_COMMENT': {
            await client.query(`INSERT INTO event_comments (id, event_id, user_name, content, created_at) VALUES ($1, $2, $3, $4, NOW())`, [payload.id, payload.eventId, payload.userName, payload.content]);
            break;
        }
        case 'SAVE_DAILY_COCKTAIL': {
            const { id, date, type, recipeId, customName, customDescription } = payload;
            await client.query(`
                INSERT INTO daily_cocktails (id, date, type, recipe_id, custom_name, custom_description)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET recipe_id = EXCLUDED.recipe_id, custom_name = EXCLUDED.custom_name, custom_description = EXCLUDED.custom_description
            `, [id, date, type, recipeId, customName, customDescription]);
            break;
        }
        case 'SAVE_CONFIG': {
            await client.query(`INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [payload.key, String(payload.value)]);
            break;
        }
        case 'SAVE_ITEM': {
          const { id, name, articleCode, category, formatId, pricePerUnit, isDLC, dlcProfileId, isConsigne, order, isDraft, isTemporary, createdAt, isInventoryOnly } = payload;
          await client.query(`
            INSERT INTO items (id, article_code, name, category, format_id, price_per_unit, is_dlc, dlc_profile_id, is_consigne, sort_order, is_draft, is_temporary, is_inventory_only, created_at, last_updated)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14, NOW()), NOW())
            ON CONFLICT (id) DO UPDATE SET
              article_code = EXCLUDED.article_code, name = EXCLUDED.name, category = EXCLUDED.category, format_id = EXCLUDED.format_id,
              price_per_unit = EXCLUDED.price_per_unit, is_dlc = EXCLUDED.is_dlc, dlc_profile_id = EXCLUDED.dlc_profile_id, is_consigne = EXCLUDED.is_consigne, sort_order = EXCLUDED.sort_order, 
              is_draft = EXCLUDED.is_draft, is_temporary = EXCLUDED.is_temporary, is_inventory_only = EXCLUDED.is_inventory_only, last_updated = NOW()
          `, [id, articleCode, name, category, formatId, pricePerUnit, isDLC, dlcProfileId, isConsigne, order, isDraft, isTemporary, isInventoryOnly, createdAt]);
          break;
        }
        case 'DELETE_ITEM': { await client.query('DELETE FROM items WHERE id = $1', [payload.id]); break; }
        case 'SAVE_STOCK': {
          await client.query(`INSERT INTO stock_levels (item_id, storage_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (item_id, storage_id) DO UPDATE SET quantity = EXCLUDED.quantity`, [payload.itemId, payload.storageId, payload.currentQuantity]);
          break;
        }
        case 'SAVE_TRANSACTION': {
          await client.query(`INSERT INTO transactions (id, item_id, storage_id, type, quantity, date, note, is_cave_transfer, user_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [payload.id, payload.itemId, payload.storageId, payload.type, payload.quantity, payload.date, payload.note, payload.isCaveTransfer, payload.userName]);
          break;
        }
        case 'DELETE_TRANSACTION': {
            await client.query('DELETE FROM transactions WHERE id = $1', [payload.id]);
            break;
        }
        case 'SAVE_ORDER': {
          const { id, itemId, quantity, initialQuantity, date, status, userName, ruptureDate, orderedAt, receivedAt } = payload;
          await client.query(`
            INSERT INTO orders (id, item_id, quantity, initial_quantity, date, status, user_name, rupture_date, ordered_at, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, quantity = EXCLUDED.quantity, initial_quantity = EXCLUDED.initial_quantity, rupture_date = EXCLUDED.rupture_date, ordered_at = EXCLUDED.ordered_at, received_at = EXCLUDED.received_at
          `, [id, itemId, quantity, initialQuantity, date, status, userName, ruptureDate, orderedAt, receivedAt]);
          break;
        }
        case 'SAVE_UNFULFILLED_ORDER': {
            await client.query(`INSERT INTO unfulfilled_orders (id, item_id, date, user_name, quantity) VALUES ($1, $2, $3, $4, $5)`, [payload.id, payload.itemId, payload.date, payload.userName, payload.quantity || 1]);
            break;
        }
        case 'SAVE_DLC_HISTORY': {
            await client.query(`INSERT INTO dlc_history (id, item_id, storage_id, opened_at, user_name) VALUES ($1, $2, $3, $4, $5)`, [payload.id, payload.itemId, payload.storageId, payload.openedAt, payload.userName]);
            break;
        }
        case 'DELETE_DLC_HISTORY': { await client.query('DELETE FROM dlc_history WHERE id = $1', [payload.id]); break; }
        case 'SAVE_LOSS': {
            await client.query(`INSERT INTO losses (id, item_id, opened_at, discarded_at, quantity, user_name) VALUES ($1, $2, $3, $4, $5, $6)`, [payload.id, payload.itemId, payload.openedAt, payload.discardedAt, payload.quantity, payload.userName]);
            break;
        }
        case 'SAVE_USER': {
            await client.query(`INSERT INTO users (id, name, role, pin) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, pin = EXCLUDED.pin`, [payload.id, payload.name, payload.role, payload.pin]);
            break;
        }
        case 'SAVE_STORAGE': {
            await client.query(`INSERT INTO storage_spaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [payload.id, payload.name]);
            break;
        }
        case 'SAVE_STORAGE_ORDER': { await client.query(`UPDATE storage_spaces SET sort_order = $2 WHERE id = $1`, [payload.id, payload.order]); break; }
        case 'DELETE_STORAGE': { await client.query('DELETE FROM storage_spaces WHERE id = $1', [payload.id]); break; }
        case 'SAVE_FORMAT': {
            await client.query(`INSERT INTO formats (id, name, value) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, value = EXCLUDED.value`, [payload.id, payload.name, payload.value]);
            break;
        }
        case 'DELETE_FORMAT': { await client.query('DELETE FROM formats WHERE id = $1', [payload.id]); break; }
        case 'SAVE_CATEGORY': {
            await client.query(`INSERT INTO categories (name, sort_order) VALUES ($1, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories)) ON CONFLICT (name) DO NOTHING`, [payload.name]);
            break;
        }
        case 'DELETE_CATEGORY': { await client.query('DELETE FROM categories WHERE name = $1', [payload.name]); break; }
        case 'REORDER_CATEGORIES': {
            for (let i = 0; i < payload.categories.length; i++) await client.query('UPDATE categories SET sort_order = $1 WHERE name = $2', [i, payload.categories[i]]);
            break;
        }
        case 'SAVE_PRIORITY': {
            await client.query(`INSERT INTO stock_priorities (item_id, storage_id, priority) VALUES ($1, $2, $3) ON CONFLICT (item_id, storage_id) DO UPDATE SET priority = EXCLUDED.priority`, [payload.itemId, payload.storageId, payload.priority]);
            break;
        }
        case 'SAVE_CONSIGNE': {
            await client.query(`INSERT INTO stock_consignes (item_id, storage_id, min_quantity, max_capacity) VALUES ($1, $2, $3, $4) ON CONFLICT (item_id, storage_id) DO UPDATE SET min_quantity = EXCLUDED.min_quantity, max_capacity = EXCLUDED.max_capacity`, [payload.itemId, payload.storageId, payload.minQuantity, payload.maxCapacity]);
            break;
        }
        case 'SAVE_DLC_PROFILE': {
            await client.query(`INSERT INTO dlc_profiles (id, name, duration_hours, type) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, duration_hours = EXCLUDED.duration_hours, type = EXCLUDED.type`, [payload.id, payload.name, payload.durationHours, payload.type || 'OPENING']);
            break;
        }
        case 'DELETE_DLC_PROFILE': { await client.query('DELETE FROM dlc_profiles WHERE id = $1', [payload.id]); break; }
        case 'SAVE_MESSAGE': {
            await client.query(`INSERT INTO messages (id, content, user_name, date, is_archived, read_by) VALUES ($1, $2, $3, $4, $5, $6)`, [payload.id, payload.content, payload.userName, payload.date, payload.isArchived, JSON.stringify(payload.readBy || [])]);
            break;
        }
        case 'UPDATE_MESSAGE': {
            if (payload.adminReply !== undefined) await client.query(`UPDATE messages SET admin_reply = $2, reply_date = $3 WHERE id = $1`, [payload.id, payload.adminReply, payload.replyDate]);
            if (payload.isArchived !== undefined) await client.query(`UPDATE messages SET is_archived = $2 WHERE id = $1`, [payload.id, payload.isArchived]);
            break;
        }
        case 'MARK_MESSAGE_READ': {
            const res = await client.query('SELECT read_by FROM messages WHERE id = $1', [payload.messageId]);
            if (res.rows.length > 0) {
                let currentReadBy: string[] = [];
                try { currentReadBy = JSON.parse(res.rows[0].read_by || '[]'); } catch(e) {}
                if (!currentReadBy.includes(payload.userId)) {
                    currentReadBy.push(payload.userId);
                    await client.query('UPDATE messages SET read_by = $2 WHERE id = $1', [payload.messageId, JSON.stringify(currentReadBy)]);
                }
            }
            break;
        }
        case 'DELETE_MESSAGE': { await client.query('DELETE FROM messages WHERE id = $1', [payload.id]); break; }
        case 'SAVE_GLASSWARE': {
            await client.query(`INSERT INTO glassware (id, name, capacity, image_url, quantity, last_updated) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, capacity = EXCLUDED.capacity, image_url = EXCLUDED.image_url, quantity = EXCLUDED.quantity, last_updated = NOW()`, [payload.id, payload.name, payload.capacity, payload.imageUrl, payload.quantity]);
            break;
        }
        case 'DELETE_GLASSWARE': { await client.query('DELETE FROM glassware WHERE id = $1', [payload.id]); break; }
        case 'SAVE_TECHNIQUE': {
            await client.query(`INSERT INTO techniques (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [payload.id, payload.name]);
            break;
        }
        case 'DELETE_TECHNIQUE': { await client.query('DELETE FROM techniques WHERE id = $1', [payload.id]); break; }
        case 'SAVE_COCKTAIL_CATEGORY': {
            await client.query(`INSERT INTO cocktail_categories (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [payload.id, payload.name]);
            break;
        }
        case 'DELETE_COCKTAIL_CATEGORY': { await client.query('DELETE FROM cocktail_categories WHERE id = $1', [payload.id]); break; }
        case 'SAVE_RECIPE': {
            await client.query(`INSERT INTO recipes (id, name, category, glassware_id, technique, description, history, decoration, selling_price, cost_price, status, created_by, created_at, ingredients) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, glassware_id = EXCLUDED.glassware_id, technique = EXCLUDED.technique, description = EXCLUDED.description, history = EXCLUDED.history, decoration = EXCLUDED.decoration, selling_price = EXCLUDED.selling_price, cost_price = EXCLUDED.cost_price, status = EXCLUDED.status, ingredients = EXCLUDED.ingredients`, [payload.id, payload.name, payload.category, payload.glasswareId, payload.technique, payload.description, payload.history, payload.decoration, payload.sellingPrice, payload.costPrice, payload.status, payload.createdBy, payload.createdAt, JSON.stringify(payload.ingredients)]);
            break;
        }
        case 'DELETE_RECIPE': { await client.query('DELETE FROM recipes WHERE id = $1', [payload.id]); break; }
        case 'VALIDATE_RECIPE': { await client.query('UPDATE recipes SET status = $2 WHERE id = $1', [payload.id, 'VALIDATED']); break; }
        default: return new Response(JSON.stringify({ error: 'Action inconnue' }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });

  } catch (error: any) {
    console.error('Erreur DB:', error);
    return new Response(JSON.stringify({ error: 'Erreur Base de Données', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } finally {
    // IMPORTANT : On attend la fermeture propre pour éviter les connexions fantômes
    await client.end();
  }
};
