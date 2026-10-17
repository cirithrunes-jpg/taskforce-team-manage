const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const dialogCode=source.slice(source.indexOf('function installDialogSafety(){'),source.indexOf('installDialogSafety();'))+'installDialogSafety();';

test('old single-element selector reproduces the initialization failure',()=>{
  assert.throws(()=>vm.runInNewContext(dialogCode.replace('$$("dialog").forEach','$("dialog").forEach'),{
    $:()=>({}),document:{addEventListener(){}}
  }),/forEach/);
});
test('dialog safety initializes every dialog and supports Escape, buttons and backdrop',()=>{
  const dialogs=[0,1,2].map(()=>({handlers:{},addEventListener(name,fn){this.handlers[name]=fn},close(value){this.closed=value}}));
  let click;
  vm.runInNewContext(dialogCode,{$$:()=>dialogs,document:{addEventListener(name,fn){click=fn}}});
  dialogs.forEach(d=>{d.handlers.cancel({preventDefault(){}});assert.equal(d.closed,'cancel')});
  const closeButton={closest:()=>dialogs[0]};
  click({target:{closest:()=>closeButton},preventDefault(){},stopPropagation(){}});
  assert.equal(dialogs[0].closed,'cancel');
  dialogs[1].closest=selector=>selector==='dialog'?dialogs[1]:null;
  click({target:dialogs[1]});assert.equal(dialogs[1].closed,'cancel');
});
test('News loads both authenticated feeds and renders available Radar items',async()=>{
  const elements=new Map(['#newsDate','#teamNewsList','#platformNewsList'].map(id=>[id,{}]));
  const requests=[];
  const context={membership:{team_id:'team-test',role:'operator'},teamNews:[],platformNews:[],
    $:selector=>elements.get(selector),$$:()=>[],esc:v=>String(v??'').replaceAll('<','&lt;'),newsTimeLeft:()=> 'Disponível',
    Date,console,encodeURIComponent,
    authRest:async request=>{
      requests.push(request);
      return request.startsWith('team_news_posts')?[]:[{id:'news-test',category:'seguranca',source_name:'Fonte institucional',title:'Notícia disponível',summary:'Resumo de teste'}];
    }
  };
  vm.runInNewContext(source.slice(source.indexOf('function renderNews(){'),source.indexOf('async function deleteTeamNews(')),context);
  await context.loadNewsData();
  assert.equal(requests.length,2);assert.ok(requests[0].includes('team_id=eq.team-test'));
  assert.match(elements.get('#platformNewsList').innerHTML,/Notícia disponível/);
  assert.match(elements.get('#teamNewsList').innerHTML,/Nenhuma notícia da equipe/);
});
test('published HTML requests the corrected app with a fresh cache version',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html,/js\/app\.js\?v=20261017-newsfix1/);
  assert.doesNotMatch(source,/(?<!\$)\$\("dialog"\)\.forEach/);
});
