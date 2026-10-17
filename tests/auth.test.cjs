// Dependency-free flow tests. SDK/network and DOM are doubles, not delivery tests.
// Run: node --test tests/auth.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/auth-clean.js'),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const session={access_token:'access-test',refresh_token:'refresh-test',user:{id:'user-test',email:'test@example.invalid'}};

async function boot(url='https://app.example/',{google=false,callbackError=false,existing=null,signupSession=null}={}){
  const elements=new Map(),calls=[];
  class Element{
    constructor(id){this.id=id;const classes=new Set();this.classList={add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v),toggle(v,on){if(on??!classes.has(v))classes.add(v);else classes.delete(v)}};this.elements={};this.hidden=false;this.disabled=false;this._html='';}
    set innerHTML(html){
      this._html=html;
      for(const match of html.matchAll(/\bid="([^"]+)"/g))elements.set(match[1],new Element(match[1]));
      for(const form of html.matchAll(/<form id="([^"]+)"[^>]*>(.*?)<\/form>/gs)){
        for(const input of form[2].matchAll(/\bname="([^"]+)"/g))elements.get(form[1]).elements[input[1]]={value:''};
      }
    }
    get innerHTML(){return this._html}
    querySelector(){return this.button||(this.button=new Element('submit'))}
    appendChild(el){elements.set(el.id,el)}
  }
  const document={getElementById:id=>elements.get(id)||null,createElement:()=>new Element(),body:new Element('body')};
  const location=new URL(url);
  const history={replaceState(_state,_title,value){location.href=new URL(value,location).href}};
  let active=existing,listener;
  const result=data=>Promise.resolve({data,error:null});
  const auth={
    getSession:()=>{calls.push(['getSession']);return result({session:active})},
    setSession:tokens=>{calls.push(['setSession',tokens]);active=session;return callbackError?Promise.resolve({error:{message:'Expired link'}}):result({session})},
    exchangeCodeForSession:code=>{calls.push(['exchange',code]);active=session;return result({session})},
    signInWithOAuth:options=>{calls.push(['oauth',options]);return result({})},
    signInWithPassword:options=>{calls.push(['password',options]);active=session;return result({session})},
    signUp:options=>{calls.push(['signup',options]);return result({session:signupSession})},
    resend:options=>{calls.push(['resend',options]);return result({})},
    resetPasswordForEmail:(email,options)=>{calls.push(['reset',email,options]);return result({})},
    updateUser:options=>{calls.push(['update',options]);return result({user:session.user})},
    signOut:()=>{calls.push(['signOut']);active=null;return result({})},
    onAuthStateChange:callback=>{listener=callback}
  };
  const window={TASKFORCE_CONFIG:{supabaseUrl:'https://db.example',supabasePublishableKey:'public-test',appUrl:'https://app.example'},supabase:{createClient:()=>({auth})}};
  const context={window,document,location,history,URL,URLSearchParams,AbortSignal,console,
    FormData:class{constructor(form){this.values=form.values}get(key){return this.values[key]}},
    setTimeout:(fn,ms)=>setTimeout(fn,ms===350||ms===550?0:ms),clearTimeout,
    fetch:async(url,options)=>{
      calls.push(['fetch',url,options]);
      if(url.endsWith('/settings'))return {ok:true,json:async()=>({external:{google}})};
      return {ok:true,text:async()=>'null'};
    }
  };
  vm.runInNewContext(source,context);
  await tick();
  async function submit(id,values){
    const form=elements.get(id);assert.ok(form,`Missing form ${id}`);form.values=values;
    await form.onsubmit({preventDefault(){},target:form});await tick();
  }
  return {elements,calls,location,window,submit,emit:(event,value)=>listener(event,value),html:()=>elements.get('authGate').innerHTML};
}

