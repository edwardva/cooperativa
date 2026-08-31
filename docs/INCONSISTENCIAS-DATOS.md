# Inconsistencias de datos

> Informe generado el 2026-08-22 sobre la base de produccion local.
> **Este documento no corrige nada**: solo inventaria lo encontrado para que la
> cooperativa decida caso por caso.

## Resumen

| Ambito | Incidencia | Registros |
| --- | --- | --- |
| Socios | Cedula placeholder `TEMP######` | 188 |
| Socios | Cedula con otros caracteres no numericos | 0 |
| Socios | Cedula fuera de rango (mas de 8 digitos) | 15 |
| Socios | Cedula demasiado baja (menor a 10.000) | 0 |
| Socios | Cedula con ceros a la izquierda | 12 |
| Socios | Cedulas con mas de un expediente ACTIVO | 725 |
| Ahorro | Numero de cuenta malformado | 1 |
| Ahorro | Tipo del numero != tipo asignado | 4 |
| Ahorro | Numero que no termina en el expediente | 1 |

Universo analizado: **18.167 socios** y **18.317 cuentas de ahorro**.

---

## 1. Socios

### 1.1 Cedula placeholder `TEMP######` (188)

Registros migrados cuya cedula real no se pudo recuperar. El sistema los deja
editar mientras no se toque la cedula, pero **no podran usarse para tramites que
exijan identificacion**.

De los 188, **67 estan ACTIVOS** (prioridad de correccion) y 121 retirados.

<details>
<summary>Ver los 67 activos</summary>

