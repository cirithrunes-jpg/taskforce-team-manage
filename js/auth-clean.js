(()=>{
const C=window.TASKFORCE_CONFIG||{};
const gateId="authGate";

function h(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function gate(){
  let g=document.getElementById(gateId);
  if(!g){g=document.createElement("div");g.id=gateId;g.className="auth-gate show";document.body.appendChild(g)}
  return g;
}
function setGate(html){const g=gate();g.classList.add("show");g.innerHTML=html}
function hideGate(){const g=gate();g.classList.remove("show");g.innerHTML=""}
function status(text,type=""){const e=document.getElementById("authStatus");if(e){e.className="auth-message "+type;e.textContent=text||""}}
function cleanUrl(){
  if(location.hash) history.replaceState({},"",location.pathname+location.search);
}
cleanUrl();

if(!window.supabase||!C.supabaseUrl||!C.supabasePublishableKey){
  setGate('<div class="auth-card"><div class="auth-message error">Configuração do Supabase não encontrada.</div></div>');
  return;
}

const client=window.supabase.createClient(C.supabaseUrl,C.supabasePublishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
});
window.TASKFORCE_DB=client;

const state={session:null,profile:null,membership:null,team:null,group:null};
const inviteToken=new URLSearchParams(location.search).get("invite");

function withTimeout(promise,ms=15000){
  return Promise.race([
    promise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error("Tempo de conexão excedido. Tente novamente.")),ms))
  ]);
}
async function rpcAuth(name,body={}){
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
  if(!res.ok){
    const message=data?.message||data?.hint||data?.details||String(data||"Erro no servidor.");
    throw new Error(message);
  }
  return data;
}
function togglePassword(btn,input){
  btn.onclick=()=>{
    const visible=input.type==="text";
    input.type=visible?"password":"text";
    btn.textContent=visible?"Mostrar":"Ocultar";
  };
}

