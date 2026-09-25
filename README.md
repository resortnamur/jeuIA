# Jeu IA en chaîne

Site collaboratif pour un exercice de formation à la programmation assistée par IA.

## Ce que fait le site

- affiche et fait jouer directement la dernière version du jeu ;
- télécharge la dernière version HTML ;
- permet à un collègue de déposer une nouvelle version ;
- enregistre son nom, sa description de modification et la date ;
- conserve tout l'historique ; la page affiche les 5 dernières versions et la version originale ;
- permet de rejouer et retélécharger chacune de ces versions ;
- interdit, via les règles Supabase fournies, la modification ou la suppression des anciennes versions depuis l'interface publique.

## 1. Relier la base de données

### A. Créer la base

1. Crée un projet gratuit sur Supabase.
2. Ouvre **SQL Editor**.
3. Copie-colle le contenu de `supabase.sql` et exécute-le.

### B. Relier le site

Dans Supabase :

1. ouvre les paramètres du projet / API ;
2. récupère l'URL du projet ;
3. récupère la clé publique `anon` / `publishable` ;
4. ouvre `config.js` et complète :

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://TON-PROJET.supabase.co",
  SUPABASE_ANON_KEY: "TA_CLE_PUBLIQUE"
};
```

Ne mets jamais une clé `service_role` dans le site.

## 2. Publier avec GitHub Pages

1. Crée un dépôt GitHub.
2. Dépose à la racine : `index.html`, `styles.css`, `app.js`, `config.js`, `starter-game.html`.
3. Dans GitHub : **Settings > Pages**.
4. Choisis le déploiement depuis la branche principale (`main`) et le dossier racine.
5. GitHub fournit ensuite l'adresse du site.

## Fonctionnement des versions

- la version initiale est créée automatiquement lors du premier chargement si la base est vide ;
- l'identifiant Supabase sert de numéro de version : v1, v2, v3… ;
- la date est générée par la base Supabase, pas par le navigateur du participant ;
- une version déposée n'écrase jamais la précédente ;
- le téléchargement donne un fichier `.html` autonome, à ouvrir dans le navigateur ou à modifier avec une IA ;
- le contenu d'une version n'est chargé que lorsqu'on la joue ;
- le site n'accorde aucun droit de modification ou suppression via l'API publique.

## Sécurité / atelier interne

La configuration fournie privilégie la simplicité : toute personne possédant l'adresse publique du site peut lire l'historique et déposer une version. Pour un petit groupe interne, cela peut suffire.

Pour un contrôle plus strict, on peut ajouter ensuite une connexion par e-mail (Supabase Auth) ou limiter les dépôts aux utilisateurs authentifiés.
