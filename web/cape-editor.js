!function(){
const W=64,H=32,SCALE=10;
const cvs=$('#ceCvs'),ctx=cvs.getContext('2d');
const gridCvs=$('#ceGrid'),gridCtx=gridCvs.getContext('2d');
const tmplCvs=$('#ceTemplate'),tmplCtx=tmplCvs.getContext('2d');
const wrap=$('#ceCanvasWrap');

/* State */
const CE={
  tool:'pen',color:[255,0,0,255],
  history:[],histIdx:-1,
  drawing:false,lineStart:null,
  selection:null, /* {x,y,w,h} or null */
  selectStart:null,
  layers:[],activeLayer:0
};

/* Template layer regions — standard 64x32 Minecraft cape UV layout */
const CE_LAYERS=[
  {name:'Back (visible)',x:1,y:1,w:10,h:16,color:'#4CAF50',visible:true},
  {name:'Front (inner)',x:12,y:1,w:10,h:16,color:'#2196F3',visible:true},
  {name:'Left Side',x:0,y:1,w:1,h:16,color:'#FF9800',visible:true},
  {name:'Right Side',x:11,y:1,w:1,h:16,color:'#FF9800',visible:true},
  {name:'Top Edge',x:1,y:0,w:10,h:1,color:'#9C27B0',visible:true},
  {name:'Bottom Edge',x:11,y:0,w:10,h:1,color:'#E91E63',visible:true},
  {name:'Elytra Left',x:34,y:2,w:10,h:20,color:'#00BCD4',visible:true},
  {name:'Elytra Right',x:46,y:2,w:10,h:20,color:'#00BCD4',visible:true}
];

/* Init canvas */
ctx.imageSmoothingEnabled=false;
ceSnapshot();

/* ─── Get actual canvas display size ─── */
function ceGetSize(){
  const r=tmplCvs.getBoundingClientRect();
  return{w:r.width,h:r.height}
}

/* ─── Grid ─── */
function ceDrawGrid(){
  const {w:dw,h:dh}=ceGetSize();
  if(dw<1)return;/* page not visible yet */
  gridCvs.width=dw;gridCvs.height=dh;
  gridCvs.style.width=dw+'px';gridCvs.style.height=dh+'px';
  if(!$('#ceShowGrid').checked){gridCtx.clearRect(0,0,dw,dh);return}
  const pxW=dw/W,pxH=dh/H;
  gridCtx.strokeStyle='rgba(255,255,255,.1)';
  gridCtx.lineWidth=0.5;
  for(let x=0;x<=W;x++){const xp=Math.round(x*pxW)+.5;gridCtx.beginPath();gridCtx.moveTo(xp,0);gridCtx.lineTo(xp,dh);gridCtx.stroke()}
  for(let y=0;y<=H;y++){const yp=Math.round(y*pxH)+.5;gridCtx.beginPath();gridCtx.moveTo(0,yp);gridCtx.lineTo(dw,yp);gridCtx.stroke()}
}

/* ─── Template overlay (uses SkinMC-style template image) ─── */
const CE_TMPL_IMG=new Image();
CE_TMPL_IMG.onload=function(){if($('#page-editor').classList.contains('active'))ceDrawTemplate()};
CE_TMPL_IMG.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAABU0lEQVR4AeyXPYoCQRCFu9wTLBtvvidw77DpgpmpqRgIBiqiZgZiaqqRoPfQ0MhL6A2ktAZaVGbo0ukaCyzxOdNjz5vqr9/8ldz5s9wjcoSzA3J0tmR9h9hDL5wcMU0soxydSjgb4/fcOY5Wf5/ObVtBYbOGnJra0APfD+ofkCb/v9QySYCUOceXIJBw0UHSuo+YJo7XM31eDuC66M2uf928WScoNxsiNdQAgMrgcjpkjU0CghoAWYOW3m4ApAnH9o99GqhKQPmnG5tX0E8VgGC1Ah0MgADUxJIerZOVB344t0Kyi3kdsAQQ0XeWJeDdZv9+vJYAqDagXAeW/r8AYDRl6Z601ra6BPx2IfhWGBOmOgA0uCIhqARAEIqSWgBFpUAMAF0w884iQchSXm+/vxgAfwDtSwOgfYak67MESBPW7m8J0D5D0vVZAqQJv9o/dPwTAAAA///AjVRiAAAABklEQVQDANGS0EFW/m0VAAAAAElFTkSuQmCC';

function ceDrawTemplate(){
  const {w:dw,h:dh}=ceGetSize();
  if(dw<1)return;
  tmplCvs.width=dw;tmplCvs.height=dh;
  tmplCvs.style.width=dw+'px';tmplCvs.style.height=dh+'px';
  tmplCvs.style.visibility=$('#ceShowTemplate').checked?'visible':'hidden';
  if(!$('#ceShowTemplate').checked)return;
  tmplCtx.clearRect(0,0,dw,dh);
  tmplCtx.imageSmoothingEnabled=false;
  tmplCtx.drawImage(CE_TMPL_IMG,0,0,dw,dh)
}

/* ─── Labels overlay ─── */
const labelsCvs=$('#ceLabels'),labelsCtx=labelsCvs.getContext('2d');
function ceDrawLabels(){
  const {w:dw,h:dh}=ceGetSize();
  if(dw<1)return;
  labelsCvs.width=dw;labelsCvs.height=dh;
  labelsCvs.style.width=dw+'px';labelsCvs.style.height=dh+'px';
  labelsCvs.style.display=$('#ceShowLabels').checked?'block':'none';
  if(!$('#ceShowLabels').checked)return;
  const pxW=dw/W,pxH=dh/H;
  const regions=[
    {name:'BACK\n(visible)',x:1,y:1,w:10,h:16},
    {name:'FRONT\n(inner)',x:12,y:1,w:10,h:16},
    {name:'TOP',x:1,y:0,w:10,h:1},
    {name:'BTM',x:11,y:0,w:10,h:1},
    {name:'L',x:0,y:1,w:1,h:16},
    {name:'R',x:11,y:1,w:1,h:16},
    {name:'ELYTRA',x:34,y:2,w:10,h:20}
  ];
  labelsCtx.textAlign='center';labelsCtx.textBaseline='middle';
  regions.forEach(r=>{
    const cx=r.x*pxW+r.w*pxW/2,cy=r.y*pxH+r.h*pxH/2;
    const fontSize=Math.max(8,Math.min(r.w*pxW*.2,r.h*pxH*.15));
    labelsCtx.font='bold '+fontSize+'px sans-serif';
    const lines=r.name.split('\n');
    lines.forEach((line,i)=>{
      const ly=cy+(i-(lines.length-1)/2)*fontSize*1.2;
      labelsCtx.fillStyle='rgba(0,0,0,.5)';labelsCtx.fillText(line,cx+1,ly+1);
      labelsCtx.fillStyle='#fff';labelsCtx.fillText(line,cx,ly)
    })
  })
}
$('#ceShowLabels').addEventListener('change',ceDrawLabels);

/* ─── Drawing Layer System ─── */
function ceCreateLayer(name){
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const lctx=c.getContext('2d');lctx.imageSmoothingEnabled=false;
  return{name:name||('Layer '+(CE.layers.length+1)),canvas:c,ctx:lctx,visible:true}
}
function ceGetActiveCtx(){return CE.layers[CE.activeLayer].ctx}
/* Composite all visible layers onto main ceCvs */
function ceComposite(){
  ctx.clearRect(0,0,W,H);
  for(const l of CE.layers){
    if(!l.visible)continue;
    ctx.drawImage(l.canvas,0,0)
  }
  if(typeof ce3dUpdateTexture==='function')ce3dUpdateTexture();
  try{if(typeof ceElyUpdateTex==='function')ceElyUpdateTex()}catch(e){}
}
/* Init with one layer */
CE.layers.push(ceCreateLayer('Layer 1'));

function ceRenderLayerUI(){
  const el=$('#ceLayerList');el.innerHTML='';
  CE.layers.forEach((l,i)=>{
    const d=document.createElement('div');d.className='ce-lyr'+(i===CE.activeLayer?' active':'');
    d.innerHTML=`<input type="checkbox" ${l.visible?'checked':''} data-li="${i}"><span class="ce-lyr-name">${l.name}</span>`;
    d.querySelector('input').addEventListener('change',e=>{e.stopPropagation();l.visible=e.target.checked;ceComposite()});
    d.addEventListener('click',e=>{if(e.target.type==='checkbox')return;CE.activeLayer=i;ceRenderLayerUI()});
    el.appendChild(d)
  })
}
$('#ceLayerAdd').addEventListener('click',()=>{
  CE.layers.push(ceCreateLayer());CE.activeLayer=CE.layers.length-1;ceRenderLayerUI()
});
$('#ceLayerDel').addEventListener('click',()=>{
  if(CE.layers.length<=1)return;
  CE.layers.splice(CE.activeLayer,1);
  CE.activeLayer=Math.min(CE.activeLayer,CE.layers.length-1);
  ceComposite();ceRenderLayerUI();ceSnapshot()
});
$('#ceLayerUp').addEventListener('click',()=>{
  if(CE.activeLayer<=0)return;
  const i=CE.activeLayer;[CE.layers[i-1],CE.layers[i]]=[CE.layers[i],CE.layers[i-1]];
  CE.activeLayer--;ceComposite();ceRenderLayerUI()
});
$('#ceLayerDown').addEventListener('click',()=>{
  if(CE.activeLayer>=CE.layers.length-1)return;
  const i=CE.activeLayer;[CE.layers[i+1],CE.layers[i]]=[CE.layers[i],CE.layers[i+1]];
  CE.activeLayer++;ceComposite();ceRenderLayerUI()
});

/* ─── Selection ─── */
const selCvs=$('#ceSelectCvs'),selCtx=selCvs.getContext('2d');
let ceSelAnimId=null,ceSelDash=0;
function ceDrawSelection(){
  const {w:dw,h:dh}=ceGetSize();
  if(dw<1)return;
  selCvs.width=dw;selCvs.height=dh;
  selCvs.style.width=dw+'px';selCvs.style.height=dh+'px';
  selCtx.clearRect(0,0,dw,dh);
  if(!CE.selection)return;
  const s=CE.selection,pxW=dw/W,pxH=dh/H;
  const sx=s.x*pxW,sy=s.y*pxH,sw=s.w*pxW,sh=s.h*pxH;
  selCtx.strokeStyle='#fff';selCtx.lineWidth=1;
  selCtx.setLineDash([4,4]);selCtx.lineDashOffset=-ceSelDash;
  selCtx.strokeRect(sx,sy,sw,sh);
  selCtx.strokeStyle='#000';selCtx.lineDashOffset=-(ceSelDash+4);
  selCtx.strokeRect(sx,sy,sw,sh);
  selCtx.setLineDash([])
}
function ceAnimateSelection(){
  ceSelDash=(ceSelDash+0.3)%8;ceDrawSelection();
  ceSelAnimId=requestAnimationFrame(ceAnimateSelection)
}
function ceClearSelection(){CE.selection=null;ceDrawSelection();if(ceSelAnimId){cancelAnimationFrame(ceSelAnimId);ceSelAnimId=null}}
function ceInSelection(x,y){
  if(!CE.selection)return true;
  const s=CE.selection;
  return x>=s.x&&x<s.x+s.w&&y>=s.y&&y<s.y+s.h
}

/* ─── Gradient ─── */
function ceApplyGradient(x0,y0,x1,y1){
  if(!CE.selection)return;
  const s=CE.selection;
  const hex2=$('#ceColor2').value;
  const r2=parseInt(hex2.slice(1,3),16),g2=parseInt(hex2.slice(3,5),16),b2=parseInt(hex2.slice(5,7),16);
  const [r1,gg1,b1,a1]=CE.color;
  const lctx=ceGetActiveCtx();
  const dx=x1-x0,dy=y1-y0;
  const len=Math.sqrt(dx*dx+dy*dy);
  if(len<1)return;
  const nx=dx/len,ny=dy/len;
  for(let py=s.y;py<s.y+s.h;py++){
    for(let px=s.x;px<s.x+s.w;px++){
      if(ceTmplMask&&!ceTmplMask[py*W+px])continue;
      const vx=px-x0,vy=py-y0;
      let t=(vx*nx+vy*ny)/len;
      t=Math.max(0,Math.min(1,t));
      const r=Math.round(r1+(r2-r1)*t);
      const g=Math.round(gg1+(g2-gg1)*t);
      const b=Math.round(b1+(b2-b1)*t);
      const id=lctx.createImageData(1,1);
      id.data[0]=r;id.data[1]=g;id.data[2]=b;id.data[3]=a1;
      lctx.putImageData(id,px,py)
    }
  }
  ceComposite()
}

/* ─── History (stores full composite state) ─── */
function ceSnapshot(){
  ceComposite();
  const data=ctx.getImageData(0,0,W,H);
  CE.history=CE.history.slice(0,CE.histIdx+1);
  CE.history.push({composite:data,layerData:CE.layers.map(l=>l.ctx.getImageData(0,0,W,H))});
  CE.histIdx=CE.history.length-1;
  if(CE.history.length>50){CE.history.shift();CE.histIdx--}
}
function ceUndo(){
  if(CE.histIdx>0){CE.histIdx--;
    const h=CE.history[CE.histIdx];
    ctx.putImageData(h.composite,0,0);
    h.layerData.forEach((d,i)=>{if(CE.layers[i])CE.layers[i].ctx.putImageData(d,0,0)});
    if(typeof ce3dUpdateTexture==='function')ce3dUpdateTexture()
  }
}
function ceRedo(){
  if(CE.histIdx<CE.history.length-1){CE.histIdx++;
    const h=CE.history[CE.histIdx];
    ctx.putImageData(h.composite,0,0);
    h.layerData.forEach((d,i)=>{if(CE.layers[i])CE.layers[i].ctx.putImageData(d,0,0)});
    if(typeof ce3dUpdateTexture==='function')ce3dUpdateTexture()
  }
}
$('#ceUndo').addEventListener('click',ceUndo);
$('#ceRedo').addEventListener('click',ceRedo);
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();ceUndo()}
  if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();ceRedo()}
  if(e.key==='Escape')ceClearSelection()
});

