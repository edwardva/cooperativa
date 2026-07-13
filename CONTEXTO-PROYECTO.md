# 🏦 Contexto del Proyecto: Cooperativa el Triunfo, R.L

> **Documento de contexto para desarrolladores y asistentes de IA**  
> **Proyecto:** Migración y modernización completa del sistema de gestión  
> **Cliente:** Cooperativa el Triunfo, R.L (República Dominicana)  
> **Fecha inicio:** Julio 2026  
> **Duración V1:** 24 semanas  
> **Equipo:** 2 desarrolladores full-time

---

## 📋 Resumen Ejecutivo

**Objetivo:** Reescribir desde cero el sistema de gestión de cooperativa de ahorro y crédito, reemplazando un sistema PHP antiguo (2010-2015) por una aplicación web moderna con arquitectura React + Node.js + PostgreSQL.

**Contexto crítico:**
- ❌ **NO hay acceso al código fuente** del sistema viejo (solo acceso web)
- ✅ Sistema actual documentado mediante análisis funcional (ver `ANALISIS-SISTEMA-ACTUAL.md`)
- ✅ Sistema maneja **9,585 socios activos** y **$145K USD** en préstamos
- ✅ Migración de datos será crítica (validación exhaustiva de saldos)
- ✅ Diseño 100% nuevo con enfoque minimalista moderno 2026

---

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

**Frontend:**
```
- React 18.3+ (Hooks, Context API, Suspense)
- TypeScript 5.x (modo strict)
- React Router v6 (routing)
- TanStack Query v5 (formerly React Query - server state)
- Zustand (client state - alternativa ligera a Redux)
- Tailwind CSS v4 (utility-first CSS)
- Shadcn/ui + Radix UI (componentes headless accesibles)
- Framer Motion (animaciones sutiles)
- React Hook Form + Zod (forms + validación)
- date-fns (manejo de fechas)
- Recharts o Chart.js (gráficos)
```

**Backend:**
```
- Node.js 20 LTS
- Express.js 4.x
- Prisma ORM (generación de tipos, migraciones)
- PostgreSQL 16+ (base de datos principal)
- JWT (autenticación)
- bcrypt (hash de passwords)
- winston (logging)
- express-validator (validación entrada)
```

**Infraestructura:**
```
- Docker + Docker Compose (desarrollo)
- GitHub Actions (CI/CD)
- Codacy (calidad código)
- Trivy (seguridad)
- Jest + React Testing Library (testing)
- Playwright (E2E testing)
```

### Arquitectura de Carpetas

```
cooperativa-app/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # Componentes base (Button, Input, Modal, etc.)
│   │   │   ├── forms/           # Componentes de formularios
│   │   │   ├── tables/          # Tablas con sorting/filtering
│   │   │   ├── layouts/         # Layouts (DashboardLayout, AuthLayout)
│   │   │   └── features/        # Componentes por módulo
│   │   ├── pages/               # Páginas por ruta
│   │   ├── hooks/               # Custom hooks
│   │   ├── lib/                 # Utilidades y configuración
│   │   ├── store/               # Zustand stores
│   │   ├── services/            # API calls (React Query)
│   │   ├── types/               # TypeScript types
│   │   └── styles/              # Tailwind config, estilos globales
│   ├── public/
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── controllers/         # Lógica de endpoints
│   │   ├── services/            # Lógica de negocio
│   │   ├── models/              # Prisma models
│   │   ├── middleware/          # Auth, validation, error handling
│   │   ├── routes/              # Definición de rutas
│   │   ├── utils/               # Utilidades
│   │   └── config/              # Configuración (DB, JWT, etc.)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── tests/
│   └── package.json
├── scripts/
│   ├── migracion/               # Scripts Python de migración
│   └── seeds/                   # Datos de prueba
├── docs/
│   ├── PLAN-DE-DESARROLLO.md    # Plan completo 24 semanas
│   ├── ANALISIS-SISTEMA-ACTUAL.md
│   ├── GUIA-MIGRACION.md
│   └── api/                     # Documentación de API
└── docker-compose.yml
```

---

## 🎨 Design System y UX/UI

