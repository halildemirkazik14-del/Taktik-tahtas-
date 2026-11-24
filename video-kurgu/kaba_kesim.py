import re, subprocess, sys, json
src, out, drop = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
PAD, DUR = 0.10, 86.737
log = subprocess.run(["ffmpeg","-hide_banner","-i",src,"-af","silencedetect=noise=-40dB:d=0.25","-f","null","-"],capture_output=True,text=True).stderr
st=[float(x) for x in re.findall(r"silence_start: ([-\d.e]+)",log)]; en=[float(x) for x in re.findall(r"silence_end: ([-\d.e]+)",log)]
st.sort(); en.sort()
if en and (not st or en[0]<st[0]): st=[0.0]+st
if len(st)>len(en): en.append(DUR)
sil=list(zip(st,en))
# konuşma aralıkları
keep=[]; cur=0.0
for s,e in sil:
    if s>0.05 and s+PAD>cur: keep.append((max(0,cur), min(DUR,s+PAD)))
    cur=max(0,e-PAD)
if cur<DUR-0.05: keep.append((cur,DUR))
# atılacak aralıkları çıkar
res=[]
for a,b in keep:
    segs=[(a,b)]
    for da,db in drop:
        nxt=[]
        for x,y in segs:
            if db<=x or da>=y: nxt.append((x,y))
            else:
                if x<da: nxt.append((x,da))
                if db<y: nxt.append((db,y))
        segs=nxt
    res+= [s for s in segs if s[1]-s[0]>0.12]
expr="+".join(f"between(t,{a:.3f},{b:.3f})" for a,b in res)
subprocess.run(["ffmpeg","-loglevel","error","-y","-i",src,"-vf",f"select='{expr}',setpts=N/FRAME_RATE/TB","-af",f"aselect='{expr}',asetpts=N/SR/TB","-c:v","libx264","-crf","20","-c:a","aac","-b:a","192k",out],check=True)
json.dump(res,open(out+".json","w"))
print(len(res),"parça, toplam",round(sum(b-a for a,b in res),2),"sn")