/* ─── Pixel coords from mouse ─── */
function ceGetPixel(e){
  const rect=tmplCvs.getBoundingClientRect();
  const x=Math.floor((e.clientX-rect.left)/rect.width*W);
  const y=Math.floor((e.clientY-rect.top)/rect.height*H);
  return[Math.max(0,Math.min(W-1,x)),Math.max(0,Math.min(H-1,y))]
}

/* ─── Drawing (draws on active layer, composites to main) ─── */
function ceSetPixel(x,y){
  if(x<0||x>=W||y<0||y>=H)return;
  if(!ceInSelection(x,y))return;
  const lctx=ceGetActiveCtx();
  const [r,g,b,a]=CE.color;
  const id=lctx.createImageData(1,1);
  id.data[0]=r;id.data[1]=g;id.data[2]=b;id.data[3]=a;
  lctx.putImageData(id,x,y);ceComposite()
}
function ceErasePixel(x,y){
  if(x<0||x>=W||y<0||y>=H)return;
  if(!ceInSelection(x,y))return;
  ceGetActiveCtx().clearRect(x,y,1,1);ceComposite()
}

/* Build a mask from the template image: true = inside a cape region */
let ceTmplMask=null;
function ceBuildTmplMask(){
  const tc=document.createElement('canvas');tc.width=W;tc.height=H;
  const tctx=tc.getContext('2d');
  tctx.drawImage(CE_TMPL_IMG,0,0,W,H);
  const td=tctx.getImageData(0,0,W,H).data;
  ceTmplMask=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){if(td[i*4+3]>10)ceTmplMask[i]=1}
}
CE_TMPL_IMG.addEventListener('load',ceBuildTmplMask);
if(CE_TMPL_IMG.complete)ceBuildTmplMask();

