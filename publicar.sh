#!/usr/bin/env bash
# Publica esta carpeta en GitHub Pages.
# Requiere: git y gh (GitHub CLI) ya instalados y con sesión iniciada (gh auth login).
set -e

USUARIO=$(gh api user --jq .login)
REPO="$USUARIO.github.io"

echo "Publicando en $REPO ..."

git init -b main
git add .
git commit -m "Primera versión del sitio"

# Crea el repositorio si no existe y sube todo
gh repo create "$REPO" --public --source=. --remote=origin --push \
  || { git remote add origin "https://github.com/$USUARIO/$REPO.git" 2>/dev/null; git push -u origin main --force; }

# Activa GitHub Pages desde la rama main, carpeta raíz
gh api -X POST "repos/$USUARIO/$REPO/pages" \
  -f "source[branch]=main" -f "source[path]=/" 2>/dev/null \
  || gh api -X PUT "repos/$USUARIO/$REPO/pages" \
     -f "source[branch]=main" -f "source[path]=/"

echo
echo "Listo. En un par de minutos:"
echo "  https://$USUARIO.github.io"
echo "  https://$USUARIO.github.io/true-o-poser/"
