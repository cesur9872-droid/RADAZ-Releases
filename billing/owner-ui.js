const form=document.querySelector('form'),status=document.querySelector('#status'),save=document.querySelector('#save'),retry=document.querySelector('#retry'),fields=document.querySelector('#fields');
const field=name=>form.elements.namedItem(name);
const sessionKey='radaz-owner-session:'+location.origin;
let token=location.hash.slice(1),connected=false;
// Keep the short-lived capability in this tab so Reload does not log the owner out.
// Never keep bank details or provider keys in browser storage.
try{if(token)sessionStorage.setItem(sessionKey,token);else token=sessionStorage.getItem(sessionKey)||'';}catch{}
if(token&&location.protocol!=='file:')history.replaceState(null,'',location.pathname);
const urls=()=>{const base=field('publicBaseUrl').value.trim().replace(/\/$/,'');document.querySelector('#callback').textContent=base?base+'/v1/webhooks/provider':'Əvvəl işlək HTTPS domenini daxil edin.';document.querySelector('#return').textContent=base?base+'/payment/return':'—';};
async function request(body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('/settings',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Panelə giriş alınmadı.');return data;
 }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw new Error('Satıcı panelinin xidməti cavab vermir. OPEN-SELLER-SETTINGS.cmd ilə açın və terminal pəncərəsini bağlamayın.');throw error;}
 finally{clearTimeout(timer);}
}
function populate(data){for(const [name,value]of Object.entries(data)){const input=field(name);if(!input)continue;if(input.type==='checkbox')input.checked=!!value;else input.value=value;}field('epointPrivateKey').value='';field('clearPrivateKey').checked=false;document.querySelector('#secret-state').textContent=data.privateKeyConfigured?'Gizli açar saxlanıb; burada geri göstərilmir.':'Gizli açar hələ daxil edilməyib.';urls();}
async function connect(){
 connected=false;save.disabled=true;fields.disabled=true;retry.hidden=true;
 if(location.protocol==='file:'||!token){document.querySelector('#storage').textContent='Bağlantı yoxdur';status.textContent='Bu HTML faylı ayarları saxlamır. billing qovluğundakı OPEN-SELLER-SETTINGS.cmd faylını açın; panel brauzerdə özü açılacaq. Köhnə vərəqəni bağlayın.';return;}
 status.textContent='Yerli satıcı xidmətinə qoşulur…';
 try{const data=await request();populate(data);document.querySelector('#storage').textContent=data.storagePath;connected=true;fields.disabled=false;save.disabled=false;status.textContent='Panel qoşuldu. Yadda saxla düyməsi ayarları yalnız bu kompüterdə saxlayır.';}
 catch(error){document.querySelector('#storage').textContent='Bağlantı alınmadı';status.textContent=error.message;retry.hidden=false;}
}
field('publicBaseUrl').addEventListener('input',urls);
retry.addEventListener('click',()=>void connect());
form.addEventListener('submit',async event=>{event.preventDefault();if(!connected)return;save.disabled=true;try{const body=Object.fromEntries(new FormData(form));body.enabled=field('enabled').checked;body.clearPrivateKey=field('clearPrivateKey').checked;populate(await request(body));status.textContent='Ayarlar saxlandı. Ödəniş serverini yenidən başladın. Bank kabinetində rekvizitlərin ayrıca təsdiqləndiyini yoxlayın.';}catch(error){status.textContent=error.message;}finally{save.disabled=false;}});
void connect();
