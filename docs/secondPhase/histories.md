# Backlog técnico completo

## Sistema de Gestión de Cooperativa

Este documento convierte todas las historias de usuario funcionales en tareas técnicas de:

* Frontend.
* Backend / API.
* Base de datos.
* QA / pruebas.
* Integración.
* Seguridad.
* Migración.

---

# 1. Convenciones

## Prefijos

* **FE**: Frontend.
* **BE**: Backend.
* **DB**: Base de datos.
* **QA**: Pruebas.
* **INT**: Integración.
* **SEC**: Seguridad.
* **MIG**: Migración.

## Prioridades

* **P0**: Crítico para salida a producción.
* **P1**: Alta.
* **P2**: Media.
* **P3**: Posterior.

---

# ÉPICA 1. PERSONAS Y EXPEDIENTES

# HU-01. Registrar persona

## DB-001 – Crear entidad Persona

**Prioridad:** P0

Crear tabla `personas`.

Campos sugeridos:

* id
* tipo_identificacion
* numero_identificacion
* nombres
* apellidos
* fecha_nacimiento
* telefono
* email
* direccion
* estado
* created_at
* updated_at
* created_by

### Restricciones

* `numero_identificacion` debe ser único.
* No permitir eliminación física si tiene relaciones.

---

## BE-001 – API para registrar persona

Crear endpoint:

`POST /api/personas`

Debe:

* Validar identificación.
* Evitar duplicados.
* Normalizar datos.
* Registrar auditoría.
* Retornar persona creada.

---

## BE-002 – API búsqueda de persona

Crear:

`GET /api/personas`

Filtros:

* identificación.
* nombre.
* apellido.
* código.
* estado.

---

## FE-001 – Formulario de persona

Crear formulario con:

* Tipo de documento.
* Número.
* Nombres.
* Apellidos.
* Fecha de nacimiento.
* Teléfono.
* Email.
* Dirección.

Debe soportar Enter y Tab.

---

## FE-002 – Detección de persona existente

Al introducir identificación:

* Consultar backend.
* Si existe, mostrar datos.
* Evitar nuevo registro.
* Permitir continuar agregando un rol.

---

## QA-001 – Pruebas registro de persona

Casos:

* Persona nueva.
* Identificación duplicada.
* Datos obligatorios faltantes.
* Email inválido.
* Edición.
* Persona inactiva.
* Concurrencia con misma identificación.

---

# HU-02. Registrar socio ahorrista

## DB-002 – Crear expediente ahorrista

Tabla:

`socios_ahorristas`

Campos:

* id
* persona_id
* numero_expediente
* fecha_afiliacion
* estado
* fecha_suspension
* fecha_reactivacion
* created_at
* updated_at

---

## DB-003 – Crear relación socio-servicio

Tabla:

`socio_servicios`

Campos:

* id
* socio_ahorrista_id
* servicio_id
* fecha_inicio
* fecha_fin
* estado
* modalidad
* tarifa

---

## BE-003 – Crear expediente ahorrista

Endpoint:

`POST /api/socios-ahorristas`

Debe:

* Validar persona.
* Evitar expediente duplicado.
* Asignar número de expediente.
* Activar ahorro.
* Registrar auditoría.

---

## FE-003 – Alta de socio ahorrista

Desde la persona:

Botón:

**Crear expediente ahorrista**

Mostrar:

* Fecha de afiliación.
* Número de expediente.
* Servicios opcionales.
* Estado.

---

## QA-002 – Pruebas de socio ahorrista

Validar:

* Persona sin expediente.
* Persona ya ahorrista.
* Persona trabajadora que pasa a ser ahorrista.
* Activación de ahorro.
* Salud opcional.
* Funeraria opcional.

---

# HU-03. Registrar socio trabajador

## DB-004 – Crear socio trabajador

Tabla:

`socios_trabajadores`

Campos:

* id
* persona_id
* codigo_trabajador
* fecha_ingreso
* estado
* fecha_salida
* created_at
* updated_at

---

## DB-005 – Crear relación trabajador-feria

Tabla:

`trabajador_feria`

Campos:

* id
* trabajador_id
* feria_id
* fecha_inicio
* fecha_fin
* estado
* motivo_cambio

---

## BE-004 – Registrar trabajador

Endpoint:

`POST /api/trabajadores`

Debe:

* Validar persona.
* Validar feria.
* Crear trabajador.
* Asociar feria.
* Asignar salud automáticamente.

---

## FE-004 – Formulario de trabajador

Campos:

* Persona.
* Código.
* Feria.
* Fecha de ingreso.

Mostrar:

**Servicio de salud: asignado automáticamente**

---

## QA-003 – Pruebas trabajador

Validar:

* Alta correcta.
* Feria obligatoria.
* Servicio de salud asignado.
* No convertir automáticamente en ahorrista.

---

# HU-04. Crear expediente ahorrista a un trabajador

## BE-005 – Conversión trabajador → trabajador + ahorrista

Endpoint:

`POST /api/trabajadores/:id/crear-expediente-ahorrista`

Debe:

* Reutilizar `persona_id`.
* Validar período de prueba.
* Crear expediente independiente.

---

## FE-005 – Acción “Convertir en ahorrista”

En ficha del trabajador:

Mostrar:

* Fecha ingreso.
* Tiempo trabajado.
* Fecha estimada de fin de prueba.
* Estado de elegibilidad.

---

## QA-004

Probar:

* Antes de 3 meses.
* Después de 3 meses.
* Trabajador ya ahorrista.
* Independencia de movimientos.

---

# ÉPICA 2. FERIAS

# HU-05. Administrar ferias

## DB-006 – Crear tabla ferias

Campos:

* id
* codigo
* nombre
* ubicacion
* direccion
* responsable
* telefono
* estado
* observaciones

`codigo` único.

---

## BE-006 – CRUD de ferias

Endpoints:

`GET /api/ferias`

`POST /api/ferias`

`PUT /api/ferias/:id`

`GET /api/ferias/:id`

---

## FE-006 – Pantalla de ferias

Debe incluir:

* Buscador.
* Crear.
* Editar.
* Activar/desactivar.
* Cantidad trabajadores activos.

---

## QA-005

Validar:

* Código duplicado.
* Feria activa/inactiva.
* Feria con trabajadores.
* Imposibilidad de eliminar si tiene historial.

---

# HU-06. Trasladar trabajador

## BE-007 – Servicio de traslado

Endpoint:

`POST /api/trabajadores/:id/traslado-feria`

Debe:

1. Cerrar relación actual.
2. Registrar fecha fin.
3. Crear nueva relación.
4. Registrar motivo.
5. Mantener historial.

---

## FE-007 – Modal de traslado

Campos:

* Feria actual.
* Nueva feria.
* Fecha.
* Motivo.

---

## QA-006

Validar:

* Pago histórico mantiene feria vieja.
* Futuro pago usa feria nueva.
* No existir dos ferias activas simultáneamente.

---

# ÉPICA 3. PAGO DE SALUD

# HU-07. Consultar deuda de feria

## BE-008 – Consulta deuda de salud

Endpoint:

`GET /api/salud/ferias/:feriaId/deuda`

Parámetros:

* período.
* mes.
* año.
* semana, si aplica.

Retornar:

* trabajadores.
* total.
* pagados.
* pendientes.
* monto individual.
* monto total.

---

## DB-007 – Crear períodos de salud

Tabla:

`periodos_salud`

Campos:

* id
* tipo_periodo
* mes
* año
* semana
* fecha_inicio
* fecha_fin
* estado

---

## FE-008 – Pantalla Pago de Salud

Filtros:

* Feria.
* Mes.
* Año.
* Semana, si corresponde.

Resumen:

