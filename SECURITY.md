# 🔒 Política de Seguridad

## 🚨 Reportar una Vulnerabilidad

**IMPORTANTE:** Si encuentras una vulnerabilidad de seguridad, **NO abras un issue público**.

### Proceso de Reporte Confidencial

1. **Envía un email a:** security@cooperativatriunfo.org (o el contacto designado)
2. **Incluye:**
   - Descripción detallada de la vulnerabilidad
   - Pasos para reproducir el problema
   - Versión afectada
   - Posible impacto
   - Solución propuesta (si tienes una)

3. **Respuesta esperada:**
   - Acuse de recibo: < 48 horas
   - Evaluación inicial: < 5 días laborables
   - Fix y disclosure coordinado: según severidad

---

## 🛡️ Versiones Soportadas

| Versión | Soportada | Mantenimiento |
|---------|-----------|---------------|
| 0.2.x   | ✅ Sí     | Activo        |
| 0.1.x   | ⚠️ Parcial | Solo críticos |
| < 0.1   | ❌ No     | Sin soporte   |

---

## ✅ Mejores Prácticas de Seguridad

### 🔐 Autenticación y Autorización

- ✅ JWT almacenado en **httpOnly cookies** (NO localStorage)
- ✅ Validación de permisos en cada endpoint
- ✅ Rate limiting en endpoints de autenticación
- ✅ Contraseñas hasheadas con bcrypt (salt rounds ≥ 10)
- ✅ Expiración de tokens (15 min access, 7 días refresh)

### 📝 Validación de Entrada

- ✅ Validación con Zod en frontend y backend
- ✅ Sanitización de inputs antes de consultas SQL
- ✅ Prisma ORM (protección contra SQL injection)
- ✅ Validación de tipos con TypeScript strict mode

### 🗃️ Base de Datos

- ✅ Principio de mínimo privilegio (roles específicos)
- ✅ Conexiones encriptadas (SSL/TLS)
- ✅ Backups automáticos diarios
- ✅ Audit logs para operaciones financieras
- ✅ Soft deletes (no borrado físico de datos críticos)

### 🌐 API y Red

- ✅ CORS configurado correctamente
- ✅ HTTPS obligatorio en producción
- ✅ Helmet.js para headers de seguridad
- ✅ Rate limiting global y por endpoint
- ✅ Input validation en todos los endpoints

### 📦 Dependencies

- ✅ Dependabot habilitado para actualizaciones automáticas
- ✅ `npm audit` en CI/CD pipeline
- ✅ Trivy scanning para vulnerabilidades
- ✅ Revisión manual de major updates

### 🔍 Logging y Monitoring

- ✅ No loggear información sensible (passwords, tokens)
- ✅ Audit trail de operaciones financieras
- ✅ Detección de intentos de acceso no autorizado
- ✅ Alertas automáticas en eventos sospechosos

---

## ⚠️ Vulnerabilidades Conocidas

Actualmente no hay vulnerabilidades conocidas públicas.

Revisa el [CHANGELOG.md](./CHANGELOG.md) para ver correcciones de seguridad en versiones pasadas.

---

## 🚫 Prácticas Prohibidas

**NUNCA hagas esto:**

❌ Commitear credenciales o secrets en el código  
❌ Usar `any` en TypeScript (desactiva type safety)  
❌ Almacenar JWT en localStorage  
❌ Exponer stack traces en producción  
❌ Deshabilitar CORS completamente  
❌ Usar SQL raw sin sanitización  
❌ Loggear información sensible  
❌ Usar contraseñas por defecto en producción  
❌ Commitear archivos `.env` con datos reales  

---

## 🔧 Herramientas de Seguridad en Uso

| Herramienta | Propósito | Frecuencia |
|-------------|-----------|------------|
| **npm audit** | Vulnerabilidades en dependencies | Cada PR |
| **Trivy** | Container y dependency scanning | Cada PR |
| **ESLint Security Plugin** | Detección de patrones inseguros | Cada PR |
| **Codacy** | Análisis estático de código | Cada PR |
| **Dependabot** | Actualizaciones de seguridad | Semanal |
| **OWASP ZAP** | Pentesting automatizado | Mensual |

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [React Security Best Practices](https://react.dev/learn/security)
- [Prisma Security](https://www.prisma.io/docs/guides/database/advanced-database-tasks/security)

---

## 🏆 Reconocimientos

Agradecemos a los investigadores de seguridad que reportan vulnerabilidades de forma responsable.

Actualmente no tenemos un programa de bug bounty, pero reconocemos públicamente las contribuciones (con tu consentimiento).

---

**Última actualización:** 2026-07-13  
**Contacto de seguridad:** security@cooperativatriunfo.org
