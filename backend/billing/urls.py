from django.urls import path
from .views import PlanListView
urlpatterns=[path('plans/',PlanListView.as_view())]
