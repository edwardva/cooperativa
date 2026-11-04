-- Retirar a un beneficiario desde Funeraria ya no lo marca como retirado en
-- todo el sistema (Salud lo seguía viendo así): funeraria guarda su propio
-- retiro y Salud el suyo en acuerdos_salud (confirmado por la cooperativa el 29/10).
ALTER TABLE "beneficiarios" ADD COLUMN "fecha_retiro_funeraria" DATE;