function ceFill(sx,sy){
  if(ceTmplMask&&!ceTmplMask[sy*W+sx])return;
  if(!ceInSelection(sx,sy))return;
  const lctx=ceGetActiveCtx();
  const imgData=lctx.getImageData(0,0,W,H);
  const d=imgData.data;
  const ti=(sy*W+sx)*4;
  const tr=d[ti],tg=d[ti+1],tb=d[ti+2],ta=d[ti+3];
  const [fr,fg,fb,fa]=CE.color;
  if(tr===fr&&tg===fg&&tb===fb&&ta===fa)return;
  const stack=[[sx,sy]];
  const visited=new Set();
  while(stack.length){
    const[x,y]=stack.pop();
    if(x<0||x>=W||y<0||y>=H)continue;
    if(ceTmplMask&&!ceTmplMask[y*W+x])continue;
    if(!ceInSelection(x,y))continue;
    const k=y*W+x;if(visited.has(k))continue;visited.add(k);
    const i=k*4;
    if(d[i]!==tr||d[i+1]!==tg||d[i+2]!==tb||d[i+3]!==ta)continue;
    d[i]=fr;d[i+1]=fg;d[i+2]=fb;d[i+3]=fa;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
  }
  lctx.putImageData(imgData,0,0);ceComposite()
}

