'use client';
import {resolvedVolumeSettings,volumePresetConfig,type VolumePreset,type VolumeRenderSettings} from '@/lib/volume-presets';

export function VolumeRenderControls({preset,settings,onChange}:{preset:VolumePreset;settings:VolumeRenderSettings;onChange:(next:VolumeRenderSettings)=>void}) {
 const value=resolvedVolumeSettings(preset,settings);
 const set=(patch:Partial<VolumeRenderSettings>)=>onChange({...settings,...patch});
 const slider=(key:keyof VolumeRenderSettings,label:string,min:number,max:number,step:number,unit='')=><label key={key}>
   <span>{label}<output>{Number(value[key]).toFixed(step<.1?2:step<1?1:0)}{unit}</output></span>
   <input aria-label={label} type="range" min={min} max={max} step={step} value={Number(value[key])} onChange={e=>set({[key]:+e.target.value})}/></label>;
 const check=(key:'gradient'|'normalFromOpacity',label:string)=><label className="volume-check"><input type="checkbox" checked={value[key]} onChange={e=>set({[key]:e.target.checked})}/>{label}</label>;
 return <div className="volume-settings-panel" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
  <label>Sol mouse<select aria-label="3D mouse rejimi" value={value.mouseMode} onChange={e=>set({mouseMode:e.target.value as typeof value.mouseMode})}><option value="rotate">Fırlatma</option><option value="tissue">HU həddi / şəffaflıq</option></select></label>
  <small>Shift + sol düymə: HU / şəffaflıq. Ctrl + sol düymə: keçid eni. Orta: daşı. Sağ / təkər: zoom.</small>
  <fieldset><legend>Toxuma və səth</legend>
   {slider('transferWidth','HU keçid eni',.25,3,.05,'×')}{slider('opacityDistance','Optik məsafə',.1,5,.1,' mm')}
   {check('normalFromOpacity','Səth normalını şəffaflıqdan hesabla')}{check('gradient','Gradient filtri')}
   {value.gradient&&<>{slider('gradientMin','Gradient başlanğıcı',0,300,1)}{slider('gradientMax','Gradient sonu',1,1000,1)}</>}
   <label>İnterpolyasiya<select aria-label="3D interpolyasiya" value={value.interpolation} onChange={e=>set({interpolation:e.target.value as typeof value.interpolation})}><option value="linear">Xətti — hamar səth</option><option value="nearest">Ən yaxın — voxel</option></select></label>
  </fieldset>
  <fieldset><legend>İşıq və kölgə</legend>
   <label>Kölgə modeli<select aria-label="3D kölgə modeli" value={value.shading} disabled={!volumePresetConfig[preset].shade} onChange={e=>set({shading:e.target.value as typeof value.shading})}><option value="surface">Səth işığı</option><option value="occlusion">Yerli yumşaq kölgə (LAO)</option><option value="scattering">Həcm daxilində işıq səpilməsi</option></select></label>
   {slider('ambient','Ətraf işıq',0,1,.01)}{slider('diffuse','Diffuz işıq',0,1,.01)}{slider('specular','Parlaqlıq',0,1,.01)}{slider('specularPower','Səth sərtliyi',1,80,1)}{slider('lightIntensity','İşıq gücü',.25,2,.05,'×')}
   {value.shading==='occlusion'&&<>{slider('occlusionRadius','Kölgə radiusu',1,8,1)}{slider('occlusionSamples','Kölgə nümunələri',4,24,1)}</>}
   {value.shading==='scattering'&&<>{slider('scattering','İşıq səpilməsi',0,.8,.05)}{slider('shadowReach','Kölgə məsafəsi',0,.5,.01)}</>}
  </fieldset>
  <fieldset><legend>Keyfiyyət</legend>
   <label>3D keyfiyyəti<select aria-label="3D keyfiyyəti" value={value.quality} onChange={e=>set({quality:e.target.value as typeof value.quality})}>{['performance','balanced','high','ultra','auto'].map(q=><option key={q} value={q}>{q[0].toUpperCase()+q.slice(1)}</option>)}</select></label>
   {slider('sampling','Render addımı',.5,2,.1,'×')}<small>Kiçik addım daha dəqiq, böyük addım daha sürətlidir. Sürükləmə zamanı kölgə və keyfiyyət müvəqqəti sadələşir; zəif GPU-da ağır kölgələr məhdudlaşdırılır.</small>
  </fieldset>
  <button type="button" onClick={()=>onChange({...volumePresetConfig[preset].lighting,quality:settings.quality})}>Preset ayarlarını bərpa et</button>
 </div>;
}
