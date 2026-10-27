const CONFIG={
  SUPABASE_URL:"https://ecszjvqkuymmeweyghad.supabase.co",
  PUBLISHABLE_KEY:"sb_publishable_QGq_2DsvJjHLLI1XDMvxcQ_28TCcFnJ",
  FUNCTION_NAME:"dynamic-function",
  BOT_USERNAME:"par_planer_bot"
};

const tg=window.Telegram?.WebApp;
if(tg){
  tg.ready();tg.expand();
  try{tg.setHeaderColor("#0a0f24");tg.setBackgroundColor("#0a0f24");}catch(_){}
}

const COLORS=["#3b82f6","#8b5cf6","#f59e0b","#22c55e","#ef6b73","#14b8a6"];
let state=null;
let viewMonth=new Date();
let selectedDate=localISO(new Date());
let simpleMode=null;
let busy=false;
let activeView="todayView";   // todayView | calendarView | orgView | profileView
let lastMainView="todayView";
let calendarMode="month";     // month | week | day | work
let orgFilter="all";          // all | tasks | shopping | recurring
let workViewFilter="all";     // all | mine | partner | overlap — подсветка в режиме "Рабочие дни"
let pendingDeleteEventId=null;
let scheduleShouldAutoscroll=true;
let editingSimpleId=null;
let editingEventId=null;
let workDraft=new Set();
let workSelection=new Set();
let workDirty=false;
let pointerWork={active:false,anchor:null,longPressed:false,moved:false,timer:null};

/* ---------- ИКОНКИ ---------- */
const ICONS={
  logo:'<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
  cart:'<path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  bell:'<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  edit:'<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  chevron:'<path d="M9 6l6 6-6 6"/>',
  back:'<path d="M15 6l-6 6 6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
  repeat:'<path d="M4 12a8 8 0 0 1 13.5-5.8L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.5 5.8L4 16M4 20v-4h4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1-.9-1.5-.9-2.5 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>'
};
function icon(name){
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||""}</svg>`;
}
document.querySelectorAll("[data-icon]").forEach(el=>{el.innerHTML=icon(el.dataset.icon);});

/* ---------- УТИЛИТЫ ---------- */
function localISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function monthKey(d=viewMonth){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function todayISO(){return localISO(new Date());}
function addDays(iso,n){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return localISO(d);}
function weekStart(iso){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()-((d.getDay()+6)%7));return localISO(d);}
function hhmm(d){return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
function fmt(d){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long"}).format(new Date(d+"T12:00:00"));}
function fmtDM(iso){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short"}).format(new Date(iso+"T12:00:00"));}
function dayLabel(iso){
  const t=todayISO();
  if(iso===t)return "Сегодня";
  if(iso===addDays(t,1))return "Завтра";
  if(iso===addDays(t,-1))return "Вчера";
  return fmtDM(iso);
}
function plural(n,[one,few,many]){
  const m10=n%10,m100=n%100;
  if(m10===1&&m100!==11)return one;
  if(m10>=2&&m10<=4&&(m100<10||m100>=20))return few;
  return many;
}
function timeToMinutes(t){if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+(m||0);}
function durText(start,end){
  const m=timeToMinutes(end)-timeToMinutes(start);
  if(!(m>0))return "";
  if(m<60)return `${m} мин`;
  const h=m/60;
  return Number.isInteger(h)?`${h} ч`:`${h.toFixed(1).replace(".",",")} ч`;
}
function reminderText(r){
  if(r===0)return "в момент";
  if(r>=1440)return `за ${r/1440} дн.`;
  if(r>=60)return `за ${r/60} ч`;
  return `за ${r} мин.`;
}
function me(){return state?.me?.id;}
function member(id){return state?.members.find(x=>x.id===id);}
const LOCAL_COLORS_KEY="parplan_member_colors_v1";
function customColors(){try{return JSON.parse(localStorage.getItem(LOCAL_COLORS_KEY)||"{}")||{};}catch{return {};}}
function color(m){if(!m)return COLORS[0];return customColors()[m.id]||COLORS[(m?.color_index||0)%COLORS.length];}
function setMemberColor(id,value){const map=customColors();map[id]=value;localStorage.setItem(LOCAL_COLORS_KEY,JSON.stringify(map));}
function resetMemberColor(id){const map=customColors();delete map[id];localStorage.setItem(LOCAL_COLORS_KEY,JSON.stringify(map));}
function status(t){syncStatus.textContent=t;}
function avatarHtml(m,cls=""){
  const raw=(m?.display_name||"?").trim().charAt(0).toUpperCase()||"?";
  const img=m?.photo_url?`<img src="${esc(m.photo_url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`:"";
  return `<span class="avatar ${cls}" style="background:${color(m)}">${esc(raw)}${img}</span>`;
}
function setSelected(iso){
  selectedDate=iso;
  const d=new Date(iso+"T12:00:00");
  viewMonth=new Date(d.getFullYear(),d.getMonth(),1);
}

