import { useState, useCallback } from "react";

const BS = 5;
const EMOJI  = { 王:"👑", 守:"🛡️", 馬:"🐴", 獅:"🦁", 愚:"🐸", 雀:"🐦", 砲:"💣" };
const NAMES  = { 王:"おうさま", 守:"まもり", 馬:"うま", 獅:"らいおん", 愚:"ぐしゃ", 雀:"すずめ", 砲:"たいほう" };
const HAS_SKILL = { 馬:true, 獅:true, 愚:true, 砲:true };
const SKILL_NAME = { 馬:"ごそう", 獅:"ほうこう", 愚:"てんい", 砲:"ほうげき" };
const PVAL = { 王:10000, 守:90, 馬:110, 獅:120, 愚:80, 雀:35, 砲:120 };
const ALL_PIECES = ["王","守","馬","獅","愚","雀","雀","雀","砲"];
const AI_NAME = "にくさん";

// 難易度設定
// randomRate: この確率でランダムな手を選ぶ（弱くする）
const DIFFICULTY = {
  weak:   { label:"よわい", emoji:"🌱", depth:1, useSkill:false, improvedEval:false, randomRate:0.4, thinkMax:1000 },
  normal: { label:"ふつう", emoji:"⚔️",  depth:2, useSkill:true,  improvedEval:false, randomRate:0.2, thinkMax:2000 },
  strong: { label:"つよい", emoji:"🔥", depth:3, useSkill:true,  improvedEval:true,  randomRate:0.0, thinkMax:3000 },
};

const inB = (r,c) => r>=0 && r<BS && c>=0 && c<BS;
const cloneBoard = b => b.map(r=>[...r]);
const emptySquares = board => {
  const sq=[];
  for(let r=0;r<BS;r++) for(let c=0;c<BS;c++) if(!board[r][c]) sq.push([r,c]);
  return sq;
};
const findKing = (board,owner) => {
  for(let r=0;r<BS;r++) for(let c=0;c<BS;c++)
    if(board[r][c]?.type==="王"&&board[r][c]?.owner===owner) return [r,c];
  return null;
};
const opp = o => o==="player"?"ai":"player";

// 守衛パッシブ：相手大砲が守衛を飛び越えられない
function cannonCanLand(board, fr, fc, dr, dc, owner) {
  const tr=fr+dr*2, tc=fc+dc*2;
  if(!inB(tr,tc)) return false;
  if(board[tr][tc]?.owner===owner) return false;
  const mid=board[fr+dr]?.[fc+dc];
  if(mid && mid.type==="守" && mid.owner!==owner) return false;
  return true;
}

// スズメ前方移動：守衛以外飛び越え可
function suzumeFwd(board, r, c, owner) {
  const d=owner==="player"?-1:1;
  const moves=[];
  const r1=r+d, c1=c;
  if(!inB(r1,c1)) return moves;
  const p1=board[r1][c1];
  if(!p1||p1.owner!==owner) moves.push([r1,c1]);
  const r2=r+d*2, c2=c;
  if(inB(r2,c2)&&!(p1&&p1.type==="守")) {
    if(!board[r2][c2]||board[r2][c2].owner!==owner) moves.push([r2,c2]);
  }
  return moves;
}

function getMoves(board, r, c) {
  const p=board[r][c]; if(!p) return [];
  const {type,owner}=p;
  const d=owner==="player"?-1:1;
  const moves=[];
  const tryAdd=(tr,tc)=>{ if(!inB(tr,tc)||board[tr][tc]?.owner===owner) return; moves.push([tr,tc]); };
  const trySlide=(tr,tc)=>{ if(!inB(tr,tc)||board[tr][tc]?.owner===owner) return false; moves.push([tr,tc]); return !board[tr][tc]; };
  switch(type){
    case "王": break;
    case "守": for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) tryAdd(r+dr,c+dc); break;
    case "馬":
      for(let s=1;s<=2;s++) if(!trySlide(r+d*s,c)) break;
      for(let s=1;s<=2;s++) if(!trySlide(r-d*s,c)) break;
      for(let s=1;s<=2;s++) if(!trySlide(r,c-s)) break;
      for(let s=1;s<=2;s++) if(!trySlide(r,c+s)) break;
      break;
    case "獅": tryAdd(r+d,c);tryAdd(r-d,c);tryAdd(r,c-1);tryAdd(r,c+1);tryAdd(r+d,c-1);tryAdd(r+d,c+1); break;
    case "愚": tryAdd(r-1,c-1);tryAdd(r-1,c+1);tryAdd(r+1,c-1);tryAdd(r+1,c+1); break;
    case "雀": for(const m of suzumeFwd(board,r,c,owner)) moves.push(m); tryAdd(r,c-1);tryAdd(r,c+1); break;
    case "砲":
      for(const [dr,dc] of [[-1,0],[1,0],[-1,-1],[-1,1],[1,-1],[1,1]])
        if(cannonCanLand(board,r,c,dr,dc,owner)) moves.push([r+dr*2,c+dc*2]);
      break;
  }
  return moves;
}

function isInCheck(board, owner) {
  const king=findKing(board,owner); if(!king) return false;
  const [kr,kc]=king;
  for(let r=0;r<BS;r++) for(let c=0;c<BS;c++){
    const p=board[r][c]; if(p?.owner!==opp(owner)) continue;
    if(getMoves(board,r,c).some(([mr,mc])=>mr===kr&&mc===kc)) return true;
  }
  return false;
}

function getHorseTarget(board,r,c){
  const p=board[r][c]; if(!p||p.type!=="馬") return null;
  const d=p.owner==="player"?-1:1;
  const tr=r+d,tc=c;
  if(!inB(tr,tc)||board[tr][tc]) return null;
  return [tr,tc];
}
function getLionTargets(board,lr,lc){
  const p=board[lr][lc]; if(!p||p.type!=="獅") return [];
  const d=p.owner==="player"?-1:1;
  const targets=[];
  for(let r=0;r<BS;r++) for(let c=0;c<BS;c++){
    const t=board[r][c]; if(!t||t.owner===p.owner||t.type==="王") continue;
    const pr=r+d,pc=c;
    if(!inB(pr,pc)||board[pr][pc]) continue;
    targets.push({from:[r,c],to:[pr,pc]});
  }
  return targets;
}
function getFoolDests(board,owner){
  const forbidden=owner==="player"?0:BS-1;
  return emptySquares(board).filter(([r])=>r!==forbidden);
}
function getFoolPieces(board,owner,fr,fc){
  const ps=[];
  for(let r=0;r<BS;r++) for(let c=0;c<BS;c++){
    const p=board[r][c];
    if(p?.owner===owner&&p.type!=="王"&&!(r===fr&&c===fc)) ps.push([r,c]);
  }
  return ps;
}

