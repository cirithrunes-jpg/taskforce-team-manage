const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
const pref={get(k,f){try{return JSON.parse(localStorage.getItem("tf_pref_"+k))??f}catch{return f}},set(k,v){localStorage.setItem("tf_pref_"+k,JSON.stringify(v))}};
const db=window.TASKFORCE_DB;
let team={},operators=[],games=[],fields=[],membership=null,currentProfile=null;
let lang=pref.get("lang","pt"),theme=pref.get("theme","dark");

const titles={
command:["command","commandSubtitle"],operators:["operators","operatorsSubtitle"],calendar:["calendar","calendarSubtitle"],
fields:["fields","fieldsSubtitle"],finance:["finance","financeSubtitle"],documents:["documents","documentsSubtitle"],
contacts:["contacts","contactsSubtitle"],settings:["settings","settingsSubtitle"]
};

function t(key){return (window.I18N[lang]&&window.I18N[lang][key])||window.I18N.pt[key]||key}
function esc(v){return String(v||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function translate(){
  document.documentElement.lang=lang==="pt"?"pt-BR":lang;
  $$("[data-i18n]").forEach(el=>{const v=t(el.dataset.i18n);if(v)el.textContent=v});
  $("#languageSelect").value=lang;
  updateHeader($(".nav-item.active")?.dataset.view||"command");
  renderAll();
}
function updateHeader(view){
  const pair=titles[view]||titles.command;
  $("#pageTitle").textContent=t(pair[0]);
  $("#pageSubtitle").textContent=t(pair[1]);
}
function showView(view){
  $$(".view").forEach(v=>v.classList.remove("active"));
  $$(".nav-item").forEach(v=>v.classList.remove("active"));
  $("#view-"+view)?.classList.add("active");
  document.querySelector('.nav-item[data-view="'+view+'"]')?.classList.add("active");
  updateHeader(view);
  $("#sidebar").classList.remove("open");
}
$$(".nav-item").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
$("#menuBtn").onclick=$("#railToggle").onclick=()=>$("#sidebar").classList.toggle("open");

function setTheme(v){
  theme=v;pref.set("theme",v);document.documentElement.dataset.theme=v;
  $$(".theme-btn").forEach(b=>b.classList.toggle("active",b.dataset.theme===v));
}
$$(".theme-btn").forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
setTheme(theme);
$("#languageSelect").onchange=e=>{lang=e.target.value;pref.set("lang",lang);translate()};

function openDialog(id){$(id)?.showModal()}
["#openTeamModal","#openTeamModal2","#openTeamModal3"].forEach(id=>$(id).onclick=()=>{fillTeamForm();openDialog("#teamModal")});
$("#viewTerm").onclick=()=>openDialog("#termModal");

function inviteOperator(){
  if(membership?.role!=="admin")return;
  showView("settings");
  setTimeout(()=>{
    const panel=$("#invitePanel");
    if(panel){panel.scrollIntoView({behavior:"smooth",block:"center"});$("#newInviteBtn")?.click()}
  },50);
}
$("#addOperator").onclick=$("#quickOperator").onclick=inviteOperator;
$("#addGame").onclick=$("#quickGame").onclick=()=>{if(membership?.role==="admin")openDialog("#gameModal")};
$("#addField").onclick=$("#quickField").onclick=()=>{if(membership?.role==="admin")openDialog("#fieldModal")};

function formObject(form){return Object.fromEntries(new FormData(form).entries())}
function initials(n){return String(n||"").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"OP"}
function formatDate(v){if(!v)return"—";const p=v.split("-");return p[2]+"/"+p[1]+"/"+p[0]}
function sortedGames(){return [...games].sort((a,b)=>(a.date||"").localeCompare(b.date||""))}
function assertAdmin(){if(membership?.role!=="admin")throw new Error("Apenas administradores podem realizar esta ação.")}

$("#gameForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    assertAdmin();
    const data=formObject(e.target);
    const {data:row,error}=await db.from("team_resources").insert({team_id:membership.team_id,kind:"game",data}).select("id,kind,data").single();
    if(error)throw error;
    games.push({id:row.id,...row.data});
    e.target.reset();$("#gameModal").close();renderAll();
  }catch(err){alert(err.message)}
});

$("#fieldForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    assertAdmin();
    const data=formObject(e.target);
    const {data:row,error}=await db.from("team_resources").insert({team_id:membership.team_id,kind:"field",data}).select("id,kind,data").single();
    if(error)throw error;
    fields.push({id:row.id,...row.data});
    e.target.reset();$("#fieldModal").close();renderAll();
  }catch(err){alert(err.message)}
});

$("#teamForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    assertAdmin();
    const form=formObject(e.target);
    const name=form.name.trim();
    const data={...form};delete data.name;
    const {error}=await db.from("teams").update({name,data}).eq("id",membership.team_id);
    if(error)throw error;
    team={name,...data};
    $("#teamModal").close();renderAll();
  }catch(err){alert(err.message)}
});

