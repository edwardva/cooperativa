# Especificación funcional consolidada

## Sistema de gestión de la cooperativa

## 1. Objetivo general

Desarrollar un sistema que permita administrar integralmente:

* Personas y socios.
* Socios ahorristas.
* Socios trabajadores.
* Ferias y trabajadores asociados.
* Servicio de ahorro.
* Servicio de salud.
* Servicio funerario.
* Colectas.
* Semanas pagadas por adelantado.
* Préstamos.
* Pagos masivos de salud.
* Morosidad, suspensión y reactivación.
* Historiales, reportes y auditoría.
* Migración de información proveniente del sistema anterior.

El sistema debe diferenciar correctamente los movimientos realizados por una persona como **socio trabajador** y como **socio ahorrista**, aunque ambos expedientes correspondan a la misma persona.

---

# 2. Actores del sistema

## 2.1. Administrador

Puede:

* Configurar parámetros.
* Crear usuarios.
* Administrar permisos.
* Registrar, modificar y consultar socios.
* Gestionar ferias.
* Registrar pagos.
* Anular operaciones.
* Consultar auditoría.
* Ejecutar procesos de suspensión y reactivación.

## 2.2. Personal administrativo

Puede:

* Registrar socios.
* Consultar ferias.
* Registrar colectas.
* Registrar pagos de salud.
* Consultar préstamos.
* Consultar saldos e historiales.
* Generar reportes.

## 2.3. Socio ahorrista

Es la persona que se inscribe voluntariamente en la cooperativa y participa en el servicio de ahorro.

Puede optar adicionalmente por:

* Servicio de salud.
* Servicio funerario.

## 2.4. Socio trabajador

Es la persona que trabaja en una feria.

Por su condición de trabajador:

* Debe estar asociado a una feria.
* Recibe automáticamente el servicio de salud.
* El costo de salud es descontado por la feria.
* Su pago de salud se procesa dentro del pago masivo de la feria.

Después del período de prueba definido por la cooperativa, el socio trabajador puede inscribirse también como socio ahorrista.

---

# 3. Modelo funcional de personas y expedientes

## RF-SOC-01. Registro único de persona

El sistema debe mantener un registro principal de la persona con sus datos personales.

Como mínimo:

* Tipo de identificación.
* Número de identificación.
* Nombres.
* Apellidos.
* Fecha de nacimiento.
* Teléfono.
* Dirección.
* Correo electrónico.
* Estado.
* Fecha de registro.

## RF-SOC-02. Roles de una persona

Una persona puede tener uno o varios roles dentro de la cooperativa:

* Socio ahorrista.
* Socio trabajador.
* Beneficiario de salud.
* Beneficiario de funeraria.

## RF-SOC-03. Expedientes funcionales separados

Cuando una persona sea simultáneamente socio trabajador y socio ahorrista, el sistema debe manejar dos expedientes funcionales vinculados:

1. Expediente como socio trabajador.
2. Expediente como socio ahorrista.

Los expedientes deben compartir la identidad de la persona, pero conservar separados:

* Movimientos.
* Pagos.
* Saldos.
* Servicios.
* Fechas de afiliación.
* Estados.
* Historiales.

## RF-SOC-04. Prevención de personas duplicadas

El sistema no debe crear dos personas diferentes con el mismo número de identificación.

Debe permitir agregar un nuevo rol o expediente a una persona existente.

## RF-SOC-05. Período de prueba del trabajador

El sistema debe registrar la fecha de ingreso laboral del socio trabajador.

Debe poder calcular cuándo finalizan los tres meses de prueba.

Después de este período, debe permitir que el trabajador sea registrado también como socio ahorrista.

## RF-SOC-06. Estado del socio

Los expedientes deben manejar como mínimo los siguientes estados:

* Activo.
* Suspendido.
* Retirado.
* Inactivo.

---

# 4. Gestión de ferias

## RF-FER-01. Registrar feria

El sistema debe permitir registrar una feria con:

* Código.
* Nombre.
* Ubicación.
* Dirección.
* Responsable.
* Teléfono.
* Estado.
* Observaciones.

## RF-FER-02. Código único

Cada feria debe tener un código único que permita identificarla y diferenciarla de las demás.

## RF-FER-03. Asociar trabajadores

El sistema debe permitir asociar uno o varios trabajadores a una feria.

## RF-FER-04. Historial de asociación

El sistema debe conservar:

