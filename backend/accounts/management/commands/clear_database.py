from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction


class Command(BaseCommand):
 help = 'Elimina todos los datos de negocio, incluyendo usuarios. No borra migraciones ni tablas.'

 def add_arguments(self, parser):
  parser.add_argument('--yes', action='store_true', help='Confirma el borrado total.')
  parser.add_argument('--keep-recipes', action='store_true', help='Conserva CreativeRecipe con is_system_recipe=True.')

 @transaction.atomic
 def handle(self, *args, **options):
  if not options['yes']:
   raise CommandError('Operación cancelada. Ejecuta con --yes para confirmar el borrado total.')

  if options['keep_recipes']:
   from studio.models import CreativeRecipe
   CreativeRecipe.objects.filter(is_system_recipe=False).delete()

  models = [
   model for model in apps.get_models()
   if model._meta.app_label in {'accounts', 'billing', 'studio', 'integrations'}
  ]

  with connection.constraint_checks_disabled():
   for model in reversed(models):
    if options['keep_recipes'] and model._meta.label == 'studio.CreativeRecipe':
     continue
    deleted, _ = model.objects.all().delete()
    self.stdout.write(f'{model._meta.label}: {deleted} registros eliminados')

  sequence_sql = connection.ops.sequence_reset_sql(self.style, models)
  if sequence_sql:
   with connection.cursor() as cursor:
    for sql in sequence_sql:
     cursor.execute(sql)

  self.stdout.write(self.style.SUCCESS('Base de datos limpiada correctamente.'))