// ── AI Search ──
function generateActions(board,cap,owner,useSkill){
  const actions=[];
  for(let r=0;r<BS;r++) for(let c=0;c<BS;c++){
    const p=board[r][c]; if(p?.owner!==owner) continue;
    for(const [tr,tc] of getMoves(board,r,c)) actions.push({kind:"move",from:[r,c],to:[tr,tc]});
  }
  const seen=new Set();
  for(const t of cap[owner]){ if(seen.has(t)) continue; seen.add(t);
    for(const [er,ec] of emptySquares(board)) actions.push({kind:"drop",type:t,to:[er,ec]}); }
  if(useSkill){
    for(let r=0;r<BS;r++) for(let c=0;c<BS;c++){
      const p=board[r][c]; if(p?.owner!==owner) continue;
      if(p.type==="馬"){ const t=getHorseTarget(board,r,c); const k=findKing(board,owner);
        if(t&&k) actions.push({kind:"skill_horse",kingFrom:k,dest:t}); }
      if(p.type==="獅") for(const push of getLionTargets(board,r,c)) actions.push({kind:"skill_lion",...push});
      if(p.type==="愚"){ const dests=getFoolDests(board,owner);
        for(const [pr,pc] of getFoolPieces(board,owner,r,c))
          for(const [er,ec] of dests) actions.push({kind:"skill_fool",pick:[pr,pc],dest:[er,ec]}); }
      if(p.type==="砲"){ const s2=new Set();
        for(const t of cap[opp(owner)]){ if(s2.has(t)) continue; s2.add(t);
          actions.push({kind:"skill_cannon",removeType:t,removeOwner:opp(owner)}); } }
    }
  }
  return actions;
}

function applyAction(board,cap,action,owner){
  const nb=cloneBoard(board); const nc={player:[...cap.player],ai:[...cap.ai]};
  switch(action.kind){
    case "move":{ const [fr,fc]=action.from,[tr,tc]=action.to;
      if(nb[tr][tc]) nc[owner].push(nb[tr][tc].type);
      nb[tr][tc]=nb[fr][fc]; nb[fr][fc]=null; break; }
    case "drop": nb[action.to[0]][action.to[1]]={type:action.type,owner};
      nc[owner].splice(nc[owner].indexOf(action.type),1); break;
    case "skill_horse":{ const [kr,kc]=action.kingFrom,[dr,dc]=action.dest;
      if(!nb[dr][dc]){nb[dr][dc]=nb[kr][kc];nb[kr][kc]=null;} break; }
    case "skill_lion": nb[action.to[0]][action.to[1]]=nb[action.from[0]][action.from[1]];
      nb[action.from[0]][action.from[1]]=null; break;
    case "skill_fool":{ const [pr,pc]=action.pick,[dr,dc]=action.dest;
      if(!nb[dr][dc]){nb[dr][dc]=nb[pr][pc];nb[pr][pc]=null;} break; }
    case "skill_cannon":{ const idx=nc[action.removeOwner].indexOf(action.removeType);
      if(idx!==-1) nc[action.removeOwner].splice(idx,1); break; }
  }
  return {board:nb,captured:nc};
}

function evalBoard(board,cap,improved){
  let s=0;
  for(let r=0;r<BS;r++) for(let c=0;c<BS;c++){
    const p=board[r][c]; if(!p) continue;
    const sg=p.owner==="ai"?1:-1; s+=sg*(PVAL[p.type]||0);
    if(improved){ s+=sg*(p.owner==="ai"?r:(BS-1-r))*4;
      s+=sg*(4-Math.abs(c-2)-Math.abs(r-2))*3;
      if(p.type!=="王") s+=sg*getMoves(board,r,c).length*2; }
  }
  for(const t of cap.ai)     s+=(PVAL[t]||0)*0.5;
  for(const t of cap.player) s-=(PVAL[t]||0)*0.5;
  return s;
}

function alphaBeta(board,cap,depth,alpha,beta,maximizing,useSkill,improved,deadline){
  if(Date.now()>deadline) return evalBoard(board,cap,improved);
  if(!findKing(board,"ai"))     return -99999;
  if(!findKing(board,"player")) return  99999;
  if(depth===0) return evalBoard(board,cap,improved);
  const owner=maximizing?"ai":"player";
  const actions=generateActions(board,cap,owner,useSkill);
  actions.sort((a,b)=>{
    const va=a.kind==="move"&&board[a.to[0]][a.to[1]]?(PVAL[board[a.to[0]][a.to[1]].type]||0):0;
    const vb=b.kind==="move"&&board[b.to[0]][b.to[1]]?(PVAL[board[b.to[0]][b.to[1]].type]||0):0;
    return vb-va;
  });
  if(!actions.length) return evalBoard(board,cap,improved);
  if(maximizing){
    let best=-Infinity;
    for(const a of actions){ const {board:nb,captured:nc}=applyAction(board,cap,a,owner);
      best=Math.max(best,alphaBeta(nb,nc,depth-1,alpha,beta,false,useSkill,improved,deadline));
      alpha=Math.max(alpha,best); if(beta<=alpha) break; }
    return best;
  } else {
    let best=Infinity;
    for(const a of actions){ const {board:nb,captured:nc}=applyAction(board,cap,a,owner);
      best=Math.min(best,alphaBeta(nb,nc,depth-1,alpha,beta,true,useSkill,improved,deadline));
      beta=Math.min(beta,best); if(beta<=alpha) break; }
    return best;
  }
}

function pickBest(board,cap,diffKey){
  const {depth,useSkill,improvedEval,randomRate,thinkMax}=DIFFICULTY[diffKey];
  const deadline=Date.now()+thinkMax;
  const actions=generateActions(board,cap,"ai",useSkill);
  if(!actions.length) return null;
  // 王様を取れるなら必ず取る
  const kc=actions.find(a=>a.kind==="move"&&board[a.to[0]][a.to[1]]?.type==="王");
  if(kc) return kc;
  // ランダム手
  if(Math.random()<randomRate) return actions[Math.floor(Math.random()*actions.length)];
  let bestVal=-Infinity,bestAction=null;
  for(const a of [...actions].sort(()=>Math.random()-0.5)){
    if(Date.now()>deadline) break;
    const {board:nb,captured:nc}=applyAction(board,cap,a,"ai");
    const val=alphaBeta(nb,nc,depth-1,-Infinity,Infinity,false,useSkill,improvedEval,deadline);
    if(val>bestVal){bestVal=val;bestAction=a;}
  }
  return bestAction||actions[Math.floor(Math.random()*actions.length)];
}

