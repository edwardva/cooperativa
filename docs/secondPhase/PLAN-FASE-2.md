# Plan de la segunda fase

Contrasta [requirement.md](requirement.md) y [histories.md](histories.md) con el código
al 12/09/2026 (commit `55ef07b`). Para cada historia dice qué existe, qué hay que corregir
y qué falta construir.

Leyenda: ✅ hecho · 🟡 parcial o hecho de otra forma · ❌ no existe

---

## 1. Diagnóstico en una página

El sistema actual está **organizado alrededor del socio ahorrista**: `Socio` es a la vez
persona y expediente, y todo cuelga de él (ahorro, funeraria, salud voluntaria,
préstamos, colecta). Esa parte está bastante madura: la colecta unificada con cobertura
`(año, semana)`, el reverso, el cierre de caja y los préstamos con plan de cuotas ya
funcionan en producción.

Lo que la segunda fase agrega y **no existe en absoluto** es el otro eje:

| Falta | Por qué es estructural |
|---|---|
| `Persona` separada del expediente | Hoy la cédula se repite en cada fila de `socios`; no hay dónde colgar un segundo rol |
| Socio trabajador | Solo existe el booleano `Socio.es_trabajador`; no hay fecha de ingreso laboral, período de prueba ni estado propio |
| Historial trabajador ↔ feria | `Socio.ubicacion_id` guarda la feria actual y la pisa al cambiar |
| Pago masivo de salud por feria | La salud actual es voluntaria, por grupo de beneficiarios, y se cobra en colecta |
| Suspensión y reactivación **del socio** | Hoy se suspenden acuerdos de servicio, no el expediente, y sin tabla de historial |

**Recomendación central:** no reescribir `Socio`. Agregar `Persona` por encima y
`SocioTrabajador` al lado, y dejar `Socio` como *el expediente ahorrista*. Así los
~17.000 líneas de pantallas y controladores actuales siguen funcionando y la fase 2 se
construye sin frenar la operación. El detalle está en la sección 3.

---

## 2. Estado por historia

### Épica 1 · Personas y expedientes

| HU | Estado | Qué hay | Qué falta o hay que corregir |
|---|---|---|---|
| HU-01 Registrar persona | 🟡 | Validación de cédula (`utils/cedula.ts`), bloqueo de **dos expedientes activos** con la misma cédula (`sociosController.ts` → `buscarExpedientesActivosConCedula`) | No hay tabla `personas`; la cédula no es única en BD. Falta `tipo_identificacion`, `created_by`. El bloqueo es solo en código, sin constraint: dos altas simultáneas pasan |
| HU-02 Socio ahorrista | ✅ | Alta con código de expediente, fecha de inscripción, cuenta de ahorro, funeraria y salud opcionales | Enganchar a `persona_id` cuando exista `Persona` |
| HU-03 Socio trabajador | ❌ | Solo `es_trabajador: boolean` (condiciona categorías de préstamo) | Todo: entidad, fecha de ingreso, feria obligatoria, salud automática |
| HU-04 Ahorrista desde trabajador | ❌ | — | Depende de HU-03. Advertencia de 3 meses de prueba |

### Épica 2 · Ferias

| HU | Estado | Qué hay | Qué falta o hay que corregir |
|---|---|---|---|
| HU-05 Administrar ferias | 🟡 | `Ubicacion` = feria: CRUD, código único, activar/desactivar (el DELETE es lógico), `FeriasPage.tsx`, conteo de socios | Faltan `responsable`, `observaciones`, `ubicacion`. El conteo es de **socios**, no de trabajadores activos |
| HU-06 Trasladar trabajador | ❌ | `/socios/:id/traspaso` existe pero es **otra cosa**: traspaso del expediente a un familiar | Tabla de historial con fecha inicio/fin y motivo; hoy cambiar `ubicacion_id` borra la feria anterior |

### Épica 3 · Pago de salud por feria

| HU | Estado | Qué hay | Qué falta |
|---|---|---|---|
| HU-07 Deuda de salud de una feria | ❌ | — | Todo |
| HU-08 Pago masivo | ❌ | — | Todo |
| HU-09 Atomicidad | ❌ | El patrón `$transaction` ya se usa bien en colecta y préstamos | Aplicarlo aquí |
| HU-10 Detalle del pago | ❌ | — | Todo |

> La salud **voluntaria** (acuerdos por grupo de hasta 9 personas, `SaludPage.tsx`, pagos
> vía colecta) ya está hecha y no se toca. La salud **del trabajador** es un circuito
> nuevo, con tablas propias, para cumplir RF-SER-06 y RF-COL-07 (no mezclar cobros).

### Épica 4 · Colecta y semanas adelantadas

Es el módulo más avanzado. Ya supera en varios puntos al backlog técnico.

| HU | Estado | Qué hay | Qué falta o hay que corregir |
|---|---|---|---|
| HU-11 Registrar colecta | ✅ | Pantalla única, paquete semanal (ahorro + servicios contratados), tarifas congeladas en la colecta, movimiento por servicio, saldo actualizado, todo en transacción | **Búsqueda por nombre** (hoy solo cédula o expediente, RF-COL-02). **Bloqueo de concurrencia**: no hay `SELECT … FOR UPDATE`; dos cajeros cobrando al mismo socio a la vez leen la misma cobertura y pueden cubrir la misma semana dos veces |
| HU-12 Semanas adelantadas | ✅ | `semanas_cobradas` + cobertura `(año, semana)` antes/después por renglón. Cruza año correctamente (`calendarioSemanal.ts`, con tests). No puede solapar: siempre arranca en cobertura + 1 | Vista "detalle de cada semana pagada" (RF-ADE-05): se deriva de `cobertura_*_antes/despues`, no hace falta la tabla `colecta_semanas` del backlog |
| HU-13 Anular colecta | ✅ | Reverso con motivo, usuario y fecha; restaura cobertura exacta; bloquea si la colecta ya entró en un cierre de caja | Pedir confirmación con **impacto visible** (FE-015); verificar que registre en `audit_log` |

