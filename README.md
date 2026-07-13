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
