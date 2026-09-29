(()=>{
const C=window.TASKFORCE_CONFIG||{};
if(!window.supabase||!C.supabaseUrl||!C.supabasePublishableKey){console.error("Supabase client not configured");return;}
if(location.hash.includes("error=")){
  history.replaceState({},"",location.pathname+location.search);
}
const client=window.supabase.createClient(C.supabaseUrl,C.supabasePublishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
});
window.TASKFORCE_DB=client;

const state={session:null,profile:null,membership:null,team:null,group:null};
const inviteToken=new URLSearchParams(location.search).get("invite");

function el(tag,attrs={},html=""){const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>k==="class"?n.className=v:n.setAttribute(k,v));if(html)n.innerHTML=html;return n}
function gate(){let g=document.getElementById("authGate");if(!g){g=el("div",{id:"authGate",class:"auth-gate"});document.body.appendChild(g)}return g}
function msg(text,type=""){const m=document.getElementById("authMessage");if(m){m.className="auth-message "+type;m.textContent=text||""}}
function cleanInviteUrl(){if(!inviteToken)return;const u=new URL(location.href);u.searchParams.delete("invite");history.replaceState({},"",u.pathname+u.search+u.hash)}
function currentAppUrl(){return C.appUrl||location.origin}

function renderLogin(){
  const g=gate();g.classList.add("show");
  g.innerHTML='<div class="auth-card"><div class="auth-brand"><div class="brand-mark">TF</div><div><strong>TASKFORCE</strong><small>Team Manager</small></div></div>'+
  (inviteToken?'<div class="invite-banner">Você recebeu um convite para entrar em uma equipe. Crie sua conta ou entre com o e-mail convidado.</div>':'')+
  '<div class="auth-tabs"><button class="auth-tab active" data-tab="login">Entrar</button><button class="auth-tab" data-tab="signup">Criar conta</button></div>'+
  '<div id="authMessage" class="auth-message"></div>'+
  '<form id="loginForm" class="auth-form"><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><button class="primary" type="submit">Entrar</button></form>'+
  '<form id="signupForm" class="auth-form hidden"><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Senha<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirmar senha<input name="password2" type="password" autocomplete="new-password" minlength="8" required></label><button class="primary" type="submit">Criar conta</button></form>'+
  '<p class="auth-foot">O acesso à equipe é definido pelo convite. Um operador não escolhe nem altera sua própria equipe.</p></div>';

  g.querySelectorAll(".auth-tab").forEach(b=>b.onclick=()=>{
    g.querySelectorAll(".auth-tab").forEach(x=>x.classList.toggle("active",x===b));
    document.getElementById("loginForm").classList.toggle("hidden",b.dataset.tab!=="login");
    document.getElementById("signupForm").classList.toggle("hidden",b.dataset.tab!=="signup");
    msg("");
  });
  document.getElementById("loginForm").onsubmit=async e=>{
    e.preventDefault();
    const button=e.target.querySelector('button[type="submit"]');
    button.disabled=true;
    msg("Entrando...");
    const f=new FormData(e.target);
    try{
      const loginPromise=client.auth.signInWithPassword({
        email:f.get("email").trim(),
        password:f.get("password")
      });
      const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("A conexão demorou demais. Tente novamente.")),15000));
      const {data,error}=await Promise.race([loginPromise,timeout]);
      if(error)throw error;
      if(!data?.session)throw new Error("O login foi aceito, mas a sessão não foi criada.");
      msg("Login realizado. Abrindo cadastro...","success");
      setTimeout(()=>location.replace(location.pathname),150);
    }catch(err){
      msg(err.message||"Não foi possível entrar.","error");
      button.disabled=false;
    }
  };
  document.getElementById("signupForm").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target);
    if(f.get("password")!==f.get("password2"))return msg("As senhas não conferem.","error");
    msg("Criando conta...");
    const redirectTo=currentAppUrl()+(inviteToken?"/?invite="+encodeURIComponent(inviteToken):"");
    const {data,error}=await client.auth.signUp({email:f.get("email").trim(),password:f.get("password"),options:{emailRedirectTo:redirectTo}});
    if(error)return msg(error.message,"error");
    if(data.session){await bootstrap();} else msg("Conta criada. Confirme seu e-mail e depois entre no aplicativo.","success");
  };
}

