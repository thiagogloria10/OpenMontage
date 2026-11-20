# Efeitos do "Escapa" (sem narração): passos, armadilhas, quedas, e a sombra resmungando. DUR igual ao Escapa.tsx.
import numpy as np, wave, sys
SR=44100; DUR=[5.2,5.0,5.4,5.0,5.6,3.8]
ST=[0]
for d in DUR[:-1]: ST.append(ST[-1]+d)
TOTAL=ST[-1]+DUR[-1]; out=np.zeros(int(SR*TOTAL)+SR); rng=np.random.default_rng(11)
def add(sig,s,t,g=1.0):
    i=int((ST[s]+t)*SR)
    if i<0: sig=sig[-i:]; i=0
    out[i:i+len(sig)]+=sig[:max(0,len(out)-i)]*g
def env(n,a,r):
    e=np.ones(n); na=max(1,int(a*SR)); nr=max(1,int(r*SR)); e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
def noise(d): return rng.standard_normal(int(SR*d))
def lp(x,k): c=np.cumsum(np.concatenate([[0],x])); y=(c[k:]-c[:-k])/k; return np.concatenate([y,np.zeros(k-1)])
def hp(x,k): return x-lp(x,k)
def tone(f,d,dec): t=np.arange(int(SR*d))/SR; return np.sin(2*np.pi*f*t)*np.exp(-t*dec)
def step():
    t=np.arange(int(SR*0.08))/SR; x=lp(noise(0.08),4)*np.exp(-t*50)+np.sin(2*np.pi*110*t)*np.exp(-t*45)*0.4; return x/np.abs(x).max()
def steps(s,t0,t1,every=0.5,g=0.25):
    for k in np.arange(t0,t1,every): add(step(),s,k,g)
def crash(d=0.6):
    x=hp(noise(d),2)*np.exp(-np.arange(int(SR*d))/SR*7); return x/np.abs(x).max()
def thud(f=70): t=np.arange(int(SR*0.4))/SR; return np.sin(2*np.pi*(f+80*np.exp(-t*25))*t)*np.exp(-t*10)
def whoosh(d=0.4):
    n=int(SR*d); y=lp(noise(d),18); return y/np.abs(y).max()*np.sin(np.linspace(0,np.pi,n))**2
def growl(d=0.7):
    t=np.arange(int(SR*d))/SR; f=70+15*np.sin(t*18); x=np.sign(np.sin(2*np.pi*np.cumsum(f)/SR)); x=lp(x,40)*env(len(t),0.05,0.2); return x/np.abs(x).max()
def giggle():
    t=np.arange(int(SR*0.6))/SR; f=180+40*np.sin(t*40); x=np.sin(2*np.pi*np.cumsum(f)/SR)*(0.5+0.5*np.sign(np.sin(2*np.pi*7*t))); return lp(x,20)*env(len(t),0.02,0.1)
def ding(): return tone(2093,0.8,6)+0.5*tone(3136,0.8,8)
def glug():
    s=np.zeros(int(SR*0.9))
    for i in range(6):
        t=np.arange(int(SR*0.1))/SR; b=np.sin(2*np.pi*(200+i*20+300*t)*t)*np.exp(-t*30); j=int(i*0.14*SR); s[j:j+len(b)]+=b
    return s
def snip(): return hp(noise(0.05),2)*np.exp(-np.arange(int(SR*0.05))/SR*80)
def bell(): return sum(tone(f,1.2,4) for f in (1320,1760,2640))/3
def drops(d):
    s=np.zeros(int(SR*d))
    for _ in range(int(d*20)):
        j=rng.integers(0,len(s)-800); s[j:j+800]+=tone(3000+rng.random()*2000,800/SR,90)*0.5
    return s
def splash(): x=hp(noise(0.9),3)*env(int(SR*0.9),0.02,0.6); return x/np.abs(x).max()
def rattle(d):
    t=np.arange(int(SR*d))/SR; x=hp(noise(d),2)*(0.5+0.5*np.sign(np.sin(2*np.pi*14*t))); return x/np.abs(x).max()*env(len(t),0.1,0.1)
def birds(d):
    s=np.zeros(int(SR*d))
    for k in np.arange(0.2,d-0.3,0.7):
        t=np.arange(int(SR*0.15))/SR; fr=2600+700*np.sin(np.pi*t/0.15); b=np.sin(2*np.pi*np.cumsum(fr)/SR)*env(len(t),0.01,0.05); j=int(k*SR); s[j:j+len(b)]+=b
    return s
def car(d):
    t=np.arange(int(SR*d))/SR; f=90+60*np.sin(np.clip(t/d,0,1)*np.pi); x=np.sin(2*np.pi*np.cumsum(f)/SR)*0.5+lp(noise(d),8)*0.5; return x/np.abs(x).max()*np.sin(np.linspace(0,np.pi,len(t)))
# ambiente de rua leve em tudo
amb=lp(noise(TOTAL),50); add(amb/np.abs(amb).max(),0,0,0.05)
for s in range(len(DUR)): add(birds(DUR[s]),s,0,0.04)
for s in range(1,len(DUR)): add(whoosh(0.3),s,-0.12,0.1)
# S1 vaso
steps(0,0.05,1.85); steps(0,3.5,5.2)
add(giggle(),0,1.3,0.25); add(whoosh(0.6),0,1.75,0.25); add(crash(0.7),0,2.33,0.6); add(thud(90),0,2.33,0.5); add(growl(0.8),0,2.9,0.3)
# S2 óleo e moeda
steps(1,0.05,1.95); steps(1,2.95,5.0)
add(glug(),1,0.5,0.35); add(ding(),1,2.5,0.35); add(whoosh(0.3),1,3.25,0.15)
add(whoosh(0.4),1,4.35,0.25); add(thud(60),1,4.75,0.55); add(growl(0.6),1,4.8,0.3)
# S3 placa
steps(2,0.05,2.6); steps(2,4.0,5.4)
for k in np.arange(1.3,2.9,0.35): add(snip(),2,k,0.4)
add(bell(),2,2.6,0.25); add(crash(0.8),2,3.32,0.6); add(thud(80),2,3.32,0.5); add(bell(),2,3.95,0.2)
# S4 garoa, guarda-chuva, carro e poça
add(drops(5.0),3,0,0.12); steps(3,0.05,1.4); steps(3,2.05,5.0)
add(whoosh(0.3),3,1.5,0.25); add(car(1.6),3,1.9,0.5); add(splash(),3,2.62,0.6); add(giggle(),3,2.0,0.18)
# S5 carrinho e caixas
steps(4,0.05,1.2); add(tone(1200,0.15,20),4,2.35,0.25); steps(4,2.45,4.6)
add(giggle(),4,0.8,0.25); add(rattle(1.8),4,1.45,0.35); add(crash(0.6),4,3.15,0.55); add(thud(70),4,3.2,0.5)
for k in (3.3,3.45,3.6): add(thud(110),4,k,0.3)
add(thud(60),4,4.6,0.5); add(growl(0.7),4,4.65,0.3)
# S6
add(thud(120),5,0.95,0.4); steps(5,0.1,3.8,0.55,0.12)
out=out[:int(SR*TOTAL)]; out=out/np.abs(out).max()*0.9
w=wave.open(sys.argv[1],'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close(); print('ok',TOTAL)
