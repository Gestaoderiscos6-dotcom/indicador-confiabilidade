'use strict';
/* =====================================================================
   Confiabilidade V15 · Comparativo anual (ex.: 2025 × 2026)
   Fonte: SISTEMA/comparativo_anual.xlsx — abas CDA e CDI,
   coluna PERIODO (meses) + uma coluna por ano com o NSL.
   ===================================================================== */
(function(){
 const $=id=>document.getElementById(id);
 const icon=(id,cls='')=>'<svg class="ico '+cls+'" aria-hidden="true"><use href="#'+id+'"/></svg>';
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const pct=v=>v===null||v===undefined||!Number.isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
 const pp=v=>(v>0?'+':'')+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' p.p.';
 const META=0.40;
 const NOME_UN={CDA:'CDA + Regionais',CDI:'CDI'};
 const DESC_UN={CDA:'CDA contabilizado junto com as regionais',CDI:'CDI (aba separada)'};
 const nomeUn=u=>NOME_UN[u]||u;
 const titulo=m=>m.charAt(0)+m.slice(1).toLowerCase();
 let dados=null,unidade=null,chart=null,motivo=null,podeLer=false,etapa='',iniciou=false;

 function unidadePadrao(){
  const v=$('visao')?.value;const disp=Object.keys(dados?.unidades||{});
  const pref=v==='cdi'?'CDI':'CDA';
  return disp.includes(pref)?pref:disp[0];
 }

 function render(){
  const box=$('comparativoPanel');if(!box)return;
  const vazio=$('compVazio'),corpo=$('compConteudo');
  const us=Object.keys(dados?.unidades||{});
  if(!us.length){
   vazio.hidden=false;corpo.hidden=true;$('compUnidades').innerHTML='';
   $('compFonte').textContent='SISTEMA › comparativo_anual.xlsx';
   $('compVazioTitulo').textContent=motivo?'Comparativo não carregado':'Carregando comparativo…';
   $('compMotivo').textContent=motivo||etapa||'Lendo comparativo_anual.xlsx da pasta SISTEMA.';
   vazio.classList.toggle('warn',!!motivo);
   $('compLer').hidden=!podeLer;
   const ba=$('compArquivoBtn');if(ba)ba.hidden=!(podeLer&&modoArquivo());
   return;}
  vazio.hidden=true;corpo.hidden=false;
  if(!unidade||!us.includes(unidade))unidade=unidadePadrao();
  $('compUnidades').innerHTML=us.map(u=>'<button type="button" class="ts-btn'+(u===unidade?' active':'')+'" data-unidade="'+esc(u)+'" style="--shift:'+(u==='CDI'?'#00a8cf':'#0a4fa3')+'" title="'+esc(DESC_UN[u]||u)+'">'+icon(u==='CDI'?'i-building':'i-boxes')+esc(nomeUn(u))+'</button>').join('');
  const U=dados.unidades[unidade];
  const anos=[...U.anos].sort((a,b)=>a-b);
  const atual=anos[anos.length-1],ant=anos.length>1?anos[anos.length-2]:null;
  $('compTitulo').textContent='Comparativo '+(ant?ant+' × ':'')+atual+' · '+nomeUn(unidade);
  $('compFonte').textContent=(dados.arquivo||'comparativo_anual.xlsx')+' · NSL mensal · '+(DESC_UN[unidade]||unidade);
  const nota=$('compNota');if(nota)nota.innerHTML=icon('i-help')+' <b>'+esc(nomeUn(unidade))+'</b>: '+esc(unidade==='CDA'?'o NSL do CDA considera o CDA junto com as regionais (consolidado). O CDI está na aba separada.':'o NSL do CDI vem da aba CDI do comparativo, separado do CDA.');

  const meses=U.meses;
  const comAtual=meses.filter(m=>Number.isFinite(m.valores[atual]));
  const media=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
  const mAtual=media(comAtual.map(m=>m.valores[atual]));
  const mAntMesmo=ant?media(comAtual.filter(m=>Number.isFinite(m.valores[ant])).map(m=>m.valores[ant])):null;
  const mAntAno=ant?media(meses.filter(m=>Number.isFinite(m.valores[ant])).map(m=>m.valores[ant])):null;
  const dif=mAtual!==null&&mAntMesmo!==null?mAtual-mAntMesmo:null;
  const naMeta=comAtual.filter(m=>m.valores[atual]<=META).length;
  const melhor=comAtual.length?comAtual.reduce((a,b)=>b.valores[atual]<a.valores[atual]?b:a):null;
  const pior=comAtual.length?comAtual.reduce((a,b)=>b.valores[atual]>a.valores[atual]?b:a):null;
  const card=(cls,ic,rot,val,sub)=>'<div class="comp-card '+cls+'"><span class="comp-ico">'+icon(ic)+'</span><div><small>'+esc(rot)+'</small><strong>'+val+'</strong><em>'+sub+'</em></div></div>';
  $('compCards').innerHTML=
   (ant?card('c-ant','i-history','Média '+ant,pct(mAntMesmo),'mesmo período · ano: '+pct(mAntAno)):'')+
   card(mAtual!==null&&mAtual<=META?'c-ok':'c-bad','i-gauge','Média '+atual,pct(mAtual),comAtual.length+' mês(es) com dados')+
   (dif!==null?card(dif<=0?'c-ok':'c-bad',dif<=0?'i-trend':'i-alert','Variação',pp(dif),dif<=0?'melhora frente a '+ant:'piora frente a '+ant):'')+
   card(naMeta===comAtual.length?'c-ok':'c-warn','i-target','Meses na meta',naMeta+' de '+comAtual.length,'NSL ≤ 0,40%')+
   (melhor?card('c-best','i-award','Melhor mês '+atual,titulo(melhor.mes),pct(melhor.valores[atual])+(pior?' · pior: '+titulo(pior.mes)+' '+pct(pior.valores[atual]):'')):'');

  // Tabela
  const head='<thead><tr><th><span class="th-in">'+icon('i-calendar')+'Mês</span></th>'+anos.map(a=>'<th><span class="th-in">'+icon('i-gauge')+a+'</span></th>').join('')+(ant?'<th><span class="th-in">'+icon('i-compare')+'Variação</span></th>':'')+'</tr></thead>';
  const body=meses.map(m=>{
   const cels=anos.map(a=>{const v=m.valores[a];if(!Number.isFinite(v))return '<td><span class="pill">—</span></td>';const ok=v<=META;return '<td><span class="pill '+(ok?'ok':'bad')+'">'+icon(ok?'i-check':'i-alert')+pct(v)+'</span></td>';}).join('');
   let var_='';
   if(ant){const a=m.valores[ant],b=m.valores[atual];var_=Number.isFinite(a)&&Number.isFinite(b)?'<td><span class="delta '+(b-a<=0?'down':'up')+'">'+icon(b-a<=0?'i-trend':'i-arrow-up')+pp(b-a)+'</span></td>':'<td><span class="delta">—</span></td>';}
   return '<tr><td><div class="cell-id"><span class="cell-ico k-mes">'+icon('i-calendar')+'</span><span class="cell-txt"><b>'+esc(titulo(m.mes))+'</b></span></div></td>'+cels+var_+'</tr>';
  }).join('');
  $('compTabela').innerHTML='<table>'+head+'<tbody>'+body+'</tbody></table>';

  // Gráfico
  const cv=$('compChart');if(!cv)return;
  const cbox=cv.parentElement;
  if(typeof Chart==='undefined'){
   // Biblioteca de gráficos indisponível (sem internet): desenha o gráfico em SVG.
   if(chart){try{chart.destroy();}catch(e){}chart=null;}
   cv.style.display='none';
   let svg=cbox.querySelector('svg.comp-svg');if(!svg){cbox.insertAdjacentHTML('beforeend','<svg class="comp-svg" viewBox="0 0 760 330"></svg>');svg=cbox.querySelector('svg.comp-svg');}
   const W=760,H=330,L=46,R=12,T=16,B=58,w=W-L-R,h=H-T-B,n=meses.length||1,gw=w/n;
   const vals=meses.flatMap(m=>anos.map(a=>m.valores[a])).filter(Number.isFinite);
   const max=Math.max(META*1.25,...vals)*1.1;const y=v=>T+h-(v/max)*h;
   const corAno=(a,i)=>a===atual?(unidade==='CDI'?'#00a8cf':'#0a4fa3'):['#b9c6d8','#7f93ad','#2fb35f'][i%3];
   let g='';
   for(let k=0;k<=4;k++){const v=max*k/4,yy=y(v);g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#eef2f7"/><text x="'+(L-6)+'" y="'+(yy+4)+'" text-anchor="end" font-size="11" fill="#66799a">'+v.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%</text>';}
   const bw=Math.min(22,(gw*.7)/anos.length);
   meses.forEach((m,i)=>{const x0=L+gw*i+gw/2-(bw*anos.length)/2;anos.forEach((a,j)=>{const v=m.valores[a];if(!Number.isFinite(v))return;g+='<rect x="'+(x0+j*bw)+'" y="'+y(v)+'" width="'+(bw-2)+'" height="'+(T+h-y(v))+'" rx="4" fill="'+corAno(a,j)+'"><title>'+esc(titulo(m.mes))+' '+a+': '+pct(v)+'</title></rect>';});
    g+='<text x="'+(L+gw*i+gw/2)+'" y="'+(T+h+16)+'" text-anchor="middle" font-size="11" fill="#66799a">'+esc(titulo(m.mes).slice(0,3))+'</text>';});
   g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(META)+'" y2="'+y(META)+'" stroke="#e30613" stroke-dasharray="6 5" stroke-width="1.5"/><text x="'+(W-R-4)+'" y="'+(y(META)-5)+'" text-anchor="end" font-size="11" font-weight="700" fill="#e30613">Meta 0,40%</text>';
   let lx=L;g+=anos.map((a,j)=>{const t='<rect x="'+lx+'" y="'+(H-18)+'" width="12" height="12" rx="3" fill="'+corAno(a,j)+'"/><text x="'+(lx+17)+'" y="'+(H-8)+'" font-size="12" font-weight="600" fill="#2f4566">'+a+'</text>';lx+=70;return t;}).join('');
   svg.innerHTML=g;return;
  }
  cv.style.display='';cbox.querySelector('svg.comp-svg')?.remove();
  const labels=meses.map(m=>titulo(m.mes).slice(0,3));
  const cores=['#b9c6d8','#0a4fa3','#00a8cf','#2fb35f'];
  const ds=anos.map((a,i)=>({type:'bar',label:String(a),data:meses.map(m=>Number.isFinite(m.valores[a])?+m.valores[a].toFixed(3):null),
   backgroundColor:a===atual?(unidade==='CDI'?'#00a8cf':'#0a4fa3'):cores[i%cores.length],borderRadius:6,maxBarThickness:26,order:2}));
  ds.push({type:'line',label:'Meta 0,40%',data:meses.map(()=>META),borderColor:'#e30613',borderDash:[6,5],borderWidth:1.5,pointRadius:0,order:1});
  if(chart)chart.destroy();
  chart=new Chart(cv,{data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
   plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:10,font:{family:"Inter,'Segoe UI',sans-serif",weight:'600'}}},tooltip:{backgroundColor:'#0b2350',padding:12,cornerRadius:12,callbacks:{label:c=>' '+c.dataset.label+': '+pct(c.parsed.y)}}},
   scales:{x:{grid:{display:false},ticks:{color:'#66799a'}},y:{beginAtZero:true,grid:{color:'#eef2f7'},border:{display:false},ticks:{color:'#66799a',callback:v=>v.toLocaleString('pt-BR')+'%'}}}}});
 }

 document.addEventListener('click',e=>{const b=e.target.closest('#compUnidades [data-unidade]');if(!b)return;unidade=b.dataset.unidade;render();});
 $('visao')?.addEventListener('change',()=>{unidade=null;render();});
 const LN=()=>window.LeitorNavegador;
 const modoArquivo=()=>!!(LN()&&LN().ativo());
 const passo=t=>{etapa=t;if(!dados)render();};
 const limite=(prom,ms)=>Promise.race([prom,new Promise((_,rej)=>setTimeout(()=>rej(new Error('a leitura passou de '+ms/1000+' segundos sem resposta')),ms))]);
 async function buscar(c,pedir){
  if(c)return c;
  if(window.MODO_EQUIPE){motivo='O comparativo anual ainda não foi publicado. Ele entra na próxima atualização do painel principal.';return null;}
  if(modoArquivo()){
   passo('Procurando o comparativo salvo neste navegador...');
   c=await LN().comparativoSalvo().catch(()=>null);
   if(c)return c;
   passo('Abrindo a pasta SISTEMA para ler comparativo_anual.xlsx...');
   const r=await LN().lerComparativoAgora(!!pedir,t=>passo(t+'...'));
   if(r.ok)return r.comparativo;
   motivo=r.motivo;podeLer=true;return null;
  }
  if(location.protocol.startsWith('http')){
   passo('Consultando o leitor local (ABRIR_PAINEL.bat)...');podeLer=true;
   const r=await fetch('/api/comparativo',{cache:'no-store'});
   const tipo=r.headers.get('content-type')||'';
   if(r.ok)return await r.json();
   if(tipo.includes('json')){const j=await r.json();motivo=j.erro||('Erro '+r.status);}
   else motivo='O leitor aberto (janela preta do ABRIR_PAINEL.bat) é de uma versão anterior e não lê o comparativo. Feche a janela preta e abra o ABRIR_PAINEL.bat novamente.';
   return null;
  }
  motivo='Abra o painel pelo index.html no Chrome/Edge ou pelo ABRIR_PAINEL.bat.';return null;
 }
 async function carregar(c,pedir){
  iniciou=true;motivo=null;podeLer=false;
  try{c=await limite(buscar(c,pedir),pedir?120000:45000);}
  catch(e){console.error('[Comparativo]',e);c=null;motivo='Não foi possível ler o comparativo: '+(e&&e.message?e.message:e)+(etapa?' (etapa: '+etapa.replace(/\.\.\.$/,'')+')':'')+'. Clique em “Ler comparativo” para tentar de novo.';podeLer=true;}
  dados=c&&c.unidades&&Object.keys(c.unidades).length?c:null;
  if(c&&!dados&&!motivo)motivo='Nenhuma aba reconhecida no comparativo: cada aba (CDA, CDI) precisa da coluna PERIODO e de uma coluna por ano.';
  if(!dados&&!motivo){motivo='Comparativo não encontrado.';podeLer=true;}
  etapa='';render();
 }
 $('compArquivoBtn')?.addEventListener('click',()=>$('compArquivo')?.click());
 $('compArquivo')?.addEventListener('change',async ev=>{
  const f=ev.target.files&&ev.target.files[0];ev.target.value='';if(!f)return;
  try{passo('Lendo '+f.name+'...');const c=await LN().comparativoDeArquivo(f);await carregar(c);}
  catch(e){motivo='Não foi possível ler '+f.name+': '+e.message;podeLer=true;dados=null;etapa='';render();}
 });
 $('compLer')?.addEventListener('click',async()=>{
  const b=$('compLer');b.classList.add('is-loading');b.disabled=true;
  try{
   await carregar(null,true);
  }finally{b.classList.remove('is-loading');b.disabled=false;}
 });
 document.addEventListener('painel:atualizado',ev=>{carregar(ev.detail?.comparativo||null);});
 // Se os dados já foram montados antes deste módulo carregar, usa o aviso guardado.
 if(window.__painelEvento)carregar(window.__painelEvento.detail?.comparativo||null);
 // Segurança: se o painel não avisar em 6 s, o comparativo é lido mesmo assim.
 setTimeout(()=>{if(!iniciou&&!window.MODO_EQUIPE)carregar(null);},6000);
 render();
})();