### Filosofía de Diseño: **Minimalismo Moderno 2026**

**Principios:**
1. **Clarity First** — información clara sin ruido visual
2. **Zero Friction** — eliminar pasos innecesarios
3. **Cognitive Load Reduction** — mostrar solo lo necesario en cada contexto
4. **Predictable Interactions** — patrones consistentes
5. **Accessibility by Default** — WCAG 2.1 AA desde día 1

### Paleta de Colores

```css
/* Primary - Azul índigo (confianza, profesionalismo) */
--color-primary-50:  #EEF2FF;
--color-primary-500: #4F46E5;  /* MAIN */
--color-primary-600: #4338CA;
--color-primary-700: #3730A3;

/* Success - Verde esmeralda */
--color-success-500: #10B981;

/* Warning - Ámbar */
--color-warning-500: #F59E0B;

/* Error - Rojo coral */
--color-error-500: #EF4444;

/* Neutrals - Grises cálidos */
--color-gray-50:  #F9FAFB;  /* Fondos claros */
--color-gray-100: #F3F4F6;  /* Hover states */
--color-gray-200: #E5E7EB;  /* Bordes sutiles */
--color-gray-400: #9CA3AF;  /* Textos secundarios */
--color-gray-600: #4B5563;  /* Textos principales */
--color-gray-900: #111827;  /* Headings */
```

### Tipografía

```css
/* UI y body text */
font-family: 'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif;

/* Números, datos, montos */
font-family: 'JetBrains Mono', 'Roboto Mono', monospace;

/* Escala tipográfica */
--text-xs:   0.75rem;   /* 12px - Labels pequeños */
--text-sm:   0.875rem;  /* 14px - Body, tablas */
--text-base: 1rem;      /* 16px - Body principal */
--text-lg:   1.125rem;  /* 18px - Subtítulos */
--text-xl:   1.25rem;   /* 20px - Títulos sección */
--text-2xl:  1.5rem;    /* 24px - Page titles */
```

### Sistema de Espaciado

```
Base: 4px
4, 8, 12, 16, 24, 32, 48, 64, 96
```

### Componentes Clave

**Sidebar:**
- Colapsable (icon-only cuando colapsado)
- Ancho: 260px (expandido), 64px (colapsado)
- Menú con iconos de Lucide React
- Sección actual destacada
- Submódulos con animación smooth

**Búsqueda Global (Cmd+K):**
- Overlay modal con glassmorphism
- Búsqueda de socios por: cédula, nombre, código
- Resultados con highlighting
- Navegación con teclado (↑↓ Enter)

**Tablas:**
- Sin líneas verticales (solo horizontal subtle)
- Hover row con bg-gray-50
- Sorting en columnas (iconos sutiles)
- Paginación minimalista
- Columna de acciones sticky a la derecha

**Forms:**
- Labels sobre inputs (nunca placeholder como label)
- Estados: default, focus (border-primary), error (border-error), disabled
- Validación en tiempo real (debounced)
- Errores con iconos y color rojo
- Feedback inmediato (checkmark verde)

**Badges de Estado:**
```tsx
<Badge variant="success">Activo</Badge>
<Badge variant="warning">Suspendido</Badge>
<Badge variant="error">Moroso</Badge>
<Badge variant="neutral">Inactivo</Badge>
```

**Microinteracciones:**
- Hover: scale(1.02) en cards
- Click: scale(0.98) en botones
- Loading: skeleton screens (no spinners en contenido inicial)
- Toasts: posición top-right, auto-dismiss 4s

### Breakpoints Responsive

```
sm:  640px   /* Tablets portrait */
md:  768px   /* Tablets landscape */
lg:  1024px  /* Desktop pequeño */
xl:  1280px  /* Desktop normal */
2xl: 1536px  /* Desktop grande */
```

---

## 📊 Módulos del Sistema

### Módulo 0: Catálogos Maestros (Fase 1)
**Tablas:**
- `tipos_movimiento` (ahorro, funeraria, salud, préstamos)
- `tipos_cuenta_ahorro` (libretas en sistema viejo)
- `tipos_acuerdos_funeraria`
- `tipos_acuerdos_salud`
- `ubicaciones` (sucursales/ferias)
- `tipos_prestamo`
- `parametros_sistema` (tasa_divisa, semana_actual, etc.)