| Expediente | Cedula | Socio | Feria |
| --- | --- | --- | --- |
| 101052 | TEMP000154 | DE MEDINA, CARMEN RUMUALDA | Av La Salle hasta la 6 de Pueblo Nuevo |
| 101223 | TEMP000195 | VALE PEREZ, DIANA VALENTINA | 01-04 |
| 102670 | TEMP000655 | TORRES TORRES, ALFREDO JOSE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 103320 | TEMP000948 | SIN APELLIDO, Regulo Coronel | Calle 11 a la 14 Pueblo N Cerrajones |
| 103355 | TEMP000968 | RODRIGUEZ, VILMA | Av La Salle hasta la 6 de Pueblo Nuevo |
| 103415 | TEMP000996 | ROJAS DE QUIJADA, AURA MARINA | Calle 11 a la 14 Pueblo N Cerrajones |
| 103437 | TEMP001006 | SIN APELLIDO, Gervacio A. Mendoza | Cerritos Blan Paz Caribe I y II Ruiz Pined I y II |
| 104621 | TEMP001431 | nnnn, nnnn | Av La Salle hasta la 6 de Pueblo Nuevo |
| 105336 | TEMP001672 | CORONA RAMONES, CARMEN MIGDALIA | Calle 11 a la 14 Pueblo N Cerrajones |
| 105378 | TEMP001683 | GUTIERREZ ROJAS, RONAL LEONARDO | Calle 11 a la 14 Pueblo N Cerrajones |
| 105422 | TEMP001700 | SIN APELLIDO, Lourdes E. Garcia M. | Av La Salle hasta la 6 de Pueblo Nuevo |
| 105578 | TEMP001735 | SIN APELLIDO, Edgardo Aguilar C. | Av La Salle hasta la 6 de Pueblo Nuevo |
| 105699 | TEMP001779 | Carlos M, Carlos M, Matute A. | Av La Salle hasta la 6 de Pueblo Nuevo |
| 106392 | TEMP002022 | SIN APELLIDO, Marielbys C. Amaro Ch. | Av La Salle hasta la 6 de Pueblo Nuevo |
| 106676 | TEMP002120 | CASTRO MEDINA, ARTURO JOSE | Calle 11 a la 14 Pueblo N Cerrajones |
| 106946 | TEMP002193 | Ismeri J, Ismeri J,Tamayo L. | Av La Salle hasta la 6 de Pueblo Nuevo |
| 106985 | TEMP002206 | SIN APELLIDO, Eli S. Gonzalez | Cerritos Blan Paz Caribe I y II Ruiz Pined I y II |
| 107130 | TEMP002248 | Yulvis N, Yulvis N, Rodriguez M. | Av La Salle hasta la 6 de Pueblo Nuevo |
| 107348 | TEMP002317 | Alexander J, Alexander J, Albujas R. | Av La Salle hasta la 6 de Pueblo Nuevo |
| 107431 | TEMP002343 | HERNANDEZ RIVERO, EDUIMAR RAFAEL | Av La Salle hasta la 6 de Pueblo Nuevo |
| 107921 | TEMP002512 | Carlos E, Carlos E, Alvarado A. | Calle 11 a la 14 Pueblo N Cerrajones |
| 108002 | TEMP002540 | SEQUERA ESPINOZA, ENRIQUE JOSE. | Calle 11 a la 14 Pueblo N Cerrajones |
| 108121 | TEMP002570 | Omar, Omar, Apostol | Av La Salle hasta la 6 de Pueblo Nuevo |
| 108361 | TEMP002647 | Edimar, Edimar, Lopez P. | Calle 7 Pueblo Nuevo a la 10 de Pueblo Nuevo |
| 108425 | TEMP002668 | Oleiva V, Oleiva V, Morales C. | Calle 11 a la 14 Pueblo N Cerrajones |
| 109167 | TEMP002952 | HERNANDEZ RIVERO, EDUAR JOSE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 109245 | TEMP002986 | Barbara D, Barbara D, Almao H. | Calle 7 Pueblo Nuevo a la 10 de Pueblo Nuevo |
| 109255 | TEMP002992 | David B, David B, Estrella B ( Hugo Brito ) | Cerritos Blan Paz Caribe I y II Ruiz Pined I y II |
| 109442 | TEMP003063 | EL TRIUNFO, FONDO DE SALUD | Av La Salle hasta la 6 de Pueblo Nuevo |
| 109484 | TEMP003083 | Indhira L, Indhira L, Almao H. | Av La Salle hasta la 6 de Pueblo Nuevo |
| 109499 | TEMP003092 | Ronald, Ronald, Rodriguez | Calle 11 a la 14 Pueblo N Cerrajones |
| 109501 | TEMP003093 | Yenire M, Yenire M, Rondon R. | Calle 7 Pueblo Nuevo a la 10 de Pueblo Nuevo |
| 109502 | TEMP003094 | Robert J, Robert J, Rondon R. | Calle 7 Pueblo Nuevo a la 10 de Pueblo Nuevo |
| 110224 | TEMP003514 | SIN APELLIDO, Areimar P. Hurtado M. | Calle 11 a la 14 Pueblo N Cerrajones |
| 110441 | TEMP003643 | AREVALO A., FELIX BERNABE | Barrio Bolivar Jacinto Lara Tostao Rafael Linarez |
| 110480 | TEMP003663 | SIN APELLIDO, Edixon J Salon P. | Barrio Bolivar Jacinto Lara Tostao Rafael Linarez |
| 110625 | TEMP003772 | CASTELLANOS, JUAN J | Calle 11 a la 14 Pueblo N Cerrajones |
| 110626 | TEMP003773 | CASTELLANOS, GERALDIN K | Calle 11 a la 14 Pueblo N Cerrajones |
| 110688 | TEMP003825 | FOSOFAL FONDO SOLIDARIO DE FAL, FOSOFAL (Fondo Solidario de Faltante) | Cerritos Blan Paz Caribe I y II Ruiz Pined I y II |
| 110793 | TEMP003922 | GIL ZERPA, MICHEL ANDREINA | Calle 11 a la 14 Pueblo N Cerrajones |
| 110839 | TEMP003963 | FONDO, ENCUENTRO DE NIÑOS Y JOVENES | Av La Salle hasta la 6 de Pueblo Nuevo |
| 110867 | TEMP003991 | ALEJOS C., GABRIELA V. | Barrio Bolivar Jacinto Lara Tostao Rafael Linarez |
| 110946 | TEMP004066 | LINAREZ, ROGELIO ANTONIO | Barrio Bolivar Jacinto Lara Tostao Rafael Linarez |
| 111046 | TEMP004159 | RODRIGUEZ, SAMUEL | Calle 11 a la 14 Pueblo N Cerrajones |
| 111094 | TEMP004202 | LINAREZ, ELIANNYS CAROLINA | El Coriano I y II Pocitos- Tinajitas |
| 111535 | TEMP004613 | TORREALBA GALLARDO, YOLANDA | Av La Salle hasta la 6 de Pueblo Nuevo |
| 111795 | TEMP004861 | SIN APELLIDO, SIN NOMBRE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 112302 | TEMP005341 | SIN APELLIDO, SIN NOMBRE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 112314 | TEMP005353 | BAEZ MONTERO, NORBELIZ MARIA | calle 15 campo verde piedras blancas |
| 112315 | TEMP005354 | MONTERO CRESPO, NORMA EDUVIGIS | calle 15 campo verde piedras blancas |
| 112687 | TEMP005697 | PEREIRA DE ALVAREZ, GLADYS DEL CARMEN | calle 15 campo verde piedras blancas |
| 113034 | TEMP006025 | CENTRO COOPERATIVO, DE FORMACION Y RECREACION | Calle 7 Pueblo Nuevo a la 10 de Pueblo Nuevo |
| 113841 | TEMP006794 | SIN APELLIDO, SIN NOMBRE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 118260 | TEMP010988 | Triunfo Reintegro Salud, SIN NOMBRE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 118261 | TEMP010989 | Triunfo Reintegro Funeraria, SIN NOMBRE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 118262 | TEMP010990 | Triunfo-Carnet-Inscripc Ahorro-Funerar, SIN NOMBRE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 118263 | TEMP010991 | Triunfo Multas, SIN NOMBRE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 118265 | TEMP010993 | Triunfo Aporte Cics, SIN NOMBRE | Av La Salle hasta la 6 de Pueblo Nuevo |
| 118560 | TEMP011288 | URBANO ROJAS, JUAN DAVID | Av La Salle hasta la 6 de Pueblo Nuevo |
| 122282 | TEMP014930 | FONDO DE, DEPORTE | Barquisimeto Estado Lara |
| 200017 | TEMP016096 | FUENTES, EDITA DEL CARMEN | Cerritos Blan Paz Caribe I y II Ruiz Pined I y II |
| 200027 | TEMP016106 | YAJURE VARGAS, EUGENIO JOSE | Cerritos Blan Paz Caribe I y II Ruiz Pined I y II |
| 200035 | TEMP016113 | ESCALONA, YOHANY DAYANA | Barrio Bolivar Jacinto Lara Tostao Rafael Linarez |
| 200041 | TEMP016117 | NIETO FERNANDEZ, SANDRA ELIZABETH | Av La Salle hasta la 6 de Pueblo Nuevo |
| 200081 | TEMP016148 | VALDERRAMA, YELITZA COROMOTO | Av La Salle hasta la 6 de Pueblo Nuevo |
| 300276 | TEMP016456 | PENA ARAUJO, YOVANNY RAMON | Feria del Centro |
| 300438 | TEMP016613 | GUEDES CANIZALEZ, JOHANNA MARCEDES | Feria del Centro |