* Total trabajadores.
* Pagados.
* Pendientes.
* Total por pagar.

---

## FE-009 – Tabla detalle salud

Columnas:

* Cédula.
* Trabajador.
* Feria.
* Monto.
* Estado.
* Período.

---

## QA-007

Casos:

* Todos pendientes.
* Algunos pagados.
* Todos pagados.
* Feria sin trabajadores.
* Trabajador trasladado.
* Trabajador inactivo.

---

# HU-08. Registrar pago masivo de salud

## DB-008 – Encabezado de pago de salud

Tabla:

`pagos_salud_feria`

Campos:

* id
* feria_id
* periodo_id
* fecha_pago
* monto_esperado
* monto_recibido
* metodo_pago
* referencia
* observaciones
* estado
* created_by
* created_at

---

## DB-009 – Detalle individual

Tabla:

`pagos_salud_trabajador`

Campos:

* id
* pago_salud_feria_id
* trabajador_id
* periodo_id
* monto
* estado
* fecha_pago

Constraint recomendado:

`UNIQUE(trabajador_id, periodo_id, estado_activo)`

---

## BE-009 – Registrar pago masivo

Endpoint:

`POST /api/salud/pagos-masivos`

Debe:

* Recalcular deuda.
* Evitar confiar exclusivamente en monto enviado por frontend.
* Validar pagos existentes.
* Crear encabezado.
* Crear detalles.
* Registrar auditoría.

---

## FE-010 – Formulario de pago masivo

Campos:

* Feria.
* Período.
* Fecha.
* Monto esperado.
* Monto recibido.
* Método.
* Referencia.
* Observación.

---

## FE-011 – Confirmación

Mostrar:

**Está por registrar X pagos individuales por un monto de Y.**

Botones:

* Cancelar.
* Confirmar.

---

## QA-008

Validar:

* Registro correcto.
* Monto incorrecto.
* Pago duplicado.
* Período inválido.
* Dos usuarios intentando pagar simultáneamente.

---

# HU-09. Integridad transaccional

## BE-010 – Transacción de pago masivo

Todo proceso debe ejecutarse en una única transacción.

Rollback ante cualquier error.

---

## DB-010 – Constraints de integridad

Agregar:

* FKs.
* Unique indexes.
* Check constraints.
* Estados controlados.

---

## QA-009 – Simular fallo intermedio

Forzar error en trabajador N.

Resultado esperado:

* 0 movimientos confirmados.
* 0 encabezados válidos.
* Ningún trabajador marcado pagado.

---

# HU-10. Consultar detalle del pago

## BE-011

Endpoint:

`GET /api/salud/pagos/:id`

---

## FE-012

Pantalla detalle:

* Cabecera.
* Feria.
* Período.
* Referencia.
* Usuario.
* Trabajadores.
* Montos.

---

## QA-010

Validar que:

`SUM(detalles) = total aplicado`

---

# ÉPICA 4. COLECTAS

# HU-11. Registrar colecta

## DB-011 – Tabla colectas

Campos:

* id
* socio_ahorrista_id
* fecha
* monto_total
* metodo_pago
* referencia
* observacion
* estado
* created_by

---

## DB-012 – Detalle de semanas

Tabla:

`colecta_semanas`

Campos:

* id
* colecta_id
* socio_id
* anio
* numero_semana
* monto
* estado

Constraint:

`UNIQUE(socio_id, anio, numero_semana, concepto)`

---

## BE-012 – Obtener estado de colecta

Endpoint:

`GET /api/colectas/socio/:socioId/resumen`

Retornar:

* última semana.
* próxima semana.
* saldo.
* semanas pendientes.
* semanas adelantadas.

---

## BE-013 – Registrar colecta

`POST /api/colectas`

Debe:

* Validar semana.
* Crear movimiento.
* Actualizar saldo.
* Actualizar estado semanal.

---

## FE-013 – Pantalla de colecta

Buscar socio por:

* Cédula.
* Código.
* Nombre.

Mostrar resumen antes de cobrar.

---

## QA-011

Validar:

* Una semana.
* Semana duplicada.
* Socio suspendido.
* Socio sin expediente de ahorro.
* Colecta anulada.

---

# HU-12. Semanas adelantadas

## BE-014 – Calcular rango anticipado

Endpoint:

`POST /api/colectas/calcular-adelanto`

Recibe:

* socio.
* semana inicial.
* cantidad.

Devuelve:

* semanas.
* monto total.
* conflictos.

---

## FE-014 – Pago adelantado

Formulario:

* Semana inicial.
* Número de semanas.
* Monto semanal.

Mostrar:

* Semana final.
* Detalle.
* Total.

---

## QA-012

Casos:

* 2 semanas.
* 10 semanas.
* Cambio de año.
* Semana ya pagada.
* Rango parcialmente ocupado.

---

# HU-13. Anular colecta

## BE-015 – Anulación de colecta

Endpoint:

`POST /api/colectas/:id/anular`

Requiere:

* Motivo.

Debe:

* Anular encabezado.
* Anular semanas.
* Revertir saldo.
* Registrar auditoría.

---

## FE-015 – Modal anulación

Debe:

* Solicitar motivo.
* Mostrar impacto.
* Requerir confirmación.

---

## QA-013

Validar recalculo completo del socio.

---

# ÉPICA 5. PRÉSTAMOS

# HU-14. Registrar préstamo

## DB-013 – Tabla préstamos

Campos:

* id
* socio_id
* monto_solicitado
* monto_aprobado
* fecha_solicitud
* fecha_aprobacion
* numero_cuotas
* monto_cuota
* frecuencia
* fecha_inicio
* saldo
* estado

---

## DB-014 – Plan de cuotas

Tabla:

`prestamo_cuotas`

Campos:

* id
* prestamo_id
* numero
* fecha_vencimiento
* capital
* interes
* monto_total
* monto_pagado
* saldo
* estado

---

## BE-016 – Registrar préstamo

Endpoint:

`POST /api/prestamos`

---

## BE-017 – Generar plan de pagos

Servicio backend encargado de construir las cuotas.

---

## FE-016 – Formulario de préstamo

Mostrar simulación previa:

* Monto.
* Número cuotas.
* Valor cuota.
* Fechas.

---

## QA-014

Probar:

* Creación.
* Plan.
* Montos.
* Redondeo.
* Socio inactivo.

---

# HU-15. Pago de préstamo

## DB-015 – Pagos préstamo

Tabla:

`prestamo_pagos`

Campos:

* id
* prestamo_id
* cuota_id
* fecha
* monto
* referencia
* metodo_pago
* estado

---

## BE-018 – Registrar pago

Endpoint:

`POST /api/prestamos/:id/pagos`

Debe:

* Aplicar a cuota.
* Actualizar saldo.
* Cambiar estado.

---

## FE-017 – Pantalla pago préstamo

Mostrar:

* Saldo.
* Cuota actual.
* Vencimiento.
* Cuotas pagadas.
* Pendientes.

---

## QA-015

Validar:

* Pago exacto.
* Pago final.
* Pago duplicado.
* Pago a préstamo cerrado.

---

# ÉPICA 6. MOROSIDAD Y SUSPENSIÓN

# HU-16. Identificar morosos

## BE-019 – Motor de cálculo de mora

Debe determinar:

* Última semana pagada.
* Semana actual.
* Número de semanas pendientes.
* Riesgo de suspensión.

---

## DB-016 – Materialización opcional de mora

Puede mantenerse tabla:

`estado_morosidad`

Para optimizar consultas masivas.

---

## FE-018 – Pantalla morosidad

Columnas:

* Socio.
* Última semana.
* Semana actual.
* Semanas pendientes.
* Nivel de riesgo.
* Estado.

---

## QA-016

Validar cálculo en:

* Cambio de año.
* Semana 40.
* Semana 41.
* Semanas adelantadas.

---

# HU-17. Suspensión automática

## DB-017 – Historial de estados

Tabla:

`historial_estado_socio`

Campos:

* id
* socio_id
* estado_anterior
* estado_nuevo
* motivo
* fecha
* usuario_id
* origen

---

## BE-020 – Proceso automático de suspensión

Job programado.

Debe:

* Buscar socios que cumplen condición.
* Validar de nuevo.
* Suspender.
* Registrar historial.
* Registrar auditoría.

---

## QA-017

Probar:

* Semana 40 no suspende.
* Semana 41 sí.
* Socio adelantado no suspende.
* Reejecución no duplica historial.

---

# HU-18. Reactivación

## BE-021 – Reactivar socio

Endpoint:

`POST /api/socios/:id/reactivar`

Requiere:

* Motivo.
* Validaciones.
* Usuario autorizado.

---

## FE-019 – Modal reactivación

Mostrar:

* Motivo suspensión.
* Fecha.
* Deuda.
* Condiciones pendientes.

---

## QA-018

Validar:

* Reactivación correcta.
* Sin cumplir condición.
* Historial preservado.

---

# ÉPICA 7. REPORTES

# HU-19. Ferias pendientes

## BE-022 – Reporte de ferias pendientes

Endpoint:

`GET /api/reportes/salud/ferias-pendientes`

Filtros:

* Mes.
* Año.
* Semana.

---

## FE-020 – Reporte de ferias pendientes

Mostrar:

* Feria.
* Responsable.
* Trabajadores.
* Total esperado.
* Total pagado.
* Pendiente.
* Estado.

---

## BE-023 – Exportación Excel

Generar archivo XLSX.

---

## BE-024 – Exportación PDF

Generar PDF.

---

## QA-019

Comparar totales de pantalla, Excel y PDF.

---

# HU-20. Estado integral del socio

## BE-025 – Endpoint resumen 360°

`GET /api/personas/:id/resumen`

Debe combinar:

* Persona.
* Trabajador.
* Feria.
* Salud.
* Ahorrista.
* Colectas.
* Ahorro.
* Préstamos.
* Suspensiones.
* Servicios.

---

## FE-021 – Perfil integral

Crear ficha con pestañas:

* General.
* Trabajo.
* Salud.
* Ahorro.
* Colectas.
* Préstamos.
* Servicios.
* Historial.

---

## QA-020

Verificar independencia de cada módulo.

---

# ÉPICA 8. MIGRACIÓN

# HU-21. Importar datos anteriores

## MIG-001 – Definir diccionario de datos

Por cada tabla anterior documentar:

* Campo origen.
* Campo destino.
* Transformación.
* Valor por defecto.
* Regla de validación.

---

## MIG-002 – Migrar personas

Debe:

* Detectar duplicados.
* Normalizar cédulas.
* Crear reporte de errores.

---

## MIG-003 – Migrar socios ahorristas

Mantener código histórico.

---

## MIG-004 – Migrar trabajadores

Relacionar persona y feria.

---

## MIG-005 – Migrar ferias

Crear mapa:

`old_id -> new_id`

---

## MIG-006 – Migrar colectas

Mantener:

* Fecha.
* Monto.
* Semana.
* Referencia histórica.

---

## MIG-007 – Migrar semanas

Evitar duplicados.

---

## MIG-008 – Migrar saldos

Recalcular saldo desde movimientos y comparar con saldo anterior.

Generar diferencias.

---

## MIG-009 – Migrar préstamos

Incluir:

* Préstamos.
* Cuotas.
* Pagos.
* Saldos.

---

## MIG-010 – Migrar salud

Incluir:

* Pagos.
* Ferias.
* Trabajadores.
* Períodos.

---

## MIG-011 – Validación post-migración

Generar reporte:

* Origen.
* Destino.
* Diferencias.
* Registros rechazados.
* Duplicados.
* Huérfanos.

