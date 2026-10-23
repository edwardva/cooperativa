# Respuestas del 23/10/2026: qué se hizo y qué queda abierto

Respuestas a [DUDAS-2026-10-21.md](DUDAS-2026-10-21.md). Los números son los de ese archivo.

Estados: ✅ hecho · ⏳ pendiente de algo externo · ❓ sigue abierta.

Nada tiene commit todavía. Backend y frontend compilan, y pasan las **112 pruebas**: se actualizaron las del calendario por el cambio de la duda 1. Lo nuevo se probó contra la base local con datos temporales que después se borraron. **Ninguna pantalla se probó en el navegador.**

---

## Lo que se hizo

| # | Respuesta | Qué se hizo |
|---|---|---|
| 1 | La semana 53 es la semana 1 del próximo año | ✅ Cambia el calendario de todo el sistema. Ver "Duda 1" debajo de la tabla. |
| 2 | Cerrar el año no implica nada más; creen que el adelanto al año nuevo no se guarda | ✅ El sistema nuevo sí lo guarda: pagar 6 semanas desde la 50 de 2026 deja cubierto hasta la 4 de 2027. Los reportes de corte de año quedan como propuesta (P1). |
| 3 | Antes de marzo se marca la asamblea del año anterior; desde marzo, la del año en curso. El **No** es inasistencia y se guarda en el historial | ✅ Ver "Duda 3" debajo de la tabla. |
| 5 | Sí, cada cajero ve lo suyo, y la supervisora ve además todas las cajas | ✅ Ver "Duda 5" debajo de la tabla. |
| 6 | ¿Qué pasa con un préstamo cobrado en la colecta? | ✅ El reverso de la colecta **sí lo devuelve**. Ver "Duda 6" debajo de la tabla. |
| 9 | Avisar por correo también los reversos | ✅ Al reversar, el socio recibe un correo con la operación, el monto y el motivo. Como el resto del correo, está apagado hasta tener la cuenta (duda 8). |
| 14 | Siempre deben tener un sector; quien no lo tenga actualiza sus datos | ✅ Ya funciona así. |
| 15 | Las cuentas de los socios de feria se quedan como están | ✅ No se tocan. Se abren para meter más de 8 beneficiarios en otro contrato. |
| 17 | Saldos a una fecha: sí | ✅ Ver "Duda 17" debajo de la tabla. |
| 22 | Se cobra el monto vigente; el segundo año sin ir ya no es multa sino el retiro | ✅ Ver "Duda 22" debajo de la tabla. |
| 23 | Cobrar la multa aparte, en una opción del menú donde también se cambia el monto. Se cobra apenas termina la última asamblea, entera, no bloquea lo demás, y se muestra en Bs grande con el $ chico al lado | ✅ Módulo nuevo **Multas**. Ver "Duda 23" debajo de la tabla. |
| 24 | Aplica a activos y suspendidos de cualquier sector o feria | ✅ Así quedó. |
| 25 | Vale cualquier asamblea del año, de cualquier sector | ✅ Así quedó. |
| 26 | Motivo de retiro aparte: "Inasistencia a asambleas" | ✅ Ver "Duda 26" debajo de la tabla. |
| 27 | Al retirarlo se le descuenta la multa del ahorro, el resto se le devuelve, y cuando vuelva se le dice por qué fue retirado | ✅ Ver "Duda 27" debajo de la tabla. |
| 28 | Para reactivarlo debe pagar la multa; las semanas atrasadas se conversan. Conserva antigüedad y acuerdos | ✅ Ver "Duda 28" debajo de la tabla. |
| 29 | Sólo el administrador reactiva | ✅ Ya era así. Que también pueda el supervisor queda por conversar (abierta 29). |
| 31 | Detalle de beneficiarios clasificados y agrupados por tipo | ✅ Ver "Duda 31" debajo de la tabla. |

**Duda 1, calendario de semanas.** La semana 1 de un año ahora es la que **contiene el 1 de enero**, de lunes a domingo; antes era ISO.

- 2026 queda con 52 semanas, y la del 28/12/2026 al 03/01/2027 es la semana 1 de 2027.
- Para 2024, 2025 y 2026 no cambia nada: las dos reglas dan lo mismo. Hoy es la semana 43, igual que en el sistema viejo.
- Revisé 160.000 pagos de funeraria del sistema viejo: **no tenía una regla fija**. En 2021 y 2022 usó esta misma regla, cerró 2022 con una "semana 53" (la que termina el 01/01/2023) y desde 2023 usó ISO. Por eso cada diciembre había que llamar al proveedor.
- El cambio también llegó al frontend: la semana y el año sugeridos en Colecta y en Semanas de colecta.