</details>

### 1.3 Cedula fuera de rango (15)

Mas de 8 digitos: ninguna cedula venezolana vigente los alcanza. Suelen ser dos
numeros pegados o un error de tipeo.

| Expediente | Cedula | Digitos | Socio | Estado |
| --- | --- | --- | --- | --- |
| 001214 | 168759641 | 9 | VALE VALERA DE GIMENEZ, NOEL DAVID | activo |
| 109440 | 117847964 | 9 | GONZALEZ  DE GUEDEZ, LISBEHT JOSEFINA | retirado |
| 109458 | 123698258 | 9 | MUJICA BERBESI, ELUZ SORANGEL | retirado |
| 113121 | 115445506 | 9 | CRUCES TORREALBA, MARIA YUSBELYS | retirado |
| 114461 | 221811156 | 9 | AMARO CHASOY, WILBERG MITCHELLI | retirado |
| 114711 | 112662725 | 9 | RODRIGUEZ BRITO, NEYDA MILAGRO | retirado |
| 115865 | 299842397 | 9 | UPC, COOPERATIVA AVIVIR | retirado |
| 117745 | 128498180 | 9 | ESCALONA DE ALMAO, MARIELA JOSEFINA | retirado |
| 121239 | 233834716 | 9 | MONTILLA GUERE, MARIALVIS DAYANA | activo |
| 121519 | 136787480 | 9 | PARAZA MORENO, ORLANDO JOSE | activo |
| 122739 | 269321512 | 9 | DAVILA GUEVARA, MIGLEDDYS JHOSSELIN | activo |
| 300500 | 214608080 | 9 | VARGA PEROZO, LISETH CAROLINA | retirado |
| 300863 | 246790643 | 9 | LOVERA LISCANO, DIEGO ALEXANDER | retirado |
| 300936 | 243539656 | 9 | FREITEZ GARCIA, NIXON EDUARDO | retirado |
| 380085 | 181038900 | 9 | PEREIRA RODRIGUEZ, ADRIANNY DE LA CHIQUINQUIRA | activo |

