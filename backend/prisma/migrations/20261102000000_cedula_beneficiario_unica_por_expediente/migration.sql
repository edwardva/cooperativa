-- La cédula de beneficiario deja de ser única en toda la base y pasa a ser
-- única por expediente: una misma persona puede tener varios expedientes
-- (socios con la misma cédula) y cada uno necesita su propia fila "titular".
-- Antes, al abrir un acuerdo para un expediente se tomaba la fila de OTRO
-- expediente con la misma cédula. No se mueve ningún dato existente.
DROP INDEX "beneficiarios_cedula_key";

CREATE UNIQUE INDEX "beneficiarios_socio_id_cedula_key" ON "beneficiarios"("socio_id", "cedula");
