import Phaser from "phaser";

type Save = { name:string; level:number; xp:number; hp:number; maxHp:number; atk:number; x:number; defeated:number[]; boss:boolean; checkpoint:boolean; inv:string[] };
const KEY="shadowfall.save.v1";
const fresh=(name="Wayfarer"):Save=>({name:name.slice(0,18)||"Wayfarer",level:1,xp:0,hp:100,maxHp:100,atk:10,x:90,defeated:[],boss:false,checkpoint:false,inv:["Rustbound Blade"]});
const readSave=():Save|null=>{try{
  const raw=localStorage.getItem(KEY); if(!raw)return null;
  const x=JSON.parse(raw) as Partial<Save>;
  if(!x||typeof x!=="object"||typeof x.name!=="string"||!Number.isFinite(x.level)||!Array.isArray(x.defeated))return null;
  const d=fresh(x.name);
  return {
    ...d,...x,
    name:x.name.slice(0,18)||"Wayfarer",
    level:Math.max(1,Math.floor(Number(x.level)||1)),
    xp:Math.max(0,Number(x.xp)||0),
    hp:Math.max(1,Number(x.hp)||d.hp),
    maxHp:Math.max(1,Number(x.maxHp)||d.maxHp),
    atk:Math.max(1,Number(x.atk)||d.atk),
    x:Math.max(40,Math.min(2550,Number(x.x)||d.x)),
    defeated:x.defeated.filter((n):n is number=>Number.isInteger(n)&&n>=0),
    boss:Boolean(x.boss),checkpoint:Boolean(x.checkpoint),
    inv:Array.isArray(x.inv)?x.inv.filter((v):v is string=>typeof v==="string").slice(0,100):d.inv
  };
}catch{return null}};
const persist=(s:Save)=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}};
const damage=(base:number,def=0,crit=false)=>Math.max(1,Math.floor(Math.max(1,base-Math.max(0,def))*(crit?1.6:1)));
const need=(lv:number)=>40+Math.max(1,lv)*25;

