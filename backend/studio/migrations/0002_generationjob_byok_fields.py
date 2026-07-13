import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

 dependencies = [
  ('integrations','0001_initial'),
  ('studio','0001_initial'),
 ]

 operations = [
  migrations.AddField(
   model_name='generationjob',
   name='provider_connection',
   field=models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.PROTECT,related_name='generation_jobs',to='integrations.aiproviderconnection'),
  ),
  migrations.AddField(
   model_name='generationjob',
   name='provider_request_id',
   field=models.CharField(blank=True,max_length=255),
  ),
  migrations.AddField(
   model_name='generationjob',
   name='estimated_cost_usd',
   field=models.DecimalField(blank=True,decimal_places=6,max_digits=12,null=True),
  ),
  migrations.AddField(
   model_name='generationjob',
   name='actual_cost_usd',
   field=models.DecimalField(blank=True,decimal_places=6,max_digits=12,null=True),
  ),
  migrations.AlterField(
   model_name='generationjob',
   name='model_name',
   field=models.CharField(default='mock-ad-generator',max_length=200),
  ),
 ]
