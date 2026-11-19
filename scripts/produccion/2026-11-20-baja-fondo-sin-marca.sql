-- Observacion del 20/11: el socio al que se le quito la marca de trabajador de
-- El Triunfo salia del fondo, pero sus familiares del fondo quedaban activos.
-- Desde este despliegue el backend los da de baja al quitar la marca; este
-- script limpia los casos anteriores.
--
-- Igual que el boton de eliminar del modulo del fondo: se dan de baja
-- (activo = false), no se borran, porque pueden tener ayudas registradas.
-- Solo el fondo: funeraria y salud no se tocan. Cada baja queda en audit_log.
--
-- Uso: sudo -u postgres psql -d cooperativa -v ON_ERROR_STOP=1 -f este_archivo.sql
-- Es idempotente: una segunda corrida no encuentra nada.

BEGIN;

CREATE TEMP TABLE baja_fondo ON COMMIT DROP AS
SELECT f.*
FROM fondo_beneficiarios f
JOIN socios s ON s.id = f.socio_id
WHERE f.activo AND NOT s.es_trabajador_triunfo;

-- Lo que se va a dar de baja, para el registro del despliegue
SELECT s.codigo_socio, s.apellido, s.nombre, b.id AS familiar_id,
       b.apellido AS familiar_apellido, b.nombre AS familiar_nombre, b.parentesco
FROM baja_fondo b JOIN socios s ON s.id = b.socio_id
ORDER BY s.codigo_socio, b.id;

INSERT INTO audit_log (usuario_id, caja_id, accion, modulo, registro_id, datos_antes, datos_despues, ip_address, user_agent)
SELECT NULL, NULL, 'ELIMINAR', 'fondo_beneficiarios', b.id, to_jsonb(b),
       jsonb_build_object('activo', false, 'motivo', 'Socio sin marca de trabajador de El Triunfo (limpieza 20/11)'),
       NULL, 'script 2026-11-20-baja-fondo-sin-marca'
FROM baja_fondo b;

UPDATE fondo_beneficiarios f
SET activo = false, updated_at = now()
FROM baja_fondo b
WHERE f.id = b.id;

SELECT count(*) AS familiares_dados_de_baja FROM baja_fondo;

COMMIT;
