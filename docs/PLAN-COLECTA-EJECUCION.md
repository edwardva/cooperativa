# Plan de ejecución — Requisitos de Colecta (reunión con el cliente)

Origen: `docs/PLAN_COLECTA.txt`.
Contraste hecho contra el código real: `backend/src/controllers/colectaController.ts`,
`backend/prisma/schema.prisma`, `frontend/src/pages/ColectaPage.tsx`.

---

## Diagnóstico: qué ya existe y qué falta

Buena parte del rediseño que pide el cliente **ya está hecho**: la búsqueda única
por cédula/expediente que devuelve todo lo cobrable, el carrito, la colecta en
una sola transacción, el reverso con rastro, el cierre de caja y los reportes por
servicio. Eso se conserva.

El hallazgo importante es otro:

> **El sistema mide la deuda con un contador (`semanas_sin_pago`), no con una
> cobertura (año + semana hasta la que pagó).**

Un contador no puede expresar «pagó hasta la semana 3 de 2027». Por eso hoy es
imposible, sin tocarlo:

- mostrar «año y semana hasta los que tiene pagado cada servicio» (req. 1);
- cobrar semanas del año siguiente y cruzar diciembre→enero (req. 3);
- distinguir *fecha en que pagó* de *hasta cuándo quedó cubierto* (req. 1);
- calcular suspensión con adelantos por medio (req. 8);
- reportar «hasta qué semana pagó» por socio (req. 9).

**Todo el bloque 1 + 3 + 8 + 9 depende de un solo cambio de modelo.** Es la
primera pieza del plan y la que desbloquea el resto.

---

## Estado

| Fase | Estado |
|---|---|
| 0 — Cimientos | ✅ hecha |
| 1 — Motor de cobro | ✅ hecha |
| 2 — Pantalla única | ✅ hecha |
| 3 — Estado y suspensión | ✅ hecha |
| 4 — Reportes y caja | ✅ hecha |
| 5 — Exportación funeraria | ⏳ pendiente (bloqueada por el archivo de ejemplo) |
| 6 — Préstamos | ⏳ pendiente |
| 7 — Asambleas | ⏳ pendiente |
| 8 — Cajero digital | ⏳ pendiente |

---

## Fases

Orden por dependencia técnica, no por número de requisito.

### Fase 0 — Cimientos (bloquea casi todo)

| # | Entregable | Requisito |
|---|---|---|
| 0.1 | `utils/calendarioSemanal.ts`: semana ordinal absoluta, `(año,semana) ↔ ordinal`, sumar/restar semanas, semana actual. Aritmética que cruza años sin casos especiales. | 3 |
| 0.2 | Migración de esquema: cobertura `ano_pagado_hasta` / `semana_pagada_hasta` / `fecha_ultimo_pago` en acuerdos de funeraria y salud; tarifas y cobertura en `DetalleColecta`; `fecha_ultimo_abono` en préstamo; `es_trabajador` en socio. | 1, 3, 5, 7 |
| 0.3 | Autogeneración de semanas de colecta del año siguiente (job + al vuelo). **Elimina la dependencia del técnico cada diciembre.** | 3 |
| 0.4 | Parámetros de tarifa semanal: `TARIFA_AHORRO_SEMANAL_USD`, `TARIFA_FUNERARIA_SEMANAL_USD`, `TARIFA_SALUD_SEMANAL_USD`, `MAX_SEMANAS_ADELANTO`, `SEMANAS_SUSPENSION_*`. Servicio central `tarifasService`. | 2 |
| 0.5 | Backfill: derivar la cobertura inicial de cada acuerdo desde `semanas_sin_pago`, para no perder el estado actual. | 0.2 |

### Fase 1 — Motor de cobro (backend)

