-- Add icon field to categories table
ALTER TABLE categories ADD COLUMN icon VARCHAR(50) DEFAULT 'folder';
