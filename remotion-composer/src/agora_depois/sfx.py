# Efeitos do "Agora ou depois" (sem narração). Tempos por cena, DUR igual ao AgoraDepois.tsx.
import numpy as np, wave, sys
SR=44100; DUR=[4.6,4.0,4.4,3.4,1.7,4.4,5.6,4.6]
ST=[0]
for d in DUR[:-1]: ST.append(ST[-1]+d)
TOTAL=ST[-1]+DUR[-1]; out=np.zeros(int(SR*TOTAL)+SR); rng=np.random.default_rng(4)
def add(sig,s,t,g=1.0):
    i=int((ST[s]+t)*SR); out[i:i+len(sig)]+=sig[:max(0,len(out)-i)]*g
def env(n,a,r):
    e=np.ones(n); na=max(1,int(a*SR)); nr=max(1,int(r*SR)); e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
def noise(d): return rng.standard_normal(int(SR*d))
def lp(x,k): c=np.cumsum(np.concatenate([[0],x])); y=(c[k:]-c[:-k])/k; return np.concatenate([y,np.zeros(k-1)])
def tone(f,d,dec): t=np.arange(int(SR*d))/SR; return np.sin(2*np.pi*f*t)*np.exp(-t*dec)
def pop(): a=tone(900,0.12,30); b=tone(1400,0.12,45); return a+b*0.5          # balão aparecendo
def step():
    t=np.arange(int(SR*0.09))/SR; x=lp(noise(0.09),5)*np.exp(-t*45)+np.sin(2*np.pi*90*t)*np.exp(-t*40)*0.5; return x/np.abs(x).max()
def whoosh(d=0.35):
    n=int(SR*d); y=lp(noise(d),25); return y/np.abs(y).max()*np.sin(np.linspace(0,np.pi,n))**2
def scribble(d):
    x=noise(d)-lp(noise(d),3); x*=(0.5+0.5*np.sign(np.sin(np.arange(int(SR*d))/SR*2*np.pi*7))); return x/np.abs(x).max()*env(int(SR*d),0.05,0.1)
def tick(): return tone(2600,0.04,200)+tone(1200,0.04,120)*0.4
def page(): x=noise(0.25)-lp(noise(0.25),3); return x/np.abs(x).max()*env(int(SR*0.25),0.01,0.18)
def bird(f):
    t=np.arange(int(SR*0.18))/SR; fr=f+600*np.sin(np.pi*t/0.18); return np.sin(2*np.pi*np.cumsum(fr)/SR)*env(len(t),0.01,0.06)
def thud(): t=np.arange(int(SR*0.3))/SR; return np.sin(2*np.pi*(80+60*np.exp(-t*20))*t)*np.exp(-t*12)
def chime():
    t=np.arange(int(SR*1.4))/SR; return sum(np.sin(2*np.pi*f*t)*np.exp(-t*3) for f in (660,880,1320))/3
for s in range(1,len(DUR)): add(whoosh(),s,-0.12,0.18)
# (sem ruído de fundo: o Thiago pediu só os efeitos)
# S1-S3: passos, balões, escrevendo
for k in np.arange(0.0,1.1,0.25): add(step(),0,k,0.3)
add(pop(),0,1.2,0.5); add(pop(),0,2.5,0.45)
for s,(a,b) in ((1,(0.8,2.0)),(2,(0.9,2.3))):
    for k in np.arange(0.0,0.7,0.25): add(step(),s,k,0.3)
    add(pop(),s,a,0.5); add(pop(),s,b,0.45)
for s in (0,1,2): add(scribble(0.8),s,DUR[s]-0.9,0.08)
# S4: noite, relógio e escrita
for k in np.arange(0.0,3.4,0.5): add(tick(),3,k,0.3)
add(scribble(3.2),3,0.1,0.1)
# S5: páginas voando
for k in np.arange(0.05,1.3,0.12): add(page(),4,k,0.18)
# S6: passarinhos, balão, brilho
for k in (0.3,0.6,1.8,2.1,3.4): add(bird(2400+(k*900)%800),5,k,0.12)
add(pop(),5,1.0,0.45); add(chime(),5,1.05,0.15)
# S7: relógio de madrugada, balões, cabeça caindo no livro
for k in np.arange(0.0,5.6,0.5): add(tick(),6,k,0.35)
for k in (0.5,1.5,2.4): add(pop(),6,k,0.5)
add(thud(),6,3.1,0.5)
# S8
add(chime(),7,0.2,0.2); add(thud(),7,0.3,0.45); add(thud(),7,0.75,0.4)
out=out[:int(SR*TOTAL)]; out=out/np.abs(out).max()*0.9
w=wave.open(sys.argv[1],'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close(); print('ok',TOTAL)
