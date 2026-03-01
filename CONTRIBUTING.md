# Contribuir a VoidVault

¡Gracias por querer contribuir! Este documento explica cómo colaborar de forma eficaz en VoidVault.

## Principios
- Sé respetuoso y claro en tus comunicaciones.
- Abre Issues para discutir cambios importantes antes de implementarlos.
- Todas las contribuciones estarán bajo la licencia del proyecto (MIT).

## Antes de empezar

1. Haz fork del repositorio y clona tu fork localmente.
2. Crea una rama descriptiva: `feature/<descripcion>` o `fix/<descripcion>`.

## Entorno de desarrollo

Requisitos:
- Python 3.11+ (o la versión del `requirements.txt`)
- Docker y Docker Compose (opcional para desarrollo con contenedores)

Pasos básicos (sin Docker):

```bash
git clone <tu-fork-url>
cd VoidVault
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./scripts/init_env.sh
uvicorn app.main:app --reload --port 8000
```

Con Docker:

```bash
./scripts/init_env.sh
sudo docker compose up --build
```

## Estilo de código
- Sigue las convenciones de Python (PEP8). Recomendamos usar `black` y `isort` antes de enviar PRs.
- Mantén funciones y módulos pequeños y con responsabilidad única.

## Commits y Pull Requests
- Usa mensajes claros tipo `feat:`, `fix:`, `docs:`, `chore:` (estilo Conventional Commits).
- Abre un Pull Request desde tu rama hacia `main` explicando: qué cambia, por qué y cualquier nota de compatibilidad.
- Vincula el PR con el Issue si aplica.

## Reporting de seguridad

Si encuentras una vulnerabilidad de seguridad, no publiques los detalles en un Issue público. Contacta a los mantenedores.
