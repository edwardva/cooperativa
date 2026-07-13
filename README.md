# 🏦 Sistema de Gestión - Cooperativa el Triunfo, R.L

> Modernización completa del sistema de gestión de cooperativa de ahorro y crédito  
> **Stack:** React 18 + TypeScript + Node.js + PostgreSQL  
> **Timeline:** 24 semanas | **Go Live:** Enero 2027

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 📊 Datos del Sistema

- **9,585** asociados activos
- **$145,546 USD** + **Bs 17,372,294** en préstamos activos
- **9,282** acuerdos funeraria | **5,614** acuerdos salud
- **Tasa actual:** 700.22 Bs/USD (dual-currency)

---

## 🚀 Quick Start

```bash
# 1. Clonar repositorio
git clone https://github.com/cooperativa-triunfo/sistema-gestion.git
cd sistema-gestion

# 2. Instalar dependencias
cd frontend && npm install
cd ../backend && npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con tus credenciales locales

# 4. Levantar base de datos
docker-compose up -d

# 5. Ejecutar migraciones
cd backend && npx prisma migrate dev

# 6. Seed de datos de prueba
npx prisma db seed

# 7. Iniciar desarrollo
npm run dev
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

---

## 📚 Documentación

### 🎯 Para Nuevos Desarrolladores
**Lee en este orden:**

1. **[CONTEXTO-PROYECTO.md](./CONTEXTO-PROYECTO.md)** ⭐ **EMPIEZA AQUÍ**
   - Stack tecnológico completo
   - Arquitectura y estructura de carpetas
   - Reglas críticas de negocio (tasa semanal, suspensiones, fiadores)
   - Convenciones de código
   - Design system (colores, tipografía, componentes)
   - Comandos de desarrollo

2. **[PLAN-DE-DESARROLLO.md](./PLAN-DE-DESARROLLO.md)**
   - Plan detallado de 24 semanas
   - 4 fases de desarrollo
   - 12 módulos con especificaciones
   - Definition of Done por fase
   - Estimaciones de tiempo

3. **[ANALISIS-SISTEMA-ACTUAL.md](./ANALISIS-SISTEMA-ACTUAL.md)**
   - Inventario de 84 funcionalidades del sistema viejo
   - Comparación funcionalidad por funcionalidad
   - Validación de cobertura 100%
   - Puntos críticos identificados

4. **[GUIA-MIGRACION.md](./GUIA-MIGRACION.md)**
   - Estrategia de migración de datos en 5 etapas
   - Scripts de migración con validaciones
   - Plan de operación dual (4-8 semanas)
   - Checklist de 40+ items
   - Plan de capacitación por roles

### 🤖 Para Asistentes de IA
Si usas GitHub Copilot, Claude, ChatGPT u otro asistente de IA, el archivo [`.github/instructions/cooperativa.instructions.md`](./.github/instructions/cooperativa.instructions.md) se carga automáticamente y contiene:
- Contexto resumido del proyecto
- Stack obligatorio (no sugerir alternativas)
- Reglas críticas de negocio
- Convenciones de código
- Comandos rápidos

---

## 🏗️ Stack Tecnológico

### Frontend
- **React 18.3+** — UI framework con hooks y Suspense
- **TypeScript 5.x** — Tipado estático (modo strict)
- **Tailwind CSS v4** — Utility-first CSS
- **Shadcn/ui + Radix UI** — Componentes accesibles headless
- **TanStack Query** — Server state management
- **Zustand** — Client state management
- **React Hook Form + Zod** — Forms con validación
- **Framer Motion** — Animaciones sutiles

### Backend
- **Node.js 20 LTS** — Runtime JavaScript
- **Express.js 4.x** — Web framework
- **Prisma ORM** — Database toolkit con types generados
- **PostgreSQL 16+** — Base de datos relacional
- **JWT** — Autenticación stateless
- **Winston** — Logging estructurado

### DevOps
- **Docker + Docker Compose** — Containerización
- **GitHub Actions** — CI/CD pipeline
- **Codacy** — Code quality
- **Trivy** — Security scanning
- **Jest + React Testing Library** — Unit & integration testing
- **Playwright** — E2E testing

---

## 🗂️ Estructura del Proyecto

```
cooperativa-app/
├── frontend/               # Aplicación React
│   ├── src/
│   │   ├── components/    # Componentes UI
│   │   ├── pages/         # Páginas por ruta
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API calls (React Query)
│   │   ├── store/         # Zustand stores
│   │   └── lib/           # Utilidades
│   └── package.json
├── backend/               # API Node.js
│   ├── src/
│   │   ├── controllers/   # Lógica de endpoints
│   │   ├── services/      # Lógica de negocio
│   │   ├── routes/        # Definición de rutas
│   │   └── middleware/    # Auth, validation, errors
│   ├── prisma/
│   │   └── schema.prisma  # Esquema de base de datos
│   └── package.json
├── scripts/
│   └── migracion/         # 🔄 Scripts de migración de datos
│       ├── 1-extract-socios.sql        # Extracción desde BD vieja
│       ├── 2-import-socios.ts          # Importación de socios
│       ├── 3-validate-socios.ts        # Validación de integridad
│       ├── 4-rollback-socios.ts        # Rollback en caso de error
│       ├── 5-import-beneficiarios.ts   # Importación de beneficiarios
│       ├── generate-report.ts          # Reporte HTML visual
│       ├── extract_from_old_system.php # Web scraping (última opción)
│       ├── data/                       # CSV exportados (git-ignored)
│       └── logs/                       # Logs de migración
├── docs/                  # Documentación técnica
├── scripts/               # Scripts de migración y utilities
├── docs/                  # Documentación completa ⭐
└── docker-compose.yml     # PostgreSQL + Redis
```

---

## 📦 Módulos del Sistema

| Módulo | Descripción | Fase | Semanas |
|--------|-------------|------|---------|
| **0. Catálogos Maestros** | Tipos de cuentas, parámetros, ubicaciones | Fase 1 | 1 |
| **1. Socios** | Gestión de socios y beneficiarios | Fase 2 | 2 |
| **2. Ahorro** | Cuentas de ahorro, movimientos | Fase 2 | 1.5 |
| **3. Funeraria** | Acuerdos funerarios, suspensiones | Fase 2 | 1.5 |
| **4. Salud** | Acuerdos de salud, carga masiva | Fase 2 | 1.5 |
| **5. Préstamos** | Préstamos, fiadores, morosidad | Fase 2 | 2.5 |
| **6. Colecta/Caja** ⭐ | Cobros diarios, cierres de caja | Fase 3 | 3 |
| **7. Bóveda** | Control de efectivo USD/Bs | Fase 3 | 2 |
| **8. Cajero Digital** | Pagos web, conciliación | Fase 4 | 2 |

**Módulos Fase 2 (posterior a V1):**
- 9. Inventario (4 semanas)
- 10. Citas (3 semanas)
- 11. Asamblea (1 semana)
- 12. Mensajería (3 semanas)

---

## ⚠️ Reglas Críticas de Negocio

### 1. 💱 Tasa Semanal (Dual-Currency)
El sistema maneja **USD y Bs** simultáneamente. Al inicio de cada semana:
1. Administrador ingresa nueva tasa (ej: 700.22 Bs/USD)
2. Sistema recalcula **automáticamente** todos los saldos en Bs

### 2. ⏸️ Suspensiones Automáticas
- **Funeraria:** 6 semanas consecutivas sin pago → suspensión automática
- **Salud:** 11 semanas consecutivas sin pago → suspensión automática
- **Implementación:** Job nocturno que actualiza estados

### 3. 🤝 Fiadores en Préstamos
- **Obligatorio:** Todo préstamo requiere 1-2 fiadores
- **Validación crítica:** Fiador debe tener ahorro disponible ≥ 30% del monto
- **Bloqueo:** Al aprobar préstamo → bloquear ahorro del fiador
- **Liberación:** Al saldar préstamo → liberar ahorro

### 4. ⚡ Performance en Colecta
**El proceso MÁS usado del sistema** (cientos de transacciones diarias)
- **Target:** Búsqueda de socio <300ms, registro de pago <500ms
- **UX:** Shortcuts teclado, feedback visual inmediato
- **Optimización:** Índices DB, caching con React Query

---

## 🔄 Migración de Datos

### Estado Actual
- ✅ **Scripts listos** en `/scripts/migracion/`
- ✅ **9,585 socios** a migrar desde sistema PHP antiguo
- ✅ **Validaciones automáticas** integradas
- ✅ **Rollback** en caso de error
- ✅ **Reporte visual HTML** de migración

### Guía Rápida

```bash
# 1. Instalar dependencias
cd scripts/migracion
npm install

