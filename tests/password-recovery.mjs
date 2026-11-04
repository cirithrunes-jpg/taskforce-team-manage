import assert from "node:assert/strict";
import vm from "node:vm";
export async function testRecovery(parseHTML,source){
 const results=[];
 async function setup({expired=false,serverFailure=false,missing=false}={}){
  const {document}=parseHTML('<!doctype html><html><body></body></html>');
  const calls=[],timers=[],session={access_token:"test-access",refresh_token:"test-refresh",user:{id:"test-user"}};
  let sdkUpdates=0;
  const auth={
    setSession:async()=>({data:{session:missing?null:session},error:null}),
    getSession:async()=>({data:{session:null},error:null}),
    updateUser:async()=>{sdkUpdates++;throw new Error("Auth session missing!");},
    signOut:async()=>({error:null})
  };
  class FD{get(name){return name==="password"||name==="password2"?"synthetic-test-password":null;}}
  const window={TASKFORCE_CONFIG:{supabaseUrl:"https://example.supabase.co",supabasePublishableKey:"public-test-key"},supabase:{createClient:()=>({auth})}};
  const location={href:"https://example.test/?recovery=1#access_token=test-access&refresh_token=test-refresh&type=recovery",pathname:"/",search:"?recovery=1",hash:"#access_token=test-access&refresh_token=test-refresh&type=recovery"};
  const ctx=vm.createContext({window,document,location,history:{replaceState(){}},URL,URLSearchParams,AbortController,FormData:FD,console,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},fetch:async(url,options)=>{
   calls.push({url,method:options.method,headers:options.headers,body:options.body});
   const bad=expired?401:serverFailure&&options.method==="PUT"?422:200;
   return{ok:bad===200,status:bad,json:async()=>bad===200?{id:"test-user"}:{msg:"Password must differ from the old password."}};
  }});
  const code=source.replace(/start\(\);\s*\}\)\(\);\s*$/,'window.RECOVERY_TEST={startPasswordRecovery};})();');
  vm.runInContext(code,ctx,{filename:"auth-clean.js"});
  await window.RECOVERY_TEST.startPasswordRecovery();
  return{document,window,calls,timers,getSdkUpdates:()=>sdkUpdates};
 }
 const good=await setup();
 assert.ok(good.document.querySelector("#recoveryPasswordForm"));
 assert.equal(good.calls[0].method,"GET");
 const form=good.document.querySelector("#recoveryPasswordForm");
 await form.onsubmit({preventDefault(){},target:form});
 const save=good.calls.find(c=>c.method==="PUT");
 assert.ok(save);
 assert.equal(save.headers.Authorization,"Bearer test-access");
 assert.equal(JSON.parse(save.body).password,"synthetic-test-password");
 assert.equal(good.getSdkUpdates(),0);
 assert.match(good.document.querySelector("#authStatus").textContent,/alterada com sucesso/);
 results.push("Valid recovery survives missing SDK session and confirms server response");
 const expired=await setup({expired:true});
 assert.equal(expired.document.querySelector("#recoveryPasswordForm"),null);
 assert.ok(expired.document.querySelector("#requestNewRecovery"));
 assert.equal(expired.calls.filter(c=>c.method==="PUT").length,0);
 results.push("Expired bearer never exposes an editable password form");
 const missing=await setup({missing:true});
 assert.equal(missing.document.querySelector("#recoveryPasswordForm"),null);
 assert.equal(missing.calls.length,0);
 results.push("Missing recovery session cannot update a password");
 const failed=await setup({serverFailure:true});
 const failedForm=failed.document.querySelector("#recoveryPasswordForm");
 await failedForm.onsubmit({preventDefault(){},target:failedForm});
 assert.match(failed.document.querySelector("#authStatus").textContent,/Password must differ/);
 assert.equal(failedForm.querySelector('button[type="submit"]').disabled,false);
 results.push("Server rejection is shown and permits retry");
 return results;
}
