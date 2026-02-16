
-- A EXÉCUTER DANS L'ÉDITEUR SQL DE NEON
-- Ce script initialise la structure de la base de données.

-- 1. Tables de Configuration
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin TEXT NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Config par défaut si inexistante
INSERT INTO app_config (key, value) VALUES ('temp_item_duration', '14_DAYS') ON CONFLICT DO NOTHING;
INSERT INTO app_config (key, value) VALUES ('default_margin', '82') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS storage_spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE storage_spaces ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS formats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value NUMERIC DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE formats ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE formats ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS dlc_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duration_hours INTEGER NOT NULL,
    type TEXT DEFAULT 'OPENING' -- 'OPENING' ou 'PRODUCTION'
);

ALTER TABLE dlc_profiles ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'OPENING';

-- 2. Table Principale Articles
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    article_code TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    format_id TEXT NOT NULL,
    price_per_unit NUMERIC DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    is_dlc BOOLEAN DEFAULT FALSE,
    dlc_profile_id TEXT,
    is_consigne BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    is_draft BOOLEAN DEFAULT FALSE,
    is_temporary BOOLEAN DEFAULT FALSE,
    is_inventory_only BOOLEAN DEFAULT FALSE
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_dlc BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS dlc_profile_id TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS article_code TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_consigne BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_inventory_only BOOLEAN DEFAULT FALSE;

-- 3. Tables Liées (Relations)
CREATE TABLE IF NOT EXISTS stock_levels (
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE CASCADE,
    quantity NUMERIC DEFAULT 0,
    PRIMARY KEY (item_id, storage_id)
);

CREATE TABLE IF NOT EXISTS stock_consignes (
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE CASCADE,
    min_quantity NUMERIC DEFAULT 0,
    max_capacity NUMERIC, 
    PRIMARY KEY (item_id, storage_id)
);

ALTER TABLE stock_consignes ADD COLUMN IF NOT EXISTS max_capacity NUMERIC;

