#!/bin/bash
set -e

echo "📦 Installation des dépendances..."
npm install

echo "🏗️  Build de l'application..."
npm run build

echo "✅ Build réussi!"
echo "📁 Output: packages/web/dist"
