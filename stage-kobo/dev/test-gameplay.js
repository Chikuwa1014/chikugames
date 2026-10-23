const fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8'); const a=html.indexOf('<script>')+8,b=html.lastIndexOf('</script>');
let code=html.slice(a,b);
const hook=`globalThis.__t={get game(){return game},get doc(){return doc},get PG(){return PG},startGame,update,setMode,keys,loadDoc,fromData,unlock,UNLOCKS,isUnlocked,stageId,SAMPLE_ID,sampleDoc,jump(){jumpBuf=6},get mode(){return mode}};\n`;
const end=code.lastIndexOf('})();'); code=code.slice(0,end)+hook+code.slice(end);
const mk=(name)=>{const f=function(){return mk(name+'()')};return new Proxy(f,{get(t,k){if(k===Symbol.toPrimitive)return()=>0;if(k==='then')return undefined;if(k in t&&k!=='name')return t[k];if(k==='getContext')return()=>ctx;if(k==='querySelectorAll')return()=>[];if(k==='getBoundingClientRect')return()=>({left:0,top:0,width:960,height:360});if(k==='classList')return{add(){},remove(){},toggle(){}};if(k==='dataset')return t.__ds||(t.__ds={});if(k==='style')return t.__st||(t.__st={});if(k==='hidden'||k==='readOnly'||k==='textContent')return t['__'+k];return mk(name+'.'+String(k))},set(t,k,v){t['__'+k]=v;if(k==='dataset')t.__ds=v;return true}})};
const ctx=new Proxy({},{get(t,k){if(k in t)return t[k];if(['createLinearGradient','createRadialGradient'].includes(k))return()=>({addColorStop(){}});return()=>{}},set(t,k,v){t[k]=v;return true}});
const els={};const store={};
global.document={getElementById:id=>els[id]||(els[id]=mk('#'+id)),createElement:()=>mk('el'),createTextNode:()=>mk('txt'),body:mk('body'),activeElement:null};
global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)}};
global.location={hash:'',origin:'https://x',pathname:'/'};
global.addEventListener=()=>{};global.scrollTo=()=>{};global.requestAnimationFrame=()=>{};
global.performance={now:()=>0};global.setTimeout=()=>0;global.clearTimeout=()=>{};global.navigator={};
new Function(code)();
const t=__t; let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const run=(n,fn)=>{for(let i=0;i<n;i++){fn&&fn(i);t.update();}};
const rows=(...r)=>r;
function play(map,extra={}){ t.loadDoc(t.fromData({title:'テスト',map,settings:{lives:3},...extra})); t.setMode('play'); for(const k in t.keys)t.keys[k]=false; return t.game; }
const pad=Array(10).fill('');

// 1) 未解放の状態
ok(!t.isUnlocked('C') && t.isUnlocked('#'), '最初は中間旗が未解放、地面は使える');
// 2) 解放：ちくわ不足では解放できない／足りれば順番に解放
t.unlock(t.UNLOCKS[0]); ok(!t.PG.u.includes('C'), 'ちくわ0本では解放できない');
t.PG.w=35; t.unlock(t.UNLOCKS[0]); ok(t.PG.u.includes('C') && t.PG.w===25, '中間旗を10本で解放（残り25）');

// 3) 雲の足場：下からすり抜けて上に乗る
let g=play([...pad,'','','=====','.P...','#####'].slice(-15).length?[...Array(10).fill(''),'.....','=====','.....','.P...','#####']:[]);
run(5); t.jump(); t.keys.jump=true; run(40);
t.keys.jump=false; run(40);
ok(g.p.ground && Math.abs(g.p.y+g.p.h-11*24)<0.5, '雲の足場：下からすり抜けて、上に着地 (足元y='+(g.p.y+g.p.h)+')');
run(30); ok(Math.abs(g.p.y+g.p.h-11*24)<0.5, '雲の足場：乗ったまま落ちない');

// 4) ？ブロック：下からたたくとコインが出て、使用済みに
g=play([...Array(10).fill(''),'.?...','.....','.P...','#####','']);
ok(g.total===1, '？ブロックはコイン総数に数える');
run(3); t.jump(); t.keys.jump=true; run(25); t.keys.jump=false;
ok(g.map[10][1]==='U' && g.coins===1, '？ブロック：コイン+1、使用済みブロックに変化');
run(60); ok(g.map[10][1]==='U' && g.p.ground, '使用済みブロックは固いまま');

