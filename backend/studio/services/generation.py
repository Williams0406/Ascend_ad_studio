from io import BytesIO
from PIL import Image,ImageDraw,ImageFont
from django.core.files.base import ContentFile
from django.utils import timezone
from studio.models import GeneratedAsset

class MockGenerationProvider:
 def generate(self,job):
  project=job.project; outputs=[]
  for i in range(job.number_of_outputs):
   image=Image.new('RGB',(1080,1350),(245,245,245)); draw=ImageDraw.Draw(image)
   draw.rounded_rectangle((70,70,1010,1280),radius=35,outline=(40,40,40),width=4)
   draw.text((120,130),project.headline or project.name,fill=(20,20,20))
   draw.text((120,240),project.offer_text or 'Contenido publicitario generado',fill=(60,60,60))
   draw.text((120,1120),project.call_to_action or 'Compra ahora',fill=(20,20,20))
   draw.text((120,1210),f'Variación {i+1} · {project.aspect_ratio}',fill=(110,110,110))
   buf=BytesIO(); image.save(buf,format='PNG')
   asset=GeneratedAsset(job=job,project=project,asset_type='image',prompt_used=job.prompt,metadata={'provider':job.provider,'model':job.model_name,'variation':i+1,'byok_mvp':True})
   asset.file.save(f'{project.id}-{job.id}-{i+1}.png',ContentFile(buf.getvalue()),save=True); outputs.append(asset)
  job.status='completed'; job.completed_at=timezone.now(); job.save(update_fields=['status','completed_at']); project.status='completed'; project.save(update_fields=['status']); return outputs