function ceLine(x0,y0,x1,y1){
  const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0);
  const sx=x0<x1?1:-1,sy2=y0<y1?1:-1;
  let err=dx-dy;
  while(true){
    if(CE.tool==='eraser')ceErasePixel(x0,y0);else ceSetPixel(x0,y0);
    if(x0===x1&&y0===y1)break;
    const e2=2*err;
    if(e2>-dy){err-=dy;x0+=sx}
    if(e2<dx){err+=dx;y0+=sy2}
  }
}

/* Mouse/touch handlers */
wrap.addEventListener('contextmenu',e=>e.preventDefault());
wrap.addEventListener('pointerdown',e=>{
  e.preventDefault();
  const[x,y]=ceGetPixel(e);
  CE.drawing=true;
  CE.rightClick=e.button===2;
  if(CE.rightClick){ceErasePixel(x,y);return}
  if(CE.tool==='select'){CE.selectStart=[x,y];CE.selection={x,y,w:1,h:1};ceDrawSelection();if(!ceSelAnimId)ceAnimateSelection();return}
  if(CE.tool==='gradient'){CE.selectStart=[x,y];CE.gradientEnd=[x,y];return}
  if(CE.tool==='pen')ceSetPixel(x,y);
  else if(CE.tool==='eraser')ceErasePixel(x,y);
  else if(CE.tool==='fill'){ceFill(x,y);ceSnapshot()}
  else if(CE.tool==='replace'){ceHueReplace(x,y);ceSnapshot()}
  else if(CE.tool==='picker'){
    const p=ctx.getImageData(x,y,1,1).data;
    CE.color=[p[0],p[1],p[2],p[3]];
    const hex='#'+[p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    $('#ceColor').value=hex;
    ceUpdatePalette(hex)
  }
  else if(CE.tool==='line'){CE.lineStart=[x,y]}
});
wrap.addEventListener('pointermove',e=>{
  if(!CE.drawing)return;
  const[x,y]=ceGetPixel(e);
  if(CE.rightClick){ceErasePixel(x,y);return}
  if(CE.tool==='select'&&CE.selectStart){
    const sx=Math.min(CE.selectStart[0],x),sy=Math.min(CE.selectStart[1],y);
    const ex=Math.max(CE.selectStart[0],x),ey=Math.max(CE.selectStart[1],y);
    CE.selection={x:sx,y:sy,w:ex-sx+1,h:ey-sy+1};ceDrawSelection();return
  }
  if(CE.tool==='gradient'&&CE.selectStart){
    CE.gradientEnd=[x,y];
    const sx=Math.min(CE.selectStart[0],x),sy=Math.min(CE.selectStart[1],y);
    const ex=Math.max(CE.selectStart[0],x),ey=Math.max(CE.selectStart[1],y);
    CE.selection={x:sx,y:sy,w:ex-sx+1,h:ey-sy+1};
    ceDrawSelection();if(!ceSelAnimId)ceAnimateSelection();
    return
  }
  if(CE.tool==='pen')ceSetPixel(x,y);
  else if(CE.tool==='eraser')ceErasePixel(x,y)
});
wrap.addEventListener('pointerup',e=>{
  if(!CE.drawing)return;CE.drawing=false;
  if(CE.tool==='select'){CE.selectStart=null;return}
  if(CE.tool==='gradient'&&CE.selectStart){
    const[x,y]=ceGetPixel(e);
    const sx=Math.min(CE.selectStart[0],x),sy=Math.min(CE.selectStart[1],y);
    const ex=Math.max(CE.selectStart[0],x),ey=Math.max(CE.selectStart[1],y);
    if(ex>sx&&ey>sy){
      CE.selection={x:sx,y:sy,w:ex-sx+1,h:ey-sy+1};
      ceApplyGradient(CE.selectStart[0],CE.selectStart[1],x,y);
      CE.selection=null
    }
    CE.selectStart=null;ceSnapshot();ceDrawSelection();return
  }
  if(CE.tool==='line'&&CE.lineStart){
    const[x,y]=ceGetPixel(e);ceLine(CE.lineStart[0],CE.lineStart[1],x,y);CE.lineStart=null
  }
  if(CE.tool!=='fill'&&CE.tool!=='picker'&&CE.tool!=='replace')ceSnapshot()
});
wrap.addEventListener('pointerleave',()=>{
  if(CE.drawing&&CE.tool!=='line'&&CE.tool!=='select'&&CE.tool!=='gradient'){CE.drawing=false;ceSnapshot()}
});

/* Tool buttons */
$$('.ce-tool-btn').forEach(b=>b.addEventListener('click',()=>{
  $$('.ce-tool-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');CE.tool=b.dataset.tool
}));

/* Color picker + palette */
function ceHexToHSL(hex){
  let r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0,s=0,l=(max+min)/2;
  if(d>0){s=l>0.5?d/(2-max-min):d/(max+min);
    if(max===r)h=((g-b)/d+(g<b?6:0))/6;
    else if(max===g)h=((b-r)/d+2)/6;
    else h=((r-g)/d+4)/6}
  return[h*360,s*100,l*100]
}
function ceHSLToHex(h,s,l){
  s/=100;l/=100;
  const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(Math.min(k-3,9-k,1),-1)))};
  return'#'+[f(0),f(8),f(4)].map(v=>v.toString(16).padStart(2,'0')).join('')
}
function ceUpdatePalette(hex){
  const pal=$('#cePalette');pal.innerHTML='';
  const[h,s,l]=ceHexToHSL(hex);
  const shades=[
    ceHSLToHex(h,Math.min(100,s+15),Math.max(0,l-45)),
    ceHSLToHex(h,Math.min(100,s+10),Math.max(0,l-30)),
    ceHSLToHex(h,Math.min(100,s+5),Math.max(0,l-15)),
    hex,
    ceHSLToHex(h,Math.max(0,s-5),Math.min(100,l+15)),
    ceHSLToHex(h,Math.max(0,s-10),Math.min(100,l+30)),
    ceHSLToHex(h,Math.max(0,s-15),Math.min(100,l+45))
  ];
  shades.forEach((c,i)=>{
    const sw=document.createElement('div');sw.className='ce-pal-swatch'+(i===3?' active':'');
    sw.style.background=c;sw.title=c;
    sw.addEventListener('click',()=>{
      $$('.ce-pal-swatch').forEach(s=>s.classList.remove('active'));sw.classList.add('active');
      $('#ceColor').value=c;
      const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);
      CE.color=[r,g,b,CE.color[3]]
    });
    pal.appendChild(sw)
  })
}
ceUpdatePalette('#FF0000');

