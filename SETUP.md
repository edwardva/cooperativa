# 🚀 Setup del Proyecto - Cooperativa el Triunfo

Guía paso a paso para inicializar el proyecto en tu máquina local.

---

## 📋 Pre-requisitos

Asegúrate de tener instalado:

- ✅ **Node.js 20+** ([https://nodejs.org/](https://nodejs.org/))
- ✅ **Docker Desktop** ([https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/))
- ✅ **Git** ([https://git-scm.com/](https://git-scm.com/))

Verifica las instalaciones:
```bash
node --version  # Debe ser v20 o superior
npm --version   # Debe ser v10 o superior
docker --version
```

---

## 🛠️ Instalación

### 1. Clonar el repositorio (si aplica)
```bash
git clone <url-del-repo>
cd cooperativa
```

### 2. Iniciar PostgreSQL con Docker
```bash
docker-compose up -d
```

Esto iniciará:
- PostgreSQL en `localhost:5432`
- Redis en `localhost:6379` (opcional)
- PgAdmin en `localhost:5050` (opcional)

Verifica que los contenedores estén corriendo:
```bash
docker ps
```

### 3. Instalar dependencias del backend
```bash
cd backend
npm install
```

### 4. Configurar Prisma y ejecutar migraciones
```bash
# Generar el cliente de Prisma
npm run db:generate

# Ejecutar migraciones (crea las tablas)
npm run db:migrate

# Poblar la BD con datos de prueba
npm run db:seed
```

Deberías ver un mensaje de éxito con el resumen de datos creados:
```
✅ Seed completado exitosamente!

📊 Resumen de datos creados:
   - 3 roles
   - 3 usuarios
   - 2 ubicaciones
   - 5 socios
   - 3 beneficiarios
   - 5 cuentas de ahorro
   - 3 acuerdos de funeraria
   - 3 acuerdos de salud
   - 1 préstamos
   - 1 fiadores

👤 Usuarios de prueba:
   - admin / password123 (Administrador)
   - caja1 / password123 (Cajero)
   - analista1 / password123 (Analista)
```

### 5. Instalar dependencias del frontend
```bash
cd ../frontend
npm install
```

---

## ▶️ Ejecutar en desarrollo

### Opción 1: Ejecutar frontend y backend por separado

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
El backend estará en: `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
El frontend estará en: `http://localhost:3000`

### Opción 2: Ejecutar ambos desde la raíz (requiere script)
```bash
# Crear un script npm en el package.json raíz (pendiente)
npm run dev
```

---

## 🧪 Verificar que todo funciona

### 1. Verificar Backend
Abre en tu navegador o usa curl:
```bash
curl http://localhost:5000/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development"
}
```

### 2. Verificar Frontend
Abre en tu navegador: `http://localhost:3000`

Deberías ver la página de bienvenida con el estado del proyecto.

### 3. Verificar Base de Datos
Opción A - Prisma Studio:
```bash
cd backend
npm run db:studio
```
Se abrirá una interfaz web en `http://localhost:5555` para explorar la BD.

Opción B - PgAdmin:
1. Abre `http://localhost:5050`
2. Login: `admin@cooperativa.local` / `admin`
3. Conecta al servidor PostgreSQL con los datos de `.env`

---

## 🔑 Usuarios de prueba

Una vez que el módulo de autenticación esté implementado, usa estos usuarios:

| Username   | Password      | Rol           |
|------------|---------------|---------------|
| admin      | password123   | Administrador |
| caja1      | password123   | Cajero        |
| analista1  | password123   | Analista      |

---

## 🗄️ Comandos útiles de Base de Datos

```bash
cd backend

# Ver la BD en una interfaz gráfica
npm run db:studio

# Resetear la BD (borra todo y vuelve a crear)
npm run db:reset

# Crear una nueva migración (después de cambios en schema.prisma)
npm run db:migrate

# Regenerar el cliente Prisma (después de cambios en schema)
npm run db:generate

# Poblar con datos de prueba nuevamente
npm run db:seed
```

---

## 🧹 Limpiar y reiniciar

Si algo sale mal, puedes resetear completamente:

```bash
# Detener y eliminar los contenedores de Docker
docker-compose down -v

# Borrar node_modules
rm -rf backend/node_modules frontend/node_modules

# Reinstalar todo
docker-compose up -d
cd backend && npm install && npm run db:migrate && npm run db:seed
cd ../frontend && npm install
```

---

## 🐛 Troubleshooting

### Error: "Port 5432 already in use"
Ya tienes PostgreSQL corriendo localmente. Opciones:
1. Detener tu PostgreSQL local: `brew services stop postgresql` (Mac)
2. Cambiar el puerto en `docker-compose.yml`: `"5433:5432"`

### Error: "DATABASE_URL is required"
Asegúrate de que el archivo `.env` exista en la raíz del proyecto.

### Error: "Cannot find module '@prisma/client'"
```bash
cd backend
npm run db:generate
```

### Frontend no muestra estilos
```bash
cd frontend
rm -rf node_modules
npm install
```

---

## 📚 Próximos pasos

Una vez que todo esté funcionando:

1. ✅ Lee [CONTEXTO-PROYECTO.md](./CONTEXTO-PROYECTO.md) para entender la arquitectura
2. ✅ Revisa [PLAN-DE-DESARROLLO.md](./PLAN-DE-DESARROLLO.md) para ver las fases
3. ✅ Comienza con **Fase 1**: Módulo de Autenticación
4. ✅ Crea componentes del Design System en Storybook

---

## 🆘 Ayuda

Si tienes problemas:
1. Revisa los logs de Docker: `docker-compose logs -f`
2. Revisa los logs del backend: Ver la consola donde corre `npm run dev`
3. Consulta la documentación completa en `docs/`

---

¡Listo para comenzar a desarrollar! 🎉
