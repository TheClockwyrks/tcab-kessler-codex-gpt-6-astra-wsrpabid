"""One-time asset authoring. Not used by the application build."""
import json, math, subprocess, pathlib, random, wave, struct
ROOT=pathlib.Path(__file__).resolve().parents[2]
def run(tool,*args):
 subprocess.run([tool,*map(str,args)],check=True,stdout=subprocess.DEVNULL)
def pixels(name,size,fn,tool='draw'):
 ops=[]
 for y in range(size):
  for x in range(size):
   c=fn(x+.5,y+.5)
   if c:
    ops.append(dict(op='set_pixel',x=x,y=y,color='#'+''.join(f'{max(0,min(255,round(v))):02x}' for v in c)))
 log=ROOT/'assets/source'/f'{name.replace("/","-")}.json'; log.write_text(json.dumps(ops))
 run(tool,'render','--actions',log,'--out',ROOT/'assets/sprites'/f'{name}.png','--width',size,'--height',size,'--no-layers')
def noise(x,y,z):
 ix,iy,iz=math.floor(x),math.floor(y),math.floor(z)
 fx,fy,fz=x-ix,y-iy,z-iz
 fx,fy,fz=[t*t*(3-2*t) for t in (fx,fy,fz)]
 def h(a,b,c):
  n=(a*73856093 ^ b*19349663 ^ c*83492791)&0xffffffff
  n=((n^(n>>13))*1274126177)&0xffffffff
  return (n&65535)/32767.5-1
 return sum(h(ix+a,iy+b,iz+c)*(fx if a else 1-fx)*(fy if b else 1-fy)*(fz if c else 1-fz) for a in (0,1) for b in (0,1) for c in (0,1))
def fbm(x,y,z):
 return sum(noise(x*2**i,y*2**i,z*2**i)*.5**i for i in range(5))
def planet(x,y):
 dx=(x-80)/70; dy=(y-80)/70; r=math.hypot(dx,dy)
 if r>1:
  return (84,178,208,60*max(0,1-(r-1)*10)**2) if r<1.1 else None
 z=math.sqrt(1-r*r); light=max(.025,dx*-.45+dy*-.5+z*.75)
 terrain=fbm(dx*2.3+4,dy*2.3+6,z*2.3+3)
 if terrain>-.08:
  elevation=min(1,max(0,(terrain+.08)*2))
  base=tuple(a+(b-a)*elevation for a,b in zip((189,148,93),(103,109,81)))
 else:
  depth=min(1,(-terrain-.08)*5)
  base=tuple(a+(b-a)*depth for a,b in zip((44,113,124),(18,53,76)))
 if abs(dy)>.88+terrain*.05:base=(197,208,206)
 cloud=max(0,fbm(dx*4+12,dy*4+8+math.sin(dx*3),z*4+9)-.25)*.6
 cloud=min(.8,cloud)
 rim=(1-z)**4
 return tuple((v*(1-cloud)+227*cloud)*light+rim*t for v,t in zip(base,(35,73,86)))+(255,)
pixels('planet',160,planet)
colors={'widen':(115,242,203),'narrow':(255,113,110),'multiball':(169,180,255),'shield':(102,211,255),'pierce':(255,203,118)}
for kind,col in colors.items():
 def pod(x,y,k=kind,c=col):
  dx=x-12;dy=y-12;r=math.hypot(dx,dy)
  if r>11:return None
  if r>9:return (*c,110 if r>10 else 240)
  mark=False
  if k=='widen':mark=abs(dy)<1.3 and abs(dx)<6 or abs(abs(dx)-5)<1.3 and abs(dy)<3.5
  if k=='narrow':mark=abs(dx-dy)<1.4 and abs(dx)<5 or abs(dx+dy)<1.4 and abs(dx)<5
  if k=='multiball':mark=any(math.hypot(dx-a,dy-b)<2.4 for a,b in [(0,-4),(-4,3),(4,3)])
  if k=='shield':mark=abs(math.hypot(dx,dy+1)-5)<1.2 and dy<3 or abs(dx)<1.4 and 3<dy<6
  if k=='pierce':mark=abs(dx)<1.3 and abs(dy)<6 or abs(dx+dy+3)<1.3 and -5<dy<-1
  return (*c,255) if mark else (14+max(0,-dy),28+max(0,-dy),38+max(0,-dy),255)
 pixels('pods/'+kind,24,pod)
for frame in range(6):
 def ball(x,y,f=frame):
  dx=(x-12)/8;dy=(y-12)/8;r=math.hypot(dx,dy)
  if r>1:return (124,219,255,70*max(0,1-(r-1)*2)**2) if r<1.5 else None
  z=math.sqrt(1-r*r);light=.28+.72*max(0,(-dx-dy+z)/1.73)
  stripe=abs(math.sin(math.atan2(dx,z)*2+f*math.pi/6+dy*.8))<.28
  c=(57,140,168) if stripe else (225,245,250)
  return tuple(v*light for v in c)+(255,)
 pixels('ball/'+str(frame),24,ball,'draw-sheet')
