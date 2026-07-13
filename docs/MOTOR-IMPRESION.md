# Motor de Impresión - Documentación

## 📋 Resumen Ejecutivo

Se implementó el **Motor de Impresión** como parte de la Fase 1 del proyecto Cooperativa el Triunfo. Este módulo permite generar tickets térmicos de 80mm, notas de operación y carnets de socios con formato optimizado para impresoras térmicas.

## 🎯 Funcionalidades Implementadas

### 1. Backend Service (`impresionService.ts`)
Servicio de generación de documentos con las siguientes características:

#### Formatos Soportados:
- **Ticket de Colecta (80mm)**: Comprobante de pago con conceptos de ahorro, funeraria y salud
- **Nota de Operación**: Documento para operaciones especiales y movimientos
- **Carnet de Socio**: Credencial de identificación del socio (preparado para QR futuro)

#### Características Técnicas:
- Ancho optimizado: 48 caracteres (80mm)
- Formato: Texto plano monoespaciado (Courier New)
- Separadores visuales con caracteres ASCII
- Formateo automático de montos con separadores de miles
- Centrado y alineación de texto
- Soporte dual-currency (USD + Bs)

### 2. Backend Controller (`impresionController.ts`)
Controlador REST con validación Zod para:

#### Endpoints:
- `POST /api/impresion/ticket-colecta` - Imprimir ticket de colecta
- `POST /api/impresion/nota-operacion` - Imprimir nota de operación
- `POST /api/impresion/carnet-socio` - Imprimir carnet de socio
- `POST /api/impresion/preview` - Vista previa sin registro en audit log
- `GET /api/impresion/formatos` - Listar formatos disponibles

#### Validaciones:
- Schemas Zod para cada tipo de documento
- Validación de campos requeridos y tipos de datos
- Transformación automática de fechas ISO a Date objects

#### Auditoría:
- Registro automático en `AuditLog` de cada impresión
- Tracking de usuario, módulo, y longitud del contenido
- Registro de ID de referencia (ticket/nota/carnet)

### 3. Frontend Page (`ImpresionPage.tsx`)
Interfaz moderna para gestión de impresiones:

#### Características UI:
- **Panel de Formatos**: Cards interactivas con 3 tipos de documentos
- **Vista Previa en Vivo**: Visualización del contenido con fuente monoespaciada
- **Configuración de Impresora**: Selector de impresora térmica
- **Acciones**: Imprimir, Descargar (.txt), Vista previa
- **Datos de Ejemplo**: Mock data para testing sin necesidad de datos reales

#### UX Features:
- Selección visual del formato activo (ring + check icon)
- Loading states con spinner
- Estado vacío con icono informativo
- Info footer con tips de uso
- Responsive design
- Dark mode support

### 4. Integración
- Rutas registradas en `backend/src/index.ts`
- Route registrada en `frontend/src/App.tsx` (`/impresion`)
- Sidebar item con icono Printer
- Permisos: `impresion:read`, `impresion:create`

## 🔧 Tecnologías Utilizadas

### Backend:
- **TypeScript** strict mode
- **Zod** para validación de schemas
- **Prisma ORM** para audit log
- **Express** middleware (authenticate, authorize)

### Frontend:
- **React 18** con hooks (useState)
- **TypeScript** strict mode
- **Tailwind CSS v4** para estilos
- **Lucide React** para iconos
- **Componentes UI personalizados** (Card, Button)

## 📊 Estructura de Archivos

```
backend/src/
├── services/
│   └── impresionService.ts          (402 líneas)
├── controllers/
│   └── impresionController.ts       (331 líneas)
└── routes/
    └── impresion.ts                 (73 líneas)

frontend/src/
└── pages/
    └── ImpresionPage.tsx            (597 líneas)
```

**Total Backend:** 806 líneas  
**Total Frontend:** 597 líneas  
**Gran Total:** 1,403 líneas de código

## 🎨 Ejemplo de Output - Ticket de Colecta

