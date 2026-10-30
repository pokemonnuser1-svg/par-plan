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
let shopTab="list";             // list | cats | history — вкладки внутри «Покупок»
let shopFilterGroup=null;       // показать только одну группу товаров
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
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1-.9-1.5-.9-2.5 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  star:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z"/>',
  dots:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  plane:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>'
};
function icon(name){
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||""}</svg>`;
}
document.querySelectorAll("[data-icon]").forEach(el=>{el.innerHTML=icon(el.dataset.icon);});

/* ---------- КАТЕГОРИИ ---------- */
const CATS=[
  {id:"work",name:"Работа",ic:"briefcase",color:"#3b82f6"},
  {id:"home",name:"Дом",ic:"home",color:"#8b5cf6"},
  {id:"health",name:"Здоровье",ic:"heart",color:"#ec4899"},
  {id:"rest",name:"Отдых",ic:"sun",color:"#f59e0b"},
  {id:"shopping",name:"Покупки",ic:"cart",color:"#19d3c5"},
  {id:"important",name:"Важное",ic:"star",color:"#ef5b6b"},
  {id:"other",name:"Другое",ic:"dots",color:"#8e97c0"}
];
/* ---------- ГРУППЫ ТОВАРОВ ---------- */
const GROUPS=[
  {id:"food",name:"Продукты",ic:"cart",color:"#19d3c5"},
  {id:"home",name:"Для дома",ic:"home",color:"#8b5cf6"},
  {id:"trip",name:"В поездку",ic:"plane",color:"#f59e0b"},
  {id:"other",name:"Другое",ic:"dots",color:"#8e97c0"}
];
function groupOf(x){return GROUPS.find(g=>g.id===x?.group_name)||GROUPS[GROUPS.length-1];}
const SHOP_GROUP_KEY="parplan_shop_group_v1";
function lastShopGroup(){const v=localStorage.getItem(SHOP_GROUP_KEY);return GROUPS.some(g=>g.id===v)?v:"food";}
function saveShopGroup(v){try{localStorage.setItem(SHOP_GROUP_KEY,v);}catch(_){}}
// «Молоко 2 шт» -> название «Молоко», количество «2 шт»
const QTY_RE=/^(.+?)\s+(\d+(?:[.,]\d+)?\s?(?:шт|кг|г|л|мл|уп|пач|пак|бут)\.?)$/i;
function splitQty(text){const m=text.match(QTY_RE);return m?{title:m[1].trim(),quantity:m[2].trim()}:{title:text,quantity:""};}
shopAddGroup.innerHTML=shopGroup.innerHTML=GROUPS.map(g=>`<option value="${g.id}">${g.name}</option>`).join("");
shopAddGroup.value=lastShopGroup();

function catOf(x){return CATS.find(c=>c.id===x?.category)||null;}
function rgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}

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
// Для событий и дел редактирование и удаление теперь в окне деталей. Иконки остались только у покупок.
function actionBtns(kind,x){
  if(kind!=="shopping"||x.created_by!==me())return "";
  return `<button class="iconAct" data-edit="shopping|${x.id}" aria-label="Изменить">${icon("edit")}</button><button class="iconAct del" data-del="shopping|${x.id}" aria-label="Удалить">${icon("trash")}</button>`;
}
// Карточка с временем слева (события и дела с датой)
function timeCard(it,{showDate=false}={}){
  const x=it.data,isTask=it.kind==="task",c=catOf(x);
  const sub=[];
  if(showDate)sub.push(dayLabel(it.date));
  if(c)sub.push(c.name);
  else if(isTask)sub.push("Дело");
  if(!isTask){const d=durText(x.start_time,x.end_time);if(d)sub.push(d);}
  if(x.reminder_minutes!==null&&x.reminder_minutes!==undefined)sub.push("🔔 "+reminderText(x.reminder_minutes));
  return `<div class="timeCard tappable k-${it.kind} ${x.is_completed?"done":""}" data-open-${it.kind}="${x.id}">
    <div class="tcTime">${it.time}</div><div class="tcBar"${c?` style="background:${c.color}"`:""}></div>
    <div class="tcBody"><div class="tcTitle">${esc(x.title)}${x.series_id?` <span class="rep">${icon("repeat")}</span>`:""}</div><div class="tcSub">${esc(sub.join(" · "))}</div></div>
    ${isTask?checkbox("tasks",x):""}
  </div>`;
}
// Строка списка с иконкой (Организация, Сегодня)
function itemRow(kind,x,{extra="",showGroup=false,plain=false}={}){
  const c=kind==="shopping"?null:catOf(x);
  const sub=[];
  if(c)sub.push(c.name);
  if(kind==="event"){
    sub.push(`${dayLabel(x.event_date)} · ${x.start_time.slice(0,5)}`);
  }else if(kind==="task"){
    if(x.due_at){const d=new Date(x.due_at);sub.push(`${dayLabel(localISO(d))} · ${hhmm(d)}`);}
    else sub.push("Без даты");
  }
  if(kind==="shopping"){
    if(showGroup)sub.push(groupOf(x).name);
    if(x.quantity)sub.push(x.quantity);
  }
  if(kind!=="shopping"&&x.reminder_minutes!==null&&x.reminder_minutes!==undefined)sub.push("🔔 "+reminderText(x.reminder_minutes));
  if(extra)sub.push(extra);
  const cls=kind==="event"?"ev":kind==="task"?"tk":"sh";
  const ic=c?c.ic:(kind==="event"?"calendar":kind==="task"?"check":"cart");
  const tileStyle=c?` style="background:${rgba(c.color,.2)};color:${c.color}"`:"";
  const box=kind==="event"?"":checkbox(kind==="task"?"tasks":"shopping",x);
  const open=kind==="shopping"?"":` data-open-${kind}="${x.id}"`;
  const chev=kind==="shopping"?"":`<span class="chev">${icon("chevron")}</span>`;
  return `<div class="row ${x.is_completed&&!plain?"done":""}${open?" tappable":""}"${open}>${box}<span class="ri ${cls}"${tileStyle}>${icon(ic)}</span>
    <div class="rowBody"><div class="rowTitle">${esc(x.title)}${x.series_id?` <span class="rep">${icon("repeat")}</span>`:""}</div>${sub.length?`<div class="rowSub">${esc(sub.join(" · "))}</div>`:""}</div>
    ${actionBtns(kind,x)}${chev}</div>`;
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
  const today=todayISO();

  calendar.innerHTML="";
  const weeks=Math.ceil((off+days)/7);
  for(let i=0;i<weeks*7;i++){
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
      b.innerHTML=`<span>${d}</span><span class="dots">${evDates.has(iso)?'<i class="dot ev"></i>':""}${taskDates.has(iso)?'<i class="dot tk"></i>':""}</span>`;
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
      return `<button class="wkItem k-${it.kind} ${x.is_completed?"done":""}" data-open-${it.kind}="${x.id}"><span class="wkTime">${it.time}</span><span class="wkBar"${catOf(x)?` style="background:${catOf(x).color}"`:""}></span><span class="wkTitle">${esc(x.title)}</span><span class="wkSub">${esc(sub)}</span></button>`;
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
    items.push({id:e.id,kind:"event",title:e.title,start,end:Math.max(end,start+20),category:e.category});
  }
  for(const t of state.tasks){
    if(!t.due_at||t.is_completed)continue;
    const dt=new Date(t.due_at);
    if(localISO(dt)!==iso)continue;
    const start=dt.getHours()*60+dt.getMinutes();
    items.push({id:t.id,kind:"task",title:t.title,start,end:start+30,category:t.category});
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
    return `<div class="scheduleBlock k-${it.kind}" data-open-${it.kind}="${it.id}" style="top:${top}px;height:${h}px;left:${leftPct}%;width:calc(${widthPct}% - 2px)${catOf(it)?`;background:${catOf(it).color}`:""}"><b>${esc(it.title)}</b>${compact?"":timeLabel}</div>`;
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
  shopAddRow.classList.toggle("hidden",orgFilter!=="shopping"||shopTab!=="list");
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
        html+=block("Покупки",open.slice(0,4).map(s=>itemRow("shopping",s,{showGroup:true})));
        if(open.length>4)html+=`<button class="linkBtn wide" data-ofilter-go="shopping">Показать все (${open.length}) ›</button>`;
      }
    }
  }

  if(orgFilter==="shopping")html=renderShopping();

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

/* ---------- ПОКУПКИ: Список / Категории / История ---------- */
function renderShopping(){
  const tabs=[["list","Список"],["cats","Категории"],["history","История"]];
  const tabBar=`<div class="seg">${tabs.map(([id,t])=>`<button class="segBtn ${shopTab===id?"active":""}" data-shoptab="${id}">${t}</button>`).join("")}</div>`;
  const open=state.shopping.filter(s=>!s.is_completed);
  let body="";

  if(shopTab==="list"){
    const parts=GROUPS.filter(g=>!shopFilterGroup||g.id===shopFilterGroup)
      .map(g=>({g,items:open.filter(s=>groupOf(s).id===g.id)}))
      .filter(p=>shopFilterGroup||p.items.length);
    const filterBar=shopFilterGroup?`<button class="linkBtn wide" data-shop-clear>Показать все группы ✕</button>`:"";
    body=filterBar+parts.map(({g,items})=>`<div class="secHead"><h3>${g.name}</h3><span class="secCount">${items.length}</span></div><div class="list">${items.length?items.map(s=>itemRow("shopping",s)).join(""):`<div class="empty">В этой группе пусто</div>`}</div>`).join("");
    if(!parts.length)body=`<div class="empty">Список покупок пуст</div>`;
  }else if(shopTab==="cats"){
    body=`<div class="shopTiles">${GROUPS.map(g=>{
      const n=open.filter(s=>groupOf(s).id===g.id).length;
      return `<button class="shopTile" data-shopgroup="${g.id}" style="--c:${g.color};--bg:${rgba(g.color,.2)}"><span class="catIc">${icon(g.ic)}</span><b>${g.name}</b><small>${n?`${n} в списке`:"Пусто"}</small></button>`;
    }).join("")}</div>`;
  }else{
    const done=state.shopping.filter(s=>s.is_completed)
      .sort((a,b)=>String(b.completed_at||"").localeCompare(String(a.completed_at||""))).slice(0,60);
    if(!done.length){
      body=`<div class="empty">История пуста: купленные товары появятся здесь</div>`;
    }else{
      const byDay=new Map();
      for(const s of done){
        const key=s.completed_at?localISO(new Date(s.completed_at)):"";
        if(!byDay.has(key))byDay.set(key,[]);
        byDay.get(key).push(s);
      }
      body=[...byDay].map(([day,items])=>block(day?dayLabel(day):"Раньше",items.map(s=>itemRow("shopping",s,{showGroup:true,plain:true})))).join("")
        +`<button class="linkBtn wide" data-shop-clear-history>Очистить историю</button>`;
    }
  }
  return tabBar+body;
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
  if(detailDialog.hasAttribute("open"))refreshDetail();
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
  document.querySelectorAll("[data-extend-series]").forEach(b=>b.onclick=()=>act("extend_series",{series_id:b.dataset.extendSeries}));
  // Нажатие на событие или дело (карточка, неделя, день) открывает окно деталей
  document.querySelectorAll("[data-open-event]").forEach(b=>b.onclick=ev=>{
    if(ev.target.closest("input,button.iconAct"))return;
    openDetail("event",b.dataset.openEvent);
  });
  document.querySelectorAll("[data-open-task]").forEach(b=>b.onclick=ev=>{
    if(ev.target.closest("input,button.iconAct"))return;
    openDetail("task",b.dataset.openTask);
  });
}

// Навигационные клики обрабатываем один раз на документе
document.addEventListener("click",e=>{
  const go=e.target.closest("[data-go]");
  if(go){
    const [view,arg]=go.dataset.go.split("|");
    if(view==="orgView"&&arg){orgFilter=arg;if(arg==="shopping"){shopTab="list";shopFilterGroup=null;}}
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
  if(og){orgFilter=og.dataset.ofilterGo;if(orgFilter==="shopping"){shopTab="list";shopFilterGroup=null;}renderAll();return;}
  const st=e.target.closest("[data-shoptab]");
  if(st){shopTab=st.dataset.shoptab;if(shopTab==="list")shopFilterGroup=null;renderAll();return;}
  const sg=e.target.closest("[data-shopgroup]");
  if(sg){shopFilterGroup=sg.dataset.shopgroup;shopTab="list";renderAll();return;}
  if(e.target.closest("[data-shop-clear]")){shopFilterGroup=null;renderAll();return;}
  if(e.target.closest("[data-shop-clear-history]")){
    if(confirm("Очистить историю? Все купленные товары будут удалены."))act("clear_shopping_history");
    return;
  }
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

function remVal(x){return x&&x.reminder_minutes!==null&&x.reminder_minutes!==undefined?String(x.reminder_minutes):"";}
let eventCat=null,taskCat=null;
function renderCats(box,current,onPick){
  box.innerHTML=CATS.map(c=>`<button type="button" class="catBtn ${c.id===current?"active":""}" data-cat="${c.id}" style="--c:${c.color};--bg:${rgba(c.color,.2)}"><span class="catIc">${icon(c.ic)}</span><span>${c.name}</span></button>`).join("");
  box.querySelectorAll(".catBtn").forEach(b=>b.onclick=()=>onPick(b.dataset.cat===current?null:b.dataset.cat));
}
function setEventCat(v){eventCat=v;renderCats(eventCats,eventCat,setEventCat);}
function setTaskCat(v){taskCat=v;renderCats(taskCats,taskCat,setTaskCat);}

// existing — редактирование; prefill — «Дублировать» (форма создания, заполненная данными записи)
function openEventDialog(existing,defaultDate,prefill){
  const src=existing||prefill||null;
  editingEventId=existing?existing.id:null;
  eventDialogTitle.textContent=existing?"Событие":"Новое событие";
  eventTitle.value=src?src.title:"";
  eventDate.value=existing?existing.event_date:(defaultDate||selectedDate);
  eventStart.value=src?src.start_time.slice(0,5):"";
  eventEnd.value=src?src.end_time.slice(0,5):"";
  eventReminder.value=remVal(src);
  eventDesc.value=src?.description||"";
  setEventCat(src?.category||null);
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
  const payload={title:eventTitle.value.trim(),event_date:eventDate.value,start_time:eventStart.value,end_time:eventEnd.value,reminder_minutes:eventReminder.value===""?null:Number(eventReminder.value),category:eventCat,description:eventDesc.value.trim()};
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

function openSimple(mode,title,existing,defaultDate,prefill){
  const src=existing||prefill||null;
  simpleMode=mode;
  editingSimpleId=existing?existing.id:null;
  simpleTitle.textContent=title;
  simpleInput.value=src?src.title:"";
  taskScheduleFields.classList.toggle("hidden",mode!=="tasks");
  taskExtraFields.classList.toggle("hidden",mode!=="tasks");
  shopExtraFields.classList.toggle("hidden",mode!=="shopping");
  if(mode==="shopping"){shopQty.value=src?.quantity||"";shopGroup.value=src?groupOf(src).id:lastShopGroup();}
  if(mode==="tasks"){setTaskCat(src?.category||null);taskDesc.value=src?.description||"";}
  if(mode==="tasks"&&src?.due_at){
    const d=new Date(src.due_at);
    taskDate.value=localISO(d);
    taskTime.value=hhmm(d);
  }else{
    taskDate.value=src?"":(defaultDate||"");
    taskTime.value="";
  }
  taskReminder.value=remVal(src);
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
    payload.category=taskCat;
    payload.description=taskDesc.value.trim();
    if(dueDate&&dueTime){
      // Храним момент в UTC, чтобы reminder-worker корректно сравнивал его с Date.now().
      const local=new Date(`${dueDate}T${dueTime}:00`);
      if(Number.isNaN(local.getTime()))return alert("Некорректная дата или время.");
      payload.due_at=local.toISOString();
    }else payload.due_at=null;
  }
  if(simpleMode==="shopping"){
    payload.quantity=shopQty.value.trim();
    payload.group=shopGroup.value;
    saveShopGroup(shopGroup.value);
  }
  const action=editingSimpleId?(simpleMode==="tasks"?"update_task":"update_shopping"):(simpleMode==="tasks"?"create_task":"create_shopping");
  await act(action,payload);
  editingSimpleId=null;
  simpleDialog.close();
};

// Быстрое добавление покупки в списке
shopAddRow.onsubmit=async e=>{
  e.preventDefault();
  const raw=shopAddInput.value.trim();
  if(!raw)return;
  const {title,quantity}=splitQty(raw);
  const group=shopAddGroup.value;
  saveShopGroup(group);
  shopAddInput.value="";
  await act("create_shopping",{title,quantity,group});
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

/* ---------- ДЕТАЛИ ---------- */
let detailRef=null;
function detailItem(){
  if(!detailRef)return null;
  return (detailRef.kind==="event"?state.events:state.tasks).find(i=>i.id===detailRef.id)||null;
}
function openDetail(kind,id){
  detailRef={kind,id};
  if(!detailItem())return;
  renderDetail();
  detailDialog.showModal();
}
function refreshDetail(){
  if(!detailItem()){detailDialog.close();return;}
  renderDetail();
}
function renderDetail(){
  const x=detailItem(),kind=detailRef.kind,c=catOf(x),mine=x.created_by===me();
  const tags=[`<span class="tag">${kind==="event"?"План":"Дело"}</span>`,`<span class="tag shared">Общее</span>`];
  if(c)tags.push(`<span class="tag" style="background:${rgba(c.color,.2)};color:${c.color}">${esc(c.name)}</span>`);
  detailTags.innerHTML=tags.join("");
  detailTitle.textContent=x.title;
  const dfmt=d=>cap(new Intl.DateTimeFormat("ru-RU",{weekday:"short",day:"numeric",month:"long"}).format(d));
  if(kind==="event")detailWhen.textContent=`${dfmt(new Date(x.event_date+"T12:00:00"))} · ${x.start_time.slice(0,5)} – ${x.end_time.slice(0,5)}`;
  else if(x.due_at){const d=new Date(x.due_at);detailWhen.textContent=`${dfmt(d)} · ${hhmm(d)}`;}
  else detailWhen.textContent="Без даты";
  detailDesc.textContent=x.description||"";
  detailDesc.classList.toggle("hidden",!x.description);
  const creator=member(x.created_by);
  const rows=[["bell","Напоминание",x.reminder_minutes!==null&&x.reminder_minutes!==undefined?reminderText(x.reminder_minutes):"Нет"]];
  if(kind==="event")rows.push(["repeat","Повтор",x.series_id?"Повторяется (серия)":"Не повторяется"]);
  rows.push(["palette","Категория",c?c.name:"Без категории"]);
  rows.push(["user","Создал(а)",creator?creator.display_name+(creator.id===me()?" (вы)":""):"—"]);
  detailRows.innerHTML=rows.map(([ic,l,v])=>`<div class="dRow"><span class="mIc">${icon(ic)}</span><div><div class="dLabel">${l}</div><div class="dVal">${esc(v)}</div></div></div>`).join("");
  detailDone.classList.toggle("hidden",kind!=="task");
  if(kind==="task")detailDoneLabel.textContent=x.is_completed?"Вернуть в работу":"Отметить выполненным";
  detailEdit.classList.toggle("hidden",!mine);
  detailDel.classList.toggle("hidden",!mine);
}
detailEdit.onclick=()=>{
  const x=detailItem();if(!x)return;
  const kind=detailRef.kind;
  detailDialog.close();
  if(kind==="event")openEventDialog(x);else openSimple("tasks","Дело",x);
};
detailDup.onclick=()=>{
  const x=detailItem();if(!x)return;
  const kind=detailRef.kind;
  detailDialog.close();
  if(kind==="event")openEventDialog(null,x.event_date,x);
  else openSimple("tasks","Новое дело",null,"",x);
};
detailDel.onclick=()=>{
  const x=detailItem();if(!x)return;
  const kind=detailRef.kind;
  if(kind==="event"&&x.series_id){detailDialog.close();pendingDeleteEventId=x.id;deleteSeriesDialog.showModal();return;}
  if(!confirm(`Удалить «${x.title}»?`))return;
  detailDialog.close();
  act(kind==="event"?"delete_event":"delete_task",{id:x.id});
};
detailDone.onclick=()=>{
  const x=detailItem();if(!x||detailRef.kind!=="task")return;
  act("toggle_task",{id:x.id,is_completed:!x.is_completed});
};

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
