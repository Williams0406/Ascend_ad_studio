# Architecture Review

## Indice

1. Alcance y metodologia
2. Mapa general de arquitectura
3. Estructura de carpetas
4. Backend
5. Modelo de datos
6. Frontend
7. Inventario de componentes React
8. Grafo de componentes por pantalla
9. Flujos funcionales principales
10. Generacion con IA
11. Dependencias entre modulos
12. Codigo compartido
13. Codigo posiblemente no utilizado o duplicado
14. Resumen final y mapa mental

## 1. Alcance y metodologia

Este documento describe el estado actual del proyecto a partir de inspeccion directa del codigo. No se asume arquitectura por nombres de carpetas: se revisaron modelos Django, serializers, views, services, rutas, tareas Celery, configuracion, paginas Next.js, componentes React, hooks y cliente API.

Archivos y areas inspeccionadas:

- Backend Django: `backend/accounts`, `backend/studio`, `backend/integrations`, `backend/billing`, `backend/access_control`, `backend/config`.
- Frontend Next.js: `frontend/app`, `frontend/components`, `frontend/hooks`, `frontend/lib`.
- Configuracion: `backend/config/settings.py`, `backend/config/celery.py`, `backend/config/storage.py`, `frontend/package.json`, `frontend/next.config.js`, `docker-compose.yml`.
- Guia visual: `preview.html`, relevante para frontend pero no fuente de arquitectura funcional.

Elementos ignorados por criterio arquitectonico: `.git`, entornos virtuales, `node_modules`, `.next`, caches, logs y migraciones como fuente primaria de comportamiento. Las migraciones se consideraron solo como indicio historico cuando ayudaban a identificar legado.

## 2. Mapa general de arquitectura

La plataforma implementa una arquitectura cliente-servidor con:

- Frontend Next.js App Router como cliente de producto.
- API REST Django REST Framework como backend principal.
- Base de datos relacional via Django ORM.
- Almacenamiento de media local o Cloudinary, segun configuracion.
- Cola Celery para generacion asincrona.
- Integraciones externas para modelos de IA, principalmente Gemini y fal.ai en configuracion/validacion, aunque el procesamiento actual solo llama Gemini directamente y usa mock para otros casos.

Diagrama general:

```text
Usuario
  |
  v
Frontend Next.js
  - paginas en frontend/app
  - componentes compartidos en frontend/components
  - cliente API con JWT y X-Workspace-ID
  |
  v
Django REST API
  - accounts: autenticacion y workspaces
  - studio: marca, productos, recursos, proyectos, generacion
  - integrations: credenciales BYOK y modelos disponibles
  - billing: planes y suscripciones
  - access_control: politicas administrativas de acceso
  |
  v
Services backend
  - prompts.py: construccion de prompt
  - generation_queue.py: creacion y estado de batches/jobs
  - generation.py: providers y almacenamiento de outputs
  - integrations/services: cifrado, validacion, catalogo de modelos
  - access_control/services: decision de acceso y seats
  |
  v
Persistencia / externos
  - DB relacional Django ORM
  - FileSystemStorage o CloudinaryMediaStorage
  - Celery broker Redis
  - Gemini API
  - fal.ai API para validacion/modelos; no hay generador fal real implementado
  - Google Fonts API para catalogo tipografico opcional
```

Capas principales:

- Presentacion: vive en `frontend/app` y `frontend/components`. Su responsabilidad es componer vistas, manejar estado local, invocar API y mostrar resultados.
- API/controladores: viven en `backend/*/views.py`. Validan permisos, resuelven workspace activo y coordinan serializers/services.
- Serializacion/validacion de entrada: vive en `backend/*/serializers.py`. En `studio` contiene validaciones importantes de negocio como workspace ownership, categorias permitidas por input role y sources validos de templates.
- Dominio persistente: vive en modelos Django. Representa workspaces, marca, productos, proyectos, batches/jobs y assets.
- Servicios de aplicacion: `generation_queue.py`, `prompts.py`, `access_control/services.py`. Encapsulan procesos que no son simples CRUD.
- Servicios de integracion externa: `integrations/services/*`, `studio/services/generation.py`, `config/storage.py`.
- Acceso a datos: Django ORM dentro de views, serializers y services. No existe una capa repository separada.

Donde vive la logica:

- Logica de negocio de generacion: `studio/services/generation_queue.py`, `studio/services/prompts.py`, `studio/tasks.py`, `studio/services/generation.py`.
- Logica de negocio de permisos/acceso: `access_control/services.py`, `access_control/permissions.py`, `studio/permissions.py`.
- Logica de presentacion: componentes React y CSS global.
- Logica de integracion: `integrations/services`, `config/storage.py`, provider Gemini en `studio/services/generation.py`.
- Acceso a datos: Django ORM directamente en viewsets/services/serializers.

## 3. Estructura de carpetas

```text
simple_ad_studio_fullstack/
├── backend/
│   ├── config/                 # settings Django, URLs raiz, Celery, storage Cloudinary/local
│   ├── accounts/               # usuario custom, perfiles, workspaces, membresias, registro/login
│   ├── studio/                 # dominio creativo: marca, productos, recetas, proyectos, generacion
│   │   ├── services/           # prompt, cola de generacion, providers
│   │   └── management/commands # seed de branding/demo creativo
│   ├── integrations/           # conexiones BYOK a proveedores IA, cifrado y validacion
│   │   └── services/           # encryption, validation, catalogo de modelos
│   ├── billing/                # planes, suscripciones y limites
│   └── access_control/         # administracion platform-level de acceso y seats
├── frontend/
│   ├── app/                    # rutas Next.js App Router
│   │   ├── projects/           # listado, detalle y creacion/generacion
│   │   ├── settings/           # integraciones y control de acceso
│   │   ├── brand-kit/          # sistema de marca
│   │   ├── products/           # catalogo de productos
│   │   ├── references/         # BrandAsset y CreativeReference
│   │   ├── recipes/            # recetas, angulos y templates
│   │   └── library/            # jobs y assets generados
│   ├── components/             # Nav, PageTitle, primitives de catalogo, campos estructurados
│   ├── hooks/                  # hooks compartidos de sesion y catalogo
│   ├── lib/                    # cliente API y helpers de auth
│   └── public/                 # iconos/logo
├── preview.html                # guia UI/UX visual
├── docker-compose.yml          # infraestructura local
└── README.md
```

## 4. Backend

### 4.1 `config`

Proposito:
Configura la aplicacion Django y conecta las apps de dominio con REST, CORS, JWT, storage, Celery y URLs raiz. Es infraestructura, no dominio de negocio.

Archivos clave:

- `settings.py`: define apps instaladas, DB, JWT, CORS, storage, Celery, flags de IA y variables de entorno.
- `urls.py`: monta `/api/auth/`, `/api/studio/`, `/api/billing/`, `/api/integrations/`, `/api/admin/access-control/`.
- `celery.py`: crea la app Celery y autodiscover de tasks.
- `storage.py`: implementa `CloudinaryMediaStorage`, adaptador de archivos para Cloudinary con soporte de lectura de archivos legacy locales.

Variables de entorno detectadas:

- `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`
- `DATABASE_URL`, `DATABASE_SSL_REQUIRED`, `DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `CLOUDINARY_URL`, `MEDIA_ROOT`, `RAILWAY_VOLUME_MOUNT_PATH`, `SERVE_MEDIA_FILES`
- `CORS_ALLOWED_ORIGINS`, `CORS_ALLOWED_ORIGIN_REGEXES`, `CSRF_TRUSTED_ORIGINS`
- `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`
- `API_KEY_ENCRYPTION_SECRET`
- `ENABLE_PROVIDER_KEY_REMOTE_VALIDATION`
- `USE_MOCK_AI_GENERATION`
- `CELERY_BROKER_URL`, `REDIS_URL`
- `GENERATION_JOB_MAX_RETRIES`
- `GOOGLE_FONTS_API_KEY`

Dependencias relevantes:

- Django REST Framework
- SimpleJWT
- Celery
- Redis como broker esperado
- django-cors-headers
- whitenoise
- dj-database-url
- cloudinary
- cryptography/Fernet
- requests
- Pillow

### 4.2 `accounts`

Proposito:
Define identidad de usuario, workspace y membresia. Este modulo sostiene el multi-tenant funcional: casi todo en `studio`, `integrations`, `billing` y `access_control` se relaciona con `Workspace`.

Modelos:

- `User`: usuario custom por email. Existe para reemplazar username y tener estados (`pending`, `active`, `suspended`, `deleted`) que luego son usados por access control.
- `PersonProfile`: datos personales del usuario. Existe para separar identidad de acceso (`User`) de perfil humano editable.
- `Workspace`: contenedor tenant. Existe porque productos, marca, assets, proyectos, billing e integraciones se agrupan por espacio de trabajo.
- `WorkspaceMember`: relacion usuario-workspace con rol. Existe para permisos de workspace y seat counting.
- `CompanyProfile`: metadatos legales/empresa de workspaces tipo company.
- `IndividualProfile`: metadatos comerciales de workspaces individuales.
- `PlatformAdmin`: marca usuarios con rol administrativo global. Lo usa access control para decidir quien puede administrar acceso.
- `UserSession`: modelo persistente de sesiones refresh, pero no se observo uso directo en views actuales.
- `EmailVerificationToken`: token persistente para verificacion, sin flujo visible en views actuales.
- `PasswordResetToken`: token persistente para reset, sin flujo visible en views actuales.
- `WorkspaceInvitation`: invitaciones a workspace, sin endpoints visibles en la version inspeccionada.

Serializers:

- `RegisterSerializer`: crea usuario, perfil, workspace, membership owner y subscription trialing. Es un serializer con logica de aplicacion, no solo DTO.
- `EmailTokenSerializer`: extiende JWT login para incluir datos de usuario.
- `UserSerializer`: expone usuario, perfil y platform_admin.
- `WorkspaceSerializer`: expone workspace y rol del usuario actual.
- `ProfileSerializer`: representa `PersonProfile`.

Endpoints:

| Metodo | Ruta | View | Recibe | Devuelve | Modelos |
|---|---|---|---|---|---|
| POST | `/api/auth/register/` | `RegisterView` | email, password, nombre, tipo cuenta, workspace | user serializado | User, PersonProfile, Workspace, WorkspaceMember, Profile, Subscription |
| POST | `/api/auth/login/` | `LoginView` | credenciales JWT | access/refresh + user | User |
| POST | `/api/auth/refresh/` | SimpleJWT | refresh token | access token | User |
| GET | `/api/auth/me/` | `MeView` | JWT | user | User, PersonProfile, PlatformAdmin |
| GET | `/api/auth/workspaces/` | `WorkspaceListView` | JWT | workspaces del usuario; crea uno si no existe | Workspace, WorkspaceMember, IndividualProfile, Plan, Subscription |

Relacion con otros modulos:

- `studio`: todos los recursos creativos cuelgan de `Workspace`.
- `integrations`: cada API key pertenece a un workspace.
- `billing`: cada subscription pertenece a workspace.
- `access_control`: evalua `User`, `Workspace`, `WorkspaceMember`, `PlatformAdmin`.

Responsabilidad duplicada/solapada:

- `RegisterSerializer.create` y `WorkspaceListView.get_queryset` pueden crear workspace + subscription starter. No son identicos, pero ambos materializan onboarding basico. Esto es una responsabilidad de provisionamiento repetida en dos lugares.

### 4.3 `billing`

Proposito:
Representa planes y suscripciones. Actualmente su API publica solo lista planes; su mayor uso real ocurre desde `accounts` y `access_control`.

Modelos:

- `Plan`: define oferta comercial, precio, limites de storage y miembros. Es concepto de negocio.
- `Subscription`: estado de plan de un workspace. Es persistencia del entitlement comercial.
- `SubscriptionLimitChange`: auditoria de cambios de limites, no se vio endpoint consumidor directo.

Serializers:

- `PlanSerializer`
- `SubscriptionSerializer`

Endpoints:

| Metodo | Ruta | View | Recibe | Devuelve | Modelos |
|---|---|---|---|---|---|
| GET | `/api/billing/plans/` | `PlanListView` | nada | planes activos | Plan |

Relacion:

- `accounts` crea `Subscription` starter al registrar/provisionar workspace.
- `access_control` consulta subscription para seat limits y decision de acceso.

### 4.4 `access_control`

Proposito:
Administra acceso platform-level por usuario/workspace y limites de seats. Existe por encima de permisos de workspace: no decide que puede editar un proyecto, sino si el usuario/workspace puede usar la plataforma y cuantos miembros puede tener.

Modelos:

- `UserAccessPolicy`: override individual (`inherit`, `free`, `blocked`) con expiracion y razon.
- `WorkspaceAccessPolicy`: override de workspace y `seat_limit_override`.
- `AccessAuditLog`: auditoria de cambios administrativos.

Services:

- `evaluate_workspace_access(user, workspace)`: decision central de acceso. Combina auth, user status, membership activa, workspace status, policies y subscription.
- `get_subscription`, `get_seat_limit`, `get_active_seat_count`, `can_add_member`, `seat_limit_error`: encapsulan limites comerciales/administrativos.

Permisos:

- `IsPlatformAccessAdmin`: permite a superuser o PlatformAdmin activo administrar acceso.
- `HasWorkspacePlatformAccess`: permiso usado por integraciones; evalua acceso del workspace activo.

Endpoints:

| Metodo | Ruta | View | Recibe | Devuelve | Modelos |
|---|---|---|---|---|---|
| GET | `/api/admin/access-control/overview/` | `OverviewView` | JWT admin | resumen, usuarios, workspaces | User, Workspace, Subscription, policies |
| PATCH | `/api/admin/access-control/users/<id>/` | `UserPolicyView` | status/policy | usuario actualizado | UserAccessPolicy, User |
| PATCH | `/api/admin/access-control/workspaces/<id>/` | `WorkspacePolicyView` | status/policy/seats | workspace actualizado | WorkspaceAccessPolicy, Workspace |
| PATCH | `/api/admin/access-control/workspaces/<wid>/members/<mid>/` | `MemberView` | role/is_active | workspace actualizado | WorkspaceMember |

Responsabilidad duplicada/solapada:

- `WorkspaceAccess` en `studio/permissions.py` y `HasWorkspacePlatformAccess` en `access_control/permissions.py` ambos verifican workspace desde header. El primero es permiso operativo de studio; el segundo agrega decision platform/subscription. No son iguales, pero hay solapamiento en resolucion de workspace.

### 4.5 `integrations`

Proposito:
Gestiona conexiones BYOK a proveedores IA por workspace. No genera imagenes por si mismo; da credenciales, validacion y catalogo de modelos a `studio`.

Modelo:

- `AIProviderConnection`: credencial cifrada por workspace/proveedor, estado (`pending`, `active`, `invalid`, `revoked`, `error`), default y metadata de pruebas. Existe para separar secretos externos de jobs y permitir BYOK.

Services:

- `encryption.py`: cifra/descifra API keys con Fernet.
- `validation.py`: valida formato y opcionalmente llama Gemini/fal.ai para comprobar key.
- `models.py`: devuelve modelos disponibles por proveedor. Para fal devuelve catalogo local; para Gemini intenta consultar `/models`.

Endpoints:

| Metodo | Ruta | View | Recibe | Devuelve | Modelos |
|---|---|---|---|---|---|
| GET | `/api/integrations/providers/` | `ProviderConnectionsView` | workspace | conexiones | AIProviderConnection |
| POST | `/api/integrations/providers/connect/` | `ProviderConnectionsView.post` via URL dedicada | provider/api_key | conexion creada | AIProviderConnection |
| DELETE | `/api/integrations/providers/<id>/` | `ProviderConnectionDetailView` | id | 204, revoca key | AIProviderConnection |
| POST | `/api/integrations/providers/<id>/test/` | `TestProviderConnectionView` | id | valid/error | AIProviderConnection + proveedor externo |
| PATCH | `/api/integrations/providers/<id>/default/` | `DefaultProviderConnectionView` | id | conexion default | AIProviderConnection |
| GET | `/api/integrations/providers/<id>/models/` | `ProviderModelsView` | id | modelos disponibles | AIProviderConnection + proveedor externo |

Relacion:

- `GenerationJob.provider_connection` apunta a `AIProviderConnection`.
- `generation_queue.resolve_connection` elige conexion activa/default.
- `GeminiGenerationProvider` descifra key desde esta conexion.

Observacion importante:

- El sistema conoce `fal` como proveedor y valida/lista modelos fal, pero `process_generation_job` actualmente solo implementa Gemini real; para cualquier provider distinto de Gemini cae en `MockGenerationProvider`.

### 4.6 `studio`

Proposito:
Es el nucleo de negocio creativo: identidad de marca, productos, assets, referencias, recetas, templates, proyectos publicitarios, cola de generacion, outputs, variaciones, feedback y exports.

Constantes de dominio:

- `FORMAT_CHOICES` y `FORMAT_SPECS`: catalogo de formatos/canales y dimensiones. Se usa en templates y generation parameters.
- `PURPOSE_CHOICES`: taxonomia de propositos visuales para roles de input/reference.

Modelos persistentes de negocio:

- `BrandKit`: identidad principal de marca de un workspace.
- `BrandRule`: reglas aplicables a esa marca.
- `BrandAsset`: archivos de marca/producto/referencia almacenados por workspace.
- `Product`: producto comercial del workspace, con imagen principal y galeria de BrandAssets.
- `CreativeAngle`: angulos creativos reutilizables, algunos globales.
- `CreativeRecipe`: receta de copy/visual/prompt.
- `CreativeReference`: imagen de referencia curada, distinta de BrandAsset porque representa inspiracion/benchmark.
- `AdTemplate`: plantilla creativa basada exactamente en una fuente: BrandAsset, CreativeReference o layout_schema.
- `AdProject`: brief/proyecto publicitario editable.
- `Purpose`: catalogo normalizado de propositos.
- `ProjectInputAsset`: snapshot editable de BrandAssets asociados a un AdProject.
- `ProjectReference`: CreativeReferences asociadas a un AdProject.
- `WorkspacePreference`: preferencias aprendidas del workspace.
- `Export`: registro de exportacion.

Modelos persistentes de generacion:

- `GenerationBatch`: lote/cola de jobs de un proyecto.
- `GenerationJob`: unidad individual de generacion con provider/model/prompt/parameters.
- `GeneratedAsset`: imagen generada por un job.
- `GenerationJobInputAsset`: copia de inputs del proyecto dentro del job. Existe para que un job conserve su contexto aunque luego cambie el proyecto.
- `GenerationJobReference`: copia de referencias dentro del job. Mismo motivo: snapshot reproducible.
- `AssetVariation`: relacion entre imagen generada base y variante.
- `AssetFeedback`: feedback de usuario sobre asset.

ViewSets/Endpoints principales:

| Recurso | Ruta base | ViewSet | Metodos base | Por que existe |
|---|---|---|---|---|
| BrandKit | `/api/studio/brand-kits/` | `BrandKitViewSet` | CRUD | configurar identidad del workspace |
| BrandRule | `/api/studio/brand-rules/` | `BrandRuleViewSet` | CRUD | reglas de marca separadas de metadata base |
| WorkspacePreference | `/api/studio/workspace-preferences/` | `WorkspacePreferenceViewSet` | CRUD | preferencias aprendidas |
| BrandAsset | `/api/studio/brand-assets/` | `BrandAssetViewSet` | CRUD | cargar/gestionar archivos reutilizables |
| CreativeReference | `/api/studio/creative-references/` | `CreativeReferenceViewSet` | CRUD | referencias visuales curadas |
| Purpose | `/api/studio/purposes/` | `PurposeViewSet` | read-only | catalogo de propositos |
| Product | `/api/studio/products/` | `ProductViewSet` | CRUD | catalogo comercial |
| CreativeAngle | `/api/studio/creative-angles/` | `CreativeAngleViewSet` | CRUD/list | angulos creativos |
| Recipe | `/api/studio/recipes/` | `RecipeViewSet` | CRUD | reglas/prompt reutilizables |
| AdTemplate | `/api/studio/ad-templates/` | `AdTemplateViewSet` | CRUD | templates visuales/layout |
| GenerationBatch | `/api/studio/generation-batches/` | `GenerationBatchViewSet` | read-only + cancel | consultar/cancelar cola |
| GenerationJob | `/api/studio/generation-jobs/` | `GenerationJobViewSet` | read-only + retry/input/ref | consultar/reintentar/editar contexto job |
| GeneratedAsset | `/api/studio/generated-assets/` | `GeneratedAssetViewSet` | read-only + add-to-brand-assets | consultar outputs y promoverlos a BrandAsset |
| Project | `/api/studio/projects/` | `ProjectViewSet` | CRUD + actions | crear brief, asignar recursos, generar |

Actions relevantes:

- `GET /api/studio/brand-kits/google-fonts/`: intenta Google Fonts API; fallback local.
- `POST /api/studio/projects/<id>/input-assets/`: agrega BrandAsset con input_role/purpose.
- `DELETE /api/studio/projects/<id>/input-assets/<input_asset_id>/`: quita input.
- `POST /api/studio/projects/<id>/references/`: agrega CreativeReference.
- `DELETE /api/studio/projects/<id>/references/<project_reference_id>/`: quita referencia.
- `POST /api/studio/projects/<id>/generation-batches/`: crea batch con uno o mas jobs.
- `POST /api/studio/projects/<id>/prepare-generation-job/`: crea job individual snapshot editable.
- `POST /api/studio/projects/<id>/generate/`: generacion rapida legacy/atajo via batch.
- `POST /api/studio/generation-batches/<id>/cancel/`: cancela queued y marca processing como cancel_requested.
- `POST /api/studio/generation-jobs/<id>/retry/`: reencola job failed si no excede retries.
- `POST /api/studio/generation-jobs/<id>/input-assets/`: modifica snapshot de inputs del job y recompone prompt.
- `POST /api/studio/generation-jobs/<id>/references/`: modifica snapshot de referencias del job y recompone prompt.
- `POST /api/studio/generated-assets/<id>/add-to-brand-assets/`: copia archivo generado a BrandAsset.

Services:

- `prompts.build_generation_prompt(project, job=None)`: construye prompt textual a partir de proyecto, producto, brand kit, reglas, preferencias, angulo, receta, template, inputs y referencias. Si recibe job, usa snapshots del job.
- `generation_queue.create_generation_batch`: valida provider/model, crea batch, crea jobs, copia snapshots de project/job base, genera prompt y agenda Celery.
- `generation_queue.update_generation_batch_status`: recalcula status batch/proyecto desde jobs.
- `generation_queue.resolve_connection`: selecciona conexion activa/default.
- `tasks.dispatch_generation_batch`: crea tareas `process_generation_job` por job.
- `tasks.process_generation_job`: transiciona queued->processing, llama provider, maneja cancel/error y actualiza batch.
- `generation.GeminiGenerationProvider`: llama Gemini, envia prompt + imagenes de referencia inline y crea `GeneratedAsset`.
- `generation.MockGenerationProvider`: genera imagen placeholder con Pillow para desarrollo/fallback.

## 5. Modelo de datos

Relaciones principales:

```text
User
├── PersonProfile (1:1)
├── PlatformAdmin (0/1)
├── WorkspaceMember (*)
└── sent WorkspaceInvitation / created recipes / feedback / exports