# 2. Preparar datos (opción A: SQL)
# Ejecutar 1-extract-socios.sql en BD vieja
# Copiar CSVs a scripts/migracion/data/

# 2b. Preparar datos (opción B: Web scraping)
# Configurar credenciales en extract_from_old_system.php
php extract_from_old_system.php

# 3. Migrar socios
npm run migrate:socios

# 4. Validar integridad
npm run validate:socios

# 5. Migrar beneficiarios
npm run migrate:beneficiarios

# 6. Generar reporte visual
npm run migration:report

# En caso de error: Rollback
npm run migrate:rollback
```

### Archivos CSV Esperados
```
scripts/migracion/data/
  ├── socios_export.csv          (9,585 registros)
  ├── beneficiarios_export.csv   (datos de beneficiarios)
  └── ubicaciones_export.csv     (ferias/ubicaciones)
```

**Ver archivos `.example.csv` para formato exacto esperado**

### Validaciones Automáticas
✓ Cédulas únicas  
✓ Códigos de socio únicos  
✓ Ubicaciones válidas  
✓ Límite de 9 beneficiarios por socio  
✓ Fechas coherentes  
✓ Estados válidos  
✓ Integridad referencial  

📄 **Guía completa:** [GUIA-MIGRACION.md](./GUIA-MIGRACION.md)

---

## 🧪 Testing

```bash
# Unit + integration tests
npm run test

