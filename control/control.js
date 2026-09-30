(()=>{
const C=window.TASKFORCE_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const money=cents=>Number(cents||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const num=v=>Number(v||0).toLocaleString("pt-BR");
const date=v=>v?new Date(v).toLocaleDateString("pt-BR"):"—";
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const cents=v=>Math.round(Number(String(v||"0").replace(",","."))*100);

if(!window.supabase||!C.supabaseUrl||!C.supabasePublishableKey){
  $("#controlStatus").textContent="Configuração do Supabase não encontrada.";return;
}
const db=window.supabase.createClient(C.supabaseUrl,C.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const state={session:null,overview:{},users:{},teams:[],finance:{},plans:[],discounts:[],subscriptions:[],payments:[],credits:[],cancellations:[],support:[]};

async function rest(path,{method="GET",body=null,prefer=""}={}){
  const token=state.session?.access_token;if(!token)throw new Error("Sessão não autenticada.");
  const headers={"apikey":C.supabasePublishableKey,"Authorization":"Bearer "+token};
  if(body!==null)headers["Content-Type"]="application/json";
  if(prefer)headers["Prefer"]=prefer;
  const res=await fetch(C.supabaseUrl+"/rest/v1/"+path,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!res.ok){const err=new Error(data?.message||data?.details||String(data||"Erro no servidor."));err.code=data?.code;throw err}
  return data;
}

function status(msg,type=""){const el=$("#controlStatus");if(el){el.textContent=msg||"";el.className="message "+type}}
function formStatus(id,msg,type=""){const el=$(id);if(el){el.textContent=msg||"";el.className="form-status "+type}}
function gate(show){$("#controlGate").hidden=!show;$("#controlShell").hidden=show}
async function rpc(name,body={}){
  const token=state.session?.access_token;if(!token)throw new Error("Sessão não autenticada.");
  const res=await fetch(C.supabaseUrl+"/rest/v1/rpc/"+name,{method:"POST",headers:{"Content-Type":"application/json","apikey":C.supabasePublishableKey,"Authorization":"Bearer "+token},body:JSON.stringify(body)});
  const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!res.ok)throw new Error(data?.message||data?.details||String(data||"Erro no servidor."));return data;
}
function teamName(id){const t=state.teams.find(x=>x.id===id);return t?.name||"Equipe"}
function planName(id){return state.plans.find(x=>x.id===id)?.name||"Plano"}
function discountName(id){return state.discounts.find(x=>x.id===id)?.code||""}

async function confirmAccess(session){
  state.session=session;status("Verificando permissão...");
  const allowed=await rpc("is_platform_admin");
  if(!allowed){await db.auth.signOut();state.session=null;$("#controlLoginForm").hidden=true;status("Acesso não autorizado.","error");return}
  gate(false);await loadAll();
}
function renderLogin(){gate(true);$("#controlLoginForm").hidden=false;status("Entre com sua conta de administração da plataforma.");}

async function loadAll(){
  $("#refreshControl").disabled=true;
  try{
    const [overview,teams,users,finance,plansR,discountsR,subsR,payR,creditsR,cancelR,supportR]=await Promise.all([
      rpc("get_platform_overview"),
      rpc("get_platform_teams"),
      rpc("get_platform_user_stats"),
      rpc("get_platform_finance_overview"),
      rest("platform_plans?select=*&order=created_at.desc"),
      rest("platform_discounts?select=*&order=created_at.desc"),
      rest("platform_subscriptions?select=*&order=created_at.desc"),
      rest("platform_payments?select=*&order=created_at.desc&limit=1000"),
      rest("platform_credit_ledger?select=*&order=created_at.desc&limit=1000"),
      rest("platform_cancellation_feedback?select=*&order=created_at.desc&limit=1000"),
      rest("platform_support_requests?select=id,team_id,user_id,category,subject,message,status,created_at&order=created_at.desc&limit=300")
    ]);
    state.overview=overview||{};state.teams=Array.isArray(teams)?teams:[];state.users=users||{};state.finance=finance||{};
    state.plans=plansR||[];state.discounts=discountsR||[];state.subscriptions=subsR||[];state.payments=payR||[];state.credits=creditsR||[];state.cancellations=cancelR||[];state.support=supportR||[];
    renderAll();
  }catch(err){console.error(err);alert(err.message||"Falha ao carregar Control.");}
  finally{$("#refreshControl").disabled=false}
}

function renderAll(){renderOverview();renderFinance();renderTeams($("#teamSearch")?.value);renderUsers();renderSupport();populateForms()}
function renderOverview(){
  const o=state.overview,f=state.finance;
  $("#ovTeams").textContent=num(o.teams_total);$("#ovTeams30").textContent=num(o.new_teams_30d)+" novas em 30 dias";
  $("#ovUsers").textContent=num(o.users_total);$("#ovUsers30").textContent=num(o.new_users_30d)+" novos em 30 dias";
  $("#ovActiveSubs").textContent=num(f.active_subscriptions);$("#ovMrr").textContent=money(f.mrr_cents);
  $("#ovRevenue30").textContent=money(f.revenue_30d_cents);$("#ovPendingPayments").textContent=num(f.payments_pending);
  $("#ovFailedPayments").textContent=num(f.payments_failed_30d);$("#ovCanceled30").textContent=num(f.canceled_30d);
  $("#ovOperators").textContent=num(o.operators_total);$("#ovAdmins").textContent=num(o.admins_total);$("#ovTerms").textContent=num(o.terms_total);$("#ovSupport").textContent=num(state.support.filter(x=>x.status==="open").length);
}
function renderFinance(){
  const f=state.finance;
  $("#finMrr").textContent=money(f.mrr_cents);$("#finArr").textContent="ARR "+money(Number(f.mrr_cents||0)*12);
  $("#finRevenue30").textContent=money(f.revenue_30d_cents);$("#finActive").textContent=num(f.active_subscriptions);$("#finTrials").textContent=num(f.trialing_subscriptions)+" em teste";
  $("#finPastDue").textContent=num(f.past_due_subscriptions);$("#finPaused").textContent=num(f.paused_subscriptions)+" pausadas";
  $("#alertPastDue").textContent=num(f.past_due_subscriptions);$("#alertFailed").textContent=num(f.payments_failed_30d);$("#alertPaused").textContent=num(f.paused_subscriptions);$("#alertCanceled").textContent=num(f.canceled_30d);
  $("#creditBalance").textContent=money(f.credit_balance_cents);
  renderRevenueChart();renderSubscriptions($("#subscriptionSearch")?.value);renderPayments();renderPlans();renderDiscounts();renderCancellationReasons();
}
function renderRevenueChart(){
  const root=$("#revenueChart");if(!root)return;
  const now=new Date(),months=[];
  for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({y:d.getFullYear(),m:d.getMonth(),label:d.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),value:0})}
  state.payments.filter(p=>p.status==="paid"&&p.paid_at).forEach(p=>{const d=new Date(p.paid_at),x=months.find(m=>m.y===d.getFullYear()&&m.m===d.getMonth());if(x)x.value+=Number(p.amount_cents||0)});
  const max=Math.max(0,...months.map(x=>x.value));if(!max){root.innerHTML='<div class="empty">Sem pagamentos confirmados nos últimos 12 meses.</div>';return}
  root.innerHTML=months.map(x=>'<div class="bar-column"><div style="height:'+Math.max(3,Math.round(x.value/max*100))+'%" data-value="'+esc(money(x.value))+'"></div><small>'+esc(x.label)+'</small></div>').join("");
}
function renderSubscriptions(filter=""){
  const root=$("#subscriptionsTable");if(!root)return;
  const q=String(filter||"").trim().toLowerCase();
  const rows=state.subscriptions.filter(s=>(teamName(s.team_id)+" "+planName(s.plan_id)+" "+s.status).toLowerCase().includes(q));
  if(!rows.length){root.innerHTML='<div class="empty">Nenhuma assinatura registrada ainda.</div>';return}
  root.innerHTML='<table><thead><tr><th>Equipe</th><th>Plano</th><th>Status</th><th>Valor</th><th>Benefício</th><th>Origem</th><th>Próxima renovação</th><th>Desde</th></tr></thead><tbody>'+
    rows.map(s=>'<tr><td><strong>'+esc(teamName(s.team_id))+'</strong></td><td>'+esc(planName(s.plan_id))+'</td><td><span class="status-pill status-'+esc(s.status)+'">'+esc(statusLabel(s.status))+'</span></td><td><strong>'+esc(money(s.price_cents))+'</strong><small>'+esc(s.billing_interval==="yearly"?"anual":"mensal")+'</small></td><td>'+esc(discountName(s.discount_id)||"—")+'</td><td>'+esc(providerLabel(s.provider))+'</td><td>'+esc(date(s.current_period_end))+'</td><td>'+esc(date(s.started_at))+'</td></tr>').join("")+
  '</tbody></table>';
}
function renderPayments(){
  const root=$("#paymentsTable");if(!root)return;
  if(!state.payments.length){root.innerHTML='<div class="empty">Nenhum pagamento registrado.</div>';return}
  root.innerHTML='<table><thead><tr><th>Equipe</th><th>Valor</th><th>Status</th><th>Origem</th><th>Pago em</th><th>Criado em</th></tr></thead><tbody>'+
    state.payments.map(p=>'<tr><td>'+esc(teamName(p.team_id))+'</td><td><strong>'+esc(money(p.amount_cents))+'</strong></td><td><span class="status-pill status-'+esc(paymentStatusClass(p.status))+'">'+esc(paymentLabel(p.status))+'</span></td><td>'+esc(providerLabel(p.provider))+'</td><td>'+esc(date(p.paid_at))+'</td><td>'+esc(date(p.created_at))+'</td></tr>').join("")+
  '</tbody></table>';
}
function renderPlans(){
  const root=$("#plansGrid");if(!root)return;
  if(!state.plans.length){root.innerHTML='<div class="empty">Nenhum plano criado. Cadastre o primeiro plano quando definir a estratégia de preço.</div>';return}
  root.innerHTML=state.plans.map(p=>'<article class="finance-card"><small>'+esc(p.code)+'</small><strong>'+esc(p.name)+'</strong><span>'+esc(money(p.price_cents))+' / '+(p.billing_interval==="yearly"?"ano":"mês")+'</span><div class="card-meta"><span>'+num(p.trial_days)+' dias de teste</span><span>'+(p.active?"Ativo":"Inativo")+'</span></div></article>').join("");
}
function renderDiscounts(){
  const root=$("#discountsGrid");if(!root)return;
  if(!state.discounts.length){root.innerHTML='<div class="empty">Nenhum benefício criado. Use campanhas seletivas para evitar descontos permanentes desnecessários.</div>';return}
  root.innerHTML=state.discounts.map(d=>'<article class="finance-card"><small>'+esc(d.code)+'</small><strong>'+esc(d.name)+'</strong><span>'+esc(d.kind==="percent"?Number(d.percent_off).toLocaleString("pt-BR")+"%":money(d.amount_off_cents))+' · '+esc(durationLabel(d))+'</span><div class="card-meta"><span>'+num(d.times_redeemed)+' usos</span><span>'+(d.active?"Ativo":"Inativo")+'</span></div></article>').join("");
}
function renderCancellationReasons(){
  const root=$("#cancellationReasons");if(!root)return;
  const labels={price:"Preço",low_usage:"Baixo uso",missing_feature:"Faltou recurso",technical:"Problema técnico",team_closed:"Equipe encerrou",other:"Outro"};
  const counts={};state.cancellations.forEach(x=>counts[x.reason]=(counts[x.reason]||0)+1);
  const total=Object.values(counts).reduce((a,b)=>a+b,0);if(!total){root.innerHTML='<div class="empty">Nenhum motivo de cancelamento registrado.</div>';return}
  root.innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div class="reason-row"><span>'+esc(labels[k]||k)+'</span><b>'+num(v)+'</b><div class="reason-bar"><i style="width:'+Math.round(v/total*100)+'%"></i></div></div>').join("");
}
function renderTeams(filter=""){
  const root=$("#teamsTable");if(!root)return;const q=String(filter||"").trim().toLowerCase();
  const rows=state.teams.filter(t=>(String(t.name||"")+" "+String(t.acronym||"")+" "+String(t.city||"")).toLowerCase().includes(q));
  if(!rows.length){root.innerHTML='<div class="empty">Nenhuma equipe encontrada.</div>';return}
  root.innerHTML='<table><thead><tr><th>Equipe</th><th>Cidade</th><th>Membros</th><th>ADMs</th><th>Operadores</th><th>Assinatura SaaS</th><th>Criada em</th></tr></thead><tbody>'+
    rows.map(t=>{const s=state.subscriptions.find(x=>x.team_id===t.id&&["trialing","active","past_due","paused"].includes(x.status));return '<tr><td><strong>'+esc(t.name||"—")+'</strong><small>'+esc(t.acronym||"")+'</small></td><td>'+esc(t.city||"—")+'</td><td>'+num(t.members_total)+'</td><td>'+num(t.admins_total)+'</td><td>'+num(t.operators_total)+'</td><td>'+(s?'<span class="status-pill status-'+esc(s.status)+'">'+esc(statusLabel(s.status))+'</span>':'—')+'</td><td>'+date(t.created_at)+'</td></tr>'}).join("")+
  '</tbody></table>';
}
function renderUsers(){const u=state.users;$("#userConfirmed").textContent=num(u.confirmed_users);$("#userUnconfirmed").textContent=num(u.unconfirmed_users);$("#userProfile").textContent=num(u.users_with_profile);$("#userNoTeam").textContent=num(u.users_without_team)}
function renderSupport(){
  const root=$("#supportTable");if(!root)return;if(!state.support.length){root.innerHTML='<div class="empty">Nenhuma solicitação de suporte.</div>';return}
  root.innerHTML='<table><thead><tr><th>Data</th><th>Equipe</th><th>Categoria</th><th>Assunto</th><th>Mensagem</th><th>Status</th></tr></thead><tbody>'+
    state.support.map(x=>'<tr><td>'+date(x.created_at)+'</td><td>'+esc(teamName(x.team_id))+'</td><td>'+esc(x.category)+'</td><td><strong>'+esc(x.subject)+'</strong></td><td>'+esc(x.message)+'</td><td>'+esc(x.status)+'</td></tr>').join("")+'</tbody></table>';
}
function populateForms(){
  const teamOptions=state.teams.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join("");
  const planOptions=state.plans.filter(p=>p.active).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' — '+esc(money(p.price_cents))+'/'+(p.billing_interval==="yearly"?"ano":"mês")+'</option>').join("");
  const discountOptions='<option value="">Sem benefício</option>'+state.discounts.filter(d=>d.active).map(d=>'<option value="'+esc(d.id)+'">'+esc(d.code)+' — '+esc(d.name)+'</option>').join("");
  if($("#subscriptionTeam"))$("#subscriptionTeam").innerHTML=teamOptions||'<option value="">Nenhuma equipe</option>';
  if($("#creditTeam"))$("#creditTeam").innerHTML=teamOptions||'<option value="">Nenhuma equipe</option>';
  if($("#subscriptionPlan"))$("#subscriptionPlan").innerHTML=planOptions||'<option value="">Crie um plano primeiro</option>';
  if($("#subscriptionDiscount"))$("#subscriptionDiscount").innerHTML=discountOptions;
  const subOptions=state.subscriptions.filter(s=>s.status!=="canceled").map(s=>'<option value="'+esc(s.id)+'" data-price="'+Number(s.price_cents||0)+'">'+esc(teamName(s.team_id))+' — '+esc(planName(s.plan_id))+'</option>').join("");
  if($("#paymentSubscription"))$("#paymentSubscription").innerHTML=subOptions||'<option value="">Nenhuma assinatura</option>';
}