function renderLogin(tab="login"){
  setGate(
    '<div class="auth-card">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>TASKFORCE</strong><small>Acesso seguro</small></div></div>'+
      (inviteToken?'<div class="invite-banner">Este link contém a chave da equipe que convidou você.</div>':'')+
      '<div class="auth-tabs"><button id="tabLogin" class="auth-tab">Entrar</button><button id="tabSignup" class="auth-tab">Criar conta</button></div>'+
      '<div id="authStatus" class="auth-message">Conexão pronta.</div>'+
      '<form id="loginForm" class="auth-form">'+
        '<label>E-mail<input name="email" type="email" autocomplete="email" required></label>'+
        '<label>Senha<div class="password-wrap"><input id="loginPassword" name="password" type="password" autocomplete="current-password" minlength="8" required><button type="button" id="toggleLoginPassword" class="password-toggle">Mostrar</button></div></label>'+
        '<button class="primary" type="submit">Entrar</button>'+
      '</form>'+
      '<form id="signupForm" class="auth-form">'+
        '<label>E-mail<input name="email" type="email" autocomplete="email" required></label>'+
        '<label>Senha<div class="password-wrap"><input id="signupPassword" name="password" type="password" autocomplete="new-password" minlength="8" required><button type="button" id="toggleSignupPassword" class="password-toggle">Mostrar</button></div></label>'+
        '<label>Confirmar senha<div class="password-wrap"><input id="signupPassword2" name="password2" type="password" autocomplete="new-password" minlength="8" required><button type="button" id="toggleSignupPassword2" class="password-toggle">Mostrar</button></div></label>'+
        '<button class="primary" type="submit">Criar conta</button>'+
      '</form>'+
      '<p class="auth-foot">O administrador cria a equipe. Operadores entram por convite e são vinculados automaticamente à equipe correta.</p>'+
    '</div>'
  );

  const loginForm=document.getElementById("loginForm");
  const signupForm=document.getElementById("signupForm");
  const tabLogin=document.getElementById("tabLogin");
  const tabSignup=document.getElementById("tabSignup");

  function switchTab(name){
    const isLogin=name==="login";
    loginForm.classList.toggle("hidden",!isLogin);
    signupForm.classList.toggle("hidden",isLogin);
    tabLogin.classList.toggle("active",isLogin);
    tabSignup.classList.toggle("active",!isLogin);
    status("Conexão pronta.");
  }
  tabLogin.onclick=()=>switchTab("login");
  tabSignup.onclick=()=>switchTab("signup");
  switchTab(tab);

  togglePassword(document.getElementById("toggleLoginPassword"),document.getElementById("loginPassword"));
  togglePassword(document.getElementById("toggleSignupPassword"),document.getElementById("signupPassword"));
  togglePassword(document.getElementById("toggleSignupPassword2"),document.getElementById("signupPassword2"));

  loginForm.onsubmit=async e=>{
    e.preventDefault();
    const button=e.target.querySelector('button[type="submit"]');
    button.disabled=true;
    status("Verificando e-mail e senha...");
    const f=new FormData(e.target);
    try{
      const {data,error}=await withTimeout(client.auth.signInWithPassword({
        email:String(f.get("email")).trim(),
        password:String(f.get("password"))
      }));
      if(error){
        const lower=String(error.message||"").toLowerCase();
        if(lower.includes("invalid login credentials")) throw new Error("E-mail ou senha incorretos.");
        if(lower.includes("email not confirmed")) throw new Error("E-mail ainda não confirmado.");
        throw error;
      }
      if(!data?.session)throw new Error("Login aceito, mas nenhuma sessão foi criada.");
      const persisted=await client.auth.setSession({
        access_token:data.session.access_token,
        refresh_token:data.session.refresh_token
      });
      if(persisted.error)throw persisted.error;
      const activeSession=persisted.data.session||data.session;
      state.session=activeSession;
      status("Senha correta. Login confirmado.","success");
      setTimeout(()=>continueAfterLogin(activeSession),350);
    }catch(err){
      status(err.message||"Falha ao entrar.","error");
      button.disabled=false;
    }
  };

  signupForm.onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    if(f.get("password")!==f.get("password2"))return status("As senhas não conferem.","error");
    const button=e.target.querySelector('button[type="submit"]');
    button.disabled=true;
    status("Criando conta...");
    try{
      const redirectTo=(C.appUrl||location.origin)+(inviteToken?"/?invite="+encodeURIComponent(inviteToken):"");
      const {data,error}=await withTimeout(client.auth.signUp({
        email:String(f.get("email")).trim(),
        password:String(f.get("password")),
        options:{emailRedirectTo:redirectTo}
      }));
      if(error)throw error;
      if(data?.session){
        state.session=data.session;
        status("Conta criada e login confirmado.","success");
        setTimeout(()=>continueAfterLogin(data.session),350);
      }else{
        status("Conta criada. Confirme o e-mail e depois use a aba Entrar.","success");
        button.disabled=false;
      }
    }catch(err){
      status(err.message||"Falha ao criar conta.","error");
      button.disabled=false;
    }
  };
}

function renderProfileForm(user,existing={}){
  setGate(
    '<div class="auth-card auth-wide">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Complete seu cadastro</strong><small>Identificação e emergência</small></div></div>'+
      '<div id="authStatus" class="auth-message">Preencha os campos obrigatórios.</div>'+
      '<form id="profileForm" class="form-grid auth-profile">'+
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
        '<label class="wide consent"><input type="checkbox" name="privacy_ack" required><span>Confirmo que as informações fornecidas são verdadeiras e autorizo seu uso pela equipe para gestão e segurança.</span></label>'+
        '<div class="wide modal-actions"><button type="submit" class="primary">Salvar cadastro</button><button type="button" id="logoutProfile" class="ghost">Sair</button></div>'+
      '</form>'+
    '</div>'
  );
  const form=document.getElementById("profileForm");
  form.elements.email.value=user.email||"";
  Object.entries(existing||{}).forEach(([k,v])=>{if(form.elements[k]&&k!=="email"&&v!=null)form.elements[k].value=v});
  if(existing?.privacy_ack)form.elements.privacy_ack.checked=true;

  document.getElementById("logoutProfile").onclick=logout;
  form.onsubmit=async e=>{
    e.preventDefault();
    status("Salvando cadastro...");
    const f=new FormData(form);
    const payload={
      user_id:user.id,
      name:String(f.get("name")).trim(),
      email:user.email||String(f.get("email")).trim(),
      phone:String(f.get("phone")).trim(),
      address:String(f.get("address")).trim(),
      emergency:String(f.get("emergency")).trim(),
      emergencyPhone:String(f.get("emergencyPhone")).trim(),
      relationship:String(f.get("relationship")).trim(),
      callsign:String(f.get("callsign")||"").trim(),
      role:String(f.get("role")||"").trim(),
      blood:String(f.get("blood")||"").trim(),
      allergy:String(f.get("allergy")||"").trim(),
      health:String(f.get("health")||"").trim(),
      privacy_ack:true
    };
    try{
      const raw=await withTimeout(rpcAuth("save_my_profile",{payload}));
      const saved=Array.isArray(raw)?(raw[0]||payload):(raw||payload);
      state.profile=saved;
      status("Cadastro salvo. Agora vamos criar sua equipe.","success");
      await continueAfterProfile();
    }catch(err){status(err.message||"Não foi possível salvar.","error")}
  };
}

