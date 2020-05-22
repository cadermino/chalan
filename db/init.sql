-- MySQL Script generated by MySQL Workbench
-- Tue Dec  3 13:36:12 2019
-- Model: New Model    Version: 1.0
-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema chalan
-- -----------------------------------------------------
DROP SCHEMA IF EXISTS `chalan` ;

-- -----------------------------------------------------
-- Schema chalan
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `chalan` DEFAULT CHARACTER SET utf8 ;
USE `chalan` ;

-- -----------------------------------------------------
-- Table `order_details`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_details` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type` ENUM('carry_from', 'deliver_to') NOT NULL,
  `floor_number` INT(3) NULL,
  `order_id` INT NOT NULL,
  `street` VARCHAR(45) NULL,
  `interior_number` VARCHAR(45) NULL,
  `neighborhood` VARCHAR(45) NULL,
  `city` VARCHAR(45) NULL,
  `state` VARCHAR(45) NULL,
  `zip_code` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_order_details_order`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB CHARSET=utf8;


-- -----------------------------------------------------
-- Table `carrier_company`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `carrier_company` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB CHARSET=utf8;

INSERT INTO `carrier_company` (`name`)
VALUES
	('Transportes Rodrigues');


-- -----------------------------------------------------
-- Table `customers`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NULL,
  `paternal_last_name` VARCHAR(45) NULL,
  `maternal_last_name` VARCHAR(45) NULL,
  `email` VARCHAR(45) NULL UNIQUE,
  `password` VARCHAR(255) NULL,
  `mobile_phone` VARCHAR(15) NULL,
  `phone` VARCHAR(15) NULL,
  `created_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`))
ENGINE = InnoDB CHARSET=utf8
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `lu_order_status`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lu_order_status` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `status` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB CHARSET=utf8;


INSERT INTO `lu_order_status` (`id`, `status`)
VALUES
  (1, 'pending'),
  (2, 'in progress'),
  (3, 'completed'),
  (4, 'cancelled');

-- -----------------------------------------------------
-- Table `lu_payment_type`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lu_payment_type` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB CHARSET=utf8;


INSERT INTO `lu_payment_type` (`id`, `type`)
VALUES
  (1, 'credit card'),
  (2, 'cash');

-- -----------------------------------------------------
-- Table `orders`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NULL DEFAULT NULL,
  `product_id` INT NULL DEFAULT NULL,
  `order_status_id` INT NOT NULL DEFAULT 1,
  `appointment_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `comments` LONGTEXT NULL,
  `updated_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_orders_customers`
    FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_orders_lu_order_status1`
    FOREIGN KEY (`order_status_id`)
    REFERENCES `lu_order_status` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_products1`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB CHARSET=utf8;


-- -----------------------------------------------------
-- Table `payments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `amount` FLOAT NULL,
  `order_id` INT NOT NULL,
  `lu_payment_type_id` INT NOT NULL,
  `status` ENUM('pending', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
  `reference` VARCHAR(100) NULL COMMENT 'Stripe session id',
  `created_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `comments` LONGTEXT NULL,
  `active` TINYINT NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_payments_orders1`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_payments_lu_payment_type1`
    FOREIGN KEY (`lu_payment_type_id`)
    REFERENCES `lu_payment_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB CHARSET=utf8;


-- -----------------------------------------------------
-- Table `vehicles`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `size` ENUM('small', 'medium', 'large') NULL,
  `weight` VARCHAR(45) NULL COMMENT 'weight in kilograms',
  `brand` VARCHAR(45) NULL,
  `model` VARCHAR(45) NULL,
  `description` VARCHAR(200) NULL,
  `picture` VARCHAR(200) NULL,
  `plates` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB CHARSET=utf8;

INSERT INTO `vehicles` (`size`, `weight`, `brand`, `model`, `description`, `picture`, `plates`)
VALUES
	('small', '0–2,722', 'Chevrolet', 'Colorado/GMC Canyon', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('small', '0–2,722', 'Ford', 'Ranger', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('small', '0–2,722', 'Nissan', 'Frontier', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('small', '0–2,722', 'Jeep', 'Comanche', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('small', '0–2,722', 'Toyota', 'Tacoma', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('small', '0–2,722', 'Honda', 'Ridgeline FWD', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('medium', '7,258–8,845', 'Chevrolet', 'Silverado/GMC Sierra 5500', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('medium', '7,258–8,845', 'Ford', 'F-550', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('medium', '7,258–8,845', 'Ram', '5500', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('medium', '7,258–8,845', 'Kenworth', 'T170', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('medium', '7,258–8,845', 'Peterbilt', '325', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('medium', '7,258–8,845', 'International', 'TerraStar', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('medium', '7,258–8,845', 'Isuzu', 'NRR', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('large', '11,794–14,969', 'Autocar', 'ACMD', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('large', '11,794–14,969', 'GMC', 'C7500', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('large', '11,794–14,969', 'Kenworth', 'T470 & T440 & T370', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('large', '11,794–14,969', 'Peterbilt', '220 & 337', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg'),
	('large', '11,794–14,969', 'Ford', 'F-750', 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 'Chevrolet_Colorado.jpg', '464gfg');



-- -----------------------------------------------------
-- Table `products`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vehicle_id` INT NOT NULL,
  `price` FLOAT NULL,
  `from_floor` INT(3) NULL,
  `to_floor` INT(3) NULL,
  `from_neighborhood` VARCHAR(45) NULL,
  `to_neighborhood` VARCHAR(45) NULL,
  `from_city` VARCHAR(45) NULL,
  `to_city` VARCHAR(45) NULL,
  `from_state` VARCHAR(45) NULL,
  `to_state` VARCHAR(45) NULL,
  `from_zip_code` VARCHAR(45) NULL,
  `to_zip_code` VARCHAR(45) NULL,
  `carrier_company_id` INT NOT NULL,
  `description` VARCHAR(500) NULL,
  `active` TINYINT NOT NULL,
  `updated_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_vehicle1`
    FOREIGN KEY (`vehicle_id`)
    REFERENCES `vehicles` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_carrier_company1` 
    FOREIGN KEY (`carrier_company_id`)
    REFERENCES `carrier_company` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB CHARSET=utf8;

INSERT INTO `products` (`vehicle_id`, `price`, `from_floor`, `to_floor`, `from_neighborhood`, `to_neighborhood`, `from_city`, `to_city`, `from_state`, `to_state`, `from_zip_code`, `to_zip_code`, `carrier_company_id`, `description`, `active`)
VALUES
	(1, 5000, 5, 3, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(2, 8000, 3, 6, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(3, 6000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(4, 7000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(5, 10000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(6, 9000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(7, 13000, 5, 3, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(8, 15000, 0, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(9, 15000, 3, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(10, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(11, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(12, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(13, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(14, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(15, 15000, 5, 3, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(16, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(17, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(18, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(1, 15000, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1),
	(2, 300, 1, 1, 'Juárez', 'Lomas de Sotelo', 'Cuauhtémoc', 'Miguel Hidalgo', 'Ciudad de México', 'Ciudad de México', '06600', '11200', 1, 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB', 1);


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;