function scoreAiPlace(type,r,c){
  let s=0;
  if(type==="王") s+=(c===2?12:0)+(r===0?8:0);
  if(type==="守") s+=(c>=1&&c<=3?6:0)+(r===0?4:0);
  if(type==="馬") s+=(r===1?10:0);
  if(type==="獅") s+=(r===1?8:0)+(c===0||c===4?6:0);
  if(type==="雀") s+=(r===1?12:0)+Math.random()*3;
  if(type==="愚") s+=(r===0?8:0)+(c===0||c===4?5:0);
  if(type==="砲") s+=(r===0?10:0)+Math.random()*3;
  return s+Math.random()*2;
}
function pickAiPlace(board,hand){
  const avail=[]; for(let r=0;r<=1;r++) for(let c=0;c<BS;c++) if(!board[r][c]) avail.push([r,c]);
  if(!avail.length||!hand.length) return null;
  let best=null,bestS=-Infinity;
  for(const t of hand) for(const [r,c] of avail){ const s=scoreAiPlace(t,r,c); if(s>bestS){bestS=s;best={type:t,r,c};} }
  return best;
}

// ══════════════════════════════════════════
//  初期状態ファクトリ
// ══════════════════════════════════════════
function freshState(){
  return {
    board: Array(BS).fill(null).map(()=>Array(BS).fill(null)),
    playerHand: [...ALL_PIECES],
    aiHand:     [...ALL_PIECES],
    // setupStep: 0〜13。偶数=1Pターン、奇数=2P/AIターン
    setupStep:  0,
    selSetup:   null,
    captured:   {player:[],ai:[]},
    selected:   null,
    validMoves: [],
    turn:       "player",
    winner:     null,
    thinking:   false,
    skill:      null,
    skillHL:    [],
    lastMove:   null,
    actionLog:  [],
    checkState: {player:false,ai:false},
    cannonModal:null,
    gameOver:   false,
  };
}