**Decisión recomendada sobre `colecta_semanas`:** no crearla. El modelo de cobertura
ya garantiza semanas consecutivas y sin duplicados, y es la fuente de verdad que usa el
cálculo de atraso. Una segunda representación por semana tendría que mantenerse
sincronizada y abre la puerta a que discrepen. Lo que sí hace falta es el bloqueo de
fila del punto anterior.

### Épica 5 · Préstamos

| HU | Estado | Qué hay | Qué falta o hay que corregir |
|---|---|---|---|
| HU-14 Registrar préstamo | 🟡 | Simulación, alta con tipo, fiadores con bloqueo de ahorro, plan de cuotas, número correlativo, moneda BS/USD | **No hay flujo de aprobación**: nace `activo`. Estados del spec `solicitado`/`aprobado` no existen (hay `activo, saldado, moroso, refinanciado, cancelado`). Validar socio ahorrista **activo** |
| HU-15 Pagar préstamo | 🟡 | Abono en transacción, aplica a cuotas, libera fiadores al saldar, recalcula mora | **Reverso de abono**: el schema tiene `reversado`, `motivo_reverso`, `reversado_por`, pero **no hay endpoint** (RF-PRE-08). Sin bloqueo de concurrencia. No está en el carrito de colecta |

### Épica 6 · Morosidad, suspensión, reactivación

| HU | Estado | Qué hay | Qué falta |
|---|---|---|---|
| HU-16 Identificar morosos | 🟡 | `estadoServiciosService.ts` calcula atraso desde la cobertura (bien resuelto: no marca como moroso al que pagó adelantado) | Es **por acuerdo de servicio**, no por expediente. Falta pantalla de morosidad ordenada por riesgo |
| HU-17 Suspensión automática | 🟡 | Job semanal que suspende acuerdos al llegar a un umbral; **desactivado a propósito** (`SUSPENSION_AUTOMATICA`) porque la cooperativa no confirmó el número | Regla de la semana 41 sin definir (pendiente 3 de la sección 20). Suspender el **socio**, tabla `historial_estado_socio`, estado `suspendido` en `EstadoSocio` (hoy: `activo, retirado, invalido`) |
| HU-18 Reactivación | 🟡 | Cargo de reintegro en colecta (`DetalleColecta.es_reintegro`) que reactiva el acuerdo | Reactivación del socio con motivo, condiciones y historial |

### Épica 7 · Reportes

| HU | Estado | Qué hay | Qué falta |
|---|---|---|---|
| HU-19 Ferias pendientes | ❌ | Motor Excel + PDF genérico (`reportesService.ts`) reutilizable | El reporte (depende de épica 3) |
| HU-20 Estado integral del socio | 🟡 | La pantalla de colecta ya junta ahorro, servicios, movimientos y cobertura | Ficha 360° por **persona** con pestañas separadas por expediente |
| RF-REP-04 a 07 | 🟡 | Colecta por servicio/caja/oficina, cartera de préstamos (JSON), salud y funeraria suspendidos | Semanas adelantadas, socios suspendidos, cartera exportable a Excel/PDF |

### Épicas 8 a 12 · Transversales

| Tema | Estado | Qué hay | Qué falta o hay que corregir |
|---|---|---|---|
| Migración | 🟡 | Socios, ferias, ahorro (saldos + PoC de historial), funeraria, beneficiarios, salud; reportes de rechazados | **Préstamos y abonos**, **colectas históricas**, trabajadores. No hay columna de trazabilidad con el ID del legacy (RF-MIG-05); hoy solo se conserva `codigo_socio`. Los scripts son sueltos y numerados con colisiones (dos `20-`, dos `21-`, dos `22-`) |
| Auditoría | 🟡 | `AuditLog` con antes/después, IP y user agent; 33 escrituras en 7 controladores | Sin servicio central (cada controlador escribe a mano), sin pantalla de consulta (FE-025) |
| Permisos | 🟡 | `Rol.permisos` JSON módulo → acciones, middleware `authorize` con caché | Acciones finas del spec (`anular`, `reactivar`, `exportar`, `auditoria`); hoy anular colecta cuelga de `colecta:delete`. Ocultar botones sin permiso en el front |
| Enter / Tab | 🟡 | Atajos puntuales en 7 páginas (Enter busca, Ctrl+Enter cobra, F2) | Hook reutilizable (FE-022); `SociosPage` no tiene nada |
| Mensajería | ❌ | — | Fase 3 según el propio documento |
| Pruebas | 🟡 | Jest con 3 suites unitarias (cobertura, paquete semanal, calendario) | Ninguna prueba de integración de las transacciones (QA-009, QA-FIN-*) |

---

## 3. Arquitectura propuesta: Persona ≠ expediente sin reescribir

```text
Persona (nueva)                     cédula ÚNICA
 ├── Socio (existente)              = expediente AHORRISTA, + persona_id
 │    ├── CuentaAhorro, Colecta, Prestamo, Beneficiario…   (sin cambios)
 │    └── HistorialEstadoSocio (nueva)
 └── SocioTrabajador (nueva)        = expediente TRABAJADOR
      ├── TrabajadorFeria (nueva)   historial con fecha_inicio / fecha_fin / motivo
      └── PagoSaludTrabajador (nueva)
                   └── PagoSaludFeria (nueva)   encabezado del pago masivo

Ubicacion (existente) = Feria       + responsable, observaciones
```

Por qué así y no como dice el backlog técnico al pie de la letra:

1. **Renombrar `Socio` → `SocioAhorrista` y mover los datos personales** tocaría todos
   los controladores y pantallas actuales a la vez, en un sistema que ya está en
   producción. Agregar `persona_id` es aditivo y se puede desplegar sin cortar la
   operación.