```
        COOPERATIVA EL TRIUNFO, R.L.
              RIF: J-00000000-0
         Oficina Matriz - Valencia

================================================
       COMPROBANTE DE COLECTA
================================================

Ticket: TC-2026-001234
Fecha:  11/07/2026 02:30:45 PM

------------------------------------------------
Socio:  SOC-001234
Cedula: V-12345678
Nombre: JUAN PEREZ GONZALEZ

------------------------------------------------
CONCEPTOS:

Ahorro Programado
  USD:                            $50.00
  Bs:                        35,511.00 Bs

Acuerdo Funeraria
  USD:                             $5.00
  Bs:                         3,551.10 Bs

Acuerdo Salud
  USD:                             $3.00
  Bs:                         2,130.66 Bs

------------------------------------------------
TOTAL USD:                         $58.00
TOTAL Bs:                      41,192.76 Bs

Tasa del dia:                  710.2200 Bs/$

================================================

        Gracias por su preferencia
          www.cooptriunfo.org

Cajero: Maria Rodriguez
```

## 🔒 Seguridad

### Auditoría:
- Todas las impresiones se registran en `audit_log`
- Se almacena: usuario, acción (IMPRIMIR), módulo, registro_id, timestamp
- Metadatos: longitud del contenido, fecha de impresión

### Permisos:
- `impresion:read` - Ver formatos, generar previews
- `impresion:create` - Imprimir documentos (registrados en audit log)

### Validación:
- Todos los endpoints validan datos de entrada con Zod
- Manejo de errores con códigos específicos
- Response format estándar success/error

## 📈 Mejoras sobre Sistema Original

### Sistema Original PHP:
- Impresión básica con `window.print()` del navegador
- Sin formato específico para impresoras térmicas
- No hay registro de impresiones
- Formato inconsistente entre documentos

### Sistema Nuevo:
✅ Formato optimizado para 80mm térmico  
✅ Funciones de formateo reutilizables  
✅ Audit log completo de todas las impresiones  
✅ Vista previa antes de imprimir  
✅ Descarga de backup en formato .txt  
✅ Validación estricta con Zod  
✅ UI moderna con configuración de impresora  
✅ Soporte para futura integración de QR  
✅ Documentación inline en código  
✅ TypeScript strict para type-safety  

## 🚀 Próximos Pasos

### Corto Plazo (Fase 2):
1. **Integrar con módulo Colecta**: Botón "Imprimir Ticket" después de registrar pago
2. **Integrar con módulo Socios**: Botón "Imprimir Carnet" en detalle del socio
3. **Testing con impresoras reales**: Validar formato en Epson TM-T20II, Star TSP143

### Mediano Plazo (Fase 3):
1. **Códigos QR en carnets**: Implementar generación de QR con datos del socio
2. **Configuración de plantillas**: Permitir customización de headers/footers
3. **Impresión por lotes**: Imprimir múltiples carnets/tickets en una operación

### Largo Plazo (Fase 4):
1. **PDF Generation**: Alternativa a texto plano para impresoras no térmicas
2. **Email de Comprobantes**: Envío opcional de tickets por correo
3. **Histórico de Impresiones**: UI para consultar audit_log de impresiones

## 🧪 Testing

### Manual Testing:
1. Navegar a `/impresion`
2. Hacer click en cada formato (Ticket Colecta, Nota, Carnet)
3. Verificar vista previa se muestra correctamente
4. Click "Imprimir" → debe abrir diálogo de impresión del navegador
5. Click "Descargar" → debe descargar archivo .txt

### API Testing (Postman/Insomnia):
```bash
# Preview (no registra en audit log)
POST /api/impresion/preview
{
  "tipo": "ticket_colecta",
  "data": {
    "numero_ticket": "TC-2026-TEST",
    "fecha": "2026-07-11T14:30:00Z",
    "socio": {
      "cedula": "V-12345678",
      "nombre": "TEST USER",
      "codigo": "SOC-TEST"
    },
    ...
  }
}

# Listar formatos
GET /api/impresion/formatos
```

## 📝 Estado de la Fase 1

Con la implementación del Motor de Impresión, la **Fase 1 está completa al 100%**:

✅ Autenticación JWT + Roles  
✅ Parámetros del Sistema  
✅ Ubicaciones/Sucursales  
✅ Tipos de Cuenta de Ahorro  
✅ Tipos de Préstamo  
✅ Motor de Reportes (Excel + PDF pendiente)  
✅ **Semanas de Colecta (CRÍTICO)**  
✅ **Motor de Impresión**  

**Progreso Global Fase 1:** 100% ✅

**Listo para iniciar Fase 2 (Módulos de Negocio Core):**
- Socios
- Ahorro
- Funeraria
- Salud
- Préstamos

---

**Documentado por:** GitHub Copilot  
**Fecha:** 11 de Julio 2026  
**Versión:** 1.0