* Feria actual del trabajador.
* Fecha de ingreso.
* Fecha de salida.
* Ferias anteriores.
* Motivo del cambio, cuando corresponda.

## RF-FER-05. Cambio de feria

Cuando un trabajador cambie de feria, el sistema debe actualizar su asociación actual sin modificar los pagos históricos.

Los pagos anteriores deben conservar la feria que tenía el trabajador al momento de la operación.

## RF-FER-06. Consultar trabajadores

El sistema debe permitir consultar trabajadores por:

* Feria.
* Estado.
* Nombre.
* Identificación.
* Fecha de ingreso.

---

# 5. Servicios de la cooperativa

## RF-SER-01. Servicios disponibles

El sistema debe manejar como mínimo:

* Ahorro.
* Salud.
* Funeraria.

## RF-SER-02. Servicio de ahorro

El servicio de ahorro debe estar disponible para los socios ahorristas.

## RF-SER-03. Servicios opcionales

Un socio ahorrista puede contratar opcionalmente:

* Salud.
* Funeraria.

## RF-SER-04. Validación de elegibilidad

Para contratar salud o funeraria de manera voluntaria, la persona debe estar registrada como socio ahorrista.

## RF-SER-05. Salud del socio trabajador

Todo socio trabajador activo debe recibir automáticamente el servicio de salud mientras permanezca vinculado a una feria.

## RF-SER-06. Separación de cobros

El sistema debe diferenciar:

* Pago de salud descontado por la feria.
* Aportes de ahorro realizados mediante colecta.
* Pago voluntario de salud del socio ahorrista.
* Pago del servicio funerario.
* Cuotas de préstamos.

---

# 6. Pago masivo de salud por feria

## RF-SAL-01. Módulo Pago de Salud

El sistema debe incluir una opción denominada:

**Pago de Salud por Feria**

## RF-SAL-02. Selección de feria

El usuario debe seleccionar una feria antes de consultar o registrar un pago.

## RF-SAL-03. Selección del período

El usuario debe seleccionar el período correspondiente.

Como mínimo:

* Mes.
* Año.

Si el control se realiza semanalmente, el sistema debe permitir seleccionar también la semana.

## RF-SAL-04. Listado de trabajadores

Después de seleccionar la feria y el período, el sistema debe mostrar los trabajadores activos asociados.

## RF-SAL-05. Datos del listado

Por cada trabajador debe mostrarse:

* Identificación.
* Nombre completo.
* Código de trabajador.
* Feria.
* Monto individual de salud.
* Período.
* Estado del pago.

## RF-SAL-06. Estados de salud

Los estados mínimos serán:

* Pendiente.
* Pagado.
* Anulado.

## RF-SAL-07. Cálculo de deuda

El sistema debe calcular automáticamente:

* Cantidad total de trabajadores.
* Trabajadores pendientes.
* Trabajadores pagados.
* Monto individual.
* Monto total pendiente de la feria.

## RF-SAL-08. Exclusión de pagos existentes

Los trabajadores que ya tengan registrado el pago del período no deben ser incluidos nuevamente.

## RF-SAL-09. Registro del pago masivo

El sistema debe permitir registrar el pago recibido de una feria.

Debe almacenar:

* Feria.
* Período.
* Fecha de pago.
* Monto esperado.
* Monto recibido.
* Método de pago.
* Referencia.
* Observaciones.
* Usuario que registra.

## RF-SAL-10. Confirmación

Antes de procesar el pago, el sistema debe mostrar:

* Feria.
* Período.
* Número de trabajadores.
* Monto total.
* Advertencia de que se generarán movimientos individuales.

## RF-SAL-11. Distribución individual

Al confirmar el pago masivo, el sistema debe generar automáticamente un movimiento de salud para cada socio trabajador incluido.

## RF-SAL-12. Vínculo entre movimientos

Cada movimiento individual debe quedar asociado al identificador del pago masivo que lo originó.

## RF-SAL-13. Operación atómica

El pago masivo debe ejecutarse mediante una transacción de base de datos.

Si falla el movimiento de un trabajador:

* Se debe cancelar toda la operación.
* No debe quedar registrado el pago masivo.
* Ningún trabajador debe quedar marcado como pagado.

## RF-SAL-14. Historial de salud

El sistema debe permitir consultar los pagos de salud:

* Por feria.
* Por trabajador.
* Por período.
* Por estado.
* Por número de referencia.

