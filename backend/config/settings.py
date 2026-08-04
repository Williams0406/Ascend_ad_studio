from pathlib import Path
import os
from dotenv import load_dotenv
from datetime import timedelta
from corsheaders.defaults import default_headers
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
SECRET_KEY = os.getenv('SECRET_KEY','dev-secret-key')
DEBUG = os.getenv('DEBUG','True').lower() == 'true'
CLOUDINARY_URL=os.getenv('CLOUDINARY_URL','').strip()
USE_CLOUDINARY=bool(CLOUDINARY_URL)
ALLOWED_HOSTS = [x.strip() for x in os.getenv('ALLOWED_HOSTS','localhost,127.0.0.1').split(',') if x.strip()]
if os.getenv('RAILWAY_PUBLIC_DOMAIN'):
 ALLOWED_HOSTS.append(os.environ['RAILWAY_PUBLIC_DOMAIN'])

INSTALLED_APPS = [
 'django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles',
 'corsheaders','rest_framework','accounts','studio','billing','integrations','access_control'
]
if USE_CLOUDINARY:
 INSTALLED_APPS.append('cloudinary')
MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware','django.middleware.security.SecurityMiddleware','whitenoise.middleware.WhiteNoiseMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF='config.urls'
TEMPLATES=[{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION='config.wsgi.application'

if os.getenv('DATABASE_URL'):
 DATABASES={'default':dj_database_url.config(conn_max_age=600,conn_health_checks=True,ssl_require=os.getenv('DATABASE_SSL_REQUIRED','False').lower()=='true')}
elif os.getenv('DB_ENGINE','sqlite') == 'postgresql':
 DATABASES={'default':{'ENGINE':'django.db.backends.postgresql','NAME':os.getenv('DB_NAME'),'USER':os.getenv('DB_USER'),'PASSWORD':os.getenv('DB_PASSWORD'),'HOST':os.getenv('DB_HOST'),'PORT':os.getenv('DB_PORT','5432')}}
else:
 DATABASES={'default':{'ENGINE':'django.db.backends.sqlite3','NAME':BASE_DIR/'db.sqlite3'}}

AUTH_USER_MODEL='accounts.User'
AUTH_PASSWORD_VALIDATORS=[{'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},{'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator'},{'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},{'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'}]
LANGUAGE_CODE='es-pe'; TIME_ZONE='America/Lima'; USE_I18N=True; USE_TZ=True
STATIC_URL='/static/'
STATIC_ROOT=BASE_DIR/'staticfiles'
STORAGES={
 'default':{'BACKEND':'config.storage.CloudinaryMediaStorage' if USE_CLOUDINARY else 'django.core.files.storage.FileSystemStorage'},
 'staticfiles':{'BACKEND':'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
MEDIA_URL='/media/'
MEDIA_ROOT=Path(os.getenv('MEDIA_ROOT') or os.getenv('RAILWAY_VOLUME_MOUNT_PATH') or BASE_DIR/'media')
SERVE_MEDIA_FILES=os.getenv('SERVE_MEDIA_FILES','True' if DEBUG else 'False').lower()=='true'
DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
CORS_ALLOWED_ORIGINS=[x.strip() for x in os.getenv('CORS_ALLOWED_ORIGINS','http://localhost:3000').split(',') if x.strip()]
CORS_ALLOWED_ORIGIN_REGEXES=[x.strip() for x in os.getenv('CORS_ALLOWED_ORIGIN_REGEXES','').split(',') if x.strip()]
CORS_ALLOW_HEADERS = list(default_headers) + ['x-workspace-id']
CSRF_TRUSTED_ORIGINS=[x.strip() for x in os.getenv('CSRF_TRUSTED_ORIGINS','http://localhost:3000').split(',') if x.strip()]
SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO','https')
SESSION_COOKIE_SECURE=not DEBUG
CSRF_COOKIE_SECURE=not DEBUG
SECURE_SSL_REDIRECT=os.getenv('SECURE_SSL_REDIRECT',str(not DEBUG)).lower()=='true'
SECURE_HSTS_SECONDS=int(os.getenv('SECURE_HSTS_SECONDS','3600' if not DEBUG else '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS=os.getenv('SECURE_HSTS_INCLUDE_SUBDOMAINS','False').lower()=='true'
SECURE_HSTS_PRELOAD=os.getenv('SECURE_HSTS_PRELOAD','False').lower()=='true'
REST_FRAMEWORK={'DEFAULT_AUTHENTICATION_CLASSES':['rest_framework_simplejwt.authentication.JWTAuthentication'],'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.IsAuthenticated'],'DEFAULT_PAGINATION_CLASS':'rest_framework.pagination.PageNumberPagination','PAGE_SIZE':20}
SIMPLE_JWT={'ACCESS_TOKEN_LIFETIME':timedelta(minutes=30),'REFRESH_TOKEN_LIFETIME':timedelta(days=7),'AUTH_HEADER_TYPES':('Bearer',)}
API_KEY_ENCRYPTION_SECRET=os.getenv('API_KEY_ENCRYPTION_SECRET','MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=')
ENABLE_PROVIDER_KEY_REMOTE_VALIDATION=os.getenv('ENABLE_PROVIDER_KEY_REMOTE_VALIDATION','True').lower() == 'true'
USE_MOCK_AI_GENERATION=os.getenv('USE_MOCK_AI_GENERATION','False').lower() == 'true'
CELERY_BROKER_URL=os.getenv('CELERY_BROKER_URL',os.getenv('REDIS_URL','redis://localhost:6379/0'))
CELERY_TASK_DEFAULT_QUEUE='default'
CELERY_TASK_ROUTES={'studio.tasks.*':{'queue':'generation'}}
CELERY_TASK_ACKS_LATE=True
CELERY_WORKER_PREFETCH_MULTIPLIER=1
GENERATION_JOB_MAX_RETRIES=int(os.getenv('GENERATION_JOB_MAX_RETRIES','3'))
GOOGLE_FONTS_API_KEY=os.getenv('GOOGLE_FONTS_API_KEY','')
