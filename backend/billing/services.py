from django.db import transaction
from rest_framework.exceptions import ValidationError
from .models import CreditBalance,CreditMovement
@transaction.atomic
def consume_credits(workspace,user,credits,generation_job=None):
 balance,_=CreditBalance.objects.select_for_update().get_or_create(workspace=workspace,defaults={'available_credits':100})
 if balance.available_credits < credits: raise ValidationError('Créditos insuficientes para esta generación.')
 balance.available_credits-=credits; balance.save(update_fields=['available_credits','updated_at'])
 CreditMovement.objects.create(workspace=workspace,user=user,generation_job=generation_job,movement_type='consumption',credits=-credits,description='Generación de contenido')
 return balance


@transaction.atomic
def refund_generation_credits(job):
 credits=job.credits_consumed
 if credits <= 0:
  return False
 if CreditMovement.objects.filter(
  generation_job=job,
  movement_type='refund',
 ).exists():
  return False
 balance,_=CreditBalance.objects.select_for_update().get_or_create(
  workspace=job.project.workspace,
  defaults={'available_credits':0},
 )
 balance.available_credits+=credits
 balance.save(update_fields=['available_credits','updated_at'])
 CreditMovement.objects.create(
  workspace=job.project.workspace,
  user=job.requested_by,
  generation_job=job,
  movement_type='refund',
  credits=credits,
  description='Reembolso automático por generación fallida',
 )
 return True