## RF-SAL-15. Anulación

Un usuario autorizado debe poder anular un pago masivo.

La anulación debe:

* Solicitar motivo.
* Anular los movimientos individuales.
* Conservar la operación original.
* Registrar auditoría.
* Devolver los períodos correspondientes al estado pendiente.

---

# 7. Colecta y ahorro

## RF-COL-01. Módulo de Colecta

El sistema debe permitir registrar las colectas correspondientes a los socios ahorristas.

## RF-COL-02. Consulta del socio

El usuario debe poder localizar al socio por:

* Identificación.
* Código.
* Nombre.
* Número de expediente.

## RF-COL-03. Información previa

Antes de registrar una colecta, el sistema debe mostrar:

* Datos del socio.
* Estado.
* Última semana pagada.
* Próxima semana pendiente.
* Saldo de ahorro.
* Semanas adelantadas, si existen.
* Deudas o compromisos asociados.

## RF-COL-04. Registro de colecta

El sistema debe permitir registrar:

* Fecha.
* Semana o período.
* Monto.
* Concepto.
* Método de pago.
* Referencia.
* Observaciones.
* Usuario que registra.

## RF-COL-05. Generación de movimiento

Cada colecta debe generar un movimiento individual en la cuenta de ahorro del socio.

## RF-COL-06. Actualización de saldo

Al confirmar la colecta, el sistema debe actualizar automáticamente:

* Saldo del socio.
* Última semana pagada.
* Próxima semana pendiente.
* Estado de morosidad.

## RF-COL-07. Separación de expedientes

Las colectas registradas como socio ahorrista no deben mezclarse con los pagos de salud realizados como socio trabajador.

## RF-COL-08. Prevención de duplicados

El sistema debe impedir que una misma semana sea pagada dos veces por el mismo concepto, salvo una corrección autorizada.

## RF-COL-09. Anulación

Un usuario autorizado podrá anular una colecta.

La anulación debe:

* Revertir el movimiento.
* Recalcular el saldo.
* Recalcular la última semana pagada.
* Registrar el motivo y el usuario responsable.

---

# 8. Semanas pagadas por adelantado

## RF-ADE-01. Pago anticipado

El sistema debe permitir que un socio pague varias semanas por adelantado.

## RF-ADE-02. Selección de cantidad

El usuario debe indicar:

* Semana inicial.
* Cantidad de semanas.
* Monto por semana.
* Monto total.

## RF-ADE-03. Distribución automática

El sistema debe distribuir el pago entre las semanas consecutivas correspondientes.

## RF-ADE-04. Validación

No se deben generar semanas duplicadas ni solapadas con semanas previamente pagadas.

## RF-ADE-05. Visualización

El expediente del socio debe mostrar:

* Última semana cubierta.
* Cantidad de semanas adelantadas.
* Fecha estimada de próxima obligación.
* Detalle de cada semana pagada.

## RF-ADE-06. Reverso

Si se anula el pago anticipado, el sistema debe anular todas las semanas relacionadas con esa operación.

---

# 9. Préstamos

## RF-PRE-01. Registro de préstamo

El sistema debe permitir registrar un préstamo asociado a un socio ahorrista.

## RF-PRE-02. Datos del préstamo

Debe almacenar como mínimo:

* Socio.
* Fecha de solicitud.
* Fecha de aprobación.
* Monto solicitado.
* Monto aprobado.
* Número de cuotas.
* Monto de la cuota.
* Frecuencia de pago.
* Fecha de inicio.
* Estado.
* Observaciones.

## RF-PRE-03. Estados

El préstamo debe manejar como mínimo:

* Solicitado.
* Aprobado.
* Activo.
* Pagado.
* Vencido.
* Anulado.

## RF-PRE-04. Plan de pagos

Al aprobar el préstamo, el sistema debe generar el plan de cuotas.

## RF-PRE-05. Pago de cuotas

El sistema debe permitir registrar pagos de las cuotas del préstamo.

## RF-PRE-06. Aplicación del pago

Cada pago debe actualizar:

* Cuotas pagadas.
* Saldo pendiente.
* Próxima cuota.
* Estado del préstamo.

## RF-PRE-07. Historial

El expediente del socio debe mostrar:

* Préstamos actuales.
* Préstamos anteriores.
* Cuotas pagadas.
* Cuotas pendientes.
* Saldo total pendiente.