**UI:** ABM simple con tablas y formularios modales

---

### Módulo 1: Socios (Fase 2)
**Entidades principales:**
- `socios` (titular, datos personales)
- `beneficiarios` (asociados al titular)
- `documentos` (cédula, fotos, archivos)

**Funcionalidades:**
- ✅ Ficha completa del socio (tabs: Datos, Beneficiarios, Ahorro, Servicios, Préstamos, Historial)
- ✅ Búsqueda avanzada (cédula, nombre, código, ubicación)
- ✅ Registro de nuevo socio (wizard de 3 pasos)
- ✅ Gestión de beneficiarios
- ✅ Carnet digital con QR
- ✅ Historial de movimientos unificado
- ✅ Estados: activo, suspendido, inactivo, retirado

**Reglas críticas:**
- Cédula única obligatoria (11 dígitos sin guiones)
- Beneficiarios máximo 5 por socio
- Cada beneficiario debe tener parentesco definido

---

### Módulo 2: Ahorro (Fase 2)
**Entidades:**
- `cuentas_ahorro` (por socio, puede tener múltiples tipos)
- `movimientos_ahorro` (depósitos, retiros)

**Funcionalidades:**
- ✅ Consulta de saldos por tipo de cuenta
- ✅ Registro de depósitos/retiros
- ✅ Cálculo automático de disponibilidad (para fiadores)
- ✅ Historial de movimientos con filtros
- ✅ Reporte de saldos consolidados

**Reglas:**
- Saldo no puede ser negativo
- Retiro no puede exceder disponibilidad
- Disponibilidad = saldo - monto_bloqueado_fianza

---

### Módulo 3: Funeraria (Fase 2)
**Entidades:**
- `acuerdos_funeraria` (por beneficiario)
- `tipos_acuerdos_funeraria` (códigos por sucursal)
- `movimientos_funeraria` (pagos, suspensiones)

**Funcionalidades:**
- ✅ Gestión de acuerdos por beneficiario
- ✅ Cálculo automático de suspensión (6 semanas sin pago)
- ✅ Reactivación de suspendidos
- ✅ Reportes de suspendidos (23.68% actual - alto)

**Reglas críticas:**
- ⚠️ **Suspensión automática:** 6 semanas consecutivas sin pago
- ✅ Reactivación: pagar deuda + semana actual
- ✅ Cada beneficiario puede tener 1 solo acuerdo activo por tipo

---

### Módulo 4: Salud (Fase 2)
Similar a Funeraria pero con:
- ⚠️ **Suspensión:** 11 semanas sin pago (más flexible)
- ✅ Carga masiva desde Excel (plantilla predefinida)
- ✅ Generación de pagos por ubicación

---

### Módulo 5: Préstamos (Fase 2)
**Entidades:**
- `prestamos` (préstamo principal)
- `tipos_prestamo` (personal, educativo, emergencia, etc.)
- `plan_pagos` (cuotas generadas)
- `abonos` (pagos realizados)
- `fiadores` (hasta 2 fiadores)

**Funcionalidades:**
- ✅ Creación de préstamo (wizard)
- ✅ Validación automática de fiadores
- ✅ Generación de plan de pagos
- ✅ Registro de abonos (abono a capital, interés, o ambos)
- ✅ Cálculo automático de morosidad
- ✅ Reportes: por cobrar, cobrados, morosos, emitidos

**Reglas críticas:**
- ⚠️ **Fiadores obligatorios:** mínimo 1, máximo 2
- ⚠️ **Validación de fiador:** debe tener ahorro disponible ≥ 30% del monto del préstamo
- ✅ Ahorro del fiador se bloquea durante vigencia del préstamo
- ✅ Intereses: configurables por tipo de préstamo
- ✅ Mora: configurable (ej: 2% mensual sobre saldo vencido)
- ✅ Morosidad: préstamo con >2 cuotas vencidas

