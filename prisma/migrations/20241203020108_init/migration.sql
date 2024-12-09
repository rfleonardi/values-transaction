/*
  Warnings:

  - You are about to drop the `compte` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `operation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ordre` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `utilisateur` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[transactionId]` on the table `Ticket` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `transactionId` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `operation` DROP FOREIGN KEY `Operation_accountNumber_fkey`;

-- DropForeignKey
ALTER TABLE `operation` DROP FOREIGN KEY `Operation_orderNumber_fkey`;

-- DropForeignKey
ALTER TABLE `operation` DROP FOREIGN KEY `Operation_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `operation` DROP FOREIGN KEY `Operation_userIm_fkey`;

-- AlterTable
ALTER TABLE `ticket` ADD COLUMN `transactionId` INTEGER NOT NULL;

-- DropTable
DROP TABLE `compte`;

-- DropTable
DROP TABLE `operation`;

-- DropTable
DROP TABLE `ordre`;

-- DropTable
DROP TABLE `utilisateur`;

-- CreateTable
CREATE TABLE `Journal` (
    `accountNumber` VARCHAR(3) NOT NULL,
    `nature` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `Journal_accountNumber_key`(`accountNumber`),
    PRIMARY KEY (`accountNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `userIm` VARCHAR(10) NOT NULL,
    `username` VARCHAR(30) NOT NULL,
    `password` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `User_userIm_key`(`userIm`),
    PRIMARY KEY (`userIm`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `transactionId` INTEGER NOT NULL AUTO_INCREMENT,
    `orderNumber` VARCHAR(20) NULL,
    `type` VARCHAR(10) NOT NULL,
    `entity` VARCHAR(10) NOT NULL,
    `date` VARCHAR(10) NOT NULL,
    `responsible` VARCHAR(30) NULL,
    `accountNumber` VARCHAR(3) NOT NULL,
    `userIm` VARCHAR(10) NOT NULL,

    PRIMARY KEY (`transactionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Ticket_transactionId_key` ON `Ticket`(`transactionId`);

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`transactionId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_accountNumber_fkey` FOREIGN KEY (`accountNumber`) REFERENCES `Journal`(`accountNumber`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_userIm_fkey` FOREIGN KEY (`userIm`) REFERENCES `User`(`userIm`) ON DELETE RESTRICT ON UPDATE CASCADE;
