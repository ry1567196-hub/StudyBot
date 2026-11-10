'use strict';
const TOKEN_KEY = 'studybot_token';
let authToken = localStorage.getItem(TOKEN_KEY) || '';
let currentQuiz = null;
let userAnswers = {};
let chatHistory = [];
const $ = (id) => document.getElementById(id);

const authScreen = $('authScreen'), app = $('app');
function message(text, type='') { $('authMessage').textContent = text; $('authMessage').className = `auth-message ${type}`.trim(); }
function showAuth(mode='login') {
  authScreen.classList.remove('hidden'); app.classList.add('hidden');
  const login = mode === 'login';
  $('loginForm').classList.toggle('hidden', !login);
  $('registerForm').classList.toggle('hidden', login);
  $('showLoginTab').classList.toggle('active', login);
  $('showRegisterTab').classList.toggle('active', !login);
  $('authTitle').textContent = login ? 'Welcome back.' : 'Start learning smarter.';
  $('authSubtitle').textContent = login ? 'Sign in to continue learning with StudyBot.' : 'Create your account and open your personal study desk.';
  message('');
}
function showApp(user={}) {
  authScreen.classList.add('hidden'); app.classList.remove('hidden');
  const name = user.name || user.email || 'Student';
  $('accountName').textContent = name; $('accountEmail').textContent = user.email || '';
  $('accountAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'S';
}
async function api(path, options={}) {
  const headers = {...(options.headers || {})};
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(path, {...options, headers});
  let data={}; try { data=await response.json(); } catch {}
  if (!response.ok || data.error) throw new Error(data.error || data.message || `Request failed (${response.status})`);
  return data;
}
function busy(button, state, label) { button.disabled=state; if(state) {button.dataset.oldText=button.textContent;button.textContent=label;} else button.textContent=button.dataset.oldText || label; }

$('showLoginTab').onclick=()=>showAuth('login');
$('showRegisterTab').onclick=()=>showAuth('register');
$('loginForm').addEventListener('submit', async e=>{
  e.preventDefault(); const btn=$('loginBtn'); busy(btn,true,'Signing in…'); message('');
  const email=$('loginEmail').value.trim().toLowerCase(), password=$('loginPassword').value;
  try {
    const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    if(!data.token) throw new Error('Server did not return a login token. Check the login route in server.js.');
    authToken=data.token; localStorage.setItem(TOKEN_KEY,authToken);
    let user=data.user;
    if(!user){try{const me=await api('/api/auth/me');user=me.user||me;}catch{user={email};}}
    showApp(user);
  } catch(err) { message(err.message || 'Login failed. Please try again.','error'); }
  finally { busy(btn,false,'Sign in'); }
});
$('registerForm').addEventListener('submit', async e=>{
  e.preventDefault(); const btn=$('registerBtn'); const name=$('registerName').value.trim();
  const email=$('registerEmail').value.trim().toLowerCase(), password=$('registerPassword').value;
  if(name.length<2){message('Name must contain at least 2 characters.','error');return;}
  if(password.length<8){message('Password must contain at least 8 characters.','error');return;}
  busy(btn,true,'Creating account…'); message('');
  try {
    const data=await api('/api/auth/register',{method:'POST',body:JSON.stringify({name,email,password})});
    if(data.token){
      authToken=data.token;localStorage.setItem(TOKEN_KEY,authToken);showApp(data.user||{name,email});
    } else {
      $('loginEmail').value=email; $('loginPassword').value=''; showAuth('login');
      message(data.message||'Account created successfully. Please sign in.','success');
    }
  } catch(err){message(err.message||'Registration failed. Please try again.','error');}
  finally{busy(btn,false,'Create account');}
});
$('logoutBtn').addEventListener('click',()=>{
  authToken='';localStorage.removeItem(TOKEN_KEY);chatHistory=[];
  $('chatWindow').replaceChildren();addBubble('bot',"Hi, I'm StudyBot. Ask me about your coursework, or use Notes, Flashcards, or Quiz.");
  showAuth('login');
});
async function initializeAuth(){
  if(!authToken){showAuth('login');return;}
  try{const data=await api('/api/auth/me');showApp(data.user||data);}
  catch{authToken='';localStorage.removeItem(TOKEN_KEY);showAuth('login');}
}

// Tabs
const railBtns=document.querySelectorAll('.rail-btn'), views=document.querySelectorAll('.view');
railBtns.forEach(btn=>btn.addEventListener('click',()=>{
  railBtns.forEach(b=>b.classList.remove('active'));views.forEach(v=>v.classList.remove('active'));
  btn.classList.add('active');$(`view-${btn.dataset.view}`).classList.add('active');
}));

// Chat
const chatWindow=$('chatWindow'), userInput=$('userInput');
userInput.addEventListener('input',()=>{userInput.style.height='auto';userInput.style.height=Math.min(userInput.scrollHeight,120)+'px';});
userInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
$('sendBtn').addEventListener('click',sendMessage);
function addBubble(role,text){
  const msg=document.createElement('div');msg.className=`msg ${role}`;
  const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=String(text??'');
  msg.appendChild(bubble);chatWindow.appendChild(msg);chatWindow.scrollTop=chatWindow.scrollHeight;return bubble;
}
async function sendMessage() {
  const text = userInput.value.trim();

  if (!text) return;

  addBubble('user', text);
  chatHistory.push({ role: 'user', text });

  userInput.value = '';
  userInput.style.height = 'auto';

  const btn = $('sendBtn');
  btn.disabled = true;

  const loading = addBubble('bot', 'Thinking…');

  try {
    const data = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text })
    });

    const reply = data.reply ?? data.response ?? data.message;

    if (typeof reply !== 'string') {
      throw new Error('Unexpected chat response. Check /api/chat in server.js.');
    }

    loading.textContent = reply;
    chatHistory.push({ role: 'bot', text: reply });

  } catch (err) {
    loading.textContent = '⚠️ ' + err.message;
  } finally {
    btn.disabled = false;
    userInput.focus();
  }
}
$('newChatBtn').onclick=()=>{chatHistory=[];chatWindow.replaceChildren();addBubble('bot','New chat started. Ask me anything!');};
$('exportBtn').onclick=()=>{
  if(!chatHistory.length){alert('No chat to export yet.');return;}
  downloadFile('StudyBot Chat Export\\n==============================\\n\\n'+chatHistory.map(m=>`${m.role==='user'?'You':'StudyBot'}: ${m.text}`).join('\\n\\n'),`chat-export-${Date.now()}.txt`);
};
function downloadFile(content,filename){
  const blob=new Blob([content],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// Notes
let lastNotesText='';
$('notesBtn').addEventListener('click',async()=>{
  const topic=$('notesTopic').value.trim();if(!topic)return alert('Please enter a topic.');
  const btn=$('notesBtn'),out=$('notesOutput');btn.disabled=true;btn.textContent='Generating…';out.classList.remove('empty');out.textContent='Writing your notes…';$('downloadNotesBtn').classList.add('hidden');
  try{const data=await api('/api/notes',{method:'POST',body:JSON.stringify({topic,style:$('notesStyle').value})});
    if(typeof data.notes!=='string')throw new Error('Unexpected notes response from server.');
    lastNotesText=data.notes;out.innerHTML=renderNotesMarkdown(data.notes);$('downloadNotesBtn').classList.remove('hidden');
  }catch(err){out.textContent='⚠️ '+err.message;}finally{btn.disabled=false;btn.textContent='Generate';}
});
$('downloadNotesBtn').onclick=()=>{if(lastNotesText)downloadFile(lastNotesText,`notes-${($('notesTopic').value.trim()||'notes').replace(/\\s+/g,'-').toLowerCase()}.txt`);};
function renderNotesMarkdown(raw){
  let html='',list=false;const close=()=>{if(list){html+='</ul>';list=false;}};
  String(raw).split('\\n').forEach(line=>{const t=line.trim();if(!t){close();return;}
    if(t.startsWith('# ')){close();html+=`<h1>${inlineFormat(t.slice(2))}</h1>`;}
    else if(t.startsWith('## ')){close();html+=`<h2>${inlineFormat(t.slice(3))}</h2>`;}
    else if(t.startsWith('- ')||t.startsWith('* ')){if(!list){html+='<ul>';list=true;}html+=`<li>${inlineFormat(t.slice(2))}</li>`;}
    else{close();html+=`<p>${inlineFormat(t)}</p>`;}
  });close();return html;
}
function inlineFormat(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');}

// Flashcards
$('flashBtn').addEventListener('click',async()=>{
  const topic=$('flashTopic').value.trim();if(!topic)return alert('Please enter a topic.');
  const btn=$('flashBtn'),grid=$('flashGrid');btn.disabled=true;btn.textContent='Generating…';grid.replaceChildren();
  try{const data=await api('/api/flashcards',{method:'POST',body:JSON.stringify({topic,count:$('flashCount').value})});
    if(!Array.isArray(data.cards))throw new Error('Unexpected flashcards response from server.');
    data.cards.forEach(card=>{
      const el=document.createElement('div');el.className='flash-card';const inner=document.createElement('div');inner.className='flash-inner';
      const front=document.createElement('div');front.className='flash-face flash-front';const label=document.createElement('span');label.className='flash-label';label.textContent='Term';
      front.append(label,document.createTextNode(String(card.term??'')));const back=document.createElement('div');back.className='flash-face flash-back';back.textContent=String(card.definition??'');
      inner.append(front,back);el.appendChild(inner);el.onclick=()=>el.classList.toggle('flipped');grid.appendChild(el);
    });
  }catch(err){const p=document.createElement('p');p.className='placeholder';p.textContent='⚠️ '+err.message;grid.appendChild(p);}
  finally{btn.disabled=false;btn.textContent='Generate';}
});

// Quiz
$('quizBtn').addEventListener('click',async()=>{
  const topic=$('quizTopic').value.trim();if(!topic)return alert('Please enter a topic for the quiz.');
  const btn=$('quizBtn');btn.disabled=true;btn.textContent='Generating…';$('quizFooterBar').classList.add('hidden');$('quizScore').textContent='';$('quizBody').replaceChildren();
  try{const data=await api('/api/quiz',{method:'POST',body:JSON.stringify({topic,numQuestions:$('quizCount').value,difficulty:$('quizDifficulty').value})});
    if(!Array.isArray(data.questions))throw new Error('Unexpected quiz response from server.');
    currentQuiz={...data,submitted:false};userAnswers={};renderQuiz(currentQuiz);$('quizFooterBar').classList.remove('hidden');
  }catch(err){$('quizBody').textContent='⚠️ '+err.message;}finally{btn.disabled=false;btn.textContent='Generate';}
});
function renderQuiz(quiz){
  const body=$('quizBody');body.replaceChildren();
  quiz.questions.forEach((q,i)=>{
    const block=document.createElement('div');block.className='q-block';const title=document.createElement('p');title.className='qtext';title.textContent=`${i+1}. ${q.question}`;block.appendChild(title);
    (q.options||[]).forEach((opt,j)=>{const b=document.createElement('button');b.type='button';b.className='option';b.textContent=opt;b.onclick=()=>{
      if(currentQuiz.submitted)return;block.querySelectorAll('.option').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');userAnswers[i]=j;
    };block.appendChild(b);});body.appendChild(block);
  });
}
$('submitQuiz').addEventListener('click',()=>{
  if(!currentQuiz||currentQuiz.submitted)return;let score=0;
  $('quizBody').querySelectorAll('.q-block').forEach((block,i)=>{
    const correct=Number(currentQuiz.questions[i].correctIndex);
    block.querySelectorAll('.option').forEach((b,j)=>{b.disabled=true;if(j===correct)b.classList.add('correct');if(userAnswers[i]===j&&j!==correct)b.classList.add('wrong');});
    if(userAnswers[i]===correct)score++;
  });
  currentQuiz.submitted=true;$('quizScore').textContent=`Score: ${score}/${currentQuiz.questions.length}`;
});
initializeAuth();
