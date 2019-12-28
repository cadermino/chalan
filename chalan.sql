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
  `floor_number` INT(3) NOT NULL,
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
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `carrier_company`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `carrier_company` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `customers`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NULL,
  `paternal_last_name` VARCHAR(45) NULL,
  `maternal_last_name` VARCHAR(45) NULL,
  `email` VARCHAR(45) NULL,
  `password` VARCHAR(255) NULL,
  `mobile_phone` VARCHAR(15) NULL,
  `phone` VARCHAR(15) NULL,
  `created_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `drivers`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `drivers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NULL,
  `paternal_last_name` VARCHAR(45) NULL,
  `maternal_last_name` VARCHAR(45) NULL,
  `mobile_phone` VARCHAR(15) NULL,
  `vehicle_id` INT NOT NULL,
  `carrier_company_id` INT NULL,
  `created_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_drivers_carrier_company1`
    FOREIGN KEY (`carrier_company_id`)
    REFERENCES `carrier_company` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_drivers_vehicle1`
    FOREIGN KEY (`vehicle_id`)
    REFERENCES `vehicles` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


INSERT INTO `drivers` (`name`, `paternal_last_name`, `maternal_last_name`, `mobile_phone`, `vehicle_id`, `carrier_company_id`)
VALUES
	('Miguel', 'Calderon', 'Palomino', '764574557', 1, NULL);


-- -----------------------------------------------------
-- Table `lu_order_status`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lu_order_status` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `status` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


INSERT INTO `lu_order_status` (`id`, `status`)
VALUES
  (1, 'pending'),
  (2, 'in progress'),
  (3, 'cancelled');

-- -----------------------------------------------------
-- Table `lu_payment_type`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lu_payment_type` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


INSERT INTO `lu_payment_type` (`id`, `type`)
VALUES
  (1, 'credit card'),
  (2, 'cash');

-- -----------------------------------------------------
-- Table `orders`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `driver_id` INT NOT NULL,
  `order_status_id` INT NOT NULL DEFAULT 1,
  `appointment_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_id` INT NULL DEFAULT NULL,
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
  CONSTRAINT `fk_orders_drivers1`
    FOREIGN KEY (`driver_id`)
    REFERENCES `drivers` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_orders_payments1`
    FOREIGN KEY (`payment_id`)
    REFERENCES `payments` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `payments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `amount` FLOAT NULL,
  `lu_payment_type_id` INT NOT NULL,
  `reference` VARCHAR(45) NULL,
  `created_date` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `comments` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_payments_lu_payment_type1`
    FOREIGN KEY (`lu_payment_type_id`)
    REFERENCES `lu_payment_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `vehicles`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `size` ENUM('small', 'medium', 'large') NULL,
  `plates` VARCHAR(45) NULL,
  `model` VARCHAR(45) NULL,
  `brand` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;

INSERT INTO `vehicles` (`size`, `plates`, `model`, `brand`)
VALUES
	('small', '464gfg', 'test', 'test');


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
