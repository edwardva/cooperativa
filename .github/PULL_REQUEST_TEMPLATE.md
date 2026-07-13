## 📝 Descripción

<!-- Describe brevemente los cambios realizados -->

## 🎯 Tipo de cambio

<!-- Marca con 'x' las opciones que aplican -->

- [ ] 🐛 Bug fix (cambio que corrige un issue)
- [ ] ✨ Nueva funcionalidad (cambio que agrega funcionalidad)
- [ ] 💥 Breaking change (cambio que rompe compatibilidad)
- [ ] 🔨 Refactorización (cambio que mejora código sin cambiar funcionalidad)
- [ ] 📚 Documentación (actualización de docs)
- [ ] ✅ Tests (agregar o corregir tests)
- [ ] ⚡ Performance (mejora de rendimiento)
- [ ] 🔒 Security (mejora de seguridad)

## 🧪 ¿Cómo probar?

<!-- Instrucciones paso a paso para probar los cambios -->

1. Checkout a la rama: `git checkout [nombre-rama]`
2. Instalar dependencias: `npm install`
3. Ejecutar: ...
4. Verificar que: ...

## 📸 Screenshots (si aplica)

<!-- Agregar capturas de pantalla para cambios visuales -->

## ✅ Checklist

<!-- Marca con 'x' cuando esté completo -->

### Código
- [ ] El código compila sin errores (`npm run build`)
- [ ] Todos los tests pasan (`npm run test`)
- [ ] Código formateado (`npm run format`)
- [ ] Sin errores de lint (`npm run lint`)
- [ ] TypeScript strict mode pasa (`npm run type-check`)
- [ ] Sin warnings de compilación

### Base de Datos (si aplica)
- [ ] Migraciones de Prisma incluidas
- [ ] Seed actualizado (si es necesario)
- [ ] Schema validado (`npx prisma validate`)

### Documentación
- [ ] README actualizado (si es necesario)
- [ ] Comentarios en código crítico
- [ ] Variables de entorno documentadas (si se agregan nuevas)
- [ ] API documentada (si se modifican endpoints)

### Testing
- [ ] Tests unitarios agregados/actualizados
- [ ] Tests E2E actualizados (si aplica)
- [ ] Coverage no disminuyó significativamente

### Seguridad
- [ ] No se commitean secretos o credenciales
- [ ] Audit logs implementados (para operaciones financieras)
- [ ] Validación de entrada en endpoints
- [ ] Sin vulnerabilidades de npm audit

### Revisión
- [ ] Self-review realizado
- [ ] Código sigue las convenciones del proyecto
- [ ] Sin console.log en código de producción
- [ ] Cambios revisados en Codacy (0 issues nuevos)

## 📌 Issues relacionados

<!-- Vincular issues usando palabras clave -->

Refs: #
Closes: #
Fixes: #

## 📋 Notas adicionales

<!-- Cualquier información adicional que los reviewers deban saber -->

## 🔍 Áreas que requieren atención especial

<!-- Marcar áreas específicas donde necesitas feedback -->

---

### Checklist para Reviewers

- [ ] Código sigue estándares del proyecto
- [ ] Tests cubren casos edge
- [ ] Documentación está completa
- [ ] No hay problemas de seguridad
- [ ] Performance es aceptable
- [ ] Compatible con main
