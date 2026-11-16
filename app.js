const TYPES={el:{n:"آسانسور",c:"var(--el)"},li:{n:"بالابر",c:"var(--li)"},hl:{n:"هوم لیفت",c:"var(--hl)"}};
const STAT=["در حال نصب","نصب‌شده","تحویل‌شده","نیاز به سرویس"];
let items=[],tab="map",db=null,draft=null,memFallback=false;

/* ---------- storage (IndexedDB, fallback to memory) ---------- */
function openDB(){return new Promise(res=>{try{const r=indexedDB.open("liftmap",1);r.onupgradeneeded=()=>r.result.createObjectStore("p",{keyPath:"id"});r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>{memFallback=true;res()}}catch(e){memFallback=true;res()}})}
function loadAll(){return new Promise(res=>{if(!db)return res([]);try{const q=db.transaction("p").objectStore("p").getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])}catch(e){res([])}})}
function put(o){if(!db)return;try{const t=db.transaction("p","readwrite");t.objectStore("p").put(o);t.onerror=t.onabort=()=>alert("ذخیرهٔ دائمی انجام نشد (احتمالاً حافظهٔ مرورگر پر است). ویدیو یا عکس‌های کمتری اضافه کنید.")}catch(e){alert("ذخیرهٔ دائمی انجام نشد.")}}
function del(id){if(!db)return;try{db.transaction("p","readwrite").objectStore("p").delete(id)}catch(e){}}

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const gmap=p=>`https://www.google.com/maps?q=${p.lat},${p.lng}`;
function resize(file){return new Promise(res=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const m=900,k=Math.min(1,m/Math.max(im.width,im.height));const c=document.createElement("canvas");c.width=im.width*k;c.height=im.height*k;c.getContext("2d").drawImage(im,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",.7))};im.src=r.result};r.readAsDataURL(file)})}

/* ---------- views ---------- */
let flt="all",q="",sl=[],si=0;
const DS={co:"",ph:"",th:"auto",tab:"map",hc:false,start:false};
const S=(()=>{try{return Object.assign({},DS,JSON.parse(localStorage.getItem("lm_s")||"{}"))}catch(e){return Object.assign({},DS)}})();
function applyS(){const r=document.documentElement;if(S.th==="auto")r.removeAttribute("data-theme");else r.dataset.theme=S.th;$("#ttl").textContent="🏗️ "+(S.co||"نقشه آسانسور و بالابر")}
const vis=()=>items.filter(p=>(flt==="all"||p.type===flt)&&(!q||[p.name,p.client,p.spec,p.notes,p.status].join(" ").includes(q)));
const nf=n=>n.toLocaleString("fa");
const b2d=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
const d2b=u=>{const [h,x]=u.split(","),s=atob(x),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return new Blob([a],{type:h.match(/:(.*?);/)[1]})};
function chips(){const c=t=>items.filter(p=>p.type===t).length;
  return '<div class="chips">'+[["all","همه",items.length]].concat(Object.keys(TYPES).map(k=>[k,TYPES[k].n,c(k)])).map(a=>`<button class="chip${flt===a[0]?" on":""}" data-f="${a[0]}">${a[1]}<b>${nf(a[2])}</b></button>`).join("")+'</div>'+(tab==="list"?`<input id="sq" placeholder="جستجو در نام، کارفرما، توضیحات…" value="${esc(q)}" style="margin-bottom:10px">`:"")}
function bind(){const m=$("#main"),go=r=>r.querySelectorAll("[data-id]").forEach(e=>e.onclick=()=>showDetail(e.dataset.id));go(m);
  m.querySelectorAll("[data-f]").forEach(e=>e.onclick=()=>{flt=e.dataset.f;render()});
  const s=$("#sq");if(s)s.oninput=()=>{q=s.value.trim();const v=$("#vw");v.innerHTML=listView()||'<div class="empty">موردی پیدا نشد</div>';go(v)}}
function shareP(p){const t=p.name+(p.spec?" — "+p.spec:"")+(p.lat!=null?"\n"+gmap(p):"");
  if(navigator.share)navigator.share({title:p.name,text:t}).catch(e=>{if(e.name!=="AbortError")prompt("کپی کنید:",t)});else prompt("کپی کنید:",t)}
async function saveFile(name,data){
  /* داخل محیط Claude از downloads استفاده می‌شود؛ در وب‌اپ آنلاین دانلود استاندارد مرورگر */
  if(window.claude&&claude.use){try{const d=await claude.use("downloads");if(d){await d.save({filename:name,data:data});return true}}catch(e){}}
  const blob=data instanceof Blob?data:new Blob([data],{type:"application/json"});
  const u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download=name;a.style.display="none";document.body.appendChild(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(u)},4000);return true}
async function saveVid(b){try{const e=(b.type.split("/")[1]||"mp4").split(";")[0];await saveFile("video."+(["mp4","webm","mov"].includes(e)?e:"mp4"),b)}catch(x){}}
function showcase(i){sl=vis();if(!sl.length){alert("موردی برای نمایش نیست");return}si=Math.max(0,Math.min(i||0,sl.length-1));drawShow();$("#show").classList.add("on")}
function drawShow(){const p=sl[si],n=sl.length,
  ph=(p.photos||[]).map(s=>`<img src="${s}" alt="">`).join(""),vd=(p.videos||[]).map(b=>`<video src="${URL.createObjectURL(b)}" controls playsinline preload="metadata"></video>`).join(""),
  rows=[["کارفرما",S.hc?"":p.client],["مشخصات",p.spec],["وضعیت",p.status],["تاریخ نصب",p.date]].filter(r=>r[1]).map(r=>`<div class="kv"><span class="mu">${r[0]}</span><span>${esc(r[1])}</span></div>`).join("");
  $("#show").innerHTML=`<div class="sh-top"><b>${esc(S.co||"نمونه‌کارها")}</b><span class="mu">${nf(si+1)} / ${nf(n)}</span><button class="btn" id="sx">✕ بستن</button></div>
  <div class="sh-body"><h2 style="margin:4px 0 8px">${esc(p.name)} <span class="badge" style="background:${TYPES[p.type].c}">${TYPES[p.type].n}</span></h2>
  ${p.lat!=null?mapView(p.id).replace(/<div class="note">[\s\S]*$/,""):""}
  ${ph||vd?`<div class="sh-med">${ph}${vd}</div>`:""}${rows}${p.notes?`<p>${esc(p.notes)}</p>`:""}${S.ph?`<p class="mu">📞 ${esc(S.ph)}</p>`:""}</div>
  <div class="sh-nav"><button class="btn" id="spv">→ قبلی</button>${p.lat!=null?`<a class="btn p" href="${gmap(p)}" target="_blank" rel="noopener">📍 گوگل‌مپ</a>`:""}<button class="btn" id="snx">بعدی ←</button></div>`;
  $("#sx").onclick=()=>$("#show").classList.remove("on");
  $("#spv").onclick=()=>{si=(si-1+n)%n;drawShow()};$("#snx").onclick=()=>{si=(si+1)%n;drawShow()};
  document.querySelectorAll(".sh-med img").forEach(i=>i.onclick=()=>viewImg(i.src))}
let tx=0;$("#show").addEventListener("touchstart",e=>tx=e.touches[0].clientX,{passive:true});
$("#show").addEventListener("touchend",e=>{const d=e.changedTouches[0].clientX-tx;if(Math.abs(d)>70&&sl.length>1&&!e.target.closest(".sh-med")){si=(si+(d<0?1:-1)+sl.length)%sl.length;drawShow()}},{passive:true});
$("#pl0").onclick=()=>showcase(0);
$("#se").onclick=()=>{openSheet(`<h2 style="margin:0 0 8px">⚙️ تنظیمات</h2>
  <label>نام شرکت / برند (بالای برنامه و حالت نمایش)</label><input id="s_co" value="${esc(S.co)}">
  <label>شمارهٔ تماس (در حالت نمایش)</label><input id="s_ph" inputmode="tel" value="${esc(S.ph)}">
  <label>پوسته</label><select id="s_th"><option value="auto">خودکار</option><option value="light">روشن</option><option value="dark">تیره</option></select>
  <label>صفحهٔ شروع</label><select id="s_tab"><option value="map">نقشه</option><option value="list">فهرست</option></select>
  <label><input type="checkbox" id="s_hc" style="width:auto"> مخفی کردن نام کارفرما در حالت نمایش</label>
  <label><input type="checkbox" id="s_st" style="width:auto"> باز شدن برنامه مستقیم در حالت نمایش</label>
  <p class="mu">برای دسترسی سریع، لینک برنامه را به صفحهٔ اصلی گوشی اضافه کنید. با گذاشتن <b>#showcase</b> آخر لینک هم مستقیم وارد حالت نمایش می‌شود.</p>
  <div class="row"><button class="btn p" id="s_ok" style="flex:1">ذخیره</button><button class="btn" id="s_cl">بستن</button></div>`);
  $("#s_th").value=S.th;$("#s_tab").value=S.tab;$("#s_hc").checked=S.hc;$("#s_st").checked=S.start;$("#s_cl").onclick=closeSheet;
  $("#s_ok").onclick=()=>{S.co=$("#s_co").value.trim();S.ph=$("#s_ph").value.trim();S.th=$("#s_th").value;S.tab=$("#s_tab").value;S.hc=$("#s_hc").checked;S.start=$("#s_st").checked;try{localStorage.setItem("lm_s",JSON.stringify(S))}catch(e){}applyS();closeSheet()}};
function render(){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("on",b.dataset.t===tab));
  const m=$("#main");
  if(!items.length){m.innerHTML='<div class="empty">هنوز پروژه‌ای ثبت نشده.<br>با دکمه + اولین مورد را اضافه کنید.</div>';return}
m.innerHTML=chips()+'<div id="vw">'+((tab==="map"?mapView():listView())||'<div class="empty">موردی پیدا نشد</div>')+'</div>';
bind();
if(tab==="map")initLeafletMap();
}
function listView(){
  return vis().sort((a,b)=>b.id.localeCompare(a.id)).map(p=>`<div class="card" data-id="${p.id}">
  ${p.photos&&p.photos[0]?`<img class="thumb" src="${p.photos[0]}" alt="">`:'<div class="thumb"></div>'}
  <div><b>${esc(p.name)}</b><span class="badge" style="background:${TYPES[p.type].c}">${TYPES[p.type].n}</span>
  <div class="mu">${esc(p.client||"")} ${p.status?"· "+esc(p.status):""} ${(p.videos||[]).length?"· 🎥 "+p.videos.length:""}</div></div></div>`).join("");
}

function mapView(hl){
  const pts=vis().filter(p=>p.lat!=null&&p.lng!=null);
  if(!pts.length)return listView();

  return `
    <div id="leaflet-map"
      class="mapbox"
      style="width:100%;height:500px;border-radius:14px;z-index:1">
    </div>
    <div class="note">
      🔵 آسانسور &nbsp; 🟠 بالابر &nbsp; 🟣 هوم لیفت
      <br>برای مشاهده جزئیات، روی نشانگر پروژه بزنید.
    </div>
  `;
}
/* ---------- sheet ---------- */
/* ---------- Leaflet map ---------- */
let liftMapInstance = null;

function initLeafletMap(){
  const el = document.getElementById("leaflet-map");
  if(!el)return;

  if(typeof L === "undefined"){
    el.innerHTML = "نقشه بارگذاری نشد. اتصال اینترنت را بررسی کنید.";
    return;
  }

  if(liftMapInstance){
    liftMapInstance.remove();
    liftMapInstance = null;
  }

  const pts = vis().filter(p=>p.lat!=null&&p.lng!=null);
  if(!pts.length)return;

  const map = L.map(el).setView(
    [pts[0].lat,pts[0].lng],13
  );

  liftMapInstance = map;

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom:19,
      attribution:'&copy; OpenStreetMap'
    }
  ).addTo(map);

  const bounds = [];

  pts.forEach(p=>{
    const colors = {
      el:"#1d6fe8",
      li:"#e8832a",
      hl:"#8b5cf6"
    };

    const marker = L.circleMarker(
      [p.lat,p.lng],
      {
        radius:10,
        color:"#ffffff",
        weight:3,
        fillColor:colors[p.type]||"#1d6fe8",
        fillOpacity:1
      }
    ).addTo(map);

    marker.bindTooltip(p.name);

    marker.on("click",()=>{
      showDetail(p.id);
    });

    bounds.push([p.lat,p.lng]);
  });

  if(bounds.length>1){
    map.fitBounds(bounds,{padding:[35,35],maxZoom:16});
  }

  requestAnimationFrame(()=>{
    map.invalidateSize();
  });
}