2. **Los datos personales quedan duplicados un tiempo** en `socios` y `personas`.
   Se aceptan como deuda: `Persona` pasa a ser la fuente de verdad para altas nuevas y la
   ficha 360°, y las columnas viejas se retiran en una fase posterior.
3. **`Ubicacion` ya es la feria** en datos y en pantalla (`/ubicaciones` redirige a
   `/ferias`). Se extiende, no se duplica.

### Backfill de `Persona`

- Agrupar `socios` por cédula normalizada; una persona por grupo, con los datos del
  expediente más reciente.
- Cédulas inválidas o vacías (hay análisis previo en
  `scripts/migracion/data/ANALISIS-CEDULAS-INVALIDAS.md`): persona propia marcada para
  revisión, nunca fusionadas a ciegas.
- Generar reporte de grupos con nombres distintos bajo la misma cédula antes de aplicar.
- La migración debe correrse con el rol dueño de las tablas (`postgres`), no con el de la
  app.

### Pago masivo de salud: puntos de diseño

- **Período**: tabla `periodos_salud` solo si se confirma control **semanal**; si es
  mensual basta `(año, mes)` en el encabezado. Es el pendiente 2 de la sección 20 y
  cambia el modelo, así que se confirma **antes** del sprint.
- **Unicidad**: índice único parcial
  `(trabajador_id, año, periodo) WHERE estado <> 'anulado'`. Prisma no expresa índices
  parciales: va en SQL crudo dentro de la migración.
- **Monto**: el backend recalcula la deuda al confirmar; nunca confía en el total que
  manda el front (BE-009).
- **Feria histórica**: `PagoSaludTrabajador` guarda `feria_id` del momento (RN-14), no
  se lee de la asociación actual.
- **Concurrencia**: bloquear el encabezado de feria/período dentro de la transacción para
  que dos usuarios no paguen el mismo período a la vez (QA-008).

---

## 4. Mejoras a lo existente (hacer primero, son baratas)

Ordenadas por riesgo que eliminan.

| # | Mejora | Riesgo que cubre | Esfuerzo |
|---|---|---|---|
| M1 ✅ | Bloqueo de fila (`SELECT … FOR UPDATE` sobre cuenta y acuerdos) al registrar colecta y abono | Semana cobrada dos veces / cuota aplicada dos veces por dos cajeros simultáneos (RF-COL-08, QA-FIN-03) | S |
| M2 ✅ | Endpoint y botón de **reverso de abono** de préstamo; el schema ya lo soporta | Hoy un abono mal cargado no tiene corrección (RF-PRE-08) | S |
| M3 ✅ | Servicio central `auditoria.registrar(tx, …)` y reemplazar las 33 escrituras manuales | Operaciones sin auditar por olvido; auditoría fuera de la transacción | S |
| M4 ✅ | Búsqueda por nombre en colecta | RF-COL-02 | S |
| M5 ✅ | Ferias: `responsable`, `observaciones`, conteo de trabajadores activos | HU-05 | S |
| M6 ✅ | Hook `useEnterNavigation` y aplicarlo a los formularios de alta | HU-22 | S |
| M7 | Constraint de cédula (tras crear `Persona`) | Duplicados por altas simultáneas | parte de Sprint A |
| M8 | Renumerar scripts de migración y agregar columna `legacy_id` / `origen` en tablas migradas | RF-MIG-05, reprocesar rechazados | M |
| M9 | Pruebas de integración de colecta y reverso contra una BD de test | Hoy nada protege las transacciones ante refactors | M |

### Avance al 12/09/2026: M1 a M4 hechas

| Mejora | Qué quedó |
|---|---|
| M1 | `utils/bloqueos.ts`: `SELECT … FOR UPDATE` sobre el socio al inicio de la transacción, y relectura después. Aplicado en colecta, reverso de colecta, abono, reverso de abono, alta de préstamo (deudor y fiadores), movimiento de ahorro y pago de grupo de salud |
| M2 | `POST /api/prestamos/:id/abonos/:abonoId/reversar` (permiso `prestamos:delete`), con motivo obligatorio, modal de impacto y abonos reversados visibles en la ficha. Migración `20260912000000_abono_prestamo_colecta` agrega `abonos_prestamo.colecta_id` y la completa desde el concepto |
| M3 | `services/auditoriaService.ts` reemplaza las 33 escrituras manuales; no guarda binarios (la foto del socio entraba entera en el JSON) |
| M4 | La colecta busca por nombre y apellido en cualquier orden, desde 3 letras, hasta 20 resultados con aviso de que hay más |

Verificado contra la base local con los controladores reales: dos cobros, dos abonos o dos reversos simultáneos ya no se pisan; sin el bloqueo, 5 escrituras concurrentes dejaban 1.

**Hallazgos corregidos en el camino**

- El abono cobrado en **colecta** saldaba el préstamo sin liberar a los fiadores y sin marcar ninguna cuota.
- Las cuotas se marcaban solo si **un** abono cubría la cuota entera: dos medios pagos la dejaban pendiente. Ahora el estado se recalcula desde el total abonado vigente. **Efecto al desplegar:** el primer abono o reverso de un préstamo existente puede marcar como pagadas cuotas que ya estaban cubiertas.
- El alta de préstamo bloqueaba **de menos** el ahorro del fiador, sin avisar, si el saldo había bajado entre la validación y la transacción. Ahora lo rechaza.

**Decisión a confirmar con la cooperativa**

- Un reverso (de abono o de colecta) sobre un préstamo **saldado cuyos fiadores ya fueron liberados** se rechaza y pide un ajuste. Antes el reverso de colecta reabría la deuda y los fiadores quedaban sin garantía. La alternativa es volver a bloquearles el ahorro, que puede fallar si ya lo retiraron.

