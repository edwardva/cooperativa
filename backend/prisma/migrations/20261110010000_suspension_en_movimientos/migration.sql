-- Suspensión en el historial de funeraria y salud (10/11/2026): cada
-- movimiento guarda si el acuerdo quedó suspendido y desde cuándo, y el cobro
-- guarda la suspensión previa para que el reverso la pueda restaurar.
ALTER TABLE "movimientos_funeraria" ADD COLUMN "fecha_suspension" DATE;
ALTER TABLE "movimientos_salud" ADD COLUMN "fecha_suspension" DATE;
ALTER TABLE "detalle_colecta" ADD COLUMN "fecha_suspension_antes" DATE;
