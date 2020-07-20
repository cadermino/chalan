alter TABLE vehicles
ADD COLUMN charge_per_kilometer INT(10) not null after id,
ADD COLUMN charge_per_floor INT(10) not null after charge_per_kilometer,
ADD COLUMN carrier_company_id INT(11) not null after model,
ADD COLUMN width varchar(45) DEFAULT null after weight,
ADD COLUMN height varchar(45) DEFAULT null after width,
ADD COLUMN length varchar(45) DEFAULT null after height,
ADD COLUMN active TINYINT(1) DEFAULT 0,
add CONSTRAINT fk_carrier_company FOREIGN KEY (carrier_company_id) REFERENCES carrier_company (id) ON DELETE NO ACTION ON UPDATE NO ACTION;

UPDATE vehicles SET carrier_company_id = 1;
UPDATE vehicles SET charge_per_floor = 100 WHERE size = 'small';
UPDATE vehicles SET charge_per_floor = 150 WHERE size = 'medium';
UPDATE vehicles SET charge_per_floor = 200 WHERE size = 'large';
UPDATE vehicles SET charge_per_kilometer = 25 WHERE size = 'small';
UPDATE vehicles SET charge_per_kilometer = 50 WHERE size = 'medium';
UPDATE vehicles SET charge_per_kilometer = 75 WHERE size = 'large';

alter TABLE orders
ADD COLUMN total_kilometers INT(20) DEFAULT NULL after product_id;

alter TABLE carrier_company
ADD COLUMN active TINYINT(1) DEFAULT NULL;

ALTER TABLE products
DROP FOREIGN KEY fk_carrier_company1,
DROP INDEX fk_carrier_company1,
DROP COLUMN carrier_company_id,
DROP COLUMN from_floor,
DROP COLUMN to_floor,
DROP COLUMN from_neighborhood,
DROP COLUMN to_neighborhood,
DROP COLUMN from_city,
DROP COLUMN to_city,
DROP COLUMN from_state,
DROP COLUMN to_state,
DROP COLUMN from_zip_code,
DROP COLUMN to_zip_code;