function renderProfileForm(user,existing={}){
  const g=gate();g.classList.add("show");
  g.innerHTML='<div class="auth-card auth-wide"><div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Complete seu cadastro</strong><small>Dados obrigatórios de identificação e emergência</small></div></div>'+
  '<div id="authMessage" class="auth-message"></div><form id="profileForm" class="form-grid auth-profile">'+
  '<label><span>Nome completo</span><input name="name" required></label>'+
  '<label><span>E-mail</span><input name="email" type="email" readonly></label>'+
  '<label><span>Telefone</span><input name="phone" required></label>'+
  '<label class="wide"><span>Endereço</span><input name="address" required></label>'+
  '<label><span>Codinome</span><input name="callsign"></label>'+
  '<label><span>Função na equipe</span><select name="role"><option>Assault</option><option>Suporte</option><option>Comunicação</option><option>Observador</option><option>Apoio médico</option><option>Liderança</option><option>Outra</option></select></label>'+
  '<label><span>Tipo sanguíneo</span><select name="blood"><option value="">Não informado</option><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label>'+
  '<label><span>Contato de emergência</span><input name="emergency" required></label>'+
  '<label><span>Telefone de emergência</span><input name="emergencyPhone" required></label>'+
  '<label><span>Parentesco / relação</span><input name="relationship" required></label>'+
  '<label class="wide"><span>Alergias a medicamentos</span><textarea name="allergy" rows="2"></textarea></label>'+
  '<label class="wide"><span>Informações de saúde relevantes em emergência</span><textarea name="health" rows="3"></textarea></label>'+
  '<label class="wide consent"><input type="checkbox" name="privacy_ack" required><span>Confirmo que as informações fornecidas são verdadeiras e autorizo seu uso pela equipe exclusivamente para gestão e segurança, conforme as permissões do aplicativo.</span></label>'+
  '<div class="wide modal-actions"><button type="submit" class="primary">Salvar cadastro e continuar</button><button type="button" id="logoutFromProfile" class="ghost">Sair</button></div></form></div>';
  const form=document.getElementById("profileForm");
  form.elements.email.value=user.email||"";
  Object.entries(existing||{}).forEach(([k,v])=>{if(form.elements[k]&&k!=="email"&&v!=null)form.elements[k].value=v});
  document.getElementById("logoutFromProfile").onclick=()=>client.auth.signOut();
  form.onsubmit=async e=>{
    e.preventDefault();msg("Salvando cadastro...");
    const f=new FormData(form);
    const payload={
      user_id:user.id,name:f.get("name").trim(),email:user.email||f.get("email").trim(),
      phone:f.get("phone").trim(),address:f.get("address").trim(),emergency:f.get("emergency").trim(),
      emergencyPhone:f.get("emergencyPhone").trim(),relationship:f.get("relationship").trim(),
      callsign:(f.get("callsign")||"").trim(),role:(f.get("role")||"").trim(),blood:(f.get("blood")||"").trim(),
      allergy:(f.get("allergy")||"").trim(),health:(f.get("health")||"").trim(),privacy_ack:true
    };
    const {error}=await client.from("profiles").upsert(payload,{onConflict:"user_id"});
    if(error)return msg(error.message,"error");
    await bootstrap();
  };
}

