// Kept separate so the public DOM adapter and ZIP extraction can be regression-tested.
globalThis.RADAZChatGPT = {
 async files(parts,bundle){
  const zipFile=new File(parts,bundle.name,{type:'application/zip'}),a=bundle.attachments;
  if(!a)return [zipFile]; // Compatibility with a previously opened RADAZ page.
  const zip=await JSZip.loadAsync(await zipFile.arrayBuffer());
  const entry=zip.file('manifest.json');if(!entry||entry._data.uncompressedSize>16*1024*1024)throw new Error('ZIP manifesti tapılmadı və ya həddindən böyükdür.');
  const manifest=JSON.parse(await entry.async('string'));
  if(manifest.imageCount!==a.total||!Array.isArray(manifest.images)||manifest.images.length!==a.total)throw new Error('ZIP-də görüntü sayı uyğun gəlmir.');
  const files=[];
  for(let i=a.first;i<a.first+a.count;i++){
   const name=`RADAZ-image-${String(i+1).padStart(6,'0')}.jpg`,image=zip.file(name);
   if(manifest.images[i]?.name!==name||!image||image._data.uncompressedSize>20*1024*1024)throw new Error(`${name} tapılmadı və ya 20 MB yerli görüntü həddini keçir.`);
   const bytes=await image.async('uint8array');if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error(`${name} JPEG kimi oxunmadı.`);
   files.push(new File([bytes],name,{type:'image/jpeg'}));
  }
  if(a.includeZip)files.push(zipFile);return files;
 },
 root(composer){
  const form=composer.closest('form');if(form)return form;
  for(let el=composer.parentElement,level=0;el&&el!==document.body&&level<12;el=el.parentElement,level++)if(el.querySelector('input[type="file"]'))return el;
  throw new Error('ChatGPT əlavə sahəsi tapılmadı. JPEG-i əl ilə əlavə edin.');
 },
 state(composer,names){
  const root=this.root(composer),found=new Set();
  // Only removable attachment cards beside this composer count. Prompt text,
  // transcript text, banners and input.files are never evidence of an upload.
  for(const el of root.querySelectorAll('[title],[aria-label],img,span')){
   if(el===composer||el.contains(composer)||composer.contains(el)||el.closest('textarea,[contenteditable="true"]')||!el.getBoundingClientRect().height)continue;
   const values=[el.getAttribute('title'),el.getAttribute('aria-label'),el.getAttribute('alt'),el.children.length?null:el.textContent?.trim()].filter(Boolean);
   const matches=names.filter(name=>values.some(value=>value===name||value.includes(name)));
   if(!matches.length)continue;
   let card=el;
   for(let level=0;card&&card!==root&&!card.contains(composer)&&level<6;level++,card=card.parentElement){
    const buttons=[...(card.matches('button')?[card]:[]),...card.querySelectorAll('button')];
    if(buttons.some(button=>/remove|delete|sil|удал|kaldır|retirer|entfernen/i.test([button.getAttribute('aria-label'),button.getAttribute('title'),button.getAttribute('data-testid')].join(' ')))){matches.forEach(name=>found.add(name));break;}
   }
  }
  const busy=!![...root.querySelectorAll('[role="progressbar"],[aria-busy="true"],.animate-spin')].find(el=>el.getBoundingClientRect().height);
  const send=root.querySelector('button[data-testid="send-button"],button[type="submit"]')||[...root.querySelectorAll('button')].find(el=>/^(send|отправить|göndər)/i.test(el.getAttribute('aria-label')||''));
  return {complete:names.every(name=>found.has(name)),busy,canSend:!!send&&!send.disabled&&send.getAttribute('aria-disabled')!=='true'};
 }
};