| # | Entregable | Requisito |
|---|---|---|
| 1.1 | `services/cobroSemanalService.ts`: dado un socio y N semanas, arma el paquete (ahorro obligatorio + servicios contratados), con desglose y totales USD/Bs. | 1, 2 |
| 1.2 | Regla de integridad: si tiene ambos servicios, se cobran ambos + ahorro; no se admite pagar sólo uno. Validado en el backend, no sólo en pantalla. | 1 |
| 1.3 | Adelantos: pendientes + adelantadas suman. Límite `MAX_SEMANAS_ADELANTO` (10) como **advertencia**, no bloqueo. *(pendiente de confirmar con el cliente)* | 1 |
| 1.4 | `buscarSocioParaColecta` enriquecido: cobertura por servicio, fecha de último pago, semanas pendientes, estado, préstamos con fecha de último abono, movimientos recientes de ahorro. | 1, 5 |
| 1.5 | `registrarColecta`: avanza cobertura por (año, semana) en vez de decrementar contador; guarda tasa y tarifas aplicadas en cada detalle. | 1, 2, 3 |
| 1.6 | Ahorro voluntario en el mismo cobro + depósitos independientes en Bs y divisas, sin límite de monto. | 4 |
| 1.7 | Reverso: retrocede la cobertura exactamente a donde estaba, usando lo guardado en el detalle. | 6 |

### Fase 2 — Pantalla única de colecta (frontend)

| # | Entregable | Requisito |
|---|---|---|
| 2.1 | Cabecera del socio: identificación, servicios, saldo de ahorro, año/semana actual, y por servicio: último pago, cubierto hasta, semanas pendientes, estado. Un resumen por servicio, no una fila por semana. | 1 |
| 2.2 | Campo «semanas a pagar» → desglose calculado (ahorro / funeraria / salud / total), tarifas de sólo lectura. | 1, 2 |
| 2.3 | Acciones sin cambiar de pantalla: ahorro adicional, depósito Bs/divisas, abono a préstamo, historial completo paginado. | 1, 4, 5 |
| 2.4 | Presentación de importes: montos grandes completos, con dos decimales, sin recorte. | 5, 12 |

### Fase 3 — Estado y suspensión

| # | Entregable | Requisito |
|---|---|---|
| 3.1 | Estado derivado de la cobertura (vigente / atrasado / suspendido), con umbral por parámetro y por servicio. Corrige el caso que el personal marcó como incorrecto. | 8 |
| 3.2 | Job semanal reescrito: deja de incrementar un contador; recalcula contra la semana actual. Cubre funeraria además de salud. | 8 |

### Fase 4 — Reportes y caja

| # | Entregable | Requisito |
|---|---|---|
| 4.1 | Reporte por concepto con socio, nombre, número de acuerdo, año/semana pagada hasta, importe, totales y **cantidad de personas**. | 9 |
| 4.2 | Filtros por día, rango y mes (ingreso mensual de salud sin sumar a mano). | 9 |
| 4.3 | Caja por oficina / colector / canal + consolidado, con nombres en el detalle. | 9 |

### Fase 5 — Exportación funeraria

| # | Entregable | Requisito |
|---|---|---|
| 5.1 | Exportación de pagos de funeraria por fecha o rango, descargable. Formato **configurable por parámetro** mientras no llegue el archivo real de ejemplo. | 10 |

### Fase 6 — Préstamos

| # | Entregable | Requisito |
|---|---|---|
| 6.1 | Fecha de último abono, categoría, pagaré, moneda y saldo en la pantalla principal. | 5 |
| 6.2 | Restricciones: no dos préstamos activos de efectivo, ni dos de línea blanca; socio trabajador / no trabajador. | 5 |
| 6.3 | Fiadores: monto garantizado, bloqueo en el ahorro del fiador, advertencia al retirar, reflejo en el pagaré. | 5 |

### Fase 7 — Asambleas

| # | Entregable | Requisito |
|---|---|---|
| 7.1 | Registro de asistencia sí/no que efectivamente persiste, por jornada y sector, permitiendo asistir en jornada distinta. Una asamblea anual, varias jornadas. | 11 |

### Fase 8 — Cajero digital

| # | Entregable | Requisito |
|---|---|---|
| 8.1 | Montos completos con dos decimales, campos adaptables, canal identificado en los movimientos, consistencia con cobertura y reportes. | 12 |

### Hallazgos durante la ejecución

Cosas que no estaban en los requisitos y aparecieron al contrastar con el código:

