# Télécharger un APK sans Android Studio

1. Connectez ce projet à votre dépôt GitHub depuis Lovable et synchronisez les modifications.
2. Sur GitHub, ouvrez **Actions → Android test APK → Run workflow**.
3. Attendez que l’exécution soit verte, puis ouvrez-la.
4. Dans **Artifacts**, téléchargez **mansion-pinball-android-debug** (connexion GitHub nécessaire).
5. Décompressez le ZIP et transférez **app-debug.apk** sur votre téléphone Android.
6. Ouvrez l’APK et autorisez l’installation depuis cette source si Android le demande.

Le workflow démarre aussi lors des mises à jour de `main` ou `master`. Les téléchargements restent disponibles 14 jours ; relancez-le pour en générer un nouveau.

## Limites de cette version de test

- Pas besoin d’Android Studio sur votre ordinateur : Java et les outils Android sont installés dans GitHub Actions.
- L’APK est signé avec une clé de débogage générée sur GitHub, sans secret à fournir. Ce n’est pas une version de publication Play Store.
- Cette application ouvre le jeu en ligne indiqué dans `capacitor.config.ts` : Internet reste nécessaire et la disponibilité de cette adresse reste indispensable.
- Une nouvelle exécution peut utiliser une autre clé de test : désinstallez l’ancienne application si Android refuse une mise à jour (les données locales seront supprimées).
- La première compilation réelle doit être vérifiée dans votre dépôt GitHub ; elle n’a pas été exécutée depuis Lovable.