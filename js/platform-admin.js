(()=>{
const C=window.TASKFORCE_CONFIG||{};
const $=(s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];

if(!window.supabase||!C.supabaseUrl||!C.supabasePublishableKey){
  $("#adminStatus").textContent="Configuração do Supabase não encontrada.";
  return;
}

const client=window.supabase.createClient(C.supabaseUrl,C.supabasePublishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
});

let state={session:null,overview:null,teams:[],users:null};

function status(msg,type=""){
  const el=$("#adminStatus");
  if(!el)return;
  el.className="auth-message "+type;
  el.textContent=msg||"";
}

async function rpc(name,body={}){
  const token=state.session?.access_token;
  if(!token)throw new Error("Sessão não autenticada.");
  const res=await fetch(C.supabaseUrl+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":C.supabasePublishableKey,
      "Authorization":"Bearer "+token
    },
    body:JSON.stringify(body)
  });
  const raw=await res.text();
  let data=null;
  try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!res.ok)throw new Error(data?.message||data?.details||String(data||"Erro no servidor."));
  return data;
}

function gate(show){
  $("#adminGate").classList.toggle("show",show);
  $("#adminShell").hidden=show;
}

function renderLogin(){
  gate(true);
  $("#adminLoginForm").hidden=false;
  status("Entre com sua conta de proprietário.");
}

async function confirmAccess(session){
  state.session=session;
  status("Verificando permissão...");
  const allowed=await rpc("is_platform_admin");
  if(!allowed){
    await client.auth.signOut();
    state.session=null;
    gate(true);
    $("#adminLoginForm").hidden=true;
    status("Esta conta não possui acesso ao Control Center.","error");
    return;
  }
  gate(false);
  await loadAll();
}

async function loadAll(){
  const [overview,teams,users]=await Promise.all([
    rpc("get_platform_overview"),
    rpc("get_platform_teams"),
    rpc("get_platform_user_stats")
  ]);
  state.overview=overview||{};
  state.teams=Array.isArray(teams)?teams:[];
  state.users=users||{};
  renderAll();
}

function num(v){return Number(v||0).toLocaleString("pt-BR")}
function date(v){
  if(!v)return"—";
  try{return new Date(v).toLocaleDateString("pt-BR")}catch{return"—"}
}

function renderOverview(){
  const o=state.overview||{};
  $("#ccTeams").textContent=num(o.teams_total);
  $("#ccTeams30").textContent=num(o.new_teams_30d)+" novas em 30 dias";
  $("#ccUsers").textContent=num(o.users_total);
  $("#ccUsers30").textContent=num(o.new_users_30d)+" novos em 30 dias";
  $("#ccOperators").textContent=num(o.operators_total);
  $("#ccAdmins").textContent=num(o.admins_total);
  $("#ccTerms").textContent=num(o.terms_total);
  $("#ccRevocations").textContent=num(o.revocations_total);
  $("#ccBillingTeams").textContent=num(o.billing_teams);
  $("#ccPaid").textContent=num(o.payments_paid);
  $("#ccPending").textContent=num(o.payments_pending);
}

function renderUsers(){
  const u=state.users||{};
  $("#ccConfirmed").textContent=num(u.confirmed_users);
  $("#ccUnconfirmed").textContent=num(u.unconfirmed_users);
  $("#ccWithProfile").textContent=num(u.users_with_profile);
  $("#ccWithoutTeam").textContent=num(u.users_without_team);
}

function renderTeams(filter=""){
  const q=String(filter||"").trim().toLowerCase();
  const rows=state.teams.filter(t=>[
    t.name,t.acronym,t.city
  ].some(v=>String(v||"").toLowerCase().includes(q)));

  if(!rows.length){
    $("#platformTeamsList").innerHTML='<div class="empty">Nenhuma equipe encontrada.</div>';
    return;
  }

  $("#platformTeamsList").innerHTML=
    '<table class="admin-table">'+
      '<thead><tr><th>Equipe</th><th>Cidade</th><th>Membros</th><th>ADMs</th><th>Operadores</th><th>Termos</th><th>Mensalidade</th><th>Criada em</th></tr></thead>'+
      '<tbody>'+
      rows.map(t=>
        '<tr>'+
          '<td><strong>'+esc(t.name||"—")+'</strong>'+(t.acronym?'<small>'+esc(t.acronym)+'</small>':"")+'</td>'+
          '<td>'+esc(t.city||"—")+'</td>'+
          '<td>'+num(t.members_total)+'</td>'+
          '<td>'+num(t.admins_total)+'</td>'+
          '<td>'+num(t.operators_total)+'</td>'+
          '<td>'+num(t.terms_total)+'</td>'+
          '<td><span class="badge">'+(t.billing_enabled?"Ativa":"Não")+'</span></td>'+
          '<td>'+date(t.created_at)+'</td>'+
        '</tr>'
      ).join("")+
      '</tbody>'+
    '</table>';
}

function esc(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

function renderAll(){
  renderOverview();
  renderUsers();
  renderTeams($("#teamSearch").value);
}

const titles={
  overview:["Visão geral","Panorama de toda a plataforma TASKFORCE"],
  teams:["Equipes","Equipes criadas e seus indicadores principais"],
  users:["Usuários","Indicadores de cadastro e ativação"],
  app:["Aplicativo","Operação e futura integração com a Google Play"]
};

function showView(view){
  $$(".admin-view").forEach(x=>x.classList.remove("active"));
  $$(".nav-item[data-admin-view]").forEach(x=>x.classList.remove("active"));
  $("#admin-view-"+view)?.classList.add("active");
  document.querySelector('[data-admin-view="'+view+'"]')?.classList.add("active");
  $("#adminPageTitle").textContent=titles[view]?.[0]||"Control Center";
  $("#adminPageSubtitle").textContent=titles[view]?.[1]||"";
  document.body.classList.remove("admin-menu-open");
}

$$("[data-admin-view]").forEach(b=>b.onclick=()=>showView(b.dataset.adminView));
$("#teamSearch").addEventListener("input",e=>renderTeams(e.target.value));
$("#refreshAdmin").onclick=async()=>{
  $("#refreshAdmin").disabled=true;
  $("#refreshAdmin").textContent="Atualizando...";
  try{await loadAll()}catch(err){alert(err.message)}
  $("#refreshAdmin").disabled=false;
  $("#refreshAdmin").textContent="Atualizar dados";
};
$("#adminMenuBtn").onclick=()=>document.body.classList.toggle("admin-menu-open");

$("#adminLogout").onclick=async()=>{
  await client.auth.signOut();
  location.reload();
};

$("#adminLoginForm").onsubmit=async e=>{
  e.preventDefault();
  const btn=e.target.querySelector('button[type="submit"]');
  btn.disabled=true;
  status("Entrando...");
  const f=new FormData(e.target);
  try{
    const {data,error}=await client.auth.signInWithPassword({
      email:String(f.get("email")).trim(),
      password:String(f.get("password"))
    });
    if(error)throw error;
    if(!data?.session)throw new Error("Nenhuma sessão foi criada.");
    await confirmAccess(data.session);
  }catch(err){
    status(err.message||"Falha ao entrar.","error");
    btn.disabled=false;
  }
};

(async()=>{
  try{
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    if(data?.session)await confirmAccess(data.session);
    else renderLogin();
  }catch(err){
    renderLogin();
    status("Faça login para continuar.","error");
  }
})();
})();