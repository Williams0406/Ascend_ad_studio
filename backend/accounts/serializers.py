from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from billing.models import CreditBalance, Plan, Subscription
from .models import User,PersonProfile,Workspace,WorkspaceMember,CompanyProfile,IndividualProfile

class ProfileSerializer(serializers.ModelSerializer):
 class Meta: model=PersonProfile; fields=['first_name','last_name','phone','job_title','avatar_url','country_code','city']
class UserSerializer(serializers.ModelSerializer):
 profile=ProfileSerializer(read_only=True)
 class Meta: model=User; fields=['id','email','status','profile']
class WorkspaceSerializer(serializers.ModelSerializer):
 role=serializers.SerializerMethodField()
 class Meta: model=Workspace; fields=['id','name','slug','workspace_type','status','currency_code','timezone','role']
 def get_role(self,obj):
  user=self.context['request'].user
  m=obj.memberships.filter(user=user,is_active=True).first(); return m.role if m else None
class RegisterSerializer(serializers.Serializer):
 email=serializers.EmailField(); password=serializers.CharField(write_only=True,min_length=8); first_name=serializers.CharField(); last_name=serializers.CharField(); account_type=serializers.ChoiceField(choices=['individual','company']); workspace_name=serializers.CharField(); legal_name=serializers.CharField(required=False,allow_blank=True)
 @transaction.atomic
 def create(self,validated):
  user=User.objects.create_user(validated['email'],validated['password'],status='active')
  PersonProfile.objects.create(user=user,first_name=validated['first_name'],last_name=validated['last_name'])
  base=slugify(validated['workspace_name']) or 'workspace'; slug=base; i=1
  while Workspace.objects.filter(slug=slug).exists(): i+=1; slug=f'{base}-{i}'
  ws=Workspace.objects.create(name=validated['workspace_name'],slug=slug,workspace_type=validated['account_type'],owner=user)
  WorkspaceMember.objects.create(workspace=ws,user=user,role='owner')
  if validated['account_type']=='company': CompanyProfile.objects.create(workspace=ws,legal_name=validated.get('legal_name') or validated['workspace_name'])
  else: IndividualProfile.objects.create(workspace=ws,business_name=validated['workspace_name'])
  plan,_=Plan.objects.get_or_create(name='Starter',defaults={'monthly_price':19,'monthly_credits':500,'max_members':1})
  Subscription.objects.create(workspace=ws,plan=plan,status='trialing')
  CreditBalance.objects.create(workspace=ws,available_credits=plan.monthly_credits)
  return user
 def to_representation(self,instance):
  return UserSerializer(instance).data
class EmailTokenSerializer(TokenObtainPairSerializer):
 @classmethod
 def get_token(cls,user):
  token=super().get_token(user); token['email']=user.email; return token
 def validate(self,attrs):
  data=super().validate(attrs); data['user']=UserSerializer(self.user).data; return data
