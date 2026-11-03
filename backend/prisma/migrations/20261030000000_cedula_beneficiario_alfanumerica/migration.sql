-- La cédula del beneficiario admite números, letras y guión para los menores
-- sin cédula propia (p. ej. "12345678-1"), que pueden pasar de 11 caracteres.
-- Solo se amplía la columna: los datos existentes no cambian.
ALTER TABLE "beneficiarios" ALTER COLUMN "cedula" TYPE VARCHAR(20);