**Sigue pendiente**

- Varias auditorías de socios, salud y funeraria se escriben **fuera** de la transacción de la operación. Con el servicio central ya es un cambio de una línea por caso.
- `npm run lint` del frontend no corre: el repositorio no tiene configuración de ESLint.
- La búsqueda por nombre distingue acentos ("maria" no encuentra "María"). Los datos migrados vienen en mayúsculas sin acentos, así que hoy no afecta.

---

## 5. Plan de sprints

Sprints de 2 semanas. El orden sigue la priorización del documento (P0 primero) con dos
ajustes: las mejoras baratas van al principio porque protegen lo que ya está en
producción, y préstamos va antes que salud masiva porque ya está a medio camino.

### Sprint 0 · Confirmaciones y endurecimiento (1 semana)

- Reunión con la cooperativa para cerrar los **12 pendientes** de la sección 20. Los que
  bloquean diseño: período de salud (2), regla de la semana 41 (3), condiciones de
  reactivación (4), estados y aprobación de préstamos (7), prueba en días o meses (10),
  salud del trabajador retirado (11).
- Revisar en el sistema legacy si ya existen trabajadores de feria y pagos de salud
  masivos, y con qué campos (define si hay datos que migrar para la épica 3).
- ✅ M1, M2, M3, M4 (12/09/2026, ver sección 4).

**Entregable:** decisiones escritas; colecta y abonos sin carrera; auditoría central.

### Sprint A · Persona, trabajador y ferias ✅

- DB: `personas`, `Socio.persona_id`, `socios_trabajadores`, `trabajador_feria`,
  campos nuevos en `ubicaciones`. Backfill con reporte previo.
- BE: `POST/GET /personas`, detección de existente, `POST /trabajadores`,
  `POST /trabajadores/:id/crear-expediente-ahorrista` (advertencia de prueba),
  `POST /trabajadores/:id/traslado-feria` en transacción.
- FE: alta de persona con detección de cédula existente y "agregar rol"; ficha de
  trabajador con fin de prueba y elegibilidad; modal de traslado; M5, M6.
- QA: una sola feria activa por trabajador (QA-FIN-06), persona no duplicada por dos
  roles (QA-FIN-07).

**Avance al 12/09/2026: Sprint A hecho (backend, pantallas y pruebas)**

| Parte | Qué quedó |
|---|---|
| Datos | Migración `20260913000000_personas_trabajadores`: `personas` (identificación única), `socios.persona_id`, `socios_trabajadores`, `trabajador_feria`, campos nuevos en `ubicaciones`. Índices únicos parciales: una persona no tiene dos expedientes de trabajador sin retirar, y un trabajador tiene una sola feria abierta |
| API | `/api/personas` (búsqueda, consulta por identificación, ficha, alta, edición) y `/api/trabajadores` (listado con los filtros de RF-FER-06, ficha, alta, edición, `traslado-feria`, `retiro`). Traslado y retiro bloquean el expediente, igual que en M1 |
| Socios | Alta y edición vinculan el socio a su persona en la misma transacción y copian los datos personales en los dos sentidos. Si la cédula es de alguien con otro nombre, no vinculan y avisan. Si la persona es trabajador en prueba, avisan (HU-04.6) |
| Pantallas | Nueva **Trabajadores**: listado con filtros, alta que empieza por la identificación, ficha con salud, prueba, historial de ferias y "Inscribir como ahorrista", y modales de traslado y retiro. **Ferias**: el alta, que antes mostraba "en desarrollo", más edición completa, activar y desactivar, y trabajadores activos. **Socios**: al salir del campo cédula muestra si la persona ya existe y completa sus datos |
| Existentes | `prisma/backfill-personas.ts` crea las personas de los socios actuales. Sin `--aplicar` solo simula y escribe el reporte. Deja para revisión las cédulas inválidas y las que tienen nombres distintos |
| Pruebas | 12 tests unitarios nuevos (período de prueba y comparación de nombres) y 42 chequeos de punta a punta contra la base local. Incluyen altas y traslados simultáneos, el historial, el conteo por feria y el script de personas |

Supuestos tomados mientras la cooperativa no confirme (sección 20):

- **Prueba (pendiente 10) · resuelto el 2026-09-16:** son 90 días, pero **no los controla el sistema**: la feria manda al trabajador a inscribirse como ahorrista. Se quitaron el aviso al inscribirlo, la columna de prueba y el parámetro `MESES_PRUEBA_TRABAJADOR` (2026-09-17).
- **Salud del trabajador (pendiente 11) · confirmado el 2026-09-16:** se **deriva**; no es una tabla. La tiene el trabajador activo con feria; el suspendido y el retirado no. Si además es socio de El Triunfo, sigue pagando sus servicios como socio.
- **Traslado:** la feria anterior cierra y la nueva abre el mismo día. El Sprint B tiene que decidir a qué feria le toca ese período.
- **Reingreso:** quien vuelve a trabajar recibe un expediente nuevo; el retirado conserva su historial.

**Pasos para desplegar el Sprint A, en orden**

1. Migraciones con el rol dueño (`postgres`): `20260912000000_abono_prestamo_colecta` y `20260913000000_personas_trabajadores`.
2. `npx tsx prisma/sincronizar-permisos.ts --aplicar`: agrega los módulos `personas` y `trabajadores` a los roles. Después, reiniciar el backend, porque los permisos se cachean.
3. `npx tsx prisma/backfill-personas.ts`: simulación. **Revisar el reporte** con la cooperativa antes de seguir.
4. `npx tsx prisma/backfill-personas.ts --aplicar`.

**Pendiente del Sprint A**

