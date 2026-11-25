(() => {
  'use strict';
  const T = window.THREE;
  if (!T) { document.body.innerHTML = '<p style="padding:2rem;color:white">Não foi possível carregar o motor 3D.</p>'; return; }
  const canvas = document.getElementById('scene');
  const scene = new T.Scene(); scene.background = new T.Color('#263640'); scene.fog = new T.Fog('#263640', 24, 58);
  const camera = new T.PerspectiveCamera(37, 1, .1, 100); camera.position.set(13, 11, 16); camera.lookAt(0, 1.8, 0);
  const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
  const mat=(color,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const M={steel:mat('#9eabb0',.42,.68),edge:mat('#64747a',.46,.65),dark:mat('#25333a',.6,.3),belt:mat('#293b3b',.82,.05),roller:mat('#aeb8ba',.36,.7),yellow:mat('#edb637',.46,.3),blue:mat('#256b9b',.42,.45),floor:mat('#7a8585',.88),wall:mat('#39494e',.95),white:mat('#d8d5c8',.8),box1:mat('#bf8855',.88),box2:mat('#d0a16b',.9),box3:mat('#b97745',.9),black:mat('#182226',.4,.1),red:mat('#f04848',.25),green:mat('#86d45c',.27)};
  scene.add(new T.HemisphereLight('#d8e5ec','#3c4342',2.0));
  const key=new T.DirectionalLight('#fff0d5',3.2); key.position.set(-8,16,9); key.castShadow=true; key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-18;key.shadow.camera.right=18;key.shadow.camera.top=18;key.shadow.camera.bottom=-18;scene.add(key);
  const fill=new T.DirectionalLight('#a7d8ff',1.2);fill.position.set(7,10,-10);scene.add(fill);
  function box(parent,w,h,d,material,x,y,z,cast=true){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=cast;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function cyl(parent,r1,r2,len,material,x,y,z,axis='x'){const mesh=new T.Mesh(new T.CylinderGeometry(r1,r2,len,12),material);if(axis==='x')mesh.rotation.z=Math.PI/2;mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
  // Factory floor, simple walls and a floor grid establish scale and depth.
  box(scene,42,.25,34,M.floor,0,-.22,0,false);
  const grid=new T.GridHelper(40,40,'#aab2aa','#687677');grid.position.y=-.08;grid.material.transparent=true;grid.material.opacity=.24;scene.add(grid);
  box(scene,42,10,.25,M.wall,0,4.8,-8,false);box(scene,.25,10,34,M.wall,-14,4.8,0,false);
  for(let x=-12;x<14;x+=4){box(scene,.18,.2,16,M.steel,x,9.1,-1,false);box(scene,.18,9,.18,M.steel,x,4.5,-7.8,false);}
  // Reusable conveyor module. Main belt direction is along X; branches can be rotated.
  function conveyor({name,x,z,y,len,width,angle=0,rollers=14,guard=false}){
    const g=new T.Group();g.position.set(x,y,z);g.rotation.y=angle;scene.add(g);
    box(g,len,.22,width,M.edge,0,0,0);box(g,len-.12,.12,width-.12,M.belt,0,.17,0);
    for(let i=0;i<=rollers;i++){let px=-len/2+.12+i*(len-.24)/rollers;cyl(g,.075,.075,width-.08,M.roller,px,.08,0,'z');}
    for(const side of [-1,1]){box(g,len,.13,.09,M.steel,0,.3,side*(width/2-.045));box(g,len,.22,.06,M.yellow,0,.43,side*(width/2+.025));
      for(let xx=-len/2+.35;xx<len/2;xx+=2.1){box(g,.1,.72,.1,M.steel,xx,-.48,side*(width/2-.1));box(g,.34,.08,.32,M.dark,xx,-.84,side*(width/2-.1));}}
    // Drive roller and geared motor at the tail.
    cyl(g,.16,.16,width+.08,M.dark,-len/2+.02,.13,0,'z');cyl(g,.16,.16,width+.08,M.dark,len/2-.02,.13,0,'z');
    const motor=box(g,.48,.37,.42,M.blue,-len/2+.28,-.22,width/2+.37);cyl(g,.19,.19,.28,M.blue,-len/2+.28,-.22,width/2+.7,'z');
    if(guard){for(const xx of [-len/2+.3,len/2-.3])box(g,.08,.56,.08,M.yellow,xx,.73,width/2+.04);}
    g.userData={name,len,width,y};return g;
  }
  const belts=[];
  belts.push(conveyor({name:'Esteira 1',x:-6.6,z:2.2,y:.9,len:5.6,width:1.35,rollers:18}));
  belts.push(conveyor({name:'Esteira 2',x:-1.1,z:2.2,y:.9,len:5.5,width:1.35,rollers:17}));
  belts.push(conveyor({name:'Esteira 3',x:4.35,z:2.2,y:.9,len:5.4,width:1.35,rollers:17,guard:true}));
  belts.push(conveyor({name:'Esteira 4',x:1.5,z:-2.25,y:3.3,len:10,width:1.25,rollers:28,guard:true}));
  belts.push(conveyor({name:'Esteira 5',x:-2.5,z:-4.7,y:5.15,len:12,width:1.25,rollers:32,guard:true}));
  // Elevated line supports, cross bracing and access ladders.
  for(const [x,y,z] of [[-3,3.3,-2.25],[5.8,3.3,-2.25],[-7,5.15,-4.7],[2.5,5.15,-4.7]]){
    const floorY=.1,h=y-floorY;box(scene,.16,h,.16,M.steel,x,(y+floorY)/2,z);box(scene,.16,h,.16,M.steel,x,(y+floorY)/2,z+.8);box(scene,.12,.12,.96,M.yellow,x,y-.18,z+.4);
  }
  // Sorting chutes and pneumatic pushers.
  function chute(x,z,angle,number){const g=new T.Group();g.position.set(x,.9,z);g.rotation.y=angle;scene.add(g);box(g,2.5,.14,.92,M.edge,1,.18,0);box(g,2.4,.1,.74,M.belt,1,.27,0);for(const side of [-1,1]){box(g,2.5,.32,.07,M.steel,1,.42,side*.43);for(let xx=.2;xx<2.1;xx+=.8)box(g,.12,.72,.12,M.steel,xx,-.3,safeZ(side));}return g;}
  function safeZ(side){return side*.39;}
  chute(5.1,3.1,.58,1);chute(5.1,1.15,-.48,2);chute(5.1,-.75,-.9,3);
  function pusher(x,z,id){const g=new T.Group();g.position.set(x,1.22,z);scene.add(g);box(g,.3,.52,.32,M.dark,0,.22,0);box(g,.15,.08,.15,M.yellow,-.12,.52,0);const rod=cyl(g,.055,.055,.72,M.steel,.3,.2,0,'x');const head=box(g,.22,.3,.68,M.yellow,.68,.2,0);return{g,rod,head,id};}
  const pushers=[pusher(3.25,1.38,1),pusher(4.35,2.8,2)];
  // Optical sensors with a visible red through-beam.
  function sensor(x,z,id){const g=new T.Group();g.position.set(x,1.12,z);scene.add(g);box(g,.18,.35,.15,M.black,0,.18,0);box(g,.1,.08,.04,M.red,.02,.23,.09);const beam=new T.Mesh(new T.CylinderGeometry(.012,.012,1.35,8),new T.MeshBasicMaterial({color:'#ff3c50'}));beam.rotation.x=Math.PI/2;beam.position.set(.1,.14,0);g.add(beam);return{g,beam,id};}
  const sensors=[sensor(-3.95,2.2,1),sensor(2.1,2.2,2)];
  // Photoelectric tower lights and a compact control cabinet.
  function stacklight(x,z){const g=new T.Group();g.position.set(x,0,z);scene.add(g);cyl(g,.055,.055,.65,M.steel,0,.35,0,'y');for(let i=0;i<3;i++){let m=new T.Mesh(new T.CylinderGeometry(.11,.11,.16,16),[M.green,mat('#f0bf42'),M.red][i]);m.position.y=.78+i*.18;g.add(m);g.userData['lamp'+i]=m;}return g;}
  const lights=[stacklight(-9,2.2),stacklight(7,-1.15)];
  const cabinet=new T.Group();cabinet.position.set(-10.2,0,-.1);scene.add(cabinet);box(cabinet,1.25,2.5,.72,mat('#a9afb0',.5,.25),0,1.25,0);box(cabinet,.76,.58,.035,mat('#182a33',.3),0,1.86,.38);box(cabinet,.62,.42,.025,mat('#315872',.35),0,1.88,.41);for(const [x,color] of [[-.27,M.green],[0,M.yellow],[.27,M.red]]){const b=new T.Mesh(new T.CylinderGeometry(.075,.075,.09,16),color);b.rotation.x=Math.PI/2;b.position.set(x,.85,.4);cabinet.add(b);}const em=new T.Mesh(new T.CylinderGeometry(.11,.11,.12,16),M.red);em.rotation.x=Math.PI/2;em.position.set(0,.53,.42);cabinet.add(em);
  // Packages are discrete objects on three routes; the overhead routes have their own parcels.
  function parcel(material,id){const g=new T.Group();const body=box(g,.72,.56,.64,material,0,.3,0);box(g,.08,.565,.645,mat('#e7d1aa'),0,.3,.002,false);box(g,.4,.04,.02,mat('#f0eee2'),0,.42,.333,false);g.userData={id,body};scene.add(g);return g;}
  const lower=Array.from({length:6},(_,i)=>({mesh:parcel([M.box1,M.box2,M.box3][i%3],`CX-${String(i+1).padStart(2,'0')}`),t:i/6,route:i%3}));
  const elevated=[];for(let j=0;j<2;j++)for(let i=0;i<3;i++)elevated.push({mesh:parcel(j?M.box2:M.box1,`CX-A${j+1}-${i+1}`),t:i/3+j*.16,belt:j?4:3});
  const clickable=[...lower,...elevated];
  const raycaster=new T.Raycaster(),pointer=new T.Vector2();
  canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1));raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(clickable.map(c=>c.mesh.children[0]),false);if(hits.length){const item=clickable.find(c=>c.mesh===hits[0].object.parent);const out=document.getElementById('selection');out.classList.add('visible');out.innerHTML=`CAIXA <b>${item.mesh.userData.id}</b> <span>${running?'EM MOVIMENTO':'NA LINHA'}</span>`;}});
  // Camera orbit/zoom without extra dependencies.
  let target=new T.Vector3(0,1.7,0),spherical=new T.Spherical().setFromVector3(camera.position.clone().sub(target)),drag=null;
  canvas.addEventListener('pointerdown',e=>{if(e.button===0&&!e.target.closest('button')){drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};spherical.theta-=dx*.005;spherical.phi=T.MathUtils.clamp(spherical.phi+dy*.004,.25,1.48);});
  canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
  canvas.addEventListener('wheel',e=>{spherical.radius=T.MathUtils.clamp(spherical.radius+e.deltaY*.012,11, thirty());e.preventDefault();},{passive:false});function thirty(){return 30;}
  document.getElementById('homeView').onclick=()=>{target.set(0,1.7,0);spherical.set(21,1.04,13);};
  let running=false,emergency=false,mode='manual',speed=.55,last=performance.now(),elapsed=0;
  const runBtn=document.getElementById('runBtn'),statusText=document.getElementById('statusText'),topStatus=document.querySelector('.top-status');
  function paintState(){const active=running&&!emergency;statusText.textContent=emergency?'EMERGÊNCIA ATUADA':active?'LINHA EM OPERAÇÃO':'SISTEMA PARADO';topStatus.classList.toggle('running',active);runBtn.classList.toggle('stop',active);runBtn.innerHTML=active?'<span>Ⅱ</span><b>PARAR LINHA</b>':'<span>▶</span><b>INICIAR LINHA</b>';for(let i=1;i<=5;i++){const el=document.getElementById('flow'+i);el.textContent=active?'EM OPERAÇÃO':'PARADA';el.classList.toggle('on',active);}document.getElementById('modePill').textContent=mode==='auto'?'AUTOMÁTICO':'MANUAL';document.getElementById('modePill').classList.toggle('auto',mode==='auto');}
  runBtn.onclick=()=>{if(emergency)return;running=!running;paintState();};
  document.getElementById('estop').onclick=()=>{emergency=!emergency;if(emergency)running=false;document.getElementById('estop').classList.toggle('active',emergency);paintState();};
  document.getElementById('resetBtn').onclick=()=>{emergency=false;running=false;elapsed=0;lower.forEach((c,i)=>c.t=i/6);elevated.forEach((c,i)=>c.t=(i%3)/3+Math.floor(i/3)*.16);pushers.forEach(p=>p.head.position.x=.68);document.getElementById('estop').classList.remove('active');paintState();};
  document.getElementById('speed').oninput=e=>{speed=e.target.value/100;document.getElementById('speedValue').textContent=e.target.value+'%';e.target.style.background=`linear-gradient(90deg,var(--lime) 0 ${e.target.value}%,#3c4c57 ${e.target.value}%)`;};
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));paintState();});
  function update(dt){const active=running&&!emergency;if(active)elapsed+=dt;const velocity=active?speed*.115:0;
    lower.forEach((c,i)=>{c.t=(c.t+velocity*dt/6.4)%1;let t=c.t;const x=-9.1+t*17.4;let z=2.2;let y=1.06;if(mode==='auto'&&x>3.1&&x<4.5){const branch=c.route===0?1:c.route===1?-1:0;z+=branch*Math.max(0,Math.min(1,(x-3.1)/1.3))*1.5;if(branch!==0)pushers[c.route===0?0:1].head.position.x=.68+Math.sin(elapsed*5)*.23;}c.mesh.position.set(x,y,z);c.mesh.rotation.y=mode==='auto'&&x>3.1&&x<4.4&&c.route!==2?(c.route===0?.18:-.16):0;});
    elevated.forEach(c=>{c.t=(c.t+velocity*dt/12)%1;const x=-4.5+c.t*12;c.mesh.position.set(x,c.belt===3?3.62:5.47,c.belt===3?-2.25:-4.7);});
    sensors.forEach((s,i)=>{const hit=active&&lower.some(c=>{const x=-9.1+c.t*17.4;return Math.abs(x-(i===0?-3.95:2.1))<.48;});s.beam.material.color.set(hit?'#ffb341':'#ed3e53');document.getElementById('sensor'+(i+1)).textContent=hit?'DETECTADO':'LIVRE';document.getElementById('sensor'+(i+1)).classList.toggle('active',hit);s.g.children[1].material.color.set(hit?'#f4ad4f':'#ef3b4d');});
    const firing=active&&mode==='auto'&&Math.sin(elapsed*1.7)>.82;pushers.forEach((p,i)=>{const out=firing&&i===(Math.floor(elapsed/2)%2);p.head.position.x=out?1.02:.68;document.getElementById('cyl'+(i+1)).textContent=out?'AVANÇADO':'RECUADO';document.getElementById('cyl'+(i+1)).classList.toggle('active',out);});
    lights.forEach(g=>{g.userData.lamp0.material=M.green;g.userData.lamp1.material=active?M.yellow:mat('#604d26');g.userData.lamp2.material=emergency?M.red:mat('#542b2b');});
  }
  function resize(){const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(canvas.parentElement);resize();
  function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;update(dt);camera.position.setFromSpherical(spherical).add(target);camera.lookAt(target);renderer.render(scene,camera);}requestAnimationFrame(frame);paintState();
})();
