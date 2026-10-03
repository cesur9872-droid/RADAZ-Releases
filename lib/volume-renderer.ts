import type { getVolumeTexture } from './cornerstone';

export type VolumeData = NonNullable<Awaited<ReturnType<typeof getVolumeTexture>>>;
export type VolumePreset = 'bone' | 'boneVessel' | 'vascular' | 'skin' | 'soft' | 'lung';
export type VolumeStyle = { preset: VolumePreset; threshold: number; opacity: number; rotation: [number, number]; zoom: number; pan: [number, number] };

const vertexSource = `#version 300 es
in vec2 aPosition;
out vec2 uv;
void main() { uv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }`;

const fragmentSource = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
out vec4 fragColor;
uniform sampler3D volume;
uniform vec3 halfBox;
uniform vec3 voxelSize;
uniform vec2 valueRange;
uniform float aspect;
uniform float pitch;
uniform float yaw;
uniform float zoom;
uniform vec2 pan;
uniform float threshold;
uniform float opacity;
uniform float stepLength;
uniform int preset;

vec2 intersectBox(vec3 origin, vec3 ray) {
  vec3 nearSide = (-halfBox - origin) / ray;
  vec3 farSide = (halfBox - origin) / ray;
  vec3 nearPoints = min(nearSide, farSide), farPoints = max(nearSide, farSide);
  return vec2(max(max(nearPoints.x, nearPoints.y), nearPoints.z), min(min(farPoints.x, farPoints.y), farPoints.z));
}

void main() {
  vec2 xy = ((uv * 2. - 1.) * vec2(aspect, 1.) * 1.35 - pan) / zoom;
  float cp = cos(pitch), sp = sin(pitch), cy = cos(yaw), sy = sin(yaw);
  mat3 rx = mat3(1.,0.,0., 0.,cp,sp, 0.,-sp,cp);
  mat3 ry = mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
  mat3 inverseRotation = transpose(ry * rx);
  vec3 origin = inverseRotation * vec3(xy, -1.65);
  vec3 ray = inverseRotation * vec3(0., 0., 1.);
  vec2 crossing = intersectBox(origin, ray);
  float start = max(crossing.x, 0.);
  vec3 background = vec3(.004,.009,.015);
  if (crossing.y <= start) { fragColor = vec4(background,1.); return; }
  vec3 accum = vec3(0.);
  float alpha = 0.;
  for (int i = 0; i < 512; i++) {
    float distance = start + float(i) * stepLength;
    if (distance > crossing.y || alpha > .985) break;
    vec3 at = origin + ray * distance;
    vec3 texcoord = (at / halfBox + 1.) * .5;
    float hu = mix(valueRange.x, valueRange.y, texture(volume, texcoord).r);
    float mask = 0.;
    vec3 tint = vec3(1.);
    if (preset == 0) {
      mask = smoothstep(threshold - 25., threshold + 65., hu);
      tint = mix(vec3(.59,.44,.30),vec3(1.,.89,.72),smoothstep(200.,1250.,hu));
    } else if (preset == 1) {
      float vessel = smoothstep(threshold - 35.,threshold + 55.,hu) * (1. - smoothstep(410.,720.,hu));
      float bone = smoothstep(320.,720.,hu);
      mask = max(vessel * .78, bone);
      tint = mix(vec3(.74,.18,.11),vec3(.96,.84,.64),smoothstep(300.,780.,hu));
    } else if (preset == 2) {
      mask = smoothstep(threshold - 35.,threshold + 60.,hu) * (1. - smoothstep(300.,520.,hu));
      tint = mix(vec3(.70,.08,.055),vec3(1.,.58,.34),smoothstep(120.,390.,hu));
    } else if (preset == 3) {
      mask = smoothstep(threshold - 130.,threshold + 70.,hu);
      tint = mix(vec3(.64,.35,.25),vec3(1.,.82,.66),smoothstep(-420.,120.,hu));
    } else if (preset == 4) {
      mask = smoothstep(threshold - 110.,threshold + 115.,hu) * (1. - smoothstep(480.,1050.,hu));
      tint = mix(vec3(.51,.25,.22),vec3(.96,.68,.52),smoothstep(-80.,340.,hu));
    } else {
      mask = smoothstep(threshold - 170., threshold + 85., hu) * (1. - smoothstep(-450.,-180.,hu));
      tint = mix(vec3(.35,.55,.70),vec3(.80,.92,.95),smoothstep(-870.,-40.,hu));
    }
    if (mask < .012) continue;
    vec3 gradient = vec3(
      texture(volume,texcoord+vec3(voxelSize.x,0.,0.)).r-texture(volume,texcoord-vec3(voxelSize.x,0.,0.)).r,
      texture(volume,texcoord+vec3(0.,voxelSize.y,0.)).r-texture(volume,texcoord-vec3(0.,voxelSize.y,0.)).r,
      texture(volume,texcoord+vec3(0.,0.,voxelSize.z)).r-texture(volume,texcoord-vec3(0.,0.,voxelSize.z)).r);
    float edge = smoothstep(.008,.07,length(gradient));
    vec3 normal = normalize(gradient + vec3(.00001));
    vec3 lightDirection = normalize(vec3(.45,-.35,.82));
    float diffuse = abs(dot(normal,lightDirection));
    float rim = pow(1. - abs(dot(normal,ray)),2.);
    float specular = pow(max(dot(reflect(-lightDirection,normal),-ray),0.),22.);
    float light = mix(.72, .42 + .51*diffuse + .16*rim + .28*specular,edge);
    float density = preset == 0 ? .20 : preset == 1 ? .16 : preset == 3 ? .18 : preset == 5 ? .09 : .12;
    float contribution = preset == 0 ? clamp(mask * opacity * .65,0.,.88) : preset == 3 ? clamp(mask * opacity * .38,0.,.72) : clamp(1. - exp(-mask * opacity * density * stepLength * 180.),0.,.34);
    accum += (1. - alpha) * contribution * tint * light * (preset == 0 ? 1.12 : preset == 2 ? 1.15 : 1.) * exp(-.12*(distance-start));
    alpha += (1. - alpha) * contribution;
  }
  fragColor = vec4(pow(accum + background*(1.-alpha),vec3(.88)),1.);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader yaradıla bilmədi');
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || '3D shader xətası');
  return shader;
}