Workspace
├── owner -> User
├── WorkspaceMember (*)
├── CompanyProfile o IndividualProfile (0/1)
├── Subscription (*)
├── AIProviderConnection (*)
├── BrandKit (0/1)
│   └── BrandRule (0/1)
├── WorkspacePreference (0/1)
├── BrandAsset (*)
├── Product (*)
│   ├── main_image_asset -> BrandAsset
│   └── image_assets -> BrandAsset (*)
├── CreativeReference (*)
├── CreativeRecipe (*, mas system recipes globales)
├── AdTemplate (*)
├── AdProject (*)
│   ├── product/template/recipe/creative_angle
│   ├── ProjectInputAsset (*)
│   ├── ProjectReference (*)
│   ├── GenerationBatch (*)
│   │   └── GenerationJob (*)
│   │       ├── GenerationJobInputAsset (*)
│   │       ├── GenerationJobReference (*)
│   │       └── GeneratedAsset (*)
│   └── GeneratedAsset (*)
└── Export (*)
```

Detalle por modelo:

| Modelo | Proposito | Relaciones clave | Quien crea | Quien consume |
|---|---|---|---|---|
| `User` | Identidad autenticable | profile, memberships, platform_admin | registro/admin | auth, access_control |
| `PersonProfile` | Datos humanos del usuario | 1:1 User | registro | UI/me, access overview |
| `Workspace` | Tenant principal | owner, memberships, todo studio | registro o auto-provision | casi todos los endpoints |
| `WorkspaceMember` | Rol de usuario en workspace | FK Workspace/User | registro/admin/invitacion futura | permisos, access, nav |
| `CompanyProfile` | Datos de empresa | 1:1 Workspace | registro company | no se vio consumo fuerte |
| `IndividualProfile` | Datos de negocio individual | 1:1 Workspace | registro individual/auto | no se vio consumo fuerte |
| `PlatformAdmin` | Rol admin global | 1:1 User | management/admin | access-control UI/API |
| `UserSession` | Sesiones refresh persistentes | FK User | no observado | no observado |
| `EmailVerificationToken` | Verificacion email | FK User | no observado | no observado |
| `PasswordResetToken` | Reset password | FK User | no observado | no observado |
| `WorkspaceInvitation` | Invitaciones workspace | FK Workspace/User | no observado | no observado |
| `Plan` | Producto comercial | Subscription | seed/registro | billing/access |
| `Subscription` | Entitlement workspace | FK Workspace/Plan | registro/auto | access_control |
| `SubscriptionLimitChange` | Auditoria de limites | FK Subscription/User | no observado | no observado |
| `UserAccessPolicy` | Override acceso user | 1:1 User | access admin | evaluate access |
| `WorkspaceAccessPolicy` | Override acceso/seats workspace | 1:1 Workspace | access admin | evaluate access |
| `AccessAuditLog` | Auditoria admin | actor User | access admin views | no endpoint listado separado |
| `AIProviderConnection` | Credencial IA por workspace | FK Workspace/User | integraciones UI/API | generation_queue/provider |
| `BrandKit` | Identidad de marca | 1:1 Workspace, logos BrandAsset | brand-kit UI | prompt builder |
| `BrandRule` | Restricciones de marca | 1:1 BrandKit | brand-kit UI | prompt builder |
| `BrandAsset` | Archivo reutilizable | FK Workspace/User | brand-kit/references/generated | products, project inputs, templates |
| `Product` | Producto a publicitar | FK Workspace, M2M BrandAsset | products UI | projects/prompts |
| `CreativeAngle` | Enfoque creativo reusable | recipes/projects | seed/recipes UI | prompts |
| `CreativeRecipe` | Reglas + prompt template | FK Workspace/User/Angle | recipes UI | projects/prompts |
| `CreativeReference` | Inspiracion visual curada | FK Workspace/User | references UI | project refs, templates, generation refs |
| `AdTemplate` | Fuente de composicion | FK Workspace, BrandAsset o CreativeReference | recipes UI | projects/prompts |
| `AdProject` | Brief editable | FK Workspace/User/Product/etc. | projects/new/detail | generation |
| `Purpose` | Taxonomia de uso visual | M2M inputs/refs | seed/admin | serializers/prompt |
| `ProjectInputAsset` | BrandAsset asignado a proyecto | FK Project/BrandAsset, M2M Purpose | project UI | prompt, job snapshots |
| `ProjectReference` | CreativeReference asignada a proyecto | FK Project/Reference, M2M Purpose | project UI | prompt, job snapshots |
| `GenerationBatch` | Lote de jobs | FK Project/User | generation_queue | library/new project |
| `GenerationJob` | Trabajo de generacion | FK Project/Product/etc/Connection/Batch | generation_queue/prepare | Celery/provider/UI |
| `GeneratedAsset` | Output generado | FK Job/Project | provider | library/detail/add-to-brand |
| `GenerationJobInputAsset` | Snapshot BrandAsset por job | FK Job/BrandAsset, M2M Purpose | generation_queue/prepare/job edit | prompt/provider |
| `GenerationJobReference` | Snapshot CreativeReference por job | FK Job/Reference, M2M Purpose | generation_queue/prepare/job edit | prompt/provider |
| `AssetVariation` | Relacion base-variante | FK GeneratedAsset x2 | no observado | no observado |
| `AssetFeedback` | Feedback usuario/asset | FK GeneratedAsset/User | no endpoint observado | no observado |
| `WorkspacePreference` | Preferencias aprendidas | 1:1 Workspace | brand-kit UI/API | prompt builder |
| `Export` | Registro de exportacion | FK Workspace/GeneratedAsset/User | no endpoint observado | no observado |

## 6. Frontend

Arquitectura frontend:

- Next.js App Router con paginas bajo `frontend/app`.
- No se observo context/provider React global.
- Estado local vive dentro de cada page component.
- API client central en `frontend/lib/api.js`.
- `Nav` se incluye directamente por paginas privadas/publicas.
- Componentes compartidos reales: `PageTitle`, `Nav`, `CatalogLayout`, `CatalogPrimitives`, `CatalogIcons`, `StructuredFields`.
- Muchas paginas contienen subcomponentes especificos inline; existen para encapsular partes de una vista, no como libreria reusable.

Cliente API:

- `api(path, options, retry=true)`: agrega JWT, `Content-Type` si aplica, `X-Workspace-ID`, refresh token si 401 y fallback de base URL.
- `tokens()`: lee tokens/localStorage.
- `login()`: llama `/auth/login/` y guarda tokens.
- `ensureWorkspace()`: obtiene `/auth/workspaces/` y guarda workspace activo.
- `logout()`: limpia sesion.

### Rutas y paginas

#### `/`

Archivo: `frontend/app/page.jsx`

Proposito:
Landing publica. Existe para explicar visualmente el producto y dirigir a registro/login/dashboard.

Componentes:
`Home`, `StudioPreview`, `Nav`.

APIs:
Ninguna.

Estado:
No relevante; pagina presentacional.

Flujo:
Usuario entra, ve propuesta visual/valor, navega a auth o dashboard segun sesion manejada por Nav.

#### `/login`

Archivo: `frontend/app/login/page.jsx`

Proposito:
Autenticacion de usuario.

Componentes:
`Login`, `Nav`.

APIs:
Indirecta via `login()` -> `POST /auth/login/`.

Estado:
Email/password, error, busy. Tambien usa redirect si ya hay sesion.

Flujo:
Usuario ingresa credenciales -> frontend llama login -> guarda JWT/workspace -> redirige.

#### `/register`

Archivo: `frontend/app/register/page.jsx`

Proposito:
Registro + creacion inicial de workspace.

Componentes:
`Register`, `Nav`.

APIs:
`POST /auth/register/`.

Estado:
Paso del wizard, aceptacion terminos, datos de usuario/workspace, error, busy.

Flujo:
Usuario completa datos -> API crea usuario/profile/workspace/subscription -> frontend puede iniciar sesion/continuar.

#### `/onboarding`

Archivo: `frontend/app/onboarding/page.jsx`

Proposito:
Pantalla de orientacion posterior al registro con rutas recomendadas.

Componentes:
`Onboarding`, `Nav`.

APIs:
Ninguna detectada.

Estado:
Principalmente visual/navegacional.

#### `/dashboard`

Archivo: `frontend/app/dashboard/page.jsx`

Proposito:
Resumen operativo de proyectos recientes.

APIs:
`GET /studio/projects/`.

Estado:
Proyectos, loading/error derivado.

Flujo:
Carga proyectos -> muestra estado/resumen -> usuario navega a crear o continuar.

#### `/brand-kit`

Archivo: `frontend/app/brand-kit/page.jsx`

Proposito:
Configurar identidad de marca, reglas, logos, colores, fuentes, assets y preferencias.

Componentes especificos:
`Field`, `BrandColorField`, `ColorListPicker`, `MetadataBuilder`, `FontPicker`, `LogoUploader`, `RulesEditor`, `SummaryItem`, `BrandConfiguredView`, `BrandLivePreview`, `BrandKitPage`.

APIs:
`GET /studio/brand-kits/`, `/studio/brand-rules/`, `/studio/brand-assets/`, `/studio/brand-kits/google-fonts/`, `/studio/workspace-preferences/`; `POST/PATCH` brand kit/rules/preferences/assets; `DELETE /studio/brand-assets/<id>/`.

Estado:
Formulario de brand kit, reglas, assets, fuentes, preferencias, tabs/mode, mensajes.

Flujo:
Carga identidad actual -> usuario edita campos/reglas/logos/assets -> guarda en endpoints studio -> preview se actualiza localmente.

#### `/products`

Archivo: `frontend/app/products/page.jsx`

Proposito:
Gestionar catalogo de productos y asociar BrandAssets como imagenes.

Componentes:
`Field`, `Money`, `ProductImage`, `StatusBadge`, `ProductSummary`, `ProductsPage`, primitives de catalogo.

APIs:
`GET /studio/products/`, `GET /studio/brand-assets/`, `POST/PATCH /studio/products/`.

Estado:
Productos, assets, form, selected product, view mode, filtros, busy/message.

Flujo:
Carga productos/assets -> usuario crea/edita producto -> selecciona imagen principal/galeria -> guarda.

#### `/references`

Archivo: `frontend/app/references/page.jsx`

Proposito:
Gestionar dos conceptos visuales: `CreativeReference` y `BrandAsset`. Sirve como biblioteca curada de referencias e imagenes por categoria.

Componentes:
`ReferenceField`, `ReferencePreview`, iconos locales, `ReferencesPage`, primitives de catalogo.

APIs:
`GET /studio/creative-references/`, `GET /studio/brand-assets/`, `POST/PATCH` segun tab, `DELETE /studio/creative-references/<id>/`.

Estado:
Tab active (`creative-references`/`brand-assets`), formularios, preview image, selected, filtros.

Flujo:
Usuario alterna tipo -> crea o edita asset/reference -> endpoint correspondiente -> catalogo/inspector.

#### `/recipes`

Archivo: `frontend/app/recipes/page.jsx`

Proposito:
Gestionar CreativeAngles, CreativeRecipes y AdTemplates. Es la direccion creativa reusable.

Componentes:
`Field`, `Toggle`, `RecipeRules`, `LayoutBuilder`, `RecipePreview`, `StatusBadge`, `CreativeLibrary`.

APIs:
`GET /studio/creative-angles/`, `/studio/recipes/`, `/studio/ad-templates/`, `/studio/brand-assets/`, `/studio/creative-references/`; `POST/PATCH/DELETE /studio/<current.path>/...`.

Estado:
Tab (`recipes`, `angles`, `templates`), editor, form, layout_schema, filters, selected, view mode.

Flujo:
Usuario elige entidad -> crea/edita receta/angulo/template -> si template puede elegir BrandAsset, CreativeReference o construir layout_schema -> guarda.

#### `/projects`

Archivo: `frontend/app/projects/page.jsx`

Proposito:
Listar AdProjects, resumir estado y abrir inspector.

Componentes:
`Metric`, `StatusBadge`, `ProjectPreview`, `ProjectCard`, `DetailRow`, `ProjectsPage`.

APIs:
`GET /studio/projects/`.

Estado:
Projects, selected, query/filter/status/viewMode.

Flujo:
Carga proyectos -> usuario filtra/selecciona -> inspector muestra recursos, jobs y acciones.

#### `/projects/new`

Archivo: `frontend/app/projects/new/page.jsx`

Proposito:
Crear/editar brief de AdProject y preparar/ejecutar cola de generacion. Es la pantalla mas compleja y mezcla editor de proyecto, seleccion de recursos y control de batches/jobs.

Componentes:
`Tags`, `Control`, `StatusPill`, `ResourceRoleWorkbench`, `NewProjectContent`, `Fallback`, `NewProject`.

APIs:
Carga opciones: `/studio/products/`, `/studio/ad-templates/`, `/studio/recipes/`, `/studio/creative-angles/`, `/studio/brand-assets/`, `/studio/creative-references/`, `/studio/projects/`.
Proyecto/recursos: `GET/PATCH/POST /studio/projects/`, `/input-assets/`, `/references/`.
Generacion: `/studio/projects/<id>/generation-batches/`, `/studio/projects/<id>/prepare-generation-job/`, `/studio/generation-batches/?project=...`, `/studio/generation-batches/<id>/cancel/`, `/studio/generation-jobs/<id>/retry/`.

Estado:
Form de proyecto, active project, resource role workbench, provider/model/queue settings, active batch, jobs, polling, UI panels.

Flujo:
Usuario define brief -> guarda/actualiza AdProject -> selecciona recursos por input_role -> prepara job o crea batch -> Celery procesa -> frontend consulta batch/jobs.

#### `/projects/[id]`

Archivo: `frontend/app/projects/[id]/page.jsx`

Proposito:
Detalle de AdProject: editar brief, recursos, referencias, prompt, generar, ver outputs y promover assets generados.

Componentes:
`DataItem`, `Field`, `PromptCard`, `ResourceManager`, `ReferencesManager`, `UnifiedResourceSection`, `UnifiedResourcesManager`, `ProjectEditor`, `ImageLightbox`, `ProjectDetail`.

APIs:
`GET /studio/projects/<id>/`, opciones (`products`, `recipes`, `ad-templates`, `creative-angles`, `brand-assets`, `creative-references`, integrations providers), `PATCH /studio/projects/<id>/`, `POST /generate/`, `POST/DELETE input-assets`, `POST/DELETE references`, `POST /studio/generated-assets/<asset>/add-to-brand-assets/`.

Estado:
Project, options, edit mode, selected tab, generated lightbox, busy flags, errors/notices.

Flujo:
Carga project + opciones -> usuario edita brief o recursos -> prompt cambia via serializer/backend -> usuario genera -> visualiza outputs -> puede agregar output a BrandAsset.

Nota de duplicacion:
`ResourceManager` y `ReferencesManager` siguen definidos junto con `UnifiedResourcesManager`. Por lectura, la vista actual usa la vista unificada, pero los managers antiguos permanecen en el archivo. Estado: PROBABLE legado local.

#### `/library`

Archivo: `frontend/app/library/page.jsx`

Proposito:
Biblioteca de jobs y generated assets.

Componentes:
`AssetMedia`, `StatusPill`, `Row`, `ContentLibrary`, iconos locales.

APIs:
`GET /studio/generation-jobs/`, `GET /studio/generated-assets/`.

Estado:
Jobs, assets, selected, filters/view mode.

Flujo:
Carga jobs/assets -> usuario filtra/examina -> inspector muestra metadata/prompt/resultados.

#### `/settings/integrations`

Archivo: `frontend/app/settings/integrations/page.jsx`

Proposito:
Configurar conexiones IA BYOK por workspace.

Componentes:
`ProviderLogo`, `ProviderStatus`, iconos locales, `IntegrationsPage`.

APIs:
`GET /integrations/providers/`, `POST /integrations/providers/connect/`, `POST /integrations/providers/<id>/test/`, `PATCH /integrations/providers/<id>/default/`, `DELETE /integrations/providers/<id>/`.

Estado:
Connections, selected provider/modal, api key form, test results, loading/message.

Flujo:
Usuario elige proveedor -> ingresa API key -> backend cifra y crea conexion -> puede probar/default/revocar.

#### `/settings/access-control`

Archivo: `frontend/app/settings/access-control/page.jsx`

Proposito:
Administrar acceso platform-level, politicas y seats. Vista para PlatformAdmin/superuser.

Componentes:
`Status`, `AccessControlPage`.

APIs:
`GET /auth/me/`, `GET /admin/access-control/overview/`, `PATCH users/workspaces`, `PATCH workspace members`.

Estado:
Overview, selected user/workspace, policy form, member edits.

Flujo:
Valida usuario admin -> carga overview -> selecciona user/workspace -> aplica policy o cambia miembro -> auditoria en backend.

## 7. Inventario de componentes React

Clasificacion abreviada de componentes importantes:

| Componente | Archivo | Tipo | Utilidad | Usado por | Dependencias |
|---|---|---|---|---|---|
| `Nav` | `frontend/components/Nav.jsx` | Navigation/Layout | Navegacion publica/privada, workspace activo, logout, acceso condicional a admin | todas las paginas principales | api/auth, localStorage, Next Link |
| `PageTitle` | `frontend/components/PageTitle.jsx` | Layout/UI primitive | Cabecera editorial reusable con eyebrow, titulo, descripcion, meta y acciones | catalog/page headers | JSX children |
| `CatalogPageHeader` | `components/catalog/CatalogLayout.jsx` | Catalog/Layout | Adapta PageTitle a vistas tipo catalogo | products, projects, references, recipes | PageTitle |
| `CatalogWorkspace` | `components/catalog/CatalogLayout.jsx` | Catalog/Layout | Define layout lista + inspector | catalog pages | CSS classes |
| `CatalogGrid` | `components/catalog/CatalogLayout.jsx` | Catalog/Layout | Grid/list container para cards | catalog pages | CSS classes |
| `CatalogPreview` | `components/catalog/CatalogLayout.jsx` | Inspector | Panel lateral de detalle | catalog pages | CSS classes |
| `CatalogSearch` | `components/catalog/CatalogPrimitives.jsx` | UI primitive | Input search con icono | disponible, poco usado por paginas actuales | CatalogIcons |
| `CatalogViewToggle` | `components/catalog/CatalogPrimitives.jsx` | UI primitive | Toggle grid/list | catalog pages | CatalogIcons |
| `CatalogCard` | `components/catalog/CatalogPrimitives.jsx` | Catalog | Wrapper semantico de card | disponible | CSS classes |
| `CatalogInspector` | `components/catalog/CatalogPrimitives.jsx` | Inspector | Aside con close button | disponible | CSS classes |
| `TagsInput` | `components/StructuredFields.jsx` | Form/Shared | Entrada de tags por teclado | brand/recipes/projects | React state via props |
| `ObjectList` | `components/StructuredFields.jsx` | Form/Shared | Editor generico de listas de objetos JSON | brand/recipes | props |
| `ChoiceCards` | `components/StructuredFields.jsx` | Form/Shared | Seleccion multiple visual | brand/recipes | props |
| `BrandKitPage` | `app/brand-kit/page.jsx` | Brand/View | Orquesta edicion de identidad de marca | ruta `/brand-kit` | studio API |
| `MetadataBuilder` | `app/brand-kit/page.jsx` | Brand/Form | Construye metadata JSON de assets | BrandKitPage | form callbacks |
| `RulesEditor` | `app/brand-kit/page.jsx` | Brand/Form | Edita reglas de marca que alimentan prompt | BrandKitPage | StructuredFields |
| `BrandLivePreview` | `app/brand-kit/page.jsx` | Brand/Visual | Preview de identidad sin persistir logica | BrandKitPage | form/assets |
| `ProductsPage` | `app/products/page.jsx` | Product/View | CRUD productos y seleccion de assets | ruta `/products` | studio API |
| `ProductSummary` | `app/products/page.jsx` | Product/Visual | Resume producto durante edicion | ProductsPage | form/asset |
| `ProductImage` | `app/products/page.jsx` | Product/Visual | Renderiza imagen principal/fallback | ProductsPage, cards | Product |
| `ProjectsPage` | `app/projects/page.jsx` | Project/View | Catalogo de proyectos | ruta `/projects` | studio API |
| `ProjectCard` | `app/projects/page.jsx` | Project/Catalog | Representa proyecto seleccionable en catalogo | ProjectsPage | ProjectPreview |
| `ProjectPreview` | `app/projects/page.jsx` | Project/Visual | Genera visual resumen del proyecto | ProjectCard/detail | project data |
| `NewProject` | `app/projects/new/page.jsx` | Generation/View | Suspense wrapper de creacion/generacion | ruta `/projects/new` | NewProjectContent |
| `NewProjectContent` | `app/projects/new/page.jsx` | Generation/Editor | Orquesta brief, recursos, batches/jobs | NewProject | API, router |
| `ResourceRoleWorkbench` | `app/projects/new/page.jsx` | Generation/Domain UI | Permite asignar BrandAsset/CreativeReference por input_role y purpose | NewProjectContent | options/form |
| `ProjectDetail` | `app/projects/[id]/page.jsx` | Project/View | Detalle, edicion y generacion de proyecto | ruta `/projects/[id]` | APIs varias |
| `UnifiedResourcesManager` | `app/projects/[id]/page.jsx` | Project/Domain UI | Agrupa recursos por input_role y fuente | ProjectDetail | UnifiedResourceSection |
| `ProjectEditor` | `app/projects/[id]/page.jsx` | Project/Form | Edita campos del brief | ProjectDetail | options |
| `PromptCard` | `app/projects/[id]/page.jsx` | Generation/Visual | Muestra/copia prompt generado | ProjectDetail | clipboard |
| `ImageLightbox` | `app/projects/[id]/page.jsx` | UI specific | Amplia asset generado | ProjectDetail | fetch/download |
| `ContentLibrary` | `app/library/page.jsx` | Generation/View | Explora jobs y assets generados | ruta `/library` | generation APIs |
| `AssetMedia` | `app/library/page.jsx` | Generation/Visual | Renderiza media de GeneratedAsset | ContentLibrary | asset data |
| `ReferencesPage` | `app/references/page.jsx` | Brand/Reference/View | CRUD BrandAsset/CreativeReference | ruta `/references` | studio APIs |
| `ReferencePreview` | `app/references/page.jsx` | Reference/Visual | Preview de upload/reference | ReferencesPage | form/preview |
| `CreativeLibrary` | `app/recipes/page.jsx` | Editor/View | CRUD recipes, angles, templates | ruta `/recipes` | studio APIs |
| `RecipeRules` | `app/recipes/page.jsx` | Editor/Form | Edita reglas copy/visual JSON | CreativeLibrary | TagsInput |
| `LayoutBuilder` | `app/recipes/page.jsx` | Editor/Domain UI | Crea rectangulos arrastrables para layout_schema | CreativeLibrary | pointer events |
| `RecipePreview` | `app/recipes/page.jsx` | Editor/Visual | Preview de receta/template | CreativeLibrary | form/options |
| `IntegrationsPage` | `app/settings/integrations/page.jsx` | Settings/Integration | Gestion BYOK proveedores IA | ruta settings | integrations API |
| `ProviderLogo` | `app/settings/integrations/page.jsx` | Visual | Identidad visual de proveedor | IntegrationsPage | provider constant |
| `ProviderStatus` | `app/settings/integrations/page.jsx` | Settings/Visual | Estado conectado/default | IntegrationsPage | connection |
| `AccessControlPage` | `app/settings/access-control/page.jsx` | Settings/Admin | Politicas y seats platform-level | ruta settings | access admin API |
| `Dashboard` | `app/dashboard/page.jsx` | View | Resumen de proyectos | ruta dashboard | projects API |
| `Login` | `app/login/page.jsx` | Authentication | Form login | ruta login | login helper |
| `Register` | `app/register/page.jsx` | Authentication | Wizard de registro/workspace | ruta register | auth API |
| `Onboarding` | `app/onboarding/page.jsx` | Navigation/View | Guia post registro | ruta onboarding | links |
| `Home` | `app/page.jsx` | Visual/Public | Landing publica | ruta `/` | Nav |

Componentes exclusivamente visuales:
Iconos locales (`SearchIcon`, `EyeIcon`, `PencilIcon`, etc.), `ProviderLogo`, `BrandLivePreview`, `StudioPreview`, `ProjectPreview`, `AssetMedia`, `RecipePreview`.

Componentes que representan conceptos de negocio:
`ProductSummary`, `ProductImage`, `ProjectCard`, `ResourceRoleWorkbench`, `UnifiedResourcesManager`, `RecipeRules`, `LayoutBuilder`, `ReferencePreview`, `BrandConfiguredView`, `PromptCard`.

Componentes de navegacion/layout:
`Nav`, `NavGroup`, `PageTitle`, `CatalogPageHeader`, `CatalogWorkspace`, `CatalogGrid`, `CatalogPreview`, `RootLayout`.

Componentes reutilizables:
`PageTitle`, catalog primitives/layout, `StructuredFields`, `StatusBadge/StatusPill` conceptualmente repetidos pero implementados localmente.

Componentes especificos de vista:
La mayoria de subcomponentes dentro de `app/*/page.jsx` son especificos: `BrandColorField`, `LogoUploader`, `RulesEditor`, `ProjectEditor`, `ProviderStatus`, etc.

## 8. Grafo de componentes por pantalla

```text
BrandKitPage
├── Nav
├── CatalogPageHeader/PageTitle
├── BrandConfiguredView
├── RulesEditor
│   ├── TagsInput
│   ├── ObjectList
│   └── ChoiceCards
├── MetadataBuilder
├── FontPicker
├── LogoUploader
└── BrandLivePreview

ProductsPage
├── Nav
├── CatalogPageHeader/PageTitle
├── ProductSummary
├── CatalogWorkspace
│   ├── CatalogGrid
│   │   └── ProductImage / StatusBadge
│   └── CatalogPreview
└── Field / Money

ProjectsPage
├── Nav
├── CatalogPageHeader/PageTitle
├── Metric
├── CatalogWorkspace
│   ├── CatalogGrid
│   │   └── ProjectCard
│   │       └── ProjectPreview
│   └── CatalogPreview
│       └── DetailRow

NewProject
└── Suspense
    └── NewProjectContent
        ├── Nav
        ├── ResourceRoleWorkbench
        ├── Control / Tags / StatusPill
        ├── Project form
        └── Generation queue panels

ProjectDetail
├── Nav
├── PageTitle
├── ProjectEditor
├── UnifiedResourcesManager
│   └── UnifiedResourceSection
├── PromptCard
├── generated assets gallery
└── ImageLightbox

ReferencesPage
├── Nav
├── CatalogPageHeader/PageTitle
├── ReferenceField
├── ReferencePreview
├── CatalogWorkspace
│   ├── CatalogGrid
│   └── CatalogPreview

CreativeLibrary
├── Nav
├── CatalogPageHeader/PageTitle
├── RecipeRules
│   └── TagsInput
├── LayoutBuilder
├── RecipePreview
├── CatalogWorkspace
│   ├── CatalogGrid
│   └── CatalogPreview

IntegrationsPage
├── Nav
├── PageTitle
├── ProviderLogo
├── ProviderStatus
└── modal/form de conexion

AccessControlPage
├── Nav
├── PageTitle
└── users/workspaces/members policy editor
```

## 9. Flujos funcionales principales

### Creacion de Workspace

```text
Usuario
↓
Register page
↓
POST /api/auth/register/
↓
RegisterSerializer.create
↓
User + PersonProfile + Workspace + WorkspaceMember(owner)
↓
CompanyProfile o IndividualProfile
↓
Plan Starter + Subscription trialing
↓
Frontend continua con sesion/onboarding
```

Tambien existe auto-provision en `WorkspaceListView` si un usuario autenticado no tiene workspace.

### Configuracion de Brand Kit

```text
Usuario
↓
/brand-kit
↓
GET brand-kits, brand-rules, brand-assets, google-fonts, workspace-preferences
↓
BrandKitViewSet / BrandRuleViewSet / BrandAssetViewSet
↓
BrandKit + BrandRule + BrandAsset + WorkspacePreference
↓
Prompt builder consume BrandKit/BrandRule/WorkspacePreference durante generacion
```

### Creacion de productos

```text
Usuario
↓
/products
↓
GET products + brand-assets
↓
POST/PATCH /api/studio/products/
↓
ProductSerializer valida assets del workspace
↓
Product guarda main_image_asset e image_assets
↓
AdProject puede referenciar Product y usar sus imagenes como product_image
```

### Carga de assets y referencias

```text
Usuario
↓
/references o /brand-kit
↓
POST /studio/brand-assets/ o /studio/creative-references/
↓
BrandAssetViewSet extrae metadata de archivo con PIL si puede
↓
BrandAsset o CreativeReference
↓
Usados por Products, AdTemplate, ProjectInputAsset, ProjectReference y GenerationJob snapshots
```

### Creacion de templates

```text
Usuario
↓
/recipes tab templates
↓
Selecciona BrandAsset template, CreativeReference template o crea layout_schema
↓
POST/PATCH /studio/ad-templates/
↓
AdTemplateSerializer.validate exige exactamente una fuente
↓
AdTemplate
↓
AdProject.template y prompt builder
```

### Creacion de Creative Recipes

```text
Usuario
↓
/recipes tab recipes
↓
Edita copy_rules, visual_rules, prompt_template, creative_angle
↓
POST/PATCH /studio/recipes/
↓
CreativeRecipeSerializer
↓
CreativeRecipe
↓
AdProject.recipe y build_generation_prompt
```

### Creacion de AdProject y asignacion de recursos

```text
Usuario
↓
/projects/new o /projects/[id]
↓
POST/PATCH /studio/projects/
↓
AdProjectSerializer
↓
AdProject
↓
POST /projects/<id>/input-assets/ y /references/
↓
ProjectInputAsset / ProjectReference con Purpose
↓
build_generation_prompt usa esos recursos
```

### Creacion de GenerationBatch y GenerationJob

```text
Usuario
↓
/projects/new
↓
POST /studio/projects/<id>/generation-batches/
↓
ProjectViewSet.create_generation_batch_action
↓
GenerationBatchCreateSerializer
↓
create_generation_batch
↓
AIProviderConnection seleccionada
↓
GenerationBatch + GenerationJob(s)
↓
GenerationJobInputAsset / GenerationJobReference snapshots
↓
transaction.on_commit dispatch_generation_batch Celery
```

### Generacion de imagen

```text
Celery worker
↓
dispatch_generation_batch
↓
process_generation_job
↓
GeminiGenerationProvider o MockGenerationProvider
↓
Gemini API si provider gemini y mock desactivado
↓
GeneratedAsset file
↓
update_generation_batch_status
↓
Frontend consulta batch/jobs/assets
```

### Agregar imagen generada a BrandAsset

```text
Usuario
↓
/projects/[id]
↓
POST /studio/generated-assets/<id>/add-to-brand-assets/
↓
GeneratedAssetViewSet.add_to_brand_assets
↓
Copia archivo GeneratedAsset
↓
BrandAsset con metadata source=generated_asset
```

## 10. Generacion con IA

Flujo completo real:

```text
AdProject
├── product/template/recipe/creative_angle
├── ProjectInputAsset + Purpose
└── ProjectReference + Purpose
    ↓
create_generation_batch o prepare_generation_job
    ↓
AIProviderConnection activa/default
    ↓
GenerationBatch (si cola)
    ↓
GenerationJob
├── copia campos del AdProject
├── provider/model_name/parameters/number_of_outputs
├── GenerationJobInputAsset snapshots
└── GenerationJobReference snapshots
    ↓
build_generation_prompt(project, job=job)
    ↓
Celery process_generation_job
    ↓
GeminiGenerationProvider.generate(job)
    ↓
Gemini generateContent con prompt + imagenes inline
    ↓
GeneratedAsset(s)
    ↓
update_generation_batch_status
```

Donde se crea cada cosa:

- `GenerationBatch`: `create_generation_batch` en `studio/services/generation_queue.py`.
- `GenerationJob`: `create_generation_batch` o `ProjectViewSet.prepare_generation_job`.
- Prompt: `build_generation_prompt` en `studio/services/prompts.py`.
- Imagenes de referencia para Gemini: `GeminiGenerationProvider._reference_parts`, usando `job.references` y `job.input_assets`.
- Provider: `resolve_connection` usa `AIProviderConnection` activa/default. `prepare_generation_job` implementa seleccion similar.
- `model_name`: sale de `ALLOWED_AI_MODELS` en `studio/views.py`, mapeando `model_code` a provider model.
- `parameters`: se construye con formato, aspect ratio, resolution, quality, output format, seed y custom params en `create_generation_batch`.
- `number_of_outputs`: validado por serializer (1-6 por job; max 50 outputs por batch) y usado por provider para loop de outputs.
- Gemini: implementado en `GeminiGenerationProvider`, endpoint `v1beta/models/{model}:generateContent`.
- fal.ai: existe como provider, validacion y catalogo de modelos, pero no hay provider de generacion fal implementado; `process_generation_job` cae en mock si provider no es Gemini.
- Errores: exceptions se capturan en `process_generation_job`; job pasa a `failed`, incrementa `retry_count`, guarda `error_message`.
- Retries: endpoint `POST /generation-jobs/<id>/retry/` reencola jobs failed si `retry_count < GENERATION_JOB_MAX_RETRIES`.
- Variantes: existe `source_job_id` en `GenerationQueueItemSerializer` y `create_generation_batch` puede copiar snapshots desde un job base. Existe `AssetVariation`, pero no se observo creacion automatica de ese modelo en el flujo actual.

## 11. Dependencias entre modulos

```text
accounts
└── billing (crea Plan/Subscription en registro y auto-provision)

billing
└── accounts.Workspace

access_control
├── accounts (User, Workspace, WorkspaceMember, PlatformAdmin)
└── billing (Subscription, Plan para seats/access)

integrations
├── accounts.Workspace / WorkspaceMember
├── access_control.permissions
└── services externos Gemini/fal para validar/listar modelos

studio
├── accounts.Workspace/User
├── integrations.AIProviderConnection
├── integrations.services.models
├── integrations.services.encryption
├── Celery tasks
└── storage/media

frontend
└── consume API REST completa
```

Dependencias circulares observadas:

- No se observo import circular directo que rompa ejecucion.
- Hay acoplamiento cruzado intencional: `accounts` crea `billing.Subscription`; `access_control` consulta billing/accounts; `studio` consulta integrations.

## 12. Codigo compartido

Backend:

- `WorkspaceScopedMixin`: resuelve workspace por header/query y centraliza filtrado tenant en viewsets studio.
- `WorkspaceAccess`: permiso de studio para workspace.
- `build_generation_prompt`: servicio compartido entre serializers, views y generation queue.
- `create_generation_batch` / `update_generation_batch_status`: servicio compartido por actions de proyectos y tasks.
- `validate_provider_key`, `available_provider_models`, `encrypt_api_key`, `decrypt_api_key`: utilidades de integracion.
- `evaluate_workspace_access`: decision compartida por permissions y admin overview.

Frontend:

- `api`, `login`, `ensureWorkspace`, `logout`: cliente API/autenticacion.
- `usePublicSessionRedirect`: evita mostrar auth pages si hay sesion.
- `useCatalogController`: hook generico de busqueda/sort/view, aunque no todas las vistas lo usan.
- `Nav`: navegacion global.
- `PageTitle`: cabecera reusable.
- `CatalogLayout` y `CatalogPrimitives`: layout de catalogo/inspector.
- `StructuredFields`: inputs para tags, listas de objetos y choice cards.

## 13. Codigo posiblemente no utilizado o duplicado

Sin eliminar nada:

| Elemento | Estado | Motivo |
|---|---|---|
| `UserSession` | INCIERTO | Modelo definido, no se observo view/service que cree sesiones persistentes; JWT usa SimpleJWT directamente. |
| `EmailVerificationToken` | INCIERTO | Modelo definido, no se observo flujo de verificacion. |
| `PasswordResetToken` | INCIERTO | Modelo definido, no se observo endpoint reset password. |
| `WorkspaceInvitation` | INCIERTO | Modelo definido, no se observo endpoint de invitaciones. |
| `SubscriptionLimitChange` | INCIERTO | Modelo definido, no se observo endpoint o service creador. |
| `AssetVariation` | INCIERTO | Modelo definido; existe source_job_id para variantes, pero no se observo creacion de AssetVariation. |
| `AssetFeedback` | INCIERTO | Modelo definido, no se observo endpoint de feedback. |
| `Export` | INCIERTO | Modelo definido, no se observo endpoint de exportacion. |
| `ResourceManager` y `ReferencesManager` en `projects/[id]/page.jsx` | PROBABLE | Conviven con `UnifiedResourcesManager`; por lectura parecen versiones previas no usadas en el render actual. |
| Iconos duplicados por pagina (`SearchIcon`, `EyeIcon`, etc.) | CONFIRMADO como duplicacion visual | Hay iconos compartidos en `CatalogIcons`, pero varias paginas redefinen iconos locales. |
| `StatusBadge` / `StatusPill` locales | CONFIRMADO como duplicacion conceptual | Misma responsabilidad visual/semantica implementada por pagina. |
| `Field` local en varias paginas | CONFIRMADO como duplicacion conceptual | Cada vista define su wrapper de label/hint. Puede tener diferencias menores. |
| `WorkspaceListView` auto-crea workspace y `RegisterSerializer` tambien provisiona workspace | CONFIRMADO como solapamiento | Ambos materializan workspace inicial y subscription starter. |
| `fal` generation provider | PROBABLE incompleto | Fal existe en integraciones/modelos permitidos, pero la task usa mock para provider no Gemini. |
| Serializers con campos write_only legacy (`content_type`, `aspect_ratio`, preferencias antiguas) | CONFIRMADO compatibilidad | Varios serializers descartan campos legacy para tolerar payloads antiguos. |

## 14. Resumen final y mapa mental

La plataforma es un estudio de generacion de piezas publicitarias para ecommerce. Un usuario pertenece a un workspace. Dentro del workspace se configura marca, reglas, assets, productos, referencias creativas, recetas y templates. Con esos elementos se crea un `AdProject`, que representa el brief editable de una campana. El proyecto puede recibir BrandAssets y CreativeReferences clasificados por `input_role` y `Purpose`. Al generar, el sistema crea `GenerationBatch` y `GenerationJob`; cada job toma un snapshot de los recursos del proyecto para que el prompt y las referencias sean reproducibles. Celery procesa los jobs, llama Gemini si corresponde, guarda `GeneratedAsset` y actualiza estados de batch/proyecto.

El frontend es una aplicacion Next.js que consume una API REST. Las pantallas no comparten un estado global React; cada ruta carga sus datos y mantiene estado local. El backend concentra la persistencia y validacion de dominio. Las integraciones externas se guardan como conexiones cifradas por workspace. El acceso platform-level se decide combinando membresia, estado de usuario/workspace, politicas administrativas y suscripcion.

Mapa mental del proyecto:

```text
PLATAFORMA
├── Identidad y tenancy
│   ├── User
│   ├── PersonProfile
│   ├── Workspace
│   ├── WorkspaceMember
│   └── CompanyProfile / IndividualProfile
├── Acceso y monetizacion
│   ├── Plan
│   ├── Subscription
│   ├── UserAccessPolicy
│   ├── WorkspaceAccessPolicy
│   └── AccessAuditLog
├── Identidad de marca
│   ├── BrandKit
│   ├── BrandRule
│   ├── WorkspacePreference
│   └── BrandAsset
├── Recursos creativos
│   ├── Product
│   ├── CreativeReference
│   ├── CreativeAngle
│   ├── CreativeRecipe
│   └── AdTemplate
├── Proyectos
│   ├── AdProject
│   ├── ProjectInputAsset
│   ├── ProjectReference
│   └── Purpose
├── Generacion
│   ├── GenerationBatch
│   ├── GenerationJob
│   ├── GenerationJobInputAsset
│   ├── GenerationJobReference
│   ├── GeneratedAsset
│   ├── AssetVariation
│   └── AssetFeedback
├── Integraciones externas
│   ├── AIProviderConnection
│   ├── Gemini validation/models/generation
│   ├── fal.ai validation/models
│   └── Cloudinary storage
└── Frontend
    ├── Auth y onboarding
    ├── Brand Kit
    ├── Productos
    ├── Referencias
    ├── Recetas/Templates
    ├── Proyectos
    ├── Generacion
    ├── Biblioteca
    └── Settings
```

## Conteos verificados

- Modelos Django: 38.
- Serializers backend: 33.
- Views/ViewSets backend: 28.
- Servicios backend principales: 9 archivos (`access_control/services.py`, 3 en `integrations/services`, 3 en `studio/services`, `studio/tasks.py`).
- Rutas frontend App Router: 15.
- Componentes/funciones React declaradas con nombre de componente: 115, incluyendo iconos locales.
- Rutas URL explicitas no-router en backend: 27 `path(...)`.
- ViewSets registrados en DRF router studio: 14.

## Verificacion final

Se recorrio nuevamente el proyecto para comprobar que los modulos principales estuvieran cubiertos:

- `accounts`: documentado.
- `billing`: documentado.
- `access_control`: documentado.
- `integrations`: documentado.
- `studio`: documentado.
- `config`: documentado.
- `frontend/app`: documentado por ruta.
- `frontend/components`, `frontend/hooks`, `frontend/lib`: documentados como codigo compartido.

No se modifico codigo de aplicacion en esta revision; solo se creo este archivo de documentacion.