function renderCreateTeam(){
  const g=gate();g.classList.add("show");
  g.innerHTML='<div class="auth-card"><div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Crie sua equipe</strong><small>Você será o administrador desta equipe</small></div></div>'+
  '<div id="authMessage" class="auth-message"></div>'+
  '<form id="createTeamForm" class="auth-form"><label>Nome da equipe<input name="team" required minlength="2" maxlength="160"></label><button class="primary" type="submit">Criar equipe</button><button class="ghost" type="button" id="logoutNoTeam">Sair</button></form>'+
  '<p class="auth-foot">Se você recebeu um convite, use o link do convite. Ele é a chave que conecta sua conta à equipe correta.</p></div>';
  document.getElementById("logoutNoTeam").onclick=()=>client.auth.signOut();
  document.getElementById("createTeamForm").onsubmit=async e=>{
    e.preventDefault();msg("Criando equipe...");
    const f=new FormData(e.target);
    const {error}=await client.rpc("create_team",{team_name:f.get("team").trim()});
    if(error){
      const txt=/Confirm your email/i.test(error.message)?"Confirme seu e-mail antes de criar a equipe.":error.message;
      return msg(txt,"error");
    }
    await bootstrap();
  };
}

async function loadMembership(){
  const {data,error}=await client.from("team_members").select("team_id,user_id,group_id,role,teams(id,name,data),team_groups(id,name)").eq("user_id",state.session.user.id).limit(1).maybeSingle();
  if(error)throw error;
  state.membership=data||null;
  state.team=data?.teams||null;
  state.group=data?.team_groups||null;
}
async function acceptInviteIfNeeded(){
  if(!inviteToken||!state.session)return;
  const {error}=await client.rpc("accept_invitation",{invite_token:inviteToken});
  if(error){
    if(/Complete your profile/i.test(error.message))return;
    if(/Confirm your email/i.test(error.message))throw new Error("Confirme seu e-mail antes de aceitar o convite.");
    throw error;
  }
  cleanInviteUrl();
}
function injectSessionTools(){
  const top=document.querySelector(".topbar");
  if(!top||document.getElementById("sessionTools"))return;
  const tools=document.createElement("div");
  tools.id="sessionTools";tools.className="session-tools";
  tools.innerHTML='<button class="ghost small" id="myProfileBtn">Meu perfil</button><button class="ghost small" id="signOutBtn">Sair</button>';
  top.insertBefore(tools,top.querySelector(".status-chip"));
  document.getElementById("myProfileBtn").onclick=()=>renderProfileForm(state.session.user,state.profile||{});
  document.getElementById("signOutBtn").onclick=()=>client.auth.signOut();
}
function applyRole(){
  const role=state.membership?.role;
  document.body.dataset.role=role||"";
  document.querySelectorAll('[data-admin-only], .nav-item[data-view="operators"], .nav-item[data-view="finance"], .nav-item[data-view="settings"]').forEach(el=>{
    el.hidden=role!=="admin";
  });
  const addGame=document.getElementById("addGame"),quickGame=document.getElementById("quickGame");
  const addField=document.getElementById("addField"),quickField=document.getElementById("quickField");
  [addGame,quickGame,addField,quickField].filter(Boolean).forEach(el=>el.hidden=role!=="admin");
  if(role!=="admin"&&["operators","finance","settings"].some(v=>document.getElementById("view-"+v)?.classList.contains("active"))){
    document.querySelector('.nav-item[data-view="command"]')?.click();
  }
  window.dispatchEvent(new CustomEvent("taskforce:auth-ready",{detail:{...state}}));
}
async function injectAdminTools(){
  if(state.membership?.role!=="admin")return;
  const settings=document.querySelector("#view-settings .settings-grid");if(!settings||document.getElementById("invitePanel"))return;
  const panel=el("article",{class:"panel",id:"invitePanel"});
  panel.innerHTML='<h3>Convidar operadores</h3><p>O convite é a chave da equipe. O operador que usar o link será vinculado automaticamente a <strong id="inviteTeamName"></strong>.</p><button class="primary" id="newInviteBtn">Gerar convite</button><div id="inviteResult" class="invite-result"></div>';
  settings.prepend(panel);
  document.getElementById("inviteTeamName").textContent=state.team?.name||"sua equipe";
  document.getElementById("newInviteBtn").onclick=()=>renderInviteComposer();
}
async function renderInviteComposer(){
  const out=document.getElementById("inviteResult");if(!out)return;
  const {data:groups,error}=await client.from("team_groups").select("id,name").eq("team_id",state.membership.team_id).order("name");
  if(error){out.textContent=error.message;return}
  out.innerHTML='<div class="invite-form"><label>E-mail do operador (recomendado)<input id="inviteEmail" type="email" placeholder="operador@email.com"></label><label>Grupo interno<select id="inviteGroup">'+(groups||[]).map(g=>'<option value="'+g.id+'">'+g.name+'</option>').join("")+'</select></label><button class="primary" id="createInviteNow">Criar link</button></div>';
  document.getElementById("createInviteNow").onclick=async()=>{
    const email=document.getElementById("inviteEmail").value.trim()||null;
    const group=document.getElementById("inviteGroup").value;
    const {data:token,error}=await client.rpc("create_invitation",{target_team:state.membership.team_id,target_group:group,recipient_email:email,use_limit:1});
    if(error){out.innerHTML='<div class="auth-message error">'+escHtml(error.message)+'</div>';return}
    const link=currentAppUrl()+"/?invite="+encodeURIComponent(token);
    out.innerHTML='<div class="invite-ready"><strong>Convite criado</strong><input id="inviteLink" readonly value="'+escAttr(link)+'"><div class="invite-actions"><button class="ghost" id="copyInvite">Copiar link</button><a class="ghost" target="_blank" rel="noopener" href="https://wa.me/?text='+encodeURIComponent("Convite TASKFORCE: "+link)+'">WhatsApp</a><a class="ghost" href="mailto:'+(email?encodeURIComponent(email):"")+'?subject='+encodeURIComponent("Convite para sua equipe no TASKFORCE")+'&body='+encodeURIComponent("Use este link para entrar na equipe: "+link)+'">E-mail</a></div></div>';
    document.getElementById("copyInvite").onclick=async()=>{await navigator.clipboard.writeText(link);document.getElementById("copyInvite").textContent="Copiado!"};
  };
}
function escHtml(v){return String(v||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escAttr(v){return escHtml(v)}

async function bootstrap(sessionOverride=null){
  let session=sessionOverride;
  if(!session){
    const result=await client.auth.getSession();
    session=result.data.session;
  }
  state.session=session;
  if(!session){renderLogin();return}
  const {data:profile,error:pErr}=await client.from("profiles").select("*").eq("user_id",session.user.id).maybeSingle();
  if(pErr){gate().innerHTML='<div class="auth-card"><div class="auth-message error">'+escHtml(pErr.message)+'</div></div>';gate().classList.add("show");return}
  state.profile=profile;
  if(!profile){renderProfileForm(session.user);return}
  try{await acceptInviteIfNeeded()}catch(e){gate().innerHTML='<div class="auth-card"><div class="auth-message error">'+escHtml(e.message)+'</div><button id="backLogin" class="ghost">Voltar</button></div>';gate().classList.add("show");document.getElementById("backLogin").onclick=()=>cleanInviteUrl();return}
  try{await loadMembership()}catch(e){gate().innerHTML='<div class="auth-card"><div class="auth-message error">'+escHtml(e.message)+'</div></div>';gate().classList.add("show");return}
  if(!state.membership){renderCreateTeam();return}
  gate().classList.remove("show");gate().innerHTML="";
  injectSessionTools();applyRole();await injectAdminTools();
}
client.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT")location.replace(location.pathname);});
window.TASKFORCE_AUTH={client,state,bootstrap,signOut:()=>client.auth.signOut()};
bootstrap();
})();