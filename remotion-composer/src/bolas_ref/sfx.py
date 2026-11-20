# Efeitos do "Bolas (referência)": duas corridas (plano de frente e plano lateral). Barra subindo (clique metálico),
# rolamento de cada bola pela velocidade real, batida na chegada. Mesma física do BolasRef.tsx.
import numpy as np, wave, sys, math
SR=44100; TOTAL=12.8; L,H,A,G=24,5.0,1.1,9.8; SHOT2=6.45; REL=[0.85,SHOT2+0.55]; SPEED=1.12
rng=np.random.default_rng(9); out=np.zeros(int(SR*TOTAL)+SR)
def sim(yf):
    N=3000;t=0;v0=0.4;y0=yf(0);ts=[0];vs=[v0]
    for i in range(1,N+1):
        s0=(i-1)/N;s1=i/N;ds=math.hypot(L/N,yf(s1)-yf(s0));v=math.sqrt(v0*v0+2*G*(y0-yf((s0+s1)/2)))*0.96;t+=ds/v;ts.append(t);vs.append(v)
    return t,np.array(ts),np.array(vs)
TS,tss,vss=sim(lambda s:H*(1-s)); TW,tsw,vsw=sim(lambda s:H*(1-s)-A*math.sin(3*math.pi*s)**2)
tt=np.arange(int(SR*TOTAL))/SR
def roll(ts,vs,T,rel,end,seed,gain):
    x=np.clip((tt-rel)/SPEED,0,None); v=np.interp(x,ts,vs)*((x>0)&(x<T))*(tt<end)
    n=np.random.default_rng(seed).standard_normal(len(tt)); y=np.zeros_like(n); acc=0.0; a=np.clip(0.03+v/50,0.03,0.3)
    for i in range(len(n)): acc+=a[i]*(n[i]-acc); y[i]=acc
    return y/np.abs(y).max()*np.clip(v/7,0,1)*gain
def add(sig,t,g=1.0):
    i=int(t*SR); out[i:i+len(sig)]+=sig[:max(0,len(out)-i)]*g
def clink(f):
    t=np.arange(int(SR*0.5))/SR; return (np.sin(2*np.pi*f*t)+0.6*np.sin(2*np.pi*f*2.76*t)+0.3*np.sin(2*np.pi*f*5.4*t))*np.exp(-t*12)
def thud():
    t=np.arange(int(SR*0.4))/SR; return np.sin(2*np.pi*(90+80*np.exp(-t*30))*t)*np.exp(-t*14)
# corrida 1 (plano de frente: as bolas se afastam, som vai diminuindo)
fade1=np.clip(1-(tt-REL[0])/5.5,0.15,1)
out[:len(tt)]+=(roll(tsw,vsw,TW,REL[0],SHOT2,1,0.55)+roll(tss,vss,TS,REL[0],SHOT2,2,0.5))*fade1
# corrida 2 (lateral)
out[:len(tt)]+=roll(tsw,vsw,TW,REL[1],TOTAL,3,0.5)+roll(tss,vss,TS,REL[1],TOTAL,4,0.45)
for r in REL: add(clink(1900),r-0.35,0.35); add(thud(),r+0.05,0.4)
add(clink(1500),REL[1]+TW*SPEED,0.55); add(thud(),REL[1]+TW*SPEED,0.6)
add(clink(1250),REL[1]+TS*SPEED,0.4); add(thud(),REL[1]+TS*SPEED,0.45)
out=out[:int(SR*TOTAL)]; out=out/np.abs(out).max()*0.9
w=wave.open(sys.argv[1],'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close(); print('ok', REL[1]+TW*SPEED, REL[1]+TS*SPEED)