/* ---------- СЕРВЕР ---------- */
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

/* ---------- ДАННЫЕ ПО ДНЯМ ---------- */
function datedItems(filterFn=()=>true){
  const out=[];
  for(const e of state.events){
    out.push({kind:"event",date:e.event_date,time:e.start_time.slice(0,5),data:e});
  }
  for(const t of state.tasks){
    if(!t.due_at)continue;
    const d=new Date(t.due_at);
    out.push({kind:"task",date:localISO(d),time:hhmm(d),data:t});
  }
  return out.filter(filterFn).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
function datedFor(iso){return datedItems(it=>it.date===iso);}
function taskDateOf(t){return t.due_at?localISO(new Date(t.due_at)):null;}

/* ---------- КАРТОЧКИ ---------- */
function checkbox(type,x){
  return `<input type="checkbox" class="rcheck" ${x.is_completed?"checked":""} data-toggle="${type}|${x.id}" aria-label="Выполнено">`;
}
function actionBtns(kind,x){
  if(x.created_by!==me())return "";
  if(kind==="event"){
    return `<button class="iconAct" data-edit-event="${x.id}" aria-label="Изменить">${icon("edit")}</button><button class="iconAct danger" data-del-event="${x.id}" data-series="${x.series_id||""}" aria-label="Удалить">${icon("trash")}</button>`;
  }
  const t=kind==="task"?"tasks":"shopping";
  return `<button class="iconAct" data-edit="${t}|${x.id}" aria-label="Изменить">${icon("edit")}</button><button class="iconAct danger" data-del="${t}|${x.id}" aria-label="Удалить">${icon("trash")}</button>`;
}
// Карточка с временем слева (события и дела с датой)
function timeCard(it,{showDate=false}={}){
  const x=it.data,isTask=it.kind==="task";
  const sub=[];
  if(showDate)sub.push(dayLabel(it.date));
  if(isTask)sub.push("Дело");
  else{const d=durText(x.start_time,x.end_time);if(d)sub.push(d);}
  if(x.reminder_minutes!==null&&x.reminder_minutes!==undefined)sub.push("🔔 "+reminderText(x.reminder_minutes));
  return `<div class="timeCard k-${it.kind} ${x.is_completed?"done":""}">
    <div class="tcTime">${it.time}</div><div class="tcBar"></div>
    <div class="tcBody"><div class="tcTitle">${esc(x.title)}${x.series_id?` <span class="rep">${icon("repeat")}</span>`:""}</div><div class="tcSub">${esc(sub.join(" · "))}</div></div>
    ${isTask?checkbox("tasks",x):""}${actionBtns(it.kind,x)}
  </div>`;
}
// Строка списка с иконкой (Организация, Сегодня)
function itemRow(kind,x,{extra=""}={}){
  const sub=[];
  if(kind==="event"){
    sub.push(`${dayLabel(x.event_date)} · ${x.start_time.slice(0,5)}`);
  }else if(kind==="task"){
    if(x.due_at){const d=new Date(x.due_at);sub.push(`${dayLabel(localISO(d))} · ${hhmm(d)}`);}
    else sub.push("Без даты");
  }
  if(kind!=="shopping"&&x.reminder_minutes!==null&&x.reminder_minutes!==undefined)sub.push("🔔 "+reminderText(x.reminder_minutes));
  if(extra)sub.push(extra);
  const cls=kind==="event"?"ev":kind==="task"?"tk":"sh";
  const ic=kind==="event"?"calendar":kind==="task"?"check":"cart";
  const box=kind==="event"?"":checkbox(kind==="task"?"tasks":"shopping",x);
  return `<div class="row ${x.is_completed?"done":""}">${box}<span class="ri ${cls}">${icon(ic)}</span>
    <div class="rowBody"><div class="rowTitle">${esc(x.title)}${x.series_id?` <span class="rep">${icon("repeat")}</span>`:""}</div>${sub.length?`<div class="rowSub">${esc(sub.join(" · "))}</div>`:""}</div>
    ${actionBtns(kind,x)}</div>`;
}
function block(title,rows){
  if(!rows.length)return "";
  return `<div class="secHead"><h3>${title}</h3><span class="secCount">${rows.length}</span></div><div class="list">${rows.join("")}</div>`;
}

/* ---------- СЕГОДНЯ ---------- */
function renderToday(){
  const now=new Date(),today=todayISO(),h=now.getHours();
  todayGreeting.textContent=h<5?"Доброй ночи!":h<12?"Доброе утро!":h<18?"Добрый день!":"Добрый вечер!";
  todayDate.textContent=cap(new Intl.DateTimeFormat("ru-RU",{weekday:"long",day:"numeric",month:"long"}).format(now));

  const evToday=state.events.filter(e=>e.event_date===today);
  const tasksToday=state.tasks.filter(t=>taskDateOf(t)===today);
  const openTasksToday=tasksToday.filter(t=>!t.is_completed);
  const shopOpen=state.shopping.filter(s=>!s.is_completed);
  const remCount=[...evToday,...openTasksToday].filter(x=>x.reminder_minutes!==null&&x.reminder_minutes!==undefined).length;
  const total=evToday.length+openTasksToday.length;
  todaySummary.textContent=total?`Сегодня у нас ${total} ${plural(total,["дело","дела","дел"])}`:"Сегодня свободный день";

  const tiles=[
    {cls:"t-ev",ic:"calendar",label:"События",n:evToday.length,go:"calendarView|month"},
    {cls:"t-tk",ic:"check",label:"Задачи",n:openTasksToday.length,go:"orgView|tasks"},
    {cls:"t-sh",ic:"cart",label:"Покупки",n:shopOpen.length,go:"orgView|shopping"},
    {cls:"t-rm",ic:"bell",label:"Напоминания",n:remCount,go:"calendarView|month"}
  ];
  todayTiles.innerHTML=tiles.map(t=>`<button class="cnt ${t.cls}" data-go="${t.go}"><span class="cntIc">${icon(t.ic)}</span><span class="cntLabel">${t.label}</span><b class="cntNum">${t.n}</b></button>`).join("");

  const nowHM=hhmm(now);
  const upcoming=datedItems(it=>it.kind==="event"&&(it.date>today||(it.date===today&&it.data.end_time.slice(0,5)>nowHM))).slice(0,3);
  todayEvents.innerHTML=upcoming.length?upcoming.map(it=>timeCard(it,{showDate:it.date!==today})).join(""):`<div class="empty">Ближайших событий нет</div>`;

  const sortedTasks=[...tasksToday].sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));
  todayTasks.innerHTML=sortedTasks.length?sortedTasks.map(t=>itemRow("task",t)).join(""):`<div class="empty">На сегодня задач нет</div>`;
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
  const evDates=new Set(state.events.map(e=>e.event_date));
  const taskDates=new Set(state.tasks.filter(t=>t.due_at&&!t.is_completed).map(t=>taskDateOf(t)));
  const workAny=new Set([...mine,...partner]);
  const today=todayISO();

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

    if(calendarMode!=="work"){
      if(iso===selectedDate)b.classList.add("selected");
      if(iso===today)b.classList.add("today");
      b.innerHTML=`<span>${d}</span><span class="dots">${evDates.has(iso)?'<i class="dot ev"></i>':""}${taskDates.has(iso)?'<i class="dot tk"></i>':""}${workAny.has(iso)?'<i class="dot wk"></i>':""}</span>`;
      b.onclick=()=>{setSelected(iso);renderAll();};
    }else{
      const isMine=workDraft.has(iso);
      const isPartner=partner.has(iso);
      const isFreeOverlap=!isMine&&!isPartner&&!other; // оба свободны (общий выходной)
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
      if(iso===today)b.classList.add("today");
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
      // Не перерисовываем весь календарь: пересоздание кнопки под пальцем сбрасывало выбор.
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
  selectedDateTitle.textContent=(selectedDate===todayISO()?"Сегодня, ":"")+fmt(selectedDate);
  seriesBanners.innerHTML=(state.expiringSeries||[]).map(s=>`<div class="seriesBanner"><span>🔁 «${esc(s.title)}» — серия скоро закончится</span><button data-extend-series="${s.id}">Продлить</button></div>`).join("");
  const items=datedFor(selectedDate);
  eventsList.innerHTML=items.map(it=>timeCard(it)).join("");
  eventsEmpty.style.display=items.length?"none":"block";

  const events=state.events.filter(e=>e.event_date===selectedDate);
  let n=0;
  for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
    if(events[i].start_time<events[j].end_time&&events[j].start_time<events[i].end_time)n++;
  }
  if(n){overlapWarning.textContent=`⚠️ Есть пересекающиеся события: ${n}`;overlapWarning.classList.remove("hidden");}
  else overlapWarning.classList.add("hidden");
}

