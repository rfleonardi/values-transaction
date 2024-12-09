-- CreateTable
CREATE TABLE `Utilisateur` (
    `userIm` VARCHAR(10) NOT NULL,
    `username` VARCHAR(30) NOT NULL,
    `password` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`userIm`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Compte` (
    `accountNumber` VARCHAR(3) NOT NULL,
    `type` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`accountNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ordre` (
    `orderNumber` VARCHAR(20) NOT NULL,
    `responsible` VARCHAR(10) NOT NULL,

    PRIMARY KEY (`orderNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `ticketId` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketStart` INTEGER NOT NULL,
    `ticketEnd` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`ticketId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Operation` (
    `operationId` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(10) NOT NULL,
    `entity` VARCHAR(10) NOT NULL,
    `userIm` VARCHAR(10) NOT NULL,
    `accountNumber` VARCHAR(3) NOT NULL,
    `orderNumber` VARCHAR(20) NULL,
    `ticketId` INTEGER NOT NULL,

    UNIQUE INDEX `Operation_orderNumber_key`(`orderNumber`),
    INDEX `Operation_userIm_idx`(`userIm`),
    INDEX `Operation_accountNumber_idx`(`accountNumber`),
    INDEX `Operation_orderNumber_idx`(`orderNumber`),
    PRIMARY KEY (`operationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_userIm_fkey` FOREIGN KEY (`userIm`) REFERENCES `Utilisateur`(`userIm`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_accountNumber_fkey` FOREIGN KEY (`accountNumber`) REFERENCES `Compte`(`accountNumber`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_orderNumber_fkey` FOREIGN KEY (`orderNumber`) REFERENCES `Ordre`(`orderNumber`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`ticketId`) ON DELETE RESTRICT ON UPDATE CASCADE;