---

## QA-021 – Prueba de migración

Ejecutar primero con copia de producción.

Validar muestras aleatorias y totales financieros.

---

# ÉPICA 9. USABILIDAD

# HU-22. Navegación con Enter y Tab

## FE-022 – Componente común de navegación

Crear utilidad reutilizable para formularios.

Reglas:

* Enter pasa al siguiente control.
* Tab funciona normalmente.
* Shift+Tab retrocede.
* Textarea conserva Enter.
* Select debe poder seleccionarse con teclado.

---

## FE-023 – Aplicar navegación a todos los módulos

Aplicar en:

* Personas.
* Trabajadores.
* Ferias.
* Salud.
* Colectas.
* Préstamos.
* Reactivaciones.

---

## QA-022

Prueba completa exclusivamente con teclado.

---

# ÉPICA 10. MENSAJERÍA AUTOMÁTICA

## DB-018 – Configuración de plantillas

Tabla:

`plantillas_mensajes`

Campos:

* tipo
* canal
* contenido
* estado

---

## DB-019 – Historial de mensajes

Tabla:

`mensajes_enviados`

Campos:

* socio_id
* canal
* destinatario
* contenido
* fecha
* estado
* proveedor_id
* respuesta

---

## BE-026 – Servicio de notificaciones

Crear una capa independiente del proveedor.

Interfaces:

* `sendWhatsApp()`
* `sendSms()`
* `sendEmail()`

---

## BE-027 – Alertas de mora

Job que identifique socios próximos a suspensión.

---

## QA-023

Validar:

* Evitar mensajes duplicados.
* Reintentos.
* Fallos de proveedor.
* Historial.

---

# ÉPICA 11. SEGURIDAD

## DB-020 – Roles y permisos

Tablas:

* roles
* permisos
* rol_permiso
* usuario_rol

---

## BE-028 – Middleware de autorización

Validar permisos por endpoint.

---

## FE-024 – Ocultar acciones no autorizadas

Ejemplo:

Un usuario sin permiso `ANULAR_COLECTA` no debe ver el botón de anulación.

---

## QA-024 – Matriz de permisos

Probar por cada rol:

* Lectura.
* Escritura.
* Anulación.
* Auditoría.
* Exportación.

---

# ÉPICA 12. AUDITORÍA

## DB-021 – Tabla auditoría

Campos:

* id
* usuario_id
* fecha
* modulo
* accion
* entidad
* entidad_id
* valores_anteriores
* valores_nuevos
* ip
* origen

---

## BE-029 – Servicio central de auditoría

Debe ser reutilizable por todos los módulos.

---

## FE-025 – Consulta de auditoría

Solo administradores autorizados.

Filtros:

* Usuario.
* Fecha.
* Módulo.
* Acción.

---

## QA-025

Validar operaciones:

* Crear.
* Editar.
* Pagar.
* Anular.
* Suspender.
* Reactivar.

---

# 2. ENDPOINTS PRINCIPALES PROPUESTOS

| Método | Endpoint                            | Función           |
| ------ | ----------------------------------- | ----------------- |
| POST   | `/personas`                         | Registrar persona |
| GET    | `/personas`                         | Buscar personas   |
| GET    | `/personas/:id`                     | Consultar persona |
| GET    | `/personas/:id/resumen`             | Ficha integral    |
| POST   | `/socios-ahorristas`                | Crear ahorrista   |
| POST   | `/trabajadores`                     | Crear trabajador  |
| POST   | `/trabajadores/:id/traslado-feria`  | Trasladar         |
| GET    | `/ferias`                           | Consultar ferias  |
| POST   | `/ferias`                           | Crear feria       |
| GET    | `/salud/ferias/:id/deuda`           | Calcular salud    |
| POST   | `/salud/pagos-masivos`              | Registrar salud   |
| GET    | `/salud/pagos/:id`                  | Detalle pago      |
| POST   | `/salud/pagos/:id/anular`           | Anular            |
| GET    | `/colectas/socio/:id/resumen`       | Estado socio      |
| POST   | `/colectas`                         | Registrar colecta |
| POST   | `/colectas/calcular-adelanto`       | Calcular semanas  |
| POST   | `/colectas/:id/anular`              | Anular colecta    |
| POST   | `/prestamos`                        | Crear préstamo    |
| POST   | `/prestamos/:id/pagos`              | Pagar préstamo    |
| GET    | `/reportes/salud/ferias-pendientes` | Reporte           |
| POST   | `/socios/:id/reactivar`             | Reactivación      |