**Estados:**
- `activo` - en vigencia
- `saldado` - pagado completo
- `moroso` - con cuotas vencidas
- `refinanciado` - reemplazado por nuevo préstamo

---

### Módulo 6: Colecta/Caja (Fase 3) ⭐ **CRÍTICO**
**Entidades:**
- `colecta` (encabezado de colecta diaria)
- `colecta_detalle` (líneas por servicio)
- `cierres_caja` (cierre del operador)
- `consolidados` (cierre global oficina)

**Funcionalidades:**
- ✅ Colecta rápida por socio (UI optimizada)
- ✅ Captura de pagos: ahorro, funeraria, salud, préstamos
- ✅ Búsqueda rápida de socio (autocomplete)
- ✅ Confirmación visual inmediata (toast + checkmark)
- ✅ Cierre de caja individual
- ✅ Cierre de caja oficina (consolidado)
- ✅ Reporte de colecta del día
- ✅ Carga desde archivo TXT (legacy)
- ✅ Asiento contable automático

**Reglas críticas:**
- ⚠️ **Performance:** Este es el proceso más usado (cientos de transacciones diarias)
- ✅ Búsqueda de socio: <300ms
- ✅ Registro de pago: <500ms
- ✅ Tasa del día: mostrada siempre visible (ej: "Tasa: 700.22 Bs/USD")
- ✅ Shortcuts de teclado: F2 (nueva colecta), Esc (cancelar), Enter (confirmar)
- ✅ Últimos 5 socios procesados: acceso rápido
- ✅ Colecta simple: pago de múltiples semanas de deuda en un click

**UX/UI especial:**
```
┌─────────────────────────────────────────────────┐
│  COLECTA DIARIA         Tasa: 700.22  [F2] Nueva│
├─────────────────────────────────────────────────┤
│  Buscar socio: [___________________] (Cmd+K)    │
│                                                  │
│  SOCIO ENCONTRADO                                │
│  📋 Juan Pérez González                          │
│  🆔 012-3456789-0                                │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ ☑ Ahorro       $5.00   [___]            │   │
│  │ ☑ Funeraria    $2.50   [___] (3 sem)    │   │
│  │ ☐ Salud        $1.50   [___]            │   │
│  │ ☑ Préstamo     $25.00  [___]            │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  TOTAL: $32.50   [Confirmar (Enter)] [Cancelar] │
└─────────────────────────────────────────────────┘
```

---

### Módulo 7: Bóveda (Fase 3) 🆕 **NUEVO**
**Entidades:**
- `boveda_movimientos` (entrada/salida de efectivo)
- `boveda_inventario` (saldo actual por denominación)

**Funcionalidades:**
- ✅ Registro de entrada de efectivo (USD y Bs)
- ✅ Registro de salida de efectivo
- ✅ Inventario por denominación (billetes/monedas)
- ✅ Arqueo de caja (conteo físico vs sistema)
- ✅ Reportes de diferencias
- ✅ Historial de movimientos

**Reglas:**
- ✅ Solo usuarios con permiso `boveda:admin` pueden acceder
- ✅ Todo movimiento debe tener justificación
- ✅ Arqueo diario obligatorio

---

### Módulo 8: Cajero Digital (Fase 4)
**Entidades:**
- `usuarios_digitales` (credenciales para pago web)
- `pagos_web` (pagos recibidos online)
- `conciliacion` (matcheo pago web ↔ sistema)

**Funcionalidades:**
- ✅ Gestión de usuarios digitales (crear/desactivar)
- ✅ Registro de pagos recibidos
- ✅ Conciliación automática (por cédula)
- ✅ Reportes: cobros del día, pendientes de conciliar
- ✅ Notificación al socio (email/SMS) cuando se recibe pago

**Integraciones:**
- ✅ API bancaria (si disponible) para confirmación automática
- ✅ Fallback: carga manual desde Excel/CSV

---

### Módulos Fase 2 (Posterior a 24 semanas)
- **Módulo 9: Inventario** (4 semanas-persona)
- **Módulo 10: Citas** (3 semanas-persona)
- **Módulo 11: Asamblea** (1 semana-persona)
- **Módulo 12: Mensajería/Recordatorios** 🆕 (3 semanas-persona)

