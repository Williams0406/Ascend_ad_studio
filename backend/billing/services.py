from django.db import transaction
from rest_framework.exceptions import ValidationError
from .models import CreditBalance,CreditMovement
@transaction.atomic
def consume_credits(workspace,user,credits):
 balance,_=CreditBalance.objects.select_for_update().get_or_create(workspace=workspace,defaults={'available_credits':100})
 if balance.available_credits < credits: raise ValidationError('Créditos insuficientes para esta generación.')
 balance.available_credits-=credits; balance.save(update_fields=['available_credits','updated_at'])
 CreditMovement.objects.create(workspace=workspace,user=user,movement_type='consumption',credits=-credits,description='Generación de contenido')
 return balance