- **Revisar el sistema viejo:** no pude ver si ya registra trabajadores de feria, porque el acceso con las credenciales de los scripts fue bloqueado en esta sesión. Si existen, falta migrarlos (Sprint D).
- **Revisión visual:** las pantallas nuevas compilan y el build pasa, pero no se probaron en el navegador.
- ✅ **Navegación con Enter (FE-023):** aplicada en todos los `Modal` y `Drawer` del sistema, lo que cubre Salud, Funeraria y los demás que los usan. También en los modales propios de Préstamos, Asambleas y el cierre de caja, en el alta de Socios y Trabajadores, en Ferias y en la apertura de cuenta de Ahorro, donde Enter ya no envía el formulario por accidente. Los buscadores con Enter propio llevan `data-enter-propio`. La pantalla de cobro de Colecta conserva su flujo de teclado (Enter busca, Ctrl+Enter cobra, F2 vuelve), que ya es más rápido que ir campo por campo.
- `prisma/seed.ts` no incluye los módulos nuevos; para bases nuevas hay que correr el script de permisos.

### Sprint B · Pago de salud por feria ✅

- DB: `pagos_salud_feria`, `pagos_salud_trabajador`, índice único parcial.
- BE: deuda por feria y período, pago masivo transaccional, detalle, anulación con motivo
  que devuelve los períodos a pendiente.
- FE: pantalla con filtros, resumen, tabla, confirmación "X pagos por Y", detalle,
  historial por feria/trabajador/período/referencia.
- QA: fallo forzado en el trabajador N → cero registros (QA-009); suma de detalles =
  encabezado (QA-FIN-01); dos usuarios pagando a la vez.

**Avance al 13/09/2026: Sprint B hecho (backend, pantalla y pruebas)**

| Parte | Qué quedó |
|---|---|
| Datos | Migración `20260914000000_pago_salud_feria`: `periodos_salud` (cada período lleva su tipo, mensual o semanal), `pagos_salud_feria` (encabezado con tarifa, tasa, esperado, recibido, método, referencia, usuario y anulación) y `pagos_salud_trabajador` (un renglón por trabajador, con la feria de ese período guardada, RN-14). Un índice único parcial impide dos renglones vigentes del mismo trabajador y período (RN-10) |
| API | `/api/salud-feria`: configuración, deuda por feria y período (HU-07), registro del pago masivo (HU-08/09), detalle (HU-10), historial con filtros por feria, período, estado, referencia y trabajador (RF-SAL-14), historial por trabajador, anulación con motivo (RF-SAL-15) y ferias pendientes (HU-19) |
| Integridad | El pago bloquea la feria, **recalcula la deuda** y la compara con lo que el usuario confirmó; si cambió, rechaza y la pantalla muestra la real (BE-009). Encabezado y renglones van en una sola transacción |
| Pantalla | **Pago de Salud por Feria**, con tres pestañas. *Registrar*: feria y período, resumen, tabla por trabajador, datos del pago y confirmación con "Está por registrar X pagos individuales por Y". *Ferias pendientes*: estado de cada feria en el período, imprimible. *Historial*: filtros y detalle con quién registró, si la suma cuadra y anulación. La ficha del trabajador muestra su salud pagada |
| Pruebas | 9 tests unitarios de períodos (meses, semanas ISO, traslados) y 36 chequeos de punta a punta. Incluyen el **fallo forzado en el trabajador N con un trigger temporal** (QA-009: no queda encabezado ni nadie pagado), dos pagos simultáneos, anular y volver a pagar, y un traslado cargado después del pago |

Supuestos, mientras la cooperativa no confirme:

- **Periodicidad (pendiente 2) · resuelto el 2026-09-14:** la cooperativa confirmó que la salud se calcula **por semana** y que la feria paga varias semanas juntas (8, 9, 10...). `PERIODICIDAD_SALUD_FERIA` pasa a `semanal`, y la migración `20260915000000_pago_salud_varios_periodos` lo cambia salvo que ya haya pagos mensuales vigentes. Un pago elige la semana inicial y la cantidad (hasta 52). Guarda `periodo_id`, `periodo_hasta_id` y `cantidad_periodos`, y crea un renglón por trabajador y semana pendiente. La deuda se calcula semana por semana, así un traslado a mitad del rango cae en la feria que corresponde. El rango se recorta a las semanas que tenían algo pendiente. No se aceptan semanas que todavía no empezaron.
- **Monto por trabajador (pendiente 1) · resuelto el 2026-09-16:** `TARIFA_SALUD_TRABAJADOR_USD` = **0,96 por trabajador y semana**, confirmado por la cooperativa ("se hace el pago por semana 0,96 y por cada compañero"). No es un descuento al trabajador: lo paga la feria.
- **Traslado a mitad de período:** paga la feria de la última asignación dentro del período, así nadie aparece en dos ferias ni en ninguna. Un pago ya hecho conserva su feria aunque después se cargue un traslado.
- **Quién debe:** los activos, y los retirados en los períodos que trabajaron. Suspendidos e inactivos no generan deuda, igual que en la ficha.
- **Pagos parciales (pendiente 8):** no hay. Un pago cubre a todos los pendientes. Si el monto recibido difiere del esperado, se registra solo confirmando la diferencia, que queda en la auditoría.
- **Semanas adelantadas · resuelto el 2026-09-16:** la cooperativa cobra lo que la feria debe **más 10 semanas por adelantado**, y suelen ser 11 o 12 en total porque no dejan acumular más de dos semanas de deuda. El tope va en `SEMANAS_ADELANTO_SALUD_FERIA` (10): la pantalla avisa cuántas semanas adelanta el rango y el backend rechaza pasarse del tope.

**Para desplegar:** la migración con el rol `postgres`, `sincronizar-permisos.ts --aplicar` (agrega `salud_feria`: el cajero registra y consulta, el analista consulta y solo el administrador anula), y cargar los dos parámetros.

**Pendiente:** exportar las ferias pendientes a Excel y PDF (hoy se imprimen), que va con los reportes del Sprint E, y la revisión visual de la pantalla.

