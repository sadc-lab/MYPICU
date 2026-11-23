// Déploiement "étude seulement" (VITE_STUDY_ONLY=true) : seule l'autorégulation
// cérébrale est exposée, dans la coquille MyPICU (accueil, barre de navigation,
// bande patient). Les composants partagés lisent ce drapeau pour masquer ce qui
// mènerait ailleurs.
export const STUDY_ONLY = import.meta.env.VITE_STUDY_ONLY === 'true';
