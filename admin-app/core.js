(function(root) {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = value => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  function localDate(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  }
  function dueDate(month, day) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Escolha um mês válido.");
    const [year, m] = month.split("-").map(Number);
    if(m < 1 || m > 12 || year < 2000 || year > 2100) throw new Error("Mês inválido.");
    const d = Math.max(1, Math.min(Number(day) || 5, new Date(year,m,0).getDate()));
    return month + "-" + String(d).padStart(2,"0");
  }
  function mergeOperators(members, records) {
    const bySource = new Map(records.filter(r=>r.data.source_user_id).map(r=>[r.data.source_user_id,r]));
    const inherited = members.filter(m=>m.member_role==="operator").map(m=>{
      const override = bySource.get(m.user_id);
      return {key:"user:"+m.user_id,recordId:override?.id,sourceUserId:m.user_id,data:{...m,...(override?.data || {})}};
    });
    const manual = records.filter(r=>!r.data.source_user_id).map(r=>({key:"record:"+r.id,recordId:r.id,data:r.data}));
    return [...inherited,...manual].sort((a,b)=>(a.data.name||"").localeCompare(b.data.name||"","pt-BR"));
  }
  function financeSummary(fees) {
    return fees.reduce((s,f)=>{
      if(f.status==="exempt") return s;
      const cents=Math.round(Number(f.amount)*100);
      if(f.status==="paid"){s.paidCents+=cents;s.paidCount++;}else{s.pendingCents+=cents;s.pendingCount++;}
      return s;
    },{paidCents:0,pendingCents:0,paidCount:0,pendingCount:0});
  }
  const api={esc,money,localDate,dueDate,mergeOperators,financeSummary};
  if(typeof module!=="undefined") module.exports=api;
  root.TFCore=api;
})(typeof window==="undefined"?globalThis:window);