$('#ceColor').addEventListener('input',e=>{
  const hex=e.target.value;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  CE.color=[r,g,b,CE.color[3]];
  ceUpdatePalette(hex)
});

/* Opacity slider (1-50 mapped to 5-255) */
$('#ceAlpha').addEventListener('input',e=>{
  const v=parseInt(e.target.value);
  const a=Math.round(v/50*255);
  CE.color[3]=a;$('#ceAlphaVal').textContent=v
});

/* ─── Color-aware Replace (hue shift) ─── */
function ceRgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
  let h=0,s=0,l=(mx+mn)/2;
  if(d>0){s=l>0.5?d/(2-mx-mn):d/(mx+mn);
    if(mx===r)h=((g-b)/d+(g<b?6:0))/6;
    else if(mx===g)h=((b-r)/d+2)/6;
    else h=((r-g)/d+4)/6}
  return[h,s,l]
}
function ceHslToRgb(h,s,l){
  if(s===0)return[Math.round(l*255),Math.round(l*255),Math.round(l*255)];
  const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};
  const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
  return[Math.round(hue2rgb(p,q,h+1/3)*255),Math.round(hue2rgb(p,q,h)*255),Math.round(hue2rgb(p,q,h-1/3)*255)]
}
function ceHueReplace(sx,sy){
  if(ceTmplMask&&!ceTmplMask[sy*W+sx])return;
  const lctx=ceGetActiveCtx();
  const imgData=lctx.getImageData(0,0,W,H);
  const d=imgData.data;
  const ti=(sy*W+sx)*4;
  const tR=d[ti],tG=d[ti+1],tB=d[ti+2],tA=d[ti+3];
  const [fr,fg,fb,fa]=CE.color;
  const tHSL=ceRgbToHsl(tR,tG,tB),nHSL=ceRgbToHsl(fr,fg,fb);
  const hShift=nHSL[0]-tHSL[0];
  const sNudge=(nHSL[1]-tHSL[1])*0.3;
  const lNudge=(nHSL[2]-tHSL[2])*0.3;
  const tol=40;
  function close(i){return Math.abs(d[i]-tR)<tol&&Math.abs(d[i+1]-tG)<tol&&Math.abs(d[i+2]-tB)<tol&&Math.abs(d[i+3]-tA)<tol}
  const stack=[[sx,sy]];
  const visited=new Uint8Array(W*H);
  while(stack.length){
    const[x,y]=stack.pop();
    if(x<0||x>=W||y<0||y>=H)continue;
    if(ceTmplMask&&!ceTmplMask[y*W+x])continue;
    const idx=y*W+x;if(visited[idx])continue;
    const i=idx*4;if(!close(i))continue;
    visited[idx]=1;
    const hsl=ceRgbToHsl(d[i],d[i+1],d[i+2]);
    hsl[0]=(hsl[0]+hShift+1)%1;
    hsl[1]=Math.max(0,Math.min(1,hsl[1]+sNudge));
    hsl[2]=Math.max(0,Math.min(1,hsl[2]+lNudge));
    const rgb=ceHslToRgb(hsl[0],hsl[1],hsl[2]);
    d[i]=rgb[0];d[i+1]=rgb[1];d[i+2]=rgb[2];
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
  }
  lctx.putImageData(imgData,0,0);ceComposite()
}

