export type VolumePreset = 'bone'|'angio'|'soft'|'lung'|'airway'|'skin'|'transparent'|'mip'|'minip';
export type VolumeQuality = 'performance'|'balanced'|'high'|'ultra'|'auto';
export type VolumeRenderSettings = {ambient:number;diffuse:number;specular:number;specularPower:number;quality:VolumeQuality};
type Definition = {key:VolumePreset;title:string;subtitle:string;tone:string;threshold:number;opacity:number;
  scalar:[number,number][];color:[number,number,number,number][];gradient:[number,number][];
  shade:boolean;interpolation:0|1;blend:'composite'|'maximum'|'minimum';lighting:VolumeRenderSettings};
const lighting=(ambient:number,diffuse:number,specular:number,specularPower:number):VolumeRenderSettings=>({ambient,diffuse,specular,specularPower,quality:'balanced'});
export const volumeStyles:Definition[]=[
 {key:'bone',title:'Bone',subtitle:'Sümük · HU',tone:'#ead1a5',threshold:260,opacity:1,scalar:[[-1024,0],[150,0],[300,.08],[700,.5],[1800,.95],[3071,1]],color:[[-1024,0,0,0],[150,.45,.3,.2],[500,.9,.76,.58],[1200,1,.95,.85]],gradient:[[0,.05],[30,.3],[150,1]],shade:true,interpolation:1,blend:'composite',lighting:lighting(.22,.8,.3,30)},
 {key:'angio',title:'Angio',subtitle:'Kontrastlı damarlar · HU',tone:'#e96543',threshold:120,opacity:1,scalar:[[-1024,0],[80,0],[140,.03],[250,.25],[450,.6],[900,.85],[3071,1]],color:[[0,.25,0,0],[120,.7,.08,.04],[250,1,.35,.15],[500,1,.85,.65],[1000,1,1,.9]],gradient:[[0,.05],[20,.25],[100,1]],shade:true,interpolation:1,blend:'composite',lighting:lighting(.2,.8,.4,40)},
 {key:'soft',title:'Soft Tissue',subtitle:'Yumşaq toxuma · HU',tone:'#c47068',threshold:0,opacity:1,scalar:[[-1024,0],[-150,0],[-50,.02],[40,.12],[150,.25],[400,.08],[3071,.1]],color:[[-150,.45,.25,.18],[0,.75,.4,.35],[100,1,.75,.6],[400,1,.92,.8]],gradient:[[0,.15],[20,.5],[80,1]],shade:true,interpolation:1,blend:'composite',lighting:lighting(.3,.7,.2,20)},
 {key:'lung',title:'Lung',subtitle:'Ağciyər parenximası · HU',tone:'#9fc8d7',threshold:-760,opacity:1,scalar:[[-1024,0],[-950,0],[-850,.03],[-700,.12],[-400,.3],[-200,.02],[3071,0]],color:[[-1000,.1,.2,.35],[-800,.35,.6,.8],[-500,.7,.85,.95],[-200,1,.85,.8]],gradient:[[0,.1],[10,.4],[80,1]],shade:true,interpolation:1,blend:'composite',lighting:lighting(.3,.75,.15,20)},
 {key:'airway',title:'Airway',subtitle:'Hava yolları · HU',tone:'#c2e7ef',threshold:-950,opacity:1,scalar:[[-1200,0],[-1024,0],[-1000,.1],[-940,.4],[-800,.03],[-600,0],[3071,0]],color:[[-1024,.2,.4,.65],[-950,.7,.9,1],[-800,1,1,1]],gradient:[[0,.02],[10,.3],[60,1]],shade:true,interpolation:1,blend:'composite',lighting:lighting(.3,.8,.2,25)},
 {key:'skin',title:'Skin',subtitle:'Dəri səthi · HU',tone:'#d99b7c',threshold:-280,opacity:1,scalar:[[-1024,0],[-500,0],[-280,.08],[-100,.5],[200,.75],[3071,.9]],color:[[-500,.35,.18,.12],[-280,.65,.35,.24],[0,.95,.7,.5],[400,1,.87,.7]],gradient:[[0,.05],[20,.6],[100,1]],shade:true,interpolation:1,blend:'composite',lighting:lighting(.3,.75,.2,22)},
 {key:'transparent',title:'Transparent',subtitle:'Şəffaf anatomik baxış · HU',tone:'#b4c9d6',threshold:0,opacity:.5,scalar:[[-1024,0],[-500,0],[-100,.008],[50,.02],[300,.04],[1000,.18],[3071,.3]],color:[[-500,.25,.3,.4],[0,.7,.45,.4],[300,.9,.6,.4],[1000,1,.95,.85]],gradient:[[0,.3],[100,1]],shade:true,interpolation:1,blend:'composite',lighting:lighting(.35,.65,.2,24)},
 {key:'mip',title:'MIP',subtitle:'Maksimum intensivlik proyeksiyası',tone:'#ddd',threshold:0,opacity:1,scalar:[[-1024,0],[0,0],[400,1],[3071,1]],color:[[-1024,0,0,0],[0,0,0,0],[400,1,1,1],[3071,1,1,1]],gradient:[[0,1],[1000,1]],shade:false,interpolation:1,blend:'maximum',lighting:lighting(1,0,0,1)},
 {key:'minip',title:'MinIP',subtitle:'Minimum intensivlik proyeksiyası',tone:'#899eae',threshold:0,opacity:1,scalar:[[-1024,1],[3071,1]],color:[[-1024,0,0,0],[-300,1,1,1],[3071,1,1,1]],gradient:[[0,1],[1000,1]],shade:false,interpolation:1,blend:'minimum',lighting:lighting(1,0,0,1)},
];
export const volumePresetConfig=Object.fromEntries(volumeStyles.map(v=>[v.key,v])) as Record<VolumePreset,Definition>;
export const qualityProfiles={
 performance:{sample:2.4,interaction:5,imageSample:1.8},
 balanced:{sample:1.3,interaction:3.5,imageSample:1.2},
 high:{sample:.85,interaction:3,imageSample:1},
 ultra:{sample:.5,interaction:2.5,imageSample:1},
} as const;
