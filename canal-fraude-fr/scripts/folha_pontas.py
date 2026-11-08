"""Primeiro e último quadro de cada imagem de apoio, para pegar fusão e texto que entra no fim da janela."""
import json,pathlib,subprocess,sys
from PIL import Image,ImageDraw
EP=pathlib.Path(sys.argv[1]);p=json.load(open(EP/'plano-visual.json',encoding='utf-8'))
ap=[(k,b) for k,v in p['cenas'].items() for b in v if b['tipo']=='apoio']
c=[(str(i)+'c',{'video':x['video'],'de':x['de'],'ate':x['ate']}) for i,x in enumerate([])]
TW,TH,COL=320,180,6
pares=[(k,b,t) for k,b in ap for t in (b['de']+.05,b['ate']-.05)]
lin=(len(pares)+COL-1)//COL
s=Image.new('RGB',(COL*TW,lin*TH))
q=EP/'build'/'_p.jpg'
for i,(k,b,t) in enumerate(pares):
    subprocess.run(['ffmpeg','-y','-v','error','-ss',f'{t:.2f}','-i',str(EP/'fontes'/f"{b['video']}.mp4"),'-frames:v','1','-vf',f'scale={TW}:{TH}',str(q)])
    im=Image.open(q).convert('RGB');d=ImageDraw.Draw(im);d.rectangle([0,0,90,16],fill=(0,0,0));d.text((3,2),f"{k}:{t:.0f}",fill=(255,255,0))
    s.paste(im,((i%COL)*TW,(i//COL)*TH))
s.save(EP/'build'/'pontas.jpg',quality=80);q.unlink();print(len(pares),'quadros')