/* Grid/template toggles */
$('#ceShowGrid').addEventListener('change',ceDrawGrid);
$('#ceShowTemplate').addEventListener('change',ceDrawTemplate);

/* Download (flattens all visible layers) */
$('#ceDownload').addEventListener('click',()=>{
  ceComposite();
  const a=document.createElement('a');a.download='custom-cape.png';
  a.href=cvs.toDataURL('image/png');a.click()
});

/* Clear (clears active layer) */
$('#ceClear').addEventListener('click',()=>{ceGetActiveCtx().clearRect(0,0,W,H);ceComposite();ceSnapshot()});

/* Import (imports to active layer) */
$('#ceImport').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=v=>{
    const img=new Image();img.onload=()=>{
      const lctx=ceGetActiveCtx();
      lctx.clearRect(0,0,W,H);lctx.drawImage(img,0,0,W,H);ceComposite();ceSnapshot()
    };img.src=v.target.result
  };r.readAsDataURL(f);e.target.value=''
});

/* Init */
ceRenderLayerUI();
/* Defer grid/template drawing until the page becomes visible */
function ceInitOverlays(){
  requestAnimationFrame(()=>{
    const {w}=ceGetSize();
    if(w<1){setTimeout(ceInitOverlays,100);return}
    ceDrawGrid();ceDrawTemplate();ceDrawLabels()
  })
}
new MutationObserver(()=>{
  if($('#page-editor').classList.contains('active'))ceInitOverlays()
}).observe($('#page-editor'),{attributes:true,attributeFilter:['class']});

