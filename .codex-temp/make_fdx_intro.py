from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math, subprocess, json

ROOT = r"E:\EAUT\Denso Hackathon\fdx-demo\Video"
IMG = os.path.join(ROOT, "input", "img")
VID = os.path.join(ROOT, "input", "video", "2026-10-08 02-56-16.mkv")
OUT = os.path.join(ROOT, "output")
WORK = os.path.join(OUT, "intro_work")
os.makedirs(WORK, exist_ok=True)
W,H=1920,1080
BG=(8,13,22); PANEL=(17,26,41); PANEL2=(22,34,52); WHITE=(242,246,252)
MUTED=(160,176,195); CYAN=(48,205,225); AMBER=(255,180,68); RED=(233,43,77); GREEN=(51,208,151)
FONT=r"C:\Windows\Fonts\arial.ttf"; BOLD=r"C:\Windows\Fonts\arialbd.ttf"
def f(size,b=False): return ImageFont.truetype(BOLD if b else FONT,size)
def rr(d,box,r,fill,outline=None,width=1): d.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)
def text(d,xy,s,size=34,fill=WHITE,b=False,anchor=None): d.text(xy,s,font=f(size,b),fill=fill,anchor=anchor)
def base(kicker,progress):
 im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
 d.rounded_rectangle((48,38,1872,1042),radius=28,fill=(10,16,27),outline=(39,54,74),width=2)
 d.rounded_rectangle((48,38,48+int(1824*progress),46),radius=4,fill=CYAN)
 text(d,(104,82),"FDX  /  DIGITAL TWIN",24,MUTED,True)
 text(d,(1816,82),kicker.upper(),21,CYAN,True,anchor="ra")
 return im,d
def save(im,n): im.save(os.path.join(WORK,n),quality=94)

# 0-5: title card with vector factory-route motif
im,d=base("DENSO HACKATHON",.125)
text(d,(130,160),"DENSO HACKATHON",29,AMBER,True)
text(d,(130,245),"FDX Team",104,WHITE,True)
d.line((130,385,1780,385),fill=(46,67,91),width=2)
text(d,(130,430),"Data Ultilization",47,CYAN,True)
text(d,(130,496),"Nhóm D2",32,AMBER,True)
text(d,(130,548),"Simulate & Forecast Logistics,",48,WHITE,True)
text(d,(130,610),"Recommend Actions",48,WHITE,True)
for x,y,label,col in [(165,824,"KHO",CYAN),(600,824,"VẬN CHUYỂN",AMBER),(1070,824,"SẢN XUẤT",RED),(1580,824,"THÀNH PHẨM",GREEN)]:
 rr(d,(x-95,y-46,x+95,y+38),18,PANEL2,col,3); text(d,(x,y-3),label,21,WHITE,True,anchor="mm")
for a,b in [(260,505),(695,975),(1175,1480)]:
 d.line((a,824,b,824),fill=CYAN,width=5); d.polygon([(b,824),(b-18,814),(b-18,834)],fill=CYAN)
save(im,"01_title.png")

# 5-10: statement / challenge card
im,d=base("BÀI TOÁN",.25)
text(d,(130,170),"LOGISTICS SẢN XUẤT",25,AMBER,True)
text(d,(130,270),"Mỗi thay đổi trong kế hoạch",65,WHITE,True)
text(d,(130,350),"đều tác động đến nguồn lực.",65,WHITE,True)
text(d,(130,470),"Năng lực vận chuyển có theo kịp?",37,MUTED)
text(d,(130,530),"Công đoạn nào trở thành điểm nghẽn?",37,MUTED)
text(d,(130,590),"Đối sách nào nên thử trước?",37,MUTED)
for i,(num,title,desc,col) in enumerate([(1,"PREDICT","Dự báo năng lực logistics",CYAN),(2,"DETECT","Xác định bottleneck",AMBER),(3,"SIMULATE","Mô phỏng What-if",GREEN)]):
 x=190+i*560; rr(d,(x,735,x+460,930),24,PANEL,col,3); rr(d,(x+28,765,x+94,831),30,col); text(d,(x+61,798),str(num),27,BG,True,anchor="mm"); text(d,(x+122,770),title,27,col,True); text(d,(x+28,860),desc,26,WHITE)
save(im,"02_problem.png")