## RF-PRE-08. Anulación o corrección

Los pagos de préstamos solo podrán anularse con permisos especiales y registro de auditoría.

---

# 10. Morosidad y suspensión

Este módulo se considera importante, pero puede desarrollarse después de estabilizar Colecta, préstamos y pagos principales.

## RF-MOR-01. Cálculo de morosidad

El sistema debe calcular automáticamente las semanas pendientes de cada socio.

## RF-MOR-02. Semana actual

El sistema debe disponer de un calendario o numeración de semanas que permita determinar:

* Semana actual.
* Última semana pagada.
* Número de semanas pendientes.

## RF-MOR-03. Suspensión automática

El sistema debe suspender automáticamente al socio cuando alcance la condición de mora correspondiente a la **semana 41**, según la regla establecida por la cooperativa.

## RF-MOR-04. Registro de suspensión

La suspensión debe almacenar:

* Socio.
* Fecha.
* Semana.
* Motivo.
* Usuario o proceso que ejecutó la suspensión.
* Deuda existente.
* Estado anterior.

## RF-MOR-05. Restricciones

Un socio suspendido no debe poder realizar operaciones que requieran condición de socio activo, salvo las operaciones permitidas para regularizar su situación.

## RF-MOR-06. Consulta

El sistema debe permitir consultar:

* Socios próximos a suspensión.
* Socios suspendidos.
* Fecha de suspensión.
* Semanas pendientes.
* Motivo.

---

# 11. Reactivación de socios

## RF-REA-01. Reactivar socio

Un usuario autorizado debe poder reactivar a un socio suspendido.

## RF-REA-02. Conservación del historial

La reactivación no debe borrar:

* Suspensión anterior.
* Motivo.
* Fecha.
* Deuda histórica.
* Pagos realizados.
* Movimientos previos.

## RF-REA-03. Validación

Antes de reactivar al socio, el sistema debe verificar que cumpla las condiciones definidas por la cooperativa.

## RF-REA-04. Datos de reactivación

Debe registrarse:

* Fecha.
* Motivo.
* Usuario.
* Condiciones cumplidas.
* Observaciones.

---

# 12. Mensajería automática

Este módulo se plantea para una fase posterior.

## RF-MEN-01. Avisos preventivos

El sistema debe permitir enviar avisos antes de que un socio sea suspendido.

## RF-MEN-02. Plantillas

Deben existir plantillas para:

* Recordatorio de pago.
* Aviso de mora.
* Aviso próximo a suspensión.
* Confirmación de suspensión.
* Confirmación de reactivación.

## RF-MEN-03. Canales

La solución debe quedar preparada para integración con:

* WhatsApp.
* SMS.
* Correo electrónico.

## RF-MEN-04. Historial de mensajes

El sistema debe registrar:

* Destinatario.
* Fecha.
* Canal.
* Plantilla.
* Estado del envío.
* Respuesta del proveedor, cuando exista.

---

# 13. Reportes

## RF-REP-01. Reporte de trabajadores por feria

Debe mostrar:

* Feria.
* Trabajadores activos.
* Trabajadores inactivos.
* Estado del servicio de salud.

## RF-REP-02. Reporte de pagos de salud

Debe permitir filtrar por:

* Feria.
* Período.
* Estado.
* Trabajador.
* Fecha.

## RF-REP-03. Ferias pendientes

Debe existir un reporte de ferias que no hayan realizado el pago de salud correspondiente.

## RF-REP-04. Colectas

Debe permitir consultar:

* Colectas por fecha.
* Colectas por socio.
* Colectas por semana.
* Montos totales.
* Operaciones anuladas.

## RF-REP-05. Semanas adelantadas

Debe mostrar:

* Socio.
* Semana inicial.
* Semana final.
* Cantidad de semanas.
* Monto pagado.

## RF-REP-06. Préstamos

Debe mostrar:

* Préstamos activos.
* Préstamos pagados.
* Préstamos vencidos.
* Cuotas pendientes.
* Saldo por cobrar.

## RF-REP-07. Socios suspendidos

Debe permitir consultar:

* Socio.
* Fecha de suspensión.
* Motivo.
* Semanas pendientes.
* Estado actual.

## RF-REP-08. Exportación

Los reportes deben poder exportarse, como mínimo, a:

* Excel.
* PDF.

---

# 14. Migración de datos

## RF-MIG-01. Migración desde el sistema anterior

