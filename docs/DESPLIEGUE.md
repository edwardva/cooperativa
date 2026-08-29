# Despliegue en AWS

> Por que la colecta no funciona despues de desplegar, y como dejarla andando.

## Diagnostico: el codigo viajo, el esquema no

El problema no es AWS. Es que **9 de las 12 migraciones nunca se subieron a git**:

```
20260713180158_aumentar_telefono_limit
20260714043010_aumentar_telefono_beneficiario
20260721002346_add_sexo_field
20260722005910_agregar_campo_foto_blob
20260817172500_add_codigo_social_y_campos_funeraria
20260821120000_add_asambleas_asistencia
20260822100000_colecta_relacion_socio
20260822140000_colecta_reverso
20260822170000_colecta_periodo_cobrado
```

No estan en `.gitignore`: simplemente nunca se les hizo `git add`. Al desplegar,
el servidor recibe codigo que espera `colecta.semanas_cobradas`, la tabla
`asambleas` y la relacion `colecta -> socios`, pero la base no las tiene. De ahi
que el modulo cargue y falle al operar.

Es el mismo problema que tuvo `package-lock.json`: archivos generados que quedan
fuera del commit.

## Paso 0 — subir lo que falta (desde tu maquina)

```bash
git add backend/prisma/migrations/
git add backend/prisma/sincronizar-permisos.ts backend/prisma/verificar-despliegue.ts
git status --short          # revisar antes de commitear
git commit -m "Migraciones y utilidades de despliegue"
git push
```

Sin esto, ningun paso siguiente sirve.

## Paso 1 — desplegar el codigo

```bash
cd /var/www/cooperativa
git pull
cd backend  && npm ci && npm run build
cd ../frontend && npm ci && npm run build
```

## Paso 2 — migraciones (como el DUENO de las tablas)

El rol de la app no puede correr DDL. Las migraciones van con el rol dueno,
pasando el `DATABASE_URL` solo para ese comando:

```bash
cd /var/www/cooperativa/backend

# Ver que falta antes de aplicar
DATABASE_URL="postgresql://postgres:CLAVE@HOST:5432/cooperativa?schema=public" \
  npx prisma migrate status

DATABASE_URL="postgresql://postgres:CLAVE@HOST:5432/cooperativa?schema=public" \
  npx prisma migrate deploy
```

## Paso 3 — permisos de PostgreSQL sobre las tablas nuevas

Las tablas que crea el dueno nacen sin permisos para el rol de la app. Como
`postgres`, sobre la base de produccion:

```sql
GRANT USAGE ON SCHEMA public TO miempresa_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO miempresa_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO miempresa_user;

-- Para que las PROXIMAS migraciones no repitan el problema:
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO miempresa_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO miempresa_user;
```

Si el `ALTER DEFAULT PRIVILEGES` ya se aplico antes, este paso es innecesario:
el verificador del paso 5 lo confirma.

## Paso 4 — permisos de los roles de la aplicacion

Distinto de lo anterior: son los permisos del middleware, guardados en la
columna `permisos` de la tabla `roles`. Sin `colecta`, el modulo entero
responde 403 aunque la base este perfecta.

```bash
cd /var/www/cooperativa/backend
npx tsx prisma/sincronizar-permisos.ts             # muestra que haria
npx tsx prisma/sincronizar-permisos.ts --aplicar   # lo aplica
```

**No corras `prisma db seed`**: ademas de roles crea socios, cuentas y prestamos
de PRUEBA con `.create()`, y te mete datos ficticios entre los reales.

## Paso 5 — verificar

```bash
cd /var/www/cooperativa/backend
npx tsx prisma/verificar-despliegue.ts
```

Revisa esquema, permisos de roles, GRANTs de PostgreSQL y parametros minimos.
Solo lee, no modifica nada. Si sale todo OK, el despliegue esta completo.

## Paso 6 — reiniciar

```bash
pm2 restart cooperativa-backend     # o el servicio que corresponda
```

**Obligatorio**: el middleware cachea los permisos 5 minutos, asi que sin
reinicio los roles nuevos no se ven de inmediato.

## Variables de entorno

| Variable | Por defecto | Para que |
|---|---|---|
| `DATABASE_URL` | — | Conexion de la app (rol sin DDL) |
| `SINCRONIZAR_TASA` | `true` | Sincronizacion automatica de la tasa BCV |
| `TASA_INTERVALO_HORAS` | `6` | Cada cuanto se consulta |
| `BCV_TLS_INSEGURO` | `false` | Leer del BCV salteando validacion TLS. **Dejar en false** |

La sincronizacion de tasa necesita **salida HTTPS a `ve.dolarapi.com`**. Si el
grupo de seguridad o el NAT lo bloquean, no rompe nada: conserva la ultima tasa
guardada, pero se queda vieja. Se comprueba en Parametros, que muestra la tasa
vigente contra la de la fuente.

## Checklist rapido

- [ ] Migraciones commiteadas y pusheadas
- [ ] `git pull` + `npm ci` + `npm run build` en backend y frontend
- [ ] `prisma migrate deploy` con el rol dueno
- [ ] GRANTs de PostgreSQL sobre las tablas nuevas
- [ ] `sincronizar-permisos.ts --aplicar`
- [ ] `verificar-despliegue.ts` sin fallas
- [ ] Backend reiniciado