### 1.5 Cedula con ceros a la izquierda (12)

Producto del relleno automatico de la migracion. El numero es correcto, sobra el
padding. El sistema ya normaliza al guardar, asi que se corrigen solas al editar.

| Expediente | Cedula guardada | Normalizada | Socio | Estado |
| --- | --- | --- | --- | --- |
| 110903 | 0761606 | 761606 | ROMAN MALPICA, ANTONIO JOSE | retirado |
| 111745 | 018102 | 18102 | MUJICA, ERNESTA DEL CARMEN | activo |
| 112193 | 023030 | 23030 | RODRIGUEZ, SERGIA DEL CARMEN | retirado |
| 112200 | 083919 | 83919 | SANCHEZ, RICARDO RAFAEL | retirado |
| 112715 | 090799 | 90799 | RAMOS ALVARADO, ELIZABETH VERONICA | retirado |
| 112803 | 0760016 | 760016 | NELO DE CAMACARO, MILAGRO COROMOTO | retirado |
| 113007 | 085007440 | 85007440 | COOPERATIVA EL TRIUNFO, RESPALDO DE FIADOR | retirado |
| 113194 | 0760049 | 760049 | SILVA ESCALONA, ROSA MARIA | retirado |
| 114781 | 085007440 | 85007440 | PROYECTO, DE FARMACIA | retirado |
| 115810 | 01012020 | 1012020 | BASTIDAS PIÑEROS, NURIMAR ELIDIBETH | activo |
| 116280 | 085007440 | 85007440 | COOP EL TRIUNFO, FONDO FAMILIAR | activo |
| 300678 | 077283299 | 77283299 | FISCHEL FREEMAN, SASCHA | retirado |

### 1.6 Cedulas con mas de un expediente ACTIVO (725)

La misma persona figura con dos o mas expedientes activos a la vez. Puede ser un
alta duplicada por error o una practica deliberada de la cooperativa; **no se
puede decidir desde el dato**.

Desde ahora el sistema **impide crear un expediente nuevo** con una cedula que ya
tenga uno activo, pero **los 725 casos existentes siguen intactos**.

Involucran **1468 expedientes** en total.

<details>
<summary>Ver los primeros 50 casos (de 725)</summary>

