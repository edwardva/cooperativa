# 🚀 Cómo Arrancar el Sistema - Cooperativa el Triunfo

## Pasos para iniciar (primera vez)

### 1️⃣ Abrir dos terminales

**Terminal 1 (Backend):**
```bash
cd /Users/new/DesarrollosLocal/cooperativa/backend
npm run dev
```

Deberías ver:
```
🚀 Servidor iniciado en puerto 5000
📝 Ambiente: development
🌐 CORS habilitado para: http://localhost:3000
```

**Terminal 2 (Frontend):**
```bash
cd /Users/new/DesarrollosLocal/cooperativa/frontend
npm run dev
```

Deberías ver:
```
  VITE v5.2.11  ready in XXX ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### 2️⃣ Abrir el navegador

Ve a: **http://localhost:3000**

### 3️⃣ Probar el login

Usa estas credenciales:

| Usuario    | Contraseña  | Rol           | Acceso                    |
|------------|-------------|---------------|---------------------------|
| admin      | password123 | Administrador | Todos los módulos         |
| caja1      | password123 | Cajero        | Colecta                   |
| analista1  | password123 | Analista      | Préstamos, Reportes       |

---

## ⚡ Atajos

### Script automático (arranca todo)
```bash
cd /Users/new/DesarrollosLocal/cooperativa
./dev.sh
```
*Este script inicia automáticamente backend y frontend juntos*

### Ver la base de datos
```bash
cd backend
npm run db:studio
```
Abre Prisma Studio en http://localhost:5555

---

## 🛑 Detener el sistema

En cada terminal presiona: **Ctrl + C**

---

## 🐛 Solución de problemas

### Error "Port 5000 already in use"
```bash
lsof -ti:5000 | xargs kill -9
```

### Error "Port 3000 already in use"
```bash
lsof -ti:3000 | xargs kill -9
```

### Resetear la base de datos
```bash
cd backend
npm run db:reset
npm run db:seed
```

---

## 📊 URLs del sistema

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/health
- **Prisma Studio:** http://localhost:5555 (cuando esté corriendo)

---

## ✅ Todo listo cuando veas:

✔️ Backend: "Servidor iniciado en puerto 5000"  
✔️ Frontend: "Local: http://localhost:3000"  
✔️ Navegador: Pantalla de login cargada

¡Ahora puedes empezar a usar el sistema! 🎉