# Test con coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E en modo UI (debugging)
npm run test:e2e:ui
```

**Cobertura mínima:**
- Unit tests: 80%+
- Integration tests: 60%+
- E2E tests: Flujos críticos (login, colecta, préstamos, cierre caja)

---

## 🎨 Design System

### Filosofía: **Minimalismo Moderno 2026**
1. **Clarity First** — Información clara sin ruido visual
2. **Zero Friction** — Eliminar pasos innecesarios
3. **Cognitive Load Reduction** — Mostrar solo lo necesario
4. **Accessibility by Default** — WCAG 2.1 AA

### Paleta de Colores
- **Primary:** Azul índigo `#4F46E5` (confianza, profesionalismo)
- **Success:** Verde esmeralda `#10B981`
- **Warning:** Ámbar `#F59E0B`
- **Error:** Rojo coral `#EF4444`
- **Neutrals:** Grises cálidos `#F9FAFB` → `#111827`

### Tipografía
- **UI/Body:** Inter Variable
- **Números/Datos:** JetBrains Mono

Ver [CONTEXTO-PROYECTO.md](./CONTEXTO-PROYECTO.md) para sistema completo de diseño.

---

## 🔒 Seguridad

### ✅ Implementado
- JWT en **httpOnly cookies** (no localStorage)
- Bcrypt para hash de passwords (salt rounds: 12)
- Rate limiting en endpoints críticos
- CORS configurado por whitelist
- SQL injection prevention (Prisma queries)
- XSS prevention (sanitización de inputs)

### ⚠️ Obligatorio
- **Audit log** en TODAS las operaciones financieras
- Validación de permisos en cada endpoint
- Sanitización de inputs con express-validator
- HTTPS en producción (TLS 1.3)
- Secrets en variables de entorno (nunca en código)

---

## 📅 Timeline

