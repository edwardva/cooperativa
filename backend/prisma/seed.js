"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Iniciando seed de la base de datos...');
    console.log('📝 Creando roles...');
    const rolAdmin = await prisma.rol.upsert({
        where: { nombre: 'admin' },
        update: {},
        create: {
            nombre: 'admin',
            descripcion: 'Administrador del sistema con acceso completo',
            permisos: {
                socios: ['create', 'read', 'update', 'delete'],
                ahorro: ['create', 'read', 'update', 'delete'],
                prestamos: ['create', 'read', 'update', 'delete', 'approve'],
                colecta: ['create', 'read', 'update'],
                reportes: ['read', 'export'],
                parametros: ['read', 'update'],
                usuarios: ['create', 'read', 'update', 'delete'],
            },
        },
    });
    const rolCajero = await prisma.rol.upsert({
        where: { nombre: 'cajero' },
        update: {},
        create: {
            nombre: 'cajero',
            descripcion: 'Cajero operador de colecta',
            permisos: {
                socios: ['read'],
                colecta: ['create', 'read'],
                reportes: ['read'],
            },
        },
    });
    const rolAnalista = await prisma.rol.upsert({
        where: { nombre: 'analista' },
        update: {},
        create: {
            nombre: 'analista',
            descripcion: 'Analista de préstamos',
            permisos: {
                socios: ['create', 'read', 'update'],
                ahorro: ['read'],
                prestamos: ['create', 'read', 'update'],
                reportes: ['read', 'export'],
            },
        },
    });
    console.log('👤 Creando usuarios...');
    const passwordHash = await bcrypt_1.default.hash('password123', 12);
    await prisma.usuario.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            email: 'admin@cooperativa.com',
            password_hash: passwordHash,
            nombre_completo: 'Administrador del Sistema',
            rol_id: rolAdmin.id,
            estado: 'activo',
        },
    });
    await prisma.usuario.upsert({
        where: { username: 'caja1' },
        update: {},
        create: {
            username: 'caja1',
            email: 'caja1@cooperativa.com',
            password_hash: passwordHash,
            nombre_completo: 'María González',
            rol_id: rolCajero.id,
            estado: 'activo',
        },
    });
    await prisma.usuario.upsert({
        where: { username: 'analista1' },
        update: {},
        create: {
            username: 'analista1',
            email: 'analista@cooperativa.com',
            password_hash: passwordHash,
            nombre_completo: 'Carlos Rodríguez',
            rol_id: rolAnalista.id,
            estado: 'activo',
        },
    });
    console.log('📍 Creando ubicaciones...');
    const ubicacion1 = await prisma.ubicacion.upsert({
        where: { codigo: 'SUC001' },
        update: {},
        create: {
            codigo: 'SUC001',
            nombre: 'Sede Principal',
            direccion: 'Av. Principal, Caracas',
            telefono: '0212-1234567',
            estado: true,
        },
    });
    const ubicacion2 = await prisma.ubicacion.upsert({
        where: { codigo: 'SUC002' },
        update: {},
        create: {
            codigo: 'SUC002',
            nombre: 'Sucursal Valencia',
            direccion: 'Av. Bolívar, Valencia',
            telefono: '0241-9876543',
            estado: true,
        },
    });
    console.log('👥 Creando socios...');
    const socios = await Promise.all([
        prisma.socio.create({
            data: {
                cedula: '12345678',
                nombre: 'Juan',
                apellido: 'Pérez',
                fecha_nacimiento: new Date('1980-05-15'),
                direccion: 'Calle 1, Casa 10',
                telefono: '0414-1234567',
                email: 'juan.perez@email.com',
                fecha_inscripcion: new Date('2020-01-15'),
                estado: 'activo',
                ubicacion_id: ubicacion1.id,
            },
        }),
        prisma.socio.create({
            data: {
                cedula: '23456789',
                nombre: 'María',
                apellido: 'García',
                fecha_nacimiento: new Date('1985-08-20'),
                direccion: 'Calle 2, Casa 20',
                telefono: '0424-2345678',
                email: 'maria.garcia@email.com',
                fecha_inscripcion: new Date('2020-03-10'),
                estado: 'activo',
                ubicacion_id: ubicacion1.id,
            },
        }),
        prisma.socio.create({
            data: {
                cedula: '34567890',
                nombre: 'Pedro',
                apellido: 'Martínez',
                fecha_nacimiento: new Date('1975-12-10'),
                direccion: 'Calle 3, Casa 30',
                telefono: '0412-3456789',
                fecha_inscripcion: new Date('2019-06-20'),
                estado: 'activo',
                ubicacion_id: ubicacion2.id,
            },
        }),
        prisma.socio.create({
            data: {
                cedula: '45678901',
                nombre: 'Ana',
                apellido: 'López',
                fecha_nacimiento: new Date('1990-03-25'),
                direccion: 'Calle 4, Casa 40',
                telefono: '0416-4567890',
                email: 'ana.lopez@email.com',
                fecha_inscripcion: new Date('2021-02-15'),
                estado: 'activo',
                ubicacion_id: ubicacion1.id,
            },
        }),
        prisma.socio.create({
            data: {
                cedula: '56789012',
                nombre: 'Luis',
                apellido: 'Hernández',
                fecha_nacimiento: new Date('1988-07-30'),
                direccion: 'Calle 5, Casa 50',
                telefono: '0426-5678901',
                fecha_inscripcion: new Date('2020-09-01'),
                estado: 'activo',
                ubicacion_id: ubicacion2.id,
            },
        }),
    ]);
    console.log('💰 Creando cuentas de ahorro...');
    const tipoCuentaGeneral = await prisma.tipoCuentaAhorro.upsert({
        where: { codigo: 'AHO001' },
        update: {},
        create: {
            codigo: 'AHO001',
            nombre: 'Ahorro General',
            descripcion: 'Cuenta de ahorro principal del socio',
            estado: true,
        },
    });
    for (let i = 0; i < socios.length; i++) {
        await prisma.cuentaAhorro.create({
            data: {
                socio_id: socios[i].id,
                tipo_cuenta_id: tipoCuentaGeneral.id,
                numero_cuenta: `AH${String(i + 1).padStart(8, '0')}`,
                saldo_usd: 500 + i * 100,
                saldo_bs: (500 + i * 100) * 700.22,
                fecha_apertura: new Date('2020-01-01'),
            },
        });
    }
    console.log('👨‍👩‍👧 Creando beneficiarios...');
    const beneficiarios = await Promise.all([
        prisma.beneficiario.create({
            data: {
                socio_id: socios[0].id,
                cedula: '87654321',
                nombre: 'María',
                apellido: 'Pérez',
                fecha_nacimiento: new Date('1982-03-10'),
                parentesco: 'cónyuge',
                telefono: '0414-9876543',
                estado: 'activo',
            },
        }),
        prisma.beneficiario.create({
            data: {
                socio_id: socios[0].id,
                cedula: '98765432',
                nombre: 'Carlos',
                apellido: 'Pérez',
                fecha_nacimiento: new Date('2010-06-15'),
                parentesco: 'hijo',
                estado: 'activo',
            },
        }),
        prisma.beneficiario.create({
            data: {
                socio_id: socios[1].id,
                cedula: '11111111',
                nombre: 'José',
                apellido: 'García',
                fecha_nacimiento: new Date('1983-09-20'),
                parentesco: 'cónyuge',
                telefono: '0424-1111111',
                estado: 'activo',
            },
        }),
    ]);
    console.log('⚰️  Creando servicios de funeraria...');
    const tipoFuneraria = await prisma.tipoAcuerdoFuneraria.upsert({
        where: { codigo: 'FUN001' },
        update: {},
        create: {
            codigo: 'FUN001',
            nombre: 'Funeraria Plan Básico',
            monto_usd: 5.00,
            estado: true,
        },
    });
    for (const beneficiario of beneficiarios) {
        await prisma.acuerdoFuneraria.create({
            data: {
                beneficiario_id: beneficiario.id,
                tipo_acuerdo_id: tipoFuneraria.id,
                estado: 'activo',
                fecha_inicio: new Date('2020-01-01'),
            },
        });
    }
    console.log('🏥 Creando servicios de salud...');
    const tipoSalud = await prisma.tipoAcuerdoSalud.upsert({
        where: { codigo: 'SAL001' },
        update: {},
        create: {
            codigo: 'SAL001',
            nombre: 'Salud Plan Básico',
            monto_usd: 3.00,
            estado: true,
        },
    });
    for (const beneficiario of beneficiarios) {
        await prisma.acuerdoSalud.create({
            data: {
                beneficiario_id: beneficiario.id,
                tipo_acuerdo_id: tipoSalud.id,
                estado: 'activo',
                fecha_inicio: new Date('2020-01-01'),
            },
        });
    }
    console.log('💸 Creando préstamos...');
    const tipoPrestamo = await prisma.tipoPrestamo.upsert({
        where: { codigo: 'PRE001' },
        update: {},
        create: {
            codigo: 'PRE001',
            nombre: 'Préstamo Personal',
            descripcion: 'Préstamo personal a corto plazo',
            tasa_interes_anual: 12.00,
            tasa_mora_mensual: 2.00,
            plazo_maximo_semanas: 52,
            requiere_fiadores: true,
            estado: true,
        },
    });
    const prestamo1 = await prisma.prestamo.create({
        data: {
            socio_id: socios[0].id,
            tipo_prestamo_id: tipoPrestamo.id,
            numero_prestamo: 'PRE00000001',
            monto_original_usd: 1000.00,
            monto_original_bs: 700220.00,
            tasa_cambio_inicial: 700.22,
            tasa_interes: 12.00,
            plazo_semanas: 26,
            cuota_semanal_usd: 42.31,
            cuota_semanal_bs: 29621.98,
            saldo_capital_usd: 800.00,
            saldo_capital_bs: 560176.00,
            estado: 'activo',
            fecha_desembolso: new Date('2024-01-15'),
            fecha_vencimiento: new Date('2024-07-15'),
        },
    });
    await prisma.fiador.create({
        data: {
            prestamo_id: prestamo1.id,
            socio_id: socios[1].id,
            monto_garantizado_usd: 300.00,
            monto_garantizado_bs: 210066.00,
            monto_bloqueado_usd: 300.00,
            monto_bloqueado_bs: 210066.00,
            estado: 'activo',
        },
    });
    console.log('⚙️  Configurando parámetros del sistema...');
    await prisma.parametroSistema.upsert({
        where: { clave: 'TASA_CAMBIO_USD_BS' },
        update: { valor: '700.22' },
        create: {
            clave: 'TASA_CAMBIO_USD_BS',
            valor: '700.22',
            descripcion: 'Tasa de cambio actual USD a Bs',
            tipo_dato: 'number',
        },
    });
    await prisma.parametroSistema.upsert({
        where: { clave: 'SEMANAS_SUSPENSION_FUNERARIA' },
        update: { valor: '6' },
        create: {
            clave: 'SEMANAS_SUSPENSION_FUNERARIA',
            valor: '6',
            descripcion: 'Semanas sin pago para suspender servicio de funeraria',
            tipo_dato: 'number',
        },
    });
    await prisma.parametroSistema.upsert({
        where: { clave: 'SEMANAS_SUSPENSION_SALUD' },
        update: { valor: '11' },
        create: {
            clave: 'SEMANAS_SUSPENSION_SALUD',
            valor: '11',
            descripcion: 'Semanas sin pago para suspender servicio de salud',
            tipo_dato: 'number',
        },
    });
    await prisma.parametroSistema.upsert({
        where: { clave: 'PORCENTAJE_AHORRO_FIADOR' },
        update: { valor: '30' },
        create: {
            clave: 'PORCENTAJE_AHORRO_FIADOR',
            valor: '30',
            descripcion: 'Porcentaje mínimo de ahorro que debe tener el fiador',
            tipo_dato: 'number',
        },
    });
    await prisma.historicoTasaCambio.create({
        data: {
            tasa: 700.22,
            fecha_vigencia: new Date(),
        },
    });
    console.log('✅ Seed completado exitosamente!');
    console.log('');
    console.log('📊 Resumen de datos creados:');
    console.log(`   - ${await prisma.rol.count()} roles`);
    console.log(`   - ${await prisma.usuario.count()} usuarios`);
    console.log(`   - ${await prisma.ubicacion.count()} ubicaciones`);
    console.log(`   - ${await prisma.socio.count()} socios`);
    console.log(`   - ${await prisma.beneficiario.count()} beneficiarios`);
    console.log(`   - ${await prisma.cuentaAhorro.count()} cuentas de ahorro`);
    console.log(`   - ${await prisma.acuerdoFuneraria.count()} acuerdos de funeraria`);
    console.log(`   - ${await prisma.acuerdoSalud.count()} acuerdos de salud`);
    console.log(`   - ${await prisma.prestamo.count()} préstamos`);
    console.log(`   - ${await prisma.fiador.count()} fiadores`);
    console.log('');
    console.log('👤 Usuarios de prueba:');
    console.log('   - admin / password123 (Administrador)');
    console.log('   - caja1 / password123 (Cajero)');
    console.log('   - analista1 / password123 (Analista)');
}
main()
    .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map