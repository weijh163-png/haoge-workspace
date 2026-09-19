from html.parser import HTMLParser
from pathlib import Path
from collections import Counter

class Audit(HTMLParser):
    void = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self):
        super().__init__()
        self.stack=[]; self.errors=[]; self.ids=[]; self.modules=[]; self.remote=[]
    def handle_starttag(self, tag, attrs):
        data=dict(attrs)
        if data.get('id'): self.ids.append(data['id'])
        if tag=='section' and 'module' in data.get('class','').split(): self.modules.append(data['id'])
        if tag in ('script','link','img') and any(data.get(k,'').startswith(('http:','https:')) for k in ('src','href')): self.remote.append(data)
        if tag not in self.void: self.stack.append((tag,self.getpos()[0]))
    def handle_startendtag(self,tag,attrs):
        pass
    def handle_endtag(self,tag):
        if tag in self.void:return
        if not self.stack or self.stack[-1][0]!=tag:
            self.errors.append((self.getpos()[0],tag,self.stack[-3:]))
            if any(t==tag for t,_ in self.stack):
                while self.stack and self.stack[-1][0]!=tag:self.stack.pop()
            else:return
        self.stack.pop()

text=Path('浩哥工作台.html').read_text(encoding='utf-8')
a=Audit();a.feed(text)
assert not a.errors, a.errors
assert not a.stack,a.stack
assert not [k for k,v in Counter(a.ids).items() if v>1]
assert set(a.modules)=={'dashboard','workflow','assistant','reports','projects','flowchart','extra'},a.modules
assert not a.remote,a.remote
print('PASS HTML tags balanced, unique IDs, seven modules preserved, no remote runtime assets')
