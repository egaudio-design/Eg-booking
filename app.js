const {createClient}=supabase;const db=createClient(EG_CONFIG.SUPABASE_URL,EG_CONFIG.SUPABASE_ANON_KEY);let me,profiles=[],bookings=[],month=new Date(),cid;
const $=s=>document.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const fmt=d=>new Date(d+'T12:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
async function start(){let {data:{session}}=await db.auth.getSession();if(session)load();else $('#login').classList.remove('hide')}async function load(){let u=await db.auth.getUser();let r=await db.from('profiles').select('*').eq('id',u.data.user.id).single();if(r.error){$('#err').textContent=r.error.message;return}me=r.data;$('#login').classList.add('hide');$('#app').classList.remove('hide');$('#who').textContent=(me.name||me.email)+' · '+me.role;$('#adminTab').classList.toggle('hide',me.role!=='admin');await refresh();setupBookingUI()}
async function refresh(){let p=await db.from('profiles').select('*').order('name');profiles=p.data||[];let q=db.from('bookings').select('*').order('booking_date');if(me.role==='dj')q=q.or(`dj_id.eq.${me.id},dj_id.is.null`);if(me.role==='venue')q=q.eq('venue_id',me.id);let b=await q;bookings=b.data||[];draw();profile();people();if(me.role==='admin')admin()}
function draw(){let y=month.getFullYear(),m=month.getMonth();$('#month').textContent=new Date(y,m,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});let g=$('#cal');g.innerHTML=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(x=>`<div class="head">${x}</div>`).join('');let s=new Date(y,m,1).getDay();s=s===0?6:s-1;g.innerHTML+=Array(s).fill('<div></div>').join('');for(let d=1;d<=new Date(y,m+1,0).getDate();d++){let ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,bs=bookings.filter(x=>x.booking_date===ds),dots='';if(bs.some(x=>!x.dj_id))dots+='<i class="dot red"></i>';if(bs.some(x=>x.status==='En attente'))dots+='<i class="dot orange"></i>';if(bs.some(x=>x.status==='Confirmé'))dots+='<i class="dot green"></i>';g.innerHTML+=`<div class="day" data-date="${ds}"><b>${d}</b><div class="dots">${dots}</div></div>`}g.querySelectorAll('.day').forEach(x=>x.onclick=()=>dateClick(x.dataset.date));$('#bookings').innerHTML=bookings.map(b=>{let v=profiles.find(p=>p.id===b.venue_id),d=profiles.find(p=>p.id===b.dj_id);return `<div class="card"><b>📅 ${esc(fmt(b.booking_date))}</b><h3>🏢 ${esc(v?.function_or_venue||v?.name||'Établissement')}</h3><div>🎧 ${esc(d?.name||'DJ à définir')}</div><div>🕐 ${esc(b.time_text)}</div><div>📌 ${esc(b.status)}</div></div>`}).join('')}
async function dateClick(ds){let bs=bookings.filter(x=>x.booking_date===ds);let html=`<div class="card"><h3>${fmt(ds)}</h3>${bs.map(b=>`<p>🏢 ${esc(profiles.find(p=>p.id===b.venue_id)?.function_or_venue||'Établissement')} · 🎧 ${esc(profiles.find(p=>p.id===b.dj_id)?.name||'DJ à définir')} · ${esc(b.time_text)}</p>`).join('')||'Aucun booking.'}</div>`;if(me.role==='dj'&&bs.some(b=>!b.dj_id)){let b=bs.find(b=>!b.dj_id);if(confirm('Postuler à cette date sans DJ ?')){let msg=prompt('Message à l’administrateur :','Je suis disponible pour cette date.');let a=await db.from('applications').insert({booking_id:b.id,dj_id:me.id,message:msg||''});if(!a.error){let admin=profiles.find(p=>p.role==='admin');if(admin)await send(admin.id,`🎧 ${me.name} postule au booking du ${fmt(ds)}.`);alert('Candidature envoyée.')}}}else if(me.role==='venue'&&confirm('Envoyer une demande pour cette date ?')){let t=prompt('Horaires :','23:00 - 04:00')||'';let n=prompt('Informations :','')||'';await db.from('date_requests').insert({requested_date:ds,venue_id:me.id,time_text:t,notes:n});alert('Demande envoyée à l’administrateur.')}else alert(html.replace(/<[^>]+>/g,''))}
function profile(){$('#pname').value=me.name||'';$('#prole').value=me.function_or_venue||'';$('#pphone').value=me.phone||'';$('#pemail').value=me.email||'';$('#paddress').value=me.address||'';$('#pstyles').value=me.favorite_styles||''}
async function saveProfile(e){e.preventDefault();await db.from('profiles').update({name:$('#pname').value,function_or_venue:$('#prole').value,phone:$('#pphone').value,address:$('#paddress').value,favorite_styles:$('#pstyles').value,updated_at:new Date().toISOString()}).eq('id',me.id);await load()}
function people(){$('#people').innerHTML=profiles.filter(p=>p.id!==me.id).map(p=>`<div class="person" data-id="${p.id}"><b>${esc(p.name||p.email)}</b><br><small>${esc(p.role)}</small></div>`).join('');$('#people').querySelectorAll('.person').forEach(x=>x.onclick=()=>openChat(x.dataset.id))}
async function convo(uid){let mine=await db.from('conversation_members').select('conversation_id').eq('user_id',me.id);for(let x of mine.data||[]){let o=await db.from('conversation_members').select('user_id').eq('conversation_id',x.conversation_id).eq('user_id',uid);if(o.data?.length)return x.conversation_id}let c=await db.from('conversations').insert({}).select().single();await db.from('conversation_members').insert([{conversation_id:c.data.id,user_id:me.id},{conversation_id:c.data.id,user_id:uid}]);return c.data.id}
async function openChat(uid){cid=await convo(uid);let p=profiles.find(x=>x.id===uid);$('#chatTitle').textContent=p?.name||'Conversation';let r=await db.from('messages').select('*').eq('conversation_id',cid).order('created_at');$('#chat').className='chatbox';$('#chat').innerHTML=(r.data||[]).map(m=>`<div class="bubble ${m.sender_id===me.id?'mine':''}">${esc(m.body)}<small>${new Date(m.created_at).toLocaleString('fr-FR')}</small></div>`).join('');await db.from('messages').update({read_at:new Date().toISOString()}).eq('conversation_id',cid).neq('sender_id',me.id).is('read_at',null)}
async function send(uid,text){let c=await convo(uid);await db.from('messages').insert({conversation_id:c,sender_id:me.id,body:text})}async function sendMsg(e){e.preventDefault();if(!cid)return;await db.from('messages').insert({conversation_id:cid,sender_id:me.id,body:$('#text').value});$('#text').value='';let h=$('#chatTitle').textContent,p=profiles.find(x=>x.name===h);if(p)openChat(p.id)}
function setupBookingUI(){
  const btn=$('#planningCreate');
  if(!btn)return;
  btn.classList.toggle('hide',me.role!=='admin');
  btn.onclick=()=>openBookingModal();
  $('#closeBooking').onclick=closeBookingModal;
  $('#cancelBooking').onclick=closeBookingModal;
  $('#bookingForm').onsubmit=createBooking;
  const adminCreate=$('#createBooking');
  if(adminCreate) adminCreate.onclick=()=>openBookingModal();
  const newMsg=$('#newMsg');
  if(newMsg) newMsg.onclick=()=>{ const first=profiles.find(p=>p.id!==me.id); if(first) openChat(first.id); else alert('Aucun autre utilisateur disponible.'); };
  $('#bookingModal').onclick=e=>{if(e.target.id==='bookingModal')closeBookingModal()};
}
function openBookingModal(date){
  if(me.role!=='admin')return;
  const venues=profiles.filter(p=>p.role==='venue');
  const djs=profiles.filter(p=>p.role==='dj');
  $('#bVenue').innerHTML='<option value="">Sélectionner un établissement</option>'+venues.map(p=>`<option value="${p.id}">${esc(p.function_or_venue||p.name||p.email)}</option>`).join('');
  $('#bDj').innerHTML='<option value="">À définir</option>'+djs.map(p=>`<option value="${p.id}">${esc(p.name||p.email)}</option>`).join('');
  $('#bDate').value=date||new Date().toISOString().slice(0,10);
  $('#bTime').value='23:00 - 04:00'; $('#bType').value='Soirée DJ'; $('#bStatus').value='Confirmé'; $('#bNotes').value=''; $('#bookingErr').textContent='';
  $('#bookingModal').classList.remove('hide');
}
function closeBookingModal(){$('#bookingModal').classList.add('hide')}
async function createBooking(e){
  e.preventDefault();
  const payload={booking_date:$('#bDate').value,venue_id:$('#bVenue').value||null,dj_id:$('#bDj').value||null,time_text:$('#bTime').value,booking_type:$('#bType').value,status:$('#bStatus').value,notes:$('#bNotes').value,created_by:me.id};
  if(!payload.booking_date||!payload.venue_id){$('#bookingErr').textContent='Choisis une date et un établissement.';return}
  $('#bookingErr').textContent='Création…';
  const r=await db.from('bookings').insert(payload);
  if(r.error){$('#bookingErr').textContent=r.error.message;return}
  closeBookingModal(); await refresh(); month=new Date(payload.booking_date+'T12:00'); draw(); alert('Booking créé avec succès.');
}
function admin(){ $('#users').innerHTML=profiles.map(p=>`<div class="card"><b>${esc(p.name||p.email)}</b><br>${esc(p.role)}<br><button data-role="${p.id}">Changer le rang</button></div>`).join('');$('#users').querySelectorAll('[data-role]').forEach(b=>b.onclick=async()=>{let r=prompt('Rang : admin, dj ou venue');if(['admin','dj','venue'].includes(r)){await db.from('profiles').update({role:r}).eq('id',b.dataset.role);refresh()}});db.from('date_requests').select('*').then(r=>$('#requests').innerHTML=(r.data||[]).map(x=>`<div class="card">📅 ${esc(x.requested_date)} · ${esc(x.status)}<br>${esc(x.notes)}</div>`).join(''))}
function initUI(){
  const loginForm=$('#loginForm');
  if(loginForm) loginForm.onsubmit=async e=>{e.preventDefault();$('#err').textContent='Connexion…';let r=await db.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(r.error)$('#err').textContent=r.error.message;else $('#err').textContent='';};
  const logout=$('#logout'); if(logout) logout.onclick=async()=>{await db.auth.signOut();location.reload();};
  const pf=$('#profileForm'); if(pf) pf.onsubmit=saveProfile;
  const sendForm=$('#send'); if(sendForm) sendForm.onsubmit=sendMsg;
  const prev=$('#prev'); if(prev) prev.onclick=()=>{month.setMonth(month.getMonth()-1);draw();};
  const next=$('#next'); if(next) next.onclick=()=>{month.setMonth(month.getMonth()+1);draw();};
  document.querySelectorAll('nav button[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('main section').forEach(s=>s.classList.add('hide'));const target=$('#'+b.dataset.tab);if(target)target.classList.remove('hide');});
}
initUI();start();
