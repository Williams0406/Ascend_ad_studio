# Simple Ad Studio

MVP full-stack para generar flyers y videos publicitarios con IA.

## Stack
- Backend: Django 5.2 LTS, Django REST Framework, SimpleJWT
- Frontend: Next.js App Router, JavaScript + JSX
- Base de datos: SQLite por defecto; PostgreSQL mediante variables de entorno
- Archivos: almacenamiento local en desarrollo

## Funcionalidades
- Registro e inicio de sesión por correo
- Usuario independiente o empresa
- Perfiles personales y empresariales
- Workspaces y miembros por roles
- Kit de marca y productos
- Recetas creativas
- Proyectos publicitarios
- Generaciones simuladas de flyers/videos
- Galería de resultados, favoritos y feedback
- Planes, suscripciones y créditos
- Panel Django Admin

## Inicio rápido

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/macOS
python manage.py makemigrations accounts studio billing
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

API: http://127.0.0.1:8000/api/
Admin: http://127.0.0.1:8000/admin/

Usuario demo después de `seed_demo`:
- correo: demo@ascend.test
- contraseña: Demo12345!

### Frontend
```bash
cd frontend
copy .env.example .env.local  # Windows
# cp .env.example .env.local  # Linux/macOS
npm install
npm run dev
```

Frontend: http://localhost:3000

## PostgreSQL
Configura en `backend/.env`:
```env
DB_ENGINE=postgresql
DB_NAME=simple_ad_studio
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
```

## Proveedor real de IA
La simulación está en `backend/studio/services/generation.py`. Sustituye `MockGenerationProvider` o crea otro proveedor con la misma interfaz.

## Despliegue: Railway + Vercel

### Backend en Railway

1. Conecta este repositorio y configura **Root Directory** como `backend`.
2. Agrega un servicio PostgreSQL al mismo proyecto.
3. En el backend configura `DATABASE_URL=${{Postgres.DATABASE_URL}}` y las demás variables de `backend/.env.example` con valores de producción.
4. Genera un dominio público desde **Settings → Networking**.
5. Crea una cuenta o product environment en Cloudinary y copia su `CLOUDINARY_URL` desde **Console → API Keys**.
6. Agrega `CLOUDINARY_URL` a las variables privadas del backend. Las imágenes cargadas y generadas se guardarán automáticamente en la carpeta `ascend` de Cloudinary.

```env
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
SERVE_MEDIA_FILES=False
```

No agregues `CLOUDINARY_URL` a Vercel ni al repositorio. Contiene el API Secret y solo debe estar disponible en Railway.

**Pre-deploy Command**:

```bash
python manage.py migrate --noinput
```

**Custom Start Command**:

```bash
python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 180 --access-logfile - --error-logfile -
```

No ejecutes `collectstatic` en pre-deploy: Railway ejecuta esa fase en otro contenedor y sus cambios de filesystem no llegan al contenedor web.

Para procesar generaciones agrega Redis en Railway y un segundo servicio desde el
mismo repositorio, con `backend` como Root Directory y este Start Command:

```bash
celery -A config worker -l info -Q generation --concurrency=2
```

Tanto el servicio web como el worker deben recibir `REDIS_URL` (Railway la
inyecta al vincular Redis). Opcionalmente define `CELERY_BROKER_URL` con la misma
URL y `GENERATION_JOB_MAX_RETRIES=3`.

Cuando `CLOUDINARY_URL` está configurada, Django usa Cloudinary para todos los `ImageField` y `FileField`. Cuando está vacía, conserva el almacenamiento local en `backend/media`, por lo que el desarrollo local no cambia. Los archivos estáticos del admin continúan siendo gestionados por WhiteNoise y no se suben a Cloudinary.

### Frontend en Vercel

1. Importa el mismo repositorio.
2. Configura **Root Directory** como `frontend` y deja el preset **Next.js**.
3. Define estas variables en Production y Preview:

```env
NEXT_PUBLIC_API_URL=https://TU-BACKEND.up.railway.app/api
BACKEND_URL=https://TU-BACKEND.up.railway.app
```

4. En Railway agrega la URL final de Vercel a `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS`, siempre con `https://` y sin `/` final.

El desarrollo local no cambia: Django usa SQLite cuando no existe `DATABASE_URL`, Next.js usa `http://127.0.0.1:8000` y los `.env` locales siguen teniendo prioridad.
