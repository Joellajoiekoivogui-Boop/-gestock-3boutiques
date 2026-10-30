# Skills Claude Code du projet

Skills tiers ajoutés au dépôt pour travailler l’interface de MassaGui Fils. Ils
se chargent automatiquement dans les sessions Claude Code ouvertes sur ce dépôt.

| Skill | Source | Version (commit) | Licence |
| --- | --- | --- | --- |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable), dossier `plugin/skills/impeccable` | `02523ae` (skill v4.8.0) | Apache 2.0 |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), dossier `.claude/skills/ui-ux-pro-max` | `28b3b8d` | MIT |
| `playwright-cli` | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli), dossier `skills/playwright-cli` | `b1a5903` | Apache 2.0 |

## Adaptations locales

- `ui-ux-pro-max` : chemins du script `search.py` réécrits en `${CLAUDE_SKILL_DIR}/scripts/search.py`
  (l’original suppose une installation en plugin) ; dossier `scripts/tests` retiré.
- Aucune autre modification : pour mettre à jour, recopier le dossier depuis la source et
  réappliquer ces deux points.

## Notes d’utilisation

- **playwright-cli** : la commande est fournie par Playwright lui-même (`playwright cli …` ou
  `npx playwright cli …`), aucune installation globale n’est nécessaire.
- **impeccable** : son lanceur (`scripts/impeccable`) télécharge au premier usage un binaire
  vérifié par somme de contrôle. Sans accès réseau, le skill prévoit de lire directement
  `PRODUCT.md` et `DESIGN.md` à la racine du dépôt.
- **ui-ux-pro-max** : scripts Python 3 sans dépendance ni accès réseau
  (`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<requête>" --domain ux`).