/* Resize handler (debounced) */
let ceResizeTimer;
window.addEventListener('resize',()=>{
  clearTimeout(ceResizeTimer);
  ceResizeTimer=setTimeout(()=>{
    if($('#page-editor').classList.contains('active')){ceInitOverlays()}
  },150);
});

/* ─── View Toggle (2D / 3D) ─── */
const ceViewBtns=$$('.ce-view-btn');
const ceView2D=$('#ceView2D'),ceView3D=$('#ceView3D'),ceViewElytra=$('#ceViewElytra');
ceViewBtns.forEach(btn=>btn.addEventListener('click',()=>{
  ceViewBtns.forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const mode=btn.dataset.ceview;
  ceView2D.style.display=mode==='2d'?'':'none';
  ceView3D.style.display=mode==='3d'?'':'none';
  if(ceViewElytra)ceViewElytra.style.display=mode==='elytra'?'':'none';
  if(mode==='3d')ce3dInit();
  if(mode==='elytra'&&typeof ceElyInit==='function')ceElyInit();
  if(mode==='2d'){ceDrawGrid();ceDrawTemplate();ceDrawLabels()}
}));

/* ═══ 3D CAPE PREVIEW ═══ */
var ce3d={inited:false,viewer:null};

function ce3dInit(){
  if(ce3d.inited){ce3dUpdateTexture();return}
  ce3d.inited=true;
  var wrap=document.getElementById('ce3dWrap');
  if(!wrap)return;
  try{
    ce3d.viewer=new skinview3d.SkinViewer({
      canvas:document.createElement('canvas'),
      width:wrap.clientWidth||500,height:Math.max(350,Math.floor((wrap.clientWidth||500)*0.9)),
      skin:'https://minotar.net/skin/Coop6807'
    });
    ce3d.viewer.autoRotate=false;
    ce3d.viewer.camera.position.set(0,10,38);
    ce3d.viewer.animation=new skinview3d.IdleAnimation();
    wrap.innerHTML='';
    wrap.appendChild(ce3d.viewer.canvas);
    ce3dUpdateTexture();
  }catch(e){console.warn('skinview3d cape error:',e)}
  var undoBtn=document.getElementById('ce3dUndo');
  var redoBtn=document.getElementById('ce3dRedo');
  if(undoBtn)undoBtn.addEventListener('click',function(){ceUndo();ce3dUpdateTexture()});
  if(redoBtn)redoBtn.addEventListener('click',function(){ceRedo();ce3dUpdateTexture()});
}
function ce3dUpdateTexture(){
  if(!ce3d||!ce3d.viewer)return;
  try{ce3d.viewer.loadCape(cvs.toDataURL('image/png'),{backEquipment:'cape'})}catch(e){}
}
function ce3dAnimate(){}

