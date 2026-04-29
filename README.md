# MYPICU

Plateforme de monitoring clinique pour soins intensifs pédiatriques (PICU). Le projet utilise Supabase pour l'authentification, le stockage des données et la logique côté serveur.

## 🐳 Déploiement Docker

Voir [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) pour les instructions complètes.

**Démarrage rapide :**
```bash
# Linux/Mac
chmod +x docker-start.sh
./docker-start.sh

# Windows
docker-start.bat
```

## Structure du projet

```
src/
├── types/          # Définitions TypeScript
├── services/       # Couche API et services
├── hooks/          # Hooks React Query et hooks personnalisés
├── components/     # Composants React
├── pages/          # Pages
└── utils/          # Fonctions utilitaires
```

## Développement local

Prérequis : Node.js & npm ([nvm](https://github.com/nvm-sh/nvm#installing-and-updating) recommandé).

```sh
npm install
npm run dev
```

## Stack technique

- Vite
- TypeScript
- React 18
- shadcn-ui
- Tailwind CSS
- Supabase (auth, base de données, edge functions)
