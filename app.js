const CONFIG={
  SUPABASE_URL:"https://ecszjvqkuymmeweyghad.supabase.co",
  PUBLISHABLE_KEY:"sb_publishable_QGq_2DsvJjHLLI1XDMvxcQ_28TCcFnJ",
  FUNCTION_NAME:"dynamic-function",
  BOT_USERNAME:"par_planer_bot"
};

const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}

const COLORS=["#3b82f6","#8b5cf6","#f59e0b","#22c55e","#ef6b73","#14b8a6"];
let state=null;
let viewMonth=new Date();
let selectedDate=localISO(new Date());
let simpleMode=null;
let filters={tasks:"all",shopping:"all"};
let busy=false;
let calendarMode="plans";
let workViewFilter="all"; // all | mine | partner | overlap — что подсвечивать в режиме "Рабочие дни"
let workDraft=new Set();
let workSelection=new Set();
let workDirty=false;
let pointerWork={active:false,anchor:null,longPressed:false,moved:false,timer:null};

function localISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function monthKey(d=viewMonth){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function fmt(d){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric"}).format(new Date(d+"T12:00:00"));}
function formatDueAt(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value||"");return new Intl.DateTimeFormat("ru-RU",{timeZone:"Europe/Minsk",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);}
function me(){return state?.me?.id;}
function member(id){return state?.members.find(x=>x.id===id);}
const LOCAL_COLORS_KEY="parplan_member_colors_v1";
function customColors(){try{return JSON.parse(localStorage.getItem(LOCAL_COLORS_KEY)||"{}")||{};}catch{return {};}}
function color(m){if(!m)return COLORS[0];return customColors()[m.id]||COLORS[(m?.color_index||0)%COLORS.length];}
function setMemberColor(id,value){const map=customColors();map[id]=value;localStorage.setItem(LOCAL_COLORS_KEY,JSON.stringify(map));}
function resetMemberColor(id){const map=customColors();delete map[id];localStorage.setItem(LOCAL_COLORS_KEY,JSON.stringify(map));}
function status(t){syncStatus.textContent=t;}

async function api(action,data={}){
  const initData=tg?.initData||"";
  if(!initData)throw Error("Открой приложение внутри Telegram.");
  const r=await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/${CONFIG.FUNCTION_NAME}`,{
    method:"POST",
    headers:{"Content-Type":"application/json",apikey:CONFIG.PUBLISHABLE_KEY,Authorization:"Bearer "+CONFIG.PUBLISHABLE_KEY},
    body:JSON.stringify({action,initData,data})
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Ошибка соединения");
  return j;
}

async function load(silent=false){
  if(busy)return;
  busy=true;
  if(!silent)status("Синхронизация…");
  try{
    const r=await api("bootstrap",{startParam:tg?.initDataUnsafe?.start_param||null});
    state=r.state;
    syncWorkDraftFromServer();
    renderAll();
    status("Синхронизировано");
  }catch(e){
    status(e.message||"Ошибка");
    if(!silent)alert(e.message);
  }finally{busy=false;}
}

async function act(action,data={}){
  try{
    status("Сохранение…");
    const r=await api(action,data);
    state=r.state;
    syncWorkDraftFromServer();
    renderAll();
    status("Синхронизировано");
    return r;
  }catch(e){
    status("Ошибка");
    alert(e.message);
    throw e;
  }
}

function chips(x){
  return x.participants.map(p=>{
    const m=member(p.user_id);
    const s=p.status==="joined"?"участвует":p.status==="invited"?"приглашён":"отказался";
    return m?`<span class="chip ${p.status}">${esc(m.display_name)} · ${s}</span>`:"";
  }).join("");
}

function partButtons(kind,x){
  const p=x.participants.find(p=>p.user_id===me());
  if(!p)return "";
  const a=kind==="event"?"event_participation":kind==="task"?"task_participation":"shopping_participation";
  if(p.status==="joined")return `<button class="miniBtn decline" data-part="${a}|${x.id}|declined">Отказаться</button>`;
  if(p.status==="invited")return `<button class="miniBtn join" data-part="${a}|${x.id}|joined">✓ Присоединиться</button><button class="miniBtn decline" data-part="${a}|${x.id}|declined">✕ Отказаться</button>`;
  return `<button class="miniBtn join" data-part="${a}|${x.id}|joined">Присоединиться</button>`;
}

/* ---------- КАЛЕНДАРЬ ---------- */

function getWorkSets(){
  const mine=new Set((state.workDays||[]).filter(x=>x.user_id===me()).map(x=>x.work_date));
  const partner=new Set((state.workDays||[]).filter(x=>x.user_id!==me()).map(x=>x.work_date));
  return {mine,partner};
}

function syncWorkDraftFromServer(){
  if(!state)return;
  const {mine}=getWorkSets();
  const prefix=monthKey()+"-";
  // Не сбрасываем черновик и выделение во время фоновой синхронизации.
  // Иначе только что выбранные, но ещё не сохранённые дни исчезают.
  if(!workDirty && workSelection.size===0){
    workDraft=new Set([...mine].filter(d=>d.startsWith(prefix)));
  }
}

function rangeDates(a,b){
  const start=new Date(a+"T12:00:00"),end=new Date(b+"T12:00:00");
  const dir=start<=end?1:-1;
  const out=[];
  const cur=new Date(start);
  while(true){
    out.push(localISO(cur));
    if(localISO(cur)===localISO(end))break;
    cur.setDate(cur.getDate()+dir);
  }
  return out;
}

function renderCalendar(){
  monthTitle.textContent=new Intl.DateTimeFormat("ru-RU",{month:"long",year:"numeric"}).format(viewMonth);
  const y=viewMonth.getFullYear(),m=viewMonth.getMonth();
  const off=(new Date(y,m,1).getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const prev=new Date(y,m,0).getDate();
  const {mine,partner}=state?getWorkSets():{mine:new Set(),partner:new Set()};

  calendar.innerHTML="";
  for(let i=0;i<42;i++){
    let d,dt,other=false;
    if(i<off){d=prev-off+i+1;dt=new Date(y,m-1,d);other=true;}
    else if(i>=off+days){d=i-off-days+1;dt=new Date(y,m+1,d);other=true;}
    else{d=i-off+1;dt=new Date(y,m,d);}

    const iso=localISO(dt);
    const b=document.createElement("button");
    b.type="button";
    b.dataset.date=iso;
    b.className="day"+(other?" other":"");

    if(calendarMode==="plans"){
      const ev=state.events.filter(e=>e.event_date===iso);
      const ids=[...new Set(ev.flatMap(e=>e.participants.filter(p=>p.status!=="declined").map(p=>p.user_id)))].slice(0,4);
      if(iso===selectedDate)b.classList.add("selected");
      if(iso===localISO(new Date()))b.classList.add("today");
      b.innerHTML=`<span>${d}</span><span class="dots">${ids.map(id=>`<i class="dot" style="background:${color(member(id))}"></i>`).join("")}</span>`;
      b.onclick=()=>{
        selectedDate=iso;
        viewMonth=new Date(dt.getFullYear(),dt.getMonth(),1);
        renderAll();
      };
    }else{
      const isMine=workDraft.has(iso);
      const isPartner=partner.has(iso);
      const isFreeOverlap=!isMine&&!isPartner&&!other; // оба свободны в этот день (общий выходной)
      if(workViewFilter==="overlap"){
        if(isFreeOverlap)b.classList.add("workFreeOverlap");
      }else{
        const showMine=isMine&&(workViewFilter==="all"||workViewFilter==="mine");
        const showPartner=isPartner&&(workViewFilter==="all"||workViewFilter==="partner");
        if(showMine&&showPartner)b.classList.add("workOverlap");
        else if(showMine)b.classList.add("workMine");
        else if(showPartner)b.classList.add("workPartner");
      }
      if(workSelection.has(iso))b.classList.add("workSelected");
      if(iso===localISO(new Date()))b.classList.add("today");
      b.innerHTML=`<span>${d}</span>`;
      bindWorkPointer(b,iso);
    }
    calendar.appendChild(b);
  }
  renderWorkPanel();
}

function refreshWorkSelectionVisual(){
  calendar.querySelectorAll("[data-date]").forEach(el=>{
    el.classList.toggle("workSelected",workSelection.has(el.dataset.date));
  });
  renderWorkPanel();
}

function bindWorkPointer(btn,iso){
  btn.addEventListener("pointerdown",e=>{
    if(calendarMode!=="work")return;
    e.preventDefault();
    try{btn.setPointerCapture(e.pointerId);}catch(_){ }

    pointerWork.active=true;
    pointerWork.anchor=iso;
    pointerWork.longPressed=false;
    pointerWork.moved=false;
    clearTimeout(pointerWork.timer);

    pointerWork.timer=setTimeout(()=>{
      if(!pointerWork.active)return;
      pointerWork.longPressed=true;
      workSelection=new Set([iso]);
      // Не перерисовываем весь календарь: пересоздание кнопки под пальцем
      // было причиной того, что выбор сразу "слетал".
      refreshWorkSelectionVisual();
    },320);
  });

  btn.addEventListener("pointermove",e=>{
    if(calendarMode!=="work"||!pointerWork.active||!pointerWork.longPressed)return;
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const dateEl=el?.closest?.("[data-date]");
    if(!dateEl?.dataset.date)return;
    pointerWork.moved=true;
    workSelection=new Set(rangeDates(pointerWork.anchor,dateEl.dataset.date));
    refreshWorkSelectionVisual();
  });

  const finish=e=>{
    if(calendarMode!=="work")return;
    clearTimeout(pointerWork.timer);
    if(pointerWork.active&&!pointerWork.longPressed){
      if(workSelection.has(iso))workSelection.delete(iso);
      else workSelection.add(iso);
      refreshWorkSelectionVisual();
    }
    pointerWork.active=false;
    pointerWork.anchor=null;
    pointerWork.longPressed=false;
    pointerWork.moved=false;
    try{
      if(e?.pointerId!==undefined&&btn.hasPointerCapture?.(e.pointerId))btn.releasePointerCapture(e.pointerId);
    }catch(_){ }
  };

  btn.addEventListener("pointerup",finish);
  btn.addEventListener("pointercancel",finish);
}
function renderEvents(){
  selectedDateTitle.textContent=fmt(selectedDate);
  const a=state.events.filter(e=>e.event_date===selectedDate).sort((a,b)=>a.start_time.localeCompare(b.start_time));
  eventsList.innerHTML=a.map(e=>`<div class="event"><div class="eventTime">${e.start_time.slice(0,5)}<br><span class="muted">${e.end_time.slice(0,5)}</span></div><div class="eventBody"><div class="eventTitle">${esc(e.title)}</div><div class="chips">${chips(e)}</div><div class="rowActions">${partButtons("event",e)}</div></div>${e.created_by===me()?`<button class="deleteBtn" data-del-event="${e.id}">×</button>`:""}</div>`).join("");
  eventsEmpty.style.display=a.length?"none":"block";
  let n=0;
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){
    const common=a[i].participants.filter(p=>p.status==="joined").some(p=>a[j].participants.some(q=>q.status==="joined"&&q.user_id===p.user_id));
    if(common&&a[i].start_time<a[j].end_time&&a[j].start_time<a[i].end_time)n++;
  }
  if(n){overlapWarning.textContent=`⚠️ Есть пересекающиеся события: ${n}`;overlapWarning.classList.remove("hidden");}
  else overlapWarning.classList.add("hidden");
}

/* ---------- РАБОЧИЕ ДНИ ---------- */

function renderWorkPanel(){
  if(!state)return;
  const workVisible=calendarMode==="work";
  workLegend.classList.toggle("hidden",!workVisible);
  workFilterSwitch.classList.toggle("hidden",!workVisible);
  plansPanel.classList.toggle("hidden",workVisible);
  workPanel.classList.toggle("hidden",!workVisible);
  if(!workVisible)return;

  const prefix=monthKey()+"-";
  const {partner}=getWorkSets();
  const partnerMembers=state.members.filter(m=>m.id!==me());
  const partnerName=partnerMembers.length===1?partnerMembers[0].display_name:"Партнёр";
  const myDates=[...workDraft].filter(d=>d.startsWith(prefix));
  const partnerDates=[...partner].filter(d=>d.startsWith(prefix));
  const overlap=myDates.filter(d=>partner.has(d));
  const year=viewMonth.getFullYear(), month=viewMonth.getMonth();
  const daysInMonth=new Date(year,month+1,0).getDate();
  let commonFree=0;
  for(let day=1;day<=daysInMonth;day++){
    const iso=localISO(new Date(year,month,day));
    if(!workDraft.has(iso)&&!partner.has(iso))commonFree++;
  }

  myWorkCount.textContent=`${myDates.length} ${daysWord(myDates.length)}`;
  partnerWorkName.textContent=partnerName;
  partnerWorkCount.textContent=`${partnerDates.length} ${daysWord(partnerDates.length)}`;
  overlapWorkCount.textContent=`${overlap.length} ${daysWord(overlap.length)}`;
  commonFreeCount.textContent=`${commonFree} ${daysWord(commonFree)}`;

  workSelectionCount.textContent=`Выбрано: ${workSelection.size}`;
  workSelectionBar.classList.toggle("hidden",workSelection.size===0);
  saveWorkBtn.disabled=!workDirty;
  workSaveInfo.textContent=workDirty?"Есть несохранённые изменения":"Изменений пока нет";
}

function daysWord(n){
  const mod10=n%10,mod100=n%100;
  if(mod10===1&&mod100!==11)return "день";
  if(mod10>=2&&mod10<=4&&(mod100<10||mod100>=20))return "дня";
  return "дней";
}

function applyWorkSelection(isWork){
  if(!workSelection.size)return;
  workSelection.forEach(d=>{
    if(!d.startsWith(monthKey()+"-"))return;
    if(isWork)workDraft.add(d);else workDraft.delete(d);
  });
  workSelection.clear();
  workDirty=true;
  renderCalendar();
}

async function saveWorkDays(){
  const dates=[...workDraft].filter(d=>d.startsWith(monthKey()+"-")).sort();
  status("Сохранение графика…");
  try{
    const r=await api("save_work_days",{month:monthKey(),dates});
    state=r.state;
    workDirty=false;
    syncWorkDraftFromServer();
    renderAll();
    status("Синхронизировано");
  }catch(e){
    status("Ошибка");
    alert(e.message||"Не удалось сохранить график");
  }
}

/* ---------- ОСТАЛЬНОЕ ---------- */

function renderMembers(){
  memberCount.textContent=state.members.length+" участн.";
  membersList.innerHTML=state.members.map(m=>`<div class="memberRow"><div class="memberAvatar" style="background:${color(m)}">${esc((m.display_name||"?")[0])}</div><div><strong>${esc(m.display_name)}</strong><div class="muted">${m.id===me()?"Вы":m.role==="owner"?"Создатель":"Участник"}</div></div></div>`).join("");
}

function filtered(type){
  const f=filters[type];
  return state[type].filter(x=>{
    const joined=x.participants.filter(p=>p.status==="joined").map(p=>p.user_id);
    if(f==="all")return true;
    if(f==="mine")return x.created_by===me();
    if(f==="other")return x.created_by!==me();
    if(f==="common")return joined.includes(me())&&joined.some(id=>id!==me());
    return true;
  });
}

function renderRows(type,list,empty,filterBox){
  filterBox.innerHTML=[["all","Все"],["mine","Моё"],["other","Других"],["common","Общее"]].map(([v,t])=>`<button class="filterBtn ${filters[type]===v?"active":""}" data-filter="${type}|${v}">${t}</button>`).join("");
  const a=filtered(type);
  list.innerHTML=a.map(x=>`<div class="rowItem ${x.is_completed?"done":""}"><input type="checkbox" ${x.is_completed?"checked":""} data-toggle="${type}|${x.id}"><div class="rowText"><div>${esc(x.title)}</div>${type==="tasks"&&x.due_at?`<div class="dueMeta">⏰ ${formatDueAt(x.due_at)}${x.reminder_minutes!==null&&x.reminder_minutes!==undefined?` · 🔔 ${x.reminder_minutes===0?"в момент":"за "+x.reminder_minutes+" мин."}`:""}</div>`:""}<div class="rowMeta">${chips(x)}</div><div class="rowActions">${partButtons(type==="tasks"?"task":"shopping",x)}</div></div>${x.created_by===me()?`<button class="deleteBtn" data-del="${type}|${x.id}">×</button>`:""}</div>`).join("");
  empty.style.display=a.length?"none":"block";
}

function bind(){
  document.querySelectorAll("[data-part]").forEach(b=>b.onclick=()=>{const[a,id,status]=b.dataset.part.split("|");act(a,{id,status});});
  // Фильтры задач/покупок используют формат "tasks|all".
  // Рабочие дни имеют свой обработчик ниже, поэтому их здесь не перехватываем.
  document.querySelectorAll(".filterBtn[data-filter]").forEach(b=>b.onclick=()=>{
    const [t,f]=b.dataset.filter.split("|");
    if(!t||!f)return;
    filters[t]=f;
    renderAll();
  });
  document.querySelectorAll("[data-toggle]").forEach(b=>b.onchange=()=>{const[t,id]=b.dataset.toggle.split("|");act(t==="tasks"?"toggle_task":"toggle_shopping",{id,is_completed:b.checked});});
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const[t,id]=b.dataset.del.split("|");act(t==="tasks"?"delete_task":"delete_shopping",{id});});
  document.querySelectorAll("[data-del-event]").forEach(b=>b.onclick=()=>act("delete_event",{id:b.dataset.delEvent}));
}

function renderAll(){
  if(!state)return;
  spaceTitle.textContent=state.space.name;
  renderCalendar();
  renderEvents();
  renderMembers();
  renderRows("tasks",tasksList,tasksEmpty,tasksFilters);
  renderRows("shopping",shoppingList,shoppingEmpty,shoppingFilters);
  bind();
}

prevMonth.onclick=()=>{
  if(workDirty&&!confirm("Есть несохранённые изменения. Перейти к другому месяцу?"))return;
  workDirty=false;
  viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,1);
  syncWorkDraftFromServer();
  renderCalendar();
};

nextMonth.onclick=()=>{
  if(workDirty&&!confirm("Есть несохранённые изменения. Перейти к другому месяцу?"))return;
  workDirty=false;
  viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,1);
  syncWorkDraftFromServer();
  renderCalendar();
};

document.querySelectorAll(".modeBtn").forEach(b=>b.onclick=()=>{
  if(workDirty&&calendarMode==="work"&&b.dataset.mode!=="work"&&!confirm("Есть несохранённые изменения. Выйти без сохранения?"))return;
  if(workDirty&&b.dataset.mode!=="work"){workDirty=false;syncWorkDraftFromServer();}
  calendarMode=b.dataset.mode;
  document.querySelectorAll(".modeBtn").forEach(x=>x.classList.toggle("active",x===b));
  renderAll();
});

document.querySelectorAll(".navItem").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".navItem").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll("#calendarView,#tasksView,#shoppingView,#peopleView").forEach(x=>x.classList.add("hidden"));
  b.classList.add("active");
  document.getElementById(b.dataset.view).classList.remove("hidden");
});

addEventBtn.onclick=()=>{
  eventTitle.value="";
  eventDate.value=selectedDate;
  eventStart.value="";
  eventEnd.value="";
  eventMembers.innerHTML=state.members.map(m=>`<label class="checkItem"><input type="checkbox" value="${m.id}" ${m.id===me()?"checked":""}>${esc(m.display_name)}</label>`).join("");
  eventDialog.showModal();
};

eventForm.onsubmit=async e=>{
  e.preventDefault();
  const participantIds=[...document.querySelectorAll("#eventMembers input:checked")].map(x=>x.value);
  if(!participantIds.length)return alert("Выбери участника.");
  if(eventEnd.value<=eventStart.value)return alert("Проверь время.");
  await act("create_event",{title:eventTitle.value.trim(),event_date:eventDate.value,start_time:eventStart.value,end_time:eventEnd.value,participantIds});
  selectedDate=eventDate.value;
  eventDialog.close();
};

function openSimple(mode,title){
  simpleMode=mode;
  simpleTitle.textContent=title;
  simpleInput.value="";
  simpleMembers.innerHTML=state.members.map(m=>`<label class="checkItem"><input type="checkbox" value="${m.id}" ${m.id===me()?"checked":""}>${esc(m.display_name)}</label>`).join("");
  const schedule=document.getElementById("taskScheduleFields");
  schedule.classList.toggle("hidden",mode!=="tasks");
  document.getElementById("taskDate").value=selectedDate||"";
  document.getElementById("taskTime").value="";
  document.getElementById("taskReminder").value="";
  simpleDialog.showModal();
}
addTaskBtn.onclick=()=>openSimple("tasks","Новое дело");
addShoppingBtn.onclick=()=>openSimple("shopping","Новая покупка");
simpleForm.onsubmit=async e=>{
  e.preventDefault();
  const participantIds=[...document.querySelectorAll("#simpleMembers input:checked")].map(x=>x.value);
  if(!participantIds.length)return alert("Выбери участника.");
  const payload={title:simpleInput.value.trim(),participantIds};
  if(simpleMode==="tasks"){
    const dueDate=document.getElementById("taskDate").value;
    const dueTime=document.getElementById("taskTime").value;
    const reminder=document.getElementById("taskReminder").value;
    if(reminder!==""&&(!dueDate||!dueTime))return alert("Для напоминания укажи дату и время.");
    payload.due_date=dueDate||null;
    payload.due_time=dueTime||null;
    payload.reminder_minutes=reminder===""?null:Number(reminder);
    if(dueDate&&dueTime){
      // Пользователь выбирает локальное время. Храним момент в UTC,
      // чтобы reminder-worker мог корректно сравнивать его с Date.now().
      const local=new Date(`${dueDate}T${dueTime}:00`);
      if(Number.isNaN(local.getTime()))return alert("Некорректная дата или время.");
      payload.due_at=local.toISOString();
    }else payload.due_at=null;
  }
  await act(simpleMode==="tasks"?"create_task":"create_shopping",payload);
  simpleDialog.close();
};

inviteBtn.onclick=async()=>{
  const r=await act("create_invite");
  const link=`https://t.me/${CONFIG.BOT_USERNAME}?startapp=${r.token}`;
  const share="https://t.me/share/url?url="+encodeURIComponent(link)+"&text="+encodeURIComponent("Присоединяйся к моему пространству в parplan");
  if(tg?.openTelegramLink)tg.openTelegramLink(share);
  else navigator.clipboard.writeText(link);
};

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
function renderColorSettings(){
  const box=document.getElementById("colorSettingsList");if(!box)return;
  box.innerHTML=state.members.map(m=>`<div class="colorSettingRow"><div class="memberMini"><span class="memberAvatar" style="background:${color(m)}">${esc((m.display_name||"?")[0])}</span><span>${esc(m.display_name)}${m.id===me()?" · Вы":""}</span></div><div class="colorControls"><input type="color" value="${color(m)}" data-member-color="${m.id}"><button type="button" class="textBtn" data-reset-color="${m.id}">↺</button></div></div>`).join("");
  box.querySelectorAll("[data-member-color]").forEach(inp=>inp.oninput=()=>{setMemberColor(inp.dataset.memberColor,inp.value);renderColorSettings();renderAll();});
  box.querySelectorAll("[data-reset-color]").forEach(btn=>btn.onclick=()=>{resetMemberColor(btn.dataset.resetColor);renderColorSettings();renderAll();});
}
settingsBtn.onclick=()=>{
  document.getElementById("spaceNameInput").value=state.space.name||"";
  renderColorSettings();
  const ns=state.notificationSettings||{notify_event:true,notify_task:true,notify_shopping:true};
  document.getElementById("notifyEventToggle").checked=ns.notify_event!==false;
  document.getElementById("notifyTaskToggle").checked=ns.notify_task!==false;
  document.getElementById("notifyShoppingToggle").checked=ns.notify_shopping!==false;
  document.getElementById("settingsDialog").showModal();
};
document.getElementById("settingsForm").onsubmit=async e=>{
  e.preventDefault();
  const n=document.getElementById("spaceNameInput").value.trim();
  if(n&&n!==state.space.name)await act("rename_space",{name:n});
  const notify_event=document.getElementById("notifyEventToggle").checked;
  const notify_task=document.getElementById("notifyTaskToggle").checked;
  const notify_shopping=document.getElementById("notifyShoppingToggle").checked;
  const ns=state.notificationSettings||{};
  if(ns.notify_event!==notify_event||ns.notify_task!==notify_task||ns.notify_shopping!==notify_shopping){
    await act("save_notification_settings",{notify_event,notify_task,notify_shopping});
  }
  document.getElementById("settingsDialog").close();
};

markWorkBtn.onclick=()=>applyWorkSelection(true);
markWeekendBtn.onclick=()=>applyWorkSelection(false);
document.querySelectorAll(".workFilterBtn").forEach(b=>b.onclick=()=>{
  workViewFilter=b.dataset.filter;
  document.querySelectorAll(".workFilterBtn").forEach(x=>x.classList.toggle("active",x===b));
  renderCalendar();
});

clearWorkSelectionBtn.onclick=()=>{workSelection.clear();renderCalendar();};
saveWorkBtn.onclick=saveWorkDays;

setInterval(()=>load(true),12000);
load();