---

## 💾 Modelo de Datos Crítico

### Tasa Semanal (CRÍTICO)
El sistema maneja dual-currency (USD + Bs). Al inicio de cada semana:
1. Administrador ingresa nueva tasa (ej: 700.22)
2. Sistema recalcula **automáticamente** todos los saldos y cuotas en Bs
3. La tasa se almacena en `parametros_sistema.tasa_divisa`

**Esquema sugerido:**
```sql
CREATE TABLE parametros_sistema (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER REFERENCES usuarios(id)
);

-- Registro ejemplo
INSERT INTO parametros_sistema (clave, valor, descripcion) 
VALUES ('tasa_divisa', '700.22', 'Tasa de cambio Bs/USD');

CREATE TABLE historico_tasas (
    id SERIAL PRIMARY KEY,
    tasa DECIMAL(10,4) NOT NULL,
    fecha_vigencia DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES usuarios(id)
);
```

### Estados de Suspensión
```sql
CREATE TYPE estado_servicio AS ENUM (
    'activo',
    'suspendido',
    'retirado'
);

-- Acuerdos funeraria
CREATE TABLE acuerdos_funeraria (
    id SERIAL PRIMARY KEY,
    beneficiario_id INTEGER REFERENCES beneficiarios(id),
    tipo_acuerdo_id INTEGER REFERENCES tipos_acuerdos_funeraria(id),
    estado estado_servicio DEFAULT 'activo',
    semanas_sin_pago INTEGER DEFAULT 0,
    fecha_suspension DATE NULL,
    -- Regla: si semanas_sin_pago >= 6 → estado = 'suspendido'
    CONSTRAINT check_suspension CHECK (
        (estado = 'suspendido' AND semanas_sin_pago >= 6) OR
        (estado != 'suspendido')
    )
);
```

### Fiadores y Bloqueo de Ahorro
```sql
CREATE TABLE fiadores (
    id SERIAL PRIMARY KEY,
    prestamo_id INTEGER REFERENCES prestamos(id),
    socio_id INTEGER REFERENCES socios(id),
    monto_garantizado DECIMAL(10,2) NOT NULL,
    monto_bloqueado DECIMAL(10,2) NOT NULL, -- del ahorro
    estado VARCHAR(20) DEFAULT 'activo', -- activo, liberado
    created_at TIMESTAMP DEFAULT NOW()
);

-- Trigger: al crear fiador, bloquear monto en su ahorro
CREATE OR REPLACE FUNCTION bloquear_ahorro_fiador()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cuentas_ahorro
    SET monto_bloqueado = monto_bloqueado + NEW.monto_bloqueado
    WHERE socio_id = NEW.socio_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bloquear_ahorro
AFTER INSERT ON fiadores
FOR EACH ROW EXECUTE FUNCTION bloquear_ahorro_fiador();
```

---

## 🔒 Autenticación y Permisos

### Roles
```
- superadmin: acceso total
- admin: gestión de usuarios, parámetros, reportes
- supervisor: cierres de caja, consolidados, reportes
- operador_caja: colecta, búsqueda socios
- analista_prestamos: gestión de préstamos
- operador_cajero_digital: solo cajero digital
- consulta: solo lectura (reportes)
```

### Permisos Granulares
```typescript
// Ejemplo de estructura de permisos
interface Permiso {
  modulo: string;      // 'socios', 'prestamos', 'colecta', etc.
  accion: 'read' | 'create' | 'update' | 'delete';
}

// Ejemplo: operador_caja
const permisos_operador_caja: Permiso[] = [
  { modulo: 'socios', accion: 'read' },
  { modulo: 'colecta', accion: 'create' },
  { modulo: 'colecta', accion: 'read' },
  { modulo: 'cierre_caja', accion: 'create' },
  // NO tiene update ni delete en ningún módulo
];
```

---

## 📏 Convenciones de Código

### Naming Conventions