function statusLabel(v){return({active:"Ativa",trialing:"Em teste",past_due:"Em atraso",paused:"Pausada",canceled:"Cancelada"})[v]||v}
function paymentLabel(v){return({paid:"Pago",pending:"Pendente",failed:"Falhou",refunded:"Reembolsado",partially_refunded:"Reembolso parcial"})[v]||v}
function paymentStatusClass(v){return v==="paid"?"active":v==="failed"?"past_due":v==="pending"?"paused":"canceled"}
function providerLabel(v){return({manual:"Manual",mercadopago:"Mercado Pago",paddle:"Paddle",stripe:"Stripe",google_play:"Google Play"})[v]||v||"—"}
function durationLabel(d){if(d.duration==="forever")return"contínuo";if(d.duration==="repeating")return (d.max_cycles||"?")+" ciclos";return"1 cobrança"}

const titles={
  overview:["Visão geral","Panorama da plataforma TASKFORCE"],
  finance:["Financeiro","Receita, assinaturas, benefícios e retenção"],
  teams:["Equipes","Estrutura e clientes da plataforma"],
  users:["Usuários","Indicadores de cadastro e ativação"],
  support:["Suporte","Solicitações enviadas pelos usuários"],
  app:["Aplicativo","Operação técnica e integrações"]
};
function showView(v){
  $$(".view").forEach(x=>x.classList.remove("active"));$$(".nav-item").forEach(x=>x.classList.remove("active"));
  $("#view-"+v)?.classList.add("active");$('[data-view="'+v+'"]')?.classList.add("active");
  $("#pageTitle").textContent=titles[v]?.[0]||"Control";$("#pageSubtitle").textContent=titles[v]?.[1]||"";document.body.classList.remove("menu-open");
}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$$("[data-open]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.open)?.showModal()));
$$("[data-fin-tab]").forEach(b=>b.addEventListener("click",()=>{$$("[data-fin-tab]").forEach(x=>x.classList.remove("active"));$$(".fin-pane").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#fin-pane-"+b.dataset.finTab)?.classList.add("active")}));
$$("[data-fin-filter]").forEach(b=>b.addEventListener("click",()=>{const type=b.dataset.finFilter;if(type==="failed"){$('[data-fin-tab="payments"]')?.click()}else{$('[data-fin-tab="subscriptions"]')?.click();$("#subscriptionSearch").value=type;renderSubscriptions(type)}}));
$("#teamSearch")?.addEventListener("input",e=>renderTeams(e.target.value));$("#subscriptionSearch")?.addEventListener("input",e=>renderSubscriptions(e.target.value));
$("#controlMenuBtn").onclick=()=>document.body.classList.toggle("menu-open");
$("#refreshControl").onclick=loadAll;
$("#controlLogout").onclick=async()=>{await db.auth.signOut();location.reload()};

$("#discountKind")?.addEventListener("change",()=>{});
$("#discountDuration")?.addEventListener("change",e=>{$("#discountCycles").disabled=e.target.value!=="repeating"});
$("#paymentSubscription")?.addEventListener("change",e=>{const opt=e.target.selectedOptions[0],amount=$("#paymentForm")?.elements.amount;if(opt&&amount)amount.value=(Number(opt.dataset.price||0)/100).toFixed(2)});

$("#planForm").onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget);formStatus("#planStatus","Salvando...");
  const payload={name:String(f.get("name")).trim(),code:String(f.get("code")).trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"-"),price_cents:cents(f.get("price")),billing_interval:String(f.get("interval")),trial_days:Number(f.get("trial_days")||0),active:true,updated_at:new Date().toISOString()};
  try{await rest("platform_plans",{method:"POST",body:payload,prefer:"return=minimal"})}catch(error){formStatus("#planStatus",error.message,"error");return}
  formStatus("#planStatus","Plano criado.","success");e.currentTarget.reset();setTimeout(()=>$("#planModal").close(),350);await loadAll();
};
$("#discountForm").onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget),kind=String(f.get("kind")),duration=String(f.get("duration")),val=Number(f.get("value")||0);formStatus("#discountStatus","Criando...");
  const payload={name:String(f.get("name")).trim(),code:String(f.get("code")).trim().toUpperCase().replace(/[^A-Z0-9_-]+/g,"-"),kind,duration,percent_off:kind==="percent"?val:null,amount_off_cents:kind==="fixed"?cents(val):null,max_cycles:duration==="repeating"?Number(f.get("max_cycles")||0)||null:null,max_redemptions:Number(f.get("max_redemptions")||0)||null,valid_until:f.get("valid_until")?new Date(String(f.get("valid_until"))+"T23:59:59").toISOString():null,active:true};
  try{await rest("platform_discounts",{method:"POST",body:payload,prefer:"return=minimal"})}catch(error){formStatus("#discountStatus",error.message,"error");return}
  formStatus("#discountStatus","Benefício criado.","success");e.currentTarget.reset();setTimeout(()=>$("#discountModal").close(),350);await loadAll();
};
$("#subscriptionForm").onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget),plan=state.plans.find(x=>x.id===f.get("plan_id"));if(!plan){formStatus("#subscriptionStatus","Crie ou selecione um plano.","error");return}
  const statusV=String(f.get("status")),now=new Date(),end=new Date(now),trialDays=Number(plan.trial_days||0);if(plan.billing_interval==="yearly")end.setFullYear(end.getFullYear()+1);else end.setMonth(end.getMonth()+1);
  const payload={team_id:String(f.get("team_id")),plan_id:plan.id,discount_id:f.get("discount_id")||null,status:statusV,provider:String(f.get("provider")),price_cents:plan.price_cents,billing_interval:plan.billing_interval,started_at:now.toISOString(),current_period_start:now.toISOString(),current_period_end:end.toISOString(),trial_ends_at:statusV==="trialing"&&trialDays?new Date(now.getTime()+trialDays*86400000).toISOString():null,updated_at:now.toISOString()};
  formStatus("#subscriptionStatus","Registrando...");let data;try{const rows=await rest("platform_subscriptions?select=id",{method:"POST",body:payload,prefer:"return=representation"});data=Array.isArray(rows)?rows[0]:rows}catch(error){formStatus("#subscriptionStatus",error.code==="23505"?"Esta equipe já possui uma assinatura atual.":"Não foi possível registrar: "+error.message,"error");return}
  await rest("platform_subscription_events",{method:"POST",body:{subscription_id:data.id,team_id:payload.team_id,event_type:"subscription_created",data:{source:"control",status:statusV}},prefer:"return=minimal"});
  formStatus("#subscriptionStatus","Assinatura registrada.","success");e.currentTarget.reset();setTimeout(()=>$("#subscriptionModal").close(),350);await loadAll();
};
$("#paymentForm").onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget),sub=state.subscriptions.find(x=>x.id===f.get("subscription_id"));if(!sub){formStatus("#paymentStatus","Selecione uma assinatura.","error");return}
  const st=String(f.get("status")),now=new Date().toISOString();const payload={subscription_id:sub.id,team_id:sub.team_id,amount_cents:cents(f.get("amount")),status:st,provider:String(f.get("provider")),paid_at:st==="paid"?now:null,failed_at:st==="failed"?now:null,refunded_at:st==="refunded"?now:null};
  formStatus("#paymentStatus","Registrando...");try{await rest("platform_payments",{method:"POST",body:payload,prefer:"return=minimal"})}catch(error){formStatus("#paymentStatus",error.message,"error");return}
  formStatus("#paymentStatus","Pagamento registrado.","success");e.currentTarget.reset();setTimeout(()=>$("#paymentModal").close(),350);await loadAll();
};
$("#creditForm").onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget),payload={team_id:String(f.get("team_id")),amount_cents:cents(f.get("amount")),source:String(f.get("source")),reason:String(f.get("reason")).trim(),expires_at:f.get("expires_at")?new Date(String(f.get("expires_at"))+"T23:59:59").toISOString():null};
  formStatus("#creditStatus","Salvando...");try{await rest("platform_credit_ledger",{method:"POST",body:payload,prefer:"return=minimal"})}catch(error){formStatus("#creditStatus",error.message,"error");return}
  formStatus("#creditStatus","Crédito concedido.","success");e.currentTarget.reset();setTimeout(()=>$("#creditModal").close(),350);await loadAll();
};

$("#controlLoginForm").onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;status("Entrando...");const f=new FormData(e.currentTarget);
  try{const {data,error}=await db.auth.signInWithPassword({email:String(f.get("email")).trim(),password:String(f.get("password"))});if(error)throw error;if(!data?.session)throw new Error("Nenhuma sessão foi criada.");await confirmAccess(data.session)}
  catch(err){status(err.message||"Falha ao entrar.","error");btn.disabled=false}
};

(async()=>{try{const {data,error}=await db.auth.getSession();if(error)throw error;if(data?.session)await confirmAccess(data.session);else renderLogin()}catch{renderLogin();status("Faça login para continuar.","error")}})();
})();