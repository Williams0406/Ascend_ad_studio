from django.urls import path
from .views import PlanListView,CreditBalanceView
urlpatterns=[path('plans/',PlanListView.as_view()),path('credits/',CreditBalanceView.as_view())]
