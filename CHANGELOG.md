# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planeado
- Módulo Salud (Fase 2, Sem 13-14)
- Módulo Préstamos (Fase 2, Sem 15-19)
- Módulo Colecta/Caja (Fase 3, Sem 13-19)
- Módulo Bóveda (Fase 3, Sem 13-19)
- Cajero Digital (Fase 4, Sem 20-24)

---

## [0.2.0] - 2026-07-13

### ✨ Agregado
- **Módulo Funeraria** completo
  - CRUD de acuerdos de funeraria
  - Sistema de suspensiones automáticas (6 semanas)
  - 7 endpoints REST API
  - UI completa con estadísticas, filtros, tabla paginada
  - Migración de 7,877 acuerdos del sistema viejo
- **CI/CD Pipeline** con GitHub Actions
  - Lint y type-check automático
  - Tests backend y frontend
  - Security scanning con Trivy
  - Prisma schema validation
  - Codacy integration
- **Documentación**
  - CONTRIBUTING.md - Guía de contribución
  - Pull Request templates
  - Issue templates (bug, feature)
  - Dependabot configuration
  - EditorConfig y .nvmrc
- **Scripts package.json**
  - `format:check` para CI
  - `type-check` para validación estricta
  - `check` para validación completa

### 🔧 Cambiado
- Actualizado .gitignore para incluir instrucciones de Codacy
- Actualizado .gitignore para incluir migraciones de Prisma
- Mejorada estructura de tipos en frontend para coincidir con API

### 🐛 Corregido
- Error de tipos en FunerariaPage (beneficiario.socio undefined)
- Error de cálculo de porcentajes en estadísticas
- Conflicto en README.md durante merge con GitHub

---

## [0.1.0] - 2026-07-11

### ✨ Agregado
- **Setup inicial del proyecto**
  - Backend: Node.js 20 + Express + Prisma ORM + PostgreSQL 16
  - Frontend: React 18 + TypeScript 5 + Tailwind CSS v4 + Vite
  - Docker Compose para PostgreSQL
- **Sistema de Autenticación**
  - JWT con httpOnly cookies
  - Roles: admin, caja, analista
  - Middleware de autorización
  - Login page con validación
- **Módulo Socios**
  - CRUD completo de socios
  - Migración de 9,028 socios del sistema viejo (94.1% éxito)
  - UI con tabla paginada, filtros y búsqueda
  - Validaciones de negocio (cédula única, código socio único)
- **Módulo Ahorro**
  - CRUD de cuentas de ahorro
  - Migración de 10,095 cuentas (99.5% éxito)
  - UI con estadísticas y filtros
  - Dual-currency (USD + Bs)
- **Infraestructura**
  - Prisma schema con 20+ modelos
  - Migraciones de base de datos
  - Seed script con datos de prueba
  - Logger centralizado
  - Error handling middleware
  - Audit log system
- **Documentación**
  - README.md completo
  - CONTEXTO-PROYECTO.md - Stack y reglas de negocio
  - PLAN-DE-DESARROLLO.md - Plan de 24 semanas
  - ANALISIS-SISTEMA-ACTUAL.md - 84 funcionalidades del sistema viejo
  - GUIA-MIGRACION.md - Scripts y proceso de migración
  - SETUP.md - Instrucciones de instalación

### 📊 Datos migrados
- 9,028 socios (94.1% de 9,585)
- 10,095 cuentas de ahorro (99.5% éxito)
- 7,877 acuerdos de funeraria (63.1% de 12,472 únicos)

---

## Categorías de Cambios

- `✨ Agregado` - Nuevas funcionalidades
- `🔧 Cambiado` - Cambios en funcionalidades existentes
- `🗑️ Deprecado` - Funcionalidades que serán removidas
- `🚫 Removido` - Funcionalidades removidas
- `🐛 Corregido` - Corrección de bugs
- `🔒 Seguridad` - Correcciones de vulnerabilidades

---

[unreleased]: https://github.com/edwardva01/cooperativa/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/edwardva01/cooperativa/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/edwardva01/cooperativa/releases/tag/v0.1.0