**TypeScript/React:**
```typescript
// Componentes: PascalCase
export const SocioCard = () => { ... }

// Hooks: camelCase con prefijo 'use'
export const useSocios = () => { ... }

// Constantes: UPPER_SNAKE_CASE
const MAX_FIADORES = 2;

// Variables/funciones: camelCase
const fetchSocioById = async (id: number) => { ... }

// Tipos/Interfaces: PascalCase
interface Socio { ... }
type PrestamoEstado = 'activo' | 'saldado' | 'moroso';
```

**SQL/Prisma:**
```sql
-- Tablas: snake_case plural
CREATE TABLE socios (...);
CREATE TABLE acuerdos_funeraria (...);

-- Columnas: snake_case
socio_id, fecha_creacion, monto_bloqueado

-- PKs: 'id' (serial)
-- FKs: [tabla_singular]_id (ej: socio_id)

-- Índices: idx_[tabla]_[columnas]
CREATE INDEX idx_socios_cedula ON socios(cedula);
CREATE INDEX idx_prestamos_socio_estado ON prestamos(socio_id, estado);
```

### Estructura de Componentes React
```typescript
// 1. Imports
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

// 2. Types
interface SocioCardProps {
  socio: Socio;
  onEdit?: (id: number) => void;
}

// 3. Component
export const SocioCard = ({ socio, onEdit }: SocioCardProps) => {
  // 3.1 Hooks
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 3.2 Queries/Mutations
  const { data: beneficiarios } = useQuery({
    queryKey: ['beneficiarios', socio.id],
    queryFn: () => fetchBeneficiarios(socio.id),
  });
  
  // 3.3 Effects
  useEffect(() => {
    // ...
  }, []);
  
  // 3.4 Handlers
  const handleEdit = () => {
    onEdit?.(socio.id);
  };
  
  // 3.5 Render
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      {/* ... */}
    </div>
  );
};
```

### API Endpoints RESTful
```
GET    /api/socios              # Listar socios (con paginación y filtros)
GET    /api/socios/:id          # Obtener socio por ID
POST   /api/socios              # Crear nuevo socio
PUT    /api/socios/:id          # Actualizar socio completo
PATCH  /api/socios/:id          # Actualizar campos parciales
DELETE /api/socios/:id          # Eliminar socio (soft delete)

# Recursos anidados
GET    /api/socios/:id/beneficiarios
POST   /api/socios/:id/beneficiarios
GET    /api/socios/:id/historial

# Acciones especiales (POST para acciones no-CRUD)
POST   /api/prestamos/:id/abonar
POST   /api/acuerdos/:id/reactivar
POST   /api/caja/cerrar
```

### Respuestas de API
```typescript
// Success (200, 201)
{
  success: true,
  data: { ... },
  meta?: { page: 1, perPage: 20, total: 100 }
}

// Error (400, 404, 500)
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Cédula inválida',
    details: [
      { field: 'cedula', message: 'Debe tener 11 dígitos' }
    ]
  }
}
```

---

## 🧪 Testing

### Testing Strategy

**Unit Tests (Jest):**
```typescript
// Utilities, hooks, services
describe('calcularDisponibilidadAhorro', () => {
  it('debe restar monto bloqueado del saldo', () => {
    const disponibilidad = calcularDisponibilidadAhorro({
      saldo: 1000,
      monto_bloqueado: 300
    });
    expect(disponibilidad).toBe(700);
  });
});
```

**Component Tests (React Testing Library):**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SocioCard } from './SocioCard';

describe('SocioCard', () => {
  it('debe mostrar información del socio', () => {
    render(<SocioCard socio={mockSocio} />);
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  });
  
  it('debe llamar onEdit al hacer click en editar', () => {
    const handleEdit = jest.fn();
    render(<SocioCard socio={mockSocio} onEdit={handleEdit} />);
    
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(handleEdit).toHaveBeenCalledWith(mockSocio.id);
  });
});
```

**E2E Tests (Playwright):**
```typescript
import { test, expect } from '@playwright/test';

