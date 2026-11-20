# Efeitos sonoros do "Impulso": zumbido dos motores, gravidade, impulsos, chegada e rebobinar.
import numpy as np, wave, sys
SR=44100; TOTAL=14.0; out=np.zeros(int(SR*TOTAL)+SR); rng=np.random.default_rng(3)
def add(sig,t,g=1.0):
    i=int(t*SR); out[i:i+len(sig)]+=sig[:max(0,len(out)-i)]*g
def env(n,a,r):
    e=np.ones(n); na=max(1,int(a*SR)); nr=max(1,int(r*SR)); e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
def lp(x,k): c=np.cumsum(np.concatenate([[0],x])); y=(c[k:]-c[:-k])/k; return np.concatenate([y,np.zeros(k-1)])
def noise(d): return rng.standard_normal(int(SR*d))
t=np.arange(int(SR*13.3))/SR
# zumbido grave de fundo (espaço) + motores
drone=(np.sin(2*np.pi*55*t)*0.5+np.sin(2*np.pi*82.5*t)*0.3)*(0.7+0.3*np.sin(t*0.7))
add(drone*env(len(t),1.0,0.6),0,0.18)
eng=lp(noise(13.3),40)*(1+0.3*np.sin(t*9)); add(eng/np.abs(eng).max()*env(len(t),0.3,0.4),0,0.10)
# largada
def whoosh(d,up=True):
    n=int(SR*d); x=noise(d); y=lp(x,12); e=np.sin(np.linspace(0,np.pi,n))**2; return y/np.abs(y).max()*e
add(whoosh(0.9),0.0,0.35)
# gravidade puxando (tom descendo) perto de cada planeta
def sweep(f0,f1,d):
    tt=np.arange(int(SR*d))/SR; f=np.linspace(f0,f1,len(tt)); return np.sin(2*np.pi*np.cumsum(f)/SR)*env(len(tt),0.3,0.4)
add(sweep(320,90,2.4),2.8,0.25); add(sweep(320,90,2.0),6.4,0.22)
# impulso: estrondo + subida
def boom():
    tt=np.arange(int(SR*1.4))/SR; x=np.sin(2*np.pi*(48+60*np.exp(-tt*6))*tt)*np.exp(-tt*2.5)+lp(noise(1.4),30)*np.exp(-tt*4)*0.6; return x/np.abs(x).max()
for bt in (5.55,8.55):
    add(boom(),bt,0.7); add(sweep(200,1400,0.6),bt,0.25); add(whoosh(0.7),bt,0.4)
# chegada da azul (brilho) e da dourada
def chime(f):
    tt=np.arange(int(SR*1.8))/SR; return sum(np.sin(2*np.pi*f*m*tt)*np.exp(-tt*(2.5+m)) for m in (1,1.5,2,3))/3
add(boom()*0.6,10.6,0.5); add(chime(880),10.6,0.45); add(chime(660),11.9,0.3)
# rebobinar
tt=np.arange(int(SR*0.7))/SR; f=600+1800*np.sin(tt*20)**2; rew=np.sin(2*np.pi*np.cumsum(f)/SR)*0.3+lp(noise(0.7),3)*0.3
add(rew*env(len(tt),0.05,0.1),13.3,0.35)
out=out[:int(SR*TOTAL)]; out=out/np.abs(out).max()*0.9
w=wave.open(sys.argv[1],'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close(); print('ok')
