
-- ... (Table definitions remain, add this at the end or update existing blocks) ...

-- MISE À JOUR V1.3 & V1.7

-- 1. Configuration Application
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 2. Paramètres de Planning et Météo
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
);

-- Initialisation Paramètres Planning
INSERT INTO schedule_settings (id, location, weather_refresh_minutes, max_amplitude, max_worked_time, max_split_time, max_continuous_work_time, planning_weeks, planning_scale, setup_time_minutes, closing_time_minutes, default_break_minutes, split_shift_allowed, contract_type, rest_day_pattern)
VALUES ('default', 'Paris', 30, 780, 600, 240, 360, 1, 60, 30, 30, 30, false, '35H', 'CONTINUOUS')
ON CONFLICT (id) DO NOTHING;

-- 3. Fiches Produits : Ajout champs et types
CREATE TABLE IF NOT EXISTS product_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fields TEXT -- JSON string array
);

ALTER TABLE product_sheets ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE product_sheets ADD COLUMN IF NOT EXISTS custom_fields TEXT;

-- 4. Notes Admin : Historique
ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS user_name TEXT;

-- 5. Planning et RH
CREATE TABLE IF NOT EXISTS staff_shifts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    type TEXT NOT NULL,
    is_validated BOOLEAN DEFAULT FALSE,
    role TEXT
);

CREATE TABLE IF NOT EXISTS daily_affluence (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    level TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_moments (
    id TEXT PRIMARY KEY,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    level TEXT NOT NULL
);

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
);

CREATE TABLE IF NOT EXISTS meal_reservations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    slot TEXT NOT NULL DEFAULT 'LUNCH',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Données initiales Types
INSERT INTO product_types (id, name, fields) VALUES 
('pt1', 'Vin', '["Cépage", "Millésime", "Degré"]'),
('pt2', 'Spiritueux', '["Âge", "Fût", "Degré"]'),
('pt3', 'Bière', '["Type", "Degré", "IBU"]'),
('pt4', 'Cocktail', '["Base", "Profil"]'),
('pt5', 'Autre', '[]')
ON CONFLICT (id) DO NOTHING;