/* ---------- sheet ---------- */
function openSheet(h){$("#panel").innerHTML=h;$("#sheet").classList.add("show")}
function closeSheet(){$("#sheet").classList.remove("show")}
$("#sheet").onclick=e=>{if(e.target.id==="sheet")closeSheet()};

function showDetail(id){
  const p=items.find(x=>x.id===id);if(!p)return;
  openSheet(`<h2 style="margin:0 0 6px">${esc(p.name)}</h2>
  <span class="badge" style="background:${TYPES[p.type].c}">${TYPES[p.type].n}</span>
  <div style="margin-top:10px">
  ${[["کارفرما",p.client],["ظرفیت / مشخصات",p.spec],["وضعیت",p.status],["تاریخ نصب",p.date],["مختصات",p.lat!=null?p.lat.toFixed(5)+" , "+p.lng.toFixed(5):""]].filter(r=>r[1]).map(r=>`<div class="kv"><span class="mu">${r[0]}</span><span>${esc(r[1])}</span></div>`).join("")}
  ${p.notes?`<p>${esc(p.notes)}</p>`:""}</div>
  <div class="photos" id="ph">${(p.photos||[]).map((s,i)=>`<div><img src="${s}" data-i="${i}" alt=""></div>`).join("")}</div>
  <div class="vids" id="vd">${(p.videos||[]).map((v,i)=>{const u=URL.createObjectURL(v);return `<video src="${u}" controls playsinline preload="metadata"></video><button class="btn" data-dv="${i}" style="margin-top:6px">⬇️ ذخیرهٔ ویدیو ${i+1}</button>`}).join("")}</div>
  <div class="row" style="margin-top:14px">
   ${p.lat!=null?`<a class="btn p" style="text-decoration:none;flex:1;text-align:center" href="${gmap(p)}" target="_blank" rel="noopener">باز کردن در گوگل‌مپ</a>`:""}
   <button class="btn" id="ed">ویرایش</button><button class="btn" id="cl">بستن</button></div>
  <div class="row" style="margin-top:8px">${p.lat!=null?`<a class="btn" style="text-decoration:none;flex:1;text-align:center" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener">🧭 مسیریابی</a>`:""}<button class="btn" id="shr" style="flex:1">📤 اشتراک</button><button class="btn" id="pl" style="flex:1">🎬 نمایش</button></div>`);
  $("#ed").onclick=()=>form(p);$("#cl").onclick=closeSheet;
  $("#shr").onclick=()=>shareP(p);
  $("#pl").onclick=()=>{closeSheet();let i=vis().findIndex(x=>x.id===p.id);if(i<0){flt="all";q="";render();i=vis().findIndex(x=>x.id===p.id)}showcase(i)};
  document.querySelectorAll("[data-dv]").forEach(b=>b.onclick=()=>saveVid(p.videos[b.dataset.dv]));
  document.querySelectorAll("#ph img").forEach(i=>i.onclick=()=>viewImg(p.photos[i.dataset.i]));
}
function viewImg(s){$("#vimg").src=s;$("#viewer").style.display="flex"}
$("#viewer").onclick=()=>$("#viewer").style.display="none";

function form(p){
  draft=p?Object.assign({},p,{photos:(p.photos||[]).slice(),videos:(p.videos||[]).slice()}):{id:Date.now().toString(36),type:"el",name:"",client:"",spec:"",status:STAT[0],date:"",notes:"",lat:null,lng:null,photos:[],videos:[]};
  const d=draft;
  openSheet(`<h2 style="margin:0">${p?"ویرایش":"پروژه جدید"}</h2>
  <label>نام پروژه</label><input id="f_name" value="${esc(d.name)}">
  <label>نوع</label><select id="f_type"><option value="el">آسانسور</option><option value="li">بالابر</option><option value="hl">هوم لیفت</option></select>
  <label>کارفرما</label><input id="f_client" value="${esc(d.client)}">
  <label>ظرفیت / مشخصات</label><input id="f_spec" value="${esc(d.spec)}" placeholder="مثلاً ۸ نفره، ۶ توقف">
  <div class="row"><div style="flex:1"><label>وضعیت</label><select id="f_status">${STAT.map(s=>`<option>${s}</option>`).join("")}</select></div>
  <div style="flex:1"><label>تاریخ نصب</label><input id="f_date" value="${esc(d.date)}" placeholder="۱۴۰۵/۰۸/۲۳"></div></div>
  <label>موقعیت</label>
  <div class="row"><input id="f_lat" inputmode="decimal" placeholder="عرض جغرافیایی" value="${d.lat??""}"><input id="f_lng" inputmode="decimal" placeholder="طول جغرافیایی" value="${d.lng??""}"></div>
  <button class="btn" id="gps" style="margin-top:8px;width:100%">📍 ثبت موقعیت فعلی من</button>
  <div class="row" style="margin-top:8px"><a class="btn" id="omap" href="https://www.google.com/maps" target="_blank" rel="noopener" style="flex:1;text-align:center;text-decoration:none">🗺️ انتخاب روی نقشه</a><button class="btn" id="pst" style="flex:1">📋 چسباندن موقعیت</button></div>
  <div class="mu" id="gpsmsg"></div>
  <label>توضیحات</label><textarea id="f_notes" rows="3">${esc(d.notes)}</textarea>
  <label>عکس‌ها</label><input type="file" id="f_ph" accept="image/*" multiple>
  <div class="photos" id="pv"></div>
  <label>ویدیوها</label><input type="file" id="f_vid" accept="video/*" multiple>
  <div class="mu">ویدیوها فقط روی همین دستگاه ذخیره می‌شوند و در «پشتیبان» متنی نیستند. حجم زیاد حافظهٔ مرورگر را پر می‌کند.</div>
  <div id="vv"></div>
  <div class="row" style="margin-top:16px"><button class="btn p" id="sv" style="flex:1">ذخیره</button>
  ${p?'<button class="btn d" id="rm">حذف</button>':""}<button class="btn" id="cn">انصراف</button></div>`);
  $("#f_type").value=d.type;$("#f_status").value=d.status;
  pv();vv();
  $("#f_vid").onchange=e=>{for(const f of e.target.files){if(f.size>150*1024*1024&&!confirm("این ویدیو بزرگ است (بیش از ۱۵۰ مگابایت) و ممکن است ذخیره نشود. ادامه می‌دهید؟"))continue;d.videos.push(new Blob([f],{type:f.type||"video/mp4"}))}e.target.value="";vv()};
  $("#f_ph").onchange=async e=>{for(const f of e.target.files)d.photos.push(await resize(f));e.target.value="";pv()};
  $("#gps").onclick=()=>{const m=$("#gpsmsg");m.textContent="در حال دریافت موقعیت…";
    if(!navigator.geolocation){m.textContent="مرورگر از GPS پشتیبانی نمی‌کند؛ مختصات را دستی وارد کنید.";return}
    navigator.geolocation.getCurrentPosition(r=>{$("#f_lat").value=r.coords.latitude.toFixed(6);$("#f_lng").value=r.coords.longitude.toFixed(6);m.textContent="ثبت شد ✓"},()=>m.textContent="دسترسی به موقعیت ممکن نشد. مجوز مکان را بدهید یا مختصات را دستی وارد کنید.",{enableHighAccuracy:true,timeout:15000})};
  $("#cn").onclick=()=>p?showDetail(p.id):closeSheet();
  const fa=s=>s.replace(/[۰-۹]/g,c=>"۰۱۲۳۴۵۶۷۸۹".indexOf(c)).replace(/[٠-٩]/g,c=>"٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/٫/g,".");
  function parseLoc(t){t=fa(t||"");let m=t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)||t.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/)||t.match(/(-?\d{1,3}\.\d+)[\s,،;]+(-?\d{1,3}\.\d+)/);return m?[parseFloat(m[1]),parseFloat(m[2])]:null}
  function applyLoc(t){const r=parseLoc(t),m=$("#gpsmsg");if(!r||Math.abs(r[0])>90||Math.abs(r[1])>180){m.textContent="مختصاتی پیدا نشد. اگر لینک کوتاه (goo.gl) است، لینک را باز کنید و مختصات بالای صفحه را کپی کنید.";return}$("#f_lat").value=r[0];$("#f_lng").value=r[1];m.textContent="ثبت شد ✓"}
  $("#omap").onclick=()=>{const la=parseFloat($("#f_lat").value),lo=parseFloat($("#f_lng").value);const u=isFinite(la)&&isFinite(lo)?`https://www.google.com/maps?q=${la},${lo}`:"https://www.google.com/maps";$("#omap").href=u;try{navigator.clipboard.writeText(u)}catch(e){}$("#gpsmsg").textContent="در گوگل‌مپ نقطه را نگه دارید تا پین بیفتد، مختصات بالای صفحه را بزنید تا کپی شود، برگردید و «چسباندن موقعیت» را بزنید."};
  $("#pst").onclick=async()=>{let t="";try{t=await navigator.clipboard.readText()}catch(e){}if(!t||!parseLoc(t))t=prompt("مختصات یا لینک گوگل‌مپ را بچسبانید:")||"";if(t)applyLoc(t)};
  if(p)$("#rm").onclick=()=>{if(confirm("این پروژه حذف شود؟")){items=items.filter(x=>x.id!==p.id);del(p.id);closeSheet();render()}};
  $("#sv").onclick=()=>{
    d.name=$("#f_name").value.trim();if(!d.name){$("#f_name").focus();return}
    d.type=$("#f_type").value;d.client=$("#f_client").value.trim();d.spec=$("#f_spec").value.trim();d.status=$("#f_status").value;d.date=$("#f_date").value.trim();d.notes=$("#f_notes").value.trim();
    const la=parseFloat($("#f_lat").value),lo=parseFloat($("#f_lng").value);d.lat=isFinite(la)?la:null;d.lng=isFinite(lo)?lo:null;
    const i=items.findIndex(x=>x.id===d.id);if(i>=0)items[i]=d;else items.push(d);
    put(d);closeSheet();render()};
}
function vv(){const box=$("#vv");box.innerHTML=draft.videos.map((b,i)=>`<div class="vt"><video src="${URL.createObjectURL(b)}" controls playsinline preload="metadata"></video><i data-v="${i}">×</i></div>`).join("");
  box.querySelectorAll("[data-v]").forEach(x=>x.onclick=()=>{draft.videos.splice(x.dataset.v,1);vv()})}
