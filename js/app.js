const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
const store={get(k,f){try{return JSON.parse(localStorage.getItem("tf_"+k))??f}catch{return f}},set(k,v){localStorage.setItem("tf_"+k,JSON.stringify(v))}};
let team=store.get("team",{}),operators=store.get("operators",[]),games=store.get("games",[]),fields=store.get("fields",[]);
let lang=store.get("lang","pt"),theme=store.get("theme","dark");

const titles={
command:["command","commandSubtitle"],operators:["operators","operatorsSubtitle"],calendar:["calendar","calendarSubtitle"],
fields:["fields","fieldsSubtitle"],finance:["finance","financeSubtitle"],documents:["documents","documentsSubtitle"],
contacts:["contacts","contactsSubtitle"],settings:["settings","settingsSubtitle"]
};

function t(key){return (window.I18N[lang]&&window.I18N[lang][key])||window.I18N.pt[key]||key}
function esc(v){return String(v||"").replace(/[&<>"']/g,function(m){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]})}
function translate(){
  document.documentElement.lang=lang==="pt"?"pt-BR":lang;
  $$("[data-i18n]").forEach(function(el){const v=t(el.dataset.i18n);if(v)el.textContent=v});
  $("#languageSelect").value=lang;
  const active=$(".nav-item.active")?.dataset.view||"command";
  updateHeader(active);
  renderAll();
}
function updateHeader(view){
  const pair=titles[view]||titles.command;
  $("#pageTitle").textContent=t(pair[0]);
  $("#pageSubtitle").textContent=t(pair[1]);
}
function showView(view){
  $$(".view").forEach(function(v){v.classList.remove("active")});
  $$(".nav-item").forEach(function(v){v.classList.remove("active")});
  $("#view-"+view)?.classList.add("active");
  document.querySelector('.nav-item[data-view="'+view+'"]')?.classList.add("active");
  updateHeader(view);
  $("#sidebar").classList.remove("open");
}
$$(".nav-item").forEach(function(b){b.onclick=function(){showView(b.dataset.view)}});
$$("[data-go]").forEach(function(b){b.onclick=function(){showView(b.dataset.go)}});
$("#menuBtn").onclick=$("#railToggle").onclick=function(){$("#sidebar").classList.toggle("open")};

function setTheme(v){
  theme=v;store.set("theme",v);document.documentElement.dataset.theme=v;
  $$(".theme-btn").forEach(function(b){b.classList.toggle("active",b.dataset.theme===v)});
}
$$(".theme-btn").forEach(function(b){b.onclick=function(){setTheme(b.dataset.theme)}});
setTheme(theme);
$("#languageSelect").onchange=function(e){lang=e.target.value;store.set("lang",lang);translate()};

function openDialog(id){$(id).showModal()}
["#openTeamModal","#openTeamModal2","#openTeamModal3"].forEach(function(id){$(id).onclick=function(){fillTeamForm();openDialog("#teamModal")}});
$("#addOperator").onclick=$("#quickOperator").onclick=function(){openDialog("#operatorModal")};
$("#addGame").onclick=$("#quickGame").onclick=function(){openDialog("#gameModal")};
$("#addField").onclick=$("#quickField").onclick=function(){openDialog("#fieldModal")};
$("#viewTerm").onclick=function(){openDialog("#termModal")};

function formObject(form){return Object.fromEntries(new FormData(form).entries())}
function initials(n){return String(n||"").trim().split(/\s+/).slice(0,2).map(function(x){return x[0]||""}).join("").toUpperCase()||"OP"}
function formatDate(v){if(!v)return"—";const p=v.split("-");return p[2]+"/"+p[1]+"/"+p[0]}
function sortedGames(){return [...games].sort(function(a,b){return(a.date||"").localeCompare(b.date||"")})}

$("#operatorForm").addEventListener("submit",function(e){
  e.preventDefault();
  const o=formObject(e.target);
  o.id=(crypto.randomUUID?crypto.randomUUID():Date.now().toString());
  operators.push(o);store.set("operators",operators);e.target.reset();$("#operatorModal").close();renderAll();
});
$("#gameForm").addEventListener("submit",function(e){
  e.preventDefault();
  const g=formObject(e.target);g.id=Date.now().toString();
  games.push(g);store.set("games",games);e.target.reset();$("#gameModal").close();renderAll();
});
$("#fieldForm").addEventListener("submit",function(e){
  e.preventDefault();
  const f=formObject(e.target);f.id=Date.now().toString();
  fields.push(f);store.set("fields",fields);e.target.reset();$("#fieldModal").close();renderAll();
});
$("#teamForm").addEventListener("submit",function(e){
  e.preventDefault();team=formObject(e.target);store.set("team",team);$("#teamModal").close();renderAll();
});

function fillTeamForm(){
  Object.entries(team).forEach(function(entry){
    const el=$("#teamForm").elements[entry[0]];
    if(el)el.value=entry[1]||"";
  });
}
function renderTeam(){
  const name=team.name||t("registerTeam");
  $("#teamNameTop").textContent=team.acronym||team.name||"TASKFORCE";
  $("#teamNameSide").textContent=name;
  $("#heroTeamName").textContent=name;
  $("#teamCitySide").textContent=team.city||t("registerTeam");
}
function renderOperators(){
  const root=$("#operatorsList");
  $("#statOperators").textContent=operators.length;
  if(!operators.length){root.innerHTML='<div class="empty">'+t("newOperator")+' — 0</div>';return}
  root.innerHTML=operators.map(function(o){
    return '<article class="card-row"><div class="card-main"><div class="avatar">'+esc(initials(o.callsign||o.name))+'</div><div><button class="link-name" data-operator="'+esc(o.id)+'">'+esc(o.name||"Operador")+'</button><div class="meta">'+esc(o.callsign||"")+(o.callsign?" • ":"")+esc(o.role||"")+(o.blood?" • "+esc(o.blood):"")+'</div></div></div><span class="badge">ATIVO</span></article>';
  }).join("");
  $$("[data-operator]").forEach(function(b){b.onclick=function(){showOperator(b.dataset.operator)}});
}
function showOperator(id){
  const o=operators.find(function(x){return x.id===id});if(!o)return;
  $("#detailsTitle").textContent=o.name||"Operador";
  const normal=[["Codinome",o.callsign],["Função",o.role],["Tipo sanguíneo",o.blood],["Telefone",o.phone],["E-mail",o.email],["Endereço",o.address]];
  const sensitive=[["Contato de emergência",o.emergency],["Telefone de emergência",o.emergencyPhone],["Alergia a medicamentos",o.allergy],["Informações de saúde",o.health]];
  let html='<div class="detail-grid">';
  normal.forEach(function(x){html+='<div class="detail-item"><small>'+esc(x[0])+'</small>'+esc(x[1]||"—")+'</div>'});
  sensitive.forEach(function(x){html+='<div class="detail-item sensitive"><small>'+esc(x[0])+'</small>'+esc(x[1]||"—")+'</div>'});
  html+='</div><div class="privacy-box">'+t("healthPrivacy")+'</div>';
  $("#operatorDetails").innerHTML=html;
  openDialog("#operatorDetailsModal");
}
function renderGames(){
  const list=sortedGames(),root=$("#gamesList"),dash=$("#dashboardGames");
  if(!list.length){
    root.innerHTML='<div class="empty">'+t("noGames")+'</div>';
    dash.className="empty";dash.textContent=t("noGames");
    $("#statNextGame").textContent="—";$("#statNextGamePlace").textContent=t("noGames");return;
  }
  const html=list.map(function(g){
    return '<article class="card-row"><div><h3>'+esc(g.name)+'</h3><div class="meta">'+formatDate(g.date)+(g.time?" • "+esc(g.time):"")+(g.place?" • "+esc(g.place):"")+'</div></div><span class="badge">'+formatDate(g.date)+'</span></article>';
  }).join("");
  root.innerHTML=html;dash.className="cards-list";dash.innerHTML=html;
  $("#statNextGame").textContent=formatDate(list[0].date);
  $("#statNextGamePlace").textContent=list[0].place||list[0].name||"—";
}
function renderFields(){
  const root=$("#fieldsList");
  if(!fields.length){root.innerHTML='<div class="empty">'+t("newField")+' — 0</div>';return}
  root.innerHTML=fields.map(function(f){
    const gps=f.gps?'<a class="ghost small" href="'+esc(f.gps)+'" target="_blank" rel="noopener">GPS</a>':"";
    return '<article class="card-row"><div><h3>'+esc(f.name)+'</h3><div class="meta">'+esc(f.address||"")+(f.lat&&f.lng?" • GPS "+esc(f.lat)+", "+esc(f.lng):"")+'</div></div>'+gps+'</article>';
  }).join("");
}
function renderAll(){renderTeam();renderOperators();renderGames();renderFields()}
translate();