test('confirmation callback consumes tokens before removing them, preserving invitation',async()=>{
  const b=await boot('https://app.example/?invite=invite-test#access_token=access-test&refresh_token=refresh-test&type=signup');
  assert.ok(b.calls.some(c=>c[0]==='setSession'));
  assert.equal(b.location.hash,'');assert.equal(b.location.search,'?invite=invite-test');
  assert.equal(b.window.TASKFORCE_AUTH.state.session.access_token,'access-test');
  assert.match(b.html(),/profileForm/);
});
test('Google code callback exchanges code and removes callback parameters',async()=>{
  const b=await boot('https://app.example/?invite=invite-test&code=code-test');
  assert.ok(b.calls.some(c=>c[0]==='exchange'&&c[1]==='code-test'));
  assert.equal(b.location.search,'?invite=invite-test');assert.match(b.html(),/profileForm/);
});
test('expired callback is shown as error and never falls back to an existing session',async()=>{
  const b=await boot('https://app.example/#access_token=bad&refresh_token=bad',{callbackError:true,existing:session});
  assert.equal(b.elements.get('authStatus').textContent,'Expired link');
  assert.ok(!b.calls.some(c=>c[0]==='getSession'));assert.equal(b.location.hash,'');
});
test('OAuth denial is visible and URL is sanitized',async()=>{
  const b=await boot('https://app.example/?error=access_denied&error_description=secret');
  assert.match(b.elements.get('authStatus').textContent,/cancelada/);assert.equal(b.location.search,'');
});
test('password recovery requires a valid callback, not a preexisting ordinary session',async()=>{
  const b=await boot('https://app.example/?recovery=1',{existing:session});
  assert.match(b.html(),/Link inválido ou expirado/);assert.ok(!b.calls.some(c=>c[0]==='getSession'));
});
test('valid recovery updates password and signs out',async()=>{
  const b=await boot('https://app.example/?recovery=1#type=recovery&access_token=access-test&refresh_token=refresh-test');
  assert.match(b.html(),/recoveryPasswordForm/);
  await b.submit('recoveryPasswordForm',{password:'new-password',password2:'new-password'});
  assert.ok(b.calls.some(c=>c[0]==='update'));assert.ok(b.calls.some(c=>c[0]==='signOut'));
  assert.match(b.elements.get('authStatus').textContent,/Senha alterada/);assert.equal(b.location.search,'');
});
test('Google button respects provider configuration and preserves invitation redirect',async()=>{
  const disabled=await boot();assert.equal(disabled.elements.get('googleLoginBtn').hidden,true);
  const b=await boot('https://app.example/?invite=invite-test',{google:true});
  const button=b.elements.get('googleLoginBtn');assert.equal(button.hidden,false);assert.equal(button.disabled,false);
  await button.onclick();const options=b.calls.find(c=>c[0]==='oauth')[1];
  assert.equal(options.provider,'google');assert.equal(options.options.redirectTo,'https://app.example/?invite=invite-test');
});
test('signup without session leads to confirmation and permits resend with original invitation',async()=>{
  const b=await boot('https://app.example/?invite=invite-test');
  await b.submit('signupForm',{email:'test@example.invalid',password:'valid-password',password2:'valid-password'});
  assert.match(b.html(),/resendForm/);
  await b.submit('resendForm',{email:'test@example.invalid'});
  const options=b.calls.find(c=>c[0]==='resend')[1];
  assert.equal(options.type,'signup');assert.equal(options.options.emailRedirectTo,'https://app.example/?invite=invite-test');
});
test('password mismatch does not send a signup request',async()=>{
  const b=await boot();await b.submit('signupForm',{email:'test@example.invalid',password:'password1',password2:'password2'});
  assert.ok(!b.calls.some(c=>c[0]==='signup'));assert.match(b.elements.get('authStatus').textContent,/não conferem/);
});
test('password login does not redundantly set the same session',async()=>{
  const b=await boot();await b.submit('loginForm',{email:'test@example.invalid',password:'valid-password'});
  assert.ok(b.calls.some(c=>c[0]==='password'));assert.ok(!b.calls.some(c=>c[0]==='setSession'));assert.match(b.html(),/profileForm/);
});
test('recovery request preserves invitation and uses recovery URL',async()=>{
  const b=await boot('https://app.example/?invite=invite-test');b.elements.get('forgotPasswordBtn').onclick();
  await b.submit('forgotPasswordForm',{email:'test@example.invalid'});
  assert.equal(b.calls.find(c=>c[0]==='reset')[2].redirectTo,'https://app.example/?invite=invite-test&recovery=1');
});
test('refreshed session is used by authenticated REST calls',async()=>{
  const b=await boot();b.emit('TOKEN_REFRESHED',{...session,access_token:'new-token'});
  assert.equal(b.window.TASKFORCE_AUTH.state.session.access_token,'new-token');
});
test('finishing password recovery preserves a pending team invitation',async()=>{
  const b=await boot('https://app.example/?invite=invite-test&recovery=1#type=recovery&access_token=access-test&refresh_token=refresh-test');
  await b.submit('recoveryPasswordForm',{password:'new-password',password2:'new-password'});
  assert.equal(b.location.search,'?invite=invite-test');
});
test('all dialogs receive Escape handlers, close buttons and backdrop close work',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const fn=app.slice(app.indexOf('function installDialogSafety(){'),app.indexOf('installDialogSafety();'));
  const dialogs=[0,1,2].map(()=>({handlers:{},addEventListener(name,fn){this.handlers[name]=fn},close(value){this.closed=value}}));
  let click;
  vm.runInNewContext(fn+'installDialogSafety();',{$$:()=>dialogs,document:{addEventListener(name,fn){click=fn}}});
  dialogs.forEach(d=>{d.handlers.cancel({preventDefault(){}});assert.equal(d.closed,'cancel')});
  const closeButton={closest:()=>dialogs[0]};
  click({target:{closest:()=>closeButton},preventDefault(){},stopPropagation(){}});
  assert.equal(dialogs[0].closed,'cancel');
  dialogs[1].closest=selector=>selector==='dialog'?dialogs[1]:null;
  click({target:dialogs[1]});assert.equal(dialogs[1].closed,'cancel');
});


test('Google is primary and email form expands with password recovery available',async()=>{
  const b=await boot('https://app.example/',{google:true});
  assert.equal(b.elements.get('emailAccessPanel').classList.contains('hidden'),true);
  b.elements.get('emailAccessBtn').onclick();
  assert.equal(b.elements.get('emailAccessPanel').classList.contains('hidden'),false);
  b.elements.get('forgotPasswordBtn').onclick();assert.match(b.html(),/forgotPasswordForm/);
});
test('confirmation screen provides a direct route to password recovery',async()=>{
  const b=await boot();b.elements.get('resendConfirmationBtn').onclick();
  b.elements.get('resendForm').elements.email.value='test@example.invalid';
  b.elements.get('resendForgotPassword').onclick();
  assert.match(b.html(),/forgotPasswordForm/);assert.match(b.html(),/test@example.invalid/);
});
test('recovery rejects mismatched passwords without updating the account',async()=>{
  const b=await boot('https://app.example/?recovery=1#type=recovery&access_token=access-test&refresh_token=refresh-test');
  await b.submit('recoveryPasswordForm',{password:'new-password',password2:'different-password'});
  assert.ok(!b.calls.some(c=>c[0]==='update'));assert.match(b.elements.get('authStatus').textContent,/não conferem/);
});