---

# 3. MODELO DE DATOS PRINCIPAL

Relaciones conceptuales:

```text
PERSONA
   |
   +------------------+
   |                  |
SOCIO_AHORRISTA   SOCIO_TRABAJADOR
   |                  |
   |                  +------ TRABAJADOR_FERIA ------ FERIA
   |
   +------ COLECTAS
   |
   +------ COLECTA_SEMANAS
   |
   +------ PRESTAMOS
   |          |
   |          +------ PRESTAMO_CUOTAS
   |          |
   |          +------ PRESTAMO_PAGOS
   |
   +------ SOCIO_SERVICIOS


FERIA
   |
   +------ PAGOS_SALUD_FERIA
               |
               +------ PAGOS_SALUD_TRABAJADOR


SOCIO_AHORRISTA
   |
   +------ HISTORIAL_ESTADO_SOCIO


TODAS LAS OPERACIONES
   |
   +------ AUDITORIA
```

---

# 4. ÍNDICES IMPORTANTES

Crear índices para:

```text
personas(numero_identificacion)

socios_ahorristas(numero_expediente)

socios_trabajadores(codigo_trabajador)

ferias(codigo)

trabajador_feria(trabajador_id, estado)

pagos_salud_feria(feria_id, periodo_id)

pagos_salud_trabajador(trabajador_id, periodo_id)

colecta_semanas(socio_id, anio, numero_semana)

prestamos(socio_id, estado)

prestamo_cuotas(prestamo_id, estado)
```

---

# 5. TRANSACCIONES OBLIGATORIAS

Las siguientes operaciones deben ser transaccionales:

### TX-01

Pago masivo de salud.

### TX-02

Registro de colecta.

### TX-03

Pago de semanas adelantadas.

### TX-04

Anulación de colecta.

### TX-05

Registro de pago de préstamo.

### TX-06

Anulación de pago.

### TX-07

Traslado de trabajador.

### TX-08

Suspensión de socio.

### TX-09

Reactivación de socio.

---

# 6. PRUEBAS CRÍTICAS DE INTEGRIDAD

## QA-FIN-01

La suma de los movimientos individuales de salud debe ser igual al encabezado.

## QA-FIN-02

La suma de colectas vigentes debe coincidir con el saldo calculado correspondiente.

## QA-FIN-03

Una semana no puede quedar pagada dos veces.

## QA-FIN-04

El saldo de un préstamo nunca debe ser negativo.

## QA-FIN-05

Un movimiento anulado no debe participar en cálculos vigentes.

## QA-FIN-06

Un trabajador solo puede tener una feria activa a la vez.

## QA-FIN-07

Una persona no debe duplicarse por poseer dos roles.

---

# 7. BACKLOG POR PRIORIDAD

## P0 – Bloqueante para producción

1. Persona.
2. Socio ahorrista.
3. Socio trabajador.
4. Ferias.
5. Asociación trabajador-feria.
6. Colectas.
7. Semanas adelantadas.
8. Pago masivo de salud.
9. Historial individual de salud.
10. Préstamos.
11. Pago de préstamos.
12. Anulaciones.
13. Auditoría básica.
14. Migración.
15. Validaciones de duplicados.
16. Transacciones.
17. Navegación Enter/Tab.