**Duda 3, asamblea Sí/No en la colecta.** La asamblea se elige así: si ya hubo alguna del año en curso, se marca la última de ese año; si no, la última del año anterior.

- El selector tiene tres opciones: "—", Sí y No. Sin elegir no se guarda nada, para que un cobro de rutina no deje un "No" por error.
- El "No" queda registrado como inasistencia: se agregó a la asistencia el campo `asistio`, en la migración `20261023000000_asistencia_asistio`.
- Ese "No" no cuenta como asistencia en ningún reporte ni en la multa.
- Si después se registra que sí fue, la inasistencia se corrige.
- La asistencia anual del socio ahora devuelve también sus inasistencias registradas.

**Duda 5, "Cobrado hoy":** junto a "Cobrado hoy en su caja", quien tiene el permiso de supervisora o administración ve "Hoy, todas las cajas", en Bs con el $ al lado.

**Duda 6, reverso de un préstamo cobrado en la colecta.** El reverso de la colecta devuelve al préstamo el capital, el interés y la mora que había descontado ese abono.

- La cuota vuelve a quedar pendiente.
- Si el abono había saldado el préstamo, el préstamo vuelve a quedar activo.
- Los fiadores ya liberados siguen liberados, como se había confirmado.
- No hay que hacer nada aparte.

**Duda 17, saldos a una fecha.** En Reportes → "Saldos de ahorro" hay un campo nuevo, "Saldos al".

- El saldo se calcula hacia atrás desde el de hoy, deshaciendo los movimientos posteriores a esa fecha. Así sirve aunque una cuenta migrada no traiga su historial viejo.
- No incluye las cuentas abiertas después de esa fecha.
- Probado: depósito de 100, retiro de 50 y depósito de 20 dan 0, 100, 50 y 70 en cada fecha de corte.

**Duda 22, multa del año.** Quien faltó **también** el año anterior no aparece como deudor de multa: le toca el retiro.

**Duda 23, módulo Multas.** Está en el menú, junto a Asambleas. Tiene:

- el monto vigente, editable por quien tiene permiso;
- "Por cobrar", por año, con buscador;
- "Consultar un socio", que incluye a los retirados para poder cobrarles antes de reactivarlos;
- el cobro, en efectivo, transferencia, pago móvil, punto o **descontado del ahorro**, siempre por el monto completo;
- recibo imprimible;
- "Cobradas", por fechas, con reverso (los de otro día los hace la caja 99).

Datos: la tabla nueva `multas_asamblea`, en la migración `20261023010000_multas_asamblea`, guarda sólo las pagadas. Quién debe se calcula de la asistencia: si una asistencia se carga tarde, la deuda desaparece sola. Permisos nuevos en el módulo `multas`.

**Duda 26, motivo del retiro.** "Inasistencia a asambleas" es un motivo de retiro propio. Pasividad queda para el artículo 5, literal c.

**Duda 27, retiro por inasistencia.**

- Se le descuenta del ahorro la multa que deba.
- Se retira aunque tenga ahorro; el sistema avisa "tiene ahorro por devolver".
- Si el ahorro no alcanza, avisa que la multa queda pendiente.
- Cuando vuelve a la colecta, aparece en rojo "Retirado por inasistencia a la asamblea…" en las dos vistas.

**Duda 28, reactivación.** Reactivar se bloquea mientras deba la multa ("Antes de reactivarlo debe pagar la multa de 2025. Se cobra en Multas."). Las semanas atrasadas no se exigen.

**Duda 31, beneficiarios en la ficha del socio.** Hay dos bloques, Funeraria y Salud. Cada uno muestra el total, cuántos están activos y cuántos suspendidos, y la lista con nombre, parentesco, cédula y estado, primero los activos.

### Pruebas del módulo de multas (base local, datos temporales)

- **Socio que fue en 2025 y marcó "No" en 2026:** debe la multa de 2026.
- **Socio que faltó en 2025 y en 2026:** debe sólo la de 2025, porque en 2026 le toca el retiro.
- **Cobrar la misma multa dos veces:** se rechaza.
- **Reverso:** la deuda vuelve.
- **Retiro por inasistencia con $12 de ahorro y multa de $5:** se descuenta y quedan $7.
- **Reactivación sin pagar:** se rechaza. Pagada, se reactiva.