| Cedula | Expedientes activos | Titulares |
| --- | --- | --- |
| 423130 | 100160, 100890, 200001 | GUEDEZ ARRAEZ, JUAN PEDRO |
| 5298359 | 102620, 109090, 111398 | BARRIOS DE LOZA, FELICITA / BARRIOS CASTELLANO, FELICITA DEL CARMEN |
| 9605889 | 104133, 108894, 200061 | GUEDEZ P., BELKIS M. / GUEDEZ PEREZ, BELKYS MARINA |
| 7374668 | 107269, 114400, 200084 | R DE DELGADO, GIOVANNINA C / RUSSO DE DELGADO, GIOVANNINA CECILIA |
| 9610037 | 107800, 112552, 200064 | RIERA DE YEDRA, PASTORA J. / RIERA  DE YEDRA, PASTORA JOSEFINA / RIERA DE YEDRA, PASTORA JOSEFINA |
| 18949095 | 110569, 116385, 121640 | COLMENAREZ FERNANDEZ, GISELA CAROLINA |
| 7990951 | 110596, 118972, 119512 | RIVERO R., GLORIA COROMOTO / RIVERO DE MATA, GLORIA COROMOTO |
| 17101576 | 119568, 119808, 301099 | RIVERO SANCHEZ, YOHEL DE JESUS |
| 23813780 | 119571, 121095, 301040 | APOSTOL PALENCIA, ANA KARINA |
| 23495290 | 119657, 300884, 301724 | MARQUEZ CEIBA, YORBELYS DEL CARMEN |
| 20472595 | 119678, 301265, 301723 | ESCALONA M, JENNIFER D / ESCALONA MACHADO, JENNIFER DAMARY |
| 20044388 | 121430, 307779, 380031 | ALVAREZ APOSTOL, KEYLA YESIMAR / ALVAREZ, KEILA / ALVAREZ APOSTOL, KEILA YESIMAR |
| 20009517 | 121439, 301751, 307794 | GUASIMUCARO MUJICA, JOSE DANIEL / GUASIMUCARO, JOSE DANIEL |
| 19779852 | 121440, 307717, 307772 | RODRIGUEZ, JOHANDER ALEXIS / RODRIGUEZ, YOHANDER ALEXIS / RODRIGUEZ, YOHANDER |
| 28425212 | 121462, 121987, 307805 | MEDINA RODRIGUEZ, MAYERLIN CRISTINA |
| 28019431 | 122341, 301134, 380176 | PEREIRA SOTELDO, BETZABETH YOLIANNY |
| 18057198 | 122378, 307913, 380174 | SANCHEZ VASQUEZ, JOSE ALBERTO |
| 26577682 | 122405, 301103, 380177 | PEÑA MONTESDE OCA, ENMANUEL DE JESUS / PEÑA MONTES DE OCA, ENMANUEL DE JESUS |
| 12241244 | 012302, 119707 | PENA LOYO, JEISER  PASTORA / PEÑA LOYO, JEISER  PASTORA |
| 7366643 | 012325, 119677 | PEREZ VASQUEZ, DOMINGO RAMON |
| 13196558 | 012374, 119695 | ANTEQUERA GUEDEZ, DENNY JOSEFINA |
| 13267309 | 012426, 119704 | ESCOBAR MERLO, EVELYN CAROLINA |
| 2918908 | 100074, 101213 | FONSECA DE ESCALONA, AURA  ROSA / F.DE ESCALONA, AURA  ROSA |
| 414277 | 100075, 100566 | RODRIGUEZ, DOMINGO |
| 5237059 | 100077, 108982 | RODRIGUEZ, TITA DE JESUS |
| 9540812 | 100148, 105580 | PEREZ RODRIGUEZ, YRAIDA / PEREZ RODRIGUEZ, YRAIDA COROMOTO |
| 7374371 | 100180, 107108 | SALAS DIAZ, STELLA JASMIN |
| 4383737 | 100227, 101221 | RAMIREZ, RAMON ANTONIO |
| 2536143 | 100236, 100856 | REYES, PABLO ANTONIO |
| 1437334 | 100242, 101166 | PINTO DE MONTES, YOLANDA DEL CARMEN |
| 2915118 | 100244, 100668 | M.DE LOYO, GLADYS MARIA / MARTINEZ DE LOYO, GLADYS MARIA |
| 4735936 | 100257, 102438 | CAMACARO, CONCILIA |
| 5253373 | 100258, 101485 | SUAREZ DE SUAREZ, RAMONA ANTONIA |
| 7376611 | 100292, 110904 | RODRIGUEZ D., NELLY M. / RODRIGUEZ DIAZ, NELLY MARGARITA |
| 7346710 | 100296, 104506 | GOMEZ ALVAREZ, HERCILIA MARIA |
| 2915411 | 100305, 103941 | OROPEZA, AURORA / OROPEZA, AURA ROSA |
| 4066501 | 100331, 110918 | RAMIREZ M., HENRY ALBERTO / RAMIREZ MENDOZA, HENRY ALBERTO |
| 1267599 | 100406, 102050 | T.DE VILORIA, CAYETANA DEL CARMEN / TORRES DE VILORIA, CAYETANA DEL CARMEN |
| 4724537 | 100438, 104646 | DIAZ BULLONES, EDUARDO |
| 4073606 | 100446, 109915 | F.DE RODRIGUEZ, NEMECIA DEL C. / FIGUEROA DE RODRIGUEZ, NEMECIA DEL CARMEN |
| 3088663 | 100447, 101770 | GUTIERREZ, MIREYA M / GUTIERREZ DE TORREALBA, MIREYA MARINA |
| 2542392 | 100518, 101209 | S.DE SANCHEZ, ANA / SERRANO DE SANCHEZ, ANA JOSEFINA |
| 4733080 | 100548, 102752 | RIVERO, OTILIA DE / PIÑA DE RIVERO, UTILIA LUCIA |
| 4412364 | 100557, 102798 | SOTO, MARIO A / SOTO, MARIO ANTONIO |
| 1266053 | 100569, 100774 | BULLONES R, JUAN B / BULLONES RODRIGUEZ, JUAN BAUTISTA |
| 424696 | 100623, 101739 | MENDOZA MENDOZA, ELOY / MENDOZA MENDOZA, ELOY MARIA |
| 10775736 | 100626, 107714 | PALMERA, BLANCA T |
| 7468979 | 100700, 111507 | RAMOS SILVA, CIRILO  ALEJANDRO / RAMOS COLMENAREZ, CIRILO ALBERTO |
| 3720908 | 100771, 103259 | MEJIA DE GOMEZ, ANGELA / MEJIA DE GOMEZ, ANGELA  BERTA |
| 7303417 | 100815, 103303 | ALVARADO, MARIA JOSEFINA |