// 5) 壊れるブロック
g=play([...Array(10).fill(''),'.X...','.....','.P...','#####','']);
run(3); t.jump(); t.keys.jump=true; run(25); t.keys.jump=false;
ok(g.map[10][1]==='.' && g.debris.length>0, '壊れるブロック：下からたたくと壊れて破片が飛ぶ');

// 6) 氷の床：手を離しても すべり続ける
const ice=play([...Array(12).fill(''),'.P..................','IIIIIIIIIIIIIIIIIIII','']);
run(5); t.keys.right=true; run(60); t.keys.right=false; const x0=ice.p.x; run(30); const slideIce=ice.p.x-x0;
const nor=play([...Array(12).fill(''),'.P..................','####################','']);
run(5); t.keys.right=true; run(60); t.keys.right=false; const x1=nor.p.x; run(30); const slideNor=nor.p.x-x1;
ok(slideIce>30 && slideNor<10, `氷の床：離したあとのすべり 氷${slideIce.toFixed(1)}px / 普通${slideNor.toFixed(1)}px`);

// 7) 中間旗：さわった後のミスは中間旗から再開
g=play([...Array(12).fill(''),'.P...C....^....','###############','']);
t.keys.right=true; run(200, ()=>{ if(g.state!=='run') t.keys.right=false; });
ok(g.map[12][5]==='c', '中間旗：さわると旗が上がる');
ok(g.lives===2, 'トゲでミス（残機2）');
t.keys.right=false; run(80);
ok(g.state==='run' && Math.abs(g.p.x-(5*24+3))<1, '中間旗から再開 (x='+g.p.x.toFixed(1)+')');

// 8) 報酬：サンプル初クリア
t.PG.w=0;
function clearStage(doc, allCoins){ t.loadDoc(doc); t.setMode('play'); const gg=t.game;
  let gx=0,gy=0; gg.map.forEach((r,y)=>r.forEach((c,x)=>{ if(c==='G'){gx=x;gy=y;} }));
  if(allCoins) gg.coins=gg.total;
  gg.p.x=gx*24-20; gg.p.y=gy*24+2; gg.p.vy=0; t.keys.right=true;
  let n=0; while(gg.state==='run' && n++<200) t.update(); t.keys.right=false; return gg; }
let gg=clearStage(t.sampleDoc(), true);
ok(gg.state==='clear' && gg.reward.kind==='sample', 'サンプルをクリア');
console.log('   報酬', JSON.stringify(gg.reward.lines), '合計', gg.reward.gain);
ok(gg.reward.gain===20, 'サンプル初クリア10＋全コイン5＋ノーミス5＝20本');
gg=clearStage(t.sampleDoc(), true); ok(gg.reward.gain===0, '同じステージの2回目は0本');
// 9) 自分のステージ：3本、1日5回まで
const own=i=>t.fromData({title:'自作'+i,map:[...Array(12).fill(''),'.P'+'.'.repeat(i)+'G','#'.repeat(20)]});
let gains=[]; for(let i=0;i<6;i++){ gg=clearStage(own(i)); gains.push(gg.reward.gain); }
ok(JSON.stringify(gains)==='[3,3,3,3,3,0]', '自分のステージ：3本ずつ、6回目は0本 '+JSON.stringify(gains));

// 10) ふんだ敵の数とスタンプ（敵の真上から落とす）
t.PG.stomp=29; g=play([...Array(12).fill(''),'.P....e..','#########','']);
const e0=g.enemies[0]; g.p.x=e0.x; g.p.y=e0.y-60; g.p.vy=2;
let n=0; while(e0.alive && g.state==='run' && n++<100) t.update();
console.log('   敵', e0.alive?'生存':'ふんだ', '状態', g.state, '残機', g.lives);
ok(!e0.alive && g.lives===3, '上から落ちると敵をふめる');
ok(t.PG.stomp===30 && t.PG.got.includes('stomp'), '敵30体目でスタンプ獲得 (stomp='+t.PG.stomp+')');
// 11) 保存データの改ざん検出
const key='stage-kobo-progress'; const saved=store[key]; ok(/^[A-Za-z0-9+/=]+\.[0-9a-z]+$/.test(saved), '進行データはbase64＋チェック値で保存');