function renderWeek(){
  const start=weekStart(selectedDate),today=todayISO();
  weekTitle.textContent=`${fmtDM(start)} – ${fmtDM(addDays(start,6))}`;
  weekList.innerHTML=Array.from({length:7},(_,i)=>{
    const iso=addDays(start,i);
    const d=new Date(iso+"T12:00:00");
    const wd=cap(new Intl.DateTimeFormat("ru-RU",{weekday:"short"}).format(d));
    const items=datedFor(iso).map(it=>{
      const x=it.data;
      const sub=it.kind==="event"?durText(x.start_time,x.end_time):"дело";
      return `<button class="wkItem k-${it.kind} ${x.is_completed?"done":""}" data-open-${it.kind}="${x.id}"><span class="wkTime">${it.time}</span><span class="wkBar"></span><span class="wkTitle">${esc(x.title)}</span><span class="wkSub">${esc(sub)}</span></button>`;
    }).join("");
    return `<div class="weekDay ${iso===today?"isToday":""}"><button class="wdHead" data-goday="${iso}"><span>${wd}</span><b>${d.getDate()}</b></button><div class="wdItems">${items||`<div class="wdEmpty">Свободно</div>`}</div></div>`;
  }).join("");
}

/* ---------- ДЕНЬ ПО ЧАСАМ ---------- */
const SCHEDULE_HOUR_PX=44;
const SCHEDULE_MIN_BLOCK_PX=30;