/** Browser CPU ray marcher for devices and remote browsers without WebGL2. */
function createCanvasVolumeRenderer(canvas: HTMLCanvasElement, volume: VolumeData) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Bu brauzerdə 3D həcm üçün 2D canvas da əlçatan deyil');
  const { data, width, height, slices, range, size } = volume;
  const largest = Math.max(...size);
  const half: [number,number,number] = [size[0]/largest/2,size[1]/largest/2,size[2]/largest/2];
  const lookup = (x: number, y: number, z: number) => {
    const sx = Math.max(0,Math.min(width-1,Math.floor((x/half[0]+1)*width*.5)));
    const sy = Math.max(0,Math.min(height-1,Math.floor((y/half[1]+1)*height*.5)));
    const zPosition = Math.max(0,Math.min(slices-1,(z/half[2]+1)*slices*.5-.5));
    const lower = Math.floor(zPosition), upper = Math.min(slices-1,lower+1), blend = zPosition-lower;
    const pixel = sy*width+sx, plane = width*height;
    const value = data[lower*plane+pixel]*(1-blend)+data[upper*plane+pixel]*blend;
    return range[0] + value*(range[1]-range[0])/255;
  };
  return {
    draw(style: VolumeStyle, displayWidth: number, displayHeight: number, quality: 'interactive' | 'final' = 'final') {
      const factor=Math.min(1,(quality==='final'?640:320)/Math.max(displayWidth,displayHeight));
      const w=Math.max(1,Math.round(displayWidth*factor)), h=Math.max(1,Math.round(displayHeight*factor));
      if (canvas.width!==w || canvas.height!==h) {canvas.width=w;canvas.height=h;}
      const image=ctx.createImageData(w,h), pixels=image.data;
      const cp=Math.cos(style.rotation[0]), sp=Math.sin(style.rotation[0]);
      const cy=Math.cos(style.rotation[1]), sy=Math.sin(style.rotation[1]);
      const rotate=(x:number,y:number,z:number):[number,number,number]=>{
        const ax=cy*x-sy*z, az=sy*x+cy*z;
        return [ax, cp*y+sp*az,-sp*y+cp*az];
      };
      const direction=rotate(0,0,1);
      const aspect=w/h, step=quality==='final'?.0085:.014;
      for(let py=0;py<h;py++) for(let px=0;px<w;px++) {
        const screenX=(((px+.5)/w*2-1)*aspect*1.35-style.pan[0])/style.zoom;
        const screenY=(((py+.5)/h*2-1)*1.35-style.pan[1])/style.zoom;
        const origin=rotate(screenX,screenY,-1.65);
        let near=0,far=5;
        for(let axis=0;axis<3;axis++) {
          if(Math.abs(direction[axis])<1e-6) { if(Math.abs(origin[axis])>half[axis]) {far=-1; break;} continue; }
          const first=(-half[axis]-origin[axis])/direction[axis], second=(half[axis]-origin[axis])/direction[axis];
          near=Math.max(near,Math.min(first,second)); far=Math.min(far,Math.max(first,second));
        }
        const at=(py*w+px)*4;
        if(far<=near) {pixels[at]=2;pixels[at+1]=4;pixels[at+2]=6;pixels[at+3]=255;continue;}
        let red=0,green=0,blue=0,alpha=0;
        for(let t=near;t<far && alpha<.982;t+=step) {
          const x=origin[0]+direction[0]*t, y=origin[1]+direction[1]*t, z=origin[2]+direction[2]*t;
          const hu=lookup(x,y,z);
          let mask=0,r=1,g=1,b=1;
          if(style.preset==='bone') {
            mask=Math.max(0,Math.min(1,(hu-style.threshold+25)/90));
            const tone=Math.max(0,Math.min(1,(hu-200)/1050));r=.59+.41*tone;g=.44+.45*tone;b=.30+.42*tone;
          } else if(style.preset==='boneVessel') {
            const vessel=Math.max(0,Math.min(1,(hu-style.threshold+35)/90))*(1-Math.max(0,Math.min(1,(hu-410)/310)));
            const bone=Math.max(0,Math.min(1,(hu-320)/400));mask=Math.max(vessel*.78,bone);
            const tone=Math.max(0,Math.min(1,(hu-300)/480));r=.74+.22*tone;g=.18+.66*tone;b=.11+.53*tone;
          } else if(style.preset==='vascular') {
            mask=Math.max(0,Math.min(1,(hu-style.threshold+35)/95))*(1-Math.max(0,Math.min(1,(hu-300)/220)));
            const tone=Math.max(0,Math.min(1,(hu-120)/270));r=.70+.30*tone;g=.08+.50*tone;b=.055+.285*tone;
          } else if(style.preset==='skin') {
            mask=Math.max(0,Math.min(1,(hu-style.threshold+130)/200));
            const tone=Math.max(0,Math.min(1,(hu+420)/540));r=.64+.36*tone;g=.35+.47*tone;b=.25+.41*tone;
          } else if(style.preset==='lung') {
            mask=Math.max(0,Math.min(1,(hu-style.threshold+170)/255))*(1-Math.max(0,Math.min(1,(hu+450)/270)));
            const tone=Math.max(0,Math.min(1,(hu+870)/830));r=.35+.45*tone;g=.55+.37*tone;b=.70+.25*tone;
          } else {
            mask=Math.max(0,Math.min(1,(hu-style.threshold+110)/225))*(1-Math.max(0,Math.min(1,(hu-480)/570)));
            const tone=Math.max(0,Math.min(1,(hu+80)/420));r=.51+.45*tone;g=.25+.43*tone;b=.22+.30*tone;
          }
          if(mask<.012)continue;
          // Shade the sampled isosurface from its local intensity gradient.
          const dx=half[0]*2/width,dy=half[1]*2/height,dz=half[2]*2/slices;
          const gx=lookup(x+dx,y,z)-lookup(x-dx,y,z),gy=lookup(x,y+dy,z)-lookup(x,y-dy,z),gz=lookup(x,y,z+dz)-lookup(x,y,z-dz);
          const length=Math.hypot(gx,gy,gz)||1, edge=Math.min(1,length/240);
          const nx=gx/length,ny=gy/length,nz=gz/length;
          const dotLight=nx*.45-ny*.35+nz*.82, dotRay=nx*direction[0]+ny*direction[1]+nz*direction[2];
          const rim=(1-Math.abs(dotRay))**2;
          const reflected=Math.max(0,.45*direction[0]-.35*direction[1]+.82*direction[2]-2*dotLight*dotRay);
          const light=.72*(1-edge)+edge*(.42+.51*Math.abs(dotLight)+.16*rim+.28*reflected**22);
          const density=style.preset==='bone'?.20:style.preset==='boneVessel'?.16:style.preset==='skin'?.18:style.preset==='lung'?.09:.12;
          const contribution=style.preset==='bone'?Math.min(.88,mask*style.opacity*.65):style.preset==='skin'?Math.min(.72,mask*style.opacity*.38):Math.min(.34,1-Math.exp(-mask*style.opacity*density*step*180));
          const weight=(1-alpha)*contribution*light*(style.preset==='bone'?1.12:style.preset==='vascular'?1.15:1)*Math.exp(-.12*(t-near));
          red+=weight*r;green+=weight*g;blue+=weight*b;
          alpha+=(1-alpha)*contribution;
        }
        pixels[at]=Math.min(255,Math.round(Math.pow(red+.004*(1-alpha),.88)*255));
        pixels[at+1]=Math.min(255,Math.round(Math.pow(green+.009*(1-alpha),.88)*255));
        pixels[at+2]=Math.min(255,Math.round(Math.pow(blue+.015*(1-alpha),.88)*255));
        pixels[at+3]=255;
      }
      ctx.putImageData(image,0,0);
    },
    dispose() { /* Pixel buffers are released when the canvas is detached. */ },
  };
}