```
┌────────────────────────────────────────────────────┐
│ Fase 0: Descubrimiento     │ Sem 1-2    │ 2 sem   │
├────────────────────────────────────────────────────┤
│ Fase 1: Fundación          │ Sem 3-5    │ 3 sem   │
├────────────────────────────────────────────────────┤
│ Fase 2: Socios y Servicios │ Sem 6-12   │ 7 sem   │
├────────────────────────────────────────────────────┤
│ Fase 3: Operación Financ.  │ Sem 13-19  │ 7 sem   │
├────────────────────────────────────────────────────┤
│ Fase 4: Cajero + Hardening │ Sem 20-24  │ 5 sem   │
├────────────────────────────────────────────────────┤
│ UAT y Go Live              │ Post-24    │ 4-8 sem │
└────────────────────────────────────────────────────┘
```

**Fecha estimada Go Live:** Enero 2027

---

## 👥 Equipo

**Product Owner:** Ing. Katherine Martínez (Cooperativa el Triunfo, R.L)  
**Equipo de Desarrollo:** 2 desarrolladores full-time  
**Metodología:** Scrum con sprints de 2 semanas

**Canales de comunicación:**
- Daily standup: 9:00 AM (15 min)
- Sprint planning: Lunes 10:00 AM
- Sprint review: Viernes 3:00 PM
- Retrospective: Viernes 4:00 PM

---

## 🔗 Links Útiles

- **Documentación completa:** [`/docs`](./docs/)
- **API Endpoints:** (Pendiente - se generará con Swagger)
- **Storybook (UI Components):** http://localhost:6006
- **Figma Design System:** (Pendiente - Fase 0)

---

## 📝 Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: agregar módulo de colecta con shortcuts de teclado
fix: corregir cálculo de suspensión en acuerdos funeraria
docs: actualizar README con instrucciones de setup
refactor: extraer lógica de validación de fiadores a service
test: agregar tests E2E para flujo de colecta completo
chore: actualizar dependencias (React 18.3.1)
```

---

## 🤝 Contribuir

### Flujo de Trabajo
1. Crear branch desde `develop`: `git checkout -b feature/nombre-funcionalidad`
2. Hacer commits siguiendo convenciones
3. Ejecutar `npm run check` (lint + format + type-check)
4. Ejecutar tests: `npm run test`
5. Crear PR hacia `develop`
6. Esperar aprobación (1 reviewer mínimo)
7. Merge automático si CI pasa (GitHub Actions)

### Branches Protegidas
- `main` — Producción (solo PRs aprobados)
- `develop` — Integración (código estable)

---

## 📄 Licencia

**Propietario:** Cooperativa el Triunfo, R.L  
**Tipo:** Código privado (no open source)  
Todos los derechos reservados © 2026

---

## ❓ FAQ

**P: ¿Por qué React y no Vue/Angular?**  
R: Decisión aprobada por el equipo. React tiene mejor ecosistema para el stack elegido (TanStack Query, Radix UI, Framer Motion).

**P: ¿Por qué Prisma y no TypeORM?**  
R: Prisma genera types automáticamente desde el esquema, reduciendo errores y mejorando DX.

**P: ¿Migramos el código viejo?**  
R: NO. No hay acceso al código fuente. Reescritura completa desde cero con migración de datos.

**P: ¿Cuándo podemos agregar funcionalidad X?**  
R: Revisa el [PLAN-DE-DESARROLLO.md](./PLAN-DE-DESARROLLO.md). Si no está en V1 (24 semanas), va a Fase 2 (posterior).

**P: ¿Podemos cambiar Tailwind por Styled Components?**  
R: No. El stack está definido y aprobado. Ver [CONTEXTO-PROYECTO.md](./CONTEXTO-PROYECTO.md).

---

## 📞 Contacto

**Issues técnicos:** Abrir issue en GitHub  
**Preguntas de negocio:** contactar a Ing. Katherine Martínez  
**Slack:** `#cooperativa-dev`

---

**🚀 ¡Bienvenido al equipo! Lee el [CONTEXTO-PROYECTO.md](./CONTEXTO-PROYECTO.md) para empezar.**