El sistema debe permitir importar los datos existentes del sistema anterior.

## RF-MIG-02. Datos a migrar

La migración debe considerar, como mínimo:

* Personas.
* Socios.
* Ferias.
* Trabajadores.
* Movimientos de ahorro.
* Colectas.
* Saldos.
* Semanas pagadas.
* Historial de salud.
* Préstamos.
* Pagos de préstamos.
* Estados.
* Suspensiones, cuando existan.

## RF-MIG-03. Validación de duplicados

La migración debe identificar:

* Identificaciones duplicadas.
* Códigos duplicados.
* Movimientos repetidos.
* Socios sin feria.
* Trabajadores sin expediente.
* Pagos sin período.

## RF-MIG-04. Reporte de migración

Después de cada ejecución se debe generar un reporte con:

* Registros procesados.
* Registros importados.
* Registros rechazados.
* Advertencias.
* Errores.
* Motivo de cada rechazo.

## RF-MIG-05. Trazabilidad

Los datos migrados deben conservar una referencia al origen o al identificador que tenían en el sistema anterior.

---

# 15. Seguridad y auditoría

## RF-SEG-01. Usuarios y roles

El sistema debe manejar permisos por módulo y operación.

## RF-SEG-02. Permisos mínimos

Debe ser posible configurar permisos para:

* Consultar.
* Crear.
* Modificar.
* Registrar pagos.
* Anular pagos.
* Reactivar socios.
* Exportar reportes.
* Consultar auditoría.

## RF-SEG-03. Auditoría

El sistema debe registrar:

* Usuario.
* Fecha.
* Hora.
* Acción.
* Módulo.
* Registro afectado.
* Valores anteriores.
* Valores nuevos.

## RF-SEG-04. Eliminación lógica

Los movimientos financieros no deben eliminarse físicamente.

Las correcciones deben manejarse mediante:

* Anulación.
* Reverso.
* Ajuste.

---

# 16. Requisitos de usabilidad

## RF-USA-01. Navegación con teclado

En los formularios, el usuario debe poder pasar al siguiente campo usando:

* Enter.
* Tab.

## RF-USA-02. Orden lógico

La navegación debe seguir el orden visual y lógico del formulario.

## RF-USA-03. Último campo

Al presionar Enter en el último campo, el sistema no debe guardar automáticamente, salvo que la acción esté expresamente configurada.

## RF-USA-04. Mensajes claros

Los mensajes deben indicar:

* Qué ocurrió.
* Qué dato debe corregirse.
* Si la operación se completó.
* Si la operación no pudo ejecutarse.

## RF-USA-05. Confirmaciones

Las operaciones masivas, anulaciones y reactivaciones deben solicitar confirmación.

---

# 17. Reglas de negocio consolidadas

## RN-01

Una persona puede ser simultáneamente socio trabajador y socio ahorrista.

## RN-02

Los expedientes de trabajador y ahorrista deben estar vinculados, pero sus movimientos financieros deben mantenerse separados.

## RN-03

El socio trabajador obtiene automáticamente el servicio de salud por estar asociado a una feria.

## RN-04

El pago de salud del socio trabajador es descontado y remitido por la feria.

## RN-05

El socio ahorrista puede contratar opcionalmente los servicios de salud y funeraria.

## RN-06

Para obtener voluntariamente salud o funeraria, la persona debe ser socio ahorrista.

## RN-07

Un trabajador podrá convertirse también en socio ahorrista después de cumplir los tres meses de prueba.

## RN-08

El pago de salud recibido de una feria se registra como una operación masiva.

## RN-09

Cada pago masivo debe generar un movimiento individual por trabajador.

## RN-10

No se debe registrar dos veces el mismo pago, servicio y período para una persona.

## RN-11

Una colecta debe actualizar el saldo y las semanas pagadas del socio.

## RN-12

Un socio puede pagar varias semanas por adelantado.

## RN-13

Las semanas adelantadas deben generarse consecutivamente y sin duplicados.

## RN-14

Los pagos históricos deben conservar la feria y las condiciones existentes al momento de la operación.

## RN-15

Las anulaciones no deben borrar los registros originales.

## RN-16

El sistema debe suspender automáticamente al socio cuando se cumpla la regla de mora asociada a la semana 41.

## RN-17

Una reactivación debe conservar el historial completo de la suspensión.

## RN-18