export function createVolumeRenderer(canvas: HTMLCanvasElement, data: VolumeData) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return createCanvasVolumeRenderer(canvas,data);
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource), fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('3D render proqramı yaradıla bilmədi');
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || '3D render xətası');
  const vao = gl.createVertexArray(), buffer = gl.createBuffer(), texture = gl.createTexture();
  if (!vao || !buffer || !texture) throw new Error('3D həcm yaddaşı yaradıla bilmədi');
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
  gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,data.width,data.height,data.slices,0,gl.RED,gl.UNSIGNED_BYTE,data.data);
  gl.useProgram(program); gl.uniform1i(gl.getUniformLocation(program,'volume'),0);
  const maximum = Math.max(...data.size);
  gl.uniform3f(gl.getUniformLocation(program,'halfBox'),...data.size.map(size => Math.max(.001,size / maximum / 2)) as [number,number,number]);
  gl.uniform3f(gl.getUniformLocation(program,'voxelSize'),1/data.width,1/data.height,1/data.slices);
  gl.uniform2f(gl.getUniformLocation(program,'valueRange'),...data.range);
  const scalar = (name: string, value: number) => gl.uniform1f(gl.getUniformLocation(program,name),value);
  return {
    draw(style: VolumeStyle, width: number, height: number, quality: 'interactive' | 'final' = 'final') {
      if (gl.isContextLost()) return;
      const scale = Math.min(1.5,window.devicePixelRatio || 1,(quality==='final'?1050:620)/Math.max(width,height));
      const canvasWidth = Math.max(1,Math.round(width * scale)), canvasHeight = Math.max(1,Math.round(height * scale));
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) { canvas.width=canvasWidth; canvas.height=canvasHeight; }
      gl.viewport(0,0,canvasWidth,canvasHeight); gl.useProgram(program); gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D,texture);
      scalar('aspect',canvasWidth/canvasHeight); scalar('pitch',style.rotation[0]); scalar('yaw',style.rotation[1]);
      scalar('zoom',style.zoom); scalar('threshold',style.threshold); scalar('opacity',style.opacity);
      gl.uniform2f(gl.getUniformLocation(program,'pan'),style.pan[0],style.pan[1]);
      scalar('stepLength',quality==='final'?1/280:1/165);
      gl.uniform1i(gl.getUniformLocation(program,'preset'),(['bone','boneVessel','vascular','skin','soft','lung'] as const).indexOf(style.preset));
      gl.drawArrays(gl.TRIANGLES,0,6);
    },
    dispose() { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); },
  };
}
