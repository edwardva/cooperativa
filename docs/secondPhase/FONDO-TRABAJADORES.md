# Fondo de los trabajadores de El Triunfo: requisitos y dudas

**Origen:** nota de voz de la funcional del 15/10/2026, a las 7:04 p. m.
**Estado:** ✅ construido el 24/10, con las respuestas de la cooperativa (sección "Respuestas del 24/10"). Falta la tabla de porcentajes que mencionaron: se carga en Fondo → Conceptos y porcentajes.

---

## Qué es

- Es un dinero común de la cooperativa que sólo pueden usar los **trabajadores de la cooperativa El Triunfo** y sus familiares registrados. Son entre 300 y 700 trabajadores.
- Hoy lo llevan a mano, en hojas y papeles impresos.
- Según la funcional, es la parte que **más usan, más que la colecta**: registran ingresos todo el tiempo.

> **Ojo con el nombre.** En el sistema, "Trabajadores" ya es el módulo de los **trabajadores de feria** (salud por feria). Los trabajadores de El Triunfo son otra cosa: los empleados de la cooperativa. Hoy se distinguen por el sector **01-06**. Ver la duda F1.

## Requisitos

### R1. Opción "Fondo" en el menú

Una entrada nueva en el menú lateral ("el árbol"), con:

- ingresos;
- usos o retiros;
- beneficiarios;
- impresión.

### R2. Ingresos al fondo

**De dónde vienen:**

- la ganancia de la venta de pollo en la cooperativa;
- las chucherías;
- los insumos médicos;
- ventas que hace alguien por fuera y luego entrega en la oficina.

**Qué se registra:**

- fecha;
- origen o concepto, de una lista editable más una descripción;
- monto en Bs, con su equivalente en $ a la tasa del día;
- quién lo entrega y quién lo recibe;
- referencia.

**En pantalla:** carga rápida y un listado por fechas con su total. Se usa a cada rato.

### R3. Usos o retiros del fondo

El trabajador pide dinero para un gasto. Ejemplos que dio la funcional:

- **Lentes:** el fondo cubre el 70 % y el trabajador paga el 30 %.
- **Lentes, otra forma:** el fondo paga los cristales y el trabajador la montura.
- **Una emergencia.**

**Qué se registra:**

- trabajador y, si aplica, el familiar beneficiado;
- concepto;
- monto total del gasto;
- lo que cubre el fondo, como porcentaje o como parte del gasto;
- lo que paga el trabajador;
- fecha, quién lo autoriza y un comprobante impreso.

**Control:** no se puede retirar más de lo que hay en el fondo. Ver las dudas F3 y F4.

### R4. Beneficiarios del fondo

- **Quiénes pueden serlo:** sólo **padres, cónyuge e hijos**. Es un grupo más chico que en funeraria y salud.
- **Desde el módulo Fondo:** registrar, modificar y eliminar los beneficiarios de cada trabajador, y ver su detalle (nombres y datos).
- **En la ficha del socio:** si el socio es trabajador de El Triunfo, una sección con sus beneficiarios del fondo, sólo para consulta.

### R5. Impresión

- comprobante de cada ingreso y de cada uso;
- listado de ingresos y de usos por fechas;
- usos por trabajador;
- saldo del fondo.

## Propuesta de diseño (para cuando llegue la hoja)

**Tablas nuevas:**

- **`fondo_movimientos`:** tipo (ingreso o uso), fecha, concepto u origen, monto en Bs y en USD, tasa, socio y beneficiario (en los usos), monto total del gasto, porcentaje cubierto, monto a cargo del trabajador, referencia, usuario y reverso.
- **`fondo_beneficiarios`:** socio, cédula, nombre, parentesco (padre, madre, cónyuge o hijo) y estado.
- **`fondo_conceptos`:** catálogo editable de orígenes de ingreso y de tipos de uso, con su porcentaje de cobertura por defecto.

**Reglas y pantallas:**

- **Saldo:** se calcula como ingresos menos usos, y el uso se valida dentro de la misma transacción, igual que en la colecta.
- **Permisos:** un módulo `fondo` con `create`, `read`, `update`, `delete` y `reversar`, como el resto de los módulos.
- **Pantalla:** pestañas Ingresos, Usos y Beneficiarios, más los reportes en Reportes.

Tamaño estimado: unos 2 a 3 días, una vez cerradas las dudas.

## Dudas