### Sprint C · Préstamos completos

**Reglas confirmadas por la cooperativa el 2026-09-16 (pendiente 7 de la sección 20)**

- Sólo va a reunión el préstamo que el socio **no cubre con su propio ahorro**. Si le
  alcanza, se entrega directo.
- Los fiadores cubren **sólo la diferencia** entre el monto pedido y el ahorro del socio, y
  pueden ser varios si uno solo no alcanza. Reemplaza al `PORCENTAJE_AHORRO_FIADOR` (30%)
  de hoy.
- Aprueban en la **reunión ordinaria de los martes**, donde están casi todos los socios
  trabajadores: no es junta directiva ni asamblea, y **no se anota número de acta**.
- Mora del préstamo: **aviso a los 21 días** sin pagar y **moroso a los 30**.
- Anular un abono lo puede hacer **cualquier cajero**, explicando el motivo, con la
  supervisión del compañero de al lado. ✅ 2026-09-17: el cajero reversa abonos y colectas
  **del día**; los de días anteriores sólo la **caja 99** (acción `reversar_anterior`, rol
  admin).
- Al anular el abono que había saldado el préstamo, **no se vuelve a bloquear a los
  fiadores**. ✅ 2026-09-17: el reverso reabre la deuda y los fiadores siguen liberados (antes
  se rechazaba).
- **Interés:** 1,5% mensual en línea blanca y 1% en efectivo, calculado **a diario sobre el
  saldo**, con **cuotas cada 21 días** y fecha de corte. Hoy el sistema usa cuota fija semanal
  con tasa anual: hay que rehacer el cálculo y el plan de pagos.
- **Fiadores:** se liberan **de a poco** a medida que el socio paga, y dejan de contar cuando
  lo que debe es igual o menor que su ahorro. Hoy se liberan sólo al saldar.
**Confirmado el 2026-09-17**

- **Cuota:** fija según el monto, más los intereses del período, y se aceptan abonos de
  cualquier otro monto.
- **Cantidad de cuotas por monto** (igual para línea blanca y efectivo), de la tabla que
  pasó la cooperativa. El pago por cuota de la tabla es el monto máximo del tramo dividido
  entre las cuotas:

  | Monto | Cuotas | Pago por cuota | % de divisas en el fondo |
  |---|---|---|---|
  | 5 a 25 | 1 | 25 | 10% |
  | 26 a 50 | 2 | 25 | 10% |
  | 51 a 120 | 5 | 24 | 20% |
  | 121 a 220 | 6 | 36,67 | 20% |
  | 221 a 320 | 8 | 40 | 20% |
  | 321 a 420 | 10 | 42 | 30% |
  | 421 a 520 | 13 | 40 | 30% |
  | 521 a 620 | 15 | 41,33 | 30% |
  | 621 a 720 | 18 | 40 | 30% |
  | 721 a 1.000 | 24 | 41,67 | 50% |
  | 1.001 a 2.000 | 30 | 66,66 | 50% |

- **Sin recargo por atraso:** sólo el interés. Aviso a los 21 días y moroso a los 30.
- **Préstamos vigentes:** pasan al cálculo nuevo.
- **Fiadores:** hoy el sistema viejo libera a todos por partes iguales con cada pago. La
  cooperativa no decidió si sigue así o se libera de a uno: **pendiente**.
- **Inicial · resuelto el 2026-09-18:** la columna "% de divisas en el fondo" es la **inicial
  que se paga al llevarse el producto**, con ahorro en divisas (que queda bloqueado), en
  bolívares, o mezclando. Las cuotas reparten el monto completo, así que la inicial va
  **aparte**: es la única lectura que cuadra con la columna "pagos x cuota" de la tabla.
  Falta que la cooperativa lo confirme con el ejemplo de 1.000 (500 de inicial más 24 cuotas
  de 41,67).

**Hecho el 2026-09-17 y 18**

- ✅ Motor de cálculo (`utils/planPrestamo.ts`): tabla de tramos, cuotas cada 21 días,
  interés mensual por día sobre el saldo y los umbrales de aviso (21) y mora (30).
- ✅ Migración `20260918000000_prestamos_calculo_nuevo`: cuotas, días por cuota, tasa
  mensual, inicial, estados `solicitado` y `aprobado`. Lo ya otorgado conserva su plan.
- ✅ Alta: el socio que cubre el monto con su ahorro se lleva el préstamo directo; el que no,
  queda **en solicitud** con fiadores por la diferencia. `POST /prestamos/:id/aprobar` es la
  reunión de los martes: cobra la inicial, bloquea los ahorros y arma el plan.
- ✅ Interés al día al consultar y antes de cada abono; sin recargo por atraso.
- ✅ Pantalla: simulación con cuotas e inicial, pestaña "En solicitud" y panel de aprobación.
- ✅ **Informe de conversión** (reporte `conversion-prestamos`): cómo quedaría cada préstamo
  vigente con el cálculo nuevo, con la diferencia contra lo que dice hoy el sistema. No
  cambia nada: es para revisarlo con la cooperativa antes de convertir.
- **Pendiente:** aplicar la conversión una vez revisado el informe, y el orden en que se
  libera a varios fiadores (lo define el equipo de ahorro).

- Estados `solicitado` y `aprobado`, flujo de aprobación que genera el plan al aprobar
  (RF-PRE-04), validación de ahorrista activo.
- Historial en el expediente: actuales, anteriores, cuotas pagadas/pendientes.
- Evaluar cuota de préstamo dentro del carrito de colecta, respetando el principio de una
  búsqueda → un carrito → una transacción.
- QA: pago exacto, pago final, préstamo cerrado, saldo nunca negativo (QA-FIN-04).

### Sprint D · Migración de lo que falta

- Préstamos, cuotas y abonos; colectas históricas; trabajadores y asociación a feria
  (si el Sprint 0 confirma que existen en el legacy).