async function loadMembership(){
  const data=await withTimeout(rpcAuth("get_my_team_context"));
  const ctx=data||null;
  state.membership=ctx?.membership||null;
  state.team=ctx?.team||null;
  state.group=ctx?.group||null;
}

async function acceptInvite(){
  if(!inviteToken)return false;
  await withTimeout(rpcAuth("accept_invitation",{invite_token:inviteToken}));
  const u=new URL(location.href);u.searchParams.delete("invite");history.replaceState({},"",u.pathname+u.search);
  return true;
}

function renderCreateTeam(){
  setGate(
    '<div class="auth-card">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Crie sua equipe</strong><small>Você será o administrador</small></div></div>'+
      '<div id="authStatus" class="auth-message">Informe o nome da equipe.</div>'+
      '<form id="createTeamForm" class="auth-form"><label>Nome da equipe<input name="team" required minlength="2" maxlength="160"></label><button class="primary" type="submit">Criar equipe</button><button class="ghost" type="button" id="logoutNoTeam">Sair</button></form>'+
    '</div>'
  );
  document.getElementById("logoutNoTeam").onclick=logout;
  document.getElementById("createTeamForm").onsubmit=async e=>{
    e.preventDefault();status("Criando equipe...");
    const f=new FormData(e.target);
    try{
      await withTimeout(rpcAuth("create_team_v2",{team_name:String(f.get("team")).trim()}));
      status("Equipe criada. Carregando painel...","success");
      await loadMembership();
      await finishLogin();
    }catch(err){status(err.message||"Não foi possível criar a equipe.","error")}
  };
}

async function continueAfterLogin(session){
  state.session=session;
  status("Login confirmado. Verificando cadastro...");
  try{
    const raw=await withTimeout(rpcAuth("get_my_profile"));
    const profile=Array.isArray(raw)?(raw[0]||null):raw;
    const hasProfile=!!(
      profile &&
      typeof profile==="object" &&
      profile.user_id &&
      profile.name &&
      profile.email
    );
    state.profile=hasProfile?profile:null;
    if(!state.profile){
      renderProfileForm(session.user);
      return;
    }
    await continueAfterProfile();
  }catch(err){
    setGate('<div class="auth-card"><div class="auth-message error">'+h(err.message||"Erro ao carregar cadastro.")+'</div><button id="retryAuth" class="primary">Tentar novamente</button><button id="logoutAuth" class="ghost">Sair</button></div>');
    document.getElementById("retryAuth").onclick=()=>continueAfterLogin(session);
    document.getElementById("logoutAuth").onclick=logout;
  }
}

async function continueAfterProfile(){
  try{
    if(inviteToken)await acceptInvite();
    await loadMembership();
    if(!state.membership){renderCreateTeam();return}
    await finishLogin();
  }catch(err){
    setGate('<div class="auth-card"><div class="auth-message error">'+h(err.message||"Erro ao entrar na equipe.")+'</div><button id="retryMembership" class="primary">Tentar novamente</button><button id="logoutMembership" class="ghost">Sair</button></div>');
    document.getElementById("retryMembership").onclick=continueAfterProfile;
    document.getElementById("logoutMembership").onclick=logout;
  }
}

function applyPermissions(){
  const role=state.membership?.role||"operator";
  document.body.dataset.role=role;
  document.querySelectorAll('.nav-item[data-view="operators"],.nav-item[data-view="finance"],.nav-item[data-view="settings"]').forEach(el=>el.hidden=role!=="admin");
  ["addGame","quickGame","addField","quickField"].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=role!=="admin"});
}