// Если два дела наложились по времени — делим ширину пополам и т.д.
function layoutOverlaps(items){
  const sorted=[...items].sort((a,b)=>a.start-b.start||a.end-b.end);
  const placed=[];
  let cluster=[],clusterEnd=-1;
  const flushCluster=()=>{
    if(!cluster.length)return;
    const cols=[];
    for(const it of cluster){
      let col=cols.findIndex(end=>end<=it.start);
      if(col===-1){col=cols.length;cols.push(0);}
      cols[col]=it.end;
      placed.push({...it,col});
    }
    const colCount=cols.length;
    for(const p of placed.slice(-cluster.length))p.colCount=colCount;
    cluster=[];clusterEnd=-1;
  };
  for(const it of sorted){
    if(cluster.length&&it.start>=clusterEnd)flushCluster();
    cluster.push(it);
    clusterEnd=Math.max(clusterEnd,it.end);
  }
  flushCluster();
  return placed;
}
function scheduleItemsForDay(iso){
  const items=[];
  for(const e of state.events){
    if(e.event_date!==iso)continue;
    const start=timeToMinutes(e.start_time),end=timeToMinutes(e.end_time);
    if(start===null||end===null)continue;
    items.push({id:e.id,kind:"event",title:e.title,start,end:Math.max(end,start+20)});
  }
  for(const t of state.tasks){
    if(!t.due_at||t.is_completed)continue;
    const dt=new Date(t.due_at);
    if(localISO(dt)!==iso)continue;
    const start=dt.getHours()*60+dt.getMinutes();
    items.push({id:t.id,kind:"task",title:t.title,start,end:start+30});
  }
  return items;
}
function renderSchedule(){
  if(!state)return;
  const preservedScrollTop=scheduleGrid.scrollTop;
  const iso=selectedDate,todayIso=todayISO();
  scheduleTitle.textContent=cap(new Intl.DateTimeFormat("ru-RU",{weekday:"long",day:"numeric",month:"long"}).format(new Date(iso+"T12:00:00")));
  const hourLabels=Array.from({length:24},(_,h)=>`<div class="scheduleHourLabel">${String(h).padStart(2,"0")}:00</div>`).join("");
  const nowMin=new Date().getHours()*60+new Date().getMinutes();
  const laid=layoutOverlaps(scheduleItemsForDay(iso));
  const blocks=laid.map(it=>{
    const top=(it.start/60)*SCHEDULE_HOUR_PX;
    const h=Math.max(((it.end-it.start)/60)*SCHEDULE_HOUR_PX,SCHEDULE_MIN_BLOCK_PX);
    const widthPct=100/it.colCount,leftPct=widthPct*it.col;
    const timeLabel=`${String(Math.floor(it.start/60)).padStart(2,"0")}:${String(it.start%60).padStart(2,"0")}`;
    const compact=h<SCHEDULE_MIN_BLOCK_PX+8;
    return `<div class="scheduleBlock k-${it.kind}" data-open-${it.kind}="${it.id}" style="top:${top}px;height:${h}px;left:${leftPct}%;width:calc(${widthPct}% - 2px)"><b>${esc(it.title)}</b>${compact?"":timeLabel}</div>`;
  }).join("");
  const nowLine=iso===todayIso?`<div class="scheduleNow" style="top:${(nowMin/60)*SCHEDULE_HOUR_PX}px"></div>`:"";
  const rows=Array.from({length:24},()=>`<div class="scheduleHourRow"></div>`).join("");
  scheduleGrid.innerHTML=`<div class="scheduleHours"><div class="scheduleDayHead"></div>${hourLabels}</div><div class="scheduleDay ${iso===todayIso?"today":""}"><div class="scheduleDayHead">${iso===todayIso?"Сегодня":fmtDM(iso)}</div><div class="scheduleDayBody">${rows}<div class="scheduleLanes"><div class="scheduleLane">${blocks}</div></div>${nowLine}</div></div>`;
  // Автоскролл — только при входе в «День» или смене дня, не при фоновом обновлении.
  if(scheduleShouldAutoscroll){
    const targetMin=iso===todayIso?Math.max(0,nowMin-60):6*60;
    scheduleGrid.scrollTop=(targetMin/60)*SCHEDULE_HOUR_PX;
    scheduleShouldAutoscroll=false;
  }else{
    scheduleGrid.scrollTop=preservedScrollTop;
  }
}