Las operaciones financieras deben ser auditables.

---

# 18. Historias de usuario

# ÉPICA 1 – Personas, socios y expedientes

## HU-01 – Registrar una persona

**Como** usuario administrativo
**quiero** registrar los datos de una persona
**para** incorporarla posteriormente como trabajador, ahorrista o beneficiario de un servicio.

### Criterios de aceptación

1. El número de identificación debe ser obligatorio.
2. El sistema debe validar que la persona no exista.
3. Si ya existe, debe mostrar su registro actual.
4. El usuario debe poder agregar un nuevo rol sin duplicar a la persona.
5. El sistema debe registrar fecha y usuario de creación.

---

## HU-02 – Registrar socio ahorrista

**Como** usuario administrativo
**quiero** crear el expediente ahorrista de una persona
**para** gestionar sus aportes, colectas y servicios voluntarios.

### Criterios de aceptación

1. La persona debe existir previamente.
2. Debe asignarse un código o número de expediente.
3. Debe registrarse la fecha de afiliación.
4. El expediente debe iniciar activo.
5. Debe habilitarse el servicio de ahorro.
6. Salud y funeraria deben aparecer como opcionales.

---

## HU-03 – Registrar socio trabajador

**Como** usuario administrativo
**quiero** registrar una persona como trabajador de una feria
**para** incluirla en el servicio de salud colectivo.

### Criterios de aceptación

1. Debe seleccionarse una feria.
2. Debe registrarse la fecha de ingreso.
3. El trabajador debe quedar activo.
4. El servicio de salud debe asignarse automáticamente.
5. Debe aparecer en el siguiente cálculo de salud de la feria.
6. El trabajador no debe convertirse automáticamente en socio ahorrista.

---

## HU-04 – Crear expediente ahorrista para un trabajador

**Como** usuario administrativo
**quiero** registrar como ahorrista a una persona que ya es trabajadora
**para** que pueda realizar colectas sin mezclar sus movimientos de salud.

### Criterios de aceptación

1. El sistema debe reutilizar el registro de la persona.
2. Debe crear un expediente ahorrista vinculado.
3. Debe conservar el expediente laboral.
4. Los pagos de salud de la feria no deben aparecer como colectas.
5. Los aportes de ahorro no deben modificar el historial laboral.
6. El sistema debe advertir si no se han cumplido los tres meses de prueba.

---

# ÉPICA 2 – Ferias

## HU-05 – Administrar ferias

**Como** administrador
**quiero** registrar y actualizar las ferias
**para** identificar dónde trabaja cada socio trabajador.

### Criterios de aceptación

1. El código de la feria debe ser único.
2. Se debe poder activar o desactivar una feria.
3. No se debe eliminar una feria con movimientos históricos.
4. Debe mostrarse la cantidad de trabajadores activos.

---

## HU-06 – Trasladar trabajador entre ferias

**Como** usuario administrativo
**quiero** cambiar a un trabajador de feria
**para** mantener actualizada su ubicación laboral.

### Criterios de aceptación

1. Debe registrarse la fecha del traslado.
2. Debe cerrarse la asociación anterior.
3. Debe crearse la nueva asociación.
4. Los pagos anteriores deben conservar la feria original.
5. Los pagos futuros deben calcularse en la nueva feria.

---

# ÉPICA 3 – Pago de salud

## HU-07 – Consultar deuda de salud de una feria

**Como** usuario administrativo
**quiero** seleccionar una feria y un período
**para** conocer cuánto debe pagar por sus trabajadores.

### Criterios de aceptación

1. El sistema debe mostrar los trabajadores activos.
2. Debe identificar pagados y pendientes.
3. Debe excluir pagos duplicados.
4. Debe mostrar la cantidad de trabajadores pendientes.
5. Debe calcular el monto total.
6. La suma individual debe coincidir con el total mostrado.

---

## HU-08 – Registrar pago masivo de salud

**Como** usuario administrativo
**quiero** registrar el pago recibido de una feria
**para** aplicarlo a todos los trabajadores pendientes.

### Criterios de aceptación

1. Debe seleccionarse la feria y el período.
2. Debe mostrarse el monto esperado.
3. Deben ingresarse los datos del pago.
4. El sistema debe solicitar confirmación.
5. Se debe generar una operación masiva.
6. Debe crearse un movimiento individual por trabajador.
7. Todos los trabajadores incluidos deben quedar pagados.

