"""Refresh the public Leipzig snapshot. Never retain raw source or contact fields."""
import json,re,urllib.request,urllib.parse,datetime,pathlib,sys
query=urllib.parse.urlencode({'from':'01/01/2026','to':'12/31/2026','type':'week','campus':'B1-1501 Co-working Space'})
url='https://uiischedule.ueh.edu.vn/?'+query
html=pathlib.Path(sys.argv[1]).read_text() if len(sys.argv)>1 else urllib.request.urlopen(url,timeout=90).read().decode()
m=re.search(r'const scheduleGroup = (.*);',html)
if not m: raise RuntimeError('Source format changed; snapshot has not been overwritten')
weeks=json.loads(m.group(1)); unique={}; excluded=0
for w in weeks:
 for r in w['roomSchedules']:
  if r['room']['id']!=1034:continue
  for day in r['schedules']:
   for key in ['morningSchedules','afternoonSchedules','nightSchedules']:
    for e in day[key]:
     if not e['from'].startswith('2026-'):continue
     form=e.get('approveForm') or {}; color=(form.get('approver') or {}).get('scheduleColor','').lower()
     if color not in ['#3d3d3d','#000000','#000','black']:excluded+=1;continue
     title=e['title'].strip(); domain=(form.get('email') or '').split('@')[-1].lower(); group=None;basis='Tên xuất hiện trong tiêu đề';kind='Dự án / tổ chức'
     for pattern,name in [(r'affic','Affic AI'),(r'edtronaut','Edtronaut'),(r'onto','ONTO'),(r'\bsga\b','SGA'),(r'\bmsc\b','MSC'),(r'voltria','Voltria'),(r'yesco','YESCo'),(r'pitch me','Pitch Me'),(r'plumiplay','Plumiplay'),(r's2m|biowraps','S2M / BioWraps')]:
      if re.search(pattern,title,re.I):group=name;break
     if not group and re.search(r'\bUII\b|\bUSI\b|Viện Đổi mới|Co-working Space Development',title,re.I):group='UII / USI';kind='Nội bộ / chương trình';basis='Tiêu đề lịch'
     if not group and domain in ['onto.vn','edtronaut.ai','afficai.com']:group={'onto.vn':'ONTO','edtronaut.ai':'Edtronaut','afficai.com':'Affic AI'}[domain];basis='Tên miền email người đặt (suy luận)'
     if not group:group='Chưa xác định';kind='Cần kiểm tra';basis='Chưa đủ thông tin để gán startup'
     start=datetime.datetime.fromisoformat(e['from']);end=datetime.datetime.fromisoformat(e['to']); minutes=(end-start).total_seconds()/60
     if minutes<0:raise RuntimeError('Invalid duration')
     unique[e['id']]={'id':str(e['id']),'from':e['from'],'to':e['to'],'title':title,'host':e.get('scheduleHost') or '', 'booker':form.get('requesterName') or '', 'description':re.sub('<[^>]+>',' ',e.get('description') or '').strip(),'group':group,'kind':kind,'basis':basis,'minutes':minutes}
data={'source':url,'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'coverageFrom':'2026-01-01','coverageTo':'2026-12-31','weeksFetched':len(weeks),'excludedOtherColors':excluded,'records':sorted(unique.values(),key=lambda e:e['from'])}
pathlib.Path('ui/data.json').write_text(json.dumps(data,ensure_ascii=False))
print(json.dumps({'records':len(unique),'hours':sum(e['minutes'] for e in unique.values())/60,'groups':sorted({e['group'] for e in unique.values()}),'weeks':len(weeks)},ensure_ascii=False))