/* ---------- РАБОЧИЕ ДНИ ---------- */
function renderWorkPanel(){
  if(!state)return;
  const workVisible=calendarMode==="work";
  workLegend.classList.toggle("hidden",!workVisible);
  monthLegend.classList.toggle("hidden",workVisible);
  workFilterSwitch.classList.toggle("hidden",!workVisible);
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

function daysWord(n){return plural(n,["день","дня","дней"]);}

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

function enterWorkMode(){
  workDirty=false;workSelection.clear();
  syncWorkDraftFromServer();
  calendarMode="work";
}
function leaveWorkGuard(){
  if(calendarMode==="work"&&workDirty){
    if(!confirm("Есть несохранённые изменения. Выйти без сохранения?"))return false;
    workDirty=false;workSelection.clear();
    syncWorkDraftFromServer();
  }
  return true;
}

function renderCalendarView(){
  const work=calendarMode==="work";
  calHeadTitle.textContent=work?"Рабочие дни":"Календарь";
  calBackBtn.classList.toggle("hidden",!work);
  workModeBtn.classList.toggle("hidden",work);
  calSwitch.classList.toggle("hidden",work);
  document.querySelectorAll(".calViewBtn").forEach(b=>b.classList.toggle("active",b.dataset.cview===calendarMode));
  monthCard.classList.toggle("hidden",!(calendarMode==="month"||work));
  monthDayCard.classList.toggle("hidden",calendarMode!=="month");
  weekPanel.classList.toggle("hidden",calendarMode!=="week");
  dayPanel.classList.toggle("hidden",calendarMode!=="day");
  workPanel.classList.toggle("hidden",!work);
  if(calendarMode==="month"||work)renderCalendar();
  if(calendarMode==="month")renderEvents();
  if(calendarMode==="week")renderWeek();
  if(calendarMode==="day")renderSchedule();
}

/* ---------- ОРГАНИЗАЦИЯ ---------- */
function renderOrg(){
  document.querySelectorAll(".orgChip").forEach(b=>b.classList.toggle("active",b.dataset.ofilter===orgFilter));
  shopAddRow.classList.toggle("hidden",orgFilter!=="shopping");
  const today=todayISO();
  let html="";

  if(orgFilter==="all"||orgFilter==="tasks"){
    const withEvents=orgFilter==="all";
    const byDue=(a,b)=>String(a.due_at).localeCompare(String(b.due_at));
    const overdue=state.tasks.filter(t=>!t.is_completed&&taskDateOf(t)&&taskDateOf(t)<today).sort(byDue).map(t=>itemRow("task",t));
    const todayRows=datedItems(it=>it.date===today&&(withEvents||it.kind==="task")).map(it=>itemRow(it.kind,it.data));
    const upcomingItems=datedItems(it=>it.date>today&&(it.kind==="event"?withEvents:!it.data.is_completed));
    const upcoming=(withEvents?upcomingItems.slice(0,8):upcomingItems).map(it=>itemRow(it.kind,it.data));
    const undated=state.tasks.filter(t=>!t.due_at&&!t.is_completed).map(t=>itemRow("task",t));
    html+=block("Просрочено",overdue)+block("Сегодня",todayRows)+block("Предстоящие",upcoming)+block("Без даты",undated);

    if(orgFilter==="tasks"){
      const done=state.tasks.filter(t=>t.is_completed&&taskDateOf(t)!==today)
        .sort((a,b)=>String(b.completed_at||"").localeCompare(String(a.completed_at||""))).slice(0,15).map(t=>itemRow("task",t));
      html+=block("Выполнено",done);
    }else{
      const open=state.shopping.filter(s=>!s.is_completed);
      if(open.length){
        html+=block("Покупки",open.slice(0,4).map(s=>itemRow("shopping",s)));
        if(open.length>4)html+=`<button class="linkBtn wide" data-ofilter-go="shopping">Показать все (${open.length}) ›</button>`;
      }
    }
  }

  if(orgFilter==="shopping"){
    const sorted=[...state.shopping].sort((a,b)=>Number(!!a.is_completed)-Number(!!b.is_completed));
    html=block("Список",sorted.map(s=>itemRow("shopping",s)));
    if(!html)html=`<div class="empty">Список покупок пуст</div>`;
  }

  if(orgFilter==="recurring"){
    const bySeries=new Map();
    for(const e of state.events){
      if(!e.series_id)continue;
      if(!bySeries.has(e.series_id))bySeries.set(e.series_id,[]);
      bySeries.get(e.series_id).push(e);
    }
    const rows=[...bySeries.values()].map(list=>{
      list.sort((a,b)=>(a.event_date+a.start_time).localeCompare(b.event_date+b.start_time));
      const next=list.find(e=>e.event_date>=today)||list[list.length-1];
      return {next,count:list.length};
    }).sort((a,b)=>(a.next.event_date+a.next.start_time).localeCompare(b.next.event_date+b.next.start_time));
    html=block("Серии",rows.map(r=>itemRow("event",r.next,{extra:`${r.count} в серии`})));
    if(!html)html=`<div class="empty">Повторяющихся событий нет</div>`;
  }

  orgContent.innerHTML=html||`<div class="empty">Пока ничего нет</div>`;
}

/* ---------- ПРОФИЛЬ ---------- */
function renderProfile(){
  const meMember=member(me())||state.me;
  profileAvatarBig.innerHTML=avatarHtml(meMember,"lg");
  profileName.textContent=state.me.display_name||meMember?.display_name||"Вы";
  memberCount.textContent=state.members.length+" участн.";
  membersList.innerHTML=state.members.map(m=>`<div class="memberRow">${avatarHtml(m,"sm")}<div><strong>${esc(m.display_name)}</strong><div class="muted">${m.id===me()?"Вы":m.role==="owner"?"Создатель":"Партнёр"}</div></div></div>`).join("");
  const ns=state.notificationSettings||{};
  const flags=["notify_event","notify_task","notify_shopping","notify_completed","notify_reminders"].map(k=>ns[k]!==false);
  notifSummary.textContent=flags.every(Boolean)?"Включены":flags.some(Boolean)?"Частично":"Выключены";
  rowSyncVal.textContent=syncStatus.textContent;
}

/* ---------- ОБЩИЙ РЕНДЕР ---------- */
function updateFab(){
  const hide=activeView==="profileView"||(activeView==="orgView"&&orgFilter==="shopping")||(activeView==="calendarView"&&calendarMode==="work");
  fab.classList.toggle("hidden",hide);
}

function renderAll(){
  if(!state)return;
  spaceTitle.textContent=state.space.name;
  profileBtn.innerHTML=avatarHtml(member(me())||state.me);
  if(activeView==="todayView")renderToday();
  else if(activeView==="calendarView")renderCalendarView();
  else if(activeView==="orgView")renderOrg();
  else if(activeView==="profileView")renderProfile();
  updateFab();
  bind();
}

function showView(view){
  activeView=view;
  if(view!=="profileView")lastMainView=view;
  ["todayView","calendarView","orgView","profileView"].forEach(id=>document.getElementById(id).classList.toggle("hidden",id!==view));
  document.querySelectorAll(".navItem").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  window.scrollTo(0,0);
  renderAll();
  updateFab();
}
function navigate(view){
  if(!(view==="calendarView")&&!leaveWorkGuard())return;
  showView(view);
}

/* ---------- ДЕЙСТВИЯ НАД ЭЛЕМЕНТАМИ ---------- */
function bind(){
  document.querySelectorAll("[data-toggle]").forEach(b=>b.onchange=()=>{const[t,id]=b.dataset.toggle.split("|");act(t==="tasks"?"toggle_task":"toggle_shopping",{id,is_completed:b.checked});});
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const[t,id]=b.dataset.del.split("|");act(t==="tasks"?"delete_task":"delete_shopping",{id});});
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{
    const [t,id]=b.dataset.edit.split("|");
    const item=(t==="tasks"?state.tasks:state.shopping).find(x=>x.id===id);
    if(item)openSimple(t,t==="tasks"?"Дело":"Покупка",item);
  });
  document.querySelectorAll("[data-edit-event]").forEach(b=>b.onclick=()=>{
    const item=state.events.find(x=>x.id===b.dataset.editEvent);
    if(item)openEventDialog(item);
  });
  document.querySelectorAll("[data-del-event]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.delEvent,seriesId=b.dataset.series;
    if(seriesId){pendingDeleteEventId=id;deleteSeriesDialog.showModal();}
    else act("delete_event",{id});
  });
  document.querySelectorAll("[data-extend-series]").forEach(b=>b.onclick=()=>act("extend_series",{series_id:b.dataset.extendSeries}));
  // Нажатие на запись в «Неделе» и «Дне» — открыть редактирование (только для автора записи)
  document.querySelectorAll("[data-open-event]").forEach(b=>b.onclick=()=>{
    const e=state.events.find(x=>x.id===b.dataset.openEvent);
    if(e&&e.created_by===me())openEventDialog(e);
  });
  document.querySelectorAll("[data-open-task]").forEach(b=>b.onclick=()=>{
    const t=state.tasks.find(x=>x.id===b.dataset.openTask);
    if(t&&t.created_by===me())openSimple("tasks","Дело",t);
  });
}