- M8. Conciliación: saldo recalculado desde movimientos vs. saldo del legacy, con
  reporte de diferencias (MIG-008, MIG-011).
- Ensayo completo sobre copia de producción antes de aplicar (QA-021).

### Sprint E · Reportes y ficha integral ✅

- `GET /personas/:id/resumen` y ficha con pestañas por expediente (HU-20).
- Ferias pendientes, semanas adelantadas, cartera de préstamos, socios suspendidos; todos
  con Excel y PDF sobre el motor existente. QA: totales de pantalla = Excel = PDF.
- Pantalla de consulta de auditoría (FE-025).

**Avance al 13/09/2026: Sprint E hecho (backend, pantallas y pruebas)**

Se adelantó a C y D porque es el único sprint que no depende de ninguna confirmación de la cooperativa.

| Parte | Qué quedó |
|---|---|
| Ficha integral (HU-20) | `GET /api/personas/:id/resumen` y la pantalla **Personas → ficha** con las pestañas de FE-021: General, Trabajo, Salud, Ahorro, Colectas, Préstamos, Servicios e Historial. El expediente de trabajador (feria, historial, salud pagada por la feria) y el de ahorrista (cuentas, servicios con cobertura, semanas, préstamos actuales y anteriores, colectas) se muestran **por separado**. La situación de cada servicio usa la misma cobertura que la colecta |
| Reportes (RF-REP-01 a 08) | La pantalla **Reportes era una maqueta**: el botón simulaba una espera. Ahora genera y exporta. Seis reportes: ferias pendientes, pagos de salud (un renglón por trabajador), trabajadores por feria, cartera de préstamos, semanas adelantadas y colectas. Cada uno se ve en pantalla y baja a **Excel o PDF desde el mismo generador**, con los totales al pie (QA-019). Ferias pendientes también exporta desde su pestaña (HU-19.5) |
| Refactor | Cartera de préstamos y ferias pendientes pasaron de los controladores a servicios: la pantalla de cada módulo y su reporte usan la misma consulta |
| Auditoría (FE-025) | `GET /api/auditoria` con filtros por usuario, módulo, acción, registro y fechas, y la pantalla **Auditoría** con valores anteriores y nuevos. Permiso `auditoria:read`, solo administrador |
| Pruebas | 6 tests unitarios (totales al exportar, nombre de archivo, semanas adelantadas con cruce de año) y 27 chequeos de punta a punta. Incluyen que el total del Excel sea el de pantalla, que el saldo de la cartera coincida con el de la pantalla de préstamos, que una colecta reversada deje de contar como adelanto, y la ficha de una persona que es trabajador y ahorrista a la vez |

**Criterios tomados**

- **Semanas adelantadas:** son las que un cobro dejó cubiertas **por delante de la semana en que se cobró**. Un pago que solo pone al día no aparece. Solo cuentan funeraria y salud: el ahorro no tiene cobertura semanal.
- **Trabajadores por feria:** activos, suspendidos e inactivos se cuentan por su feria actual; los retirados, en la última feria donde estuvieron.
- **Límite:** un reporte de más de 20.000 filas pide acotar los filtros. La pantalla muestra hasta 500 filas; Excel y PDF llevan todas.

**Pendiente**

- **Reporte de socios suspendidos (RF-REP-07):** espera la suspensión del socio del Sprint F. Hoy la ficha muestra las suspensiones por servicio.
- **Reportes viejos de socios y préstamos:** siguen existiendo en la API (`POST /api/reportes/socios` y `/prestamos`), pero la pantalla ya no los ofrece, porque nunca estuvieron conectados.
- **Revisión visual** de las pantallas nuevas.

### Sprint F · Morosidad, suspensión y reactivación

**Reglas confirmadas por la cooperativa el 2026-09-16 (pendientes 3 y 4 de la sección 20)**

- El atraso se cuenta **sin pagar nada de la colecta**: salud y funeraria van juntas y no se
  pagan por separado.
- **Al caer en la semana 6** (cinco vencidas): suspensión de **3 días** en salud y funeraria.
- **Al caer en la semana 11** (diez vencidas): **1 mes** de suspensión en funeraria y
  **7 días** en salud.
- Los días de suspensión se cumplen **aunque el socio pague por adelantado**: el servicio
  se reactiva al terminarlos, no al pagar.
- **Semana 41: no es suspensión, es pérdida total.** Motivo: el artículo 5 del reglamento
  (falta de pago); la cooperativa va a pasar el parágrafo exacto. Con ese número de socio no
  puede volver: si quiere regresar, empieza de cero.
- Con **10 a 40 semanas** de deuda todavía puede pagarlas todas o abonar, **al precio de hoy**
  (que es como ya calcula la colecta).
- Hoy revisan la lista a mano para ir retirando a los que pasaron las 41 semanas: primero el
  **reporte**, y sólo después el proceso automático. ✅ 2026-09-17: reporte **Socios por
  semanas de atraso** (41 o más, 36 a 40, 11 a 35, 6 a 10, 1 a 5), exportable y por feria.
  Toma la cobertura más reciente de salud y funeraria de cada socio y no cambia estados.
- Pendiente de confirmar: qué pasa con el ahorro del socio que queda fuera.

**Hecho el 2026-09-18**

- ✅ El cálculo de atraso vive en `services/atrasoSociosService.ts` y lo usan el reporte y el
  proceso, así que los dos dicen el mismo número.
- ✅ Migración `20260919000000_morosidad_socio`: estado `suspendido` del socio,
  `suspendido_hasta` y la tabla `historial_estado_socio` (DB-017).
- ✅ `POST /api/morosidad/revisar`: **simula por defecto** y con `{ aplicar: true }` suspende,
  reactiva y deja historial. Suspende 3 días al caer en la semana 6 y un mes al caer en la 11;
  los días corren aunque el socio pague antes; reactiva al que se puso al día y ya los cumplió.
  Correrlo dos veces no duplica nada.