function injectSessionTools(){
  const top=document.querySelector(".topbar");
  if(!top||document.getElementById("sessionTools"))return;
  const tools=document.createElement("div");
  tools.id="sessionTools";tools.className="session-tools";
  tools.innerHTML='<button class="ghost small" id="myProfileBtn">Meu perfil</button><button class="ghost small" id="signOutBtn">Sair</button>';
  top.insertBefore(tools,top.querySelector(".status-chip"));
  document.getElementById("myProfileBtn").onclick=()=>renderProfileForm(state.session.user,state.profile||{});
  document.getElementById("signOutBtn").onclick=logout;
}

async function injectAdminInvite(){
  if(state.membership?.role!=="admin")return;
  const settings=document.querySelector("#view-settings .settings-grid");
  if(!settings||document.getElementById("invitePanel"))return;
  const panel=document.createElement("article");
  panel.className="panel";panel.id="invitePanel";
  panel.innerHTML='<h3>Convidar operadores</h3><p>O link é a chave da equipe. Quem entrar por ele será vinculado automaticamente a <strong>'+h(state.team?.name||"esta equipe")+'</strong>.</p><button class="primary" id="newInviteBtn">Gerar convite</button><div id="inviteResult" class="invite-result"></div>';
  settings.prepend(panel);
  document.getElementById("newInviteBtn").onclick=async()=>{
    const out=document.getElementById("inviteResult");
    const {data:groups,error}=await client.from("team_groups").select("id,name").eq("team_id",state.membership.team_id).order("name");
    if(error){out.textContent=error.message;return}
    out.innerHTML='<div class="invite-form"><label>E-mail do operador<input id="inviteEmail" type="email" placeholder="operador@email.com"></label><label>Grupo<select id="inviteGroup">'+(groups||[]).map(g=>'<option value="'+g.id+'">'+h(g.name)+'</option>').join("")+'</select></label><button class="primary" id="createInviteNow">Criar link</button></div>';
    document.getElementById("createInviteNow").onclick=async()=>{
      const email=document.getElementById("inviteEmail").value.trim()||null;
      const group=document.getElementById("inviteGroup").value;
      const {data:token,error}=await client.rpc("create_invitation",{target_team:state.membership.team_id,target_group:group,recipient_email:email,use_limit:1});
      if(error){out.innerHTML='<div class="auth-message error">'+h(error.message)+'</div>';return}
      const link=(C.appUrl||location.origin)+"/?invite="+encodeURIComponent(token);
      out.innerHTML='<div class="invite-ready"><strong>Convite criado</strong><input id="inviteLink" readonly value="'+h(link)+'"><div class="invite-actions"><button class="ghost" id="copyInvite">Copiar link</button><a class="ghost" target="_blank" rel="noopener" href="https://wa.me/?text='+encodeURIComponent("Convite TASKFORCE: "+link)+'">WhatsApp</a><a class="ghost" href="mailto:'+(email?encodeURIComponent(email):"")+'?subject='+encodeURIComponent("Convite TASKFORCE")+'&body='+encodeURIComponent("Use este link para entrar na equipe: "+link)+'">E-mail</a></div></div>';
      document.getElementById("copyInvite").onclick=async()=>{await navigator.clipboard.writeText(link);document.getElementById("copyInvite").textContent="Copiado!"};
    };
  };
}

async function finishLogin(){
  hideGate();
  injectSessionTools();
  applyPermissions();
  await injectAdminInvite();
  window.dispatchEvent(new CustomEvent("taskforce:auth-ready",{detail:{...state}}));
}

async function logout(){
  try{await client.auth.signOut()}catch{}
  state.session=null;state.profile=null;state.membership=null;state.team=null;state.group=null;
  location.replace(location.pathname);
}

async function start(){
  setGate('<div class="auth-card"><div class="auth-message">Verificando sessão...</div></div>');
  try{
    const {data,error}=await withTimeout(client.auth.getSession(),10000);
    if(error)throw error;
    if(data?.session){await continueAfterLogin(data.session);return}
    renderLogin();
  }catch{
    renderLogin();
    status("Não foi possível recuperar uma sessão anterior. Faça login normalmente.","error");
  }
}

window.TASKFORCE_AUTH={client,state,start,logout};
start();
})();