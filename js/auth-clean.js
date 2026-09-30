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
const initialUrl=new URL(location.href);
const initialHash=new URLSearchParams(initialUrl.hash.replace(/^#/,""));
const recoveryRequested=initialUrl.searchParams.get("recovery")==="1"||initialHash.get("type")==="recovery";
function cleanUrl(){
  if(location.hash&&!recoveryRequested) history.replaceState({},"",location.pathname+location.search);
}
function clearRecoveryUrl(){
  history.replaceState({},"",location.pathname);
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

const state={session:null,profile:null,membership:null,team:null,group:null,access_revoked:false,revoked_at:null,termAcceptance:null};
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
        '<button class="auth-link" type="button" id="forgotPasswordBtn">Esqueci minha senha</button>'+
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
  document.getElementById("forgotPasswordBtn").onclick=()=>{
    const email=String(loginForm.elements.email?.value||"").trim();
    renderForgotPassword(email);
  };
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

function renderForgotPassword(prefill=""){
  setGate(
    '<div class="auth-card">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Recuperar senha</strong><small>Receba um link seguro por e-mail</small></div></div>'+
      '<div id="authStatus" class="auth-message">Informe o e-mail usado no TASKFORCE.</div>'+
      '<form id="forgotPasswordForm" class="auth-form">'+
        '<label>E-mail<input name="email" type="email" autocomplete="email" value="'+h(prefill)+'" required></label>'+
        '<button class="primary" type="submit">Enviar link de recuperação</button>'+
        '<button class="ghost" type="button" id="backToLogin">Voltar ao login</button>'+
      '</form>'+
      '<p class="auth-foot">Se existir uma conta para esse e-mail, enviaremos as instruções de recuperação.</p>'+
    '</div>'
  );
  document.getElementById("backToLogin").onclick=()=>renderLogin("login");
  document.getElementById("forgotPasswordForm").onsubmit=async e=>{
    e.preventDefault();
    const button=e.target.querySelector('button[type="submit"]');
    const email=String(new FormData(e.target).get("email")||"").trim();
    button.disabled=true;
    status("Enviando link...");
    try{
      const redirectTo=(C.appUrl||location.origin)+"/?recovery=1";
      const {error}=await withTimeout(client.auth.resetPasswordForEmail(email,{redirectTo}));
      if(error)throw error;
      status("Se houver uma conta para este e-mail, o link de recuperação foi enviado. Verifique também a caixa de spam.","success");
    }catch(err){
      status(err.message||"Não foi possível enviar o link de recuperação.","error");
    }finally{
      button.disabled=false;
    }
  };
}

function renderRecoveryExpired(){
  setGate(
    '<div class="auth-card">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Link inválido ou expirado</strong><small>Recuperação de senha</small></div></div>'+
      '<div class="auth-message error">Não foi possível validar este link de recuperação.</div>'+
      '<button class="primary" type="button" id="requestNewRecovery">Solicitar novo link</button>'+
      '<button class="ghost" type="button" id="recoveryBackLogin">Voltar ao login</button>'+
    '</div>'
  );
  document.getElementById("requestNewRecovery").onclick=()=>renderForgotPassword();
  document.getElementById("recoveryBackLogin").onclick=()=>{clearRecoveryUrl();renderLogin("login")};
}

function renderPasswordRecovery(){
  setGate(
    '<div class="auth-card">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Nova senha</strong><small>Defina sua nova senha de acesso</small></div></div>'+
      '<div id="authStatus" class="auth-message">Use pelo menos 8 caracteres.</div>'+
      '<form id="recoveryPasswordForm" class="auth-form">'+
        '<label>Nova senha<div class="password-wrap"><input id="recoveryPassword" name="password" type="password" autocomplete="new-password" minlength="8" required><button type="button" id="toggleRecoveryPassword" class="password-toggle">Mostrar</button></div></label>'+
        '<label>Confirmar nova senha<div class="password-wrap"><input id="recoveryPassword2" name="password2" type="password" autocomplete="new-password" minlength="8" required><button type="button" id="toggleRecoveryPassword2" class="password-toggle">Mostrar</button></div></label>'+
        '<button class="primary" type="submit">Salvar nova senha</button>'+
      '</form>'+
    '</div>'
  );
  togglePassword(document.getElementById("toggleRecoveryPassword"),document.getElementById("recoveryPassword"));
  togglePassword(document.getElementById("toggleRecoveryPassword2"),document.getElementById("recoveryPassword2"));
  document.getElementById("recoveryPasswordForm").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const password=String(f.get("password")||"");
    const password2=String(f.get("password2")||"");
    if(password.length<8)return status("A senha precisa ter pelo menos 8 caracteres.","error");
    if(password!==password2)return status("As senhas não conferem.","error");
    const button=e.target.querySelector('button[type="submit"]');
    button.disabled=true;
    status("Atualizando senha...");
    try{
      const {error}=await withTimeout(client.auth.updateUser({password}));
      if(error)throw error;
      status("Senha alterada com sucesso. Voltando ao login...","success");
      await client.auth.signOut();
      state.session=null;
      clearRecoveryUrl();
      setTimeout(()=>{renderLogin("login");status("Senha alterada. Entre com a nova senha.","success")},550);
    }catch(err){
      status(err.message||"Não foi possível alterar a senha.","error");
      button.disabled=false;
    }
  };
}

async function startPasswordRecovery(){
  try{
    const access_token=initialHash.get("access_token");
    const refresh_token=initialHash.get("refresh_token");
    let session=null;
    if(access_token&&refresh_token){
      const {data,error}=await withTimeout(client.auth.setSession({access_token,refresh_token}),10000);
      if(error)throw error;
      session=data?.session||null;
    }else{
      const code=initialUrl.searchParams.get("code");
      if(code){
        const {data,error}=await withTimeout(client.auth.exchangeCodeForSession(code),10000);
        if(error)throw error;
        session=data?.session||null;
      }else{
        const {data,error}=await withTimeout(client.auth.getSession(),10000);
        if(error)throw error;
        session=data?.session||null;
      }
    }
    if(!session){renderRecoveryExpired();return}
    state.session=session;
    renderPasswordRecovery();
  }catch(err){
    console.error("Recuperação de senha:",err);
    renderRecoveryExpired();
  }
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
        '<label><span>Função na equipe</span><select name="role"><option>Assault</option><option>Sniper</option><option>DMR</option><option>Suporte</option><option>Outra</option></select></label>'+
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
  state.access_revoked=!!ctx?.access_revoked;
  state.revoked_at=ctx?.revoked_at||null;
}

async function acceptInvite(){
  if(!inviteToken)return false;
  await withTimeout(rpcAuth("accept_invitation",{invite_token:inviteToken}));
  const u=new URL(location.href);u.searchParams.delete("invite");history.replaceState({},"",u.pathname+u.search);
  return true;
}

function renderRevokedAccess(){
  setGate(
    '<div class="auth-card">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Acesso revogado</strong><small>Vínculo com a equipe encerrado</small></div></div>'+
      '<div class="auth-message error">Seu acesso à equipe <strong>'+h(state.team?.name||"anterior")+'</strong> foi revogado por um administrador.</div>'+
      '<p class="auth-foot">Para voltar a acessar o TASKFORCE por essa equipe, você precisa receber um novo convite de um administrador.</p>'+
      '<button class="ghost" type="button" id="logoutRevoked">Sair</button>'+
    '</div>'
  );
  document.getElementById("logoutRevoked").onclick=logout;
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

const RESPONSIBILITY_TERM={
  version:"2026-09-29-v1",
  title:"Termo de Ciência e Responsabilidade",
  text:[
    "Declaro participar voluntariamente das atividades esportivas de Airsoft promovidas ou acompanhadas pela equipe.",
    "Declaro estar ciente de que a atividade pode envolver esforço físico, deslocamento em terrenos irregulares e participação em locais que podem apresentar obstáculos, estruturas deterioradas ou outras condições próprias do ambiente.",
    "Reconheço que projéteis plásticos utilizados na prática esportiva podem causar dor, marcas ou ferimentos, mesmo com a adoção de medidas de segurança.",
    "Comprometo-me a utilizar os equipamentos de proteção exigidos, seguir as regras da equipe, do local e dos organizadores, informar limitações relevantes à minha participação e interromper a atividade quando entender que minha segurança ou a de terceiros possa estar comprometida.",
    "Declaro ser responsável por avaliar minha aptidão física para participar da atividade e por fornecer informações de emergência corretas quando solicitadas."
  ].join("\n\n")
};

async function ensureOperatorTerm(){
  if(state.membership?.role!=="operator")return true;
  const accepted=await withTimeout(rpcAuth("get_my_term_acceptance"));
  state.termAcceptance=accepted||null;
  if(state.termAcceptance?.term_version===RESPONSIBILITY_TERM.version)return true;
  renderResponsibilityAcceptance();
  return false;
}

function renderResponsibilityAcceptance(){
  const p=state.profile||{};
  setGate(
    '<div class="auth-card auth-wide">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>'+h(RESPONSIBILITY_TERM.title)+'</strong><small>Aceite obrigatório para operadores</small></div></div>'+
      '<div class="detail-grid">'+
        '<div class="detail-item"><small>Nome</small>'+h(p.name||"—")+'</div>'+
        '<div class="detail-item"><small>E-mail</small>'+h(p.email||"—")+'</div>'+
        '<div class="detail-item"><small>Codinome</small>'+h(p.callsign||"—")+'</div>'+
        '<div class="detail-item"><small>Equipe</small>'+h(state.team?.name||"—")+'</div>'+
      '</div>'+
      '<div class="term-text">'+RESPONSIBILITY_TERM.text.split("\n\n").map(x=>'<p>'+h(x)+'</p>').join("")+'</div>'+
      '<div class="legal-note">O aceite será registrado com data e hora, versão do termo e uma cópia dos dados cadastrais informados neste momento. O registro administrativo não substitui orientação jurídica sobre validade ou força probatória.</div>'+
      '<form id="responsibilityAcceptForm" class="auth-form">'+
        '<label class="consent"><input type="checkbox" name="accept" required><span>Li e aceito o Termo de Ciência e Responsabilidade acima.</span></label>'+
        '<button class="primary" type="submit">Aceitar e entrar no aplicativo</button>'+
        '<button class="ghost" type="button" id="logoutTerm">Não aceitar / sair</button>'+
      '</form>'+
      '<div id="authStatus" class="auth-message"></div>'+
    '</div>'
  );
  document.getElementById("logoutTerm").onclick=logout;
  document.getElementById("responsibilityAcceptForm").onsubmit=async e=>{
    e.preventDefault();
    status("Registrando aceite...");
    try{
      state.termAcceptance=await withTimeout(rpcAuth("accept_responsibility_term",{
        supplied_version:RESPONSIBILITY_TERM.version,
        supplied_title:RESPONSIBILITY_TERM.title,
        supplied_text:RESPONSIBILITY_TERM.text
      }));

      let emailNote="";
      try{
        const token=state.session?.access_token;
        const res=await fetch(C.supabaseUrl+"/functions/v1/send-term-acceptance-email",{
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            "apikey":C.supabasePublishableKey,
            "Authorization":"Bearer "+token
          },
          body:JSON.stringify({acceptance_id:state.termAcceptance?.id})
        });
        const data=await res.json().catch(()=>({}));
        if(res.ok){
          emailNote=" Cópia enviada aos administradores por e-mail.";
        }else{
          console.warn("Falha ao enviar e-mail do termo:",data);
          emailNote=" O termo foi arquivado, mas o aviso por e-mail não foi enviado.";
        }
      }catch(err){
        console.warn("Falha ao chamar envio do termo:",err);
        emailNote=" O termo foi arquivado, mas o aviso por e-mail não foi enviado.";
      }

      status("Termo aceito e arquivado."+emailNote,"success");
      setTimeout(()=>finishLogin(),500);
    }catch(err){
      status(err.message||"Não foi possível registrar o aceite.","error");
    }
  };
}

async function continueAfterProfile(){
  try{
    if(inviteToken)await acceptInvite();
    await loadMembership();
    if(state.access_revoked && !state.membership){
      renderRevokedAccess();
      return;
    }
    if(!state.membership){renderCreateTeam();return}
    if(!(await ensureOperatorTerm()))return;
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
  document.querySelectorAll('.nav-item[data-view="operators"],.nav-item[data-view="settings"]').forEach(el=>el.hidden=role!=="admin");
  ["addGame","quickGame","addField","quickField","openTeamModal","openTeamModal2","openTeamModal3","quickOperator"].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=role!=="admin"});
}

function injectSessionTools(){
  const top=document.querySelector(".topbar");
  if(!top||document.getElementById("sessionTools"))return;
  const tools=document.createElement("div");
  tools.id="sessionTools";tools.className="session-tools";
  tools.innerHTML='<button class="ghost small" id="myProfileBtn">Meu perfil</button><button class="ghost small" id="signOutBtn">Sair</button>';
  top.insertBefore(tools,top.querySelector(".status-chip"));
  document.getElementById("myProfileBtn").onclick=()=>{
    if(state.membership?.role==="operator")renderReadOnlyProfile();
    else renderProfileForm(state.session.user,state.profile||{});
  };
  document.getElementById("signOutBtn").onclick=logout;
}

function renderReadOnlyProfile(){
  const p=state.profile||{};
  const rows=[
    ["Nome",p.name],["E-mail",p.email],["Telefone",p.phone],["Endereço",p.address],
    ["Codinome",p.callsign],["Função",p.role],["Tipo sanguíneo",p.blood],
    ["Contato de emergência",p.emergency],["Telefone de emergência",p.emergencyPhone],
    ["Parentesco / relação",p.relationship],["Alergias a medicamentos",p.allergy],
    ["Informações de saúde",p.health]
  ];
  setGate(
    '<div class="auth-card auth-wide">'+
      '<div class="auth-brand"><div class="brand-mark">TF</div><div><strong>Meu perfil</strong><small>Visualização</small></div></div>'+
      '<div class="detail-grid">'+rows.map(r=>'<div class="detail-item"><small>'+h(r[0])+'</small>'+h(r[1]||"—")+'</div>').join("")+'</div>'+
      '<div class="auth-foot">Operadores podem visualizar o cadastro, mas não alterar dados após a conclusão inicial.</div>'+
      '<button class="primary" type="button" id="closeReadOnlyProfile">Voltar</button>'+
    '</div>'
  );
  document.getElementById("closeReadOnlyProfile").onclick=finishLogin;
}

async function injectAdminInvite(){
  if(state.membership?.role!=="admin")return;
  const settings=document.querySelector("#view-settings .settings-grid");
  if(!settings||document.getElementById("invitePanel"))return;
  const panel=document.createElement("article");
  panel.className="panel";panel.id="invitePanel";
  panel.innerHTML=
    '<h3>Convidar membro</h3>'+
    '<p>Escolha o nível de acesso antes de gerar o link. O vínculo é definido no servidor e não pode ser alterado pelo convidado.</p>'+
    '<button class="primary" id="newInviteBtn">Gerar convite</button>'+
    '<div id="inviteResult" class="invite-result"></div>';
  settings.prepend(panel);

  document.getElementById("newInviteBtn").onclick=async()=>{
    const out=document.getElementById("inviteResult");
    const {data:groups,error}=await client.from("team_groups").select("id,name").eq("team_id",state.membership.team_id).order("name");
    if(error){out.textContent=error.message;return}

    out.innerHTML=
      '<div class="invite-form">'+
        '<label>Tipo de convite<select id="inviteRole"><option value="operator">Operador — acesso limitado</option><option value="admin">Administrador — acesso completo</option></select></label>'+
        '<label>E-mail do convidado<input id="inviteEmail" type="email" placeholder="usuario@email.com"></label>'+
        '<label>Grupo<select id="inviteGroup">'+(groups||[]).map(g=>'<option value="'+g.id+'">'+h(g.name)+'</option>').join("")+'</select></label>'+
        '<button class="primary" id="createInviteNow">Criar link</button>'+
      '</div>'+
      '<div id="inviteRoleWarning" class="auth-message"></div>';

    const roleSel=document.getElementById("inviteRole");
    const warning=document.getElementById("inviteRoleWarning");
    const refreshWarning=()=>{
      warning.textContent=roleSel.value==="admin"
        ?"Atenção: este convite dará acesso administrativo completo à equipe."
        :"Operador poderá visualizar o app e enviar seus próprios dados/comprovantes, sem alterar configurações da equipe.";
      warning.className="auth-message "+(roleSel.value==="admin"?"error":"");
    };
    roleSel.onchange=refreshWarning;refreshWarning();

    document.getElementById("createInviteNow").onclick=async()=>{
      const email=document.getElementById("inviteEmail").value.trim()||null;
      const group=document.getElementById("inviteGroup").value;
      const role=roleSel.value;

      if(role==="admin"&&!confirm("Este usuário terá acesso completo como administrador. Deseja continuar?"))return;

      try{
        const token=await rpcAuth("create_invitation",{
          target_team:state.membership.team_id,
          target_group:group,
          recipient_email:email,
          use_limit:1,
          target_role:role
        });
        const link=(C.appUrl||location.origin)+"/?invite="+encodeURIComponent(token);
        const label=role==="admin"?"Administrador":"Operador";
        out.innerHTML=
          '<div class="invite-ready">'+
            '<strong>Convite de '+label+' criado</strong>'+
            '<input id="inviteLink" readonly value="'+h(link)+'">'+
            '<div class="invite-actions">'+
              '<button class="ghost" id="copyInvite">Copiar link</button>'+
              '<a class="ghost" target="_blank" rel="noopener" href="https://wa.me/?text='+encodeURIComponent("Convite TASKFORCE ("+label+"): "+link)+'">WhatsApp</a>'+
              '<a class="ghost" href="mailto:'+(email?encodeURIComponent(email):"")+'?subject='+encodeURIComponent("Convite TASKFORCE - "+label)+'&body='+encodeURIComponent("Use este link para entrar na equipe como "+label+": "+link)+'">E-mail</a>'+
            '</div>'+
          '</div>';
        document.getElementById("copyInvite").onclick=async()=>{
          await navigator.clipboard.writeText(link);
          document.getElementById("copyInvite").textContent="Copiado!";
        };
      }catch(err){
        out.innerHTML='<div class="auth-message error">'+h(err.message||"Não foi possível criar o convite.")+'</div>';
      }
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
  state.session=null;state.profile=null;state.membership=null;state.team=null;state.group=null;state.termAcceptance=null;
  location.replace(location.pathname);
}

async function start(){
  if(recoveryRequested){await startPasswordRecovery();return}
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