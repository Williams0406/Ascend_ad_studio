from django.apps import apps
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction


class Command(BaseCommand):
 help = 'Elimina todos los datos, incluyendo usuarios y sesiones. No borra migraciones ni tablas.'

 def add_arguments(self, parser):
  parser.add_argument('--yes', action='store_true', help='Confirma el borrado total.')
  parser.add_argument('--keep-recipes', action='store_true', help='Conserva CreativeRecipe con is_system_recipe=True.')
  parser.add_argument(
   '--database',
   default='default',
   help='Alias de la base de datos que se limpiará (default: default).',
  )

 def handle(self, *args, **options):
  if not options['yes']:
   raise CommandError('Operación cancelada. Ejecuta con --yes para confirmar el borrado total.')

  database = options['database']

  if not options['keep_recipes']:
   call_command(
    'flush',
    verbosity=options['verbosity'],
    interactive=False,
    database=database,
    reset_sequences=True,
   )
   self.stdout.write(
    self.style.SUCCESS(
     f'Base de datos "{database}" limpiada correctamente. '
     'Se conservaron las tablas y el historial de migraciones.'
    )
   )
   return

  from studio.models import CreativeRecipe
  CreativeRecipe.objects.using(database).filter(is_system_recipe=False).delete()

  models = [
   model for model in apps.get_models()
   if model._meta.app_label in {'accounts', 'billing', 'studio', 'integrations'}
  ]

  database_connection = connections[database]

  with transaction.atomic(using=database), database_connection.constraint_checks_disabled():
   for model in reversed(models):
    if model._meta.label == 'studio.CreativeRecipe':
     continue
    deleted, _ = model.objects.using(database).all().delete()
    self.stdout.write(f'{model._meta.label}: {deleted} registros eliminados')

  sequence_sql = database_connection.ops.sequence_reset_sql(self.style, models)
  if sequence_sql:
   with database_connection.cursor() as cursor:
    for sql in sequence_sql:
     cursor.execute(sql)

  self.stdout.write(
   self.style.SUCCESS(
    f'Datos de negocio de "{database}" eliminados; se conservaron las recetas del sistema.'
   )
  )
