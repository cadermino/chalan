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
ADD COLUMN vehicle_id INT(10) DEFAULT NULL after customer_id,
ADD CONSTRAINT fk_vehicles FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE NO ACTION ON UPDATE NO ACTION;

alter TABLE carrier_company
ADD COLUMN active TINYINT(1) DEFAULT NULL;