from django.contrib import admin
from .models import *
admin.site.register([User,PersonProfile,Workspace,WorkspaceMember,CompanyProfile,IndividualProfile,PlatformAdmin])