- ✅ La semana 41 **sólo se informa**: el retiro espera a que la cooperativa confirme si lo
  hace el sistema o una persona, que es como lo hacen hoy.
- ✅ Socios muestra el estado suspendido y permite filtrarlo. La colecta no filtra por estado,
  así que un socio suspendido sigue pudiendo pagar.

**Pendiente**

- **Retiro de la semana 41**: espera saber si lo hace el sistema o una persona, y qué pasa
  con el ahorro del socio que queda fuera.
- **Si al cumplir los días sin pagar se vuelve a suspender** (pregunta 9 al cliente).
- **Reactivación a mano** con motivo, para el caso que no resuelve el proceso automático.
- **Restricciones de operación** para suspendidos, salvo las de regularización: falta definir
  cuáles, porque hoy el suspendido sigue pudiendo pagar su colecta (que es lo que se busca).
- **Pantalla de morosidad**: correr el proceso, ver la simulación y el historial. Conviene
  diseñarla sabiendo lo del retiro de la 41.
- **Reporte de socios suspendidos** (RF-REP-07): ahora que el estado existe, ya se puede.

### Reglas de funeraria · confirmadas el 2026-09-16 (pendiente 9)

- ✅ 2026-09-17: titular **hasta 60 años** (`EDAD_MAXIMA_TITULAR_FUNERARIA`). Sin fecha de
  nacimiento se registra y avisa.
- ✅ 2026-09-17: **60 días de espera** desde el inicio del acuerdo (`DIAS_ESPERA_FUNERARIA`),
  a la vista en la lista y el detalle.
- **Máximo 8 beneficiarios** sin contar al titular (con él, 9 personas): ya existía.
- ✅ 2026-09-17: beneficiarios **de 0 a 75 años** (`EDAD_MAXIMA_BENEFICIARIO_FUNERARIA`).
- ✅ 2026-09-17: parentescos que cubre la funeraria: padres, abuelos, hermanos, cónyuge,
  hijos, hijos de crianza, padrastros, sobrinos, nietos, suegros y tíos. La pantalla de
  funeraria sólo ofrece esos; salud sigue con la lista completa, porque los beneficiarios se
  comparten.

### Numeración de semanas · resuelto el 2026-09-17 (pendiente 6)

La duda era si la cooperativa numeraba distinto de ISO. Se resolvió con un caso donde las
dos reglas difieren: en el sistema viejo, un cobro del **lunes 03/01/2022** marcaba
**semana 1**, que es lo que dice ISO. El calendario del sistema queda como está.

### Colecta y salud por feria · confirmado el 2026-09-17

- **Colecta:** se pagan **todas las semanas atrasadas** y se adelantan **hasta 10**; pasarse
  se rechaza. `BLOQUEAR_ADELANTO_EXCEDIDO` pasa a 1. **Al desplegar hay que actualizar el
  parámetro en producción**, que hoy vale 0: cambiar el valor por defecto no toca las filas
  que ya existen.
- **Montos semanales confirmados:** ahorro 0,03, funeraria 0,75 y salud 0,96. Sin mínimo por
  cobro: el mínimo es una semana.
- **Salud por feria:** al trabajador que ya paga su salud **como socio** (tiene acuerdo de
  salud activo) no se le cobra a la feria. Aparece listado aparte en la pantalla y no entra
  en el pago. Es la lectura de "el que no se lo pagan es porque ya lo paga personalmente".

### Sprint G · Permisos finos y cierre

**Confirmado el 2026-09-17:** usan cajeros y la **caja 99** (administración), más **dos
compañeras de contabilidad de ahorro que sólo consultan e imprimen reportes**. Para ellas
conviene un rol de sólo lectura; el `analista` de hoy puede crear y modificar socios,
personas, trabajadores y préstamos, así que no sirve como está.

- Acciones nuevas en `Rol.permisos` (`anular`, `reactivar`, `exportar`, `auditoria`) y
  actualización de `sincronizar-permisos.ts`.
- Ocultar acciones sin permiso en el front (FE-024); matriz de permisos por rol (QA-024).
- M9 y prueba completa solo con teclado (QA-022).

### Fase 3 (fuera de este plan)

Mensajería (WhatsApp/SMS/correo), alertas de mora, tableros e indicadores. Conviene dejar
creadas en Sprint F las consultas de "próximos a suspensión", que son la entrada de las
alertas.

---

## 6. Dependencias y riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La cooperativa no define la semana 41 ni el período de salud | Bloquea Sprint B y F | Sprint 0 dedicado; mientras tanto el umbral queda parametrizable y la suspensión apagada, como hoy |
| Cédulas inválidas o repetidas con nombres distintos | Backfill de `Persona` fusiona personas diferentes | Reporte previo, revisión manual, nunca fusionar sin coincidencia de nombre |
| Migración de BD en producción con el rol equivocado | Falla con `42501` | Correr migraciones como `postgres` |
| Build del backend que falla sin avisar | Se despliega y sigue la versión anterior | Verificar la fecha de `dist/` y reiniciar tras cada despliegue |
| Datos personales duplicados entre `socios` y `personas` | Discrepancias al editar | Editar datos personales solo desde `Persona` y sincronizar hacia `socios` hasta retirar las columnas |
| Préstamos en el legacy con reglas de interés distintas | Saldos migrados que no cuadran | Conciliación con reporte de diferencias antes de habilitar pagos |

---

## 7. Definición de terminado

Se adopta la sección 9 de [histories.md](histories.md), con dos agregados propios de este
proyecto:

- Toda operación financiera nueva escribe auditoría **dentro** de la misma transacción.
- Toda operación que lea un saldo o una cobertura para después escribirla, la bloquea
  primero.
