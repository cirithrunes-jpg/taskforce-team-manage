const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
const pref={get(k,f){try{return JSON.parse(localStorage.getItem("tf_pref_"+k))??f}catch{return f}},set(k,v){localStorage.setItem("tf_pref_"+k,JSON.stringify(v))}};
const db=window.TASKFORCE_DB;
let team={},operators=[],games=[],fields=[],membership=null,currentProfile=null;
let billingSettings=null,monthlyFees=[],adminEmails=[],termAcceptances=[];
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
  $("[data-i18n]").forEach(el=>{const v=t(el.dataset.i18n);if(v)el.textContent=v});
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
$("#viewTerm").onclick=()=>showCurrentTerm();
$("#printTermBtn").onclick=()=>window.print();

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
  if(membership?.role==="admin" && o.member_role==="operator"){
    html+='<div class="modal-actions"><button type="button" class="ghost danger-action" id="removeOperatorBtn">Remover operador da equipe</button></div>';
  }
  $("#operatorDetails").innerHTML=html;
  if($("#removeOperatorBtn")){
    $("#removeOperatorBtn").onclick=()=>removeOperatorFromTeam(o);
  }
  openDialog("#operatorDetailsModal");
}
async function loadAdminMembers(){
  if(membership?.role!=="admin"){operators=[];return}
  const data=await financeRpc("admin_list_members");
  operators=Array.isArray(data)?data:[];
}
async function removeOperatorFromTeam(o){
  if(membership?.role!=="admin"||o.member_role!=="operator")return;
  const label=o.callsign||o.name||"este operador";
  if(!confirm("Remover "+label+" da equipe? O acesso será revogado e só poderá voltar com um novo convite."))return;
  try{
    await financeRpc("admin_remove_member",{target_user:o.user_id,reason_text:"Removido por administrador"});
    $("#operatorDetailsModal").close();
    await loadAdminMembers();
    renderOperators();
    alert("Operador removido. O acesso à equipe foi revogado.");
  }catch(err){
    alert("Não foi possível remover o operador: "+err.message);
  }
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

async function financeRpc(name,body={}){
  const session=window.TASKFORCE_AUTH?.state?.session;
  if(!session?.access_token)throw new Error("Sessão não autenticada.");
  const C=window.TASKFORCE_CONFIG||{};
  const res=await fetch(C.supabaseUrl+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":C.supabasePublishableKey,
      "Authorization":"Bearer "+session.access_token
    },
    body:JSON.stringify(body)
  });
  const raw=await res.text();
  let data=null;
  try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!res.ok)throw new Error(data?.message||data?.details||String(data||"Erro no servidor."));
  return data;
}
function money(v){
  return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
function monthValue(){
  const input=$("#financeMonth");
  if(!input.value){
    const d=new Date();
    input.value=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
  }
  return input.value+"-01";
}
function billingStatusLabel(s){
  return {pending:"Pendente",submitted:"Em análise",paid:"Pago",exempt:"Isento"}[s]||s;
}
async function loadFinanceData(){
  try{
    billingSettings=await financeRpc("get_billing_settings");
    adminEmails=await financeRpc("get_team_admin_emails");
    const ref=monthValue();
    monthlyFees=membership?.role==="admin"
      ? await financeRpc("admin_get_monthly_fees",{ref_month:ref})
      : await financeRpc("get_my_monthly_fees");
    renderFinance();
  }catch(err){
    console.error("Financeiro:",err);
    $("#financeFeesList").innerHTML='<div class="empty">Não foi possível carregar o financeiro.</div>';
  }
}
function renderFinance(){
  const isAdmin=membership?.role==="admin";
  $("#financeAdminActions").hidden=!isAdmin;
  const cfg=billingSettings||{};
  $("#financeMonthlyValue").textContent=money(cfg.monthly_amount||0);
  $("#financeDueDay").textContent=cfg.enabled?"Vencimento: dia "+(cfg.due_day||10):"Cobrança desativada";
  const fees=Array.isArray(monthlyFees)?monthlyFees:[];
  $("#financePaidCount").textContent=fees.filter(f=>f.status==="paid").length;
  $("#financePendingCount").textContent=fees.filter(f=>f.status==="pending").length;
  $("#financeSubmittedCount").textContent=fees.filter(f=>f.status==="submitted").length;
  $("#financeListTitle").textContent=isAdmin?"Mensalidades da equipe":"Minhas mensalidades";

  const pix=$("#financePixBox");
  if(cfg.enabled && (cfg.pix_key||cfg.pix_link||cfg.qr_code_url)){
    pix.className="pix-box";
    pix.innerHTML=
      (cfg.payee_name?'<strong>'+esc(cfg.payee_name)+'</strong>':"")+
      (cfg.qr_code_url?'<img class="pix-qr" src="'+esc(cfg.qr_code_url)+'" alt="QR Code Pix">':"")+
      (cfg.pix_key?'<div class="pix-key"><small>Pix / Copia e Cola</small><code>'+esc(cfg.pix_key)+'</code></div>':"")+
      (cfg.pix_link?'<a class="primary" href="'+esc(cfg.pix_link)+'" target="_blank" rel="noopener">Abrir pagamento Pix</a>':"")+
      (cfg.notes?'<p class="meta">'+esc(cfg.notes)+'</p>':"");
  }else{
    pix.className="empty";
    pix.textContent="O administrador ainda não configurou o pagamento.";
  }

  const root=$("#financeFeesList");
  if(!fees.length){
    root.innerHTML='<div class="empty">'+(isAdmin?"Nenhuma mensalidade gerada para este mês.":"Nenhuma mensalidade disponível.")+'</div>';
    return;
  }
  root.innerHTML=fees.map(f=>{
    const name=isAdmin?(f.operator_name||f.callsign||"Operador"):"Mensalidade "+String(f.reference_month||"").slice(0,7);
    const actions=[];
    if(isAdmin){
      if(f.receipt_path)actions.push('<button class="ghost small" data-receipt="'+esc(f.receipt_path)+'">Ver comprovante</button>');
      if(f.status==="submitted")actions.push('<button class="primary small" data-paid="'+esc(f.id)+'">Confirmar pago</button>');
      if(f.status!=="paid"&&f.status!=="exempt")actions.push('<button class="ghost small" data-exempt="'+esc(f.id)+'">Isentar</button>');
      if(f.status==="paid"||f.status==="exempt")actions.push('<button class="ghost small" data-reopen="'+esc(f.id)+'">Reabrir</button>');
    }else if(f.status==="pending"||f.status==="submitted"){
      actions.push('<button class="primary small" data-submit-payment="'+esc(f.id)+'">'+(f.status==="submitted"?"Reenviar comprovante":"Informar pagamento")+'</button>');
    }
    return '<article class="card-row finance-fee"><div><h3>'+esc(name)+'</h3><div class="meta">Valor: '+money(f.amount)+' • Vencimento: '+formatDate(f.due_date)+'</div><div class="meta">Status: <strong>'+billingStatusLabel(f.status)+'</strong>'+(f.payment_date?' • Pagamento: '+formatDate(f.payment_date):'')+'</div></div><div class="fee-actions">'+actions.join("")+'</div></article>';
  }).join("");

  $("[data-submit-payment]").forEach(b=>b.onclick=()=>{
    const form=$("#paymentSubmitForm");
    form.reset();form.elements.fee_id.value=b.dataset.submitPayment;
    form.elements.payment_date.value=new Date().toISOString().slice(0,10);
    openDialog("#paymentSubmitModal");
  });
  $("[data-paid]").forEach(b=>b.onclick=()=>confirmFeePaid(b.dataset.paid,true));
  $("[data-exempt]").forEach(b=>b.onclick=()=>setFeeExempt(b.dataset.exempt,true));
  $("[data-reopen]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.reopen;
    const fee=fees.find(x=>x.id===id);
    if(fee?.status==="exempt")await setFeeExempt(id,false);
    else await confirmFeePaid(id,false);
  });
  $("[data-receipt]").forEach(b=>b.onclick=()=>openReceipt(b.dataset.receipt));
}
async function openReceipt(path){
  try{
    const {data,error}=await db.storage.from("payment-receipts").createSignedUrl(path,300);
    if(error)throw error;
    window.open(data.signedUrl,"_blank","noopener");
  }catch(err){alert("Não foi possível abrir o comprovante: "+err.message)}
}
async function confirmFeePaid(id,markPaid){
  try{
    await financeRpc("admin_confirm_monthly_payment",{target_fee:id,mark_paid:markPaid,admin_message:""});
    await loadFinanceData();
  }catch(err){alert(err.message)}
}
async function setFeeExempt(id,isExempt){
  try{
    await financeRpc("admin_set_monthly_fee_exempt",{target_fee:id,is_exempt:isExempt});
    await loadFinanceData();
  }catch(err){alert(err.message)}
}
$("#openBillingSettings").onclick=()=>{
  if(membership?.role!=="admin")return;
  const form=$("#billingSettingsForm"),cfg=billingSettings||{};
  ["enabled","monthly_amount","due_day","pix_key","pix_link","qr_code_url","payee_name","notes"].forEach(k=>{
    if(form.elements[k])form.elements[k].value=cfg[k]??(k==="enabled"?"false":"");
  });
  openDialog("#billingSettingsModal");
};
$("#billingSettingsForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    assertAdmin();
    const f=formObject(e.target);
    const payload={
      enabled:f.enabled==="true",
      monthly_amount:Number(f.monthly_amount||0),
      due_day:Number(f.due_day||10),
      pix_key:f.pix_key||"",
      pix_link:f.pix_link||"",
      qr_code_url:f.qr_code_url||"",
      payee_name:f.payee_name||"",
      notes:f.notes||""
    };
    billingSettings=await financeRpc("admin_save_billing_settings",{payload});
    $("#billingSettingsModal").close();
    renderFinance();
  }catch(err){alert(err.message)}
});
$("#generateFees").onclick=async()=>{
  try{
    assertAdmin();
    const count=await financeRpc("admin_generate_monthly_fees",{ref_month:monthValue()});
    alert((count||0)+" mensalidade(s) gerada(s).");
    await loadFinanceData();
  }catch(err){alert(err.message)}
};
$("#financeMonth").addEventListener("change",()=>loadFinanceData());
$("#paymentSubmitForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const f=new FormData(e.target);
    const feeId=String(f.get("fee_id"));
    const paymentDate=String(f.get("payment_date"));
    const note=String(f.get("note")||"");
    const file=f.get("receipt");
    let receiptPath="";
    if(file && file.size){
      if(file.size>5*1024*1024)throw new Error("O comprovante deve ter no máximo 5 MB.");
      const ext=(file.name.split(".").pop()||"bin").toLowerCase();
      receiptPath=membership.team_id+"/"+currentProfile.user_id+"/"+feeId+"-"+Date.now()+"."+ext;
      const {error}=await db.storage.from("payment-receipts").upload(receiptPath,file,{upsert:false,contentType:file.type});
      if(error)throw error;
    }
    await financeRpc("submit_monthly_payment",{target_fee:feeId,payment_on:paymentDate,receipt:receiptPath,submission_note:note});
    $("#paymentSubmitModal").close();
    await loadFinanceData();
    if(adminEmails?.length){
      const subject=encodeURIComponent("TASKFORCE - comprovante de mensalidade enviado");
      const body=encodeURIComponent("Um comprovante de mensalidade foi enviado por "+(currentProfile?.name||"um operador")+". Acesse o TASKFORCE para conferir e confirmar o pagamento.");
      const mailto="mailto:"+adminEmails.join(",")+"?subject="+subject+"&body="+body;
      if(confirm("Comprovante enviado ao app. Deseja abrir seu e-mail para avisar os administradores?")) location.href=mailto;
    }else{
      alert("Comprovante enviado para análise dos administradores.");
    }
  }catch(err){alert("Não foi possível enviar o pagamento: "+err.message)}
});
function termDate(v){
  if(!v)return "—";
  try{return new Date(v).toLocaleString("pt-BR")}catch{return v}
}
function showCurrentTerm(){
  const html=[
    "Declaro participar voluntariamente das atividades esportivas de Airsoft promovidas ou acompanhadas pela equipe.",
    "Declaro estar ciente de que a atividade pode envolver esforço físico, deslocamento em terrenos irregulares e participação em locais que podem apresentar obstáculos, estruturas deterioradas ou outras condições próprias do ambiente.",
    "Reconheço que projéteis plásticos utilizados na prática esportiva podem causar dor, marcas ou ferimentos, mesmo com a adoção de medidas de segurança.",
    "Comprometo-me a utilizar os equipamentos de proteção exigidos, seguir as regras da equipe, do local e dos organizadores, informar limitações relevantes à minha participação e interromper a atividade quando entender que minha segurança ou a de terceiros possa estar comprometida.",
    "Declaro ser responsável por avaliar minha aptidão física para participar da atividade e por fornecer informações de emergência corretas quando solicitadas."
  ].map(x=>'<p>'+esc(x)+'</p>').join("");
  $("#termModalContent").innerHTML=html;
  openDialog("#termModal");
}
function showAcceptedTerm(id){
  const a=termAcceptances.find(x=>x.id===id);
  if(!a)return;
  const p=a.profile_snapshot||{};
  const dataRows=[
    ["Nome",p.name],["E-mail",p.email],["Telefone",p.phone],["Endereço",p.address],
    ["Codinome",p.callsign],["Função",p.role],["Tipo sanguíneo",p.blood],
    ["Contato de emergência",p.emergency],["Telefone de emergência",p.emergencyPhone],
    ["Parentesco / relação",p.relationship],["Alergias",p.allergy],["Informações de saúde",p.health]
  ];
  $("#termModalContent").innerHTML=
    '<div class="detail-grid">'+
      dataRows.map(r=>'<div class="detail-item"><small>'+esc(r[0])+'</small>'+esc(r[1]||"—")+'</div>').join("")+
    '</div>'+
    '<div class="privacy-box">Aceite registrado em '+esc(termDate(a.accepted_at))+' • versão '+esc(a.term_version||"—")+'</div>'+
    String(a.term_text||"").split(/\n\n+/).map(x=>'<p>'+esc(x)+'</p>').join("");
  openDialog("#termModal");
}
function renderTermDocuments(){
  const panel=$("#acceptedTermsPanel"),root=$("#acceptedTermsList"),count=$("#acceptedTermsCount");
  if(!panel||!root||!count)return;
  const isAdmin=membership?.role==="admin";
  panel.hidden=false;
  const list=Array.isArray(termAcceptances)?termAcceptances:[];
  count.textContent=String(list.length);
  if(!list.length){
    root.innerHTML='<div class="empty">'+(isAdmin?"Nenhum termo aceito arquivado.":"Seu termo aceito ainda não foi localizado.")+'</div>';
    return;
  }
  root.innerHTML=list.map(a=>{
    const p=a.profile_snapshot||{};
    const title=isAdmin?(p.name||p.callsign||"Operador"):"Meu termo de responsabilidade";
    return '<article class="card-row"><div><h3>'+esc(title)+'</h3><div class="meta">Aceito em '+esc(termDate(a.accepted_at))+' • '+esc(a.term_version||"")+'</div></div><button class="ghost small" data-term-acceptance="'+esc(a.id)+'">Ver cópia</button></article>';
  }).join("");
  $("[data-term-acceptance]").forEach(b=>b.onclick=()=>showAcceptedTerm(b.dataset.termAcceptance));
}
async function loadTermDocuments(){
  try{
    if(membership?.role==="admin"){
      const data=await financeRpc("admin_list_term_acceptances");
      termAcceptances=Array.isArray(data)?data:[];
    }else{
      const a=await financeRpc("get_my_term_acceptance");
      termAcceptances=a?[a]:[];
    }
    renderTermDocuments();
  }catch(err){
    console.error("Documentos:",err);
    termAcceptances=[];
    renderTermDocuments();
  }
}

function renderAll(){renderTeam();renderOperators();renderGames();renderFields();renderFinance();renderTermDocuments()}

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
    try{await loadAdminMembers()}catch(err){console.error("Operadores:",err)}
  }
  renderAll();
  await Promise.all([loadFinanceData(),loadTermDocuments()]);
}
window.addEventListener("taskforce:auth-ready",e=>loadTeamData(e.detail));
if(window.TASKFORCE_AUTH?.state?.membership)loadTeamData(window.TASKFORCE_AUTH.state);
translate();