test('flujo completo de colecta', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=username]', 'caja1');
  await page.fill('[name=password]', 'test123');
  await page.click('button[type=submit]');
  
  // Ir a colecta
  await page.click('text=Colecta');
  
  // Buscar socio
  await page.fill('[placeholder="Buscar socio..."]', '012-3456789-0');
  await page.click('text=Juan Pérez González');
  
  // Registrar pago
  await page.fill('[name=monto_ahorro]', '5.00');
  await page.click('button:has-text("Confirmar")');
  
  // Validar toast de éxito
  await expect(page.locator('.toast')).toContainText('Pago registrado');
});
```

### Cobertura Mínima
- Unit tests: 80%+
- Integration tests: 60%+
- E2E tests: flujos críticos (login, colecta, crear préstamo, cierre caja)

---

## 🚀 Comandos de Desarrollo

### Setup Inicial
```bash
# Clonar repo
git clone https://github.com/cooperativa-triunfo/sistema-gestion.git
cd sistema-gestion

# Instalar dependencias
cd frontend && npm install
cd ../backend && npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales locales

# Levantar Docker (PostgreSQL)
docker-compose up -d

# Ejecutar migraciones
cd backend
npx prisma migrate dev

# Seed de datos de prueba
npx prisma db seed
```

### Desarrollo
```bash
# Frontend (puerto 3000)
cd frontend
npm run dev

# Backend (puerto 5000)
cd backend
npm run dev

# Storybook (puerto 6006)
cd frontend
npm run storybook
```

### Testing
```bash
# Unit + integration tests
npm run test

# Tests en modo watch
npm run test:watch

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E en modo UI (útil para debugging)
npm run test:e2e:ui
```

### Calidad de Código
```bash
# Linting
npm run lint

# Format
npm run format

# Type checking
npm run type-check

