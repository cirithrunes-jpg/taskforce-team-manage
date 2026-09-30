(()=>{
  const q=(s)=>document.querySelector(s);
  const qa=(s)=>Array.from(document.querySelectorAll(s));
  function closeMore(){
    const sheet=q("#mobileMoreSheet"), back=q("#mobileSheetBackdrop");
    if(sheet) sheet.hidden=true;
    if(back) back.hidden=true;
  }
  function switchView(view){
    if(!view) return;
    qa(".view").forEach(v=>v.classList.remove("active"));
    qa(".nav-item").forEach(v=>v.classList.remove("active"));
    qa(".mobile-nav-item[data-mobile-view]").forEach(v=>v.classList.toggle("active",v.dataset.mobileView===view));
    q("#view-"+view)?.classList.add("active");
    q('.nav-item[data-view="'+view+'"]')?.classList.add("active");
    q("#sidebar")?.classList.remove("open");
    closeMore();
    window.dispatchEvent(new CustomEvent("taskforce:view-change",{detail:{view}}));
  }
  document.addEventListener("click",(e)=>{
    const viewBtn=e.target.closest("[data-view],[data-mobile-view],[data-go]");
    if(viewBtn){
      const view=viewBtn.dataset.view||viewBtn.dataset.mobileView||viewBtn.dataset.go;
      if(view){ e.preventDefault(); switchView(view); }
      return;
    }
    if(e.target.closest("#mobileMoreBtn")){
      const sheet=q("#mobileMoreSheet"), back=q("#mobileSheetBackdrop");
      if(sheet&&back){
        const opening=sheet.hidden;
        sheet.hidden=!opening;
        back.hidden=!opening;
      }
      return;
    }
    if(e.target.closest("#mobileSheetBackdrop")) closeMore();
  },true);
  window.TASKFORCE_NAV={switchView,closeMore};
})();