# 10-16: three-step workflow infographic
im,d=base("BA NĂNG LỰC",.4)
text(d,(130,155),"TỪ DỮ LIỆU ĐẾN ĐỐI SÁCH",27,AMBER,True)
cards=[("01","PREDICT","Dự báo năng lực","logistics",CYAN),("02","DETECT","Xác định","bottleneck",AMBER),("03","SIMULATE","Mô phỏng","What-if",GREEN)]
for i,(no,title,a,b,col) in enumerate(cards):
 x=130+i*590; rr(d,(x,300,x+500,755),26,PANEL,col,3)
 text(d,(x+40,345),no,26,col,True); text(d,(x+40,415),title,43,WHITE,True)
 # compact vector icon
 if i==0:
  d.line((x+65,650,x+160,570,x+245,610,x+350,480,x+430,510),fill=col,width=8)
  for px,py in [(x+65,650),(x+160,570),(x+245,610),(x+350,480),(x+430,510)]: d.ellipse((px-9,py-9,px+9,py+9),fill=WHITE)
 elif i==1:
  d.line((x+80,610,x+185,610,x+215,540,x+290,680,x+330,590,x+430,590),fill=col,width=9,joint="curve")
  d.ellipse((x+277,666,x+303,692),fill=AMBER)
 else:
  rr(d,(x+75,545,x+195,650),15,(23,45,58),col,4); rr(d,(x+285,545,x+405,650),15,(23,45,58),col,4)
  text(d,(x+135,598),"A",34,WHITE,True,anchor="mm"); text(d,(x+345,598),"B",34,WHITE,True,anchor="mm")
  d.line((x+205,598,x+275,598),fill=col,width=6); d.polygon([(x+275,598),(x+258,588),(x+258,608)],fill=col)
 text(d,(x+40,700),a+" "+b,24,MUTED)
 if i<2:
  cx=x+535; d.line((cx,520,cx+45,520),fill=CYAN,width=5); d.polygon([(cx+45,520),(cx+28,510),(cx+28,530)],fill=CYAN)
text(d,(130,850),"MÔ PHỎNG & DỰ BÁO LOGISTICS  ·  ĐỀ XUẤT ĐỐI SÁCH TỐI ƯU",31,WHITE,True)
save(im,"03_capabilities.png")

# 16-22: full dashboard screenshot with clean info rail
shot=Image.open(os.path.join(IMG,"Screenshot 2026-10-08 025114.png")).convert("RGB")
im,d=base("GIAO DIỆN FDX",.55)
text(d,(100,126),"FDX DIGITAL TWIN",30,WHITE,True)
# screenshot is 1920x1080; fit inside a framed viewport
shot.thumbnail((1690,780),Image.Resampling.LANCZOS)
sx=(W-shot.width)//2; sy=205+(780-shot.height)//2
rr(d,(sx-8,sy-8,sx+shot.width+8,sy+shot.height+8),16,(14,22,34),(58,79,104),2); im.paste(shot,(sx,sy))
rr(d,(120,930,1800,992),18,(20,32,49),(49,205,225),2)
text(d,(960,961),"MÔ PHỎNG  ·  CẢNH BÁO  ·  SO SÁNH WHAT-IF",27,CYAN,True,anchor="mm")
save(im,"04_dashboard.png")

# 27-35: three callout bands with cropped screenshots as proof
im,d=base("TỔNG QUAN",.8)
text(d,(115,132),"MỘT GIAO DIỆN — BA GÓC NHÌN",37,WHITE,True)
# dashboard as contextual image on the left
shot=Image.open(os.path.join(IMG,"Screenshot 2026-10-08 025114.png")).convert("RGB")
shot=shot.resize((1040,585),Image.Resampling.LANCZOS)
rr(d,(90,245,1158,850),22,(12,18,28),(50,67,91),3); im.paste(shot,(99,253))
labels=[("01","VẬN HÀNH 3D","Quan sát luồng logistics",CYAN),("02","BOTTLENECK","Theo dõi cảnh báo",AMBER),("03","WHAT-IF","So sánh phương án",GREEN)]
for j,(num,title,desc,col) in enumerate(labels):
 y=255+j*205; rr(d,(1210,y,1800,y+160),22,PANEL,col,3); text(d,(1245,y+27),num,23,col,True); text(d,(1320,y+25),title,28,WHITE,True); text(d,(1245,y+91),desc,25,MUTED)
text(d,(110,920),"Dữ liệu trên màn hình là mô phỏng demo.",24,MUTED)
save(im,"06_three_panels.png")

# 35-40: transition card into detailed feature tour
im,d=base("TIẾP THEO",1.0)
text(d,(130,215),"TỪ QUAN SÁT",28,CYAN,True)
text(d,(130,285),"ĐẾN HÀNH ĐỘNG",73,WHITE,True)
text(d,(130,410),"Predict  →  Detect  →  Simulate",38,AMBER,True)
text(d,(130,520),"Khám phá các tính năng chính của FDX Digital Twin",30,MUTED)
for i,(x,label,col) in enumerate([(145,"DỰ BÁO",CYAN),(720,"PHÁT HIỆN",AMBER),(1295,"MÔ PHỎNG",GREEN)]):
 rr(d,(x,715,x+430,880),24,PANEL,col,3); text(d,(x+215,798),label,34,WHITE,True,anchor="mm")
save(im,"07_transition.png")

# Clip the existing 60-fps demo segment used between infographic scenes.
demo=os.path.join(WORK,"05_demo.mp4")
subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss","9","-i",VID,"-t","5","-vf","drawbox=x=0:y=0:w=iw:h=100:color=0x080D16@0.82:t=fill,drawtext=fontfile=C\\:/Windows/Fonts/arialbd.ttf:text='FDX DIGITAL TWIN  |  MO PHONG DANG CHAY':fontcolor=white:fontsize=30:x=70:y=27","-an","-r","60","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",demo],check=True)

