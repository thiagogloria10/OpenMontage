# Efeitos do "Bolas": rolamento de cada bola (volume e brilho pela velocidade real), batidas nos cortes,
# chegada da ondulada (impacto + brilho) e da reta. Mesma física do Bolas.tsx.
import numpy as np, wave, sys, math
SR=44100; TOTAL=13.8; L,H,A,G=24,5.2,1.15,9.8; START,SLOW=0.15,2.0
rng=np.random.default_rng(5); out=np.zeros(int(SR*TOTAL)+SR)
def sim(yf):
    N=4000;t=0;v0=0.6;y0=yf(0);ts=[0];vs=[v0]
    for i in range(1,N+1):
        s0=(i-1)/N;s1=i/N;dy=yf(s1)-yf(s0);ds=math.hypot(L/N,dy);ym=yf((s0+s1)/2)
        v=math.sqrt(v0*v0+2*G*(y0-ym))*0.97;t+=ds/v;ts.append(t);vs.append(v)
    return t,np.array(ts),np.array(vs)
TS,tss,vss=sim(lambda s:H*(1-s)); TW,tsw,vsw=sim(lambda s:H*(1-s)-A*math.sin(3*math.pi*s)**2)
def simTime(t):
    x=max(0,t-START); twv=TW*SLOW
    if x<twv-1.2: return x/SLOW
    return (twv-1.2)/SLOW+(x-(twv-1.2))/(SLOW*2.2)
def fin(T):
    t=0
    while simTime(t)<T: t+=1/240
    return t
FW,FS=fin(TW),fin(TS)
tt=np.arange(int(SR*TOTAL))/SR
st=np.array([simTime(x) for x in tt[::100]]); st=np.interp(tt,tt[::100],st)
def roll(ts,vs,T,seed):
    v=np.interp(st,ts,vs)*(st<T); n=np.random.default_rng(seed).standard_normal(len(tt))
    # filtro passa-baixa variável (mais rápido = mais agudo)
    a=np.clip(0.02+v/60,0.02,0.25); y=np.zeros_like(n); acc=0.0
    for i in range(0,len(n)):
        acc+=a[i]*(n[i]-acc); y[i]=acc
    hum=np.sin(2*np.pi*np.cumsum(40+v*6)/SR)*0.3
    return (y/np.abs(y).max()+hum)*np.clip(v/8,0,1)
out[:len(tt)]+=roll(tsw,vsw,TW,1)*0.5+roll(tss,vss,TS,2)*0.45
def add(sig,t,g=1.0):
    i=int(t*SR); out[i:i+len(sig)]+=sig[:max(0,len(out)-i)]*g
def env(n,a,r):
    e=np.ones(n); na=max(1,int(a*SR)); nr=max(1,int(r*SR)); e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
def clack(f=1800):
    t=np.arange(int(SR*0.25))/SR; return (np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*f*2.7*t))*np.exp(-t*30)
def whoosh(d=0.35):
    n=int(SR*d); x=rng.standard_normal(n); c=np.cumsum(x); y=np.convolve(x,np.ones(30)/30,'same'); return y/np.abs(y).max()*np.sin(np.linspace(0,np.pi,n))**2
def boom():
    t=np.arange(int(SR*1.3))/SR; x=np.sin(2*np.pi*(55+70*np.exp(-t*7))*t)*np.exp(-t*3); return x/np.abs(x).max()
def chime(f):
    t=np.arange(int(SR*2.0))/SR; return sum(np.sin(2*np.pi*f*m*t)*np.exp(-t*(2+m)) for m in (1,2,3,4.2))/3
# drone de fundo
drone=(np.sin(2*np.pi*55*tt)*0.5+np.sin(2*np.pi*110.5*tt)*0.2)*env(len(tt),0.8,1.0); out[:len(tt)]+=drone*0.12
add(clack(2200),0.12,0.5); add(clack(1700),0.16,0.4)
for c in (2.3,4.6,6.4,8.2,10.6): add(whoosh(0.35),c-0.15,0.25)
add(boom(),FW,0.7); add(chime(988),FW,0.45); add(clack(1500),FW,0.5)
add(clack(1300),FS,0.4); add(chime(660),FS,0.22)
out=out[:int(SR*TOTAL)]; out=out/np.abs(out).max()*0.9
w=wave.open(sys.argv[1],'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close(); print('ok',FW,FS)
