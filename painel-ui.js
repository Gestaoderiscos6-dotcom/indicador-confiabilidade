'use strict';
/* =====================================================================
   Confiabilidade V13 · Camada de interface
   Abas superiores, filtros, Central de Atualização e avisos.
   Não altera cálculos: apenas organiza a navegação e chama o leitor local.
   ===================================================================== */
(function(){
 const $=id=>document.getElementById(id);
 const icon=(id,cls='')=>'<svg class="ico '+cls+'" aria-hidden="true"><use href="#'+id+'"/></svg>';
 const escH=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const nf=n=>Number(n||0).toLocaleString('pt-BR');

 /* ---------------- Abas ---------------- */
 if(window.MODO_EQUIPE)document.querySelector('.tab-update')?.remove();
 const tabs=[...document.querySelectorAll('.tab')];
 const panels=[...document.querySelectorAll('.tabpanel')];
 const ink=document.querySelector('.tab-ink');
 const track=$('tabs');
 const KEY='confiabilidade.aba.v13';
 const valid=new Set(tabs.map(t=>t.dataset.tab));

 function moveInk(tab){
  if(!ink||!tab)return;
  ink.style.width=tab.offsetWidth+'px';
  ink.style.setProperty('--ink-c',getComputedStyle(tab).getPropertyValue('--tc')||'');
  ink.style.transform='translateX('+tab.offsetLeft+'px)';
 }
 function abrirAba(nome,{scroll=true,focus=false}={}){
  if(!valid.has(nome))nome='visao';
  tabs.forEach(t=>{const on=t.dataset.tab===nome;t.setAttribute('aria-selected',String(on));t.classList.toggle('active',on);t.tabIndex=on?0:-1;if(on){moveInk(t);t.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});if(focus)t.focus();}});
  panels.forEach(p=>{const on=p.dataset.panel===nome;p.hidden=!on;if(on){p.classList.remove('enter');void p.offsetWidth;p.classList.add('enter');}});
  document.body.dataset.aba=nome;
  try{localStorage.setItem(KEY,nome);}catch(e){}
  if(location.hash!=='#'+nome)history.replaceState(null,'','#'+nome);
  if(scroll){const fb=document.getElementById('filterbar');const off=document.querySelector('.tabs').offsetHeight+(fb&&getComputedStyle(fb).position==='sticky'?fb.offsetHeight:0);const top=document.querySelector('.content').getBoundingClientRect().top+window.scrollY-off-8;if(window.scrollY>top)window.scrollTo({top:Math.max(0,top),behavior:'smooth'});}
  // Gráficos dentro de abas ocultas precisam recalcular o tamanho.
  setTimeout(()=>window.dispatchEvent(new Event('resize')),40);
  if(nome==='atualizacao')setTimeout(()=>verificarPastas(true),0);
 }
 tabs.forEach((t,i)=>{
  t.addEventListener('click',()=>abrirAba(t.dataset.tab));
  t.addEventListener('keydown',e=>{
   let j=null;if(e.key==='ArrowRight')j=(i+1)%tabs.length;else if(e.key==='ArrowLeft')j=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=tabs.length-1;
   if(j!==null){e.preventDefault();abrirAba(tabs[j].dataset.tab,{scroll:false,focus:true});}
  });
 });
 document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>abrirAba(b.dataset.goto)));
 window.addEventListener('resize',()=>moveInk(document.querySelector('.tab.active')));
 window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(valid.has(h))abrirAba(h,{scroll:false});});
 const EQUIPE=!!window.MODO_EQUIPE;
 if(EQUIPE){document.querySelector('.tab-update')?.remove();valid.delete('atualizacao');
  const h1=document.querySelector('.brand-title h1');if(h1)h1.insertAdjacentHTML('beforeend','<span class="equipe-tag">'+icon('i-eye')+'EQUIPE</span>');}
 let inicial=location.hash.slice(1);
 if(!valid.has(inicial)){try{inicial=localStorage.getItem(KEY)||'visao';}catch(e){inicial='visao';}}
 // Ao abrir o painel, nunca começa na aba Atualização (os dados salvos já aparecem na Visão geral).
 if(inicial==='atualizacao')inicial='visao';
 abrirAba(valid.has(inicial)?inicial:'visao',{scroll:false});
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>moveInk(document.querySelector('.tab.active')));

 /* ---------------- Turno (colaboradores) ---------------- */
 const tsWrap=$('turnosColab');
 document.querySelectorAll('.ts-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.ts-btn').forEach(x=>x.classList.toggle('active',x===b));
  if(tsWrap)tsWrap.dataset.turno=b.dataset.turno;
 }));

 /* ---------------- Filtros ---------------- */
 const filtros=['ano','mes','turno','depto','loja'];
 const fbar=$('filterbar'),ftoggle=$('filterToggle');
 function contarFiltros(){
  const n=filtros.filter(id=>$(id)&&$(id).value).length+($('visao').value!=='geral'?1:0);
  const el=$('filterCount');el.hidden=!n;el.textContent=n;
  filtros.concat('visao').forEach(id=>{const c=$(id)?.closest('.ctl');if(c)c.classList.toggle('is-set',id==='visao'?$(id).value!=='geral':!!$(id).value);});
 }
 filtros.concat('visao').forEach(id=>$(id)?.addEventListener('change',contarFiltros));
 $('limparFiltros')?.addEventListener('click',()=>setTimeout(contarFiltros,0));
 ftoggle?.addEventListener('click',()=>{const open=!fbar.classList.contains('open');fbar.classList.toggle('open',open);ftoggle.setAttribute('aria-expanded',String(open));});
 contarFiltros();

 /* ---------------- Cabeçalho ao rolar / topo ---------------- */
 let raf=0;
 window.addEventListener('scroll',()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;document.body.classList.toggle('scrolled',window.scrollY>10);$('toTop').classList.toggle('show',window.scrollY>600);});},{passive:true});
 $('toTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

 /* ---------------- Aviso (toast) ---------------- */
 let toastTimer=0;
 function toast(titulo,texto,tipo='ok'){
  const t=$('toast');t.className='toast '+tipo;t.hidden=false;
  t.querySelector('.toast-ico').innerHTML=icon(tipo==='erro'?'i-x-circle':tipo==='info'?'i-refresh':'i-check-circle');
  $('toastTitulo').textContent=titulo;$('toastTexto').textContent=texto||'';
  requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(toastTimer);toastTimer=setTimeout(fecharToast,tipo==='erro'?9000:5500);
 }
 function fecharToast(){const t=$('toast');t.classList.remove('show');setTimeout(()=>{t.hidden=true;},300);}
 $('toastFechar').addEventListener('click',fecharToast);

 /* ---------------- Situação (chip do topo) ---------------- */
 function chip(estado,titulo,detalhe){
  const c=$('syncChip');c.dataset.estado=estado;$('syncTitulo').textContent=titulo;$('syncDetalhe').textContent=detalhe||'';
 }

 /* ---------------- Atualização ---------------- */
 const btnCarregar=$('carregar'),btnTopo=$('btnAtualizarTopo');
 let pendentes=0,atualizando=false;

 function setLoading(on){
  atualizando=on;
  [btnTopo,btnCarregar].forEach(b=>{if(!b)return;b.classList.toggle('is-loading',on);});
  btnTopo.disabled=on;
  btnTopo.querySelector('span').textContent=on?'Atualizando…':'Atualizar dados';
  if(on)chip('busy','Atualizando dados…','Lendo arquivos novos das pastas');
 }
 if(btnCarregar){
  new MutationObserver(()=>setLoading(btnCarregar.disabled)).observe(btnCarregar,{attributes:true,attributeFilter:['disabled']});
  setLoading(btnCarregar.disabled);
 }
 btnTopo.addEventListener('click',()=>{if(btnCarregar&&!btnCarregar.disabled){btnCarregar.click();}});

 function badge(n){
  pendentes=n;
  [$('updateBadge'),$('tabBadge')].forEach(b=>{if(!b)return;b.hidden=!n;b.textContent=n>99?'99+':n;});
  btnTopo.classList.toggle('has-pending',!!n);
 }

 const STATUS={novo:['Novo','i-plus-circle','st-new'],alterado:['Alterado','i-refresh','st-changed'],em_dia:['Em dia','i-check-circle','st-ok'],removido:['Removido','i-minus-circle','st-removed'],pendente:['Pendente','i-clock','st-changed']};
 function fmtTam(b){if(!b&&b!==0)return '';if(b<1024)return b+' B';if(b<1048576)return (b/1024).toFixed(0)+' KB';return (b/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB';}
 function fmtData(iso){if(!iso)return '';const d=new Date(iso);return isNaN(d)?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});}
 function listaArquivos(el,unidade){
  if(!el)return;
  if(!unidade){el.innerHTML='<div class="file-empty">'+icon('i-folder')+' Pasta não informada pelo leitor.</div>';return;}
  const itens=[...(unidade.arquivos||[]),...(unidade.removidos||[]).map(r=>({...r,status:'removido'}))];
  if(!itens.length){el.innerHTML='<div class="file-empty">'+icon('i-folder')+' Nenhum XLSX encontrado nesta pasta.</div>';return;}
  const ordem={novo:0,alterado:1,pendente:1,removido:2,em_dia:3};
  itens.sort((a,b)=>(ordem[a.status]??9)-(ordem[b.status]??9)||String(a.nome).localeCompare(String(b.nome),'pt-BR',{numeric:true}));
  el.innerHTML=itens.map(f=>{const st=STATUS[f.status]||STATUS.pendente;return '<div class="file-row '+st[2]+'"><span class="file-ico">'+icon('i-sheet')+'</span><div class="file-main"><b>'+escH(f.nome)+'</b><small>'+[fmtTam(f.tamanho),f.modificado?('modificado em '+fmtData(f.modificado)):''].filter(Boolean).join(' · ')+'</small></div><span class="file-status">'+icon(st[1])+st[0]+'</span></div>';}).join('');
 }

 const LOCAL=!!(window.LeitorNavegador&&window.LeitorNavegador.ativo());
 function listaMsg(t){['arquivosCDA','arquivosCDI'].forEach(id=>{const el=$(id);if(el)el.innerHTML='<div class="file-empty">'+icon('i-folder')+' '+escH(t)+'</div>';});}
 function pastaCard(d){
  const card=$('pastaInfo');if(!card)return;
  const nome=$('pastaNome'),det=$('pastaDetalhe'),btn=$('escolherPasta');
  if(!LOCAL){card.className='uh-folder ok';nome.textContent='Leitor local (ABRIR_PAINEL.bat)';det.textContent='As pastas CDA e CDI são lidas pelo leitor do computador';if(btn)btn.hidden=true;return;}
  if(!window.LeitorNavegador.suportado){card.className='uh-folder warn';nome.textContent='Navegador sem suporte';det.textContent='Abra este arquivo no Google Chrome ou no Microsoft Edge';if(btn)btn.hidden=true;return;}
  const p=d?.pastas||{};
  if(!p.cda&&!p.cdi){card.className='uh-folder warn';nome.textContent='Nenhuma pasta escolhida';det.textContent='Clique em Escolher pasta e selecione a pasta que contém CDA, CDI e SISTEMA';return;}
  card.className='uh-folder ok';
  nome.textContent=p.raiz||[p.cda,p.cdi].filter(Boolean).join(' + ');
  det.textContent=['CDA '+(p.cda?'✓':'✗'),'CDI '+(p.cdi?'✓':'✗'),'SISTEMA '+(p.sistema?'✓':'✗')].join(' · ')+(d?.sem_permissao?' · aguardando autorização do navegador':'');
  if(btn)btn.innerHTML=icon('i-folder')+' Trocar pasta';
 }
 $('escolherPasta')?.addEventListener('click',async()=>{
  try{
   const r=await window.LeitorNavegador.escolherPasta();if(!r)return;
   toast('Pasta selecionada',r.tipo==='raiz'?(r.nome+' · CDA '+(r.cda?'✓':'✗')+' · CDI '+(r.cdi?'✓':'✗')+' · SISTEMA '+(r.sistema?'✓':'✗')):('Pasta '+r.nome+' definida'),'ok');
   ultimaVerificacao=0;await verificarPastas(true);
   if(btnCarregar&&!btnCarregar.disabled)btnCarregar.click();
  }catch(e){toast('Não foi possível usar esta pasta',e.message,'erro');}
 });
 document.addEventListener('painel:sem-pasta',()=>{abrirAba('atualizacao',{scroll:false});chip('pending','Escolha a pasta dos dados','Aba Atualização › Escolher pasta');pastaCard({pastas:{}});});
 let ultimaVerificacao=0,verificando=null;
 async function verificarPastas(silencioso=false){
  if(verificando)return verificando;
  if(silencioso&&Date.now()-ultimaVerificacao<15000)return;
  const btn=$('verificarPastas');btn?.classList.add('is-loading');
  verificando=(async()=>{
   try{
    let d;
    if(LOCAL){
     d=await window.LeitorNavegador.verificar(!silencioso);
     pastaCard(d);
     if(d.sem_pasta){badge(0);listaMsg('Escolha a pasta principal (a que contém CDA, CDI e SISTEMA).');if(!atualizando)chip('pending','Escolha a pasta dos dados','Aba Atualização › Escolher pasta');return d;}
     if(d.sem_permissao){
      // Dados já salvos: nada a fazer até você clicar em Atualizar (o navegador confirma o acesso nesse momento).
      listaMsg('Dados salvos neste computador. Para procurar arquivos novos clique em “Verificar pastas” ou “Atualizar dados” (se abrir a janela de pastas, clique em “Selecionar pasta”).');
      if(!atualizando&&d.snapshot_gerado_em)chip('ok','Dados até '+fmtData(d.snapshot_gerado_em),'Atualizar busca só arquivos novos');
      return d;}
    }else{
    const r=await fetch('/api/arquivos',{cache:'no-store'});
    if(r.status===404)throw new Error('O leitor_local.py em uso é antigo e não tem a verificação de arquivos. Feche a janela preta do leitor e abra o ABRIR_PAINEL.bat novamente.');
    d=await r.json();
    if(!r.ok)throw new Error(d.erro||('HTTP '+r.status));
    pastaCard(null);
    }
    ultimaVerificacao=Date.now();
    const res=d.resumo||{};
    $('usNovos').textContent=nf(res.novos);$('usAlterados').textContent=nf(res.alterados);$('usEmDia').textContent=nf(res.em_dia);$('usRemovidos').textContent=nf(res.removidos);
    $('pastaCDA').textContent=d.unidades?.CDA?.pasta||'—';$('pastaCDI').textContent=d.unidades?.CDI?.pasta||'—';
    listaArquivos($('arquivosCDA'),d.unidades?.CDA);listaArquivos($('arquivosCDI'),d.unidades?.CDI);
    const n=(res.novos||0)+(res.alterados||0)+(res.removidos||0);
    badge(n);
    if(!atualizando){
     if(n)chip('pending',n+' arquivo(s) para atualizar','Clique em Atualizar dados');
     else if(d.snapshot_gerado_em)chip('ok','Dados em dia','Até '+fmtData(d.snapshot_gerado_em));
    }
    return d;
   }catch(e){
    if(!silencioso)toast('Não foi possível verificar as pastas',e.message,'erro');
    ['arquivosCDA','arquivosCDI'].forEach(id=>{const el=$(id);if(el&&!el.querySelector('.file-row'))el.innerHTML='<div class="file-empty warn">'+icon('i-alert')+' '+escH(e.message)+'</div>';});
   }finally{btn?.classList.remove('is-loading');verificando=null;}
  })();
  return verificando;
 }
 $('verificarPastas')?.addEventListener('click',()=>verificarPastas(false));

 document.addEventListener('painel:atualizado',ev=>{
  const d=ev.detail||{};const c=d.cache||{};
  const quando=d.gerado?fmtData(d.gerado):new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  chip('ok',EQUIPE?'Dados publicados':'Dados atualizados','Até '+quando);
  if(d.refresh){
   const lidos=c.reprocessados??null,reuso=c.reutilizados??null;
   const txt=lidos===null?(nf(d.cda)+' registros CDA + '+nf(d.cdi)+' CDI'):(lidos?nf(lidos)+' arquivo(s) novo(s)/alterado(s) lido(s)':'Nenhum arquivo novo: tudo já estava em dia')+(reuso!==null?' · '+nf(reuso)+' reaproveitado(s)':'');
   toast('Atualização concluída',txt+(d.avisos?' · '+d.avisos+' aviso(s), veja a aba Atualização':''),d.avisos?'info':'ok');
  }
  if(!EQUIPE){ultimaVerificacao=0;verificarPastas(true);}
 });
 document.addEventListener('painel:erro',ev=>{
  chip('erro','Falha na atualização','Veja a aba Atualização');
  toast('Não foi possível atualizar',ev.detail?.mensagem||'Erro desconhecido','erro');
 });

 if(EQUIPE){
  document.addEventListener('painel:atualizado',ev=>chip('ok','Dados publicados','Até '+fmtData(ev.detail?.gerado)),{once:false});
 }else{
 // Verificação automática enquanto o painel estiver aberto (somente lista arquivos, não lê planilhas).
 setTimeout(()=>verificarPastas(true),2500);
 setInterval(()=>{if(document.visibilityState==='visible'&&!atualizando){ultimaVerificacao=0;verificarPastas(true);}},120000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){verificarPastas(true);}});
 }

 /* ---------------- Espelho no GitHub ---------------- */
 const LN=window.LeitorNavegador;
 let publicando=false;
 function ghStatus(cls,txt){const el=$('ghStatus');if(el){el.className='gh-status '+cls;el.textContent=txt;}}
 async function ghCarregarTela(){
  if(!$('ghPanel'))return;
  if(!LOCAL||!LN?.configGitHub){$('ghPanel').hidden=true;return;}
  const c=await LN.configGitHub();
  $('ghRepo').value='https://github.com/'+c.owner+'/'+c.repo;
  $('ghToken').value='';$('ghToken').placeholder=c.token?'Token salvo neste computador (cole outro para trocar)':'Cole aqui o token (github_pat_...)';
  $('ghTokenInfo').textContent=c.token?'✓ salvo':'';
  $('ghNomes').checked=!!c.mostrarNomes;$('ghAuto').checked=c.auto!==false;
  const site='https://'+c.owner.toLowerCase()+'.github.io/'+c.repo+'/';
  if(c.ultimo){ghStatus('ok','Publicado '+fmtData(c.ultimo.quando));$('ghLink').innerHTML='Espelho: <a href="'+escH(site)+'" target="_blank" rel="noopener">'+escH(site)+'</a> · última publicação '+escH(fmtData(c.ultimo.quando))+' · '+nf(c.ultimo.registros)+' registros';}
  else{ghStatus(c.token?'':'',c.token?'Pronto para publicar':'Não configurado');$('ghLink').innerHTML='Endereço do espelho: <a href="'+escH(site)+'" target="_blank" rel="noopener">'+escH(site)+'</a>';}
 }
 async function ghSalvar(){
  const r=LN.interpretarRepo($('ghRepo').value);
  if(!r)throw new Error('Endereço do repositório inválido. Use o formato https://github.com/usuario/repositorio');
  const dados={owner:r.owner,repo:r.repo,mostrarNomes:$('ghNomes').checked,auto:$('ghAuto').checked};
  const t=$('ghToken').value.trim();if(t)dados.token=t;
  await LN.salvarConfigGitHub(dados);await ghCarregarTela();
 }
 async function ghPublicar(motivo){
  if(publicando)return;publicando=true;
  const b=$('ghPublicar');b?.classList.add('is-loading');if(b)b.disabled=true;
  ghStatus('busy','Publicando…');
  try{
   const r=await LN.publicarGitHub(t=>{ghStatus('busy',t+'…');chip('busy','Publicando no GitHub…',t);});
   ghStatus('ok','Publicado agora');
   chip('ok','Espelho atualizado','Publicado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
   toast('Espelho publicado no GitHub',nf(r.registros)+' registros · o site atualiza em 1 a 2 minutos: '+r.site,'ok');
   await ghCarregarTela();
  }catch(e){ghStatus('erro','Falha ao publicar');toast('Não foi possível publicar no GitHub',e.message,'erro');chip('erro','Espelho não publicado',e.message);}
  finally{publicando=false;b?.classList.remove('is-loading');if(b)b.disabled=false;}
 }
 $('ghSalvar')?.addEventListener('click',async()=>{try{await ghSalvar();toast('Configuração salva','Repositório e opções do espelho guardados neste computador.','ok');}catch(e){toast('Não foi possível salvar',e.message,'erro');}});
 $('ghPublicar')?.addEventListener('click',async()=>{
  try{
   await ghSalvar();
   // garante acesso à pasta SISTEMA (pode abrir a janela de seleção da pasta 2026)
   await LN.garantirAcesso(t=>ghStatus('busy',t));
   await ghPublicar('manual');
  }catch(e){if(!e.cancelado){ghStatus('erro','Falha');toast('Não foi possível publicar no GitHub',e.message,'erro');}else ghStatus('','Cancelado');}
 });
 document.addEventListener('painel:atualizado',async ev=>{
  if(!LOCAL||!ev.detail?.refresh||!LN?.configGitHub)return;
  const c=await LN.configGitHub();
  if(c.token&&c.auto!==false)setTimeout(()=>ghPublicar('auto'),800);
 });
 ghCarregarTela();

 /* ---------------- Versão da equipe (GitHub) ---------------- */
 document.addEventListener('painel:gerar-equipe',async()=>{
  if(!window.LeitorNavegador?.gerarVersaoEquipe)return;
  if(!confirm('Gerar a versão da equipe (somente leitura) na pasta PUBLICACAO_GITHUB?\n\nEla leva os dados da última atualização, sem botões de atualizar. Contém nomes de colaboradores: mantenha o repositório do GitHub privado.'))return;
  const btn=$('exportarPublicacao');btn.disabled=true;btn.classList.add('is-loading');
  try{
   const r=await window.LeitorNavegador.gerarVersaoEquipe(msg=>{chip('busy','Gerando versão equipe…',msg);$('status').textContent=msg;});
   chip('ok','Versão equipe gerada',r.pasta);
   toast('Versão da equipe pronta',r.pasta+' · '+r.registros.toLocaleString('pt-BR')+' registros · dados '+r.tamanhoMB.toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB. Suba o conteúdo da pasta para o GitHub.','ok');
  }catch(e){toast('Não foi possível gerar a versão da equipe',e.message,'erro');chip('erro','Falha ao gerar versão equipe',e.message);}
  finally{btn.disabled=false;btn.classList.remove('is-loading');}
 });
})();