---

## HU-09 – Evitar pagos parciales por error técnico

**Como** responsable financiero
**quiero** que el pago masivo se procese completamente o no se procese
**para** evitar inconsistencias.

### Criterios de aceptación

1. La operación debe ejecutarse dentro de una transacción.
2. Si falla un movimiento individual, todo debe revertirse.
3. No debe quedar el encabezado del pago sin detalles.
4. El usuario debe recibir un mensaje de error.
5. Debe registrarse el error técnico para revisión.

---

## HU-10 – Consultar detalle del pago masivo

**Como** usuario administrativo
**quiero** consultar el detalle de un pago de feria
**para** verificar los trabajadores incluidos.

### Criterios de aceptación

1. Debe mostrarse la información general del pago.
2. Deben listarse los trabajadores.
3. Debe mostrarse el monto aplicado a cada uno.
4. La sumatoria debe coincidir con el total.
5. Debe poder identificarse el usuario que registró la operación.

---

# ÉPICA 4 – Colecta y semanas adelantadas

## HU-11 – Registrar una colecta

**Como** usuario administrativo
**quiero** registrar el aporte semanal de un socio
**para** actualizar su ahorro y su estado de pago.

### Criterios de aceptación

1. Debe identificarse el expediente ahorrista.
2. Debe mostrarse la última semana pagada.
3. Debe proponerse la próxima semana pendiente.
4. El usuario debe ingresar el monto.
5. El sistema debe generar el movimiento.
6. Debe actualizarse el saldo.
7. No debe permitirse una semana duplicada.

---

## HU-12 – Pagar varias semanas por adelantado

**Como** socio ahorrista
**quiero** pagar varias semanas anticipadamente
**para** mantener mis obligaciones cubiertas.

### Criterios de aceptación

1. El usuario debe indicar la cantidad de semanas.
2. El sistema debe mostrar la semana inicial y final.
3. Debe calcular el total.
4. Debe generar un detalle por cada semana.
5. No debe solaparse con semanas pagadas.
6. Debe actualizar la próxima semana pendiente.

---

## HU-13 – Anular una colecta

**Como** usuario autorizado
**quiero** anular una colecta incorrecta
**para** corregir el saldo sin borrar la trazabilidad.

### Criterios de aceptación

1. Debe solicitarse el motivo.
2. La colecta debe cambiar a anulada.
3. El saldo debe recalcularse.
4. Las semanas deben recalcularse.
5. El movimiento original debe conservarse.
6. Debe registrarse auditoría.

---

# ÉPICA 5 – Préstamos

## HU-14 – Registrar préstamo

**Como** usuario administrativo
**quiero** registrar un préstamo para un socio
**para** controlar el monto otorgado y su devolución.

### Criterios de aceptación

1. Debe seleccionarse un socio ahorrista activo.
2. Debe registrarse el monto.
3. Debe definirse el número de cuotas.
4. Debe generarse el plan de pagos.
5. El préstamo debe iniciar con el estado correspondiente.
6. Debe registrarse el usuario responsable.

---

## HU-15 – Registrar pago de préstamo

**Como** usuario administrativo
**quiero** aplicar un pago a un préstamo
**para** actualizar sus cuotas y saldo pendiente.

### Criterios de aceptación

1. Debe seleccionarse un préstamo activo.
2. Debe mostrarse el saldo.
3. Debe mostrarse la próxima cuota.
4. El pago debe aplicarse a la cuota correspondiente.
5. El saldo debe actualizarse.
6. Cuando el saldo llegue a cero, el préstamo debe quedar pagado.

---

# ÉPICA 6 – Morosidad y suspensión

## HU-16 – Identificar socios morosos

**Como** usuario administrativo
**quiero** consultar las semanas pendientes de los socios
**para** realizar seguimiento antes de su suspensión.

### Criterios de aceptación

1. Debe calcularse la cantidad de semanas pendientes.
2. Debe mostrarse la última semana pagada.
3. Debe ordenarse por nivel de mora.
4. Debe poder filtrarse por estado.
5. Debe identificarse quién está próximo a la semana 41.

---

## HU-17 – Suspender automáticamente un socio

**Como** administrador
**quiero** que el sistema suspenda al socio cuando cumpla la regla de la semana 41
**para** aplicar uniformemente las normas de la cooperativa.

### Criterios de aceptación

