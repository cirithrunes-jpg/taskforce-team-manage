import assert from "node:assert/strict";
import vm from "node:vm";
export async function runTests(parseHTML, files) {
  const passed=[];
  const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
  async function setup(mode="admin") {
    const {document,HTMLSelectElement}=parseHTML(files["admin-app/index.html"]);
    Object.defineProperty(HTMLSelectElement.prototype,"value",{configurable:true,get(){return this.querySelector("option[selected]")?.value||this.querySelector("option")?.value||"";},set(v){for(const o of this.querySelectorAll("option"))o.selected=o.value===v;}});
    const dialog=document.querySelector("#editor");dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
    for(const f of document.querySelectorAll("form")){f.reset=()=>{};Object.defineProperty(f,"elements",{get(){const fields={};for(const el of f.querySelectorAll("[name]"))fields[el.name]=el;return fields;}});}
    const state={writes:[],records:[],fees:[],signedOut:false};
    const team={id:"team",name:"Equipe <script>erro()</script>",data:{}};
    const members=[{user_id:"operator-1",member_role:"operator",name:"Operador herdado",callsign:"Ghost"}];
    const makeQuery=(table)=>{
      let op="select",payload,filters={};
      const q={
        select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},range(){return q;},single(){return q;},
        insert(p){op="insert";payload=p;return q;},update(p){op="update";payload=p;return q;},upsert(p){op="upsert";payload=p;return q;},
        then(resolve,reject){try{
          if(mode==="outage"&&table==="team_resources")return Promise.resolve({error:{message:"Failed to fetch"}}).then(resolve,reject);
          let data;
          if(op!=="select"){
            state.writes.push({table,op,payload,filters});
            if(table==="team_operator_records"){const record={id:"new-record",data:payload.data};state.records.push(record);data={id:record.id};}
            else if(table==="team_admin_fees"){
              if(op==="upsert"){const added=payload.filter(row=>!state.fees.some(f=>f.operator_key===row.operator_key&&f.reference_month===row.reference_month));state.fees.push(...added.map((r,i)=>({...r,id:"fee-"+i})));data=added.map((_,i)=>({id:"fee-"+i}));}
              else {state.fees=state.fees.map(f=>f.id===filters.id?{...f,...payload}:f);data={id:filters.id};}
            }else data={id:"saved"};
          }else if(table==="team_members")data=mode==="operator"?[]:[{team_id:"team",role:"admin"}];
          else if(table==="teams")data=team;
          else if(table==="team_operator_records")data=state.records;
          else if(table==="team_resources")data=[{id:"game-1",kind:"game",data:{name:"Treino de domingo",date:"2099-01-01",time:"08:00",place:"Campo A",participants:[]}}];
          else if(table==="team_admin_fees")data=state.fees;
          return Promise.resolve({data,error:null}).then(resolve,reject);
        }catch(e){return Promise.reject(e).then(resolve,reject);}}
      };return q;
    };
    const client={from:makeQuery,rpc:async(name)=>({data:name==="admin_list_members"?members:name==="get_billing_settings"?{monthly_amount:50,due_day:5}:[]}),auth:{
      getSession:async()=>({data:{session:mode==="guest"?null:{user:{id:"admin"}}}}),
      onAuthStateChange(){},
      signOut:async()=>{state.signedOut=true;return{error:null};},
      signInWithPassword:async()=>({error:{message:"Invalid login credentials"}}),
      resetPasswordForEmail:async()=>({data:{},error:null})
    }};
    class FormDataMock{
      constructor(form){this.entries=[];for(const el of form.querySelectorAll("input,select,textarea")){if(!el.name||(el.type==="checkbox"&&!el.checked))continue;this.entries.push([el.name,el.value||""]);}}
      get(k){return this.entries.find(([name])=>name===k)?.[1]??null;}
      getAll(k){return this.entries.filter(([name])=>name===k).map(([,v])=>v);}
      has(k){return this.entries.some(([name])=>name===k);}
    }
    const window={supabase:{createClient:()=>client},addEventListener(){}};
    const ctx=vm.createContext({window,document,navigator:{},FormData:FormDataMock,console,setTimeout:()=>1,clearTimeout(){},Date,Intl,Set,Map});
    for(const name of ["config.js","core.js","app.js"])vm.runInContext(files["admin-app/"+name],ctx,{filename:name});
    await flush();
    const click=async(selector)=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new document.defaultView.Event("click",{bubbles:true}));await flush();};
    return {document,state,click};
  }
  const guest=await setup("guest");
  assert.equal(guest.document.querySelector("#shell").hidden,true);passed.push("Unauthenticated panel hidden");
  const denied=await setup("operator");
  assert.equal(denied.state.signedOut,true);
  assert.equal(denied.document.querySelector("#shell").hidden,true);passed.push("Operator cannot enter admin panel");
  const outage=await setup("outage");
  assert.equal(outage.document.querySelector("#shell").hidden,true);
  assert.match(outage.document.querySelector("#gateStatus").textContent,/conexão/);passed.push("Database failure keeps gate closed");
  const admin=await setup();
  assert.equal(admin.document.querySelector("#shell").hidden,false);
  assert.equal(admin.document.querySelector("#teamName").textContent,"Equipe <script>erro()</script>");
  assert.equal(admin.document.querySelector("#view-home script"),null);
  assert.equal(admin.document.querySelectorAll("nav [data-view]").length,4);
  passed.push("Admin sees four modules and escaped data");
  await admin.click('[data-action="operator"]');
  assert.equal(admin.document.querySelector("#editor").open,true);
  admin.document.querySelector('[name="name"]').value="Novo operador";
  admin.document.querySelector('[name="active"]').checked=true;
  await admin.document.querySelector("#editForm").onsubmit({preventDefault(){},target:admin.document.querySelector("#editForm")});
  assert.equal(admin.state.records.length,1);
  assert.equal(admin.state.records[0].data.name,"Novo operador");
  assert.equal(admin.state.writes[0].table,"team_operator_records");passed.push("Manual operator saved without auth account");
  await admin.click('[data-view="finance"]');
  await admin.click('[data-action="generate"]');
  assert.equal(admin.state.fees.length,2);
  await admin.click('[data-action="generate"]');
  assert.equal(admin.state.fees.length,2);passed.push("Generating same month twice does not duplicate dues");
  await admin.click('[data-action="payment"]');
  admin.document.querySelector('[name="status"]').value="paid";
  admin.document.querySelector('[name="date"]').value="2026-01-01";
  await admin.document.querySelector("#editForm").onsubmit({preventDefault(){},target:admin.document.querySelector("#editForm")});
  assert.equal(admin.state.fees[0].status,"paid");passed.push("Payment status and date saved");
  await admin.document.querySelector("#logout").onclick();
  assert.equal(admin.document.querySelector("#shell").hidden,true);
  assert.equal(admin.document.querySelector("#view-operators").innerHTML,"");passed.push("Logout clears private rendered data");
  return passed;
}
