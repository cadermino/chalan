-- PostgreSQL Schema for Chalan
-- Migrated from MySQL

-- -----------------------------------------------------
-- Table carrier_company
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS carrier_company (
  id SERIAL PRIMARY KEY,
  country_id INTEGER,
  name VARCHAR(45),
  description VARCHAR(2000),
  rfc VARCHAR(13) NOT NULL DEFAULT '',
  email VARCHAR(100) NOT NULL DEFAULT '',
  phone VARCHAR(45),
  address VARCHAR(200) NOT NULL DEFAULT '',
  cover_image VARCHAR(200),
  facebook VARCHAR(200),
  youtube VARCHAR(200),
  active SMALLINT
);

-- -----------------------------------------------------
-- Table customers
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(45),
  paternal_last_name VARCHAR(45),
  maternal_last_name VARCHAR(45),
  email VARCHAR(45) UNIQUE,
  password VARCHAR(255),
  mobile_phone VARCHAR(15),
  phone VARCHAR(15),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Table lu_country
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS lu_country (
  id SERIAL PRIMARY KEY,
  country VARCHAR(40) NOT NULL
);

-- -----------------------------------------------------
-- Table lu_order_status
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS lu_order_status (
  id SERIAL PRIMARY KEY,
  status VARCHAR(45)
);

-- -----------------------------------------------------
-- Table lu_payment_type
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS lu_payment_type (
  id SERIAL PRIMARY KEY,
  type VARCHAR(45)
);

-- -----------------------------------------------------
-- Table lu_quotation_status
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS lu_quotation_status (
  id SERIAL PRIMARY KEY,
  status VARCHAR(45)
);

-- -----------------------------------------------------
-- Table lu_services
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS lu_services (
  id SERIAL PRIMARY KEY,
  service VARCHAR(50),
  description VARCHAR(200)
);

-- -----------------------------------------------------
-- Table orders
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  country_id INTEGER REFERENCES lu_country(id),
  total_kilometers INTEGER,
  order_status_id INTEGER NOT NULL DEFAULT 1 REFERENCES lu_order_status(id),
  appointment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  comments TEXT,
  total_amount FLOAT,
  approximate_budget FLOAT,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Table order_details
-- -----------------------------------------------------
CREATE TYPE order_detail_type AS ENUM ('carry_from', 'deliver_to');

CREATE TABLE IF NOT EXISTS order_details (
  id SERIAL PRIMARY KEY,
  type order_detail_type NOT NULL,
  floor_number INTEGER,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  street VARCHAR(200),
  interior_number VARCHAR(45),
  country VARCHAR(20),
  map_url VARCHAR(400),
  neighborhood VARCHAR(45),
  city VARCHAR(45),
  state VARCHAR(45),
  zip_code VARCHAR(45),
  has_elevator SMALLINT DEFAULT 0,
  approximate_distance_from_parking INTEGER
);

-- -----------------------------------------------------
-- Table orders_services
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS orders_services (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  service_id INTEGER NOT NULL REFERENCES lu_services(id)
);

-- -----------------------------------------------------
-- Table payments
-- -----------------------------------------------------
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'cancelled');

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  amount FLOAT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  lu_payment_type_id INTEGER NOT NULL REFERENCES lu_payment_type(id),
  status payment_status NOT NULL DEFAULT 'pending',
  reference VARCHAR(100),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  comments TEXT,
  active SMALLINT NOT NULL
);

-- -----------------------------------------------------
-- Table vehicles
-- -----------------------------------------------------
CREATE TYPE vehicle_size AS ENUM ('small', 'medium', 'large');

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  charge_per_kilometer INTEGER NOT NULL,
  charge_per_floor INTEGER NOT NULL,
  driver_fee INTEGER NOT NULL,
  loader_fee INTEGER NOT NULL,
  loaders_quantity INTEGER NOT NULL,
  size vehicle_size,
  weight VARCHAR(45),
  width VARCHAR(45),
  height VARCHAR(45),
  length VARCHAR(45),
  brand VARCHAR(45),
  model VARCHAR(45),
  carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id),
  description VARCHAR(200),
  picture VARCHAR(200),
  plates VARCHAR(45),
  base_address VARCHAR(200),
  active SMALLINT DEFAULT 0
);

-- -----------------------------------------------------
-- Table quotations
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  amount FLOAT,
  order_id INTEGER REFERENCES orders(id),
  carrier_company_id INTEGER REFERENCES carrier_company(id),
  quotation_status_id INTEGER DEFAULT 1 REFERENCES lu_quotation_status(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  selected SMALLINT DEFAULT 0,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Table calculated_distance
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS calculated_distance (
  id SERIAL PRIMARY KEY,
  address_origin VARCHAR(200),
  address_destination VARCHAR(200),
  kilometers INTEGER
);

-- -----------------------------------------------------
-- Table sepomex
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS sepomex (
  id SERIAL PRIMARY KEY,
  id_estado SMALLINT NOT NULL,
  estado VARCHAR(35) NOT NULL,
  id_municipio SMALLINT NOT NULL,
  municipio VARCHAR(60) NOT NULL,
  ciudad VARCHAR(60),
  zona VARCHAR(15) NOT NULL,
  cp INTEGER NOT NULL,
  asentamiento VARCHAR(70) NOT NULL,
  tipo VARCHAR(40) NOT NULL
);

-- -----------------------------------------------------
-- Initial Data
-- -----------------------------------------------------
INSERT INTO lu_order_status (status) VALUES 
  ('pending'),
  ('confirmed'),
  ('in_progress'),
  ('completed'),
  ('cancelled');

INSERT INTO lu_payment_type (type) VALUES 
  ('stripe'),
  ('cash');

INSERT INTO lu_quotation_status (status) VALUES 
  ('active'),
  ('selected'),
  ('cancelled');

INSERT INTO lu_country (country) VALUES 
  ('Mexico'),
  ('Peru');

INSERT INTO lu_services (service, description) VALUES 
  ('unpacking', 'Servicio de desempaque'),
  ('assembly', 'Armado de muebles'),
  ('disassembly', 'Desarmado de muebles'),
  ('packaging', 'Servicio de empaque'),
  ('cargo', 'Servicio de carga');

-- -----------------------------------------------------
-- Trigger for auto-update updated_date
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_date
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_date_column();

-- -----------------------------------------------------
-- Table reviews
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment VARCHAR(1000),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, customer_id)
);

CREATE INDEX idx_reviews_carrier_company ON reviews(carrier_company_id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

