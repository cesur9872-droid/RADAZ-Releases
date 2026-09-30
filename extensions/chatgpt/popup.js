const field=document.querySelector('#origin'),status=document.querySelector('#status');
chrome.storage.local.get('origin').then(({origin})=>field.value=origin||'http://localhost:5173');
document.querySelector('#save').addEventListener('click',async()=>{
 try{
  const url=new URL(field.value.trim());if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Yalnız RADAZ origin ünvanını daxil edin.');
  const origin=url.origin,match=`${url.protocol}//${url.hostname}/*`;
  if(!await chrome.permissions.request({origins:[match]}))throw new Error('Sayta giriş icazəsi verilmədi.');
  await chrome.scripting.unregisterContentScripts({ids:['radaz-custom']}).catch(()=>{});
  if(!(url.protocol==='http:'&&url.hostname==='localhost'))await chrome.scripting.registerContentScripts([{id:'radaz-custom',matches:[match],js:['radaz.js'],runAt:'document_idle',persistAcrossSessions:true}]);
  await chrome.storage.local.set({origin});status.textContent='Saxlanıldı. RADAZ səhifəsini yeniləyin.';
 }catch(error){status.textContent=error.message;}
});
