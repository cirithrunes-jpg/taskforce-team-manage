(()=>{
  const key="tf_beginners_progress_v1";
  const lessons=["origin","honor","safety"];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function readProgress(){
    try{
      const saved=JSON.parse(localStorage.getItem(key)||"[]");
      return new Set(Array.isArray(saved)?saved.filter(x=>lessons.includes(x)):[]);
    }catch{return new Set()}
  }
  let done=readProgress();

  function saveProgress(){
    localStorage.setItem(key,JSON.stringify([...done]));
  }

  function updateProgress(){
    const total=lessons.length,count=done.size,pct=Math.round((count/total)*100);
    const text=$("#beginnerProgressText"),bar=$("#beginnerProgressBar"),hint=$("#beginnerProgressHint");
    if(text)text.textContent=count+"/"+total;
    if(bar)bar.style.width=pct+"%";
    if(hint)hint.textContent=count===0?"Comece pela origem do esporte.":count<total?"Continue sua jornada.":"Demo concluída — fundamentos iniciais completos.";
    lessons.forEach(id=>{
      const el=$('[data-status="'+id+'"]');
      if(el){el.textContent=done.has(id)?"Concluído ✓":"Começar";el.classList.toggle("is-done",done.has(id))}
      const card=$('[data-lesson="'+id+'"]');
      if(card)card.classList.toggle("is-done",done.has(id));
    });
    const finish=$("#beginnerFinish");
    if(finish)finish.hidden=count<total;
  }

  function openLesson(id){
    if(!lessons.includes(id))return;
    const roadmap=$("#beginnerRoadmap"),stage=$("#lessonStage");
    if(roadmap)roadmap.hidden=true;
    if(stage)stage.hidden=false;
    $$("[data-lesson-view]").forEach(v=>v.hidden=v.dataset.lessonView!==id);
    stage?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function backToRoadmap(){
    const roadmap=$("#beginnerRoadmap"),stage=$("#lessonStage");
    if(stage)stage.hidden=true;
    if(roadmap)roadmap.hidden=false;
    roadmap?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  $$("[data-lesson]").forEach(btn=>btn.addEventListener("click",()=>openLesson(btn.dataset.lesson)));
  $("#lessonBack")?.addEventListener("click",backToRoadmap);

  $$("[data-complete]").forEach(btn=>btn.addEventListener("click",()=>{
    done.add(btn.dataset.complete);saveProgress();updateProgress();backToRoadmap();
  }));

  $$("[data-quiz] [data-answer]").forEach(btn=>btn.addEventListener("click",()=>{
    const box=btn.closest("[data-quiz]"),feedback=$(".quiz-feedback",box);
    $$(".quiz-options button",box).forEach(b=>b.classList.remove("answer-good","answer-bad"));
    const ok=btn.dataset.answer==="correct";
    btn.classList.add(ok?"answer-good":"answer-bad");
    if(feedback){
      feedback.textContent=ok?"Isso. Regras, respeito e honestidade são a base para todos aproveitarem a atividade.":"Tente novamente: o fundamento não depende de equipamento caro nem de conhecimento avançado.";
      feedback.className="quiz-feedback "+(ok?"good":"bad");
    }
  }));

  $$("[data-scenario]").forEach(btn=>btn.addEventListener("click",()=>{
    const box=btn.closest(".scenario-card"),feedback=$(".scenario-feedback",box);
    $$(".quiz-options button",box).forEach(b=>b.classList.remove("answer-good","answer-bad"));
    const ok=btn.dataset.scenario==="correct";
    btn.classList.add(ok?"answer-good":"answer-bad");
    if(feedback){
      feedback.textContent=ok?"Boa escolha. Fair play significa privilegiar honestidade, respeito e as regras do evento.":"Essa atitude enfraquece a confiança entre participantes. O melhor caminho é agir com honestidade e seguir as regras.";
      feedback.className="scenario-feedback "+(ok?"good":"bad");
    }
  }));

  updateProgress();
})();