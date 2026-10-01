# MYPICU

Plateforme de monitoring clinique pour soins intensifs pédiatriques (PICU). Le projet utilise Supabase pour l'authentification, le stockage des données et la logique côté serveur.

## 🐳 Déploiement Docker

**Stack locale complète (Supabase + Envoy + Optibrain + synchronisation ICCA) :**
voir [docs/LOCAL_STACK.md](./docs/LOCAL_STACK.md), puis lancer `sh scripts/local-up.sh`.
Cette configuration utilise `docker-compose.local.yml` et ne nécessite ni Kong ni nginx.

### Anciennes configurations frontend uniquement

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