---

## Lo que sigue abierto

| # | Duda | Estado |
|---|---|---|
| 4 | **Referencia.** ¿Para qué la usan y es obligatoria con transferencia? | ❓ Hay que preguntar. |
| 7 | **Libreta física.** Quieren imprimir **en la libretica física**, no en hoja. | ⏳ Mañana mandan la foto. Hará falta también el modelo de la impresora de libretas. |
| 8 | **Cuenta de correo** para enviar a los socios. Puede ser la misma del cobro del hosting. | ⏳ Mañana la piden. Cuando esté, se cargan `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `CORREO_REMITENTE` en el servidor. |
| 10 | **Mensajes de texto** a todos los socios que hagan movimientos, tengan o no correo | ❓ Proveedor y costo, a conversar. No se hizo nada. |
| 11 | **Trabajadores de El Triunfo.** La respuesta dice "no se les cobra **salud**, la pagan aparte", pero el pedido original hablaba del 0,03. ¿En la colecta no se les cobra la **salud** (0,96), el **ahorro** (0,03) o los dos? | ❓ Ver el detalle debajo de la tabla. |
| 12 | **¿Cómo se reconoce a un trabajador?** "Tienen un código diferente": ¿qué código? ¿El expediente empieza distinto, o el sector es otro (hoy se asume el 01-06)? | ❓ Necesitamos un ejemplo real. |
| 16 | **Cuentas institucionales** (07, 10 y 11 salen en el reporte 01 del sistema viejo) | ❓ Hay que preguntar. |
| 23 | **¿La multa va a la cuenta 07 "Multas"?** | ❓ Hay que preguntar. Hoy queda registrada en su propia tabla y en su reporte. |
| 29 | **¿También reactiva el supervisor?** | ❓ A conversar. Hoy sólo el administrador. |

**Duda 11, qué falta.** Hace falta la respuesta y, además, autorizar el cambio en el cálculo del cobro: el control de permisos lo bloqueó la primera vez. Hoy se les cobra todo.

### Dudas nuevas

| # | Duda |
|---|---|
| N1 | **Años que siguen teniendo 53 semanas.** Con la regla nueva, algunos años todavía tienen 53: 2028 y 2034, cuando el 1 de enero siguiente cae lunes. Por ejemplo, la semana del 25 al 31/12/2028 no contiene ningún 1 de enero. ¿Esa queda como semana 53 de 2028, o también la quieren como semana 1 de 2029? Para 2026 y 2027 no hay diferencia. |
| N2 | **Retiro por el segundo año sin asistir.** Se dijo que la multa del segundo año es "automáticamente" perder la condición de socio. Hoy el sistema **avisa** quiénes son (Reportes → "Inasistencia a asambleas" → "Dos años seguidos") y la oficina lo retira con el motivo nuevo. ¿Quieren que se retire solo apenas termina la última asamblea del año, o que lo siga decidiendo la oficina? |
| N3 | **¿La multa entra en el cierre de caja?** Hoy no: tiene su listado de "Cobradas" con su total. Si la cobra la misma cajera, puede convenir sumarla a su cierre. |
| N4 | **Coberturas viejas de 2023.** En 2023 el sistema viejo usó ISO y la regla nueva numera ese año una semana distinta. Sólo afecta a socios cuyo último pago quedó en 2023 (más de 41 semanas sin pagar, que ya deberían estar retirados): se verían con una semana más o menos de atraso. ¿Es aceptable, o se corrigen al migrar? |

### Propuestas para mostrarles

- **P1.** Reporte de **corte de año**: lo cobrado por servicio en el año, cuántos socios cerraron al día, cuántos adelantaron al año siguiente y cuántos quedaron atrasados.
- **P2.** Reporte de **beneficiarios retirados**, por servicio (lo sugirieron en la duda 31).

---

## Para el despliegue

1. Aplicar las migraciones `20261023000000_asistencia_asistio` y `20261023010000_multas_asamblea` con el rol dueño de la base.
2. Correr `prisma/sincronizar-permisos.ts`, por los permisos nuevos `multas` y `socios:reactivar_retirado`.
3. Cargar el monto de la multa en **Multas** (empieza en 0, "sin configurar").
4. Cuando la tengan, cargar la cuenta de correo (duda 8).