/* ═══ 3D ELYTRA VIEWER ═══ */
const ceEly={inited:false,renderer:null,scene:null,camera:null,controls:null,leftWing:null,rightWing:null,playerGroup:null,texture:null,animId:null,raycaster:null,mouse:null,painting:false,rightClick:false};

function ceElyInit(){
  if(ceEly.inited){ceElyUpdateTex();return}
  ceEly.inited=true;
  var wrap=document.getElementById('ce3dElytraWrap');
  if(!wrap)return;
  try{
    ceEly.viewer=new skinview3d.SkinViewer({
      canvas:document.createElement('canvas'),
      width:wrap.clientWidth||400,height:400,
      skin:'https://minotar.net/skin/Coop6807'
    });
    ceEly.viewer.autoRotate=false;
    ceEly.viewer.camera.position.set(0,10,38);
    ceEly.viewer.animation=new skinview3d.IdleAnimation();
    wrap.innerHTML='';
    wrap.appendChild(ceEly.viewer.canvas);
    ceElyUpdateTex();
  }catch(e){console.warn('skinview3d elytra error:',e)}
}

function ceElyUpdateTex(){
  if(!ceEly||!ceEly.viewer)return;
  try{ceEly.viewer.loadCape(cvs.toDataURL('image/png'),{backEquipment:'elytra'})}catch(e){}
}
function ceElyAnimate(){}
/* Update 3D preview whenever the 2D canvas changes */
const ce3dOrigSnapshot=ceSnapshot;
ceSnapshot=function(){
  ce3dOrigSnapshot();
  ce3dUpdateTexture();
  ceElyUpdateTex();
};

}();


/* EZCAPES: Save to Library */
!function(){
var btn=document.getElementById("ceSaveToLib");
if(!btn) return;
btn.addEventListener("click",function(){
var cvs=document.getElementById("ceCvs");
if(!cvs) return;
var ctx=cvs.getContext("2d");
var d=ctx.getImageData(0,0,64,32).data;
var hasContent=false;
for(var i=3;i<d.length;i+=4){if(d[i]>0){hasContent=true;break;}}
if(!hasContent){if(typeof toast==="function")toast("Draw something first!",true);return;}
var dataURL=cvs.toDataURL("image/png");
var name="Cape "+new Date().toLocaleTimeString();
if(typeof saveCapeToLib==="function"){
saveCapeToLib(name,dataURL);
if(typeof renderCapeLibPage==="function") renderCapeLibPage();
if(typeof toast==="function") toast("Saved to cape library!");
}
});
}();

