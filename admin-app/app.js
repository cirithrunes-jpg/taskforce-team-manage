(function() {
"use strict";
const {esc,money,localDate,dueDate,mergeOperators,financeSummary}=window.TFCore;
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const C=window.TASKFORCE_CONFIG;
let client,session=null,team=null,membership=null,operators=[],resources=[],fees=[],billing={},legacyFees=[];
let view="home",month=localDate().slice(0,7),agendaPast=false,showArchived=false,search="",installedPrompt=null,opening=false;
const activeOps=()=>operators.filter(o=>o.data.active!==false);
const allFees=()=>{const legacy=legacyFees.map(f=>({...f,legacy:true,operator_key:"user:"+f.user_id}));const keys=new Set(legacy.map(f=>f.operator_key));return [...legacy,...fees.filter(f=>!keys.has(f.operator_key))];};
const message=(text,error=false)=>{const el=$("#status");el.textContent=text;el.hidden=!text;el.classList.toggle("error",error);};
function toast(text){$("#toast").textContent=text;$("#toast").hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("#toast").hidden=true,4000);}
function gateStatus(text,error=false){$("#gateStatus").textContent=text;$("#gateStatus").classList.toggle("error",error);}
function clearData(){team=null;membership=null;operators=[];resources=[];fees=[];legacyFees=[];billing={};$("#shell").hidden=true;$("#gate").hidden=false;$$(".view").forEach(el=>el.replaceChildren());$("#editor").close();$("#editForm").replaceChildren();$("#teamName").textContent="—";message("");}
function unwrap(result){if(result.error) throw result.error;return result.data;}
async function checked(query){return unwrap(await query);}
async function rows(table,filter={}) {
  let result=[],offset=0;
  for(;;){
    let q=client.from(table).select("*").eq("team_id",membership.team_id).order("id").range(offset,offset+499);
    for(const [key,value] of Object.entries(filter)) q=q.eq(key,value);
    const data=await checked(q);
    result.push(...data);
    if(data.length<500) return result;
    offset+=500;
  }
}
async function load(){
  const results=await Promise.allSettled([
    checked(client.from("teams").select("*").eq("id",membership.team_id).single()),
    checked(client.rpc("admin_list_members")),
    rows("team_operator_records"),rows("team_resources"),
    rows("team_admin_fees",{reference_month:month+"-01"}),
    checked(client.rpc("get_billing_settings")),
    checked(client.rpc("admin_get_monthly_fees",{ref_month:month+"-01"}))
  ]);
  const failed=results.find(r=>r.status==="rejected");
  if(failed) throw failed.reason;
  [team]=results.map(r=>r.value);
  operators=mergeOperators(results[1].value||[],results[2].value||[]);
  resources=results[3].value||[];
  fees=results[4].value||[];
  billing=results[5].value||{};
  if(Array.isArray(billing)) billing=billing[0]||{};
  legacyFees=results[6].value||[];
  $("#teamName").textContent=team.name;
  $("#sync").textContent="Atualizado às "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"});
  render();
}
async function authorize(s){
  if(opening)return;
  opening=true;
  try{
    clearData();
    session=s;
    const memberships=await checked(client.from("team_members").select("team_id,role").eq("user_id",s.user.id).eq("role","admin"));
    if(!memberships.length) {await client.auth.signOut();throw new Error("Este painel é exclusivo dos administradores. Sua conta não tem esse acesso.");}
    if(memberships.length!==1)throw new Error("Sua conta administra mais de uma equipe. Selecione a equipe na versão original antes da migração.");
    membership=memberships[0];
    gateStatus("Carregando sua equipe...");
    await load();
    $("#gate").hidden=true;$("#shell").hidden=false;
    $("#loginForm").reset();
    selectView("home");
  }catch(e){clearData();gateStatus(readable(e),true);}finally{opening=false;}
}
function readable(e){
  const msg=String(e?.message||"Não foi possível concluir. Tente novamente.");
  if(/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if(/email not confirmed/i.test(msg)) return "Seu e-mail ainda precisa ser confirmado.";
  if(/fetch|network/i.test(msg))return "Sem conexão com o servidor. Verifique a internet e tente novamente.";
  if(/team_admin_fees|schema cache/i.test(msg))return "A nova versão ainda precisa da atualização do banco. Os dados existentes estão preservados.";
  return msg;
}
function selectView(name){
  if(!["home","operators","agenda","finance"].includes(name))return;
  view=name;
  $$(".view").forEach(el=>el.hidden=el.id!=="view-"+view);
  $$("[data-view]").forEach(el=>{el.classList.toggle("selected",el.dataset.view===view);el.setAttribute("aria-current",el.dataset.view===view?"page":"false");});
  $("#pageTitle").textContent={home:"Visão geral",operators:"Operadores",agenda:"Agenda",finance:"Financeiro"}[view];
}
function empty(title,text){return '<div class="empty"><strong>'+esc(title)+'</strong>'+esc(text)+'</div>';}
function stat(label,value,hint){return '<article class="stat"><small>'+esc(label)+'</small><strong class="money">'+esc(value)+'</strong><span class="hint">'+esc(hint)+'</span></article>';}
function dayLabel(date){return date?new Date(date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}):"Data não informada";}
function games(){return resources.filter(r=>r.kind==="game"&&!r.data.archived).sort((a,b)=>(a.data.date||"").localeCompare(b.data.date||"")||(a.data.time||"").localeCompare(b.data.time||""));}
function gameRow(g){
  const d=g.data,participants=Array.isArray(d.participants)?d.participants:[];
  const date=d.date?new Date(d.date+"T12:00:00"):null;
  const mapQuery=d.place||"";
  const mapLink=mapQuery?'<a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(mapQuery)+'" target="_blank" rel="noopener noreferrer">Ver local no mapa ↗</a>':"";
  return '<article class="row"><div class="row-main"><div class="date-tile"><b>'+(date?date.getDate():"—")+'</b><small>'+(date?esc(date.toLocaleDateString("pt-BR",{month:"short"})):"")+'</small></div><div><strong>'+esc(d.name)+'</strong><small>'+esc((d.time||"")+" · "+(d.place||"Local a definir"))+'</small><small>'+participants.length+' participante(s)</small>'+mapLink+'</div></div><div class="row-actions"><button class="secondary" data-action="game" data-id="'+esc(g.id)+'">Detalhes</button></div></article>';
}
function renderHome(){
  const summary=financeSummary(allFees()), upcoming=games().filter(g=>(g.data.date||"")>=localDate());
  $("#view-home").innerHTML='<div class="hero"><div><span class="eyebrow">CENTRAL DA EQUIPE</span><h2>'+esc(team.name)+'</h2><p>Seu time no WhatsApp. Sua organização por aqui.</p></div><button class="primary" data-action="game">+ Novo jogo</button></div><div class="stats">'+stat("Operadores ativos",activeOps().length,"Cadastros da equipe")+stat("Recebido em "+month.split("-").reverse().join("/"),money(summary.paidCents/100),summary.paidCount+" pagamento(s)")+stat("A receber",money(summary.pendingCents/100),summary.pendingCount+" mensalidade(s)")+'</div><div class="section-title"><h2>Próximos compromissos</h2><button class="text-button" data-action="go-agenda">Ver agenda ↗</button></div><div class="panel">'+(upcoming.length?upcoming.slice(0,3).map(gameRow).join(""):empty("A agenda está livre","Cadastre o próximo jogo ou treino da equipe."))+'</div><div class="section-title"><h2>Resolva em poucos toques</h2></div><div class="toolbar"><button class="secondary" data-action="operator">+ Cadastrar operador</button><button class="secondary" data-action="go-finance">Ver mensalidades</button><button class="text-button" data-action="team">Editar equipe</button></div>';
}
function renderOperators(){
 const shown=operators.filter(o=>(showArchived||o.data.active!==false)&&[o.data.name,o.data.callsign,o.data.role].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
 $("#view-operators").innerHTML='<div class="section-title"><div><h2>Quem faz parte da equipe</h2><p>Cadastro direto. Sem conta, convite ou confirmação por e-mail.</p></div><button class="primary" data-action="operator">+ Operador</button></div><div class="toolbar"><input type="search" id="operatorSearch" aria-label="Buscar operador" placeholder="Buscar nome, codinome ou função" value="'+esc(search)+'"><label class="check"><input type="checkbox" id="showArchived" '+(showArchived?"checked":"")+'>Mostrar arquivados</label></div><div class="panel">'+(shown.length?shown.map(o=>'<article class="row"><div class="row-main"><span class="avatar">'+esc((o.data.callsign||o.data.name||"OP").slice(0,2).toUpperCase())+'</span><div><strong>'+esc(o.data.name)+'</strong><small>'+esc([o.data.callsign,o.data.role,o.data.phone].filter(Boolean).join(" · "))+'</small></div></div><div class="row-actions">'+(o.data.active===false?'<span class="pill archived">Arquivado</span>':'')+'<button class="secondary" data-action="operator" data-id="'+esc(o.key)+'">Abrir ficha</button></div></article>').join(""):empty("Nenhum operador encontrado","Cadastre o primeiro operador ou ajuste a busca."))+'</div>';
 $("#operatorSearch").oninput=e=>{const start=e.target.selectionStart;search=e.target.value;renderOperators();$("#operatorSearch").focus();$("#operatorSearch").setSelectionRange(start,start);};
 $("#showArchived").onchange=e=>{showArchived=e.target.checked;renderOperators();};
}
function renderAgenda(){
 const shown=games().filter(g=>agendaPast?(g.data.date||"")<localDate():(g.data.date||"")>=localDate());
 $("#view-agenda").innerHTML='<div class="section-title"><div><h2>Jogos e treinos</h2><p>Local, horário e participantes em uma única ficha.</p></div><button class="primary" data-action="game">+ Evento</button></div><div class="toolbar"><select id="agendaFilter" aria-label="Período dos eventos"><option value="next">Próximos eventos</option><option value="past">Eventos anteriores</option></select></div><div class="panel">'+(shown.length?shown.map(gameRow).join(""):empty("Nenhum evento neste período","Os eventos anteriores ficam no histórico, sem apagar registros."))+'</div>';
 $("#agendaFilter").value=agendaPast?"past":"next";$("#agendaFilter").onchange=e=>{agendaPast=e.target.value==="past";renderAgenda();};
}
function renderFinance(){
 const items=allFees(),summary=financeSummary(items);
 $("#view-finance").innerHTML='<div class="section-title"><div><h2>Mensalidades sem complicação</h2><p>Registre os pagamentos recebidos pela equipe.</p></div><button class="secondary" data-action="billing">Configurar</button></div><div class="toolbar"><input id="financeMonth" aria-label="Mês das mensalidades" type="month" min="2000-01" max="2100-12" value="'+esc(month)+'"><button class="primary" data-action="generate">Gerar mensalidades</button></div><div class="stats">'+stat("Recebido",money(summary.paidCents/100),summary.paidCount+" pago(s)")+stat("A receber",money(summary.pendingCents/100),summary.pendingCount+" pendente(s)")+stat("Mensalidade",money(billing.monthly_amount||0),"Vencimento: dia "+(billing.due_day||5))+'</div><div class="panel">'+(items.length?items.map(f=>'<article class="row"><div class="row-main"><div><strong>'+esc(f.operator_name||"Operador")+'</strong><small>Vence em '+esc(dayLabel(f.due_date))+(f.payment_date?' · Pago em '+esc(dayLabel(f.payment_date)):'')+'</small><small class="money">'+esc(money(f.amount))+'</small></div></div><div class="row-actions"><span class="pill '+(f.status==="paid"?"paid":"")+'">'+esc({paid:"Pago",pending:"Pendente",submitted:"Em análise",exempt:"Isento"}[f.status]||f.status)+'</span>'+(f.status==="exempt"?"":'<button class="secondary" data-action="payment" data-id="'+esc(f.id)+'">Registrar</button>')+'</div></article>').join(""):empty("Sem mensalidades neste mês","Configure o valor e gere as mensalidades dos operadores ativos."))+'</div><div class="pix"><strong>Pix da equipe</strong><p>'+esc(billing.pix_key||"Nenhuma chave cadastrada.")+'</p>'+(billing.payee_name?'<p>Favorecido: '+esc(billing.payee_name)+'</p>':"")+'</div><p class="note">O painel registra o controle administrativo. Marcar como pago não realiza transferências nem confirma recebimentos no banco automaticamente.</p>';
 $("#financeMonth").onchange=async e=>{try{dueDate(e.target.value,1);month=e.target.value;await load();}catch(err){message(readable(err),true);}};
}
function render(){renderHome();renderOperators();renderAgenda();renderFinance();selectView(view);}
function input(name,label,value="",opts=""){return '<label>'+esc(label)+'<input name="'+esc(name)+'" value="'+esc(value)+'" '+opts+'></label>';}
function area(name,label,value=""){return '<label class="wide">'+esc(label)+'<textarea name="'+esc(name)+'" maxlength="4000" rows="3">'+esc(value)+'</textarea></label>';}
function openEditor(title,html,save){
 $("#editorTitle").textContent=title;
 $("#editForm").innerHTML=html+'<div id="formError" class="form-error" role="alert"></div><div class="form-actions"><button class="secondary" type="button" id="cancelEdit">Cancelar</button><button class="primary" type="submit">Salvar</button></div>';
 $("#cancelEdit").onclick=()=>$("#editor").close();
 $("#editForm").onsubmit=async e=>{
  e.preventDefault();const button=e.target.querySelector('button[type="submit"]');button.disabled=true;$("#formError").textContent="";
  try{await save(new FormData(e.target));$("#editor").close();toast("Salvo com sucesso.");try{await load();message("");}catch(loadError){message("O registro foi salvo, mas a consulta falhou. Toque em Atualizar. "+readable(loadError),true);}}
  catch(err){$("#formError").textContent=readable(err);}finally{button.disabled=false;}
 };
 $("#editor").showModal();
}
function operatorEditor(key){
 const op=operators.find(o=>o.key===key),d=op?.data||{};
 openEditor(op?"Ficha do operador":"Cadastrar operador",'<div class="form-grid">'+input("name","Nome completo",d.name,'required maxlength="160"')+input("callsign","Codinome",d.callsign,'maxlength="60"')+input("role","Função",d.role,'placeholder="Assault, DMR, Sniper..." maxlength="60"')+input("phone","Telefone",d.phone,'type="tel" maxlength="40"')+input("email","E-mail (opcional)",d.email,'type="email" maxlength="180"')+input("blood","Tipo sanguíneo (se informado)",d.blood,'maxlength="12"')+input("emergency","Contato de emergência",d.emergency,'maxlength="160"')+input("emergencyPhone","Telefone de emergência",d.emergencyPhone,'type="tel" maxlength="40"')+area("allergy","Alergias e informações de emergência",d.allergy)+area("notes","Observações",d.notes)+'</div><label class="check"><input type="checkbox" name="active" '+(d.active===false?"":"checked")+'>Operador ativo na equipe</label><p class="note">Dados de emergência ficam na ficha administrativa. Registre apenas informações necessárias e fornecidas pelo integrante.</p>',async f=>{
  const data={...d};for(const name of ["name","callsign","role","phone","email","blood","emergency","emergencyPhone","allergy","notes"])data[name]=String(f.get(name)||"").trim();
  if(!data.name)throw new Error("Informe o nome do operador.");
  data.active=f.has("active");if(op?.sourceUserId)data.source_user_id=op.sourceUserId;
  if(op?.recordId)await checked(client.from("team_operator_records").update({data}).eq("id",op.recordId).eq("team_id",membership.team_id).select("id").single());
  else await checked(client.from("team_operator_records").insert({team_id:membership.team_id,data}).select("id").single());
 });
}
function gameEditor(id){
 const g=resources.find(r=>r.id===id&&r.kind==="game"),d=g?.data||{},fields=resources.filter(r=>r.kind==="field");
 const fieldSelect='<label class="wide">Usar campo cadastrado<select id="savedField"><option value="">Preencher local manualmente</option>'+fields.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.data.name)+'</option>').join("")+'</select></label>';
 const participants='<div class="wide"><label>Participantes</label><div class="participants">'+(activeOps().length?activeOps().map(o=>'<label class="check"><input type="checkbox" name="participants" value="'+esc(o.key)+'" '+((d.participants||[]).includes(o.key)?"checked":"")+'>'+esc(o.data.callsign||o.data.name)+'</label>').join(""):'<small class="muted">Cadastre operadores para montar a lista.</small>')+'</div></div>';
 openEditor(g?"Detalhes do evento":"Novo jogo ou treino",'<div class="form-grid">'+input("name","Nome do evento",d.name,'required maxlength="160"')+input("date","Data",d.date||localDate(),'type="date" required')+input("time","Horário",d.time||"08:00",'type="time" required')+'<label>Tipo<select name="type">'+["Jogo","Treino","Operação","Evento interno","Outros"].map(t=>'<option '+(d.type===t?"selected":"")+'>'+t+'</option>').join("")+'</select></label>'+fieldSelect+'<div class="wide">'+input("place","Local / endereço",d.place,'maxlength="500"')+'</div>'+participants+area("notes","Orientações e observações",d.notes)+'</div>',async f=>{
  const data={...d};for(const name of ["name","date","time","type","place","notes"])data[name]=String(f.get(name)||"").trim();
  if(!data.name||!/^\d{4}-\d{2}-\d{2}$/.test(data.date))throw new Error("Informe o nome e a data do evento.");
  const valid=new Set(activeOps().map(o=>o.key)),old=d.participants||[];
  data.participants=[...new Set([...f.getAll("participants").filter(k=>valid.has(k)),...old.filter(k=>!valid.has(k))])];
  const payload={team_id:membership.team_id,kind:"game",data};
  if(g)await checked(client.from("team_resources").update(payload).eq("id",g.id).eq("team_id",membership.team_id).select("id").single());
  else await checked(client.from("team_resources").insert(payload).select("id").single());
 });
 $("#savedField").onchange=e=>{const field=fields.find(r=>r.id===e.target.value);if(field)$("#editForm").elements.place.value=[field.data.name,field.data.address].filter(Boolean).join(" — ");};
}
function billingEditor(){
 openEditor("Configurar mensalidade",'<div class="form-grid">'+input("amount","Valor mensal (R$)",billing.monthly_amount||"",'type="number" min="0.01" max="999999" step="0.01" required')+input("day","Dia de vencimento",billing.due_day||5,'type="number" min="1" max="28" required')+'<div class="wide">'+input("pix","Chave Pix",billing.pix_key,'maxlength="200"')+'</div><div class="wide">'+input("payee","Favorecido",billing.payee_name,'maxlength="160"')+'</div></div>',async f=>{
  const amount=Number(f.get("amount")),day=Number(f.get("day"));
  if(!Number.isFinite(amount)||amount<=0||!Number.isInteger(day)||day<1||day>28)throw new Error("Confira o valor e o vencimento (dia 1 a 28).");
  await checked(client.rpc("admin_save_billing_settings",{payload:{...billing,enabled:true,monthly_amount:amount,due_day:day,pix_key:String(f.get("pix")||"").trim(),payee_name:String(f.get("payee")||"").trim()}}));
 });
}
function paymentEditor(id){
 const fee=allFees().find(f=>f.id===id);if(!fee)return;
 openEditor("Registrar pagamento",'<p>'+esc(fee.operator_name)+' · '+esc(money(fee.amount))+'</p><label>Situação<select name="status"><option value="pending">Pendente</option><option value="paid">Pago</option></select></label>'+input("date",fee.legacy?"Data do comprovante original":"Data do pagamento",fee.legacy?(fee.payment_date||""):(fee.payment_date||localDate()),fee.legacy?'type="date" disabled':'type="date" required')+area("note","Observação",fee.admin_note||""),async f=>{
  const paid=f.get("status")==="paid",date=String(f.get("date")||"");
  if(!fee.legacy&&paid&&date>localDate())throw new Error("A data do pagamento não pode estar no futuro.");
  if(fee.legacy){await checked(client.rpc("admin_confirm_monthly_payment",{target_fee:fee.id,mark_paid:paid,admin_message:String(f.get("note")||"")}));}
  else await checked(client.from("team_admin_fees").update({status:paid?"paid":"pending",payment_date:paid?date:null,admin_note:String(f.get("note")||""),updated_at:new Date().toISOString()}).eq("id",fee.id).eq("team_id",membership.team_id).select("id").single());
 });
 $("#editForm").elements.status.value=fee.status==="paid"?"paid":"pending";
}
function teamEditor(){openEditor("Informações da equipe",input("name","Nome da equipe",team.name,'required maxlength="160"'),async f=>{const name=String(f.get("name")||"").trim();if(!name)throw new Error("Informe o nome da equipe.");await checked(client.from("teams").update({name,data:{...team.data,name}}).eq("id",membership.team_id).select("id").single());});}
async function generateFees(button){
 if(!activeOps().length)return toast("Cadastre um operador ativo antes de gerar mensalidades.");
 if(!Number(billing.monthly_amount))return billingEditor();
 const existing=new Set(allFees().map(f=>f.operator_key));
 const rowsToAdd=activeOps().filter(o=>!existing.has(o.key)).map(o=>({team_id:membership.team_id,operator_key:o.key,operator_name:o.data.name,reference_month:month+"-01",amount:Number(billing.monthly_amount),due_date:dueDate(month,billing.due_day),status:"pending"}));
 if(!rowsToAdd.length)return toast("Todos os operadores ativos já têm mensalidade neste mês.");
 button.disabled=true;
 try{
  const added=await checked(client.from("team_admin_fees").upsert(rowsToAdd,{onConflict:"team_id,operator_key,reference_month",ignoreDuplicates:true}).select("id"));
  await load();toast((added||[]).length+" mensalidade(s) gerada(s).");
 }catch(e){message(readable(e),true);}finally{button.disabled=false;}
}
document.addEventListener("click",e=>{
 const button=e.target.closest("[data-action]");if(!button||!membership)return;
 const action=button.dataset.action,id=button.dataset.id;
 if(action==="operator")operatorEditor(id);
 else if(action==="game")gameEditor(id);
 else if(action==="billing")billingEditor();
 else if(action==="payment")paymentEditor(id);
 else if(action==="team")teamEditor();
 else if(action==="generate")generateFees(button);
 else if(action==="go-agenda")selectView("agenda");
 else if(action==="go-finance")selectView("finance");
});
$$("[data-view]").forEach(b=>b.onclick=()=>selectView(b.dataset.view));
$("#closeEditor").onclick=()=>$("#editor").close();
$("#refresh").onclick=async()=>{const b=$("#refresh");b.disabled=true;try{await load();message("");toast("Dados atualizados.");}catch(e){message(readable(e),true);}finally{b.disabled=false;}};
$("#logout").onclick=async()=>{clearData();session=null;await client.auth.signOut();gateStatus("Você saiu da conta.");};
$("#loginForm").onsubmit=async e=>{
 e.preventDefault();if(!client)return;
 const button=e.target.querySelector("button"),f=new FormData(e.target);button.disabled=true;gateStatus("Verificando acesso...");
 try{
  const result=await client.auth.signInWithPassword({email:String(f.get("email")).trim(),password:String(f.get("password"))});
  if(result.error)throw result.error;
  await authorize(result.data.session);
 }catch(err){gateStatus(readable(err),true);}finally{button.disabled=false;}
};
$("#recover").onclick=async()=>{
 if(!client)return;
 const input=$("#loginForm").elements.email;
 if(!input.value||!input.checkValidity()){input.reportValidity();input.focus();gateStatus("Informe seu e-mail no campo acima para receber o link.");return;}
 const button=$("#recover");button.disabled=true;
 try{await checked(client.auth.resetPasswordForEmail(input.value.trim(),{redirectTo:C.recoveryUrl}));gateStatus("Se existir uma conta, as instruções serão enviadas. A recuperação abre na página original do TaskForce.");}
 catch(e){gateStatus(readable(e),true);}finally{button.disabled=false;}
};
$("#today").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",timeZone:"America/Sao_Paulo"}).toUpperCase();
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installedPrompt=e;$("#install").hidden=false;});
$("#install").onclick=async()=>{if(!installedPrompt)return;await installedPrompt.prompt();installedPrompt=null;$("#install").hidden=true;};
window.addEventListener("offline",()=>{if(membership)message("Sem internet. Os dados exibidos são da última consulta. Reconecte para salvar alterações.");});
window.addEventListener("online",()=>{if(membership)message("Conexão restabelecida. Toque em Atualizar para consultar os registros.");});
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
if(!window.supabase||!C?.supabaseUrl){gateStatus("Não foi possível carregar a conexão. Verifique a internet e recarregue a página.",true);$("#loginForm").querySelector("button").disabled=true;return;}
client=window.supabase.createClient(C.supabaseUrl,C.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
client.auth.onAuthStateChange((event,s)=>{
 if(event==="SIGNED_OUT"){session=null;clearData();}
 else if(event==="TOKEN_REFRESHED")session=s;
});
client.auth.getSession().then(({data,error})=>{if(error)gateStatus(readable(error),true);else if(data.session)authorize(data.session);});
})();
