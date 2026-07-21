from django.urls import path
from .views import ProviderConnectionsView,ProviderConnectionDetailView,TestProviderConnectionView,DefaultProviderConnectionView,ProviderModelsView

urlpatterns=[
 path('providers/',ProviderConnectionsView.as_view()),
 path('providers/connect/',ProviderConnectionsView.as_view()),
 path('providers/<uuid:connection_id>/',ProviderConnectionDetailView.as_view()),
 path('providers/<uuid:connection_id>/test/',TestProviderConnectionView.as_view()),
 path('providers/<uuid:connection_id>/default/',DefaultProviderConnectionView.as_view()),
 path('providers/<uuid:connection_id>/models/',ProviderModelsView.as_view()),
]
