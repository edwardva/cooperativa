---
description: Contexto del proyecto Cooperativa el Triunfo - Sistema de gestión de cooperativa de ahorro y crédito
applyTo: '**'
---

# Cooperativa el Triunfo - Contexto del Proyecto

## 🎯 Proyecto
**Migración completa** de sistema PHP antiguo (sin código fuente) a stack moderno React + Node.js + PostgreSQL para cooperativa con **9,585 socios** y **$145K USD** en préstamos activos.

## 🏗️ Stack Obligatorio
- **Frontend:** React 18 + TypeScript + Tailwind CSS v4 + Shadcn/ui + TanStack Query + Framer Motion
- **Backend:** Node.js 20 + Express + Prisma ORM
- **DB:** PostgreSQL 16+
- **Design:** Minimalismo moderno 2026 + WCAG 2.1 AA

## ⚠️ Reglas Críticas de Negocio

### 1. Tasa Semanal (Dual-Currency)
- Sistema maneja USD + Bs
- Tasa ingresada semanalmente (ej: 700.22 Bs/USD)
- Al cambiar tasa → recalcular TODOS los saldos en Bs automáticamente

### 2. Suspensiones Automáticas
- **Funeraria:** 6 semanas sin pago → suspensión automática
- **Salud:** 11 semanas sin pago → suspensión automática
- Implementar con job nocturno

### 3. Fiadores en Préstamos
- **Obligatorio:** 1-2 fiadores por préstamo
- **Validación crítica:** Fiador debe tener ahorro disponible ≥ 30% del monto del préstamo
- Al aprobar préstamo → bloquear ahorro del fiador
- Al saldar préstamo → liberar ahorro del fiador

### 4. Performance en Colecta (CRÍTICO)
- Proceso MÁS usado del sistema (cientos de transacciones diarias)
- **Objetivo:** Búsqueda <300ms, registro <500ms
- **UX:** Shortcuts teclado (F2, Enter, Esc), feedback visual inmediato
- **Índices DB:** `socios.cedula`, `socios.nombre`

## 📊 Módulos Principales (en orden de Fase)

**Fase 1 (Sem 3-5):**
- Autenticación + Roles
- Catálogos maestros

**Fase 2 (Sem 6-12):**
- Socios (9,585 registros a migrar)
- Ahorro
- Funeraria (9,282 acuerdos, 23.68% suspendidos)
- Salud (5,614 acuerdos)
- Préstamos (validación de fiadores)

**Fase 3 (Sem 13-19):**
- 🔥 **Colecta/Caja** (CRÍTICO - optimizar al máximo)
- Bóveda (nuevo módulo)

**Fase 4 (Sem 20-24):**
- Cajero Digital
- Hardening + Testing

## 🎨 Convenciones de Código

### Naming
```typescript
// Componentes: PascalCase
export const SocioCard = () => { ... }

// Hooks: camelCase + 'use'
export const useSocios = () => { ... }

// Entidades negocio: Español
interface Socio { cedula: string; nombre: string; }
interface Préstamo { monto: number; }

// Componentes técnicos: Inglés
const Button = () => { ... }
const Modal = () => { ... }

// Tablas DB: snake_case plural
CREATE TABLE socios (...);
CREATE TABLE acuerdos_funeraria (...);
```

### TypeScript Strict
```typescript
// ❌ NUNCA usar 'any'
const procesarPago = (data: any) => { ... }

// ✅ Tipos explícitos
interface PagoColecta {
  socio_id: number;
  monto_ahorro?: number;
  monto_funeraria?: number;
}
const procesarPago = (data: PagoColecta): Promise<void> => { ... }
```

### API Responses
```typescript
// Success
{ success: true, data: {...}, meta?: {...} }

// Error
{ 
  success: false, 
  error: { 
    code: 'VALIDATION_ERROR', 
    message: 'Descripción legible',
    details: [...]
  }
}
```

## 🔒 Seguridad OBLIGATORIA

```typescript
// ✅ JWT en httpOnly cookies (NO localStorage)
res.cookie('token', jwt, { httpOnly: true, secure: true, sameSite: 'strict' });

// ✅ Audit log en TODAS las operaciones financieras
await auditLog.create({
  user_id: req.user.id,
  action: 'PAGO_REGISTRADO',
  module: 'colecta',
  data: { socio_id, monto },
  ip: req.ip
});

// ✅ Validar permisos en cada endpoint
const requirePermission = (module: string, action: string) => { ... }
router.post('/prestamos', requirePermission('prestamos', 'create'), ...);
```

## 📚 Documentos del Proyecto

Lee en este orden:
1. **[CONTEXTO-PROYECTO.md](../CONTEXTO-PROYECTO.md)** — Stack, arquitectura, reglas de negocio (ESTE DOC - completo)
2. **[PLAN-DE-DESARROLLO.md](../PLAN-DE-DESARROLLO.md)** — Plan de 24 semanas, fases, módulos, DoD
3. **[ANALISIS-SISTEMA-ACTUAL.md](../ANALISIS-SISTEMA-ACTUAL.md)** — 84 funcionalidades del sistema viejo
4. **[GUIA-MIGRACION.md](../GUIA-MIGRACION.md)** — Scripts de migración y validación de datos

## 🚨 NO Sugieras Cambios de Stack

El stack está **definido y aprobado**. NO sugieras:
- ❌ Alternativas a React (Vue, Angular, Svelte)
- ❌ Alternativas a Tailwind (Styled Components, CSS Modules, Emotion)
- ❌ Alternativas a Prisma (TypeORM, Sequelize)
- ❌ Alternativas a PostgreSQL (MySQL, MongoDB)

Si detectas un problema real con el stack, consulta con el equipo primero.

## ⚡ Quick Commands

```bash
# Setup
docker-compose up -d && cd backend && npx prisma migrate dev

# Dev
npm run dev          # Frontend (3000) + Backend (5000)
npm run storybook    # Componentes UI (6006)

# Test
npm run test         # Unit + integration
npm run test:e2e     # Playwright E2E

# Quality
npm run check        # lint + format + type-check
```

## 🎯 Cuando Generes Código

✅ **SIEMPRE:**
- TypeScript strict mode (sin `any`)
- Componentes funcionales con hooks
- Nombres de entidades de negocio en español
- Validación con Zod en forms
- Loading states (skeleton screens, no spinners)
- Manejo de errores con toasts
- Responsive (mobile-first)
- Accesible (ARIA labels, keyboard nav)
- Comentarios en español para lógica de negocio

✅ **Prioriza:**
1. Performance (especialmente en Colecta)
2. Seguridad (audit logs, JWT, validación)
3. Accesibilidad (WCAG 2.1 AA)
4. Migración de datos sin pérdida ($145K en juego)

---

**Contacto PO:** Ing. Katherine Martínez (Cooperativa el Triunfo, R.L)  
**Timeline:** 24 semanas | Go Live: Enero 2027
