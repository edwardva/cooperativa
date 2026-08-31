/*
  Warnings:

  - The values [suspendido,inactivo] on the enum `EstadoSocio` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('M', 'F');

-- AlterEnum
BEGIN;
CREATE TYPE "EstadoSocio_new" AS ENUM ('activo', 'retirado', 'invalido');
ALTER TABLE "socios" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "socios" ALTER COLUMN "estado" TYPE "EstadoSocio_new" USING ("estado"::text::"EstadoSocio_new");
ALTER TYPE "EstadoSocio" RENAME TO "EstadoSocio_old";
ALTER TYPE "EstadoSocio_new" RENAME TO "EstadoSocio";
DROP TYPE "EstadoSocio_old";
ALTER TABLE "socios" ALTER COLUMN "estado" SET DEFAULT 'activo';
COMMIT;

-- DropIndex
DROP INDEX "socios_cedula_key";

-- AlterTable
ALTER TABLE "socios" ADD COLUMN     "sexo" "Sexo";