// Навигационные клики обрабатываем один раз на документе
document.addEventListener("click",e=>{
  const go=e.target.closest("[data-go]");
  if(go){
    const [view,arg]=go.dataset.go.split("|");
    if(view==="orgView"&&arg)orgFilter=arg;
    if(view==="calendarView"){
      if(!leaveWorkGuard())return;
      if(arg){calendarMode=arg;setSelected(todayISO());}
    }
    navigate(view);
    return;
  }
  const gd=e.target.closest("[data-goday]");
  if(gd){setSelected(gd.dataset.goday);calendarMode="day";scheduleShouldAutoscroll=true;renderAll();return;}
  const og=e.target.closest("[data-ofilter-go]");
  if(og){orgFilter=og.dataset.ofilterGo;renderAll();return;}
});

document.querySelectorAll(".navItem").forEach(b=>b.onclick=()=>{
  if(b.dataset.view==="calendarView"&&activeView==="calendarView")return;
  navigate(b.dataset.view);
});
profileBtn.onclick=()=>navigate("profileView");
profileBack.onclick=()=>showView(lastMainView);

document.querySelectorAll(".calViewBtn").forEach(b=>b.onclick=()=>{
  calendarMode=b.dataset.cview;
  if(calendarMode==="day")scheduleShouldAutoscroll=true;
  renderAll();
});
workModeBtn.onclick=()=>{enterWorkMode();renderAll();};
calBackBtn.onclick=()=>{if(!leaveWorkGuard())return;calendarMode="month";renderAll();};
rowWork.onclick=()=>{enterWorkMode();showView("calendarView");};
rowSync.onclick=()=>load();

