if(!globalThis.__radazChatGPT){
 globalThis.__radazChatGPT=true;
 window.addEventListener('message',async event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.source!=='RADAZ_CHATGPT'||!['BRIDGE_INFO','ZIP_BEGIN','ZIP_CHUNK','ZIP_FINISH','ZIP_CANCEL'].includes(event.data.type))return;
  const {type,request,prompt,name,size,count,index,data,attachments}=event.data;if(typeof request!=='string')return;
  try{const result=await chrome.runtime.sendMessage({type,request,prompt,name,size,count,index,data,attachments});window.postMessage({source:'RADAZ_CHATGPT_EXTENSION',type,request,stage:'reply',ok:!!result?.ok,protocol:result?.protocol,version:result?.version,message:result?.error},location.origin);}
  catch{window.postMessage({source:'RADAZ_CHATGPT_EXTENSION',type,request,stage:'reply',ok:false,message:'Əlavə yenilənib. RADAZ səhifəsini yeniləyin.'},location.origin);}
 });
 chrome.runtime.onMessage.addListener(message=>{if(message?.source==='RADAZ_CHATGPT_EXTENSION')window.postMessage(message,location.origin);});
}