# Animate slides to 60 fps, then join with short dissolves. Total duration: 40 s.
slides=[("01_title.png",5), ("02_problem.png",5), ("03_capabilities.png",6), ("04_dashboard.png",6), ("05_demo.mp4",5), ("06_three_panels.png",8), ("07_transition.png",5)]
clips=[]
for i,(name,duration) in enumerate(slides):
 dst=os.path.join(WORK,f"clip_{i+1:02d}.mp4")
 src=os.path.join(WORK,name)
 if name.endswith(".mp4"):
  cmd=["ffmpeg","-hide_banner","-loglevel","error","-y","-i",src,"-t",str(duration),"-vf","scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=60,setsar=1","-an","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",dst]
 else:
  # very slow 5% push-in provides subtle motion without sacrificing readability
  frames=int(duration*60)
  vf=f"zoompan=z='min(zoom+0.00016,1.045)':d={frames}:s=1920x1080:fps=60,format=yuv420p"
  cmd=["ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1","-framerate","60","-i",src,"-vf",vf,"-t",str(duration),"-an","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",dst]
 subprocess.run(cmd,check=True); clips.append(dst)

# Join the seven precisely timed scenes, preserving the 40-second narration cues.
concat_list=os.path.join(WORK,"concat.txt")
with open(concat_list,"w",encoding="utf-8") as fp:
 for c in clips: fp.write("file '"+c.replace("\\","/")+"'\n")
final=os.path.join(OUT,"fdx_intro_40s.mp4")
subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",concat_list,"-t","40","-r","60","-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p","-movflags","+faststart",final],check=True)

# SRT carries the planned Vietnamese narration timings for later AI voice work.
srt="""1\n00:00:00,150 --> 00:00:02,750\nFDX Team tham gia cuộc thi Denso Hackathon.\n\n2\n00:00:03,150 --> 00:00:05,750\nVới bài toán mô phỏng, dự báo logistics và đề xuất đối sách.\n\n3\n00:00:06,150 --> 00:00:09,750\nBa năng lực cốt lõi: dự báo năng lực, xác định điểm nghẽn và mô phỏng phương án.\n\n4\n00:00:10,150 --> 00:00:15,750\nKhi kế hoạch sản xuất thay đổi, liệu vận chuyển và đóng gói có đáp ứng kịp?\n\n5\n00:00:16,150 --> 00:00:21,750\nFDX Digital Twin mô phỏng luồng logistics, giúp người dùng quan sát vận hành và thử các phương án.\n\n6\n00:00:22,150 --> 00:00:26,750\nTừ kho linh kiện, qua vận chuyển, đến dây chuyền, đóng gói và kho thành phẩm.\n\n7\n00:00:27,150 --> 00:00:34,750\nTrên cùng giao diện, người dùng theo dõi năng lực logistics, nhận diện điểm nghẽn và so sánh các kịch bản trước khi áp dụng vào mô phỏng.\n\n8\n00:00:35,150 --> 00:00:39,750\nQua đó, hỗ trợ lựa chọn đối sách phù hợp. Hãy cùng khám phá các tính năng chính.\n"""
with open(os.path.join(OUT,"fdx_intro_narration.srt"),"w",encoding="utf-8-sig",newline="\n") as fp: fp.write(srt)
md="""# FDX Intro — lời thoại (40 giây)\n\n| Thời gian | Lời thoại |\n|---|---|\n| 00:00–00:03 | FDX Team tham gia cuộc thi Denso Hackathon. |\n| 00:03–00:06 | Với bài toán mô phỏng, dự báo logistics và đề xuất đối sách. |\n| 00:06–00:10 | Ba năng lực cốt lõi: dự báo năng lực, xác định điểm nghẽn và mô phỏng phương án. |\n| 00:10–00:16 | Khi kế hoạch sản xuất thay đổi, liệu vận chuyển và đóng gói có đáp ứng kịp? |\n| 00:16–00:22 | FDX Digital Twin mô phỏng luồng logistics, giúp người dùng quan sát vận hành và thử các phương án. |\n| 00:22–00:27 | Từ kho linh kiện, qua vận chuyển, đến dây chuyền, đóng gói và kho thành phẩm. |\n| 00:27–00:35 | Trên cùng giao diện, người dùng theo dõi năng lực logistics, nhận diện điểm nghẽn và so sánh các kịch bản trước khi áp dụng vào mô phỏng. |\n| 00:35–00:40 | Qua đó, hỗ trợ lựa chọn đối sách phù hợp. Hãy cùng khám phá các tính năng chính. |\n\nVideo không có giọng đọc; SRT và bảng trên dùng để tạo/ghép giọng AI sau.\n"""
with open(os.path.join(OUT,"fdx_intro_narration.md"),"w",encoding="utf-8-sig",newline="\n") as fp: fp.write(md)
print(json.dumps({"video":final,"srt":os.path.join(OUT,"fdx_intro_narration.srt"),"script":os.path.join(OUT,"fdx_intro_narration.md"),"slides":len(slides),"duration":40},ensure_ascii=False))