document.querySelectorAll(".orgChip").forEach(b=>b.onclick=()=>{orgFilter=b.dataset.ofilter;renderAll();});

function changeMonth(delta){
  if(workDirty&&!confirm("Есть несохранённые изменения. Перейти к другому месяцу?"))return;
  workDirty=false;workSelection.clear();
  viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+delta,1);
  syncWorkDraftFromServer();
  renderAll();
}
prevMonth.onclick=()=>changeMonth(-1);
nextMonth.onclick=()=>changeMonth(1);
weekPrev.onclick=()=>{setSelected(addDays(selectedDate,-7));renderAll();};
weekNext.onclick=()=>{setSelected(addDays(selectedDate,7));renderAll();};
schedulePrev.onclick=()=>{setSelected(addDays(selectedDate,-1));scheduleShouldAutoscroll=true;renderAll();};
scheduleNext.onclick=()=>{setSelected(addDays(selectedDate,1));scheduleShouldAutoscroll=true;renderAll();};

/* ---------- ДОБАВЛЕНИЕ И ФОРМЫ ---------- */
function ctxDate(){
  if(activeView==="calendarView")return selectedDate;
  if(activeView==="todayView")return todayISO();
  return "";
}
fab.onclick=()=>addTypeDialog.showModal();
addTypeEventBtn.onclick=()=>{addTypeDialog.close();openEventDialog(null,ctxDate()||todayISO());};
addTypeTaskBtn.onclick=()=>{addTypeDialog.close();openSimple("tasks","Новое дело",null,ctxDate());};
addTypeShopBtn.onclick=()=>{addTypeDialog.close();openSimple("shopping","Новая покупка");};

function openEventDialog(existing,defaultDate){
  editingEventId=existing?existing.id:null;
  eventDialogTitle.textContent=existing?"Событие":"Новое событие";
  eventTitle.value=existing?existing.title:"";
  eventDate.value=existing?existing.event_date:(defaultDate||selectedDate);
  eventStart.value=existing?existing.start_time.slice(0,5):"";
  eventEnd.value=existing?existing.end_time.slice(0,5):"";
  eventReminder.value=existing?.reminder_minutes!==null&&existing?.reminder_minutes!==undefined?String(existing.reminder_minutes):"";
  eventRepeat.value="";
  eventRepeatUntil.value="";
  eventRepeatUntilWrap.classList.add("hidden");
  // Менять правило повтора у уже существующей серии не поддерживаем — только у новых событий.
  eventRepeatSection.classList.toggle("hidden",!!existing);
  eventDialog.showModal();
}
eventRepeat.onchange=()=>{eventRepeatUntilWrap.classList.toggle("hidden",!eventRepeat.value);};
eventForm.onsubmit=async e=>{
  e.preventDefault();
  if(eventEnd.value<=eventStart.value)return alert("Проверь время.");
  const payload={title:eventTitle.value.trim(),event_date:eventDate.value,start_time:eventStart.value,end_time:eventEnd.value,reminder_minutes:eventReminder.value===""?null:Number(eventReminder.value)};
  if(editingEventId){
    payload.id=editingEventId;
    await act("update_event",payload);
  }else{
    if(eventRepeat.value){
      payload.repeat_type=eventRepeat.value;
      if(eventRepeatUntil.value)payload.repeat_until=eventRepeatUntil.value;
    }
    await act("create_event",payload);
  }
  if(activeView==="calendarView")setSelected(eventDate.value);
  editingEventId=null;
  eventDialog.close();
  renderAll();
};

