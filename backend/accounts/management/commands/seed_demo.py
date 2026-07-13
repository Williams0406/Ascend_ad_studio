from django.core.management.base import BaseCommand
from accounts.models import *
from studio.models import CreativeRecipe,BrandKit,Product
from billing.models import Plan,Subscription,CreditBalance
class Command(BaseCommand):
 def handle(self,*args,**kwargs):
  user,_=User.objects.get_or_create(email='demo@ascend.test',defaults={'status':'active'}); user.set_password('Demo12345!'); user.save()
  PersonProfile.objects.get_or_create(user=user,defaults={'first_name':'Demo','last_name':'Ascend'})
  ws,_=Workspace.objects.get_or_create(slug='demo-studio',defaults={'name':'Demo Studio','workspace_type':'individual','owner':user}); WorkspaceMember.objects.get_or_create(workspace=ws,user=user,defaults={'role':'owner'}); IndividualProfile.objects.get_or_create(workspace=ws,defaults={'business_name':'Demo Studio'}); BrandKit.objects.get_or_create(workspace=ws,defaults={'brand_name':'Ascend Demo','primary_color':'#1F3A5F','accent_color':'#F2B84B','tone_of_voice':'Profesional y cercano'})
  Product.objects.get_or_create(workspace=ws,name='Audífonos X200',defaults={'short_description':'Audífonos inalámbricos','original_price':199,'sale_price':149,'primary_benefit':'Cancelación de ruido','target_customer':'Personas que trabajan y estudian'})
  CreativeRecipe.objects.get_or_create(name='Oferta ecommerce',is_system_recipe=True,defaults={'content_type':'flyer','creative_angle':'offer','prompt_template':'Producto central, precio destacado y CTA visible.'})
  plan,_=Plan.objects.get_or_create(name='Starter',defaults={'monthly_price':19,'monthly_credits':500,'max_members':1}); Subscription.objects.get_or_create(workspace=ws,defaults={'plan':plan,'status':'active'}); CreditBalance.objects.get_or_create(workspace=ws,defaults={'available_credits':500})
  self.stdout.write(self.style.SUCCESS('Demo creado: demo@ascend.test / Demo12345!'))