class Shadowfall extends Phaser.Scene {
  player!:Phaser.Physics.Arcade.Sprite; save= fresh(); cursors!:Phaser.Types.Input.Keyboard.CursorKeys;
  keys!:Record<string,Phaser.Input.Keyboard.Key>; ground!:Phaser.Physics.Arcade.StaticGroup;
  foes:{s:Phaser.Physics.Arcade.Sprite;hp:number;max:number;kind:number;next:number;id:number;boss?:boolean}[]=[];
  loot:{o:Phaser.GameObjects.Rectangle;name:string;atk:number}[]=[];
  ui!:Phaser.GameObjects.Text; message!:Phaser.GameObjects.Text; paused=false; lastJump=false; nextHit=0; invuln=0; bossSpawned=false;
  touch={left:false,right:false,jump:false,attack:false,k:false,l:false,i:false,dodge:false,interact:false};
  constructor(){super("world")}
  create(){
    this.cameras.main.setBackgroundColor("#171225");
    const g=this.make.graphics({x:0,y:0});
    g.fillStyle(0xa78bfa).fillRect(0,0,24,32);g.fillStyle(0xf5f0ff).fillRect(5,5,4,4).fillRect(15,5,4,4);g.generateTexture("hero",24,32);g.clear();
    g.fillStyle(0xfb7185).fillRect(0,0,30,36);g.fillStyle(0x241b34).fillRect(5,8,5,4).fillRect(20,8,5,4);g.generateTexture("foe",30,36);g.destroy();
    const saved=readSave(); this.save=saved??fresh();
    this.drawWorld();
    this.ground=this.physics.add.staticGroup();
    this.platform(0,456,2600,84);this.platform(420,365,170,16);this.platform(760,315,180,16);this.platform(1180,370,180,16);this.platform(1510,320,170,16);this.platform(1900,365,210,16);
    this.player=this.physics.add.sprite(this.save.x,416,"hero").setDepth(5).setCollideWorldBounds(true).setMaxVelocity(260,700);
    this.player.setSize(18,29).setOffset(3,2);this.physics.add.collider(this.player,this.ground);
    this.cursors=this.input.keyboard!.createCursorKeys();
    this.keys=this.input.keyboard!.addKeys("A,D,W,J,K,L,I,SHIFT,E,ESC,SPACE") as Record<string,Phaser.Input.Keyboard.Key>;
    const placements=[[300,0],[550,1],[850,0],[1040,2],[1350,1],[1650,2],[1840,0]];
    placements.forEach(([x,k],n)=>{if(!this.save.defeated.includes(n))this.spawnEnemy(x!,k!,n)});
    this.ui=this.add.text(16,14,"",{fontFamily:"monospace",fontSize:"13px",color:"#f5f0ff",backgroundColor:"#100d1c",padding:10}).setScrollFactor(0).setDepth(30);
    this.message=this.add.text(18,0,"",{fontFamily:"monospace",fontSize:"13px",color:"#f5f0ff",backgroundColor:"#33254f",padding:8}).setScrollFactor(0).setDepth(31).setVisible(false);
    this.cameras.main.setBounds(0,0,2600,540);this.cameras.main.startFollow(this.player,true,.12,.12);
    this.touchControls();
    this.input.keyboard?.on("keydown-J",()=>this.attack());
    this.input.keyboard?.on("keydown-K",()=>this.skill("sweep"));
    this.input.keyboard?.on("keydown-L",()=>this.skill("rush"));
    this.input.keyboard?.on("keydown-I",()=>this.skill("shock"));
    this.input.keyboard?.on("keydown-SHIFT",()=>this.dodge());
    this.input.keyboard?.on("keydown-E",()=>this.interact());
    this.input.keyboard?.on("keydown-ESC",()=>this.togglePause());
    this.message.setText("ASHEN FRONTIER — Defeat the Warden beyond the broken seal.").setY(this.scale.height-45).setVisible(true);
    this.time.delayedCall(3200,()=>this.message.setVisible(false));
    this.scale.on("resize",()=>this.repositionTouch());
  }
  drawWorld(){
    const bg=this.add.graphics().setDepth(-5);bg.fillGradientStyle(0x171225,0x171225,0x29203b,0x29203b,1).fillRect(0,0,2600,540);
    for(let layer=0;layer<3;layer++)for(let i=0;i<15;i++){const x=i*195+layer*45,h=80+(i*43+layer*29)%130;bg.fillStyle([0x30243f,0x251e35,0x1d182c][layer]!,1).fillTriangle(x,456-h,x+75,421-h,x+155,456)}
    for(let i=0;i<100;i++)this.add.rectangle(i*173%2600,i*83%420,2,2,i%3?0x8878a5:0xc4b5fd,.5).setDepth(-4);
    const seal=this.add.graphics();seal.lineStyle(5,0x8b5cf6,.8).strokeCircle(2190,300,60).strokeCircle(2190,300,42).lineBetween(2140,300,2240,300).lineBetween(2190,250,2190,350);
  }
  platform(x:number,y:number,w:number,h:number){const r=this.add.rectangle(x+w/2,y+h/2,w,h,0x4a3b5d).setStrokeStyle(2,0x8d7ba8);this.physics.add.existing(r,true);this.ground.add(r);this.add.rectangle(x+w/2,y+2,w,4,0x9380ad).setDepth(2)}
  spawnEnemy(x:number,k:number,id:number,boss=false){
    const stats=[{hp:30,speed:54,dmg:7,xp:16,color:0x8b7c9c},{hp:22,speed:92,dmg:9,xp:20,color:0x6ee7b7},{hp:65,speed:35,dmg:13,xp:32,color:0xfb923c},{hp:260,speed:48,dmg:14,xp:150,color:0xc084fc}][k]!;
    const s=this.physics.add.sprite(x,420,"foe").setTint(stats.color).setDepth(4);if(boss)s.setScale(2.1);
    s.setSize(boss?44:24,boss?62:30).setCollideWorldBounds(true).setMaxVelocity(180,700);this.physics.add.collider(s,this.ground);
    this.foes.push({s,hp:stats.hp,max:stats.hp,kind:k,next:0,id,boss});
  }
  update(t:number){
    if(this.paused||!this.player?.active)return;
    const left=this.cursors.left?.isDown||this.keys.A?.isDown||this.touch.left,right=this.cursors.right?.isDown||this.keys.D?.isDown||this.touch.right;
    const jump=this.cursors.up?.isDown||this.keys.W?.isDown||this.keys.SPACE?.isDown||this.touch.jump;
    if(left){this.player.setVelocityX(-190);this.player.setFlipX(true)}else if(right){this.player.setVelocityX(190);this.player.setFlipX(false)}else this.player.setVelocityX(this.player.body!.velocity.x*.78);
    if(jump&&this.player.body!.blocked.down&&!this.lastJump)this.player.setVelocityY(-390);this.lastJump=!!jump;
    if(this.touch.attack){this.touch.attack=false;this.attack()}if(this.touch.k){this.touch.k=false;this.skill("sweep")}if(this.touch.l){this.touch.l=false;this.skill("rush")}if(this.touch.i){this.touch.i=false;this.skill("shock")}if(this.touch.dodge){this.touch.dodge=false;this.dodge()}if(this.touch.interact){this.touch.interact=false;this.interact()}
    for(const e of this.foes){if(!e.s.active)continue;const dx=this.player.x-e.s.x,d=Math.abs(dx),speed=[54,92,35,62][e.kind]!;
      if(d>60&&d<330)e.s.setVelocityX(Math.sign(dx)*speed);else e.s.setVelocityX(0);
      if(t>e.next&&d<(e.boss?180:55)){e.next=t+(e.boss&&e.hp<e.max/2?850:1250);this.enemyHit(e,e.boss&&e.hp<e.max/2?17:[7,9,13,14][e.kind]!)}
    }
    if(this.player.x>2100&&!this.bossSpawned&&!this.save.boss){this.bossSpawned=true;this.spawnEnemy(2300,3,99,true);this.say("THE ASHEN WARDEN AWAKENS",2400)}
    if(this.player.y>650){this.player.setPosition(this.save.checkpoint?2050:90,416);this.player.setVelocity(0,0);this.save.hp=Math.max(1,this.save.hp-10)}
    this.save.x=this.player.x;this.ui.setText(`${this.save.name} • VANGUARD   LV ${this.save.level}\nHP ${Math.ceil(this.save.hp)}/${this.save.maxHp}   ATK ${this.save.atk}   XP ${this.save.xp}/${need(this.save.level)}\nJ attack • K sweep • L rush • I shock • Shift dodge • E interact`);
    if(this.player.x>2470&&this.save.boss&&!this.save.checkpoint){this.save.checkpoint=true;this.say("CHECKPOINT REACHED — SAVED",2000);persist(this.save)}
    if(t%5000<20)persist(this.save);
  }
  attack(){if(this.paused||this.time.now<this.nextHit)return;this.nextHit=this.time.now+320;const dir=this.player.flipX?-1:1;
    const fx=this.add.rectangle(this.player.x+dir*28,this.player.y,50,34,0xc4b5fd,.45).setDepth(15);this.tweens.add({targets:fx,alpha:0,duration:150,onComplete:()=>fx.destroy()});
    this.foes.forEach(e=>{const dx=e.s.x-this.player.x;if(e.s.active&&Math.abs(dx)<68&&Math.sign(dx||1)===dir&&Math.abs(e.s.y-this.player.y)<65)this.hit(e,this.save.atk+this.equipBonus(),dir*150)});this.beep(190,.05)
  }
  skill(kind:"sweep"|"rush"|"shock"){if(this.paused)return;const dir=this.player.flipX?-1:1;const cost=kind==="sweep"?550:kind==="rush"?1000:1500;const k=kind;
    const prop="_cd_"+k;const now=this.time.now;if(now<((this as any)[prop]||0)){this.say("ABILITY RECHARGING",650);return}(this as any)[prop]=now+cost;
    if(kind==="rush"){this.player.setVelocityX(dir*420);this.player.setVelocityY(-30)}
    const radius=kind==="sweep"?105:kind==="rush"?100:150;const fx=this.add.circle(this.player.x+dir*35,this.player.y,12,kind==="shock"?0x67e8f9:0xa78bfa,.6).setDepth(16);
    this.tweens.add({targets:fx,scale:5,alpha:0,duration:260,onComplete:()=>fx.destroy()});
    this.foes.forEach(e=>{const dx=e.s.x-this.player.x;if(e.s.active&&Math.abs(dx)<radius&&Math.abs(e.s.y-this.player.y)<100&&(kind!=="sweep"||Math.sign(dx||1)===dir))this.hit(e,Math.round((this.save.atk+this.equipBonus())*(kind==="sweep"?1.6:kind==="rush"?2:2.4)),dir*220)});this.beep(kind==="shock"?90:250,.1)
  }
  hit(e:typeof this.foes[number],raw:number,kb:number){const crit=Math.random()<.12,d=damage(raw,0,crit);e.hp-=d;e.s.setVelocityX(kb);e.s.setVelocityY(-75);e.s.setTint(0xffffff);this.time.delayedCall(90,()=>e.s.active&&e.s.clearTint());
    const txt=this.add.text(e.s.x,e.s.y-25,`${crit?"✦ ":""}${d}`,{fontFamily:"monospace",fontSize:"15px",color:crit?"#facc15":"#fff",stroke:"#211a34",strokeThickness:3}).setDepth(20);this.tweens.add({targets:txt,y:txt.y-25,alpha:0,duration:600,onComplete:()=>txt.destroy()});
    if(e.hp<=0){e.s.disableBody(true,true);if(e.boss){this.save.boss=true;this.say("ASHEN WARDEN DEFEATED — THE SEAL STIRS",3500)}const xp=e.boss?150:[16,20,32][e.kind]!;if(!this.save.defeated.includes(e.boss?99:e.id))this.save.defeated.push(e.boss?99:e.id);this.save.xp+=xp;
      while(this.save.xp>=need(this.save.level)){this.save.xp-=need(this.save.level);this.save.level++;this.save.maxHp+=12;this.save.atk+=2;this.save.hp=this.save.maxHp;this.say(`LEVEL UP! ${this.save.level} — +12 HP, +2 ATK`,2400)}
      const names=["Frontier Edge","Ashen Mail","Warden Cleaver","Emberglass Charm","Starbreaker"];const name=names[Math.floor(Math.random()*names.length)]!;const o=this.add.rectangle(e.s.x,e.s.y-12,14,14,[0x86efac,0x60a5fa,0xc084fc,0xfacc15,0xc084fc][Math.floor(Math.random()*5)]!).setDepth(10);this.loot.push({o,name,atk:2+Math.floor(Math.random()*8)});persist(this.save)
    }
  }
  enemyHit(e:typeof this.foes[number],raw:number){if(this.time.now<this.invuln||Math.abs(this.player.x-e.s.x)>(e.boss?155:60))return;this.invuln=this.time.now+650;this.save.hp=Math.max(0,this.save.hp-damage(raw,1));this.player.setVelocityX(this.player.x>e.s.x?150:-150);this.player.setVelocityY(-85);this.player.setTint(0xfb7185);this.time.delayedCall(170,()=>this.player?.clearTint());if(!this.save.hp){this.save.hp=Math.floor(this.save.maxHp*.55);this.player.setPosition(this.save.checkpoint?2050:90,416);this.player.setVelocity(0,0);this.say("YOU FELL — THE FRONTIER GIVES YOU ANOTHER CHANCE",2400)}}
  dodge(){this.player.setVelocityX((this.player.flipX?-1:1)*350);this.invuln=this.time.now+350;this.player.setTint(0x67e8f9);this.time.delayedCall(200,()=>this.player?.clearTint())}
  interact(){const l=this.loot.find(x=>x.o.active&&Phaser.Math.Distance.Between(this.player.x,this.player.y,x.o.x,x.o.y)<65);if(l){l.o.destroy();this.loot=this.loot.filter(x=>x!==l);this.save.inv.push(l.name);this.say(`LOOT FOUND: ${l.name} (+${l.atk} ATK)`,2200);this.save.atk+=l.atk;persist(this.save);return}
    if(this.player.x>2050&&this.player.x<2290){this.save.checkpoint=true;persist(this.save);this.say("CHECKPOINT ATTUNED — GAME SAVED",2000)}else this.say("Nothing nearby to interact with.",900)}
  equipBonus(){return Math.max(0,this.save.atk-10-(this.save.level-1)*2)}
  say(t:string,ms:number){this.message.setText(t).setY(this.scale.height-45).setVisible(true);this.time.delayedCall(ms,()=>this.message?.setVisible(false))}
  togglePause(){this.paused=!this.paused;this.physics.world.isPaused=this.paused;if(this.paused){const w=this.scale.width,h=this.scale.height;const shade=this.add.rectangle(w/2,h/2,w,h,0x100d1c,.9).setScrollFactor(0).setDepth(50).setName("pauseShade");const title=this.add.text(w/2,h/2-45,"PAUSED",{fontFamily:"monospace",fontSize:"30px",color:"#fff"}).setOrigin(.5).setScrollFactor(0).setDepth(51).setName("pauseTitle");const makeButton=(y:number,label:string,action:()=>void,name:string)=>{const b=this.add.text(w/2,y,label,{fontFamily:"monospace",fontSize:"14px",color:"#c4b5fd",backgroundColor:"#33254f",padding:12}).setOrigin(.5).setScrollFactor(0).setDepth(51).setInteractive().setName(name);b.on("pointerdown",action)};
      const close=()=>{this.children.list.filter(o=>["pauseShade","pauseTitle","pauseResume","pauseSave","pauseReset"].includes(o.name)).forEach(o=>o.destroy());this.paused=false;this.physics.world.isPaused=false};
      makeButton(h/2+5,"RESUME",close,"pauseResume");
      makeButton(h/2+55,"SAVE GAME",()=>{persist(this.save);this.say("GAME SAVED",1200);close()},"pauseSave");
      makeButton(h/2+105,"RESET SAVE",()=>{try{localStorage.removeItem(KEY)}catch{};this.save=fresh();persist(this.save);this.scene.restart()},"pauseReset")}else this.children.list.filter(o=>["pauseShade","pauseTitle","pauseButton"].includes(o.name)).forEach(o=>o.destroy())}
  touchControls(){const add=(x:number,y:number,label:string,key:keyof Shadowfall["touch"],color=0x34274e)=>{const c=this.add.circle(x,y,27,color,.9).setStrokeStyle(2,0xa78bfa).setScrollFactor(0).setDepth(40).setInteractive();this.add.text(x,y,label,{fontFamily:"monospace",fontSize:"12px",color:"#fff"}).setOrigin(.5).setScrollFactor(0).setDepth(41);const down=()=>{this.touch[key]=true;c.setFillStyle(0x6d28d9)};const up=()=>{this.touch[key]=false;c.setFillStyle(color)};c.on("pointerdown",down);c.on("pointerup",up);c.on("pointerout",up)};
    add(42,this.scale.height-75,"◀","left");add(104,this.scale.height-75,"▶","right");add(72,this.scale.height-132,"↑","jump");add(this.scale.width-165,this.scale.height-75,"ATK","attack",0x573047);add(this.scale.width-108,this.scale.height-125,"K","k");add(this.scale.width-55,this.scale.height-75,"L","l");add(this.scale.width-108,this.scale.height-35,"I","i");add(this.scale.width-218,this.scale.height-132,"DOD","dodge");add(this.scale.width-260,this.scale.height-72,"E","interact")}
  repositionTouch(){/* Reload after rotating if you need controls reflowed. */}
  beep(freq:number,duration:number){try{const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;o.type="square";g.gain.value=.025;o.connect(g);g.connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.stop(c.currentTime+duration);o.onended=()=>void c.close()}catch{}}
}
class Title extends Phaser.Scene{
  constructor(){super("title")}
  create(){this.cameras.main.setBackgroundColor("#100d1c");const w=this.scale.width,h=this.scale.height;
    for(let i=0;i<60;i++)this.add.rectangle(i*173%w,i*97%h,2,2,i%3?0x6d6385:0xc4b5fd,.8);
    this.add.text(w/2,h*.24,"SHADOWFALL",{fontFamily:"monospace",fontSize:"clamp(34px,7vw,64px)",color:"#f5f0ff",fontStyle:"bold",stroke:"#5b21b6",strokeThickness:4}).setOrigin(.5);
    this.add.text(w/2,h*.32,"REALMS OF CHAOS",{fontFamily:"monospace",fontSize:"clamp(14px,2.5vw,22px)",color:"#c4b5fd"}).setOrigin(.5);
    this.add.text(w/2,h*.41,"THE ASHEN FRONTIER • PLAYABLE VERTICAL SLICE",{fontFamily:"monospace",fontSize:"12px",color:"#b9afce"}).setOrigin(.5);
    const input=document.createElement("input");input.placeholder="Name your Wayfarer";input.value="Wayfarer";input.maxLength=18;Object.assign(input.style,{position:"absolute",left:"50%",top:"51%",transform:"translate(-50%,-50%)",width:"min(280px,70vw)",padding:"12px",border:"1px solid #a78bfa",borderRadius:"8px",background:"#211a34",color:"#fff",font:"16px monospace",textAlign:"center",zIndex:"10"});this.game.canvas.parentElement?.appendChild(input);
    const button=(y:number,label:string,fn:()=>void)=>{const r=this.add.rectangle(w/2,y,230,42,0x33254f).setStrokeStyle(2,0xa78bfa).setInteractive();this.add.text(w/2,y,label,{fontFamily:"monospace",fontSize:"15px",color:"#fff"}).setOrigin(.5);r.on("pointerdown",fn)};
    button(h*.64,"NEW JOURNEY",()=>{persist(fresh(input.value));input.remove();this.scene.start("world")});
    button(h*.74,readSave()?"CONTINUE JOURNEY":"START JOURNEY",()=>{if(!readSave())persist(fresh(input.value));input.remove();this.scene.start("world")});
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>input.remove());
  }
}
new Phaser.Game({type:Phaser.AUTO,parent:"game",backgroundColor:"#100d1c",pixelArt:true,roundPixels:true,scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH,width:960,height:540},physics:{default:"arcade",arcade:{gravity:{y:900},debug:false}},scene:[Title,Shadowfall]});