function pv(){$("#pv").innerHTML=draft.photos.map((s,i)=>`<div><img src="${s}" alt=""><i data-r="${i}">×</i></div>`).join("");
  document.querySelectorAll("[data-r]").forEach(x=>x.onclick=()=>{draft.photos.splice(x.dataset.r,1);pv()})}

/* ---------- backup ---------- */
$("#bk").onclick=()=>{
  openSheet(`<h2 style="margin:0 0 8px">پشتیبان‌گیری</h2>
  <p class="mu">اطلاعات فقط روی همین مرورگر ذخیره می‌شود (ویدیوها در پشتیبان متنی نیستند). برای انتقال به گوشی یا مرورگر دیگر، متن پشتیبان را کپی و در آنجا وارد کنید.</p>
  <textarea id="bt" rows="6" placeholder="برای وارد کردن، متن پشتیبان را اینجا بچسبانید"></textarea>
  <div class="row" style="margin-top:10px"><button class="btn" id="exf">💾 ذخیرهٔ فایل (با عکس و ویدیو)</button><button class="btn" id="imf">📂 وارد کردن از فایل</button><input type="file" id="imi" accept=".json,application/json" hidden></div>
  <div class="row" style="margin-top:8px"><button class="btn" id="ex">نمایش پشتیبان متنی</button><button class="btn p" id="im">وارد کردن</button><button class="btn" id="cl2">بستن</button></div>`);
  $("#ex").onclick=()=>{$("#bt").value=JSON.stringify(items.map(p=>Object.assign({},p,{videos:undefined})));$("#bt").select()};
  $("#im").onclick=()=>{try{const a=JSON.parse($("#bt").value);if(!Array.isArray(a))throw 0;a.forEach(o=>{if(o&&o.id&&o.name){const i=items.findIndex(x=>x.id===o.id);o.videos=Array.isArray(o.videos)&&typeof o.videos[0]==="string"?o.videos.map(d2b):(i>=0?items[i].videos||[]:[]);if(i>=0)items[i]=o;else items.push(o);put(o)}});closeSheet();render()}catch(e){alert("متن پشتیبان معتبر نیست")}};
  $("#cl2").onclick=closeSheet;
  $("#exf").onclick=async()=>{const b=$("#exf"),t=b.textContent;b.textContent="در حال آماده‌سازی…";try{const o=[];for(const p of items)o.push(Object.assign({},p,{videos:await Promise.all((p.videos||[]).map(b2d))}));await saveFile("lift-map-backup.json",JSON.stringify(o))}catch(e){}finally{b.textContent=t}};
  $("#imf").onclick=()=>$("#imi").click();
  $("#imi").onchange=async e=>{const f=e.target.files[0];if(!f)return;$("#bt").value=await f.text();$("#im").click()};
};

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{tab=b.dataset.t;render()});
$("#add").onclick=()=>form(null);
(async()=>{applyS();tab=S.tab;await openDB();items=await loadAll();render();if(S.start||location.hash==="#showcase")showcase(0)})();

/* ثبت Service Worker (کار آفلاین + نصب روی صفحهٔ اصلی) و درخواست ذخیرهٔ ماندگار */
(function(){
  try{
    if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(function(){})}
  }catch(e){}
  if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
    window.addEventListener("load",function(){
      navigator.serviceWorker.register("sw.js").catch(function(){});
    });
  }
})();