- **Historial de migraciones roto.** Una migración figuraba como fallida y tres
  nunca se aplicaron, pese a que otras posteriores sí. La base local carecía de
  columnas de salud (`numero_acuerdo`, `numero_recibo`) que el código ya usaba.
  Reparado; las migraciones nuevas van con `IF NOT EXISTS` para nivelar la
  deriva en cualquier entorno.
- **Un expediente numérico no se podía buscar.** Todo término de sólo dígitos se
  interpretaba como cédula, y los expedientes también son numéricos. Ahora se
  buscan ambos.
- **El reverso dejaba en pie la fecha del último pago** y no deshacía el abono a
  préstamo. Los movimientos de servicio no sabían de qué colecta venían;
  se agregó `colecta_id` y `reversado`.
- **Las tarifas del catálogo no coinciden con las del cliente.** El plan
  funerario cobra USD 5,00/semana en `tipos_acuerdo_funeraria`, frente a los
  0,75 que mencionó el cliente. La tarifa del plan manda sobre la general, así
  que **hay que confirmar los valores del catálogo antes de operar**.
- **El job semanal habría duplicado el atraso.** Sumaba 1 al contador cada
  lunes; con la cobertura como fuente de verdad eso pasó a estar mal. Reescrito
  para recalcular.

### Fuera de alcance por ahora

- **Integración contable (req. 13)**: falta sistema de destino, plan de cuentas y
  aprobación del responsable contable. Se conserva el asiento contable actual.
- **Envío automático de correos a la funeraria**: el cliente no lo pidió.
- **Tolerancias automáticas de céntimos en el portal**: el cliente no las autorizó.

---

## Pendientes de confirmar con el cliente

No se convierten en reglas hasta que el cliente responda. Se implementan como
**parámetro configurable** con un valor por defecto razonable, para no bloquear.

| Tema | Pregunta | Valor por defecto asumido |
|---|---|---|
| Adelantos | ¿Bloquear >10 semanas, advertir, o permitir excepción autorizada? | Advertir, no bloquear (`MAX_SEMANAS_ADELANTO=10`) |
| Calendario | Día de inicio de semana y años de 53 semanas | Semana inicia lunes; se admiten 53 |
| Tarifa de atrasos | ¿Semanas atrasadas y adelantadas se cobran a la tarifa vigente al pagar? | Sí, tarifa vigente al momento del cobro |
| Tasa | Redondeo, decimales, y qué usar si el lunes no hay publicación | 4 decimales; se conserva la última conocida |
| Valores iniciales | Confirmar 0,03 / 0,75 / 0,96 USD | Se cargan como parámetro, editables |
| Suspensión | Cuántas semanas suspenden; ¿igual para salud y funeraria? | Por parámetro, uno por servicio |
| Cuentas de ahorro | ¿Siguen operativos los códigos 01 / 12 / 02? | Se conservan los tipos existentes |
| Sector vs. feria | ¿Campos separados o una sola codificación? | Hoy comparten `ubicacion`; se separa si confirma |
| Préstamos | Periodicidad de 21 días: ¿aplica a todos? ¿se recalcula desde cada abono? | No se implementa hasta confirmar |
| Números de acuerdo | Formato exacto, posición del cero, longitud | No se genera automáticamente hasta confirmar |
| Exportación funeraria | **Archivo real de ejemplo** (columnas, extensión, codificación) | Formato configurable, CSV por defecto |
| Cierre de caja | ¿Es sólo un reporte o bloquea movimientos? | Hoy bloquea el reverso; se conserva |
| Personas atendidas | ¿Cómo se cuenta un socio con varias operaciones? | Socios distintos, no operaciones |

---

## Escenarios de validación (req. 14)

Se cubren con pruebas automatizadas donde aplique, y quedan como guion de prueba
con el personal:

1. Socio con salud y funeraria / socio con un solo servicio.
2. Semanas pendientes y adelantadas.
3. Una pendiente + diez adelantadas = once.
4. Pago que cruza de diciembre a enero.
5. Ahorro adicional y depósito de importe alto.
6. Depósito en divisas.
7. Abono a préstamo desde la consulta del socio.
8. Reverso completo de colecta y reverso de abono.
9. Cuadre por oficina y consolidado.
10. Reporte mensual de salud.
11. Exportación funeraria.
12. Asistencia a asamblea registrada.
13. Montos grandes en el portal digital.
