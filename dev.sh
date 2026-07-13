#!/bin/bash

# Script para iniciar el proyecto en modo desarrollo
# Uso: ./dev.sh

set -e

echo "🚀 Iniciando Cooperativa el Triunfo - Modo Desarrollo"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar Docker
echo "🐳 Verificando Docker..."
if ! docker ps &> /dev/null; then
    echo -e "${RED}❌ Docker no está corriendo${NC}"
    echo "   Por favor, inicia Docker Desktop e intenta de nuevo"
    exit 1
fi
echo -e "${GREEN}✓ Docker está corriendo${NC}"

# Verificar si los contenedores están corriendo
if ! docker-compose ps | grep -q "Up"; then
    echo ""
    echo "📦 Iniciando contenedores..."
    docker-compose up -d
    echo "   Esperando a que PostgreSQL esté listo..."
    sleep 5
fi
echo -e "${GREEN}✓ Contenedores activos${NC}"

# Verificar migraciones
echo ""
echo "🗄️  Verificando base de datos..."
cd backend
if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "   Ejecutando migraciones..."
    npm run db:migrate -- --name init
    echo -e "${GREEN}✓ Migraciones ejecutadas${NC}"
    
    echo ""
    echo "🌱 Poblando base de datos con datos de prueba..."
    npm run db:seed
    echo -e "${GREEN}✓ Seed completado${NC}"
else
    echo -e "${GREEN}✓ Base de datos lista${NC}"
fi
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✨ Sistema listo para desarrollo${NC}"
echo ""
echo "📌 URLs:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:5000"
echo "   PgAdmin:   http://localhost:5050"
echo ""
echo "👤 Usuarios de prueba:"
echo "   admin      / password123  (Administrador - acceso total)"
echo "   caja1      / password123  (Cajero - colecta)"
echo "   analista1  / password123  (Analista - préstamos)"
echo ""
echo "🔧 Comandos útiles:"
echo "   npm run db:studio    Ver base de datos"
echo "   docker-compose logs  Ver logs de contenedores"
echo "   docker-compose down  Detener contenedores"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Iniciando servidores...${NC}"
echo ""

# Función para manejar Ctrl+C
cleanup() {
    echo ""
    echo "🛑 Deteniendo servidores..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup INT

# Iniciar backend
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Esperar un poco
sleep 2

# Iniciar frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Esperar a que terminen (nunca terminarán hasta Ctrl+C)
wait
