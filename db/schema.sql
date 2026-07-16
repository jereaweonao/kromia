CREATE TABLE users ( 
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPZ DEFAULT NOW()
);

CREATE TABLE colors (
  id SERIAL PRIMARY KEY,
  hex_code INTEGER UNIQUE NOT NULL,
);

CREATE TABLE palettes ( 
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL,
  created_at TIMESTAMPZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id),
);

CREATE TABLE palettes_colors (
  FOREIGN KEY (palette_id) REFERENCES palletes(id),
  FOREIGN KEY (colors_id) REFERENCES colors(id)
);