---

## P1 – Alta prioridad

18. Perfil integral del socio.
19. Reportes.
20. Permisos detallados.
21. Traslado de feria.
22. Suspensión.
23. Reactivación.
24. Morosidad.

---

## P2 – Evolución

25. Mensajería.
26. Alertas automáticas.
27. Automatización de cobranzas.
28. Dashboard administrativo.
29. Indicadores.

---

# 8. ORDEN TÉCNICO RECOMENDADO

## Sprint 1

* DB Personas.
* DB Socios.
* DB Trabajadores.
* DB Ferias.
* API Personas.
* API Socios.
* API Ferias.
* Formularios base.

## Sprint 2

* Colectas.
* Semanas.
* Movimientos.
* Historial.
* Anulación.

## Sprint 3

* Pago masivo de salud.
* Cálculo por feria.
* Detalles individuales.
* Historial salud.

## Sprint 4

* Préstamos.
* Cuotas.
* Pagos.
* Saldos.

## Sprint 5

* Migración.
* Validaciones financieras.
* Conciliación.

## Sprint 6

* Reportes.
* Perfil integral.
* Auditoría avanzada.

## Sprint 7

* Morosidad.
* Suspensión.
* Reactivación.

## Sprint 8

* Mensajería.
* Alertas.
* Automatización.

---

# 9. DEFINICIÓN DE TERMINADO GENERAL

Una historia se considera terminada únicamente cuando:

1. La base de datos está migrada.
2. El backend está implementado.
3. Existen validaciones de negocio.
4. El frontend consume el backend real.
5. Se manejan errores.
6. Existen pruebas de casos positivos.
7. Existen pruebas de casos negativos.
8. Se validan permisos.
9. La operación queda auditada cuando corresponda.
10. QA aprueba la historia.
11. No quedan errores críticos o bloqueantes.
12. La funcionalidad puede ser probada con datos reales o representativos.

---

# 10. CRITERIO DE ARQUITECTURA CLAVE

El punto central del sistema debe ser:

**Persona ≠ expediente.**

Una misma persona puede tener:

```text
Persona: Juan Pérez
Cédula: 12.345.678

├── Expediente trabajador
│   ├── Feria A
│   ├── Salud
│   └── Pagos realizados por la feria
│
└── Expediente ahorrista
    ├── Colectas
    ├── Ahorro
    ├── Semanas
    ├── Préstamos
    ├── Salud voluntaria
    └── Funeraria
```

Esto evita duplicar personas y, al mismo tiempo, evita mezclar movimientos que representan operaciones completamente distintas.

---

# 11. CRITERIO FINANCIERO CLAVE

Nunca debe actualizarse únicamente un campo de saldo sin generar el movimiento que lo respalda.

La lógica recomendada es:

```text
OPERACIÓN
    ↓
MOVIMIENTO FINANCIERO
    ↓
ACTUALIZACIÓN / RECÁLCULO DEL SALDO
```

No:

```text
editar saldo directamente
```

Por lo tanto:

* Colecta genera movimiento.
* Pago de salud genera movimiento.
* Pago de préstamo genera movimiento.
* Anulación genera reverso.
* Ajuste genera un movimiento de ajuste.

Esto garantiza trazabilidad y hace mucho más segura la migración y auditoría del sistema.

---

# 12. RESULTADO FINAL ESPERADO

Cuando todo el backlog esté completado, el sistema deberá poder seguir el ciclo completo de una persona:

**Registro de persona**

→ Registro como trabajador o ahorrista

→ Asociación a feria

→ Asignación de salud

→ Registro de colectas

→ Pago de semanas

→ Solicitud y pago de préstamos

→ Pago masivo de salud

→ Consulta de históricos

→ Identificación de mora

→ Suspensión

→ Reactivación

→ Reportes

→ Auditoría

sin duplicar personas, sin perder movimientos históricos y manteniendo total trazabilidad financiera.
