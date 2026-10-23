# Fondo de los trabajadores de El Triunfo: requisitos y dudas

**Origen:** nota de voz de la funcional del 15/10/2026, a las 7:04 p. m.
**Estado:** no hay nada hecho, ni en el sistema viejo ni en el nuevo.

La funcional va a mandar una hoja con los lineamientos del fondo: cómo entra el dinero, cómo sale y con qué porcentajes. **No conviene empezar a construir hasta tenerla**, porque las reglas de los retiros salen de ahí.

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
