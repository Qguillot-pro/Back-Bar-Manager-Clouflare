
-- ... (Table definitions remain, add this at the end or update existing blocks) ...

-- MISE À JOUR V1.3

-- 1. Fiches Produits : Ajout champs et types
CREATE TABLE IF NOT EXISTS product_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fields TEXT -- JSON string array
);

ALTER TABLE product_sheets ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE product_sheets ADD COLUMN IF NOT EXISTS custom_fields TEXT;

-- 2. Notes Admin : Historique (On change la logique, plus d'ID unique 'admin_log_main')
-- La table admin_notes existe déjà, on ajoute une colonne created_at si absente (déjà fait par updated_at mais on normalise)
ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Données initiales Types
INSERT INTO product_types (id, name, fields) VALUES 
('pt1', 'Vin', '["Cépage", "Millésime", "Degré"]'),
('pt2', 'Spiritueux', '["Âge", "Fût", "Degré"]'),
('pt3', 'Bière', '["Type", "Degré", "IBU"]'),
('pt4', 'Cocktail', '["Base", "Profil"]'),
('pt5', 'Autre', '[]')
ON CONFLICT (id) DO NOTHING;
