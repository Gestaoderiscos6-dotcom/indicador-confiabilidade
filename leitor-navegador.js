'use strict';
/* =====================================================================
   Confiabilidade V14 · Leitor de pastas no próprio navegador
   ---------------------------------------------------------------------
   Permite abrir o index.html direto no Chrome/Edge (duplo clique), sem
   BAT e sem servidor. Na primeira vez você escolhe a pasta principal
   (a que contém CDA, CDI e SISTEMA). Depois, o botão Atualizar lê as
   pastas e processa apenas os XLSX novos ou alterados.
   Os dados lidos ficam guardados no próprio navegador (IndexedDB),
   neste computador. Nada é enviado para a internet.
   Regras de leitura idênticas ao leitor_local.py.
   ===================================================================== */
(function(){
 const FIELDS=['dat_cnf','turno','codprp','codcnf','cir','suporte','loja','depto','setor','codpro','descricao','prp','cnf','sobra','falta','avaria'];
 const NUMERIC=new Set(['prp','cnf','sobra','falta','avaria']);
 const MAX_FILES=100;
 const IGNORAR=new Set(['SISTEMA','CDI','COMPARATIVO','ASSETS','CACHE','BACKUP']);
 const IGNORAR_PREFIXO=['SISTEMA_','BACKUP','BKP_','OLD_','ANTIGO'];
 const DB_NOME='confiabilidade-gr',DB_VERSAO=1;
 const suportado=typeof window.showDirectoryPicker==='function'&&typeof indexedDB!=='undefined';
 // Modo navegador: quando o HTML é aberto direto do disco (file://).
 const equipe=()=>!!window.MODO_EQUIPE;
 const ativo=()=>location.protocol==='file:'&&!equipe();

 /* ---------------- IndexedDB ---------------- */
 let dbPromise=null;
 function db(){
  if(!dbPromise)dbPromise=new Promise((res,rej)=>{
   const r=indexedDB.open(DB_NOME,DB_VERSAO);
   r.onupgradeneeded=()=>{const d=r.result;for(const s of ['pastas','arquivos','meta'])if(!d.objectStoreNames.contains(s))d.createObjectStore(s);};
   r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
  return dbPromise;
 }
 async function idb(store,modo,fn){
  const d=await db();
  return new Promise((res,rej)=>{
   const tx=d.transaction(store,modo);const st=tx.objectStore(store);let out;
   const req=fn(st);if(req)req.onsuccess=()=>{out=req.result;};
   tx.oncomplete=()=>res(out);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);
  });
 }
 const get=(s,k)=>idb(s,'readonly',st=>st.get(k));
 const put=(s,k,v)=>idb(s,'readwrite',st=>st.put(v,k));
 const del=(s,k)=>idb(s,'readwrite',st=>st.delete(k));
 const keys=(s)=>idb(s,'readonly',st=>st.getAllKeys());

 /* ---------------- Pastas ---------------- */
 async function pastas(){
  const rv=h=>h&&window.__reviveHandle?window.__reviveHandle(h):h; // gancho usado apenas em testes automatizados
  const [raiz,cda,cdi,sistema]=(await Promise.all(['raiz','cda','cdi','sistema'].map(k=>get('pastas',k).catch(()=>null)))).map(rv);
  return {raiz,cda,cdi,sistema};
 }
 async function filho(dir,nome){
  if(!dir)return null;
  for await(const e of dir.values()){if(e.kind==='directory'&&e.name.toUpperCase()===nome)return e;}
  return null;
 }
 async function permissao(handle,pedir){
  if(!handle)return false;
  const o={mode:'read'};
  try{
   if(await handle.queryPermission(o)==='granted')return true;
   if(pedir&&await handle.requestPermission(o)==='granted')return true;
  }catch(e){console.warn('Permissão de pasta:',e);}
  return false;
 }
 async function escolherPasta(inicio){
  if(!suportado)throw new Error('Este navegador não permite ler pastas. Use o Google Chrome ou o Microsoft Edge atualizados.');
  let dir;
  const op={id:'confiabilidade-gr',mode:'read'};
  if(inicio)op.startIn=inicio;
  try{dir=await window.showDirectoryPicker(op);}
  catch(e){
   if(e&&e.name==='AbortError')return null;
   if(inicio&&e&&e.name==='TypeError'){try{dir=await window.showDirectoryPicker({id:'confiabilidade-gr',mode:'read'});}catch(e2){if(e2&&e2.name==='AbortError')return null;throw e2;}}
   else throw e;
  }
  const nome=dir.name.toUpperCase();
  const cda=await filho(dir,'CDA'),cdi=await filho(dir,'CDI'),sis=await filho(dir,'SISTEMA');
  const atual=await pastas();
  if(cda||cdi){
   await put('pastas','raiz',dir);
   if(cda)await put('pastas','cda',cda);
   if(cdi)await put('pastas','cdi',cdi);
   if(sis)await put('pastas','sistema',sis);
   return {tipo:'raiz',nome:dir.name,cda:!!cda,cdi:!!cdi,sistema:!!sis};
  }
  if(nome==='CDA'){await put('pastas','cda',dir);return {tipo:'cda',nome:dir.name};}
  if(nome==='CDI'||nome.startsWith('CDI')){await put('pastas','cdi',dir);return {tipo:'cdi',nome:dir.name};}
  if(nome==='SISTEMA'){await put('pastas','sistema',dir);return {tipo:'sistema',nome:dir.name};}
  throw new Error('A pasta "'+dir.name+'" não tem as subpastas CDA e CDI. Escolha a pasta principal (ex.: 2026), que contém CDA, CDI e SISTEMA.'+(atual.raiz?'':''));
 }

 /* Garante acesso às pastas SEM depender do aviso "Permitir" do navegador
    (em páginas abertas de pasta de rede esse aviso pode não aparecer e travar).
    Se o acesso não estiver liberado, abre a janela de seleção já na pasta 2026:
    basta clicar em "Selecionar pasta". Precisa ser chamado a partir de um clique. */
 async function garantirAcesso(aviso){
  let pt=await pastas();
  const liberado=async h=>{try{return !h||await h.queryPermission({mode:'read'})==='granted';}catch(e){return false;}};
  if(pt.raiz){if(await liberado(pt.raiz))return pt;}
  else if((pt.cda||pt.cdi)&&await liberado(pt.cda)&&await liberado(pt.cdi)&&await liberado(pt.sistema))return pt;
  aviso&&aviso('Confirme a pasta 2026 na janela que abriu (clique em “Selecionar pasta”)');
  const r=await escolherPasta(pt.raiz||pt.cda||pt.cdi||undefined);
  if(!r){const e=new Error('Seleção da pasta cancelada.');e.cancelado=true;throw e;}
  pt=await pastas();
  if(!pt.cda&&!pt.cdi)throw new Error('A pasta escolhida não tem CDA e CDI. Selecione a pasta 2026.');
  return pt;
 }

 /* Lista XLSX da unidade (inclui subpastas, mesmas exclusões do leitor_local.py). */
 async function listar(dir,unidade){
  const out=[],avisos=[];
  async function walk(d,rel){
   for await(const e of d.values()){
    const up=e.name.toUpperCase();
    if(e.kind==='directory'){
     if(IGNORAR.has(up)||IGNORAR_PREFIXO.some(p=>up.startsWith(p)))continue;
     await walk(e,rel+e.name+'/');
    }else{
     const low=e.name.toLowerCase();
     if(e.name.startsWith('~$')||!low.endsWith('.xlsx'))continue;
     if(low.startsWith('formatos_loja')||low.startsWith('comparativo'))continue;
     out.push({handle:e,rel:rel+e.name,nome:e.name});
    }
   }
  }
  let falhou=false;
  try{await walk(dir,'');}catch(e){falhou=true;avisos.push(unidade+': não foi possível listar a pasta ('+(e.name||'Erro')+': '+e.message+'). Mantidos os dados da leitura anterior.');}
  out.sort((a,b)=>a.rel.localeCompare(b.rel,'pt-BR',{sensitivity:'base',numeric:true}));
  if(!out.length&&!falhou)avisos.push(unidade+': nenhum XLSX encontrado na pasta '+dir.name+'.');
  if(out.length>MAX_FILES)throw new Error('Quantidade de arquivos maior que '+MAX_FILES+' em '+unidade+'.');
  return {arquivos:out,avisos,falhou};
 }

 /* ---------------- Leitura de planilhas (SheetJS) ---------------- */
 function precisaXLSX(){
  if(typeof XLSX==='undefined')throw new Error('O leitor de planilhas não carregou. Verifique a conexão com a internet e recarregue a página (Ctrl+F5).');
 }
 function numero(v){
  if(typeof v==='number')return Number.isFinite(v)?v:0;
  let s=String(v??'').trim().replace(/\s/g,'');
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  const n=parseFloat(s);return Number.isFinite(n)?n:0;
 }
 function lerDados(buf){
  const wb=XLSX.read(buf,{type:'array',cellDates:false,cellFormula:false,cellHTML:false,cellText:false,cellStyles:false});
  const rows=[];
  for(const nome of wb.SheetNames){
   const linhas=XLSX.utils.sheet_to_json(wb.Sheets[nome],{header:1,raw:true,defval:null,blankrows:false});
   let h=-1,map=null;
   for(let i=0;i<linhas.length;i++){
    const vals=(linhas[i]||[]).map(x=>x===null||x===undefined?'':String(x).trim().toLowerCase());
    if(vals.includes('dat_cnf')&&vals.includes('cnf')&&vals.includes('loja')){h=i;map=FIELDS.map(k=>vals.indexOf(k));break;}
   }
   if(h<0)continue;
   for(let i=h+1;i<linhas.length;i++){
    const r=linhas[i]||[];const o=new Array(FIELDS.length);
    for(let j=0;j<FIELDS.length;j++){
     const k=FIELDS[j],idx=map[j];let v=idx<0?null:r[idx];
     if(NUMERIC.has(k))v=v===null||v===undefined||v===''?0:numero(v);
     else if(v===null||v===undefined)v='';
     else if(k==='dat_cnf'&&typeof v==='number'){/* número de série do Excel: o painel converte */}
     else v=String(v).trim();
     o[j]=v;
    }
    if(o[0]===''||o[0]===0)continue;
    rows.push(o);
   }
  }
  return rows;
 }
 const semAcento=x=>String(x??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').trim().toUpperCase();
 const chaveAlfa=x=>semAcento(x).replace(/[^A-Z0-9]/g,'');
 async function linhasDoArquivo(fh){
  const f=await fh.getFile();const ext=f.name.toLowerCase().split('.').pop();
  const wb=ext==='csv'?XLSX.read(await f.text(),{type:'string',raw:true}):XLSX.read(await f.arrayBuffer(),{type:'array'});
  return wb.SheetNames.map(n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null,blankrows:false}));
 }
 async function arquivosSistema(sis){
  const lista=[];if(!sis)return lista;
  for await(const e of sis.values())if(e.kind==='file')lista.push(e);
  return lista;
 }
 async function lerFormatos(sis){
  const avisos=[];
  if(!sis)return {formatos:{},avisos:['Pasta SISTEMA não localizada: formatos de loja não carregados.']};
  const cand=(await arquivosSistema(sis)).filter(f=>/\.(xlsx|xlsm|csv)$/i.test(f.name)&&chaveAlfa(f.name.replace(/\.[^.]+$/,''))==='FORMATOSLOJA')
   .sort((a,b)=>(a.name.toLowerCase().endsWith('.xlsx')?0:1)-(b.name.toLowerCase().endsWith('.xlsx')?0:1)||a.name.localeCompare(b.name));
  if(!cand.length)return {formatos:{},avisos:['Arquivo formatos_loja.xlsx não encontrado na pasta SISTEMA.']};
  const arq=cand[0];if(cand.length>1)avisos.push('Múltiplos arquivos formatos_loja. Usando '+arq.name);
  const sigAlias=new Set(['SGLLOJA','SIGLALOJA','SIGLADALOJA','SIGLA']);
  const fmtAlias=new Set(['DESC','DESCRICAO','DESCRICAOFORMATO','FORMATO','FORMATODELOJA','DESCLOJA']);
  const rows=(await linhasDoArquivo(arq))[0]||[];
  let si=null,fi=null,hp=null;
  for(let p=0;p<Math.min(15,rows.length);p++){
   const ks=(rows[p]||[]).map(chaveAlfa);
   const s=ks.findIndex(v=>sigAlias.has(v)),f=ks.findIndex(v=>fmtAlias.has(v));
   if(s>=0&&f>=0){si=s;fi=f;hp=p;break;}
  }
  let inicio=0;
  if(hp===null){si=1;fi=3;avisos.push('Cabeçalho não reconhecido; usando posição B/D (formato antigo).');}else inicio=hp+1;
  const out={};let dup=0;
  for(let i=inicio;i<rows.length;i++){
   const r=rows[i]||[];if(r.length<=Math.max(si,fi))continue;
   const loja=semAcento(r[si]),fmtv=semAcento(r[fi]);
   if(!loja||!fmtv||sigAlias.has(chaveAlfa(loja)))continue;
   if(out[loja]&&out[loja]!==fmtv)dup++;out[loja]=fmtv;
  }
  avisos.push(arq.name+': '+Object.keys(out).length+' lojas; sigla coluna '+(si+1)+', formato coluna '+(fi+1)+'.');
  if(dup)avisos.push(dup+' lojas duplicadas com formatos distintos; prevaleceu o último registro.');
  return {formatos:out,avisos};
 }
 function chaveUca(v){
  if(v===null||v===undefined)return '';
  let s=String(v).normalize('NFKC').replace(/﻿|​/g,'').replace(/ /g,' ');
  s=s.split(/\s+/).join('').toUpperCase().trim();
  if(/^\d+\.0$/.test(s))s=s.slice(0,-2);
  return s;
 }
 async function lerColaboradores(sis){
  const avisos=[],cad={};
  if(!sis)return {colaboradores:{},avisos:['Pasta SISTEMA não localizada: nomes UCA não carregados.']};
  const cand=(await arquivosSistema(sis)).filter(f=>/\.(xlsx|xlsm|csv)$/i.test(f.name)&&f.name.replace(/\.[^.]+$/,'').trim().toLowerCase().replace(/[\s\-]+/g,'_')==='uca_colaboradores')
   .sort((a,b)=>(a.name.toLowerCase().endsWith('.csv')?1:0)-(b.name.toLowerCase().endsWith('.csv')?1:0)||a.name.localeCompare(b.name));
  if(!cand.length)return {colaboradores:{},avisos:['Arquivo uca_colaboradores.xlsx não encontrado na pasta SISTEMA.']};
  const arq=cand[0];
  for(const sheet of await linhasDoArquivo(arq)){
   for(const l of sheet){
    if(!l||l.length<3)continue;
    const nome=String(l[1]??'').trim(),uca=chaveUca(l[2]);
    if(['UCA','COD_UCA','CODIGOUCA'].includes(uca)||!uca||!nome||['NOME','NOME COMPLETO','COLABORADOR'].includes(nome.toUpperCase()))continue;
    if(cad[uca]&&cad[uca]!==nome)avisos.push('Codigo UCA duplicado com nomes diferentes: '+uca);
    cad[uca]=nome;
   }
  }
  avisos.push(arq.name+': '+Object.keys(cad).length+' UCA(s) identificados; coluna B = nome e coluna C = UCA.');
  return {colaboradores:cad,avisos};
 }

 /* Comparativo anual (SISTEMA/comparativo_anual.xlsx): abas CDA/CDI, coluna PERIODO + colunas de anos (NSL). */
 function interpretarComparativo(sheets,nomes){
  const unidades={};
  sheets.forEach((rows,si)=>{
   let h=-1,anos=null;
   for(let i=0;i<Math.min(rows.length,15);i++){
    const r=rows[i]||[];const k=chaveAlfa(r[0]);
    if(['PERIODO','MES','MESES','MESREFERENCIA'].includes(k)){
     anos=r.slice(1).map((v,j)=>({col:j+1,ano:parseInt(String(v??'').replace(/\D/g,''),10)})).filter(x=>x.ano>=2000&&x.ano<=2100);
     if(anos.length){h=i;break;}
    }
   }
   if(h<0)return;
   const meses=[];let maxv=0;
   for(let i=h+1;i<rows.length;i++){
    const r=rows[i]||[];const mes=String(r[0]??'').trim().toUpperCase();if(!mes)continue;
    const valores={};
    for(const a of anos){const v=r[a.col];if(v===null||v===undefined||v==='')continue;const n=typeof v==='number'?v:numero(String(v).replace('%',''));if(Number.isFinite(n)){valores[a.ano]=n;maxv=Math.max(maxv,Math.abs(n));}}
    meses.push({mes,valores});
   }
   // NSL em fração (0,0041) vira percentual (0,41).
   const fator=maxv>0&&maxv<=0.05?100:1;
   meses.forEach(m=>{for(const k in m.valores)m.valores[k]=m.valores[k]*fator;});
   const nome=semAcento(nomes[si]);const unidade=nome.startsWith('CDI')?'CDI':nome.startsWith('CDA')?'CDA':nome;
   unidades[unidade]={anos:anos.map(a=>a.ano),meses};
  });
  return unidades;
 }
 const NOMES_COMP=['comparativo_anual.xlsx','COMPARATIVO_ANUAL.xlsx','Comparativo_anual.xlsx','comparativo anual.xlsx','comparativo_anual.xlsm'];
 const comPrazo=(prom,ms,etapa)=>Promise.race([prom,new Promise((_,rej)=>setTimeout(()=>{const e=new Error('sem resposta em '+(ms/1000)+' s na etapa “'+etapa+'”');e.etapa=etapa;rej(e);},ms))]);
 async function acharArquivoComparativo(sis,etapa){
  // 1) tenta pelo nome (rápido, não lista a pasta: melhor para pasta de rede)
  for(const n of NOMES_COMP){
   try{etapa&&etapa('Procurando '+n+' na pasta SISTEMA');return await comPrazo(sis.getFileHandle(n),8000,'procurar '+n);}
   catch(e){if(e&&e.etapa)throw e;/* NotFound: tenta o próximo nome */}
  }
  // 2) lista a pasta (só arquivos do primeiro nível)
  etapa&&etapa('Listando a pasta SISTEMA');
  const lista=await comPrazo(arquivosSistema(sis),15000,'listar a pasta SISTEMA');
  const cand=lista.filter(f=>!f.name.startsWith('~$')&&/\.(xlsx|xlsm)$/i.test(f.name)&&chaveAlfa(f.name).startsWith('COMPARATIVO')).sort((a,b)=>a.name.localeCompare(b.name));
  return cand[0]||null;
 }
 async function lerComparativo(sis,etapa){
  if(!sis)return null;
  const arq=await acharArquivoComparativo(sis,etapa);
  if(!arq)return null;
  etapa&&etapa('Abrindo '+arq.name);
  const f=await comPrazo(arq.getFile(),10000,'abrir '+arq.name);
  etapa&&etapa('Lendo o conteúdo de '+arq.name+' ('+Math.round(f.size/1024)+' KB)');
  const buf=await comPrazo(f.arrayBuffer(),15000,'ler o conteúdo de '+arq.name);
  etapa&&etapa('Interpretando as abas do comparativo');
  const wb=XLSX.read(buf,{type:'array'});
  const sheets=wb.SheetNames.map(n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null,blankrows:false}));
  return {arquivo:arq.name,modificado:new Date(f.lastModified).toISOString(),unidades:interpretarComparativo(sheets,wb.SheetNames)};
 }

 /* ---------------- Montagem do snapshot ---------------- */
 const paraObjeto=a=>{const o={};for(let j=0;j<FIELDS.length;j++)o[FIELDS[j]]=a[j];return o;};
 async function montarDoCache(meta){
  const payload={cda:[],cdi:[],arquivos:[],avisos:meta.avisos||[],formatos:meta.formatos||{},formatos_avisos:meta.formatos_avisos||[],
   colaboradores:meta.colaboradores||{},colaboradores_avisos:meta.colaboradores_avisos||[],cache_info:meta.cache_info||null,snapshot_gerado_em:meta.gerado,comparativo:meta.comparativo||null};
  for(const a of meta.arquivos||[]){
   const rec=await get('arquivos',a.chave);if(!rec)continue;
   const alvo=a.unidade==='CDA'?payload.cda:payload.cdi;
   for(const r of rec.linhas)alvo.push(paraObjeto(r));
   payload.arquivos.push({unidade:a.unidade,arquivo:a.nome,registros:rec.linhas.length,origem:'cache'});
  }
  return payload;
 }

 /* Carrega o painel: sem forçar = usa o que já foi lido (abre instantâneo).
    Forçando = lê as pastas (pede autorização se o navegador exigir). */
 async function obter(forcar,progresso){
  const p=progresso||(()=>{});
  const meta=await get('meta','snapshot').catch(()=>null);
  if(!forcar){
   if(meta){p('Abrindo a última leitura salva neste navegador...');return montarDoCache(meta);}
   p('Primeiro acesso: abra a aba Atualização e clique em “Escolher pasta” (selecione a pasta que contém CDA, CDI e SISTEMA).');
   return null;
  }
  precisaXLSX();
  try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();}catch(e){}
  let pt=await pastas();
  if(!pt.cda&&!pt.cdi){
   p('Selecione a pasta principal (a que contém CDA, CDI e SISTEMA)...');
   const r=await escolherPasta();if(!r)throw new Error('Nenhuma pasta selecionada.');
   pt=await pastas();
  }else{
   pt=await garantirAcesso(t=>p(t+'...'));
  }
  if(!pt.sistema&&pt.raiz)pt.sistema=await filho(pt.raiz,'SISTEMA');
  const avisos=[],lista=[];
  // Unidades cuja listagem não é confiável nesta rodada: os dados anteriores delas são preservados.
  const preservar=new Set();
  const anteriores=meta?.arquivos||[];
  for(const [u,h] of [['CDA',pt.cda],['CDI',pt.cdi]]){
   if(!h){avisos.push('Pasta '+u+' não selecionada.');preservar.add(u);continue;}
   let r;
   try{r=await comPrazo(listar(h,u),60000,'listar a pasta '+u);}
   catch(e){r={arquivos:[],avisos:[u+': '+e.message+'. Mantidos os dados da leitura anterior.'],falhou:true};}
   avisos.push(...r.avisos);
   // listagem com erro, ou pasta "vazia" quando antes havia arquivos: não apaga nada
   if(r.falhou||(!r.arquivos.length&&anteriores.some(x=>x.unidade===u))){preservar.add(u);if(!r.falhou)avisos.push(u+': a pasta apareceu vazia nesta leitura; mantidos os dados anteriores.');continue;}
   for(const a of r.arquivos)lista.push({...a,unidade:u});
  }
  let falhasArquivo=0;
  let lidos=0,reuso=0;const arquivosMeta=[];
  const total=lista.length;
  for(let i=0;i<lista.length;i++){
   const a=lista[i];const chave=a.unidade+'|'+a.rel;
   try{
    const f=await a.handle.getFile();const sig=[f.size,f.lastModified];
    let rec=await get('arquivos',chave);
    if(!rec||rec.sig[0]!==sig[0]||rec.sig[1]!==sig[1]){
     p('Lendo '+a.unidade+' · '+a.nome+' ('+(i+1)+' de '+total+')...');
     await new Promise(r=>setTimeout(r,15));
     const linhas=lerDados(await f.arrayBuffer());
     rec={sig,linhas};await put('arquivos',chave,rec);lidos++;
     if(!linhas.length)avisos.push(a.unidade+'/'+a.nome+': nenhum registro reconhecido; confira cabeçalhos e data.');
    }else reuso++;
    arquivosMeta.push({chave,unidade:a.unidade,nome:a.nome,rel:a.rel,sig,registros:rec.linhas.length});
    // Salva o progresso a cada arquivo novo: se a página fechar no meio, nada do que já foi lido se perde.
    if(lidos&&(lidos%2===0)){const parcial={...(meta||{}),gerado:new Date().toISOString(),arquivos:[...arquivosMeta,...(meta?.arquivos||[]).filter(x=>!arquivosMeta.some(y=>y.chave===x.chave)&&lista.some(l=>l.unidade+'|'+l.rel===x.chave))]};await put('meta','snapshot',parcial).catch(()=>{});}
   }catch(e){
    // Arquivo não abriu (em uso, rede instável...): mantém a leitura anterior dele, se existir.
    falhasArquivo++;
    const ant=anteriores.find(x=>x.chave===chave);
    const recAnt=ant?await get('arquivos',chave).catch(()=>null):null;
    if(ant&&recAnt){arquivosMeta.push(ant);avisos.push(a.unidade+'/'+a.nome+': não abriu agora ('+(e.name||'Erro')+'); mantida a leitura anterior. Feche o arquivo se estiver aberto e atualize de novo.');}
    else avisos.push(a.unidade+'/'+a.nome+': não foi possível ler ('+(e.name||'Erro')+': '+e.message+'). Feche o arquivo se estiver aberto e atualize de novo.');
   }
  }
  // Unidades preservadas: mantém exatamente o que havia antes.
  for(const x of anteriores)if(preservar.has(x.unidade)&&!arquivosMeta.some(y=>y.chave===x.chave))arquivosMeta.push(x);
  // Proteção: se nada pôde ser lido e antes havia dados, não substitui a leitura salva.
  const totalNovo=arquivosMeta.reduce((t,a)=>t+(a.registros||0),0);
  const totalAnt=anteriores.reduce((t,a)=>t+(a.registros||0),0);
  if(totalAnt>0&&totalNovo===0){
   const e=new Error('A atualização não conseguiu ler as planilhas e por isso a leitura anterior foi mantida. '+(avisos.slice(0,2).join(' | ')||''));e.preservado=true;throw e;
  }
  // Remove do armazenamento só arquivos que realmente saíram das pastas listadas com sucesso.
  const validas=new Set(arquivosMeta.map(a=>a.chave));
  for(const k of await keys('arquivos')){const u=String(k).split('|')[0];if(!validas.has(k)&&!preservar.has(u))await del('arquivos',k);}
  p('Lendo cadastros da pasta SISTEMA...');
  let fm={formatos:{},avisos:[]},uc={colaboradores:{},avisos:[]};
  try{fm=await lerFormatos(pt.sistema);}catch(e){fm.avisos.push('formatos_loja: '+e.message);}
  try{uc=await lerColaboradores(pt.sistema);}catch(e){uc.avisos.push('uca_colaboradores: '+e.message);}
  let comp=null;
  try{p('Lendo comparativo anual...');comp=await lerComparativo(pt.sistema,t=>p(t+'...'));}catch(e){avisos.push('comparativo_anual: '+e.message);}
  if(comp)await put('meta','comparativo',comp).catch(()=>{});
  const novaMeta={gerado:new Date().toISOString(),arquivos:arquivosMeta,avisos,formatos:fm.formatos,formatos_avisos:fm.avisos,
   colaboradores:uc.colaboradores,colaboradores_avisos:uc.avisos,comparativo:comp||meta?.comparativo||null,cache_info:{reutilizados:reuso,reprocessados:lidos},
   pastas:{raiz:pt.raiz?.name||null,cda:pt.cda?.name||null,cdi:pt.cdi?.name||null,sistema:pt.sistema?.name||null}};
  if(!arquivosMeta.some(a=>a.unidade==='CDA'&&a.registros))avisos.push('ATENCAO: CDA sem registros. Nao use o CDA Geral como consolidado.');
  await put('meta','snapshot',novaMeta);
  p('Montando o painel...');
  return montarDoCache(novaMeta);
 }

 /* Situação das pastas sem ler planilhas (para avisos de arquivos novos). */
 async function verificar(pedir=false){
  const pt=await pastas();
  const meta=await get('meta','snapshot').catch(()=>null);
  const base={snapshot_gerado_em:meta?.gerado||null,modo:'navegador',pastas:{raiz:pt.raiz?.name||null,cda:pt.cda?.name||null,cdi:pt.cdi?.name||null,sistema:pt.sistema?.name||null},
   resumo:{novos:0,alterados:0,em_dia:0,removidos:0},unidades:{},avisos:[]};
  if(!pt.cda&&!pt.cdi)return {...base,sem_pasta:true};
  if(pedir){try{await garantirAcesso();}catch(e){return {...base,sem_permissao:true};}}
  else for(const h of [pt.cda,pt.cdi])if(h&&!(await permissao(h,false)))return {...base,sem_permissao:true};
  const conhecidos=new Map((meta?.arquivos||[]).map(a=>[a.chave,a]));const vistos=new Set();
  for(const [u,h] of [['CDA',pt.cda],['CDI',pt.cdi]]){
   if(!h){base.unidades[u]={pasta:'(não selecionada)',arquivos:[],removidos:[]};continue;}
   const r=await listar(h,u);base.avisos.push(...r.avisos);
   const arquivos=[];
   for(const a of r.arquivos){
    const f=await a.handle.getFile();const chave=u+'|'+a.rel;vistos.add(chave);
    const ref=conhecidos.get(chave);
    const status=!meta?'pendente':!ref?'novo':(ref.sig[0]!==f.size||ref.sig[1]!==f.lastModified)?'alterado':'em_dia';
    base.resumo[status==='pendente'||status==='novo'?'novos':status==='alterado'?'alterados':'em_dia']++;
    arquivos.push({nome:a.rel,tamanho:f.size,modificado:new Date(f.lastModified).toISOString(),status});
   }
   const removidos=[...conhecidos.values()].filter(a=>a.unidade===u&&!vistos.has(a.chave)).map(a=>({nome:a.rel||a.nome}));
   base.resumo.removidos+=removidos.length;
   base.unidades[u]={pasta:(pt.raiz?pt.raiz.name+' › ':'')+h.name,arquivos,removidos};
  }
  return base;
 }

 async function limpar(){
  for(const s of ['pastas','arquivos','meta'])for(const k of await keys(s))await del(s,k);
 }

 /* =================== VERSÃO EQUIPE (GitHub) ===================
    Gera a pasta PUBLICACAO_GITHUB (ao lado de SISTEMA) com o painel em modo
    somente leitura: sem botões de atualização e com os dados embutidos
    (compactados) no arquivo dados-equipe.js. */
 async function gz(texto){
  const cs=new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(cs).arrayBuffer());
 }
 async function gunzip(bytes){
  const ds=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(ds).text();
 }
 function b64(bytes){let s='';const C=0x8000;for(let i=0;i<bytes.length;i+=C)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+C));return btoa(s);}
 function deB64(t){const bin=atob(t);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;}
 function colunar(rows){
  const cols={};
  for(const k of FIELDS){
   if(NUMERIC.has(k)){cols[k]={n:rows.map(r=>r[k]||0)};continue;}
   const dict=[],pos=new Map(),idx=new Array(rows.length);
   for(let i=0;i<rows.length;i++){const v=rows[i][k];let p=pos.get(v);if(p===undefined){p=dict.length;dict.push(v);pos.set(v,p);}idx[i]=p;}
   cols[k]={d:dict,i:idx};
  }
  return {total:rows.length,cols};
 }
 function deColunar(c){
  const out=new Array(c.total);
  for(let i=0;i<c.total;i++){const o={};for(const k of FIELDS){const col=c.cols[k];o[k]=col.n?col.n[i]:col.d[col.i[i]];}out[i]=o;}
  return out;
 }
 async function carregarEquipe(progresso){
  const p=progresso||(()=>{});const D=window.DADOS_EQUIPE;
  if(!D)throw new Error('Arquivo dados-equipe.js não encontrado ao lado do index.html.');
  p('Abrindo dados publicados...');
  const obj=JSON.parse(await gunzip(deB64(D.b64)));
  return {cda:deColunar(obj.cda),cdi:deColunar(obj.cdi),arquivos:obj.arquivos||[],avisos:[],formatos:obj.formatos||{},formatos_avisos:obj.formatos_avisos||[],
   colaboradores:obj.colaboradores||{},colaboradores_avisos:obj.colaboradores_avisos||[],comparativo:obj.comparativo||null,snapshot_gerado_em:D.gerado,cache_info:null};
 }
 async function lerTexto(dir,nome){for await(const e of dir.values())if(e.kind==='file'&&e.name===nome)return await (await e.getFile()).text();return null;}
 async function escrever(dir,nome,conteudo){const fh=await dir.getFileHandle(nome,{create:true});const w=await fh.createWritable();await w.write(conteudo);await w.close();}
 async function gerarVersaoEquipe(progresso){
  const p=progresso||(()=>{});
  if(typeof CompressionStream==='undefined')throw new Error('Navegador sem suporte à compactação. Use o Chrome ou o Edge atualizados.');
  const pt=await pastas();
  const meta=await get('meta','snapshot');
  if(!meta)throw new Error('Atualize os dados antes de gerar a versão da equipe.');
  let destinoBase=pt.raiz;
  if(!destinoBase){throw new Error('Escolha a pasta principal (a que contém CDA, CDI e SISTEMA) na aba Atualização antes de gerar a versão da equipe.');}
  if(await destinoBase.requestPermission({mode:'readwrite'})!=='granted')throw new Error('Sem autorização para gravar a pasta PUBLICACAO_GITHUB.');
  const sis=pt.sistema||await filho(destinoBase,'SISTEMA');
  if(!sis)throw new Error('Pasta SISTEMA não encontrada.');
  p('Preparando os dados (1/3)...');
  const dados=await montarDoCache(meta);
  const pacote={cda:colunar(dados.cda),cdi:colunar(dados.cdi),arquivos:dados.arquivos.map(a=>({unidade:a.unidade,arquivo:a.arquivo,registros:a.registros})),formatos:dados.formatos,formatos_avisos:dados.formatos_avisos,
   colaboradores:dados.colaboradores,colaboradores_avisos:dados.colaboradores_avisos,comparativo:dados.comparativo};
  p('Compactando os dados (2/3)...');
  const bytes=await gz(JSON.stringify(pacote));
  const gerado=meta.gerado||new Date().toISOString();
  const dadosJs='/* Dados publicados do Indicador de Confiabilidade · gerado em '+new Date().toLocaleString('pt-BR')+' */\nwindow.DADOS_EQUIPE={gerado:'+JSON.stringify(gerado)+',registros:'+(dados.cda.length+dados.cdi.length)+',b64:"'+b64(bytes)+'"};\n';
  p('Gravando a pasta PUBLICACAO_GITHUB (3/3)...');
  const destino=await destinoBase.getDirectoryHandle('PUBLICACAO_GITHUB',{create:true});
  const assetsDst=await destino.getDirectoryHandle('assets',{create:true});
  let html=await lerTexto(sis,'index.html');
  if(!html)throw new Error('index.html não encontrado na pasta SISTEMA.');
  html=html.replace(/<script src="assets\/xlsx\.full\.min\.js"[^>]*><\/script>\s*/,'')
   .replace(/<script>\/\* Leitor de planilhas:[\s\S]*?<\/script>\s*<script>if\(typeof XLSX[\s\S]*?<\/script>\s*/,'')
   .replace('<script src="leitor-navegador.js','<script>window.MODO_EQUIPE=true;document.documentElement.classList.add("modo-equipe");</script>\n<script src="dados-equipe.js?v='+Date.now()+'"></script>\n<script src="leitor-navegador.js')
   .replace('<title>Indicador de Confiabilidade | Gestão de Riscos</title>','<title>Indicador de Confiabilidade | Gestão de Riscos · Equipe</title>');
  await escrever(destino,'index.html',html);
  for(const nome of ['style.css','app.js','painel-ui.js','leitor-navegador.js','comparativo.js']){const t=await lerTexto(sis,nome);if(t!==null)await escrever(destino,nome,t);}
  const assetsSrc=await filho(sis,'ASSETS');
  if(assetsSrc){for await(const e of assetsSrc.values()){if(e.kind==='file'&&/\.(png|jpe?g|svg|webp|ico|js)$/i.test(e.name))await escrever(assetsDst,e.name,await e.getFile());}}
  await escrever(destino,'dados-equipe.js',dadosJs);
  await escrever(destino,'.nojekyll','');
  await escrever(destino,'LEIA-ME.md','# Indicador de Confiabilidade — versão da equipe\n\nVersão somente leitura gerada em '+new Date().toLocaleString('pt-BR')+'.\n\n- Suba **todo o conteúdo desta pasta** para o repositório do GitHub (GitHub Pages abre o `index.html`).\n- Para atualizar: no painel master clique em **Versão equipe** de novo e suba os arquivos alterados (principalmente `dados-equipe.js`).\n- Os dados ficam embutidos em `dados-equipe.js` (compactados). Contém nomes de colaboradores: mantenha o repositório **privado**.\n');
  return {pasta:destinoBase.name+' › PUBLICACAO_GITHUB',registros:dados.cda.length+dados.cdi.length,tamanhoMB:(dadosJs.length/1048576)};
 }

 /* Lê só o comparativo anual (SISTEMA/comparativo_anual.xlsx), sem reprocessar as bases.
    pedir=true somente a partir de um clique (o navegador pode pedir "Permitir"). */
 async function lerComparativoAgora(pedir,etapa){
  const E=etapa||(()=>{});
  if(typeof XLSX==='undefined')return {ok:false,motivo:'O leitor de planilhas não carregou (sem internet?). Recarregue com Ctrl+F5.'};
  try{
   E('Consultando as pastas salvas');
   const pt=await comPrazo(pastas(),8000,'consultar as pastas salvas');
   let sis=pt.sistema;
   if(!sis&&!pt.raiz)return {ok:false,motivo:'Pasta principal não escolhida. Na aba Atualização clique em “Escolher pasta” e selecione a pasta 2026 (que contém CDA, CDI e SISTEMA).'};
   const alvo=pt.raiz||sis;
   if(pedir){
    const novo=await garantirAcesso(E);   // abre a janela de seleção se o acesso não estiver liberado
    sis=novo.sistema||(novo.raiz?await novo.raiz.getDirectoryHandle('SISTEMA').catch(()=>null):null);
    pt.raiz=novo.raiz;
   }else{
    E('Verificando acesso à pasta');
    const ok=await comPrazo(permissao(alvo,false),8000,'verificação de acesso');
    if(!ok)return {ok:false,semPermissao:true,motivo:'O navegador ainda não liberou a pasta nesta sessão. Clique em “Ler comparativo” e confirme a pasta 2026 na janela que abrir (botão “Selecionar pasta”).'};
   }
   if(!sis&&pt.raiz){E('Localizando a pasta SISTEMA');sis=await comPrazo(pt.raiz.getDirectoryHandle('SISTEMA').catch(()=>filho(pt.raiz,'SISTEMA')),10000,'localizar a pasta SISTEMA');if(sis)await put('pastas','sistema',sis).catch(()=>{});}
   if(!sis)return {ok:false,motivo:'Pasta SISTEMA não encontrada dentro de '+(pt.raiz?.name||'pasta escolhida')+'.'};
   const comp=await lerComparativo(sis,E);
   if(!comp)return {ok:false,motivo:'Arquivo comparativo_anual.xlsx não encontrado na pasta SISTEMA ('+sis.name+').'};
   if(!Object.keys(comp.unidades||{}).length)return {ok:false,motivo:comp.arquivo+': nenhuma aba reconhecida. Cada aba (CDA, CDI) precisa ter a coluna PERIODO e uma coluna por ano (2025, 2026).'};
   E('Salvando o comparativo neste navegador');
   const meta=await get('meta','snapshot').catch(()=>null);
   if(meta){meta.comparativo=comp;await put('meta','snapshot',meta).catch(()=>{});}
   await put('meta','comparativo',comp).catch(()=>{});
   return {ok:true,comparativo:comp};
  }catch(e){
   if(e&&e.cancelado)return {ok:false,semPermissao:true,motivo:'Seleção cancelada. Clique em “Ler comparativo” e, na janela que abrir, clique em “Selecionar pasta” (pasta 2026).'};
   return {ok:false,motivo:(e&&e.etapa?'O navegador ficou '+e.message+'.':'Erro ao ler o comparativo ('+(e?.name||'Erro')+': '+(e?.message||e)+').')+' Se o arquivo estiver aberto no Excel, feche-o e clique em “Ler comparativo”.',etapa:e&&e.etapa};
  }
 }
 async function comparativoDeArquivo(file){
  if(typeof XLSX==='undefined')throw new Error('O leitor de planilhas não carregou. Recarregue com Ctrl+F5.');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const sheets=wb.SheetNames.map(n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null,blankrows:false}));
  const comp={arquivo:file.name,modificado:new Date(file.lastModified).toISOString(),unidades:interpretarComparativo(sheets,wb.SheetNames),origem:'arquivo escolhido'};
  if(!Object.keys(comp.unidades).length)throw new Error(file.name+': nenhuma aba reconhecida (precisa das abas CDA e CDI com a coluna PERIODO e uma coluna por ano).');
  const meta=await get('meta','snapshot').catch(()=>null);
  if(meta){meta.comparativo=comp;await put('meta','snapshot',meta).catch(()=>{});}
  await put('meta','comparativo',comp).catch(()=>{});
  return comp;
 }
 async function comparativoSalvo(){
  const meta=await get('meta','snapshot').catch(()=>null);
  return meta?.comparativo||await get('meta','comparativo').catch(()=>null)||null;
 }

 /* =================== ESPELHO NO GITHUB ===================
    Ao atualizar, envia para o repositório (GitHub Pages) uma cópia do painel em
    modo espelho: sem PDF, sem Atualizar, sem aba Atualização, com os dados
    embutidos em dados-equipe.js. Um único commit por publicação (API Git). */
 const GH_PADRAO={owner:'Gestaoderiscos6-dotcom',repo:'indicador-confiabilidade',branch:'',token:'',mostrarNomes:true,auto:true};
 async function configGitHub(){const c=await get('meta','github').catch(()=>null);const cfg={...GH_PADRAO,...(c||{})};if(!cfg.nomesV161){cfg.mostrarNomes=true;cfg.nomesV161=true;if(c)await put('meta','github',cfg).catch(()=>{});}return cfg;}
 async function salvarConfigGitHub(c){const atual=await configGitHub();const novo={...atual,...c};await put('meta','github',novo);return novo;}
 function interpretarRepo(txt){
  const m=String(txt||'').trim().match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i)||String(txt||'').trim().match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  return m?{owner:m[1],repo:m[2]}:null;
 }
 const enc=new TextEncoder();
 async function gh(cfg,metodo,caminho,corpo){
  let r;
  try{
   r=await fetch('https://api.github.com/repos/'+cfg.owner+'/'+cfg.repo+caminho,{method:metodo,
    headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+cfg.token,'X-GitHub-Api-Version':'2022-11-28',...(corpo?{'Content-Type':'application/json'}:{})},
    body:corpo?JSON.stringify(corpo):undefined});
  }catch(e){const er=new Error('Não foi possível conectar ao GitHub (a rede da empresa pode estar bloqueando api.github.com).');er.rede=true;throw er;}
  const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null;}catch(e){}
  if(!r.ok){
   const msg=j&&j.message?j.message:('HTTP '+r.status);
   const er=new Error(r.status===401?'Token inválido ou vencido. Gere um novo token no GitHub e cole na aba Atualização.':
    r.status===404?'Repositório não encontrado ou o token não tem acesso a ele ('+cfg.owner+'/'+cfg.repo+'). Confira se o token tem permissão “Contents: Read and write” nesse repositório.':
    r.status===403?'O GitHub recusou o envio ('+msg+'). Confira a permissão “Contents: Read and write” do token.':
    r.status===409&&/empty/i.test(msg)?'O repositório está vazio. No GitHub, crie o arquivo README (Add a README) e tente de novo.':
    'GitHub: '+msg);
   er.status=r.status;throw er;
  }
  return j;
 }
 const NOMES_SITE=['style.css','app.js','painel-ui.js','leitor-navegador.js','comparativo.js'];
 async function arquivosDoEspelho(sis,dadosJs){
  const out=[];
  let html=await lerTexto(sis,'index.html');
  if(!html)throw new Error('index.html não encontrado na pasta SISTEMA.');
  html=html.replace(/<script src="assets\/xlsx\.full\.min\.js"[^>]*><\/script>\s*/,'')
   .replace(/<script>\/\* Leitor de planilhas:[\s\S]*?<\/script>\s*<script>if\(typeof XLSX[\s\S]*?<\/script>\s*/,'')
   .replace('<script src="leitor-navegador.js','<script>window.MODO_EQUIPE=true;document.documentElement.classList.add("modo-equipe");</script>\n<script src="dados-equipe.js?v='+Date.now()+'"></script>\n<script src="leitor-navegador.js')
   .replace('<meta charset="utf-8"/>','<meta charset="utf-8"/>\n<meta name="robots" content="noindex,nofollow"/>')
   .replace('<title>Indicador de Confiabilidade | Gestão de Riscos</title>','<title>Indicador de Confiabilidade | Gestão de Riscos · Espelho</title>');
  out.push({path:'index.html',bytes:enc.encode(html)});
  for(const n of NOMES_SITE){const t=await lerTexto(sis,n);if(t!==null)out.push({path:n,bytes:enc.encode(t)});}
  const assets=await filho(sis,'ASSETS');
  if(assets){for await(const e of assets.values()){if(e.kind==='file'&&/\.(png|jpe?g|svg|webp|ico)$/i.test(e.name))out.push({path:'assets/'+e.name,bytes:new Uint8Array(await (await e.getFile()).arrayBuffer())});}}
  out.push({path:'dados-equipe.js',bytes:enc.encode(dadosJs)});
  out.push({path:'.nojekyll',bytes:new Uint8Array(0)});
  return out;
 }
 async function pacoteDados(meta,mostrarNomes,compAtual){
  const dados=await montarDoCache(meta);
  const pacote={cda:colunar(dados.cda),cdi:colunar(dados.cdi),arquivos:dados.arquivos.map(a=>({unidade:a.unidade,arquivo:a.arquivo,registros:a.registros})),
   formatos:dados.formatos,formatos_avisos:[],colaboradores:mostrarNomes?dados.colaboradores:{},colaboradores_avisos:[],comparativo:compAtual||dados.comparativo||(await get('meta','comparativo').catch(()=>null))||null};
  const bytes=await gz(JSON.stringify(pacote));
  const js='/* Espelho do Indicador de Confiabilidade · publicado em '+new Date().toLocaleString('pt-BR')+' */\nwindow.DADOS_EQUIPE={gerado:'+JSON.stringify(meta.gerado||new Date().toISOString())+',publicado:'+JSON.stringify(new Date().toISOString())+',registros:'+(dados.cda.length+dados.cdi.length)+',b64:"'+b64(bytes)+'"};\n';
  return {js,registros:dados.cda.length+dados.cdi.length};
 }
 async function publicarGitHub(progresso){
  const p=progresso||(()=>{});
  const cfg=await configGitHub();
  if(!cfg.token)throw new Error('Cole o token do GitHub na aba Atualização (Espelho no GitHub) antes de publicar.');
  if(typeof CompressionStream==='undefined')throw new Error('Navegador sem suporte à compactação. Use o Chrome ou o Edge atualizados.');
  const meta=await get('meta','snapshot');
  if(!meta)throw new Error('Atualize os dados antes de publicar o espelho.');
  const pt=await pastas();
  const sis=pt.sistema||(pt.raiz?await filho(pt.raiz,'SISTEMA'):null);
  if(!sis)throw new Error('Pasta SISTEMA não encontrada. Escolha a pasta 2026 na aba Atualização.');
  if(!(await permissao(sis,false)))throw new Error('Sem acesso à pasta SISTEMA nesta sessão. Clique em Atualizar dados (ou Publicar agora) e confirme a pasta 2026.');
  // Comparativo: lê o arquivo da pasta SISTEMA na hora da publicação (reserva: cópia salva).
  let compAtual=null;
  try{p('Lendo o comparativo anual');compAtual=await comPrazo(lerComparativo(sis,null),30000,'ler o comparativo');}catch(e){console.warn('[Espelho] comparativo:',e);}
  if(compAtual&&Object.keys(compAtual.unidades||{}).length){meta.comparativo=compAtual;await put('meta','snapshot',meta).catch(()=>{});await put('meta','comparativo',compAtual).catch(()=>{});}
  else compAtual=null;
  p('Preparando os dados do espelho');
  const {js,registros}=await pacoteDados(meta,cfg.mostrarNomes,compAtual);
  const arquivos=await arquivosDoEspelho(sis,js);
  p('Conectando ao GitHub');
  const info=await gh(cfg,'GET','');
  const branch=cfg.branch||info.default_branch||'main';
  const ref=await gh(cfg,'GET','/git/ref/heads/'+encodeURIComponent(branch));
  const commitAtual=await gh(cfg,'GET','/git/commits/'+ref.object.sha);
  const arvore=[];
  for(let i=0;i<arquivos.length;i++){
   const a=arquivos[i];
   p('Enviando '+a.path+' ('+(i+1)+' de '+arquivos.length+')');
   const blob=await gh(cfg,'POST','/git/blobs',{content:b64(a.bytes),encoding:'base64'});
   arvore.push({path:a.path,mode:'100644',type:'blob',sha:blob.sha});
  }
  p('Registrando a publicação');
  const tree=await gh(cfg,'POST','/git/trees',{base_tree:commitAtual.tree.sha,tree:arvore});
  const quando=new Date().toLocaleString('pt-BR');
  const commit=await gh(cfg,'POST','/git/commits',{message:'Atualização do espelho · dados até '+new Date(meta.gerado||Date.now()).toLocaleString('pt-BR')+' · publicado '+quando,tree:tree.sha,parents:[ref.object.sha]});
  await gh(cfg,'PATCH','/git/refs/heads/'+encodeURIComponent(branch),{sha:commit.sha,force:false});
  const site='https://'+cfg.owner.toLowerCase()+'.github.io/'+cfg.repo+'/';
  const res={site,registros,commit:commit.sha.slice(0,7),quando:new Date().toISOString(),tamanhoMB:js.length/1048576};
  await salvarConfigGitHub({ultimo:res,branch});
  return res;
 }

 window.LeitorNavegador={configGitHub,salvarConfigGitHub,interpretarRepo,publicarGitHub,ativo,equipe,suportado,obter,verificar,escolherPasta,pastas,limpar,carregarEquipe,gerarVersaoEquipe,lerComparativoAgora,comparativoSalvo,comparativoDeArquivo,garantirAcesso};
})();