// ══════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════
export default function Genshougi(){
  const [mode,        setMode]        = useState(null);   // null|"ai"|"2p"
  const [phase,       setPhase]       = useState("top");  // top|setup|game
  const [difficulty,  setDifficulty]  = useState(null);
  const [st,          setSt]          = useState(freshState); // all game state

  // state updater helper
  const upd = useCallback((patch)=> setSt(prev=>({...prev,...patch})),[]);

  const addLog = useCallback((txt,who)=>{
    setSt(prev=>({...prev,actionLog:[{txt,who},...prev.actionLog].slice(0,20)}));
  },[]);

  const updateCheck = useCallback((b)=>{
    upd({checkState:{player:isInCheck(b,"player"),ai:isInCheck(b,"ai")}});
  },[upd]);

  // ── 配置フェーズ ──
  // setupStep: 0,2,4,...12 = 1Pターン（計7回）
  //            1,3,5,...13 = 2P/AIターン（計7回）
  // 14になったらゲーム開始
  const setupOwner  = st.setupStep%2===0 ? "player" : "ai";
  const setupIsDone = st.setupStep >= 14;

  // AI自動配置を実行する
  const runAiSetup = useCallback((board, hand, step)=>{
    setTimeout(()=>{
      const picked=pickAiPlace(board,hand);
      if(!picked){ upd({setupStep:step+1}); return; }
      const nb=cloneBoard(board);
      nb[picked.r][picked.c]={type:picked.type,owner:"ai"};
      const nh=[...hand]; nh.splice(nh.indexOf(picked.type),1);
      const nextStep=step+1;
      if(nextStep>=14){
        upd({board:nb,aiHand:nh,setupStep:nextStep,checkState:{player:false,ai:false}});
        setPhase("game");
      } else {
        upd({board:nb,aiHand:nh,setupStep:nextStep});
      }
    },350);
  },[upd]);

  // セルクリック（配置フェーズ）
  const onSetupCell = useCallback((r,c)=>{
    if(phase!=="setup"||st.setupStep>=14) return;
    const isPlayerTurn = st.setupStep%2===0;
    const currentOwner = isPlayerTurn?"player":"ai";

    // 2PモードでAIターンのとき、かつmode=ai→操作不可（runAiSetupが担当）
    if(mode==="ai"&&!isPlayerTurn) return;

    // ゾーン制限
    if(isPlayerTurn && r<3) return;
    if(!isPlayerTurn && r>1) return;

    if(st.selSetup===null) return;
    const currentHand=isPlayerTurn?st.playerHand:st.aiHand;
    if(st.selSetup>=currentHand.length) return;

    // 置いた駒をタップ→戻す
    if(st.board[r][c]?.owner===currentOwner){
      const nb=cloneBoard(st.board); const ret=nb[r][c].type; nb[r][c]=null;
      const nh=[...currentHand,ret];
      const prevStep=st.setupStep-2; // 1つ前の自分のターンに戻す
      if(isPlayerTurn) upd({board:nb,playerHand:nh,selSetup:null,setupStep:Math.max(0,prevStep)});
      else             upd({board:nb,aiHand:nh,   selSetup:null,setupStep:Math.max(1,prevStep)});
      return;
    }
    if(st.board[r][c]) return;

    const type=currentHand[st.selSetup];
    // 7枚目の王様チェック
    const myPlaced=Math.floor(st.setupStep/2); // 今まで自分が置いた枚数
    if(myPlaced===6){
      const after=currentHand.filter((_,i)=>i!==st.selSetup);
      if(after.includes("王")&&type!=="王"){ alert("⚠️ 7まいめは👑おうさまにしてね！"); return; }
    }

    const nb=cloneBoard(st.board);
    nb[r][c]={type,owner:currentOwner};
    const nh=[...currentHand]; nh.splice(st.selSetup,1);
    const nextStep=st.setupStep+1;

    if(nextStep>=14){
      // 両方配置完了→ゲーム開始
      const patch=isPlayerTurn
        ?{board:nb,playerHand:nh,selSetup:null,setupStep:nextStep}
        :{board:nb,aiHand:nh,   selSetup:null,setupStep:nextStep};
      upd(patch); setPhase("game"); updateCheck(nb);
    } else if(mode==="ai"&&nextStep%2===1){
      // 1Pが置いた→AIのターン
      upd({board:nb,playerHand:nh,selSetup:null,setupStep:nextStep});
      runAiSetup(nb,st.aiHand,nextStep);
    } else {
      // 2Pモード or AIターン後の1Pへ
      const patch=isPlayerTurn
        ?{board:nb,playerHand:nh,selSetup:null,setupStep:nextStep}
        :{board:nb,aiHand:nh,   selSetup:null,setupStep:nextStep};
      upd(patch);
    }
  },[phase,st,mode,upd,runAiSetup,updateCheck]);

  // ── AIゲームターン ──
  const doAiTurn = useCallback((b,cap)=>{
    upd({turn:"ai",thinking:true});
    const {thinkMax}=DIFFICULTY[difficulty||"weak"];
    setTimeout(()=>{
      const action=pickBest(b,cap,difficulty);
      if(!action){
        upd({turn:"player",thinking:false});
        updateCheck(b); return;
      }
      let logTxt=`🔴${AI_NAME}: `;
      if(action.kind==="move"){
        const fp=b[action.from[0]][action.from[1]];
        logTxt+=`${EMOJI[fp?.type]||"?"} →(${action.to[1]+1},${BS-action.to[0]})`;
      } else if(action.kind==="drop") logTxt+=`${EMOJI[action.type]} うつ`;
      else if(action.kind==="skill_horse") logTxt+="⚡ごそう";
      else if(action.kind==="skill_lion")  logTxt+="⚡ほうこう";
      else if(action.kind==="skill_fool")  logTxt+="⚡てんい";
      else if(action.kind==="skill_cannon") logTxt+=`⚡ほうげき「${EMOJI[action.removeType]}」`;
      const {board:nb,captured:nc}=applyAction(b,cap,action,"ai");
      const alive=nb.flat().some(p=>p?.type==="王"&&p?.owner==="player");
      const newCheck={player:isInCheck(nb,"player"),ai:isInCheck(nb,"ai")};
      const newLog=[{txt:logTxt,who:"ai"}];
      if(!alive) newLog.unshift({txt:`💀 ${AI_NAME}のかち！`,who:"system"});
      else if(newCheck.player) newLog.unshift({txt:"⚠️ あなたの王様におうて！",who:"system"});
      upd({
        board:nb, captured:nc, lastMove:action.to||action.dest||null,
        thinking:false, checkState:newCheck,
        actionLog:[...newLog,...[]]  // will merge below
      });
      setSt(prev=>({...prev,
        board:nb,captured:nc,lastMove:action.to||action.dest||null,
        thinking:false,checkState:newCheck,
        actionLog:[...newLog,...prev.actionLog].slice(0,20),
        ...(alive?{turn:"player"}:{winner:"ai",gameOver:true})
      }));
    },50);
  },[difficulty,updateCheck,upd]);

  const cancelSkill = useCallback(()=>{
    upd({skill:null,skillHL:[],selected:null,validMoves:[]});
  },[upd]);

  // ── スキルボタン ──
  const onSkillBtn = useCallback(()=>{
    if(!st.selected||st.selected.drop||st.thinking||st.gameOver) return;
    const {r,c}=st.selected; const p=st.board[r][c];
    if(!p||!HAS_SKILL[p.type]) return;
    if(p.type==="馬"){
      const t=getHorseTarget(st.board,r,c);
      if(!t){ alert("前のマスがふさがってるよ"); return; }
      upd({skill:{phase:"horse",target:t,owner:p.owner},skillHL:[{r:t[0],c:t[1]}],selected:null,validMoves:[]});
    } else if(p.type==="獅"){
      const ts=getLionTargets(st.board,r,c);
      if(!ts.length){ alert("おせる敵がいないよ"); return; }
      upd({skill:{phase:"lion",lr:r,lc:c,owner:p.owner},skillHL:ts.map(t=>({r:t.from[0],c:t.from[1]})),selected:null,validMoves:[]});
    } else if(p.type==="愚"){
      const opts=getFoolPieces(st.board,p.owner,r,c);
      if(!opts.length){ alert("うごかせる仲間がいないよ"); return; }
      upd({skill:{phase:"fool_piece",fr:r,fc:c,owner:p.owner},skillHL:opts.map(([rr,cc])=>({r:rr,c:cc})),selected:null,validMoves:[]});
    } else if(p.type==="砲"){
      const oppOwner=opp(p.owner);
      if(!st.captured[oppOwner].length){ alert("相手の手駒がないよ"); return; }
      upd({cannonModal:{list:[...st.captured[oppOwner]],skillOwner:p.owner},skill:{phase:"cannon",owner:p.owner},selected:null,validMoves:[]});
    }
  },[st,upd]);

  const onCannonSelect = useCallback((type)=>{
    const skillOwner=st.cannonModal.skillOwner;
    const oppOwner=opp(skillOwner);
    const nc={player:[...st.captured.player],ai:[...st.captured.ai]};
    const idx=nc[oppOwner].indexOf(type); if(idx!==-1) nc[oppOwner].splice(idx,1);
    const logTxt=`${skillOwner==="player"?"🟢1P":`🔴${mode==="2p"?"2P":AI_NAME}`}: ⚡ほうげき「${EMOJI[type]}」除外`;
    upd({captured:nc,cannonModal:null,skill:null,skillHL:[]});
    setSt(prev=>({...prev,captured:nc,cannonModal:null,skill:null,skillHL:[],
      actionLog:[{txt:logTxt,who:skillOwner},...prev.actionLog].slice(0,20)}));
    if(mode==="ai"){ doAiTurn(st.board,nc); }
    else { upd({turn:opp(skillOwner)}); updateCheck(st.board); }
  },[st,mode,doAiTurn,updateCheck,upd]);

  // ── メインセルクリック ──
  const onGameCell = useCallback((r,c)=>{
    if(st.gameOver||st.thinking||st.cannonModal) return;
    if(mode==="ai"&&st.turn==="ai") return;
    const currentOwner=st.turn;

    if(st.skill){
      const sp=st.skill.phase;
      if(sp==="horse"){
        const [tr,tc]=st.skill.target;
        if(r===tr&&c===tc){
          const king=findKing(st.board,st.skill.owner);
          let nb=st.board;
          if(king){ nb=cloneBoard(st.board); nb[tr][tc]=nb[king[0]][king[1]]; nb[king[0]][king[1]]=null; }
          const logTxt=`${st.skill.owner==="player"?"🟢1P":`🔴${mode==="2p"?"2P":AI_NAME}`}: ⚡ごそう`;
          setSt(prev=>({...prev,board:nb,lastMove:[tr,tc],skill:null,skillHL:[],
            actionLog:[{txt:logTxt,who:st.skill.owner},...prev.actionLog].slice(0,20)}));
          if(mode==="ai"){ doAiTurn(nb,st.captured); }
          else { upd({turn:opp(st.skill.owner)}); updateCheck(nb); }
        } else cancelSkill();
        return;
      }
      if(sp==="lion"){
        const ts=getLionTargets(st.board,st.skill.lr,st.skill.lc);
        const t=ts.find(t=>t.from[0]===r&&t.from[1]===c);
        if(t){
          const nb=cloneBoard(st.board);
          nb[t.to[0]][t.to[1]]=nb[t.from[0]][t.from[1]]; nb[t.from[0]][t.from[1]]=null;
          const logTxt=`${st.skill.owner==="player"?"🟢1P":`🔴${mode==="2p"?"2P":AI_NAME}`}: ⚡ほうこう`;
          setSt(prev=>({...prev,board:nb,lastMove:t.to,skill:null,skillHL:[],
            actionLog:[{txt:logTxt,who:st.skill.owner},...prev.actionLog].slice(0,20)}));
          if(mode==="ai"){ doAiTurn(nb,st.captured); }
          else { upd({turn:opp(st.skill.owner)}); updateCheck(nb); }
        } else cancelSkill();
        return;
      }
      if(sp==="fool_piece"){
        const pp=st.board[r][c];
        if(pp?.owner===st.skill.owner&&pp.type!=="王"&&!(r===st.skill.fr&&c===st.skill.fc)){
          const dests=getFoolDests(st.board,st.skill.owner);
          upd({skill:{...st.skill,phase:"fool_dest",pr:r,pc:c},skillHL:dests.map(([er,ec])=>({r:er,c:ec}))});
        } else cancelSkill();
        return;
      }
      if(sp==="fool_dest"){
        const dests=getFoolDests(st.board,st.skill.owner);
        if(dests.some(([er,ec])=>er===r&&ec===c)){
          const nb=cloneBoard(st.board);
          nb[r][c]=nb[st.skill.pr][st.skill.pc]; nb[st.skill.pr][st.skill.pc]=null;
          const logTxt=`${st.skill.owner==="player"?"🟢1P":`🔴${mode==="2p"?"2P":AI_NAME}`}: ⚡てんい`;
          setSt(prev=>({...prev,board:nb,lastMove:[r,c],skill:null,skillHL:[],
            actionLog:[{txt:logTxt,who:st.skill.owner},...prev.actionLog].slice(0,20)}));
          if(mode==="ai"){ doAiTurn(nb,st.captured); }
          else { upd({turn:opp(st.skill.owner)}); updateCheck(nb); }
        } else cancelSkill();
        return;
      }
      return;
    }

    if(st.selected?.drop){
      if(st.board[r][c]){ upd({selected:null,validMoves:[]}); return; }
      const nb=cloneBoard(st.board); nb[r][c]={type:st.selected.drop,owner:currentOwner};
      const nc={player:[...st.captured.player],ai:[...st.captured.ai]};
      nc[currentOwner].splice(nc[currentOwner].indexOf(st.selected.drop),1);
      const logTxt=`${currentOwner==="player"?"🟢1P":`🔴${mode==="2p"?"2P":AI_NAME}`}: ${EMOJI[st.selected.drop]} うつ`;
      setSt(prev=>({...prev,captured:nc,board:nb,selected:null,validMoves:[],lastMove:[r,c],
        actionLog:[{txt:logTxt,who:currentOwner},...prev.actionLog].slice(0,20)}));
      if(mode==="ai"){ doAiTurn(nb,nc); }
      else { upd({turn:opp(currentOwner)}); updateCheck(nb); }
      return;
    }

    const cell=st.board[r][c];
    if(cell?.owner===currentOwner){
      if(st.selected?.r===r&&st.selected?.c===c){ upd({selected:null,validMoves:[]}); return; }
      upd({selected:{r,c},validMoves:getMoves(st.board,r,c),skill:null,skillHL:[]}); return;
    }
    if(st.selected&&st.validMoves.some(([mr,mc])=>mr===r&&mc===c)){
      const nb=cloneBoard(st.board); const target=nb[r][c];
      const nc={player:[...st.captured.player],ai:[...st.captured.ai]};
      const fromEmoji=EMOJI[nb[st.selected.r][st.selected.c]?.type]||"?";
      const logTxt=`${currentOwner==="player"?"🟢1P":`🔴${mode==="2p"?"2P":AI_NAME}`}: ${fromEmoji} →(${c+1},${BS-r})`;
      if(target){
        if(target.type==="王"){
          nb[r][c]=nb[st.selected.r][st.selected.c]; nb[st.selected.r][st.selected.c]=null;
          setSt(prev=>({...prev,board:nb,lastMove:[r,c],winner:currentOwner,gameOver:true,selected:null,validMoves:[],
            actionLog:[{txt:`🏆 ${currentOwner==="player"?"1P":mode==="2p"?"2P":AI_NAME}のかち！`,who:"system"},{txt:logTxt,who:currentOwner},...prev.actionLog].slice(0,20)}));
          return;
        }
        nc[currentOwner].push(target.type);
      }
      nb[r][c]=nb[st.selected.r][st.selected.c]; nb[st.selected.r][st.selected.c]=null;
      setSt(prev=>({...prev,board:nb,captured:nc,selected:null,validMoves:[],lastMove:[r,c],
        actionLog:[{txt:logTxt,who:currentOwner},...prev.actionLog].slice(0,20)}));
      if(mode==="ai"){ doAiTurn(nb,nc); }
      else { upd({turn:opp(currentOwner)}); updateCheck(nb); }
      return;
    }
    upd({selected:null,validMoves:[]});
  },[st,mode,doAiTurn,cancelSkill,updateCheck,upd]);

  const onDropHand=(t,owner)=>{
    if(st.gameOver||st.thinking) return;
    if(st.turn!==owner) return;
    upd({selected:{drop:t},validMoves:[],skill:null,skillHL:[]});
  };

  const startAi=(diff)=>{
    setMode("ai"); setDifficulty(diff);
    setSt(freshState()); setPhase("setup");
  };
  const start2p=()=>{
    setMode("2p"); setDifficulty(null);
    setSt(freshState()); setPhase("setup");
  };
  const goTop=()=>{ setMode(null); setPhase("top"); setSt(freshState()); };

  // ── 描画用 ──
  const selPiece=st.selected&&!st.selected.drop?st.board[st.selected.r]?.[st.selected.c]:null;
  const canSkill=selPiece&&HAS_SKILL[selPiece.type]&&!st.skill&&!st.thinking&&!st.cannonModal&&!st.gameOver
    &&(mode==="2p"||st.turn==="player");
  const diffColor={weak:"#388e3c",normal:"#f57c00",strong:"#d32f2f"};
  const p2Label=mode==="2p"?"🔴2P":`🔴${AI_NAME}`;
  const setupOwnerNow=st.setupStep%2===0?"player":"ai";

  const cellBg=(r,c)=>{
    const isSel=st.selected&&!st.selected.drop&&st.selected.r===r&&st.selected.c===c;
    const isValid=st.validMoves.some(([mr,mc])=>mr===r&&mc===c);
    const isHL=st.skillHL.some(h=>h.r===r&&h.c===c);
    const isLast=st.lastMove&&st.lastMove[0]===r&&st.lastMove[1]===c;
    const piece=st.board[r][c];
    const isCheck=piece?.type==="王"&&((piece.owner==="player"&&st.checkState.player)||(piece.owner==="ai"&&st.checkState.ai));
    if(isCheck)  return "#ffcdd2";
    if(isSel)    return "#c8e6c9";
    if(isHL)     return "#fce4ec";
    if(isValid&&!piece) return "#dcedc8";
    if(isLast)   return "#fff9c4";
    if(phase==="setup"&&st.selSetup!==null&&!piece){
      if(setupOwnerNow==="player"&&r>=3) return "#e8f5e9";
      if(setupOwnerNow==="ai"&&r<=1)    return "#fce4ec";
    }
    return (r+c)%2===0?"#f5e6c8":"#e8d4a8";
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#87CEEB 0%,#b8e4a0 40%,#7dc855 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 6px 24px",
      fontFamily:"'Hiragino Maru Gothic ProN','Rounded Mplus 1c','Yu Gothic',sans-serif",
      userSelect:"none",position:"relative",overflow:"hidden"}}>
      <style>{`
        @keyframes drift{from{transform:translateX(-80px)}to{transform:translateX(110vw)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes bounce{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(-3px)}}
        .cloud{position:fixed;font-size:28px;opacity:.6;pointer-events:none;animation:drift linear infinite;}
      `}</style>
      <div className="cloud" style={{top:"10px",animationDuration:"22s",animationDelay:"-3s"}}>☁️</div>
      <div className="cloud" style={{top:"26px",animationDuration:"30s",animationDelay:"-12s"}}>🌤️</div>
      <div className="cloud" style={{top:"6px",animationDuration:"18s",animationDelay:"-7s"}}>☁️</div>

      <div style={{textAlign:"center",marginBottom:"8px",zIndex:1}}>
        <div style={{fontSize:"24px",fontWeight:900,color:"#fff",letterSpacing:"6px",
          textShadow:"2px 2px 0 #5a9e3a"}}>🌿 幻将棋 🌿</div>
        <div style={{fontSize:"9px",color:"#d4f0b0",letterSpacing:"4px"}}>Genshougi</div>
      </div>

      {/* ── トップ ── */}
      {phase==="top"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,zIndex:1}}>
          <div style={{background:"rgba(255,255,255,.87)",borderRadius:16,padding:"14px 16px",maxWidth:340,
            border:"2px solid rgba(255,255,255,.9)"}}>
            <div style={{textAlign:"center",fontSize:13,fontWeight:700,color:"#4caf50",marginBottom:10}}>
              🎮 あそびかたをえらんでね
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:6,textAlign:"center"}}>
                🤖 {AI_NAME}とたいせん
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                {Object.entries(DIFFICULTY).map(([k,d])=>(
                  <button key={k} onClick={()=>startAi(k)}
                    style={{borderRadius:12,padding:"10px 12px",cursor:"pointer",
                      border:`2px solid ${diffColor[k]}`,background:"rgba(255,255,255,.8)",
                      display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <span style={{fontSize:20}}>{d.emoji}</span>
                    <span style={{fontSize:11,fontWeight:700,color:diffColor[k]}}>{d.label}</span>
                    <span style={{fontSize:8,color:"#888",whiteSpace:"pre",lineHeight:1.5,textAlign:"left"}}>
                      {k==="weak"?"1手よみ\nスキルなし":k==="normal"?"2手よみ\nスキルあり":"3手よみ\nスキル+強"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{borderTop:"1px solid #e0e0e0",paddingTop:10,textAlign:"center"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:6}}>👫 ふたりでたいせん</div>
              <button onClick={start2p}
                style={{borderRadius:14,padding:"10px 24px",cursor:"pointer",
                  border:"2px solid #7b1fa2",background:"rgba(243,229,245,.9)",
                  fontSize:13,fontWeight:700,color:"#4a148c"}}>🌸 友達と対戦</button>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,.87)",borderRadius:14,padding:"10px 14px",
            border:"2px solid rgba(255,255,255,.9)",maxWidth:300}}>
            <div style={{fontSize:10,fontWeight:700,color:"#4caf50",marginBottom:5}}>🐾 こまのいちらん</div>
            {Object.entries(EMOJI).map(([k,e])=>(
              <div key={k} style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:18}}>{e}</span>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#333"}}>{NAMES[k]}</div>
                  {k==="守"&&<div style={{fontSize:9,color:"#1565c0"}}>🛡️ たいほうをはじく（常時）</div>}
                  {HAS_SKILL[k]&&<div style={{fontSize:9,color:"#9c27b0"}}>⚡ {SKILL_NAME[k]}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── セットアップ＆ゲーム ── */}
      {(phase==="setup"||phase==="game")&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,zIndex:1}}>

          {/* 終了バナー */}
          {st.gameOver&&(
            <div style={{background:st.winner==="player"?"#e8f5e9":"#fce4ec",
              border:`2px solid ${st.winner==="player"?"#66bb6a":"#f06292"}`,
              borderRadius:16,padding:"10px 20px",textAlign:"center",maxWidth:310,width:"100%"}}>
              <div style={{fontSize:28,marginBottom:2}}>{st.winner==="player"?"🏆":"😢"}</div>
              <div style={{fontSize:16,fontWeight:900,letterSpacing:2,
                color:st.winner==="player"?"#2e7d32":"#ad1457"}}>
                {st.winner==="player"?"🟢1Pのかち！":mode==="2p"?"🔴2Pのかち！":`🔴${AI_NAME}のかち！`}
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
                <button onClick={()=>mode==="ai"?startAi(difficulty):start2p()}
                  style={{borderRadius:20,padding:"6px 16px",fontSize:11,fontWeight:700,cursor:"pointer",
                    border:"2px solid #66bb6a",background:"#c8e6c9",color:"#1b5e20"}}>🌿 もう一かい</button>
                <button onClick={goTop}
                  style={{borderRadius:20,padding:"6px 16px",fontSize:11,fontWeight:700,cursor:"pointer",
                    border:"2px solid #aed581",background:"#f1f8e9",color:"#33691e"}}>🏠 トップへ</button>
              </div>
            </div>
          )}

          {/* メッセージバー */}
          {!st.gameOver&&(()=>{
            let bg="#e8f5e2",bc="#7dc855",col="#2e7d32",txt="";
            if(st.thinking){bg="#fff3e0";bc="#ffb74d";col="#8b5000";txt=`${p2Label}がかんがえてるよ…🍃`;}
            else if(st.skill){bg="#fce4ec";bc="#f06292";col="#880e4f";
              const msgs={horse:"👑 光るマスをタップしてね",lion:"🦁 おす敵をタップしてね",
                fool_piece:"🐸 うごかす仲間をタップしてね",fool_dest:"🐸 どこにうごかす？",cannon:"💣 のぞく手駒をえらんでね"};
              txt=msgs[st.skill.phase]||"⚡スキル発動中";}
            else if(phase==="setup"){
              const who2=setupOwnerNow==="player"?"🟢1P":mode==="2p"?"🔴2P":`🤖${AI_NAME}`;
              const placed=Math.floor(st.setupStep/2);
              const rem=7-placed;
              txt=`${who2}がこまを置いてね（あと${rem}まい）`;}
            else if(st.checkState[st.turn]){bg="#ffebee";bc="#ef5350";col="#b71c1c";
              txt=`⚠️ ${st.turn==="player"?"🟢1P":p2Label}の王様におうて！`;}
            else{
              const whoLabel=st.turn==="player"?"🟢1P":p2Label;
              txt=`${whoLabel}のばんだよ！`;}
            return(
              <div style={{borderRadius:20,padding:"6px 16px",fontSize:12,fontWeight:700,
                textAlign:"center",minWidth:220,border:`2px solid ${bc}`,background:bg,color:col}}>
                {st.thinking&&<span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",
                  background:"#ffa726",animation:"pulse .8s infinite",marginRight:4,verticalAlign:"middle"}}/>}
                {txt}
              </div>
            );
          })()}

          {difficulty&&<div style={{fontSize:10,fontWeight:700,color:diffColor[difficulty]}}>
            {DIFFICULTY[difficulty].emoji} {DIFFICULTY[difficulty].label} / 🤖 {AI_NAME}
          </div>}
          {mode==="2p"&&<div style={{fontSize:10,fontWeight:700,color:"#7b1fa2"}}>👫 2人対戦モード</div>}

          {/* 上側手駒 */}
          <div style={{background:"rgba(255,255,255,.8)",borderRadius:12,padding:"4px 10px",
            display:"flex",gap:4,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
            <span style={{fontSize:9,color:"#888",marginRight:2}}>{p2Label}手駒</span>
            {st.captured.ai.length
              ?st.captured.ai.map((t,i)=>(
                <div key={i} onClick={()=>mode==="2p"&&st.turn==="ai"?onDropHand(t,"ai"):undefined}
                  style={{fontSize:14,transform:"rotate(180deg)",display:"inline-block",
                    cursor:mode==="2p"&&st.turn==="ai"?"pointer":"default",
                    background:mode==="2p"&&st.turn==="ai"&&st.selected?.drop===t?"#fce4ec":"transparent",borderRadius:4}}>
                  {EMOJI[t]}
                </div>))
              :<span style={{fontSize:9,color:"#bbb"}}>なし</span>}
          </div>

          {/* 盤面 */}
          <div style={{borderRadius:12,overflow:"hidden",border:"3px solid #8d6e63",
            boxShadow:"0 6px 20px rgba(100,60,20,.25)"}}>
            {Array(BS).fill(null).map((_,r)=>(
              <div key={r} style={{display:"flex"}}>
                {Array(BS).fill(null).map((_,c)=>{
                  const piece=st.board[r][c];
                  const isValid=st.validMoves.some(([mr,mc])=>mr===r&&mc===c);
                  const isHL=st.skillHL.some(h=>h.r===r&&h.c===c);
                  const isSel=st.selected&&!st.selected.drop&&st.selected.r===r&&st.selected.c===c;
                  const isCheck=piece?.type==="王"&&((piece.owner==="player"&&st.checkState.player)||(piece.owner==="ai"&&st.checkState.ai));
                  return(
                    <div key={c}
                      onClick={()=>phase==="setup"?onSetupCell(r,c):onGameCell(r,c)}
                      style={{width:56,height:56,display:"flex",alignItems:"center",justifyContent:"center",
                        cursor:"pointer",position:"relative",border:"1px solid rgba(139,100,60,.2)",
                        background:cellBg(r,c),transition:"background .1s"}}>
                      {isValid&&!piece&&<div style={{width:14,height:14,borderRadius:"50%",
                        background:"rgba(100,180,50,.7)",border:"2px solid #7dc855"}}/>}
                      {isValid&&piece&&<div style={{position:"absolute",inset:2,border:"2.5px solid #e53935",borderRadius:8,pointerEvents:"none"}}/>}
                      {isHL&&!piece&&<div style={{width:14,height:14,borderRadius:"50%",
                        background:"rgba(240,100,120,.8)",border:"2px solid #e91e63"}}/>}
                      {isHL&&piece&&<div style={{position:"absolute",inset:2,border:"2.5px solid #e91e63",borderRadius:8,pointerEvents:"none"}}/>}
                      {piece&&(
                        <div style={{width:50,height:50,borderRadius:10,
                          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                          position:"relative",border:"2px solid",
                          background:piece.owner==="player"?"#fffde7":"#fce4ec",
                          borderColor:piece.owner==="player"?"#f9a825":"#f48fb1",
                          boxShadow:isSel?"0 0 0 3px #66bb6a,0 3px 10px rgba(100,200,80,.4)"
                            :isCheck?"0 0 0 3px #ef5350,0 3px 10px rgba(240,80,80,.5)"
                            :"0 2px 6px rgba(100,60,20,.15)",
                          transform:piece.owner==="ai"?"rotate(180deg)":"none"}}>
                          <span style={{fontSize:22,lineHeight:1}}>{EMOJI[piece.type]}</span>
                          <span style={{fontSize:7,fontWeight:700,
                            color:piece.owner==="player"?"#795548":"#ad1457"}}>{NAMES[piece.type]}</span>
                          {HAS_SKILL[piece.type]&&(
                            <div style={{position:"absolute",top:1,right:1,width:10,height:10,borderRadius:"50%",
                              fontSize:7,display:"flex",alignItems:"center",justifyContent:"center",
                              background:piece.owner==="player"?"#ce93d8":"#f48fb1"}}>⚡</div>
                          )}
                          {isCheck&&(
                            <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",
                              fontSize:12,animation:"bounce .5s ease infinite alternate",pointerEvents:"none"}}>⚠️</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 下側手駒 */}
          <div style={{background:"rgba(255,255,255,.8)",borderRadius:12,padding:"4px 10px",
            display:"flex",gap:4,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
            <span style={{fontSize:9,color:"#888",marginRight:2}}>🟢1P手駒</span>
            {st.captured.player.length
              ?st.captured.player.map((t,i)=>(
                <div key={i} onClick={()=>onDropHand(t,"player")}
                  style={{width:32,height:32,borderRadius:8,cursor:"pointer",
                    background:st.selected?.drop===t&&st.turn==="player"?"#dcedc8":"#f1f8e9",
                    border:`2px solid ${st.selected?.drop===t&&st.turn==="player"?"#7cb342":"#aed581"}`,
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:14}}>
                  <div>{EMOJI[t]}</div><div style={{fontSize:6,color:"#666"}}>{NAMES[t]}</div>
                </div>))
              :<span style={{fontSize:9,color:"#bbb"}}>なし</span>}
          </div>

          {/* 配置パレット */}
          {phase==="setup"&&st.setupStep<14&&(()=>{
            const isPlayerNow=st.setupStep%2===0;
            const isHumanTurn=isPlayerNow||(mode==="2p"&&!isPlayerNow);
            const currentHand2=isPlayerNow?st.playerHand:st.aiHand;
            const who2=isPlayerNow?"🟢1P":mode==="2p"?"🔴2P":`🤖${AI_NAME}`;
            const placed=Math.floor((st.setupStep+(isPlayerNow?0:1))/2);
            return(
              <div style={{background:"rgba(255,255,255,.87)",borderRadius:14,padding:"8px 12px",
                border:"2px solid rgba(255,255,255,.9)",maxWidth:310}}>
                <div style={{fontSize:9,fontWeight:700,
                  color:isPlayerNow?"#558b2f":"#7b1fa2",marginBottom:4}}>
                  {who2} こまをえらんでね（あと{7-placed}まい）
                </div>
                {isHumanTurn?(
                  <div style={{display:"flex",gap:5,justifyContent:"center",flexWrap:"wrap"}}>
                    {currentHand2.map((t,i)=>(
                      <div key={i} onClick={()=>upd({selSetup:st.selSetup===i?null:i})}
                        style={{width:40,height:40,borderRadius:10,cursor:"pointer",
                          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:18,
                          background:st.selSetup===i?"#dcedc8":"#f1f8e9",
                          border:`2px solid ${st.selSetup===i?"#558b2f":"#aed581"}`,
                          boxShadow:st.selSetup===i?"0 0 0 3px #7cb342":"none"}}>
                        <div>{EMOJI[t]}</div>
                        <div style={{fontSize:6,color:"#666"}}>{NAMES[t]}</div>
                      </div>
                    ))}
                  </div>
                ):(
                  <div style={{fontSize:10,color:"#ff7043",textAlign:"center"}}>
                    <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",
                      background:"#ffa726",animation:"pulse .8s infinite",marginRight:4,verticalAlign:"middle"}}/>
                    {AI_NAME}がこまを置いてるよ…
                  </div>
                )}
              </div>
            );
          })()}

          {/* スキル / キャンセル */}
          {phase==="game"&&!st.gameOver&&(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={onSkillBtn} disabled={!canSkill}
                style={{borderRadius:20,padding:"7px 18px",fontSize:12,fontWeight:700,
                  cursor:canSkill?"pointer":"not-allowed",border:"2px solid",
                  background:canSkill?"#e1bee7":"#f5f5f5",
                  borderColor:canSkill?"#9c27b0":"#ccc",color:canSkill?"#4a148c":"#bbb"}}>
                ⚡ {selPiece&&canSkill?SKILL_NAME[selPiece.type]:"スキル"}
              </button>
              {st.skill&&!st.cannonModal&&(
                <button onClick={cancelSkill}
                  style={{borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,
                    cursor:"pointer",border:"2px solid #e57373",background:"#ffcdd2",color:"#b71c1c"}}>
                  ✕ やめる
                </button>
              )}
            </div>
          )}

          {/* ログ */}
          {phase==="game"&&(
            <div style={{background:"rgba(255,255,255,.87)",borderRadius:14,padding:"8px 12px",
              border:"2px solid rgba(255,255,255,.9)",maxWidth:310,width:"100%"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#4caf50",marginBottom:3}}>📜 きろく</div>
              <div style={{maxHeight:90,overflowY:"auto",fontSize:10,lineHeight:1.6}}>
                {st.actionLog.length===0&&<span style={{color:"#bbb",fontSize:9}}>まだないよ</span>}
                {st.actionLog.map((e,i)=>(
                  <div key={i} style={{borderBottom:"1px solid rgba(0,0,0,.04)",paddingBottom:1,marginBottom:1,
                    color:e.who==="player"?"#2e7d32":e.who==="ai"?"#ad1457":e.who==="system"?"#c62828":"#6a1b9a",
                    fontWeight:e.who==="system"?700:400}}>{e.txt}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 大砲モーダル */}
      {st.cannonModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:150}}>
          <div style={{background:"#fff8e1",borderRadius:20,padding:"20px 28px",
            textAlign:"center",border:"3px solid #ffb300",maxWidth:280}}>
            <div style={{fontSize:13,fontWeight:700,color:"#e65100",marginBottom:10}}>
              💣 どの手駒をのぞく？
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
              {[...new Set(st.cannonModal.list)].map((t,i)=>(
                <div key={i} onClick={()=>onCannonSelect(t)}
                  style={{fontSize:22,cursor:"pointer",padding:8,borderRadius:10,
                    background:"#fff3e0",border:"2px solid #ffb300",textAlign:"center"}}>
                  {EMOJI[t]}<div style={{fontSize:8,color:"#795548"}}>{NAMES[t]}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>upd({cannonModal:null,skill:null,skillHL:[]})}
              style={{borderRadius:20,padding:"6px 16px",fontSize:11,fontWeight:700,
                cursor:"pointer",border:"2px solid #e57373",background:"#ffcdd2",color:"#b71c1c"}}>
              ✕ やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