// ---- v1.5.0 の新パーツ ----
const R15=(...last)=>[...Array(15-last.length).fill(''),...last];
const walkRight=(g,n)=>{t.keys.right=true; run(n,()=>{ if(g.state!=='run') t.keys.right=false; }); t.keys.right=false;};
// 12) 解放：スタンプで解放するパーツ、カギと扉はいっしょに解放
t.PG.got=t.PG.got.filter(x=>x!=='lava'); t.PG.u=t.PG.u.filter(x=>x!=='K');
ok(!t.isUnlocked('L') && !t.isUnlocked('D'), '溶岩・扉は最初は未解放');
t.PG.got.push('lava'); t.PG.u.push('K');
ok(t.isUnlocked('L') && t.isUnlocked('K') && t.isUnlocked('D') && t.isUnlocked('T'), 'スタンプ「溶岩」で溶岩、カギの解放で扉も使える（トゲの敵はスタンプ獲得済み）');
// 13) お盆：乗ると運ばれる
g=play(R15('.P','.MM......#','',''));
run(120);
ok(g.p.ground && g.p.tray && g.p.x>3+40 && Math.abs(g.p.y+g.p.h-g.trays[0].y)<0.5 && g.state==='run', 'お盆：乗ったまま右へ運ばれる (x='+g.p.x.toFixed(1)+')');
run(200); ok(g.state==='run' && g.p.tray, 'お盆：壁で折り返しても落ちない');
// 14) ゆでたまご：残機＋1
g=play(R15('.PE....','#######','')); walkRight(g,40);
ok(g.lives===4 && g.map[12][2]==='.', 'ゆでたまご：取ると残機4');
// 15) カギと扉
g=play(R15('.....D','.P...D...','#########','')); walkRight(g,90);
ok(g.p.x+g.p.w<=5*24+0.5 && g.map[12][5]==='D', '扉：カギなしでは通れない');
g=play(R15('.....D','.PK..D..G','#########','')); walkRight(g,200);
ok(g.map[11][5]==='.' && g.map[12][5]==='.' && g.keys===0 && g.state==='clear', 'カギ1つで、つながった扉がまとめて開き、通り抜けられる');
// 16) 竹筒：次の竹筒へワープ。戻ってこない
g=play(R15('.PW......W..............','#########################','')); walkRight(g,30);
ok(g.p.x>9*24-4, '竹筒：もう一方の竹筒へワープ (x='+g.p.x.toFixed(1)+')');
walkRight(g,60); ok(g.p.x>10*24 && g.state==='run', 'ワープ先から先へ進める（行ったり来たりしない）');
// 17) 溶岩：落ちるとミス
g=play(R15('.P......','###LL###','')); walkRight(g,60);
ok(g.lives===2 && g.misses===1, '溶岩：さわるとミス');
// 18) トゲの敵：ふむとミス
g=play(R15('.P....T..','#########',''));
let e1=g.enemies[0]; ok(e1.kind==='spike','トゲの敵は敵として動く');
g.p.x=e1.x; g.p.y=e1.y-60; g.p.vy=2; n=0; while(g.state==='run' && n++<100) t.update();
ok(e1.alive && g.lives===2, 'トゲの敵：ふむとミス');
// 19) ぱたぱた油揚げ：上下に飛び、ふめる
g=play(R15('','','.P.....F.','#########',''),{settings:{lives:3,enemy:0}});
const f=g.enemies[0]; let fmin=1e9,fmax=-1e9; run(120,()=>{fmin=Math.min(fmin,f.y);fmax=Math.max(fmax,f.y);}); ok(f.kind==='fly' && fmax-fmin>30, 'ぱたぱた油揚げ：重力なしで上下にゆれる');
g.p.x=f.x; g.p.y=f.y-50; g.p.vy=2; n=0; while(f.alive && g.state==='run' && n++<100){ g.p.x=f.x; t.update(); }
ok(!f.alive && g.lives===3, 'ぱたぱた油揚げ：上からふめる');
// 20) 串発射台：近づくと串が飛んでくる
g=play(R15('.P........R','###########','')); run(260);
ok(g.lives<=2, '串発射台：串に当たるとミス');
// 21) からし：しばらく無敵（敵に負けない）
g=play(R15('.PY.....e...........','####################','')); walkRight(g,20);
ok(g.inv>0, 'からし：取ると無敵'); walkRight(g,120);
ok(g.lives===3 && !g.enemies[0].alive, 'からし：無敵中は敵にさわると倒せる');
g=play(R15('.PY.......R','###########','')); walkRight(g,12); run(200);
ok(g.lives===3, 'からし：無敵中は串に当たってもミスにならない');
// 22) ゆでたまごで残機が増えても、ミスしたらノーミス扱いにしない
g=play(R15('.PE.^...G','#########','')); walkRight(g,300);
ok(g.misses>=1, 'ミスの回数を記録（ゆでたまごで残機が戻ってもノーミスにならない）');
console.log(fails? `\n${fails} 件失敗` : '\nすべて成功');