function openSimple(mode,title,existing,defaultDate){
  simpleMode=mode;
  editingSimpleId=existing?existing.id:null;
  simpleTitle.textContent=title;
  simpleInput.value=existing?existing.title:"";
  taskScheduleFields.classList.toggle("hidden",mode!=="tasks");
  if(mode==="tasks"&&existing?.due_at){
    const d=new Date(existing.due_at);
    taskDate.value=localISO(d);
    taskTime.value=hhmm(d);
  }else{
    taskDate.value=existing?"":(defaultDate||"");
    taskTime.value="";
  }
  taskReminder.value=existing?.reminder_minutes!==null&&existing?.reminder_minutes!==undefined?String(existing.reminder_minutes):"";
  simpleDialog.showModal();
}
simpleForm.onsubmit=async e=>{
  e.preventDefault();
  const payload={title:simpleInput.value.trim()};
  if(editingSimpleId)payload.id=editingSimpleId;
  if(simpleMode==="tasks"){
    const dueDate=taskDate.value,dueTime=taskTime.value,reminder=taskReminder.value;
    if(reminder!==""&&(!dueDate||!dueTime))return alert("Для напоминания укажи дату и время.");
    payload.due_date=dueDate||null;
    payload.due_time=dueTime||null;
    payload.reminder_minutes=reminder===""?null:Number(reminder);
    if(dueDate&&dueTime){
      // Храним момент в UTC, чтобы reminder-worker корректно сравнивал его с Date.now().
      const local=new Date(`${dueDate}T${dueTime}:00`);
      if(Number.isNaN(local.getTime()))return alert("Некорректная дата или время.");
      payload.due_at=local.toISOString();
    }else payload.due_at=null;
  }
  const action=editingSimpleId?(simpleMode==="tasks"?"update_task":"update_shopping"):(simpleMode==="tasks"?"create_task":"create_shopping");
  await act(action,payload);
  editingSimpleId=null;
  simpleDialog.close();
};

// Быстрое добавление покупки в списке
shopAddRow.onsubmit=async e=>{
  e.preventDefault();
  const title=shopAddInput.value.trim();
  if(!title)return;
  shopAddInput.value="";
  await act("create_shopping",{title});
};

deleteOneBtn.onclick=async()=>{
  const id=pendingDeleteEventId;pendingDeleteEventId=null;
  deleteSeriesDialog.close();
  if(id)await act("delete_event",{id});
};
deleteSeriesBtn.onclick=async()=>{
  const id=pendingDeleteEventId;pendingDeleteEventId=null;
  deleteSeriesDialog.close();
  if(id)await act("delete_event",{id,scope:"series"});
};

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());

/* ---------- ПРИГЛАШЕНИЕ, НАСТРОЙКИ ---------- */
inviteBtn.onclick=async()=>{
  const r=await act("create_invite");
  const link=`https://t.me/${CONFIG.BOT_USERNAME}?startapp=${r.token}`;
  const share="https://t.me/share/url?url="+encodeURIComponent(link)+"&text="+encodeURIComponent("Присоединяйся к моему пространству в parplan");
  if(tg?.openTelegramLink)tg.openTelegramLink(share);
  else navigator.clipboard.writeText(link);
};

function renderColorSettings(){
  const box=document.getElementById("colorSettingsList");if(!box)return;
  box.innerHTML=state.members.map(m=>`<div class="colorSettingRow"><div class="memberMini"><span class="memberAvatar" style="background:${color(m)}">${esc((m.display_name||"?")[0])}</span><span>${esc(m.display_name)}${m.id===me()?" · Вы":""}</span></div><div class="colorControls"><input type="color" value="${color(m)}" data-member-color="${m.id}"><button type="button" class="textBtn" data-reset-color="${m.id}">↺</button></div></div>`).join("");
  box.querySelectorAll("[data-member-color]").forEach(inp=>inp.oninput=()=>{setMemberColor(inp.dataset.memberColor,inp.value);renderColorSettings();renderAll();});
  box.querySelectorAll("[data-reset-color]").forEach(btn=>btn.onclick=()=>{resetMemberColor(btn.dataset.resetColor);renderColorSettings();renderAll();});
}
function openSettings(){
  spaceNameInput.value=state.space.name||"";
  renderColorSettings();
  const ns=state.notificationSettings||{};
  notifyEventToggle.checked=ns.notify_event!==false;
  notifyTaskToggle.checked=ns.notify_task!==false;
  notifyShoppingToggle.checked=ns.notify_shopping!==false;
  notifyCompletedToggle.checked=ns.notify_completed!==false;
  notifyRemindersToggle.checked=ns.notify_reminders!==false;
  settingsDialog.showModal();
}
document.querySelectorAll(".js-open-settings").forEach(b=>b.onclick=openSettings);
settingsForm.onsubmit=async e=>{
  e.preventDefault();
  const n=spaceNameInput.value.trim();
  if(n&&n!==state.space.name)await act("rename_space",{name:n});
  const notify_event=notifyEventToggle.checked;
  const notify_task=notifyTaskToggle.checked;
  const notify_shopping=notifyShoppingToggle.checked;
  const notify_completed=notifyCompletedToggle.checked;
  const notify_reminders=notifyRemindersToggle.checked;
  const ns=state.notificationSettings||{};
  if(ns.notify_event!==notify_event||ns.notify_task!==notify_task||ns.notify_shopping!==notify_shopping||ns.notify_completed!==notify_completed||ns.notify_reminders!==notify_reminders){
    await act("save_notification_settings",{notify_event,notify_task,notify_shopping,notify_completed,notify_reminders});
  }
  settingsDialog.close();
};

/* ---------- РАБОЧИЕ ДНИ: кнопки ---------- */
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
