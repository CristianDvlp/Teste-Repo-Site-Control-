(() => {
 const atual=document.getElementById('senhaAtualReset'),nova=document.getElementById('novaSenhaReset');
 if(!atual)return;
 const erro=document.createElement('p');erro.className='senha-campo-erro';erro.id='erroSenhaAtual';erro.setAttribute('role','status');atual.after(erro);atual.setAttribute('aria-describedby',erro.id);
 const erroNova=document.createElement('p');erroNova.className='senha-campo-erro';erroNova.id='erroNovaSenha';erroNova.setAttribute('role','status');nova.after(erroNova);nova.setAttribute('aria-describedby',erroNova.id);
 let versao=0;
 atual.addEventListener('input',()=>{versao++;atual.removeAttribute('aria-invalid');erro.textContent='';conferirNova();});
 function conferirNova(){const igual=nova.value && nova.value===atual.value;nova.setAttribute('aria-invalid',String(!!igual));erroNova.textContent=igual?'A nova senha deve ser diferente da atual.':'';return !igual;}
 nova.addEventListener('input',conferirNova);nova.addEventListener('blur',conferirNova);
 atual.addEventListener('blur',async()=>{
  if(!atual.value)return;
  const seq=++versao,senha=atual.value;erro.textContent='Verificando…';
  try {
   const r=await fetch('/api/alterar-senha',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'validar',senhaAtual:senha})});
   const d=await r.json();if(seq!==versao)return;
   atual.setAttribute('aria-invalid',String(!r.ok));erro.textContent=r.ok?'':d.erro||'Não foi possível verificar.';
  }catch{if(seq===versao)erro.textContent='Não foi possível verificar. Tente novamente.';}
 });
 const salvar=window.alterarSenha;window.alterarSenha=async function(){if(!conferirNova()){nova.focus();return;}return salvar();};
 const abrir=window.abrirModalSenha;window.abrirModalSenha=function(){versao++;erro.textContent='';erroNova.textContent='';atual.removeAttribute('aria-invalid');nova.removeAttribute('aria-invalid');return abrir();};
})();
