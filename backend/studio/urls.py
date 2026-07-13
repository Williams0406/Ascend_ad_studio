from rest_framework.routers import DefaultRouter
from .views import BrandKitViewSet,ProductViewSet,RecipeViewSet,ProjectViewSet
router=DefaultRouter(); router.register('brand-kits',BrandKitViewSet,basename='brand-kit'); router.register('products',ProductViewSet,basename='product'); router.register('recipes',RecipeViewSet,basename='recipe'); router.register('projects',ProjectViewSet,basename='project')
urlpatterns=router.urls
