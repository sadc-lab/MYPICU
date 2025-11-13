#!/bin/bash

# Docker Quick Start Script
# This script helps you quickly start the application in Docker

set -e

echo "🐳 Docker Quick Start for MyPICU Application"
echo "============================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your Supabase credentials."
    echo ""
    echo "Edit .env file now? (y/n)"
    read -r answer
    if [ "$answer" = "y" ]; then
        ${EDITOR:-nano} .env
    fi
fi

echo ""
echo "What would you like to do?"
echo "1) Start production build"
echo "2) Start development build (with hot reload)"
echo "3) Stop all containers"
echo "4) View logs"
echo "5) Rebuild and start"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "🚀 Starting production build..."
        docker-compose up -d
        echo "✅ Application started at http://localhost:3000"
        echo "📊 View logs with: docker-compose logs -f"
        ;;
    2)
        echo "🔧 Starting development build..."
        docker-compose -f docker-compose.dev.yml up
        ;;
    3)
        echo "🛑 Stopping containers..."
        docker-compose down
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
        echo "✅ All containers stopped"
        ;;
    4)
        echo "📊 Showing logs (Ctrl+C to exit)..."
        docker-compose logs -f
        ;;
    5)
        echo "🔨 Rebuilding and starting..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        echo "✅ Application rebuilt and started at http://localhost:3000"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