CREATE TABLE IF NOT EXISTS stock_priorities (
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    PRIMARY KEY (item_id, storage_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'IN' ou 'OUT'
    quantity NUMERIC NOT NULL,
    date TIMESTAMP DEFAULT NOW(),
    note TEXT,
    is_cave_transfer BOOLEAN DEFAULT FALSE,
    is_service_transfer BOOLEAN DEFAULT FALSE,
    user_name TEXT
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_service_transfer BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    initial_quantity NUMERIC,
    date TIMESTAMP DEFAULT NOW(),
    status TEXT NOT NULL,
    user_name TEXT,
    rupture_date TIMESTAMP,
    ordered_at TIMESTAMP,
    received_at TIMESTAMP
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS rupture_date TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS initial_quantity NUMERIC;

CREATE TABLE IF NOT EXISTS dlc_history (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    storage_id TEXT REFERENCES storage_spaces(id) ON DELETE CASCADE,
    opened_at TIMESTAMP DEFAULT NOW(),
    user_name TEXT
);

CREATE TABLE IF NOT EXISTS losses (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    opened_at TIMESTAMP,
    discarded_at TIMESTAMP DEFAULT NOW(),
    quantity NUMERIC DEFAULT 0,
    user_name TEXT
);

CREATE TABLE IF NOT EXISTS unfulfilled_orders (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    date TIMESTAMP DEFAULT NOW(),
    user_name TEXT,
    quantity NUMERIC DEFAULT 1
);

ALTER TABLE unfulfilled_orders ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1;

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    user_name TEXT,
    date TIMESTAMP DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    admin_reply TEXT,
    reply_date TIMESTAMP,
    read_by TEXT -- JSON string array of user IDs
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by TEXT;

-- 4. MODULE RECETTES
CREATE TABLE IF NOT EXISTS glassware (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity NUMERIC,
    image_url TEXT,
    quantity INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

ALTER TABLE glassware ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE glassware ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS techniques (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cocktail_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    glassware_id TEXT,
    technique TEXT,
    technical_details TEXT, -- Ajout
    description TEXT,
    history TEXT,
    decoration TEXT,
    selling_price NUMERIC,
    cost_price NUMERIC,
    status TEXT DEFAULT 'DRAFT', -- 'DRAFT' ou 'VALIDATED'
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    ingredients JSONB -- Stocke la liste des ingrédients en JSON
);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS technical_details TEXT;

-- 5. MODULE VIE QUOTIDIENNE & LOGS

CREATE TABLE IF NOT EXISTS user_logs (
    id TEXT PRIMARY KEY,
    user_name TEXT,
    action TEXT,
    details TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    is_done BOOLEAN DEFAULT FALSE,
    done_by TEXT,
    done_at TIMESTAMP,
    recurrence TEXT -- JSON array of day indexes
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT;

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location TEXT,
    guests_count INTEGER,
    description TEXT,
    products_json TEXT, -- JSON string array of item IDs to plan
    glassware_json TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS glassware_json TEXT;

CREATE TABLE IF NOT EXISTS event_comments (
    id TEXT PRIMARY KEY,
    event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
    user_name TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_cocktails (
    id TEXT PRIMARY KEY, -- ex: "2024-05-20-OF_THE_DAY"
    date TEXT NOT NULL, -- YYYY-MM-DD
    type TEXT NOT NULL, -- OF_THE_DAY, MOCKTAIL, WELCOME, THALASSO
    recipe_id TEXT,
    custom_name TEXT,
    custom_description TEXT
);

-- 6. Données Initiales
INSERT INTO storage_spaces (id, name, sort_order) VALUES 
('s1', 'Frigo Soft', 1), ('s2', 'Frigo Vin', 2), ('s3', 'Speed Rack', 3),
('s4', 'Etg Sirops', 4), ('s5', 'Etg Liqueurs', 5), ('s6', 'Pyramide', 6),
('s7', 'Etg Thé', 7), ('s8', 'Etg Vin Rouge', 8), ('s9', 'Frigo Back', 9),
('s10', 'Autres', 10), ('s0', 'Surstock', 99),
('s_global', 'Autre / Restaurant', 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, role, pin) VALUES 
('admin', 'Administrateur', 'ADMIN', '2159'),
('admin_secours', 'Admin Secours', 'ADMIN', '0407'),
('b1', 'Barman', 'BARMAN', '0000')
ON CONFLICT (id) DO UPDATE SET pin = EXCLUDED.pin, role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO formats (id, name, value, sort_order) VALUES 
('f1', '70cl', 70, 1), ('f2', '75cl', 75, 2), ('f3', '33cl', 33, 3), ('f4', '25cl', 25, 4), ('f5', '1L', 100, 5)
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO categories (name, sort_order) VALUES 
('Spiritueux', 0), ('Vins', 1), ('Bières', 2), ('Softs', 3), ('Ingrédients Cocktail', 4), ('Autre', 5)
ON CONFLICT (name) DO NOTHING;

INSERT INTO dlc_profiles (id, name, duration_hours, type) VALUES 
('d1', '24 Heures', 24, 'OPENING'), ('d2', '2 Jours', 48, 'OPENING'), ('d3', '3 Jours', 72, 'OPENING'),
('d4', '5 Jours', 120, 'OPENING'), ('d5', '1 Semaine', 168, 'OPENING'), ('d6', '2 Semaines', 336, 'OPENING'),
('d7', '1 Mois', 720, 'OPENING')
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type;

INSERT INTO techniques (id, name) VALUES
('t1', 'Shaker'), ('t2', 'Verre à mélange'), ('t3', 'Construit'), ('t4', 'Blender'), ('t5', 'Throwing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cocktail_categories (id, name) VALUES
('cc1', 'Signature'), ('cc2', 'Classique'), ('cc3', 'Mocktail'), ('cc4', 'Tiki'), ('cc5', 'After Dinner')
ON CONFLICT (id) DO NOTHING;
