from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde .env en la raíz del proyecto (si existe).
# Esto se ejecuta al importar el paquete `app`, centralizando la carga.
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
	load_dotenv(dotenv_path=env_path)