1. El proceso debe validar la mora.
2. Debe cambiar el estado a suspendido.
3. Debe registrar fecha y motivo.
4. Debe conservar los movimientos anteriores.
5. Debe impedir las operaciones restringidas.
6. Debe generar un registro de auditoría.

---

## HU-18 – Reactivar socio suspendido

**Como** usuario autorizado
**quiero** reactivar a un socio que haya regularizado su situación
**para** permitirle continuar operando.

### Criterios de aceptación

1. Debe verificarse la condición de reactivación.
2. Debe solicitarse un motivo.
3. Debe registrarse el usuario.
4. El socio debe volver a activo.
5. La suspensión anterior debe permanecer en el historial.

---

# ÉPICA 7 – Reportes y control

## HU-19 – Consultar ferias pendientes

**Como** personal administrativo
**quiero** ver qué ferias deben el pago de salud
**para** realizar la gestión de cobro.

### Criterios de aceptación

1. Debe seleccionarse el período.
2. Deben mostrarse ferias pagadas y pendientes.
3. Debe mostrarse el monto pendiente.
4. Debe mostrarse la cantidad de trabajadores.
5. Debe poder exportarse el resultado.

---

## HU-20 – Consultar estado integral del socio

**Como** usuario administrativo
**quiero** consultar toda la información de un socio
**para** conocer su situación actual.

### Criterios de aceptación

La consulta debe mostrar por separado:

* Datos personales.
* Expediente como trabajador.
* Feria.
* Historial de salud.
* Expediente como ahorrista.
* Saldo de ahorro.
* Semanas pagadas.
* Semanas pendientes.
* Préstamos.
* Servicios contratados.
* Suspensiones y reactivaciones.

---

# ÉPICA 8 – Migración

## HU-21 – Importar datos del sistema anterior

**Como** administrador
**quiero** migrar la información existente
**para** comenzar a utilizar el nuevo sistema sin perder el historial.

### Criterios de aceptación

1. La importación debe validar los registros antes de guardarlos.
2. Debe evitar personas duplicadas.
3. Debe conservar los identificadores anteriores cuando sea posible.
4. Debe informar los errores.
5. Debe generar un resumen de resultados.
6. Los registros rechazados deben poder corregirse y volver a procesarse.

---

# ÉPICA 9 – Usabilidad

## HU-22 – Navegar formularios con Enter o Tab

**Como** usuario administrativo
**quiero** desplazarme entre los campos usando Enter o Tab
**para** registrar información más rápidamente.

### Criterios de aceptación

1. Enter y Tab deben mover el foco al siguiente campo.
2. Debe respetarse el orden visual.
3. Los campos deshabilitados deben omitirse.
4. Los botones peligrosos no deben ejecutarse accidentalmente.
5. En campos multilínea, Enter debe permitir un salto de línea.

---

# 19. Priorización recomendada

## Fase 1 – Operación inmediata

Prioridad crítica:

1. Personas y expedientes.
2. Socios ahorristas y trabajadores.
3. Ferias.
4. Pago masivo de salud.
5. Colecta.
6. Semanas pagadas por adelantado.
7. Préstamos.
8. Historiales básicos.
9. Migración de datos.
10. Auditoría financiera.
11. Navegación con Enter y Tab.

## Fase 2 – Control administrativo

1. Reportes avanzados.
2. Morosidad.
3. Suspensión automática.
4. Reactivación.
5. Anulación avanzada de operaciones.
6. Permisos detallados.

## Fase 3 – Automatización

1. Mensajería por WhatsApp.
2. Recordatorios preventivos.
3. Alertas automáticas.
4. Paneles de indicadores.
5. Automatización de cobranza.

---

# 20. Puntos que deben confirmarse con la cooperativa

Antes del desarrollo definitivo deben validarse los siguientes parámetros:

1. Valor exacto del servicio de salud.
2. Si el pago de salud se controla mensual o semanalmente.
3. Significado exacto de la regla de la semana 41.
4. Condiciones para reactivar a un socio.
5. Valor mínimo o fijo de la colecta.
6. Numeración oficial de las semanas.
7. Reglas de intereses y cuotas de préstamos.
8. Manejo de pagos parciales.
9. Condiciones para adquirir funeraria.
10. Si el período de prueba de tres meses se calcula por días calendario o por meses completos.
11. Si un trabajador retirado conserva temporalmente el servicio de salud.
12. Permisos exactos de cada tipo de usuario.