| # | Duda |
|---|---|
| F1 | **¿Quién es "trabajador de El Triunfo"?** ¿Todos los socios del sector 01-06? ¿Hay trabajadores que no son socios, o socios del 01-06 que ya no trabajan ahí? ¿Conviene una marca propia de "trabajador de la cooperativa" en el socio? (Es la misma duda 12 de [DUDAS-2026-10-21.md](DUDAS-2026-10-21.md).) |
| F2 | **¿Un solo fondo común o una cuenta por trabajador?** "Entre todos ingresan al fondo" suena a un fondo común. ¿O cada trabajador aporta y sólo puede usar lo suyo? |
| F3 | **Tope por trabajador.** ¿Hay un monto máximo por uso, por año o por persona? ¿Una cantidad de usos por año? |
| F4 | **Porcentajes de cobertura.** ¿Hay una tabla fija por concepto (lentes 70 %, etc.) o se decide en cada caso? ¿Quién la cambia? |
| F5 | **"Le retienen el dinero".** ¿El uso es una ayuda que no se devuelve, o un adelanto que el trabajador repone, por ejemplo descontado de su sueldo o en cuotas? |
| F6 | **Moneda.** ¿El fondo se lleva en Bs, en $ o en las dos? ¿Los ingresos en efectivo se registran a la tasa del día? |
| F7 | **Aportes de los trabajadores.** Además de las ventas, ¿los trabajadores aportan una cuota fija al fondo? ¿Se cobra en la colecta? |
| F8 | **Autorización de los usos.** ¿Quién aprueba un uso (presidencia, administración)? ¿Hace falta adjuntar factura o presupuesto? |
| F9 | **Beneficiarios.** ¿"Hijos" tiene límite de edad? ¿Puede haber dos padres y dos madres (por ejemplo, suegros)? ¿Un familiar puede estar en el fondo de dos trabajadores? |
| F10 | **Saldo inicial.** ¿Con cuánto dinero arranca el fondo en el sistema? ¿Hay que cargar el historial de las hojas? |
| F11 | **Sistema viejo.** El sistema viejo tiene el tipo de cuenta 13, "Fondo Integrado". ¿Es este fondo o es otra cosa? |
| F12 | **¿Quién lo opera?** ¿Lo manejan las mismas cajeras o una persona aparte? ¿Entra en el cierre de caja? |

---

## Respuestas del 24/10 y cómo quedó

| # | Respuesta | Cómo quedó en el sistema |
|---|---|---|
| F2 | Fondo **común**: cualquier trabajador puede pedir | Un solo saldo: ingresos menos ayudas. |
| F5 | Es una **ayuda**, no se devuelve | No hay cuotas ni deuda. |
| F3/F4 | Sin topes; los porcentajes son los de su tabla | Catálogo de conceptos con su porcentaje, editable. Se arrancó con Lentes 70 %, Emergencia 100 % y Otro gasto 100 %. **Falta cargar su tabla.** |
| F7 | Sin cuota fija: entra lo que se consigue | Conceptos de ingreso: venta de pollo, queso, chucherías, insumos médicos y otro ingreso. |
| F8 | Lo autoriza el cajero que atiende, y queda el registro | Cada ayuda guarda trabajador, familiar, concepto, gasto total, porcentaje, lo que pone el fondo, lo que pone el trabajador, motivo y quién la registró. Historial por trabajador. |
| F9 | Hijos sin límite de edad; un familiar puede estar con dos trabajadores | Así quedó. |
| F6 | En bolívares, con el $ al lado sólo como referencia | Así quedó. |
| F10 | Sin saldo de arranque | Arranca en 0. |
| F12 | Lo debería operar el admin, pero por ahora cualquier cajero | Los cajeros pueden todo menos reversar movimientos de otro día (eso, la caja 99). |
| F11 | Quizás la cuenta 13 "Fondo Integrado" no funcione | No se usa. Se confirma mañana. |
| F1 | El trabajador tiene "un código diferente" | ❓ Se confirma mañana. Mientras tanto el parámetro `FONDO_SECTORES_TRABAJADORES` (01-06) sólo **avisa** si el socio no figura como trabajador; no bloquea. |

**Lo que hace la pantalla (menú → Fondo trabajadores):**

- **Saldo** del fondo arriba, en Bs con el $ de referencia.
- **Movimientos:** listado por fechas y tipo, con totales, comprobante, reverso e impresión del listado.
- **Registrar ingreso:** concepto, monto en Bs, quién lo entrega, referencia y descripción.
- **Ayuda a un trabajador:** se busca al trabajador, se elige el concepto y para quién es (él o un familiar), se escribe el gasto total y el sistema calcula cuánto pone el fondo y cuánto el trabajador. No deja dar más de lo que hay. Muestra las ayudas que ya recibió.
- **Familiares:** alta, edición y baja de padres, cónyuge e hijos de cada trabajador. También se ven, sólo para consulta, en la ficha del socio.
- **Conceptos y porcentajes:** alta de conceptos, cambio de porcentaje y desactivación.
