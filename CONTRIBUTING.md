# 🤝 Guía de Contribución - Cooperativa el Triunfo

¡Gracias por tu interés en contribuir al proyecto! Esta guía te ayudará a mantener la calidad y consistencia del código.

## 📋 Tabla de Contenidos

- [Configuración del Entorno](#configuración-del-entorno)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Estándares de Código](#estándares-de-código)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Testing](#testing)

---

## 🛠️ Configuración del Entorno

### Requisitos Previos

- **Node.js** 20 LTS o superior
- **PostgreSQL** 16+
- **Docker** (opcional, para BD)
- **Git** 2.x

### Setup Inicial

```bash
# 1. Fork y clonar
git clone https://github.com/TU-USUARIO/cooperativa.git
cd cooperativa

# 2. Configurar upstream
git remote add upstream https://github.com/edwardva01/cooperativa.git

# 3. Instalar dependencias
cd backend && npm install
cd ../frontend && npm install

# 4. Variables de entorno
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Editar archivos .env con tus credenciales

# 5. Base de datos
docker-compose up -d
cd backend
npx prisma migrate dev
npx prisma db seed

# 6. Verificar instalación
npm run dev  # En backend/
npm run dev  # En frontend/
```

---

## 🔄 Flujo de Trabajo

### 1. Sincronizar con main

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### 2. Crear rama feature

```bash
git checkout -b feature/nombre-descriptivo
# o
git checkout -b fix/descripcion-del-bug
```

**Convención de nombres:**
- `feature/` - Nuevas funcionalidades
- `fix/` - Corrección de bugs
- `refactor/` - Refactorización de código
- `docs/` - Cambios en documentación
- `test/` - Añadir o corregir tests
- `chore/` - Tareas de mantenimiento

### 3. Desarrollar

```bash
# Hacer cambios
# Commits frecuentes (ver sección Commits)

# Ejecutar validaciones localmente
npm run check  # lint + format + type-check
npm run test   # tests unitarios
```

### 4. Push y PR

```bash
git push origin feature/nombre-descriptivo
# Crear Pull Request en GitHub
```

---

## 📝 Estándares de Código

### TypeScript

```typescript
// ✅ CORRECTO: Tipos explícitos, sin 'any'
interface CreateSocioDTO {
  cedula: string;
  nombre: string;
  apellido: string;
}

const crearSocio = async (data: CreateSocioDTO): Promise<Socio> => {
  // ...
};

// ❌ INCORRECTO: any, tipos implícitos
const crearSocio = async (data: any) => {
  // ...
};
```

### Naming Conventions

```typescript
// Componentes React: PascalCase
export const SocioCard = () => { ... }

// Hooks: camelCase + 'use'
export const useSocios = () => { ... }

// Entidades de negocio: Español
interface Socio { ... }
interface Préstamo { ... }

// Componentes técnicos: Inglés
const Button = () => { ... }
const Modal = () => { ... }

// Tablas DB: snake_case plural
CREATE TABLE socios (...);
CREATE TABLE acuerdos_funeraria (...);
```

### Estructura de Archivos

**Backend:**
```
src/
├── controllers/     # Lógica de negocio
├── routes/          # Definición de endpoints
├── middleware/      # Autenticación, validación
├── services/        # Servicios externos
├── utils/           # Utilidades compartidas
└── config/          # Configuración
```

**Frontend:**
```
src/
├── components/
│   ├── ui/          # Componentes reutilizables (Button, Card, etc.)
│   └── layout/      # Layout components (Header, Sidebar)
├── pages/           # Páginas principales
├── hooks/           # Custom hooks
├── services/        # API clients
├── store/           # Zustand stores
└── types/           # TypeScript types
```

### Comentarios

```typescript
// ✅ CORRECTO: Comentarios en español para lógica de negocio
// Validar que el fiador tenga ahorro disponible ≥ 30% del préstamo
const validarFiador = async (fiadorId: number, montoPrestamo: number) => {
  // ...
};

// ✅ CORRECTO: JSDoc para funciones públicas
/**
 * Crea un nuevo acuerdo de funeraria con validaciones de negocio.
 * @param data - Datos del acuerdo a crear
 * @returns Acuerdo creado con relaciones
 * @throws Error si el socio no existe o está inactivo
 */
export const crearAcuerdo = async (data: CreateAcuerdoDTO) => { ... }

// ❌ EVITAR: Comentarios obvios
// Sumar a + b
const suma = a + b;
```

---

## 💬 Commits

### Formato

```
tipo(scope): descripción corta

Descripción detallada (opcional)

Refs: #123
```

### Tipos

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `refactor`: Refactorización sin cambiar funcionalidad
- `docs`: Cambios en documentación
- `test`: Añadir o corregir tests
- `chore`: Tareas de mantenimiento
- `perf`: Mejora de performance
- `style`: Cambios de formato (no afectan lógica)

### Ejemplos

```bash
✅ feat(funeraria): agregar endpoint para cambiar estado de acuerdo
✅ fix(auth): corregir validación de token expirado
✅ refactor(socios): extraer validación de cédula a utility
✅ docs(readme): actualizar instrucciones de setup
✅ test(ahorro): agregar tests para cálculo de intereses
✅ chore(deps): actualizar Prisma a 5.22.0
```

---

## 🔀 Pull Requests

### Checklist antes de crear PR

- [ ] El código compila sin errores (`npm run build`)
- [ ] Todos los tests pasan (`npm run test`)
- [ ] Código formateado (`npm run format`)
- [ ] Sin errores de lint (`npm run lint`)
- [ ] TypeScript strict mode (`npm run type-check`)
- [ ] Variables de entorno documentadas (si añades nuevas)
- [ ] Migraciones de Prisma incluidas (si modificas schema)
- [ ] Documentación actualizada (si afecta APIs o configuración)

### Template de PR

```markdown
## 📝 Descripción

Breve descripción de los cambios realizados.

## 🎯 Tipo de cambio

- [ ] 🐛 Bug fix
- [ ] ✨ Nueva funcionalidad
- [ ] 🔨 Refactorización
- [ ] 📚 Documentación
- [ ] ✅ Tests

## 🧪 ¿Cómo probar?

1. Checkout a la rama: `git checkout feature/xxx`
2. Instalar deps: `npm install`
3. Ejecutar: ...
4. Verificar: ...

## 📸 Screenshots (si aplica)

[Capturas de pantalla]

## ✅ Checklist

- [ ] Código compila sin errores
- [ ] Tests pasan
- [ ] Código formateado
- [ ] Sin errores de lint
- [ ] Documentación actualizada

## 📌 Issues relacionados

Refs: #123
Closes: #456
```

### Review Process

1. **Auto-checks**: GitHub Actions ejecuta CI automáticamente
2. **Code Review**: Al menos 1 aprobación requerida
3. **Testing**: Verificar en ambiente de desarrollo
4. **Merge**: Squash and merge (mantiene historial limpio)

---

## 🧪 Testing

### Backend

```bash
cd backend

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

### Frontend

```bash
cd frontend

# Component tests (Vitest)
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Visual testing (Storybook)
npm run storybook
```

### Escribir Tests

```typescript
// ✅ Test unitario - Backend
describe('funerariaController', () => {
  describe('crearAcuerdo', () => {
    it('debe crear un acuerdo válido', async () => {
      const data = {
        socio_id: 1,
        tipo_acuerdo_id: 1,
        beneficiario: { ... }
      };
      
      const result = await crearAcuerdo(data);
      
      expect(result).toHaveProperty('id');
      expect(result.estado).toBe('activo');
    });

    it('debe rechazar si el socio no existe', async () => {
      const data = { socio_id: 99999, ... };
      
      await expect(crearAcuerdo(data)).rejects.toThrow('Socio no encontrado');
    });
  });
});

// ✅ Test componente - Frontend
describe('SocioCard', () => {
  it('debe renderizar información del socio', () => {
    const socio = {
      codigo_socio: 'S001',
      nombre: 'Juan',
      apellido: 'Pérez',
      cedula: '12345678'
    };
    
    render(<SocioCard socio={socio} />);
    
    expect(screen.getByText('S001')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  });
});
```

---

## 🚨 Reglas Críticas

### ❌ NUNCA hacer:

1. **Commit directo a `main`** - Siempre usar PRs
2. **Push de `.env`** - Secretos NUNCA en el repo
3. **Usar `any` en TypeScript** - Siempre tipos explícitos
4. **Modificar migraciones existentes** - Crear nuevas migraciones
5. **Commit de `node_modules/`** - Ya está en `.gitignore`
6. **Console.log en producción** - Usar `logger` del backend
7. **Saltarse validaciones de negocio** - Implementar siempre validaciones

### ✅ SIEMPRE hacer:

1. **Sincronizar con main** antes de crear rama
2. **Ejecutar tests** antes de push
3. **Validar Codacy** - 0 issues antes de PR
4. **Documentar cambios** en API o configuración
5. **Audit logs** para operaciones financieras
6. **Validación de entrada** en todos los endpoints
7. **Manejo de errores** con try/catch apropiados

---

## 📚 Recursos

- [CONTEXTO-PROYECTO.md](./CONTEXTO-PROYECTO.md) - Contexto completo del proyecto
- [PLAN-DE-DESARROLLO.md](./PLAN-DE-DESARROLLO.md) - Plan de 24 semanas
- [SETUP.md](./SETUP.md) - Setup detallado
- [Prisma Docs](https://www.prisma.io/docs)
- [React 18 Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

---

## 💡 ¿Dudas?

- **Issues técnicos**: Crear issue en GitHub
- **Discusiones**: GitHub Discussions
- **Urgente**: Contactar al lead del proyecto

---

**¡Gracias por contribuir al proyecto! 🚀**