# Todo junto (pre-commit)
npm run check
```

---

## 📚 Documentación Relacionada

- **[PLAN-DE-DESARROLLO.md](./PLAN-DE-DESARROLLO.md)** — Plan detallado de 24 semanas con fases, módulos, DoD
- **[ANALISIS-SISTEMA-ACTUAL.md](./ANALISIS-SISTEMA-ACTUAL.md)** — Inventario completo del sistema viejo (84 funcionalidades)
- **[GUIA-MIGRACION.md](./GUIA-MIGRACION.md)** — Estrategia de migración de datos con scripts y validaciones

---

## 🎯 Datos Clave del Sistema Actual

**Escala:**
- 👥 **9,585** socios activos
- 👥 **2,173** socios inactivos
- 📋 **9,282** acuerdos funeraria (23.68% suspendidos - ⚠️ alto)
- 📋 **5,614** acuerdos salud (10.94% suspendidos)
- 💰 **$145,546.95 USD** en préstamos por cobrar
- 💰 **Bs 17,372,294.86** en préstamos por cobrar
- 📊 **Tasa actual:** 700.22 Bs/USD

**Proceso más crítico:** Colecta diaria (cientos de transacciones/día)

**Regla más importante:** Validación de fiadores (disponibilidad de ahorro ≥ 30% del préstamo)

---

## ⚠️ Puntos Críticos para Developers

### 1. Performance en Colecta
- **Objetivo:** Búsqueda de socio <300ms, registro de pago <500ms
- **Optimización:** Índices en `socios.cedula`, `socios.nombre`
- **Caching:** React Query con staleTime de 5 minutos para datos de socios

### 2. Migración de Datos Sin Pérdida
- **Crítico:** Los $145K en préstamos deben migrar exactamente
- **Validación:** Scripts con asserts en Python (ver `GUIA-MIGRACION.md`)
- **Backup:** Triple backup antes de Go Live

### 3. Cálculo de Suspensiones
- **Funeraria:** 6 semanas sin pago → suspensión automática
- **Salud:** 11 semanas sin pago → suspensión automática
- **Implementar:** Job nocturno que recalcula estados

### 4. Tasa Semanal
- **No olvidar:** Sistema dual-currency
- **Recálculo:** Al cambiar tasa, trigger que actualiza todos los saldos en Bs
- **UI:** Tasa siempre visible en header (ej: "Tasa: 700.22")

### 5. Seguridad
- **NUNCA:** Hardcodear passwords
- **SIEMPRE:** JWT en httpOnly cookies (no localStorage)
- **OBLIGATORIO:** Audit log de todas las operaciones financieras

---

## 🤝 Flujo de Trabajo Git

### Branches
```
main           # Producción (protegida, solo PRs aprobados)
develop        # Integración (código estable)
feature/*      # Nuevas funcionalidades
bugfix/*       # Correcciones de bugs
hotfix/*       # Fixes urgentes a producción
```

### Commits Convencionales
```
feat: agregar módulo de colecta
fix: corregir cálculo de suspensión en funeraria
docs: actualizar README con instrucciones de setup
refactor: extraer lógica de validación de fiadores a service
test: agregar tests para calcularDisponibilidadAhorro
chore: actualizar dependencias
```

### Pull Requests
- 🔍 **Code review obligatorio** (1 aprobación mínimo)
- ✅ **CI debe pasar:** tests, lint, type-check, Codacy, Trivy
- 📝 **Descripción clara:** qué cambia, por qué, cómo probar
- 🔗 **Link a issue:** Closes #123

---

## 📞 Contacto y Soporte

**Product Owner:** Ing. Katherine Martínez (Cooperativa el Triunfo, R.L)  
**Tech Lead:** [TBD]  
**Developers:** [TBD]  

**Canales:**
- Slack: `#cooperativa-dev`
- Daily standup: 9:00 AM (15 min)
- Sprint planning: Lunes 10:00 AM
- Retrospective: Viernes 4:00 PM

---

## 📅 Timeline de Referencia

```
Fase 0: Descubrimiento         → Sem 1-2   (2 sem)
Fase 1: Fundación              → Sem 3-5   (3 sem)
Fase 2: Socios y Servicios     → Sem 6-12  (7 sem)
Fase 3: Operación Financiera   → Sem 13-19 (7 sem)
Fase 4: Cajero Digital + QA    → Sem 20-24 (5 sem)
UAT y Go Live                  → Post Sem 24 (4-8 sem)
```

**Fecha estimada Go Live:** Enero 2027

---

## 🎓 Recursos de Aprendizaje

**Si eres nuevo en el proyecto, lee en este orden:**
1. Este documento (CONTEXTO-PROYECTO.md) — visión general
2. PLAN-DE-DESARROLLO.md — plan detallado de 24 semanas
3. ANALISIS-SISTEMA-ACTUAL.md — funcionalidades del sistema viejo
4. Docs de API (cuando estén disponibles)
5. Storybook de componentes UI

**Tech stack específico:**
- [React 18 Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Prisma Docs](https://www.prisma.io/docs)

---

**Última actualización:** 2026-07-09  
**Versión:** 1.0.0  
**Mantenido por:** Equipo de Desarrollo Cooperativa el Triunfo

---

## 🤖 Nota para Asistentes de IA

Si eres un asistente de IA (Claude, ChatGPT, Copilot, etc.) trabajando con un desarrollador en este proyecto:

✅ **Prioriza siempre:**
1. Performance en el módulo de Colecta (proceso crítico diario)
2. Validación exhaustiva en migración de datos financieros
3. Accesibilidad (WCAG 2.1 AA) en todos los componentes
4. Seguridad en operaciones financieras (audit logs obligatorios)

✅ **Usa este stack (NO sugieras alternativas sin consultar):**
- Frontend: React 18 + TypeScript + Tailwind CSS + Shadcn/ui
- Backend: Node.js + Express + Prisma
- DB: PostgreSQL

✅ **Sigue las convenciones de código** definidas en este documento

✅ **Cuando generes código:**
- TypeScript en modo strict (sin `any`)
- Componentes funcionales con hooks (no class components)
- Naming en español para entidades de negocio (`Socio`, `Préstamo`, `Colecta`)
- Naming en inglés para componentes técnicos (`Button`, `Modal`, `useQuery`)
- Comentarios en español en lógica de negocio compleja

✅ **Consulta los documentos relacionados** cuando el desarrollador pregunte sobre:
- Fases y timeline → `PLAN-DE-DESARROLLO.md`
- Funcionalidades del sistema viejo → `ANALISIS-SISTEMA-ACTUAL.md`
- Migración de datos → `GUIA-MIGRACION.md`

---

¡Bienvenido al equipo! 🚀
