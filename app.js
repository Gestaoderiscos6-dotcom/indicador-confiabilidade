'use strict';
window.addEventListener('error', ev=>{const el=document.getElementById('status');if(el)el.textContent='Erro JavaScript: '+(ev.message||'verifique F12 Console');});
window.addEventListener('unhandledrejection', ev=>{const el=document.getElementById('status');if(el)el.textContent='Erro ao carregar: '+String(ev.reason?.message||ev.reason);});
const REG = new Set(['CDAM','CDBR','CDD','CDPE','CDRS','CDMU']);
const FIELDS=['dat_cnf','turno','codprp','codcnf','cir','suporte','loja','depto','setor','codpro','descricao','prp','cnf','sobra','falta','avaria'];

// Classificacao oficial revisada por CIR (nao pela coluna depto).
const CIRCUITOS_POR_SETOR = {
  'BAZAR': ["10", "208", "240", "270", "280", "290", "291", "301", "320", "980", "PNE", "RG2", "296", "285", "200"],
  'ELETRO': ["211", "243", "900", "910", "933", "998", "EEV", "7", "996", "993"],
  'PAR': ["235", "236", "305", "997", "0"],
  'TÊXTIL': ["340", "MEZ", "330"],
  'LIQUIDA EXPRESS': ["RX3"],
  'PGC': ["8", "101", "131", "999", "EL2", "PER", "PUA", "PUN", "RG4", "RLI", "RSD", "RSP", "SAC", "AER", "250", "MAP", "SDP", "SSP", "LQC", "SSL", "DPR", "LQA", "DPS", "SDL", "SAM", "400", "PAN", "RXD", "RX1", "321", "DPG"],
};
const SETOR_CIR = new Map(Object.entries(CIRCUITOS_POR_SETOR).flatMap(([setor,cirs])=>cirs.map(c=>[c,setor])));
const SETORES=['BAZAR','ELETRO','PGC','TÊXTIL','PAR','LIQUIDA EXPRESS','NÃO CLASSIFICADO'];
function normalizarCir(v){const x=String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim().replace(/\s+/g,'');return /^\d+(\.0+)?$/.test(x)?String(Number(x)):x;}
function setorPorCir(cir){return SETOR_CIR.get(normalizarCir(cir))||'NÃO CLASSIFICADO';}
const SETOR_ICON={'BAZAR':'i-sofa','ELETRO':'i-bolt','PGC':'i-cart','TÊXTIL':'i-shirt','PAR':'i-tag','LIQUIDA EXPRESS':'i-spark','NÃO CLASSIFICADO':'i-help'};
const SETOR_COR={'BAZAR':['#f7941d','#fff3e3'],'ELETRO':['#1449a6','#e8f0fd'],'PGC':['#3cbf6b','#e6f7ec'],'TÊXTIL':['#7a5af8','#f0ecfe'],'PAR':['#00a3c7','#e1f6fb']};
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const $=id=>document.getElementById(id);
const state={cda:[],cdi:[],chart:null,formatos:{},formatosAvisos:[],colaboradores:{},colaboradoresAvisos:[]};
// Quantidades de caixas e ocorrencias sao exibidas como inteiros. Os dados brutos seguem intactos para o NSL.
const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
const pct=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const number=v=>{if(typeof v==='number')return Number.isFinite(v)?v:0;let s=String(v??'').trim().replace(/\s/g,'');if(!s)return 0;if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');return Number(s)||0};
function date(v){if(v instanceof Date&&!Number.isNaN(+v))return v;if(typeof v==='number'&&v>10000){const d=new Date(Math.round((v-25569)*86400000));return Number.isNaN(+d)?null:new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());}let s=String(v??'').trim();const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);if(m){let y=+m[3];if(y<100)y+=2000;const d=new Date(y,+m[2]-1,+m[1]);return d.getFullYear()===y&&d.getMonth()===+m[2]-1&&d.getDate()===+m[1]?d:null;}const iso=s.match(/^(\d{4})-(\d\d)-(\d\d)/);return iso?new Date(+iso[1],+iso[2]-1,+iso[3]):null}
function turno(v){let x=String(v??'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(['MANHA','1','1º','T1','PRIMEIRO'].includes(x))return'T1';if(['TARDE','2','2º','T2','SEGUNDO'].includes(x))return'T2';if(['NOITE','3','3º','T3','TERCEIRO'].includes(x))return'T3';return x||'N/D'}
function depto(v){let x=String(v??'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();if(/\bPGC\b|\bP\.G\.C\b|LIQUIDA/.test(x))return'PGC';if(/ELETRO|ELETRICO/.test(x))return'ELETRO';if(/BAZAR/.test(x))return'BAZAR';if(/TEXTIL/.test(x))return'TÊXTIL';if(/\bPAR\b|\bP\.A\.R/.test(x))return'PAR';return x||'N/D'}
function norm(r){let o={};for(const k of FIELDS)o[k]=r[k]??r[k.toUpperCase()]??'';o.dat_cnf=date(o.dat_cnf);o.turno=turno(o.turno);o.depto=depto(o.depto);for(const k of ['codprp','codcnf','cir','suporte','loja','setor','codpro','descricao'])o[k]=String(o[k]??'').trim();o.loja=o.loja.toUpperCase();o.suporte=o.suporte.replace(/\.0+$/,'');o.cir=normalizarCir(o.cir);o.depto=setorPorCir(o.cir);for(const k of ['prp','cnf','sobra','falta','avaria'])o[k]=number(o[k]);o.erros=o.sobra+o.falta+o.avaria;o.ano=o.dat_cnf?.getFullYear()??null;o.mes=o.dat_cnf?.getMonth()+1??null;o.dia=o.dat_cnf?.getDate()??null;return o}
async function read(files){let out=[];for(const f of files){if(!/\.xlsx?$/i.test(f.name)||f.name.startsWith('~$'))continue;let wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});for(const name of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:true});if(!rows.length)continue;const keys=Object.keys(rows[0]).map(x=>x.toLowerCase().trim());if(!['dat_cnf','cnf','loja'].every(k=>keys.includes(k)))continue;for(const r of rows){let lower={};for(const [k,v] of Object.entries(r))lower[k.toLowerCase().trim()]=v;let row=norm(lower);if(row.dat_cnf)out.push(row)}}}return out}
function base(){let v=$('visao').value;if(v==='geral')return [...state.cda,...state.cdi];if(v==='cdi')return state.cdi;if(v==='regionais')return state.cda.filter(x=>REG.has(x.loja));return state.cda.filter(x=>!REG.has(x.loja))}
function filtered(){return base().filter(r=>(!$('ano').value||r.ano===+$('ano').value)&&(!$('mes').value||r.mes===+$('mes').value)&&(!$('turno').value||r.turno===$('turno').value)&&(!$('depto').value||r.depto===$('depto').value)&&(!$('loja').value||r.loja===$('loja').value))}
function select(id,vals,label=x=>x){const el=$(id),saved=el.value;el.length=1;for(const v of vals){const opt=document.createElement('option');opt.value=v;opt.textContent=label(v);el.appendChild(opt)}el.value=vals.map(String).includes(saved)?saved:''}
function updateOptions(){const d=base();select('ano',[...new Set(d.map(x=>x.ano).filter(Boolean))].sort((a,b)=>a-b));select('mes',[...new Set(d.map(x=>x.mes).filter(Boolean))].sort((a,b)=>a-b),m=>MONTHS[m-1]);select('turno',[...new Set(d.map(x=>x.turno))].sort());select('depto',[...new Set(d.map(x=>x.depto))].sort());select('loja',[...new Set(d.map(x=>x.loja))].sort())}
const sum=(d,k)=>d.reduce((a,r)=>a+(r[k]||0),0);
function stats(d){const cnf=sum(d,'cnf'),avaria=sum(d,'avaria'),falta=sum(d,'falta'),sobra=sum(d,'sobra'),erros=avaria+falta+sobra;return{prp:sum(d,'prp'),cnf,avaria,falta,sobra,erros,nsl:cnf?100*erros/cnf:null}}
function groups(d,k){let m=new Map();for(const r of d){let key=String(r[k]??'N/D')||'N/D';if(!m.has(key))m.set(key,[]);m.get(key).push(r)}return [...m].map(([name,rows])=>({name,...stats(rows),rows})).sort((a,b)=>b.erros-a.erros)}
// V13: tabelas com pictogramas, ranking, chips de divergência e barra de erros.
const TABLE_KIND={produtos:'produto',suportes:'suporte',circuitos:'circuito',preparadoresT1:'colaborador',preparadoresT2:'colaborador',preparadoresT3:'colaborador',lojas:'loja',formatos:'formato',mensal:'mes'};
const KIND_ICON={produto:'i-package',suporte:'i-boxes',circuito:'i-route',colaborador:'i-user',loja:'i-store',formato:'i-building',mes:'i-calendar'};
const HEAD_ICON={'Identificação':'i-tag','Preparado':'i-box','Conferido':'i-check-circle','Avaria':'i-shield-alert','Avarias':'i-shield-alert','Falta':'i-minus-circle','Faltas':'i-minus-circle','Sobra':'i-plus-circle','Sobras':'i-plus-circle','Erros':'i-alert','Acuracidade':'i-target','NSL':'i-gauge','Mês':'i-calendar','Formato':'i-building'};
const HEAD_CLASS={'Avaria':'c-av','Avarias':'c-av','Falta':'c-fa','Faltas':'c-fa','Sobra':'c-so','Sobras':'c-so','Erros':'c-er','Acuracidade':'c-acc','NSL':'c-nsl'};
const ico=(id,cls='')=>'<svg class="ico '+cls+'" aria-hidden="true"><use href="#'+id+'"/></svg>';
const numBR=v=>{const t=String(v??'').replace(/\./g,'').replace(',','.').replace('%','').trim();if(!t||t==='—')return null;const n=Number(t);return Number.isFinite(n)?n:null;};
function iniciais(nome){const p=String(nome||'').trim().split(/\s+/).filter(x=>/[A-Za-zÀ-ú]/.test(x));if(!p.length)return '';return (p[0][0]+(p.length>1?p[p.length-1][0]:'')).toUpperCase();}
function primeiraCelula(kind,valor,det,i,ranking){
 const rank=ranking?'<span class="rank rank-'+(i<3?i+1:'n')+'">'+(i+1)+'</span>':'';
 if(kind==='colaborador'){
  const cod=det?String(det.key):'';const nome=String(valor);const temNome=cod&&nome!==cod;
  const ini=temNome?iniciais(nome):'';
  return '<div class="cell-id">'+rank+'<span class="avatar">'+(ini?esc(ini):ico('i-user'))+'</span><span class="cell-txt"><b>'+esc(nome)+'</b>'+(temNome?'<small>'+ico('i-tag')+'UCA '+esc(cod)+'</small>':'<small>'+(window.MODO_EQUIPE?'Código UCA':'Sem nome no cadastro UCA')+'</small>')+'</span></div>';
 }
 return '<div class="cell-id">'+rank+'<span class="cell-ico k-'+(kind||'x')+'">'+ico(KIND_ICON[kind]||'i-tag')+'</span><span class="cell-txt"><b>'+esc(valor)+'</b></span></div>';
}
function table(id,headers,rows,details=null){
 const target=$(id);
 if(!target){
   console.error('[Confiabilidade] Elemento de tabela ausente no index.html:',id);
   const st=$('status');
   if(st && !st.dataset.missingElements) st.dataset.missingElements='';
   if(st) st.dataset.missingElements += (st.dataset.missingElements?', ':'')+id;
   return;
 }
 const kind=TABLE_KIND[id]||'';const ranking=kind&&kind!=='mes';
 const iErr=headers.indexOf('Erros');
 const maxErr=iErr<0?1:Math.max(1,...rows.map(r=>numBR(r[iErr])||0));
 const head='<thead><tr>'+headers.map((h,i)=>'<th class="'+(HEAD_CLASS[h]||'')+'"><span class="th-in">'+(HEAD_ICON[h]?ico(HEAD_ICON[h]):'')+esc(i===0&&kind==='colaborador'?'Colaborador':h)+'</span></th>').join('')+'</tr></thead>';
 const body=rows.length?rows.map((r,i)=>{
  const det=details&&details[i];
  const attrs=det?' class="drill-row" tabindex="0" role="button" data-detail-kind="'+esc(det.kind)+'" data-detail-key="'+esc(det.key)+'"'+(det.turno?' data-detail-turno="'+esc(det.turno)+'"':'')+' title="Abrir análise detalhada"':'';
  return '<tr'+attrs+'>'+r.map((c,j)=>{
   const h=headers[j],cls=HEAD_CLASS[h]||'';
   if(j===0)return '<td>'+primeiraCelula(kind,c,det,i,ranking)+'</td>';
   const n=numBR(c);
   if(cls==='c-av'||cls==='c-fa'||cls==='c-so')return '<td class="'+cls+'"><span class="chip'+(n?'':' zero')+'">'+esc(c)+'</span></td>';
   if(cls==='c-er')return '<td class="c-er"><span class="err-bar" style="--p:'+Math.round(100*(n||0)/maxErr)+'%"></span><b>'+esc(c)+'</b></td>';
   if(cls==='c-acc'){const ok=n!==null&&n>=99.6;return '<td class="c-acc"><span class="pill '+(n===null?'':ok?'ok':'bad')+'">'+(n===null?'':ico(ok?'i-check':'i-alert'))+esc(c)+'</span></td>';}
   if(cls==='c-nsl'){const ok=n!==null&&n<=0.4;return '<td class="c-nsl"><span class="pill '+(n===null?'':ok?'ok':'bad')+'">'+(n===null?'':ico(ok?'i-check':'i-alert'))+esc(c)+'</span></td>';}
   return '<td>'+esc(c)+'</td>';
  }).join('')+'</tr>';
 }).join(''):'<tr><td class="empty-row" colspan="'+headers.length+'">'+ico('i-search')+' Sem dados neste filtro</td></tr>';
 target.innerHTML='<table>'+head+'<tbody>'+body+'</tbody></table>';
}
const ucaKey=v=>String(v??'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\u00a0/g,' ').trim().toUpperCase().replace(/\.0+$/,'').replace(/\s+/g,'');
function nomePreparador(uca){const key=ucaKey(uca);return state.colaboradores[key]||uca;}
function mostrarStatusUca(msg,warning=false){const el=$('ucaStatus');if(el){el.textContent=msg;el.classList.toggle('uca-warning',warning);}}
const cells=g=>[fmt(g.prp),fmt(g.cnf),fmt(g.avaria),fmt(g.falta),fmt(g.sobra),fmt(g.erros),g.nsl===null?'—':pct(100-g.nsl)];

// V10: busca nos grupos COMPLETOS da seleção (não apenas nos Top 10).
const searchable=new Map();
function montarBusca(id, headers, groupsAll, labelFn, limit=10){
  searchable.set(id,{headers,groupsAll,labelFn,limit});
  aplicarBusca(id);
}
function aplicarBusca(id){
  const info=searchable.get(id);if(!info)return;
  const input=$('busca_'+id),search=String(input?.value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const matches=search?info.groupsAll.filter(g=>(String(info.labelFn(g))+' '+g.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().includes(search)):info.groupsAll.slice(0,info.limit);
  const exibidos=matches.slice(0,150);
  const kind=id.startsWith('preparadores')?'colaborador':id==='lojas'?'loja':id==='suportes'?'suporte':'circuito';
  table(id,info.headers,exibidos.map(g=>[info.labelFn(g),...cells(g)]),exibidos.map(g=>({kind,key:g.name,turno:kind==='colaborador'?id.slice(-2):''})));
  const c=$('contagem_'+id);if(c)c.textContent=search?(matches.length+' resultado(s) encontrado(s)'+(matches.length>150?' · exibindo os primeiros 150':'')):(`Top ${Math.min(info.limit,info.groupsAll.length)} de ${fmt(info.groupsAll.length)} registros · pesquise para localizar outros`);
}
for(const id of ['suportes','circuitos','lojas','preparadoresT1','preparadoresT2','preparadoresT3']){
 const input=$('busca_'+id);if(input)input.addEventListener('input',()=>aplicarBusca(id));
}
function htmlDepartamentos(d){
 const box=$('departamentos');if(!box)return;
 const mapa=new Map();let max=0;
 for(const r of d){if(!['T1','T2','T3'].includes(r.turno))continue;const key=r.turno+'|'+r.depto;
  if(!mapa.has(key))mapa.set(key,{t:r.turno,dep:r.depto,falta:0,sobra:0,avaria:0});
  const z=mapa.get(key);z.falta+=r.falta;z.sobra+=r.sobra;z.avaria+=r.avaria;
 }
 for(const z of mapa.values())max=Math.max(max,z.falta+z.sobra+z.avaria);
 const colors={T1:'#00b2d8',T2:'#1449a6',T3:'#7a5af8'};const shiftIco={T1:'i-sun',T2:'i-sunset',T3:'i-moon'};
 let body='';
 for(const t of ['T1','T2','T3']){
  const a=[...mapa.values()].filter(z=>z.t===t&&Math.abs(z.falta)+Math.abs(z.sobra)+Math.abs(z.avaria)>0).sort((x,y)=>(y.falta+y.sobra+y.avaria)-(x.falta+x.sobra+x.avaria));
  let total=a.reduce((sum,z)=>sum+z.falta+z.sobra+z.avaria,0);
  body+='<section class="dept-shift" style="--shift:'+colors[t]+'"><div class="dept-shift-head"><span class="dept-shift-code">'+ico(shiftIco[t])+'</span><div><b>'+(t==='T1'?'Manhã':t==='T2'?'Tarde':'Noite')+'</b><small>'+t+' · '+a.length+' setores com ocorrência</small></div><strong>'+fmt(total)+' <small>erros</small></strong></div>';
  if(!a.length)body+='<div class="dept-empty">'+ico('i-check-circle')+' Sem divergências para este turno</div>';
  for(const z of a){const total=z.falta+z.sobra+z.avaria;const widths=[z.falta,z.sobra,z.avaria].map(n=>Math.max(0,100*n/Math.max(1,total)));
   body+='<div class="dept-item drill-row" role="button" tabindex="0" title="Detalhar departamento" data-detail-kind="departamento" data-detail-key="'+esc(z.dep)+'" data-detail-turno="'+t+'"><div class="dept-item-title"><b>'+ico(SETOR_ICON[z.dep]||'i-tag','dept-ico')+esc(z.dep)+'</b><strong>'+fmt(total)+'</strong></div><div class="dept-bars"><span class="dept-f" style="width:'+widths[0]+'%"></span><span class="dept-s" style="width:'+widths[1]+'%"></span><span class="dept-a" style="width:'+widths[2]+'%"></span></div><div class="dept-numbers"><span class="dn-f">'+ico('i-minus-circle')+'Falta <b>'+fmt(z.falta)+'</b></span><span class="dn-s">'+ico('i-plus-circle')+'Sobra <b>'+fmt(z.sobra)+'</b></span><span class="dn-a">'+ico('i-shield-alert')+'Avaria <b>'+fmt(z.avaria)+'</b></span></div></div>';
  }
  body+='</section>';
 }
 box.innerHTML='<div class="dept-legend"><span class="dn-f">'+ico('i-minus-circle')+'Falta</span><span class="dn-s">'+ico('i-plus-circle')+'Sobra</span><span class="dn-a">'+ico('i-shield-alert')+'Avaria</span></div><div class="dept-grid">'+body+'</div>';
}
function htmlTurnos(d){
 const box=$('turnos');if(!box)return;
 const statsTurnos={T1:{cnf:0,erros:0},T2:{cnf:0,erros:0},T3:{cnf:0,erros:0}};
 for(const r of d){const x=statsTurnos[r.turno];if(x){x.cnf+=r.cnf;x.erros+=r.erros;}}
 box.innerHTML='<div class="turnos-panel-intro"><span class="tpi-l">'+ico('i-gauge')+' QUALIDADE DE CONFERÊNCIA</span><span class="tpi-r">'+ico('i-target')+'Meta ≤ 0,40%</span></div>'+Object.entries(statsTurnos).map(([t,x])=>{
  const nsl=x.cnf?100*x.erros/x.cnf:null;const good=nsl!==null&&nsl<=.4;return '<div role="button" tabindex="0" title="Detalhar turno" data-detail-kind="turno" data-detail-key="'+t+'" class="shift-card drill-row '+(nsl===null?'neutral':good?'success':'danger')+'"><div class="shift-card-top"><span class="shift-number">'+ico(t==='T1'?'i-sun':t==='T2'?'i-sunset':'i-moon')+'</span><span class="shift-label"><b>'+(t==='T1'?'1º turno':t==='T2'?'2º turno':'3º turno')+'</b><small>'+t+' · '+(t==='T1'?'Manhã':t==='T2'?'Tarde':'Noite')+'</small></span><span class="shift-flag">'+ico(nsl===null?'i-help':good?'i-check-circle':'i-alert')+'</span><strong>'+(nsl===null?'—':pct(nsl))+'</strong></div><div class="shift-track"><span style="width:'+(nsl===null?0:Math.min(100,nsl/.4*100))+'%"></span></div><div class="shift-card-bottom"><span>'+ico('i-check-circle')+fmt(x.cnf)+' caixas conferidas</span><b>'+ico('i-alert')+fmt(x.erros)+' erros</b></div></div>';
 }).join('')+'<div class="shift-insight">'+ico('i-help')+' O NSL considera o total de faltas, sobras e avarias sobre as caixas conferidas.</div>';
 const r=$('turnoResumo');if(r)r.style.display='none';
}

function render(){const d=filtered(),s=stats(d);const values=[['Caixas conferidas',s.cnf],['Avarias',s.avaria],['Faltas',s.falta],['Sobras',s.sobra],['Total de erros',s.erros],...['BAZAR','ELETRO','PGC','TÊXTIL','PAR'].map(k=>[k,sum(d.filter(r=>r.depto===k),'cnf')])];const icons={"Caixas conferidas":"i-check-circle","Avarias":"i-shield-alert","Faltas":"i-minus-circle","Sobras":"i-plus-circle","Total de erros":"i-alert",...SETOR_ICON};
const accents={"Caixas conferidas":['#1449a6','#e8f0fd'],"Avarias":['#f7941d','#fff3e3'],"Faltas":['#e30613','#fde8ea'],"Sobras":['#00a3c7','#e1f6fb'],"Total de erros":['#0b2350','#e9edf5'],...SETOR_COR};
$('kpiGrid').innerHTML=values.map(([n,v],i)=>{const [accent,soft]=accents[n]||(i%2?['#00b2d8','#e3f7fc']:['#3cbf6b','#e6f7ec']);const type=i<5?(i===0?'primary':'error'):'setor';const foot=i===0?'Base do cálculo do NSL':i===4?'Faltas + sobras + avarias':i<4?(s.erros?pct(100*v/s.erros)+' dos erros':'Ocorrências'):'Conferidas'+(s.cnf?' · '+pct(100*v/s.cnf)+' do total':'');return '<div class="kpi" data-type="'+type+'" style="--accent:'+accent+';--soft:'+soft+'"><div class="kpi-head"><span class="kpi-icon"><svg class="ico"><use href="#'+(icons[n]||'i-grid')+'"/></svg></span><span class="kpi-label">'+esc(n)+'</span></div><strong>'+fmt(v)+'</strong><span class="kpi-footer">'+esc(foot)+'</span></div>'}).join('');
$('nsl').textContent=s.nsl===null?'—':pct(s.nsl);{const hp=$('heroPeriodo');if(hp){const p=[$('visao').selectedOptions[0]?.text,$('mes').value?MONTHS[+$('mes').value-1]:'',$('ano').value,$('turno').value,$('depto').value,$('loja').value].filter(Boolean).join(' · ');hp.innerHTML=ico('i-calendar')+' '+esc(p||'Todos os períodos');}}
const nslCard=document.querySelector('.nsl-card');if(nslCard)nslCard.classList.toggle('critico',s.nsl!==null&&s.nsl>.4);
const nslSituacao=$('nslSituacao');if(nslSituacao)nslSituacao.textContent=s.nsl===null?'Sem dados para o período':s.nsl<=.4?'Dentro da meta estabelecida':'Acima da meta estabelecida';
const arc=$('nslArco');if(arc){const length=arc.getTotalLength();const ratio=s.nsl===null?0:Math.max(0,Math.min(1,s.nsl/.4));arc.style.strokeDasharray=length+' '+length;arc.style.strokeDashoffset=String(length*(1-ratio));}const delta=$('nslDelta');if(delta)delta.innerHTML=s.nsl===null?'Sem dados':(s.nsl<=.4?ico('i-check')+pct(.4-s.nsl)+' abaixo da meta':ico('i-arrow-up')+pct(s.nsl-.4)+' acima da meta');
const daily=groups(d,'dia').sort((a,b)=>+a.name-+b.name).filter(x=>x.name!=='N/D');const labels=daily.map(x=>x.name);if(state.chart)state.chart.destroy();if(typeof Chart!=='undefined'){Chart.defaults.font.family="Inter,'Segoe UI',sans-serif";Chart.defaults.color='#6b7f99';state.chart=new Chart($('diario'),{type:'bar',plugins:[{id:'valoresAcimaBarras',afterDatasetsDraw(chart){const meta=chart.getDatasetMeta(0);const ctx=chart.ctx;if(!meta.data.length||chart.chartArea.width/meta.data.length<31)return;ctx.save();ctx.textAlign='center';ctx.font='700 10px Segoe UI, sans-serif';ctx.fillStyle='#0b2350';meta.data.forEach((bar,i)=>{const y=Math.max(chart.chartArea.top+12,bar.y-7);ctx.fillText(fmt(chart.data.datasets[0].data[i]),bar.x,y);});ctx.restore();}}],data:{labels,datasets:[{label:'Erros',data:daily.map(x=>x.erros),backgroundColor:(c)=>{const a=c.chart.chartArea;if(!a)return '#00b2d8';const g=c.chart.ctx.createLinearGradient(0,a.bottom,0,a.top);g.addColorStop(0,'#3cbf6b');g.addColorStop(1,'#00b2d8');return g;},hoverBackgroundColor:'#1449a6',borderRadius:6,maxBarThickness:24,yAxisID:'y'},{type:'line',label:'NSL',data:daily.map(x=>x.nsl),borderColor:'#1449a6',backgroundColor:'#1449a6',borderWidth:2.5,tension:.35,pointRadius:3,pointHoverRadius:6,pointBackgroundColor:'#fff',pointBorderWidth:2,yAxisID:'y1'},{type:'line',label:'Meta 0,40%',data:daily.map(()=>.4),borderColor:'#e30613',borderWidth:1.5,borderDash:[6,5],pointRadius:0,yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false,position:'bottom',labels:{usePointStyle:true,boxWidth:7,padding:18,font:{weight:'600'}}},tooltip:{backgroundColor:'#0b2350',padding:13,cornerRadius:12,titleFont:{weight:'700'},boxPadding:4,callbacks:{label:(ctx)=>ctx.dataset.label+': '+(ctx.dataset.yAxisID==='y1'?pct(ctx.parsed.y):fmt(ctx.parsed.y))}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:16,color:'#6b7f99'}},y:{beginAtZero:true,grid:{color:'#eef2f7'},border:{display:false},ticks:{color:'#6b7f99',callback:v=>fmt(v)}},y1:{position:'right',beginAtZero:true,grid:{drawOnChartArea:false},border:{display:false},ticks:{color:'#1449a6',callback:x=>x+'%'}}}}})}
htmlDepartamentos(d);htmlTurnos(d);
const hdr=['Identificação','Preparado','Conferido','Avaria','Falta','Sobra','Erros','Acuracidade'];
const mk=g=>[g.name,...cells(g)];
const gruposProdutos=groups(d,'codpro').slice(0,10);table('produtos',hdr,gruposProdutos.map(g=>[g.rows[0]?.descricao||g.name,...cells(g)]),gruposProdutos.map(g=>({kind:'produto',key:g.name})));
montarBusca('suportes',hdr,groups(d,'suporte'),g=>String(g.name).replace(/\.0+$/,''),10);
montarBusca('circuitos',hdr,groups(d,'cir'),g=>normalizarCir(g.name),15);
for(const t of ['T1','T2','T3'])montarBusca('preparadores'+t,hdr,groups(d.filter(r=>r.turno===t),'codprp'),g=>nomePreparador(g.name),10);
const mons=[...new Set(d.map(x=>x.ano+'-'+String(x.mes).padStart(2,'0')))].sort();table('mensal',['Mês','Conferido','Avaria','Falta','Sobra','Erros','NSL'],mons.filter(m=>!m.includes('null')).map(m=>{let [y,mo]=m.split('-').map(Number),z=stats(d.filter(x=>x.ano===y&&x.mes===mo));return[MONTHS[mo-1]+'/'+y,fmt(z.cnf),fmt(z.avaria),fmt(z.falta),fmt(z.sobra),fmt(z.erros),z.nsl===null?'—':pct(z.nsl)]}));montarBusca('lojas',hdr,groups(d,'loja'),g=>g.name,10);
 const agrupadoPorFormato=new Map();
 for(const row of d){
   const formato=state.formatos[row.loja]||'NÃO CADASTRADO';
   if(!agrupadoPorFormato.has(formato))agrupadoPorFormato.set(formato,[]);
   agrupadoPorFormato.get(formato).push(row);
 }
 const performance=[...agrupadoPorFormato].map(([nome,rows])=>({nome,...stats(rows)})).sort((a,b)=>b.erros-a.erros);
 table('formatos',['Formato','Conferido','Avarias','Faltas','Sobras','Erros','NSL'],performance.map(x=>[x.nome,fmt(x.cnf),fmt(x.avaria),fmt(x.falta),fmt(x.sobra),fmt(x.erros),x.nsl===null?'—':pct(x.nsl)]),performance.map(x=>({kind:'formato',key:x.nome})));
 const desconhecidos=groups(d.filter(r=>r.depto==='NÃO CLASSIFICADO'),'cir');
 const aviso=$('alertaCircuitos');
 if(aviso){
  if(desconhecidos.length){
    const detalhe=desconhecidos.map(g=>esc(normalizarCir(g.name)||'(vazio)')+' ('+fmt(g.cnf)+' cx)').join(', ');
    aviso.innerHTML='<strong>⚠ Circuitos sem classificação: '+desconhecidos.length+' código(s)</strong><p>Não foram associados a nenhum setor. Confira a coluna CIR: '+detalhe+'</p><small>Essas caixas continuam nos totais gerais, mas não entram nos setores conhecidos.</small>';
    aviso.hidden=false;const ac=$('adminCount');if(ac)ac.textContent=desconhecidos.length+' códigos';
  } else {aviso.hidden=true;aviso.innerHTML='';const ac=$('adminCount');if(ac)ac.textContent='Tudo classificado';}
 }
 const lojasNaoCadastradas=groups(d.filter(r=>r.loja && !state.formatos[r.loja]),'loja');
 const avisoLojas=$('alertaFormatos');
 if(avisoLojas){avisoLojas.hidden=!lojasNaoCadastradas.length;
 avisoLojas.textContent=lojasNaoCadastradas.length?'⚠ '+lojasNaoCadastradas.length+' loja(s) sem formato cadastrado: '+lojasNaoCadastradas.map(g=>g.name).join(', '):'';}
}
// V11: detalhamento analítico respeitando os filtros vigentes, sem mudar a base.
let lastDetailTrigger=null;
function detailLabel(kind,key){const lbl={produto:'Produto',suporte:'Suporte',circuito:'Circuito',colaborador:'Preparador',loja:'Loja',turno:'Turno',departamento:'Departamento',formato:'Formato'};return (lbl[kind]||'Registro')+' · '+(kind==='colaborador'?nomePreparador(key):key);}
function detailRows(kind,key,shift){
 const d=filtered(); const k=String(key);
 return d.filter(r=>{if(shift&&r.turno!==shift)return false;
  switch(kind){case 'produto':return r.codpro===k;case 'suporte':return r.suporte===k;case 'circuito':return r.cir===k;case 'colaborador':return r.codprp===k;case 'loja':return r.loja===k;case 'turno':return r.turno===k;case 'departamento':return r.depto===k;case 'formato':return (state.formatos[r.loja]||'NÃO CADASTRADO')===k;default:return false;}});
}
function detailMetric(title,value,note,cls='',icone='i-chart'){return '<div class="detail-metric '+cls+'"><span>'+ico(icone)+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></div>';}
function detailGroup(rows,keyFn,limit=8){const map=new Map();for(const r of rows){const key=String(keyFn(r)||'N/D');let x=map.get(key);if(!x){x={key,prp:0,cnf:0,falta:0,sobra:0,avaria:0,erros:0};map.set(key,x);}for(const f of ['prp','cnf','falta','sobra','avaria','erros'])x[f]+=r[f]||0;}return [...map.values()].sort((a,b)=>b.erros-a.erros).slice(0,limit);}
function detailTable(title,desc,groups,empty='Sem divergências encontradas'){
 return '<section class="detail-section"><div class="detail-section-head"><div><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p></div><b>'+fmt(groups.length)+' exibidos</b></div><div class="detail-table-wrap"><table><thead><tr><th>Identificação</th><th>Conferido</th><th>Falta</th><th>Sobra</th><th>Avaria</th><th>Erros</th></tr></thead><tbody>'+(groups.length?groups.map(g=>'<tr><td>'+esc(g.key)+'</td><td>'+fmt(g.cnf)+'</td><td>'+fmt(g.falta)+'</td><td>'+fmt(g.sobra)+'</td><td><b>'+fmt(g.avaria)+'</b></td><td><strong>'+fmt(g.erros)+'</strong></td></tr>').join(''):'<tr><td colspan="6">'+esc(empty)+'</td></tr>')+'</tbody></table></div></section>';
}
function openDetail(kind,key,shift=''){
 const dialog=$('detailDialog');if(!dialog)return;const rows=detailRows(kind,key,shift);const s=stats(rows);const title=(kind==='produto'?(rows.find(r=>r.descricao)?.descricao||key):kind==='colaborador'?nomePreparador(key):key);
 $('detailKind').textContent='CONFIABILIDADE  /  '+kind.toUpperCase()+'  /  '+$('visao').selectedOptions[0].text;
 $('detailTitle').textContent=title;
 $('detailSubtitle').textContent=(kind==='colaborador'?'UCA '+key+' · ':'')+(shift?'Turno '+shift+' · ':'')+fmt(rows.length)+' registro(s) na seleção atual';
 const modalCards='<div class="detail-metrics">'+detailMetric('Preparado',fmt(s.prp),'Caixas preparadas','','i-box')+detailMetric('Conferido',fmt(s.cnf),'Caixas conferidas','','i-check-circle')+detailMetric('Faltas',fmt(s.falta),'Quantidade','danger','i-minus-circle')+detailMetric('Sobras',fmt(s.sobra),'Quantidade','info','i-plus-circle')+detailMetric('Avarias',fmt(s.avaria),'Quantidade','warning','i-shield-alert')+detailMetric('Total de erros',fmt(s.erros),s.nsl===null?'NSL indisponível':'NSL '+pct(s.nsl),'primary','i-alert')+'</div>';
 const max=Math.max(1,s.erros);const breakdown=[['Falta',s.falta,'lack'],['Sobra',s.sobra,'surplus'],['Avaria',s.avaria,'damage']];
 const bar='<section class="detail-section detail-composition"><div class="detail-section-head"><div><h3>Composição das divergências</h3><p>Distribuição proporcional no período selecionado</p></div><span class="detail-quality">NSL <b>'+(s.nsl===null?'—':pct(s.nsl))+'</b></span></div><div class="detail-stack">'+breakdown.map(([label,val,cls])=>'<span class="'+cls+'" style="width:'+(100*Math.max(0,val)/max)+'%" title="'+label+': '+fmt(val)+'"></span>').join('')+'</div><div class="detail-breakdown">'+breakdown.map(([label,val,cls])=>'<div class="'+cls+'"><i></i><span>'+label+'</span><strong>'+fmt(val)+'</strong><small>'+(100*Math.max(0,val)/max).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%</small></div>').join('')+'</div></section>';
 const byLoja=detailGroup(rows,r=>r.loja,12), byProduto=detailGroup(rows,r=>(r.descricao||r.codpro)+' ['+r.codpro+']',12),bySuporte=detailGroup(rows,r=>r.suporte,12),byTurno=detailGroup(rows,r=>r.turno,3),byPreparador=detailGroup(rows,r=>nomePreparador(r.codprp),12);
 const distributions='<div class="detail-dual">'+detailTable('Lojas envolvidas','Onde as divergências se concentraram',byLoja)+detailTable('Produtos envolvidos','Descrição do item e código',byProduto)+'</div>';
 const ext=(kind==='loja'||kind==='formato')?detailTable('Preparadores envolvidos','Colaboradores por volume de erros',byPreparador):detailTable('Suportes envolvidos','Identificações relacionadas',bySuporte);
 const shiftTable=kind==='turno'?'':detailTable('Turnos relacionados','Ocorrências por turno',byTurno);
 const raw=rows.filter(r=>r.erros!==0).sort((a,b)=>b.erros-a.erros).slice(0,80);
 const rawHtml='<section class="detail-section"><div class="detail-section-head"><div><h3>Rastreabilidade das ocorrências</h3><p>Até 80 linhas de registros com divergência, ordenadas por impacto</p></div><b>'+fmt(raw.length)+' linhas</b></div><div class="detail-table-wrap detail-raw"><table><thead><tr><th>Data</th><th>Turno</th><th>Loja</th><th>Produto</th><th>Suporte</th><th>Preparador</th><th>Falta</th><th>Sobra</th><th>Avaria</th></tr></thead><tbody>'+(raw.length?raw.map(r=>'<tr><td>'+esc(r.dat_cnf instanceof Date?r.dat_cnf.toLocaleDateString('pt-BR'):'—')+'</td><td>'+esc(r.turno)+'</td><td>'+esc(r.loja)+'</td><td>'+esc(r.descricao||r.codpro)+'</td><td>'+esc(r.suporte)+'</td><td>'+esc(nomePreparador(r.codprp))+'</td><td>'+fmt(r.falta)+'</td><td>'+fmt(r.sobra)+'</td><td>'+fmt(r.avaria)+'</td></tr>').join(''):'<tr><td colspan="9">Sem divergências nos registros selecionados.</td></tr>')+'</tbody></table></div></section>';
 $('detailContent').innerHTML=modalCards+bar+distributions+'<div class="detail-dual">'+ext+shiftTable+'</div>'+rawHtml;
 dialog.hidden=false;dialog.setAttribute('aria-hidden','false');document.body.classList.add('detail-open');$('detailClose').focus();
}
function closeDetail(){const dialog=$('detailDialog');if(!dialog)return;dialog.hidden=true;dialog.setAttribute('aria-hidden','true');document.body.classList.remove('detail-open');if(lastDetailTrigger?.isConnected)lastDetailTrigger.focus();}
document.addEventListener('click',ev=>{
 if(ev.target.closest('#detailClose,[data-close-detail]')){closeDetail();return;}
 const clicked=ev.target.closest('[data-detail-kind]');if(!clicked||!$('detailDialog')?.hidden)return;
 lastDetailTrigger=clicked;openDetail(clicked.dataset.detailKind,clicked.dataset.detailKey,clicked.dataset.detailTurno||'');
});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('detailDialog')?.hidden){closeDetail();return;}if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[data-detail-kind]')){ev.preventDefault();lastDetailTrigger=ev.target;openDetail(ev.target.dataset.detailKind,ev.target.dataset.detailKey,ev.target.dataset.detailTurno||'');}});

async function carregarBases(forcarAtualizacao=false){
 const btn=$('carregar'); if(!btn||!$('status')){console.error('HTML incompleto: falta carregar/status');return;} btn.disabled=true; $('status').textContent=forcarAtualizacao?'Verificando arquivos alterados...':'Carregando snapshot local...';
 try {let colaboradoresRequest=(window.MODO_EQUIPE||(window.LeitorNavegador&&LeitorNavegador.ativo()))?null:fetch('/api/colaboradores',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('Rota /api/colaboradores não disponível (HTTP '+r.status+'). Atualize somente o leitor_local.py do pacote.');return r.json();}).then(data=>({ok:true,data})).catch(err=>({ok:false,erro:err.message}));
  let payload;
  if(window.MODO_EQUIPE&&window.LeitorNavegador){
   // Versão da equipe (GitHub): dados publicados embutidos em dados-equipe.js.
   payload=await LeitorNavegador.carregarEquipe(msg=>{$('status').textContent=msg;});
   colaboradoresRequest=Promise.resolve({ok:true,data:{colaboradores:payload.colaboradores||{},avisos:payload.colaboradores_avisos||[]}});
  }else if(window.LeitorNavegador&&LeitorNavegador.ativo()){
   // V14: HTML aberto direto no Chrome/Edge -> lê as pastas CDA/CDI/SISTEMA pelo navegador.
   payload=await LeitorNavegador.obter(forcarAtualizacao,msg=>{$('status').textContent=msg;});
   if(!payload){document.dispatchEvent(new CustomEvent('painel:sem-pasta'));return;}
   colaboradoresRequest=Promise.resolve({ok:true,data:{colaboradores:payload.colaboradores||{},avisos:payload.colaboradores_avisos||[]}});
  }else{
  const res=await fetch('/api/dados'+(forcarAtualizacao?'?refresh=1':''),{cache:'no-store'});payload=await res.json();
 if(!res.ok)throw new Error(payload.erro||'Falha no leitor');
  }
 $('status').textContent='Dados recebidos. Preparando registros...';
 await new Promise(resolve=>setTimeout(resolve,20));
 if(!Array.isArray(payload.cda)||!Array.isArray(payload.cdi))throw new Error('Resposta do leitor sem as bases CDA/CDI. Consulte /api/status.');state.cda=payload.cda.map(norm);state.cdi=payload.cdi.map(norm);state.formatos=payload.formatos||{};state.formatosAvisos=payload.formatos_avisos||[];
  const cadastro=await colaboradoresRequest;
  state.colaboradores={};state.colaboradoresAvisos=cadastro.ok?(cadastro.data?.avisos||[]):[cadastro.erro];
  for(const [uca,nome] of Object.entries(cadastro.ok?(cadastro.data?.colaboradores||{}):{}))state.colaboradores[ucaKey(uca)]=nome;
  const amostraUca=[...state.cda.slice(0,10000),...state.cdi.slice(0,10000)].filter(r=>r.codprp).map(r=>ucaKey(r.codprp));
  const correspondentes=amostraUca.filter(k=>state.colaboradores[k]).length;
  const qtd=Object.keys(state.colaboradores).length;
  if(!cadastro.ok)mostrarStatusUca('⚠ '+cadastro.erro,true);
  else if(!qtd)mostrarStatusUca('⚠ Base UCA sem nomes. Verifique /api/colaboradores',true);
  else if(amostraUca.length&&!correspondentes)mostrarStatusUca('⚠ '+fmt(qtd)+' UCAs lidos, mas nenhum coincide com os códigos dos preparadores. Verifique /api/diagnostico.',true);
  else mostrarStatusUca(fmt(qtd)+' nomes no cadastro UCA · '+fmt(correspondentes)+' correspondência(s) na amostra');
 $('status').textContent='Registros preparados. Montando indicadores...';
 await new Promise(resolve=>setTimeout(resolve,20));
 updateOptions();render();
 window.__painelDetalhe=null;document.dispatchEvent(window.__painelEvento=new CustomEvent('painel:atualizado',{detail:{refresh:forcarAtualizacao,cache:payload.cache_info||null,arquivos:payload.arquivos||[],gerado:payload.snapshot_gerado_em||null,cda:state.cda.length,cdi:state.cdi.length,avisos:(payload.avisos||[]).length,comparativo:payload.comparativo||null}}));
 $('status').textContent=`${fmt(state.cda.length)} registros CDA + ${fmt(state.cdi.length)} CDI | ${(payload.arquivos||[]).length} arquivo(s) | ${Object.keys(state.formatos).length} formatos de lojas | Atualizado em ${new Date().toLocaleTimeString('pt-BR')}`;
 if(!Object.keys(state.formatos).length && $('alertaFormatos')){$('alertaFormatos').hidden=false;$('alertaFormatos').textContent='⚠ Nenhum formato de loja carregado. Confira formatos_loja.xlsx na pasta SISTEMA e abra /api/diagnostico.';}
 if(state.colaboradoresAvisos.length){console.info('Cadastro UCA:',state.colaboradoresAvisos);}
 if(state.formatosAvisos.length){console.warn('Avisos formatos_loja:',state.formatosAvisos);$('status').textContent+=' | Formatos: '+state.formatosAvisos.join(' / ')}
 if(!state.cda.length){$('status').textContent+=' | ALERTA: CDA sem registros, veja /api/diagnostico';} if(payload.avisos?.length){console.warn('Avisos de importação',payload.avisos);$('status').textContent+=' | '+payload.avisos.length+' aviso(s) — consulte o console F12';}
 if($('status').dataset.missingElements){$('status').textContent+=' | Atenção: blocos HTML ausentes: '+$('status').dataset.missingElements;}
 }catch(e){console.error(e);$('status').textContent='Erro ao carregar ou montar o painel: '+e.message;document.dispatchEvent(new CustomEvent('painel:erro',{detail:{mensagem:e.message}}));}finally{btn.disabled=false;}
}
$('carregar').addEventListener('click',()=>carregarBases(true));
$('limparFiltros').addEventListener('click',()=>{for(const id of ['ano','mes','turno','depto','loja'])$(id).value='';render();});
$('visao').addEventListener('change',()=>{updateOptions();render()});
for(const id of ['ano','mes','turno','depto','loja'])$(id).addEventListener('change',render);
$('pdf').addEventListener('click',()=>exportarA4(false));
$('pdfTodos').addEventListener('click',()=>exportarA4(true));
carregarBases();


// V15.2 · Relatório A4: uma folha por unidade (CDA Geral, CDA, CDI/CDX, Regionais),
// mesmo visual do painel (cores da Gestão de Riscos e das bandeiras, pictogramas, gráficos).
// No Chrome/Edge: Destino "Salvar como PDF", Margens "Nenhuma", marcar "Gráficos de plano de fundo".
function exportarA4(todas){
  if(!state.cda.length && !state.cdi.length){alert('Atualize as bases antes de exportar.');return}
  const UN={geral:{nome:'CDA GERAL',sub:'CDA + CDI/CDX consolidado',cor:'#0a4fa3',ic:'i-grid'},cda:{nome:'CDA',sub:'Centro de Distribuição (sem regionais)',cor:'#1449a6',ic:'i-boxes'},
    cdi:{nome:'CDI / CDX',sub:'Centro de Distribuição CDI / CDX',cor:'#00a8cf',ic:'i-building'},regionais:{nome:'REGIONAIS',sub:'Lojas regionais',cor:'#f7941d',ic:'i-store'}};
  const views=todas?['geral','cda','cdi','regionais']:[$('visao').value];
  const filtro=r=>(!$('ano').value||r.ano===+$('ano').value)&&(!$('mes').value||r.mes===+$('mes').value)&&(!$('turno').value||r.turno===$('turno').value)&&(!$('depto').value||r.depto===$('depto').value)&&(!$('loja').value||r.loja===$('loja').value);
  const base=v=>v==='geral'?[...state.cda,...state.cdi]:v==='cdi'?state.cdi:v==='regionais'?state.cda.filter(r=>REG.has(r.loja)):state.cda.filter(r=>!REG.has(r.loja));
  const periodo=[$('ano').value||'Todos os anos',$('mes').value?MONTHS[Number($('mes').value)-1]:'Todos os meses',$('turno').value||'Todos os turnos',$('depto').value||'Todos os setores',$('loja').value?'Loja '+$('loja').value:'Todas as lojas'].join(' · ');
  const emissao=new Date().toLocaleString('pt-BR');
  const abs=p=>{try{return new URL(p,location.href).href}catch(e){return p}};
  const LOGO={};
  for(const [sel,arq] of [['.brand-gr','assets/logo-gestao-riscos.png'],['.brand-carrefour','assets/logo-grupo-carrefour.png'],['.foot-gr','assets/logo-gr-horizontal-branco.png']]){
   const im=document.querySelector(sel);let url=abs(arq);
   try{if(im&&im.complete&&im.naturalWidth){const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);url=c.toDataURL('image/png');}}catch(e){/* file:// pode bloquear: usa o endereço do arquivo */}
   LOGO[arq]=url;
  }
  const logo=arq=>LOGO[arq]||abs(arq);
  const I=(id,c='')=>'<svg class="i '+c+'"><use href="#'+id+'"/></svg>';
  const P=v=>v===null||v===undefined?'—':pct(v);
  const nslPill=v=>v===null?'<span class="pl">—</span>':'<span class="pl '+(v<=.4?'ok':'bad')+'">'+P(v)+'</span>';
  const chip=(v,c)=>'<span class="ch '+(v?c:'z')+'">'+fmt(v)+'</span>';
  const SETOR_I={'BAZAR':['i-sofa','#f7941d'],'ELETRO':['i-bolt','#1449a6'],'PGC':['i-cart','#2fb35f'],'TÊXTIL':['i-shirt','#7a5af8'],'PAR':['i-tag','#00a8cf'],'LIQUIDA EXPRESS':['i-spark','#9b2c74'],'NÃO CLASSIFICADO':['i-help','#97a6bb']};
  const TURNO={T1:['i-sun','#00b2d8','Manhã'],T2:['i-sunset','#1449a6','Tarde'],T3:['i-moon','#7a5af8','Noite']};
  const tabela=(cab,linhas,cls='')=>'<table class="'+cls+'"><thead><tr>'+cab.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+(linhas.length?linhas.map(l=>'<tr>'+l.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+cab.length+'" class="vz">Sem dados no filtro</td></tr>')+'</tbody></table>';
  const rank=i=>'<span class="rk r'+(i<3?i+1:'n')+'">'+(i+1)+'</span>';

  function grafico(rows,cor){
    const dias=groups(rows,'dia').filter(g=>g.name!=='N/D').sort((a,b)=>Number(a.name)-Number(b.name));
    if(!dias.length)return '<div class="vz box">Sem dados diários</div>';
    const W=740,H=128,L=34,R=40,T=12,B=20,w=W-L-R,h=H-T-B,n=dias.length,step=w/n,bw=Math.min(16,step*.62);
    const maxE=Math.max(1,...dias.map(d=>d.erros)),maxN=Math.max(.5,...dias.map(d=>d.nsl||0))*1.1;
    const y1=v=>T+h-(v/maxE)*h,y2=v=>T+h-(v/maxN)*h;
    let s='<svg viewBox="0 0 '+W+' '+H+'" class="graf"><defs><linearGradient id="gb" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3cbf6b"/><stop offset="1" stop-color="#00b2d8"/></linearGradient></defs>';
    for(let k=0;k<=4;k++){const yy=T+h*k/4;s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#eef2f7"/><text x="'+(L-5)+'" y="'+(yy+3)+'" text-anchor="end" class="ax">'+fmt(maxE*(1-k/4))+'</text><text x="'+(W-R+5)+'" y="'+(yy+3)+'" class="ax ax2">'+(maxN*(1-k/4)).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%</text>';}
    dias.forEach((d,i)=>{const x=L+step*i+step/2;s+='<rect x="'+(x-bw/2)+'" y="'+y1(d.erros)+'" width="'+bw+'" height="'+Math.max(.5,T+h-y1(d.erros))+'" rx="2.5" fill="url(#gb)"/><text x="'+x+'" y="'+(H-8)+'" text-anchor="middle" class="ax">'+esc(d.name)+'</text>';});
    const ym=y2(.4);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+ym+'" y2="'+ym+'" stroke="#e30613" stroke-dasharray="5 4" stroke-width="1.2"/><text x="'+(W-R-2)+'" y="'+(ym-3)+'" text-anchor="end" class="mt">Meta 0,40%</text>';
    const pts=dias.map((d,i)=>d.nsl===null?null:[L+step*i+step/2,y2(d.nsl)]).filter(Boolean);
    if(pts.length){s+='<polyline points="'+pts.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="'+cor+'" stroke-width="2" stroke-linejoin="round"/>';pts.forEach(p=>{s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2.4" fill="#fff" stroke="'+cor+'" stroke-width="1.5"/>';});}
    return s+'</svg>';
  }
  function gauge(v){
    const frac=v===null?0:Math.min(1,v/.8),len=260.8,crit=v!==null&&v>.4;
    return '<svg viewBox="0 0 210 124" class="ga"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="'+(crit?'#f7941d':'#9bd21c')+'"/><stop offset="1" stop-color="'+(crit?'#e30613':'#00b2d8')+'"/></linearGradient></defs><path d="M 22 105 A 83 83 0 0 1 188 105" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="15" stroke-linecap="round"/><path d="M 22 105 A 83 83 0 0 1 188 105" fill="none" stroke="url(#gg)" stroke-width="15" stroke-linecap="round" stroke-dasharray="'+len+'" stroke-dashoffset="'+(len*(1-frac))+'"/><line x1="105" y1="16" x2="105" y2="30" stroke="#fff" stroke-width="2" opacity=".6"/></svg>';
  }

  function folha(v,idx,total){
    const u=UN[v]||UN.geral,rows=base(v).filter(filtro),s=stats(rows);
    const kp=[['Caixas conferidas',s.cnf,'i-check-circle','#1449a6','Base do NSL'],['Avarias',s.avaria,'i-shield-alert','#f7941d',s.erros?pct(100*s.avaria/s.erros)+' dos erros':'—'],['Faltas',s.falta,'i-minus-circle','#e30613',s.erros?pct(100*s.falta/s.erros)+' dos erros':'—'],['Sobras',s.sobra,'i-plus-circle','#00a8cf',s.erros?pct(100*s.sobra/s.erros)+' dos erros':'—'],['Total de erros',s.erros,'i-alert','#0b2350','Faltas + sobras + avarias']];
    const setores=SETORES.map(k=>[k,sum(rows.filter(x=>x.depto===k),'cnf')]).filter(([k,c])=>c>0||['BAZAR','ELETRO','PGC','TÊXTIL','PAR'].includes(k)).slice(0,6);
    const deps=[];for(const t of ['T1','T2','T3'])for(const dep of SETORES){const z=stats(rows.filter(r=>r.turno===t&&r.depto===dep));if(!z.falta&&!z.sobra&&!z.avaria)continue;deps.push(['<span class="tn" style="--t:'+TURNO[t][1]+'">'+I(TURNO[t][0])+t+'</span>','<span class="dp">'+I((SETOR_I[dep]||['i-tag'])[0],'')+esc(dep)+'</span>',chip(z.falta,'fa'),chip(z.sobra,'so'),chip(z.avaria,'av'),'<b>'+fmt(z.erros)+'</b>']);}
    const turnos=['T1','T2','T3'].map(t=>{const z=stats(rows.filter(r=>r.turno===t));const pctBar=z.nsl===null?0:Math.min(100,z.nsl/.8*100);return '<div class="tc '+(z.nsl===null?'':z.nsl<=.4?'ok':'bad')+'" style="--t:'+TURNO[t][1]+'"><span class="ti">'+I(TURNO[t][0])+'</span><div class="tx"><b>'+t+' · '+TURNO[t][2]+'</b><small>'+fmt(z.cnf)+' conferidas · '+fmt(z.erros)+' erros</small><i class="tb"><em style="width:'+pctBar+'%"></em></i></div><strong>'+P(z.nsl)+'</strong></div>';}).join('');
    const lojas=groups(rows,'loja').slice(0,7).map((g,i)=>[rank(i)+'<span class="nm">'+I('i-store','k-lo')+esc(g.name)+'</span>',fmt(g.cnf),chip(g.erros,'er'),nslPill(g.nsl)]);
    const prods=groups(rows,'codpro').slice(0,5).map((g,i)=>[rank(i)+'<span class="nm">'+I('i-package','k-pr')+esc((g.rows[0]?.descricao||g.name).slice(0,34))+'</span>',fmt(g.cnf),chip(g.falta,'fa'),chip(g.sobra,'so'),chip(g.avaria,'av'),'<b>'+fmt(g.erros)+'</b>']);
    const sups=groups(rows,'suporte').slice(0,5).map((g,i)=>[rank(i)+'<span class="nm">'+I('i-boxes','k-su')+esc(g.name)+'</span>',fmt(g.cnf),chip(g.erros,'er')]);
    const cirs=groups(rows,'cir').slice(0,5).map((g,i)=>[rank(i)+'<span class="nm">'+I('i-route','k-ci')+esc(g.name)+'</span>',fmt(g.cnf),chip(g.erros,'er')]);
    const preps=['T1','T2','T3'].flatMap(t=>groups(rows.filter(r=>r.turno===t),'codprp').slice(0,3).map(g=>{const nome=nomePreparador(g.name);const ini=String(nome).split(/\s+/).filter(x=>/[A-Za-zÀ-ú]/.test(x));const av=ini.length?(ini[0][0]+(ini.length>1?ini[ini.length-1][0]:'')).toUpperCase():'#';return ['<span class="tn" style="--t:'+TURNO[t][1]+'">'+t+'</span>','<span class="nm"><i class="av" style="--t:'+TURNO[t][1]+'">'+esc(av)+'</i>'+esc(String(nome).slice(0,26))+'</span>',fmt(g.cnf),chip(g.erros,'er'),nslPill(g.nsl)];}));
    const meses=[...new Set(rows.filter(r=>r.ano&&r.mes).map(r=>r.ano*100+r.mes))].sort((a,b)=>a-b).map(k=>{const y=Math.floor(k/100),m=k%100,z=stats(rows.filter(r=>r.ano===y&&r.mes===m));return ['<span class="nm">'+I('i-calendar','k-me')+MONTHS[m-1].slice(0,3)+'/'+String(y).slice(2)+'</span>',fmt(z.cnf),chip(z.falta,'fa'),chip(z.sobra,'so'),chip(z.avaria,'av'),nslPill(z.nsl)];});
    const crit=s.nsl!==null&&s.nsl>.4;
    return '<section class="sheet" style="--u:'+u.cor+'">'+
     '<div class="strip"><i></i><i></i><i></i><i></i></div><div class="ct">'+
     '<header><div class="logos"><img src="'+logo('assets/logo-gestao-riscos.png')+'" onerror="this.remove()"><span class="sep"></span><img class="cf" src="'+logo('assets/logo-grupo-carrefour.png')+'" onerror="this.remove()"></div>'+
     '<div class="ttl"><small>'+I('i-shield')+' GESTÃO DE RISCOS · INDICADOR DE CONFIABILIDADE</small><h1><span class="ub">'+I(u.ic)+'</span>'+esc(u.nome)+'</h1><p>'+esc(u.sub)+'</p></div>'+
     '<div class="meta"><span>'+I('i-calendar')+esc(periodo)+'</span><span>'+I('i-clock')+'Emissão '+esc(emissao)+'</span><span class="pg">Folha '+(idx+1)+' de '+total+'</span></div></header>'+
     '<div class="top"><div class="kpis">'+kp.map(([n,val,ic,c,f])=>'<div class="kp" style="--c:'+c+'"><span class="ki">'+I(ic)+'</span><div><small>'+n+'</small><b>'+fmt(val)+'</b><em>'+f+'</em></div></div>').join('')+
       '<div class="sets">'+setores.map(([k,c])=>{const [ic,co]=SETOR_I[k]||['i-tag','#97a6bb'];return '<div class="st" style="--c:'+co+'"><span>'+I(ic)+'</span><div><small>'+esc(k)+'</small><b>'+fmt(c)+'</b><em>'+(s.cnf?pct(100*c/s.cnf):'—')+'</em></div></div>';}).join('')+'</div></div>'+
      '<div class="nsl'+(crit?' crit':'')+'"><small>'+I('i-gauge')+' NÍVEL DE SERVIÇO (NSL)</small><div class="gw">'+gauge(s.nsl)+'<strong>'+P(s.nsl)+'</strong></div><div class="nf"><span>'+I('i-target')+'Meta <b>0,40%</b></span><span>'+(s.nsl===null?'Sem dados':crit?I('i-arrow-up')+pct(s.nsl-.4)+' acima':I('i-check')+pct(.4-s.nsl)+' abaixo')+'</span></div><div class="ns">'+(s.nsl===null?'Aguardando dados':crit?'Acima da meta — atenção':'Dentro da meta estabelecida')+'</div></div></div>'+
     '<div class="blk"><h2 style="--c:#00a8cf">'+I('i-trend')+'Evolução diária <em><i class="lg b"></i>Erros <i class="lg l" style="background:'+u.cor+'"></i>NSL <i class="lg m"></i>Meta 0,40%</em></h2>'+grafico(rows,u.cor)+'</div>'+
     '<div class="cols"><div class="blk"><h2 style="--c:#2fb35f">'+I('i-layers')+'Ocorrências por departamento e turno</h2>'+tabela(['Turno','Setor','Falta','Sobra','Avaria','Total'],deps.slice(0,11),'t-dep')+(deps.length>11?'<div class="mais">+ '+(deps.length-11)+' combinação(ões) turno/setor com ocorrência no painel</div>':'')+'</div>'+
       '<div class="blk"><h2 style="--c:#1449a6">'+I('i-clock')+'NSL por turno</h2><div class="tcs">'+turnos+'</div><h2 style="--c:#f7941d" class="mt2">'+I('i-award')+'Ranking de lojas</h2>'+tabela(['Loja','Conferidas','Erros','NSL'],lojas)+'</div></div>'+
     '<div class="cols c2"><div class="blk"><h2 style="--c:#e30613">'+I('i-package')+'Top produtos com divergência</h2>'+tabela(['Produto','Conf.','Falta','Sobra','Avaria','Total'],prods)+'</div>'+
       '<div class="blk"><div class="duo"><div><h2 style="--c:#00a8cf">'+I('i-boxes')+'Top suportes</h2>'+tabela(['Suporte','Conf.','Erros'],sups)+'</div><div><h2 style="--c:#7a5af8">'+I('i-route')+'Top circuitos</h2>'+tabela(['Circuito','Conf.','Erros'],cirs)+'</div></div></div></div>'+
     '<div class="cols c3"><div class="blk"><h2 style="--c:#9b2c74">'+I('i-users')+'Preparadores — top 3 por turno</h2>'+tabela(['Turno','Colaborador','Conf.','Erros','NSL'],preps)+'</div>'+
       '<div class="blk"><h2 style="--c:#0067a0">'+I('i-calendar')+'Acompanhamento mensal</h2>'+tabela(['Mês','Conf.','Falta','Sobra','Avaria','NSL'],meses.slice(-12))+'</div></div>'+
     '</div><footer><img src="'+logo('assets/logo-gr-horizontal-branco.png')+'" onerror="this.remove()"><span>NSL = (faltas + sobras + avarias) ÷ caixas conferidas · meta ≤ 0,40%</span><span>'+esc(u.nome)+' · Folha '+(idx+1)+'/'+total+'</span></footer></section>';
  }

  const defs=document.querySelector('.icon-defs')?.outerHTML||'';
  const css=String.raw`@page{size:A4 portrait;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#e9eef5;font:7.2px/1.3 'Inter','Segoe UI',Arial,sans-serif;color:#0e2242}
.icon-defs{position:absolute;width:0;height:0}
.i{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px;flex:none}
.sheet{width:210mm;height:297mm;background:#fff;margin:0 auto 14px;position:relative;overflow:hidden;padding:0 8mm 12mm;page-break-after:always;break-after:page}
.ct{display:flex;flex-direction:column;gap:2.4mm;transform-origin:top left}
.mais{font-size:5.6px;color:#66799a;padding:.8mm 1.2mm}
.sheet:last-child{page-break-after:auto;break-after:auto}
.strip{display:flex;height:2.2mm;margin:0 -8mm}.strip i{display:block}.strip i:nth-child(1){flex:6;background:linear-gradient(90deg,#9bd21c,#3cbf6b,#00b2d8)}.strip i:nth-child(2){flex:2;background:#0a4fa3}.strip i:nth-child(3){flex:1;background:#e30613}.strip i:nth-child(4){flex:1;background:#f7941d}
header{display:grid;grid-template-columns:auto 1fr auto;gap:5mm;align-items:center;padding:1.5mm 0 2.6mm;border-bottom:1px solid #e5ebf2}
.logos{display:flex;align-items:center;gap:3mm}.logos img{height:12mm}.logos img.cf{height:10mm}.sep{width:1px;height:10mm;background:#e5ebf2}
.ttl small{display:flex;align-items:center;gap:1.2mm;font-size:6.2px;font-weight:800;letter-spacing:.9px;color:#2fb35f}
.ttl h1{display:flex;align-items:center;gap:2mm;margin:.8mm 0 .3mm;font:800 19px/1.05 'Plus Jakarta Sans','Inter',Arial,sans-serif;color:#0b2350;letter-spacing:-.4px}
.ub{width:8mm;height:8mm;border-radius:2.4mm;display:grid;place-items:center;background:var(--u);color:#fff}.ub .i{width:13px;height:13px}
.ttl p{margin:0;color:#66799a;font-size:7px}
.meta{display:flex;flex-direction:column;align-items:flex-end;gap:.8mm;font-size:6.4px;color:#2f4566}
.meta span{display:flex;align-items:center;gap:1.2mm;max-width:62mm;text-align:right}
.meta .pg{background:var(--u);color:#fff;border-radius:99px;padding:.6mm 2.4mm;font-weight:800}
.top{display:grid;grid-template-columns:1fr 50mm;gap:2.6mm}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:1.8mm;align-content:start}
.kp{display:flex;gap:1.6mm;align-items:center;border:1px solid #e5ebf2;border-left:1mm solid var(--c);border-radius:2.4mm;padding:2mm 1.8mm;background:linear-gradient(135deg,#fff 60%,color-mix(in srgb,var(--c) 7%,#fff))}
.ki{width:6.6mm;height:6.6mm;border-radius:2mm;display:grid;place-items:center;background:var(--c);color:#fff;flex:none}.ki .i{width:11px;height:11px}
.kp small{display:block;font-size:5.6px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;color:#2f4566}
.kp b{display:block;font:800 13px/1.1 'Plus Jakarta Sans','Inter',Arial;color:#0b2350}
.kp em{display:block;font-style:normal;font-size:5.4px;color:#66799a}
.sets{grid-column:1/-1;display:grid;grid-template-columns:repeat(6,1fr);gap:1.8mm}
.st{display:flex;gap:1.4mm;align-items:center;border-radius:2.4mm;padding:1.6mm;background:color-mix(in srgb,var(--c) 9%,#fff);border:1px solid color-mix(in srgb,var(--c) 22%,#fff)}
.st>span{width:5.4mm;height:5.4mm;border-radius:1.6mm;display:grid;place-items:center;background:var(--c);color:#fff;flex:none}
.st small{display:block;font-size:5.3px;font-weight:800;color:#2f4566;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st b{display:block;font:800 10px/1.1 'Plus Jakarta Sans','Inter',Arial;color:#0b2350}.st em{font-style:normal;font-size:5.2px;color:#66799a}
.nsl{border-radius:3mm;padding:2.4mm;color:#fff;background:radial-gradient(120px 90px at 100% 0,rgba(0,178,216,.35),transparent 70%),radial-gradient(110px 80px at 0 100%,rgba(155,210,28,.25),transparent 70%),linear-gradient(160deg,#123272,#081c40);display:flex;flex-direction:column}
.nsl small{display:flex;align-items:center;gap:1.2mm;font-size:5.8px;font-weight:800;letter-spacing:.8px;color:#9fb8d6}
.gw{position:relative;margin:1mm auto 0;width:40mm}.ga{width:100%;display:block}
.gw strong{position:absolute;left:0;right:0;bottom:.4mm;text-align:center;font:800 17px/1 'Plus Jakarta Sans','Inter',Arial}
.nf{display:flex;justify-content:space-between;font-size:6px;color:#bcd0e8;margin-top:1mm}.nf span{display:flex;align-items:center;gap:1mm}.nf b{color:#fff}
.ns{margin-top:auto;padding:1.2mm 1.8mm;border-radius:1.8mm;background:rgba(155,210,28,.16);border:1px solid rgba(155,210,28,.35);font-size:6.2px;font-weight:700;color:#e2f6c4}
.nsl.crit .ns{background:rgba(227,6,19,.18);border-color:rgba(255,110,90,.4);color:#ffd2c8}
.blk{min-width:0}
h2{display:flex;align-items:center;gap:1.4mm;margin:0 0 1.2mm;padding:1.2mm 2mm;border-radius:1.8mm;font:800 7.6px/1.2 'Plus Jakarta Sans','Inter',Arial;color:#0b2350;background:color-mix(in srgb,var(--c) 10%,#fff);border-left:1mm solid var(--c)}
h2 .i{color:var(--c);width:11px;height:11px}
h2 em{margin-left:auto;display:flex;align-items:center;gap:1.4mm;font-style:normal;font-weight:600;font-size:6px;color:#2f4566}
.lg{display:inline-block;width:3mm;height:1.6mm;border-radius:.6mm}.lg.b{background:linear-gradient(0deg,#3cbf6b,#00b2d8)}.lg.l{height:.6mm}.lg.m{height:0;border-top:1.2px dashed #e30613}
.mt2{margin-top:1.8mm}
.graf{width:100%;height:auto;display:block;border:1px solid #eef2f7;border-radius:2mm}
.graf .ax{font-size:8px;fill:#66799a}.graf .ax2{fill:#1449a6}.graf .mt{font-size:8px;fill:#e30613;font-weight:700}
.cols{display:grid;grid-template-columns:1.15fr 1fr;gap:3mm}
.cols.c2{grid-template-columns:1.1fr 1fr}.cols.c3{grid-template-columns:1.15fr 1fr}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
table{width:100%;border-collapse:separate;border-spacing:0;font-size:6.3px}
th{background:#f3f6fa;color:#66799a;font-size:5.4px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;padding:1mm 1.2mm;text-align:right;border-bottom:1px solid #e5ebf2}
th:first-child{border-radius:1.4mm 0 0 1.4mm;text-align:left}th:last-child{border-radius:0 1.4mm 1.4mm 0}
td{padding:.75mm 1.2mm;border-bottom:1px solid #f0f3f8;text-align:right;white-space:nowrap;color:#2f4566}
td:first-child{text-align:left}td b{color:#0b2350}
.t-dep td:nth-child(2){text-align:left}.t-dep th:nth-child(2){text-align:left}
tr:nth-child(even) td{background:#fafcfe}
.vz{text-align:center!important;color:#97a6bb;padding:2mm!important}.box{border:1px dashed #d7e0ea;border-radius:2mm;padding:6mm}
.nm{display:inline-flex;align-items:center;gap:1.2mm;max-width:52mm;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;color:#0b2350;font-weight:700}
.nm .i{width:9px;height:9px;padding:1px;border-radius:1mm;box-sizing:content-box}
.k-lo{color:#d26f00;background:#ffe9cf}.k-pr{color:#1449a6;background:#e7effc}.k-su{color:#0089aa;background:#d9f3fa}.k-ci{color:#7a5af8;background:#ece6fe}.k-me{color:#0067a0;background:#e1edf7}
.rk{display:inline-grid;place-items:center;width:3.4mm;height:3.4mm;border-radius:50%;font-size:5.4px;font-weight:800;background:#eef2f7;color:#66799a;margin-right:1mm;vertical-align:middle}
.rk.r1{background:linear-gradient(135deg,#ffd75e,#f5a800);color:#5a3d00}.rk.r2{background:linear-gradient(135deg,#e6ebf2,#a9b6c8);color:#2f3d52}.rk.r3{background:linear-gradient(135deg,#f3c39b,#c97a3f);color:#4a2508}
.ch{display:inline-block;min-width:4.6mm;text-align:center;padding:.2mm 1.2mm;border-radius:99px;font-weight:800}
.ch.fa{background:#fde8ea;color:#e30613}.ch.so{background:#e1f6fb;color:#0089aa}.ch.av{background:#fff2e2;color:#c96e05}.ch.er{background:#e9edf5;color:#0b2350}.ch.z{color:#b3bfcd;font-weight:500}
.pl{display:inline-block;padding:.2mm 1.4mm;border-radius:99px;font-weight:800;background:#eef2f7}.pl.ok{background:#e5f6eb;color:#1b8a44}.pl.bad{background:#fde8ea;color:#e30613}
.tn{display:inline-flex;align-items:center;gap:.8mm;padding:.2mm 1.4mm .2mm .8mm;border-radius:99px;background:color-mix(in srgb,var(--t) 13%,#fff);color:var(--t);font-weight:800}
.dp{display:inline-flex;align-items:center;gap:1mm;font-weight:700;color:#0b2350}.dp .i{color:#66799a}
.av{display:inline-grid;place-items:center;width:4mm;height:4mm;border-radius:50%;background:var(--t);color:#fff;font-style:normal;font-size:4.8px;font-weight:800;flex:none}
.tcs{display:flex;flex-direction:column;gap:1.2mm}
.tc{display:flex;align-items:center;gap:1.8mm;border:1px solid #e5ebf2;border-left:1mm solid #97a6bb;border-radius:2mm;padding:1.3mm 1.8mm}
.tc.ok{border-left-color:#2fb35f}.tc.bad{border-left-color:#e30613}
.ti{width:6mm;height:6mm;border-radius:1.8mm;display:grid;place-items:center;background:var(--t);color:#fff;flex:none}
.tx{flex:1;min-width:0}.tx b{display:block;font-size:6.8px;color:#0b2350}.tx small{display:block;font-size:5.6px;color:#66799a}
.tb{display:block;height:1.2mm;border-radius:1mm;background:#eef2f7;margin-top:.8mm;overflow:hidden}.tb em{display:block;height:100%;background:linear-gradient(90deg,#9bd21c,#3cbf6b,#00b2d8)}
.tc.bad .tb em{background:linear-gradient(90deg,#f7941d,#e30613)}
.tc strong{font:800 11px 'Plus Jakarta Sans','Inter',Arial;color:#0b2350}.tc.ok strong{color:#1b8a44}.tc.bad strong{color:#e30613}
footer{position:absolute;left:0;right:0;bottom:0;height:9mm;display:flex;align-items:center;gap:4mm;padding:0 8mm;color:#bcd0e8;font-size:6px;background:linear-gradient(120deg,#081c40,#0b2350 60%,#10306b)}
footer::before{content:'';position:absolute;left:0;right:0;top:0;height:.7mm;background:linear-gradient(90deg,#9bd21c,#3cbf6b,#00b2d8)}
footer img{height:5.6mm}footer span:last-child{margin-left:auto;color:#fff;font-weight:700}
@media screen{body{padding:14px 0}.sheet{box-shadow:0 6px 24px rgba(11,35,80,.18)}}
@media print{body{background:#fff}.sheet{margin:0;box-shadow:none}}`;
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Indicador de Confiabilidade · '+esc(views.map(v=>(UN[v]||UN.geral).nome).join(' · '))+'</title><style>'+css+'</style></head><body>'+defs+views.map((v,i)=>folha(v,i,views.length)).join('')+
   '<script>function caber(){document.querySelectorAll(".sheet").forEach(sh=>{const ct=sh.querySelector(".ct"),ft=sh.querySelector("footer");let z=1;ct.style.transform="";ct.style.width="";for(let k=0;k<8;k++){const r=ct.getBoundingClientRect(),lim=ft.getBoundingClientRect().top-6;if(r.bottom<=lim+.5)break;z=Math.max(.55,z*(lim-r.top)/(r.bottom-r.top)*.997);ct.style.width=(100/z)+"%";ct.style.transform="scale("+z+")";}});}'+
   'async function pronto(){await Promise.race([Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.addEventListener("load",r);i.addEventListener("error",r);}))),new Promise(r=>setTimeout(r,1500))]);caber();requestAnimationFrame(()=>{caber();setTimeout(()=>window.print(),350);});}'+
   'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",pronto);else pronto();<\/script></body></html>';
  const win=window.open('','_blank');if(!win){alert('Permita janelas pop-up para gerar o PDF.');return}
  win.document.open();win.document.write(html);win.document.close();
}

// PUBLICAÇÃO: gera arquivo JSON de RESUMO, não envia planilhas XLSX.
// O MASTER importa este arquivo no portal Apps Script para disponibilizar a última versão.
function criarResumoPublicacao(){
 const viewNames={geral:'CDA Geral',cda:'CDA',cdi:'CDI / CDX',regionais:'Regionais'};
 const result={schema:1,geradoEm:new Date().toISOString(),meta:0.40,visoes:{}};
 for(const v of Object.keys(viewNames)){
  const d=v==='geral'?[...state.cda,...state.cdi]:v==='cdi'?state.cdi:v==='regionais'?state.cda.filter(r=>REG.has(r.loja)):state.cda.filter(r=>!REG.has(r.loja));
  const metr=stats(d);
  const simple=(g)=>({nome:g.name,preparado:g.prp,conferido:g.cnf,avaria:g.avaria,falta:g.falta,sobra:g.sobra,erros:g.erros,nsl:g.nsl});
  const dayMap=new Map();
  for(const r of d){if(!r.ano||!r.mes||!r.dia)continue;const key=`${r.ano}-${String(r.mes).padStart(2,'0')}-${String(r.dia).padStart(2,'0')}`;if(!dayMap.has(key))dayMap.set(key,[]);dayMap.get(key).push(r)}
  const diarios=[...dayMap].sort((a,b)=>a[0].localeCompare(b[0])).map(([dia,rows])=>({dia,...stats(rows)}));
  const monthMap=new Map();for(const r of d){if(!r.ano||!r.mes)continue;const key=`${r.ano}-${String(r.mes).padStart(2,'0')}`;if(!monthMap.has(key))monthMap.set(key,[]);monthMap.get(key).push(r)}
  const mensal=[...monthMap].sort((a,b)=>a[0].localeCompare(b[0])).map(([mes,rows])=>({mes,...stats(rows)}));
  const departamento=[];for(const turno of ['T1','T2','T3'])for(const dep of SETORES)departamento.push({turno,departamento:dep,...stats(d.filter(r=>r.turno===turno&&r.depto===dep))});
  const turnos=['T1','T2','T3'].map(t=>({turno:t,...stats(d.filter(r=>r.turno===t))}));
  const produtos=groups(d,'codpro').slice(0,10).map(g=>({...simple(g),nome:g.rows[0]?.descricao||g.name,codigo:g.name}));
  const preparadores={};for(const t of ['T1','T2','T3'])preparadores[t]=groups(d.filter(r=>r.turno===t),'codprp').slice(0,10).map(simple);
  // Cubo analítico compacto: dia + turno + departamento + loja. Sem nomes de colaboradores,
  // produtos nem linhas originais. Permite combinar filtros no portal com cálculos exatos.
  const cube=new Map();
  for(const r of d){
    if(!r.ano||!r.mes||!r.dia)continue;
    const dia=`${r.ano}-${String(r.mes).padStart(2,'0')}-${String(r.dia).padStart(2,'0')}`;
    const key=JSON.stringify([dia,r.turno,r.depto,r.loja]);
    if(!cube.has(key))cube.set(key,[dia,r.turno,r.depto,r.loja,0,0,0,0,0]);
    const row=cube.get(key);
    row[4]+=r.prp;row[5]+=r.cnf;row[6]+=r.avaria;row[7]+=r.falta;row[8]+=r.sobra;
  }
  const datas=[...new Set([...cube.values()].map(r=>r[0]))].sort();
  const turnosCod=[...new Set([...cube.values()].map(r=>r[1]))].sort();
  const deptosCod=[...new Set([...cube.values()].map(r=>r[2]))].sort();
  const lojasCod=[...new Set([...cube.values()].map(r=>r[3]))].sort();
  const index=(a)=>new Map(a.map((x,i)=>[x,i]));
  const im=[index(datas),index(turnosCod),index(deptosCod),index(lojasCod)];
  const fatias=[...cube.values()].map(r=>[...r.slice(0,4).map((x,i)=>im[i].get(x)),...r.slice(4)]);
  result.visoes[v]={nome:viewNames[v],cubo:{datas,turnos:turnosCod,deptos:deptosCod,lojas:lojasCod,linhas:fatias},resumo:metr,departamentos:departamento,turnos,produtos,suportes:groups(d,'suporte').slice(0,10).map(simple),circuitos:groups(d,'cir').slice(0,15).map(simple),preparadores,lojas:groups(d,'loja').slice(0,10).map(simple),diarios,mensal};
 }
 return result;
}
function exportarPublicacao(){
 if(!state.cda.length&&!state.cdi.length){alert('Primeiro atualize as bases locais.');return}
 const payload=criarResumoPublicacao();
 let text=JSON.stringify(payload);
 if(text.length>225000){
  // Publicação anterior mantém funcionamento, sem filtros combinados remotos.
  alert('A publicação com filtros combinados excedeu 225 mil caracteres ('+text.length.toLocaleString('pt-BR')+'). Nenhum arquivo foi alterado. É necessário ampliar o armazenamento online antes de publicar este volume.');
  return;
 }
 const blob=new Blob([text],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='CONFIABILIDADE_PUBLICACAO_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
 alert('Resumo gerado. Agora entre no Portal Apps Script como MASTER e importe este arquivo JSON em Publicar atualização. Os XLSX originais não foram enviados.');
}
if($('exportarPublicacao'))$('exportarPublicacao').addEventListener('click',()=>{if(window.LeitorNavegador&&LeitorNavegador.ativo())document.dispatchEvent(new CustomEvent('painel:gerar-equipe'));else exportarPublicacao();});
