alter TABLE vehicles
ADD COLUMN base_address varchar(200) DEFAULT null after plates,
ADD COLUMN driver_fee int(10) NOT null COMMENT 'base load price' after charge_per_floor,
ADD COLUMN loader_fee int(10) NOT null COMMENT 'fee per loader' after driver_fee,
ADD COLUMN loaders_quantity int(2) NOT null COMMENT 'quantity of loaders' after loader_fee;

ALTER TABLE products
ADD COLUMN total_kilometers INT(20) DEFAULT null after price;