# Tool configs remain as provenance; the published files alone are required to build.
for name,count,speed,size,color in [('burst',42,95,4,'#b9edff@0,#769dbb@0.5,#e8ac77@1'),('spark',18,75,2,'#ffffff@0,#8bdfff@1'),('burnup',30,55,4,'#fff1cc@0,#ffad64@0.4,#aa453d@1')]:
 cfg=ROOT/'assets/source'/f'{name}.config.json'
 cfg.write_text(json.dumps(dict(width=160,height=160,duration_ms=1000,fps=30,seed=42,actions=str(ROOT/'assets/source'/f'{name}.ops.json'),preview=f'/tmp/{name}.gif',system=str(ROOT/'assets/particles'/f'{name}.json'))))
 run('particle-2d','--config',cfg,'init')
 run('particle-2d','--config',cfg,'add-emitter','--name','debris','--shape','point','--x',0,'--y',0,'--burst',count,'--lifetime',650,'--lifetime-spread',200,'--speed',speed,'--speed-spread',speed/2,'--cone-angle',180)
 run('particle-2d','--config',cfg,'set-particle','--emitter','debris','--size-from',size,'--size-to',0,'--opacity-from',1,'--opacity-to',0,'--color-gradient',color,'--stretch',.025)
 run('particle-2d','--config',cfg,'render')
cues=[('paddle-bounce',720,190,90),('field-bounce',440,100,130),('target-hit',980,420,110),('target-break',210,55,420),('shield-reflect',1150,260,350),('pod-catch',660,1320,260),('pod-catch-narrow',330,110,340),('pod-burn',160,45,450),('ball-lost',220,40,650),('wave-clear',440,1760,900),('game-over',65,24,1800),('menu-move',1200,900,45),('menu-select',900,1500,100)]
for name,freq,end,dur in cues:
 cfg=ROOT/'assets/source'/f'{name}.config.json'; cfg.write_text(json.dumps(dict(sample_rate=44100,channels='stereo',max_duration_ms=dur+400,seed=21,actions=str(ROOT/'assets/source'/f'{name}.ops.json'),preview=f'/tmp/{name}.png',wav=str(ROOT/'assets/audio'/f'{name}.wav'))))
 run('sfx-synth','--config',cfg,'init')
 run('sfx-synth','--config',cfg,'add-voice','--name','glass','--wave','sine','--freq',freq,'--gain',-13,'--dur',dur)
 run('sfx-synth','--config',cfg,'set-envelope','--voice','glass','--env','pluck')
 run('sfx-synth','--config',cfg,'set-pitch','--voice','glass','--slide-to',end,'--over',dur)
 if name not in ['menu-move','menu-select']:
  run('sfx-synth','--config',cfg,'add-voice','--name','metal','--wave','triangle','--freq',freq*2.73,'--gain',-24,'--dur',dur*.6)
  run('sfx-synth','--config',cfg,'set-envelope','--voice','metal','--env','pluck')
 if name in ['target-break','ball-lost','game-over','pod-burn']:
  run('sfx-synth','--config',cfg,'add-voice','--name','debris','--wave','noise','--gain',-25,'--dur',dur*.75)
  run('sfx-synth','--config',cfg,'set-envelope','--voice','debris','--env','pluck')
 run('sfx-synth','--config',cfg,'render')
for name,tempo in [('title',96),('play',120)]:
 cfg=ROOT/'assets/source'/f'music-{name}.config.json'; cfg.write_text(json.dumps(dict(sample_rate=44100,channels='stereo',max_duration_ms=40000,seed=52,instrument_bank='synthwave',actions=str(ROOT/'assets/source'/f'music-{name}.ops.json'),preview=f'/tmp/music-{name}.png',wav=str(ROOT/'assets/audio'/f'music-{name}.wav'),midi=f'/tmp/music-{name}.mid')))
 run('music','--config',cfg,'init');run('music','--config',cfg,'set-tempo','--bpm',tempo)
 for track,inst,gain in [('glass','sine',-25),('bass','triangle',-29),('air','sine',-33)]:
  run('music','--config',cfg,'define-track','--name',track,'--instrument',inst)
  run('music','--config',cfg,'set-track-fx','--track',track,'--gain',gain,'--env','pluck' if track=='glass' else 'gate')
 notes=[62,69,74,77,60,67,72,76,58,65,70,74,60,67,72,76]
 for i in range(96):
  run('music','--config',cfg,'add-note','--track','glass','--pitch',notes[(i//8)*4%16+i%4]+(12 if i%8==7 else 0),'--t',i*.5,'--dur',.45,'--velocity',65 if i%2 else 90)
 for i in range(12):
  root=notes[(i%4)*4]-24
  run('music','--config',cfg,'add-note','--track','bass','--pitch',root,'--t',i*4,'--dur',3.95,'--velocity',80)
  run('music','--config',cfg,'add-note','--track','air','--pitch',root+31,'--t',i*4,'--dur',4,'--velocity',55)
 run('music','--config',cfg,'render')
 # Fold the rendered lead-in and tail onto a periodic 32-beat loop.
 path=ROOT/'assets/audio'/f'music-{name}.wav'
 with wave.open(str(path),'rb') as w: params=w.getparams(); raw=w.readframes(w.getnframes())
 samples=struct.unpack('<'+'h'*(len(raw)//2),raw); n=round(32*60/tempo*params.framerate); offset=round(8*60/tempo*params.framerate); fade=round(.12*params.framerate)
 out=list(samples[offset*2:(offset+n)*2]); out += [0]*(n*2-len(out))
 for i in range(fade):
  t=i/fade
  for ch in range(2):
   tail=samples[(offset+n+i)*2+ch] if (offset+n+i)*2+ch<len(samples) else 0
   out[i*2+ch]=round(out[i*2+ch]*t+tail*(1-t))
 with wave.open(str(path),'wb') as w:w.setparams(params);w.writeframes(struct.pack('<'+'h'*len(out),*out))
