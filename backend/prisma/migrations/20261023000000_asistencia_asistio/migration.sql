-- La caja marca en la colecta si el socio asistió (Sí) o no (No) a la asamblea.
-- El "No" queda guardado como inasistencia en su historial (pedido del 23/10);
-- sólo las filas con asistio = true cuentan como asistencia.
ALTER TABLE "asistencias_asamblea" ADD COLUMN "asistio" BOOLEAN NOT NULL DEFAULT true;