function fillTeamForm(){
  const form=$("#teamForm");
  Object.entries(team).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v||""});
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
  $("#statOperators").textContent=membership?.role==="admin"?operators.length:"—";
  if(!operators.length){root.innerHTML='<div class="empty">Nenhum operador cadastrado.</div>';return}
  root.innerHTML=operators.map(o=>{
    const sub=[o.callsign,o.role,o.blood].filter(Boolean).map(esc).join(" • ");
    return '<article class="card-row"><div class="card-main"><div class="avatar">'+esc(initials(o.callsign||o.name))+'</div><div><button class="link-name" data-operator="'+esc(o.user_id||o.id)+'">'+esc(o.name||"Operador")+'</button><div class="meta">'+sub+'</div></div></div><span class="badge">'+(o.member_role==="admin"?"ADM":"OPERADOR")+'</span></article>';
  }).join("");
  $$("[data-operator]").forEach(b=>b.onclick=()=>showOperator(b.dataset.operator));
}
function showOperator(id){
  const o=operators.find(x=>(x.user_id||x.id)===id);if(!o)return;
  $("#detailsTitle").textContent=o.name||"Operador";
  const normal=[["Codinome",o.callsign],["Função",o.role],["Tipo sanguíneo",o.blood],["Telefone",o.phone],["E-mail",o.email],["Endereço",o.address]];
  const sensitive=[["Contato de emergência",o.emergency],["Telefone de emergência",o.emergencyPhone],["Parentesco / relação",o.relationship],["Alergia a medicamentos",o.allergy],["Informações de saúde",o.health]];
  let html='<div class="detail-grid">';
  normal.forEach(x=>html+='<div class="detail-item"><small>'+esc(x[0])+'</small>'+esc(x[1]||"—")+'</div>');
  sensitive.forEach(x=>html+='<div class="detail-item sensitive"><small>'+esc(x[0])+'</small>'+esc(x[1]||"—")+'</div>');
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
  const html=list.map(g=>'<article class="card-row"><div><h3>'+esc(g.name)+'</h3><div class="meta">'+formatDate(g.date)+(g.time?" • "+esc(g.time):"")+(g.place?" • "+esc(g.place):"")+'</div></div><span class="badge">'+formatDate(g.date)+'</span></article>').join("");
  root.innerHTML=html;dash.className="cards-list";dash.innerHTML=html;
  $("#statNextGame").textContent=formatDate(list[0].date);
  $("#statNextGamePlace").textContent=list[0].place||list[0].name||"—";
}
function renderFields(){
  const root=$("#fieldsList");
  if(!fields.length){root.innerHTML='<div class="empty">Nenhum campo cadastrado.</div>';return}
  root.innerHTML=fields.map(f=>{
    const gps=f.gps?'<a class="ghost small" href="'+esc(f.gps)+'" target="_blank" rel="noopener">GPS</a>':"";
    return '<article class="card-row"><div><h3>'+esc(f.name)+'</h3><div class="meta">'+esc(f.address||"")+(f.lat&&f.lng?" • GPS "+esc(f.lat)+", "+esc(f.lng):"")+'</div></div>'+gps+'</article>';
  }).join("");
}
function renderAll(){renderTeam();renderOperators();renderGames();renderFields()}

async function loadTeamData(detail){
  membership=detail.membership;
  currentProfile=detail.profile;
  const td=detail.team?.data||{};
  team={name:detail.team?.name||"",...td};

  const {data:resources,error:rErr}=await db.from("team_resources").select("id,kind,data").eq("team_id",membership.team_id).order("created_at");
  if(rErr){console.error(rErr)}
  games=(resources||[]).filter(r=>r.kind==="game").map(r=>({id:r.id,...r.data}));
  fields=(resources||[]).filter(r=>r.kind==="field").map(r=>({id:r.id,...r.data}));

  operators=[];
  if(membership.role==="admin"){
    const {data:members,error:mErr}=await db.from("team_members").select("user_id,role").eq("team_id",membership.team_id);
    if(mErr){console.error(mErr)}
    const ids=(members||[]).map(m=>m.user_id);
    if(ids.length){
      const {data:profiles,error:pErr}=await db.from("profiles").select("*").in("user_id",ids);
      if(pErr){console.error(pErr)}
      operators=(profiles||[]).map(p=>({...p,member_role:(members||[]).find(m=>m.user_id===p.user_id)?.role||"operator"}));
    }
  }
  renderAll();
}
window.addEventListener("taskforce:auth-ready",e=>loadTeamData(e.detail));
if(window.TASKFORCE_AUTH?.state?.membership)loadTeamData(window.TASKFORCE_AUTH.state);
translate();