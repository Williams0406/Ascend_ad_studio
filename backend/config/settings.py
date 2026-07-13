from pathlib import Path
import os
from dotenv import load_dotenv
from datetime import timedelta
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
SECRET_KEY = os.getenv('SECRET_KEY','dev-secret-key')
DEBUG = os.getenv('DEBUG','True').lower() == 'true'
ALLOWED_HOSTS = [x.strip() for x in os.getenv('ALLOWED_HOSTS','localhost,127.0.0.1').split(',') if x.strip()]

INSTALLED_APPS = [
 'django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles',
 'corsheaders','rest_framework','accounts','studio','billing','integrations'
]
MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware','django.middleware.security.SecurityMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF='config.urls'
TEMPLATES=[{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION='config.wsgi.application'

if os.getenv('DB_ENGINE','sqlite') == 'postgresql':
 DATABASES={'default':{'ENGINE':'django.db.backends.postgresql','NAME':os.getenv('DB_NAME'),'USER':os.getenv('DB_USER'),'PASSWORD':os.getenv('DB_PASSWORD'),'HOST':os.getenv('DB_HOST'),'PORT':os.getenv('DB_PORT','5432')}}
else:
 DATABASES={'default':{'ENGINE':'django.db.backends.sqlite3','NAME':BASE_DIR/'db.sqlite3'}}

AUTH_USER_MODEL='accounts.User'
AUTH_PASSWORD_VALIDATORS=[{'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},{'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator'},{'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},{'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'}]
LANGUAGE_CODE='es-pe'; TIME_ZONE='America/Lima'; USE_I18N=True; USE_TZ=True
STATIC_URL='static/'; MEDIA_URL='/media/'; MEDIA_ROOT=BASE_DIR/'media'
DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
CORS_ALLOWED_ORIGINS=[x.strip() for x in os.getenv('CORS_ALLOWED_ORIGINS','http://localhost:3000').split(',') if x.strip()]
CORS_ALLOW_HEADERS = list(default_headers) + ['x-workspace-id']
REST_FRAMEWORK={'DEFAULT_AUTHENTICATION_CLASSES':['rest_framework_simplejwt.authentication.JWTAuthentication'],'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.IsAuthenticated'],'DEFAULT_PAGINATION_CLASS':'rest_framework.pagination.PageNumberPagination','PAGE_SIZE':20}
SIMPLE_JWT={'ACCESS_TOKEN_LIFETIME':timedelta(minutes=30),'REFRESH_TOKEN_LIFETIME':timedelta(days=7),'AUTH_HEADER_TYPES':('Bearer',)}
API_KEY_ENCRYPTION_SECRET=os.getenv('API_KEY_ENCRYPTION_SECRET','MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=')
ENABLE_PROVIDER_KEY_REMOTE_VALIDATION=os.getenv('ENABLE_PROVIDER_KEY_REMOTE_VALIDATION','False').lower() == 'true'