</details>

> Se listan 50 de 725 para mantener el documento legible. El resto se obtiene con el mismo script.

---

## 2. Cuentas de ahorro

El formato correcto es `TIPO-FERIA-EXPEDIENTE` (ej. `01-08-00-121753`), donde el
codigo de feria ya trae un guion interno. El ultimo segmento es el expediente del
socio, no un correlativo.

### 2.1 Numeros malformados (1)

| ID | Numero | Expediente | Titular | Tipo | Activa | Saldo USD |
| --- | --- | --- | --- | --- | --- | --- |
| 14263 | `12--118754     ` | 118754 | CASTILLO, JEHOVA ALBERTO | AHORRO DIVISAS | No | 0 |

Dos defectos en el mismo registro: **falta el codigo de feria** (quedo `12--118754`
en vez de `12-XX-00-118754`) y el valor esta **relleno con espacios al final** hasta
15 caracteres. La cuenta esta inactiva y con saldo 0, asi que corregirla no afecta
ningun saldo.

### 2.2 El tipo del numero no coincide con el tipo asignado (4)

El prefijo del numero dice un tipo de cuenta y el campo `tipo_cuenta_id` dice
otro. Hay que definir cual de los dos manda antes de tocar nada.

| ID | Numero | Tipo en el numero | Tipo asignado | Expediente | Titular | Saldo USD |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | `07-01-00-118263` | 07 | 01 (CUENTA A LA VISTA) | 118263 | Triunfo Multas, SIN NOMBRE | 305.07 |
| 13 | `01-01-00-118262` | 01 | 08 (INSCRIP - CARNET) | 118262 | Triunfo-Carnet-Inscripc Ahorro-Funerar, SIN NOMBRE | 244.78 |
| 21 | `11-01-00-118265` | 11 | 01 (CUENTA A LA VISTA) | 118265 | Triunfo Aporte Cics, SIN NOMBRE | 0 |
| 24 | `10-01-00-118260` | 10 | 01 (CUENTA A LA VISTA) | 118260 | Triunfo Reintegro Salud, SIN NOMBRE | 0 |

**Los cuatro son cuentas institucionales de la cooperativa, no de socios** (titulares
`Triunfo ...`, sin nombre de persona). Y no fallan todas en la misma direccion:

- **ID 9, 21 y 24**: el numero es coherente con el titular (`07`=MULTAS para
  "Triunfo Multas", `11`=APORTE CICS, `10`=REINT SALUD) y lo que quedo mal es el
  `tipo_cuenta_id`, que cayo por defecto en `01` (CUENTA A LA VISTA).
- **ID 13**: al reves. El `tipo_cuenta_id` es correcto (`08` INSCRIP - CARNET, que
  concuerda con "Triunfo-Carnet-Inscripc") y el que quedo mal es el numero, que
  arranca con `01`.

Dos de ellas tienen **saldo real** (305,07 y 244,78 USD), asi que cualquier
correccion debe hacerse sin tocar los saldos.

### 2.3 Numeros que no terminan en el expediente (1)

| ID | Numero | Termina en | Expediente real | Titular |
| --- | --- | --- | --- | --- |
| 362 | `01-05-00-201030` | 201030 | 200030 | COLMENAREZ, MARIA JOSEFINA |

---

## 3. Lo que NO es una inconsistencia

### Feria del numero distinta de la feria actual del socio (1018 cuentas)

El numero de cuenta se congela al momento de la apertura. Cuando un socio se
muda de feria, su numero conserva la feria original. **Es el comportamiento
correcto** y por eso el sistema no recalcula numeros al editar un socio.

Se documenta aca para que nadie lo confunda con un error al comparar.

---

## Como se genero

Consulta directa a la base con Prisma, contrastando cada cedula contra
`backend/src/utils/cedula.ts` y cada numero de cuenta contra la reconstruccion
`TIPO-FERIA-EXPEDIENTE`. Ninguna consulta escribe.
