#!/bin/bash

# Volzo Mobility - Quick Start Script
# This script sets up the development environment

set -e

echo "🚀 Volzo Mobility - Quick Start Setup"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js is not installed${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is not installed${NC}"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is not installed${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}❌ Docker Compose is not installed${NC}"; exit 1; }

echo -e "${GREEN}✅ All prerequisites installed${NC}"
echo ""

# Start PostgreSQL with Docker
echo "🐘 Starting PostgreSQL..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Backend setup
echo ""
echo "🔧 Setting up Backend..."
cd backend

if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your credentials${NC}"
fi

echo "📦 Installing backend dependencies..."
npm install

echo "🗄️  Setting up database..."
npx prisma generate
npx prisma migrate dev --name init

echo -e "${GREEN}✅ Backend setup complete${NC}"
cd ..

# Rider App setup
echo ""
echo "📱 Setting up Rider App..."
cd rider-app

if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit rider-app/.env with your credentials${NC}"
fi

if command -v flutter >/dev/null 2>&1; then
    echo "📦 Installing Flutter dependencies..."
    flutter pub get
    echo -e "${GREEN}✅ Rider app setup complete${NC}"
else
    echo -e "${YELLOW}⚠️  Flutter not installed. Skipping rider app setup${NC}"
fi
cd ..

# Driver App setup
echo ""
echo "🚗 Setting up Driver App..."
cd driver-app

if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

if command -v flutter >/dev/null 2>&1; then
    echo "📦 Installing Flutter dependencies..."
    flutter pub get
    echo -e "${GREEN}✅ Driver app setup complete${NC}"
else
    echo -e "${YELLOW}⚠️  Flutter not installed. Skipping driver app setup${NC}"
fi
cd ..

# Admin Dashboard setup
echo ""
echo "💻 Setting up Admin Dashboard..."
cd admin-dashboard

if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

if [ -f package.json ]; then
    echo "📦 Installing admin dashboard dependencies..."
    npm install
    echo -e "${GREEN}✅ Admin dashboard setup complete${NC}"
else
    echo -e "${YELLOW}⚠️  Admin dashboard not yet implemented${NC}"
fi
cd ..

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "======================================"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Configure environment variables:"
echo "   - backend/.env"
echo "   - rider-app/.env"
echo "   - driver-app/.env"
echo ""
echo "2. Start the backend server:"
echo "   cd backend && npm run dev"
echo ""
echo "3. Start the Flutter apps:"
echo "   cd rider-app && flutter run"
echo "   cd driver-app && flutter run"
echo ""
echo "4. Access services:"
echo "   - Backend API: http://localhost:3000"
echo "   - API Docs: http://localhost:3000/api-docs"
echo "   - Database: localhost:5432"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Project overview"
echo "   - SETUP_GUIDE.md - Detailed setup instructions"
echo "   - API_ENDPOINTS.md - API reference"
echo "   - IMPLEMENTATION_CHECKLIST.md - Development roadmap"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "   - Configure Firebase credentials"
echo "   - Add Google Maps API key"
echo "   - Update UPI payment details"
echo ""
echo "🚀 Happy coding!"
