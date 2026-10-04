import{a as Br}from"./chunk-VC46IEJQ.js";var De=null;var tr=new WeakMap;function Et(n,e){let t=tr.get(n);t||(t=new Set,tr.set(n,t)),t.add(e)}var ze=class{constructor(e){this.subscribers=new Set;this.value=e}get(){if(De){let e=De;this.subscribers.add(e),Et(e,()=>this.subscribers.delete(e))}return this.value}set(e){Object.is(this.value,e)||(this.value=e,this.notify())}update(e){this.set(e(this.value))}subscribe(e){return this.subscribers.add(e),()=>this.subscribers.delete(e)}notify(){Array.from(this.subscribers).forEach(e=>{try{e()}catch(t){console.error("[Scarlett Player] Error in signal subscriber:",t)}})}destroy(){this.subscribers.clear()}getSubscriberCount(){return this.subscribers.size}};function wt(n){return new ze(n)}var Ie={playbackState:"idle",playing:!1,paused:!0,ended:!1,buffering:!1,waiting:!1,seeking:!1,currentTime:0,duration:NaN,buffered:null,bufferedAmount:0,mediaType:"unknown",source:null,title:"",poster:"",volume:1,muted:!1,playbackRate:1,fullscreen:!1,pip:!1,controlsVisible:!0,qualities:[],currentQuality:null,audioTracks:[],currentAudioTrack:null,textTracks:[],currentTextTrack:null,live:!1,liveEdge:!0,seekableRange:null,liveLatency:0,lowLatencyMode:!1,chapters:[],currentChapter:null,error:null,bandwidth:0,autoplay:!1,loop:!1,airplayAvailable:!1,airplayActive:!1,chromecastAvailable:!1,chromecastActive:!1,thumbnails:null,interacting:!1,hovering:!1,focused:!1},qe=class{constructor(e){this.signals=new Map;this.changeSubscribers=new Set;this.definedDefaults=new Map;this.lastValues=new Map;this.destroyed=!1;this.initializeSignals(e)}initializeSignals(e){let t={...Ie,...e};for(let[r,i]of Object.entries(t))this.createSignal(r,i)}createSignal(e,t){let r=wt(t);this.lastValues.set(e,t),r.subscribe(()=>{this.notifyChangeSubscribers(e)}),this.signals.set(e,r)}define(e,t){if(this.signals.has(e)){let r=this.definedDefaults.has(e),i=e in Ie,s=r?this.definedDefaults.get(e):Ie[e];(r||i)&&!Object.is(s,t)&&console.warn(`[StateManager] State key "${String(e)}" is already defined with a different default. Keeping:`,s,"ignoring:",t);return}this.definedDefaults.set(e,t),this.createSignal(e,t)}get(e){if(this.destroyed)throw new Error(`[StateManager] Manager is destroyed (reading '${e}')`);let t=this.signals.get(e);if(!t)throw new Error(`[StateManager] Unknown state key: ${e}`);return t}getValue(e){return this.get(e).get()}set(e,t){this.get(e).set(t)}update(e){for(let[t,r]of Object.entries(e)){let i=t;this.signals.has(i)&&this.set(i,r)}}subscribeToKey(e,t){let r=this.get(e);return r.subscribe(()=>{t(r.get())})}subscribe(e){return this.changeSubscribers.add(e),()=>this.changeSubscribers.delete(e)}notifyChangeSubscribers(e){let r=this.get(e).get(),i=this.lastValues.get(e);this.lastValues.set(e,r);let s={key:e,value:r,previousValue:i};Array.from(this.changeSubscribers).forEach(a=>{try{a(s)}catch(c){console.error("[StateManager] Error in change subscriber:",c)}})}reset(){this.update({...Ie,...Object.fromEntries(this.definedDefaults)})}resetKey(e){let t=e in Ie?Ie[e]:this.definedDefaults.get(e);this.set(e,t)}snapshot(){let e={};for(let[t,r]of this.signals)e[t]=r.get();return Object.freeze(e)}getSubscriberCount(e){return this.signals.get(e)?.getSubscriberCount()??0}destroy(){this.signals.forEach(e=>e.destroy()),this.signals.clear(),this.changeSubscribers.clear(),this.lastValues.clear(),this.destroyed=!0}};var Kr={maxListeners:100,async:!1,interceptors:!0},Ke=class{constructor(e){this.listeners=new Map;this.onceListeners=new Map;this.interceptors=new Map;this.options={...Kr,...e}}on(e,t){return this.listeners.has(e)||this.listeners.set(e,new Set),this.listeners.get(e).add(t),this.checkMaxListeners(e),()=>this.off(e,t)}once(e,t){this.onceListeners.has(e)||this.onceListeners.set(e,new Set);let r=this.onceListeners.get(e);return r.add(t),this.listeners.has(e)||this.listeners.set(e,new Set),()=>{r.delete(t)}}off(e,t){let r=this.listeners.get(e);r&&(r.delete(t),r.size===0&&this.listeners.delete(e));let i=this.onceListeners.get(e);i&&(i.delete(t),i.size===0&&this.onceListeners.delete(e))}emit(e,t){let r=this.runInterceptors(e,t);if(r===null)return;let i=this.listeners.get(e);i&&Array.from(i).forEach(c=>{this.safeCallHandler(c,r)});let s=this.onceListeners.get(e);s&&(Array.from(s).forEach(c=>{s.delete(c),this.safeCallHandler(c,r)}),s.size===0&&this.onceListeners.delete(e))}async emitAsync(e,t){let r=await this.runInterceptorsAsync(e,t);if(r===null)return;let i=this.listeners.get(e);if(i){let a=Array.from(i).map(c=>this.safeCallHandlerAsync(c,r));await Promise.all(a)}let s=this.onceListeners.get(e);if(s){let c=Array.from(s).map(o=>(s.delete(o),this.safeCallHandlerAsync(o,r)));await Promise.all(c),s.size===0&&this.onceListeners.delete(e)}}intercept(e,t){if(!this.options.interceptors)return()=>{};this.interceptors.has(e)||this.interceptors.set(e,new Set);let r=this.interceptors.get(e);return r.add(t),()=>{r.delete(t),r.size===0&&this.interceptors.delete(e)}}removeAllListeners(e){e?(this.listeners.delete(e),this.onceListeners.delete(e)):(this.listeners.clear(),this.onceListeners.clear())}listenerCount(e){let t=this.listeners.get(e)?.size??0,r=this.onceListeners.get(e)?.size??0;return t+r}destroy(){this.listeners.clear(),this.onceListeners.clear(),this.interceptors.clear()}runInterceptors(e,t){if(!this.options.interceptors)return t;let r=this.interceptors.get(e);if(!r||r.size===0)return t;let i=t;for(let s of r)try{if(i=s(i),i===null)return null}catch(a){console.error("[EventBus] Error in interceptor:",a)}return i}async runInterceptorsAsync(e,t){if(!this.options.interceptors)return t;let r=this.interceptors.get(e);if(!r||r.size===0)return t;let i=t;for(let s of r)try{let a=s(i);if(i=a instanceof Promise?await a:a,i===null)return null}catch(a){console.error("[EventBus] Error in interceptor:",a)}return i}safeCallHandler(e,t){try{e(t)}catch(r){console.error("[EventBus] Error in event handler:",r)}}async safeCallHandlerAsync(e,t){try{let r=e(t);r instanceof Promise&&await r}catch(r){console.error("[EventBus] Error in event handler:",r)}}checkMaxListeners(e){let t=this.listenerCount(e);t>this.options.maxListeners&&console.warn(`[EventBus] Max listeners (${this.options.maxListeners}) exceeded for event: ${e}. Current count: ${t}. This may indicate a memory leak.`)}};var nr=["debug","info","warn","error"],Wr=n=>{let t=`${n.scope?`[${n.scope}]`:"[ScarlettPlayer]"} ${n.message}`,r=n.metadata??"";switch(n.level){case"debug":console.debug(t,r);break;case"info":console.info(t,r);break;case"warn":console.warn(t,r);break;case"error":console.error(t,r);break}},We=class n{constructor(e){this.level=e?.level??"warn",this.scope=e?.scope,this.enabled=e?.enabled??!0,this.handlers=e?.handlers??[Wr]}child(e){return new n({level:this.level,scope:this.scope?`${this.scope}:${e}`:e,enabled:this.enabled,handlers:this.handlers})}debug(e,t){this.log("debug",e,t)}info(e,t){this.log("info",e,t)}warn(e,t){this.log("warn",e,t)}error(e,t){this.log("error",e,t)}setLevel(e){this.level=e}setEnabled(e){this.enabled=e}addHandler(e){this.handlers.push(e)}removeHandler(e){let t=this.handlers.indexOf(e);t!==-1&&this.handlers.splice(t,1)}log(e,t,r){if(!this.enabled||!this.shouldLog(e))return;let i={level:e,message:t,timestamp:Date.now(),scope:this.scope,metadata:r};for(let s of this.handlers)try{s(i)}catch(a){console.error("[Logger] Handler error:",a)}}shouldLog(e){return nr.indexOf(e)>=nr.indexOf(this.level)}};var Ge=class{constructor(e,t,r){this.errors=[];this.eventBus=e,this.logger=t,this.maxHistory=r?.maxHistory??10}handle(e,t){let r=this.normalizeError(e,t);return this.addToHistory(r),this.logError(r),this.eventBus.emit("error",r),r}record(e,t){let r=this.normalizeError(e,t);return this.addToHistory(r),this.logError(r),r}throw(e,t,r){let i={code:e,message:t,fatal:r?.fatal??this.isFatalCode(e),timestamp:Date.now(),context:r?.context,originalError:r?.originalError};return this.handle(i,r?.context)}getHistory(){return[...this.errors]}getLastError(){return this.errors[this.errors.length-1]??null}clearHistory(){this.errors=[]}hasFatalError(){return this.errors.some(e=>e.fatal)}normalizeError(e,t){return this.isPlayerError(e)?{...e,context:{...e.context,...t}}:{code:this.getErrorCode(e),message:e.message,fatal:this.isFatal(e,t),timestamp:Date.now(),context:t,originalError:e}}getErrorCode(e){let t=e.message.toLowerCase();return t.includes("quota")?"MEDIA_BUFFER_FULL":t.includes("append")||t.includes("sourcebuffer")||t.includes("arraybuffer")?"MEDIA_APPEND_ERROR":t.includes("network")?"MEDIA_NETWORK_ERROR":t.includes("decode")?"MEDIA_DECODE_ERROR":t.includes("source")?"SOURCE_LOAD_FAILED":t.includes("plugin")?"PLUGIN_SETUP_FAILED":t.includes("provider")?"PROVIDER_SETUP_FAILED":"UNKNOWN_ERROR"}isFatal(e,t){return t?.operation==="load"?!0:this.isFatalCode(this.getErrorCode(e))}isFatalCode(e){return["SOURCE_NOT_SUPPORTED","PROVIDER_NOT_FOUND","MEDIA_DECODE_ERROR"].includes(e)}isPlayerError(e){return typeof e=="object"&&e!==null&&"code"in e&&"message"in e&&"fatal"in e&&"timestamp"in e}addToHistory(e){this.errors.push(e),this.errors.length>this.maxHistory&&this.errors.shift()}logError(e){let t=`[${e.code}] ${e.message}`;e.fatal?this.logger.error(t,{code:e.code,context:e.context}):this.logger.warn(t,{code:e.code,context:e.context})}};var Qe=class{constructor(e,t){this.cleanupFns=[];this.pluginId=e,this.stateManager=t.stateManager,this.eventBus=t.eventBus,this.container=t.container,this.getPluginFn=t.getPlugin,this.logger={debug:(r,i)=>t.logger.debug(`[${e}] ${r}`,i),info:(r,i)=>t.logger.info(`[${e}] ${r}`,i),warn:(r,i)=>t.logger.warn(`[${e}] ${r}`,i),error:(r,i)=>t.logger.error(`[${e}] ${r}`,i)}}getState(e){return this.stateManager.getValue(e)}setState(e,t){this.stateManager.set(e,t)}defineState(e,t){this.stateManager.define(e,t)}on(e,t){return this.eventBus.on(e,t)}off(e,t){this.eventBus.off(e,t)}emit(e,t){this.eventBus.emit(e,t)}getPlugin(e){return this.getPluginFn(e)}onDestroy(e){this.cleanupFns.push(e)}subscribeToState(e){return this.stateManager.subscribe(e)}runCleanups(){for(let e of this.cleanupFns)try{e()}catch(t){this.logger.error("Cleanup function failed",{error:t})}this.cleanupFns=[]}getCleanupFns(){return this.cleanupFns}};var Ye=class{constructor(e,t,r,i){this.plugins=new Map;this.initPromises=new Map;this.initializingStack=new Set;this.eventBus=e,this.stateManager=t,this.logger=r,this.container=i.container}register(e,t){if(this.plugins.has(e.id))throw new Error(`Plugin "${e.id}" is already registered`);this.validatePlugin(e);let r=new Qe(e.id,{stateManager:this.stateManager,eventBus:this.eventBus,logger:this.logger,container:this.container,getPlugin:i=>this.getReadyPlugin(i)});this.plugins.set(e.id,{plugin:e,state:"registered",config:t,cleanupFns:[],api:r}),this.logger.info(`Plugin registered: ${e.id}`),this.eventBus.emit("plugin:registered",{name:e.id,type:e.type})}async unregister(e){let t=this.plugins.get(e);t&&(t.state==="ready"&&await this.destroyPlugin(e),this.plugins.delete(e),this.logger.info(`Plugin unregistered: ${e}`))}async initAll(){let e=this.resolveDependencyOrder();for(let t of e)await this.initPlugin(t)}async initPlugin(e){let t=this.plugins.get(e);if(!t)throw new Error(`Plugin "${e}" not found`);if(t.state==="ready")return;if(this.initializingStack.has(e))throw new Error(`Plugin "${e}" is already initializing (possible circular dependency)`);let r=this.initPromises.get(e);if(r)return r;if(t.state==="initializing"){let s=this.initPromises.get(e);return s||void 0}let i=(async()=>{this.initializingStack.add(e);try{for(let s of t.plugin.dependencies||[]){let a=this.plugins.get(s);if(!a)throw new Error(`Plugin "${e}" depends on missing plugin "${s}"`);a.state!=="ready"&&await this.initPlugin(s)}}finally{this.initializingStack.delete(e)}try{if(t.state="initializing",t.plugin.onStateChange){let s=this.stateManager.subscribe(t.plugin.onStateChange.bind(t.plugin));t.api.onDestroy(s)}if(t.plugin.onError){let s=this.eventBus.on("error",a=>{t.plugin.onError?.(a.originalError||new Error(a.message))});t.api.onDestroy(s)}await t.plugin.init(t.api,t.config),t.state="ready",this.logger.info(`Plugin ready: ${e}`),this.eventBus.emit("plugin:active",{name:e})}catch(s){throw t.state="error",t.error=s,this.logger.error(`Plugin init failed: ${e}`,{error:s}),this.eventBus.emit("plugin:error",{name:e,error:s}),s}finally{this.initPromises.delete(e)}})();return this.initPromises.set(e,i),i}async destroyAll(){let e=this.resolveDependencyOrder().reverse();for(let t of e)await this.destroyPlugin(t)}async destroyPlugin(e){let t=this.plugins.get(e);if(!(!t||t.state!=="ready"))try{await t.plugin.destroy()}catch(r){this.logger.error(`Plugin destroy failed: ${e}`,{error:r})}finally{t.api.runCleanups(),t.state="registered",this.eventBus.emit("plugin:destroyed",{name:e})}}getPlugin(e){let t=this.plugins.get(e);return t?t.plugin:null}getReadyPlugin(e){let t=this.plugins.get(e);return t?.state==="ready"?t.plugin:null}hasPlugin(e){return this.plugins.has(e)}getPluginState(e){return this.plugins.get(e)?.state??null}getPluginIds(){return Array.from(this.plugins.keys())}getReadyPlugins(){return Array.from(this.plugins.values()).filter(e=>e.state==="ready").map(e=>e.plugin)}getPluginsByType(e){return Array.from(this.plugins.values()).filter(t=>t.plugin.type===e).map(t=>t.plugin)}selectProvider(e){let t=this.getPluginsByType("provider");for(let r of t){let i=r.canPlay;if(typeof i=="function"&&i(e))return r}return null}resolveDependencyOrder(){let e=new Set,t=new Set,r=[],i=(s,a=[])=>{if(e.has(s))return;if(t.has(s)){let o=[...a,s].join(" -> ");throw new Error(`Circular dependency detected: ${o}`)}let c=this.plugins.get(s);if(c){t.add(s);for(let o of c.plugin.dependencies||[])this.plugins.has(o)&&i(o,[...a,s]);t.delete(s),e.add(s),r.push(s)}};for(let s of this.plugins.keys())i(s);return r}validatePlugin(e){if(!e.id||typeof e.id!="string")throw new Error("Plugin must have a valid id");if(!e.name||typeof e.name!="string")throw new Error(`Plugin "${e.id}" must have a valid name`);if(!e.version||typeof e.version!="string")throw new Error(`Plugin "${e.id}" must have a valid version`);if(!e.type||typeof e.type!="string")throw new Error(`Plugin "${e.id}" must have a valid type`);if(typeof e.init!="function")throw new Error(`Plugin "${e.id}" must have an init() method`);if(typeof e.destroy!="function")throw new Error(`Plugin "${e.id}" must have a destroy() method`)}};function Ft(n){return n.querySelector("video")}function Te(n){let e=document,t=e.fullscreenElement??e.webkitFullscreenElement??null;return t&&n.contains(t)?!0:!!Ft(n)?.webkitDisplayingFullscreen}async function Pe(n){let e=n;if(e.requestFullscreen){await e.requestFullscreen();return}if(e.webkitRequestFullscreen){await e.webkitRequestFullscreen();return}let t=Ft(n);if(t?.webkitEnterFullscreen){t.webkitEnterFullscreen();return}throw new Error("Fullscreen is not supported")}async function Me(n){let e=Ft(n);if(e?.webkitDisplayingFullscreen){e.webkitExitFullscreen?.();return}let t=document;if(t.exitFullscreen){await t.exitFullscreen();return}t.webkitExitFullscreen&&await t.webkitExitFullscreen()}function J(n){if(n)try{let e=new URL(n);return e.protocol!=="http:"&&e.protocol!=="https:"?void 0:`${e.origin}${e.pathname}`}catch{return}}var Lt=class{constructor(e){this._currentProvider=null;this.destroyed=!1;this.seekingWhilePlaying=!1;this.seekResumeTimeout=null;this.initialSrcLoaded=!1;this.loadGeneration=0;this.listenersWired=!1;this.readyEmitted=!1;this.fullscreenAnnounced=!1;this.unwireFullscreen=null;this.destroyPromise=null;this.initializing=null;if(typeof e.container=="string"){let t=document.querySelector(e.container);if(!t||!(t instanceof HTMLElement))throw new Error(`ScarlettPlayer: container not found: ${e.container}`);this.container=t}else if(e.container instanceof HTMLElement)this.container=e.container;else throw new Error("ScarlettPlayer requires a valid HTMLElement container or CSS selector");if(this.initialSrc=e.src,this.eventBus=new Ke,this.stateManager=new qe({autoplay:e.autoplay??!1,loop:e.loop??!1,volume:e.volume??1,muted:e.muted??!1,poster:e.poster??""}),this.logger=new We({level:e.logLevel??"warn",scope:"ScarlettPlayer"}),this.errorHandler=new Ge(this.eventBus,this.logger),this.pluginManager=new Ye(this.eventBus,this.stateManager,this.logger,{container:this.container}),this.eventBus.on("error",t=>{this.stateManager.set("error",t)}),this.eventBus.on("media:loaded",()=>{this.stateManager.set("error",null)}),this.eventBus.on("media:error",({error:t})=>{this.errorHandler.record(t,{channel:"media:error"})}),this.wireFullscreenListeners(),e.plugins)for(let t of e.plugins)this.pluginManager.register(t);this.logger.info("ScarlettPlayer constructed",{autoplay:e.autoplay,plugins:e.plugins?.length??0})}ensureInitialized(){return this.initializing?this.initializing:(this.initializing=this.runInitialization().finally(()=>{this.initializing=null}),this.initializing)}async runInitialization(){for(let e of this.pluginManager.getPluginIds()){if(this.destroyed)return;let t=this.pluginManager.getPlugin(e);!t||t.type==="provider"||this.pluginManager.getPluginState(e)==="registered"&&await this.pluginManager.initPlugin(e)}this.destroyed||(this.wireLifecycleListeners(),this.readyEmitted||(this.readyEmitted=!0,this.eventBus.emit("player:ready",void 0)))}wireLifecycleListeners(){this.listenersWired||(this.listenersWired=!0,this.eventBus.on("live:seektolive",()=>{this.destroyed||this.seekToLive()}),this.eventBus.on("media:load-request",async({src:e,autoplay:t})=>{this.stateManager.getValue("chromecastActive")||await this.load(e,{autoplay:t!==!1})}),this.eventBus.on("error:retry",async({src:e})=>{let t=this.stateManager.getValue("live"),r=this.stateManager.getValue("currentTime");await this.load(e),!this.destroyed&&(this.stateManager.getValue("error")||(t?this.seekToLive():r>0&&this.seek(r),!this.destroyed&&await this.play()))}))}async init(){this.checkDestroyed(),await this.ensureInitialized(),this.initialSrc&&!this.initialSrcLoaded&&(this.initialSrcLoaded=!0,await this.load(this.initialSrc))}async load(e,t){this.checkDestroyed(),this.initialSrcLoaded=!0;let r=++this.loadGeneration;try{if(this.logger.info("Loading source",{source:e}),this.stateManager.update({playing:!1,paused:!0,ended:!1,buffering:!0,currentTime:0,duration:0,bufferedAmount:0,playbackState:"loading",error:null,live:!1}),this._currentProvider){let a=this._currentProvider.id;this.logger.info("Destroying previous provider",{provider:a}),await this.pluginManager.destroyPlugin(a),this._currentProvider=null}if(await this.ensureInitialized(),r!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}let i=this.pluginManager.selectProvider(e);if(!i){this.errorHandler.throw("PROVIDER_NOT_FOUND",`No provider found for source: ${e}`,{fatal:!0,context:{source:e}});return}if(this._currentProvider=i,this.logger.info("Provider selected",{provider:i.id}),await this.pluginManager.initPlugin(i.id),r!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}if(this.stateManager.set("source",{src:e,type:this.detectMimeType(e)}),typeof i.loadSource=="function"&&await i.loadSource(e),r!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}(t?.autoplay??this.stateManager.getValue("autoplay"))&&await this.play()}catch(i){r===this.loadGeneration&&(this.stateManager.getValue("error")?this.logger.error("Load failed",{source:J(e),error:i.message}):this.errorHandler.handle(i,{operation:"load",source:J(e)}))}}async play(){this.checkDestroyed();try{this.logger.debug("Play requested"),this.eventBus.emit("playback:play",void 0)}catch(e){this.errorHandler.handle(e,{operation:"play"})}}pause(){this.checkDestroyed();try{this.logger.debug("Pause requested"),this.seekingWhilePlaying=!1,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:pause",void 0)}catch(e){this.errorHandler.handle(e,{operation:"pause"})}}seek(e){if(this.checkDestroyed(),!Number.isFinite(e)){this.logger.warn("Invalid seek time",{time:e});return}try{this.logger.debug("Seek requested",{time:e}),this.stateManager.getValue("playing")&&(this.seekingWhilePlaying=!0),this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:seeking",{time:e}),this.stateManager.set("currentTime",e),this.seekingWhilePlaying&&(this.seekResumeTimeout=setTimeout(()=>{this.seekingWhilePlaying&&this.stateManager.getValue("playing")&&(this.logger.debug("Resuming playback after seek"),this.seekingWhilePlaying=!1,this.eventBus.emit("playback:play",void 0)),this.seekResumeTimeout=null},300))}catch(t){this.errorHandler.handle(t,{operation:"seek",time:e})}}setVolume(e){this.checkDestroyed();let t=Math.max(0,Math.min(1,e));this.stateManager.set("volume",t),this.eventBus.emit("volume:change",{volume:t,muted:this.stateManager.getValue("muted")})}setMuted(e){this.checkDestroyed(),this.stateManager.set("muted",e),this.eventBus.emit("volume:mute",{muted:e})}setPlaybackRate(e){this.checkDestroyed();let t=Math.max(.0625,Math.min(16,e));this.stateManager.set("playbackRate",t),this.eventBus.emit("playback:ratechange",{rate:t})}setAutoplay(e){this.checkDestroyed(),this.stateManager.set("autoplay",e),this.logger.debug("Autoplay set",{autoplay:e})}setPoster(e){this.checkDestroyed(),this.stateManager.set("poster",e),this.logger.debug("Poster set",{poster:e})}on(e,t){return this.checkDestroyed(),this.eventBus.on(e,t)}once(e,t){return this.checkDestroyed(),this.eventBus.once(e,t)}getPlugin(e){return this.checkDestroyed(),this.pluginManager.getPlugin(e)}registerPlugin(e){this.checkDestroyed(),this.pluginManager.register(e)}getState(){return this.checkDestroyed(),this.stateManager.snapshot()}subscribeToState(e){return this.checkDestroyed(),this.stateManager.subscribe(e)}getQualities(){if(this.checkDestroyed(),!this._currentProvider)return[];let e=this._currentProvider;return typeof e.getLevels=="function"?e.getLevels():[]}setQuality(e){if(this.checkDestroyed(),!this._currentProvider){this.logger.warn("No provider available for quality change");return}let t=this._currentProvider;if(typeof t.setLevel=="function"){if(e!==-1){let r=this.getQualities();if(r.length>0&&(e<0||e>=r.length)){this.logger.warn(`Invalid quality index: ${e} (available: ${r.length})`);return}}t.setLevel(e),this.eventBus.emit("quality:change",{quality:e===-1?"auto":`level-${e}`,auto:e===-1})}}getCurrentQuality(){if(this.checkDestroyed(),!this._currentProvider)return-1;let e=this._currentProvider;return typeof e.getCurrentLevel=="function"?e.getCurrentLevel():-1}wireFullscreenListeners(){let e=()=>{this.fullscreenAnnounced=!0,this.setFullscreenState(Te(this.container))};document.addEventListener("fullscreenchange",e),document.addEventListener("webkitfullscreenchange",e),this.container.addEventListener("webkitbeginfullscreen",e,!0),this.container.addEventListener("webkitendfullscreen",e,!0),this.unwireFullscreen=()=>{document.removeEventListener("fullscreenchange",e),document.removeEventListener("webkitfullscreenchange",e),this.container.removeEventListener("webkitbeginfullscreen",e,!0),this.container.removeEventListener("webkitendfullscreen",e,!0)}}setFullscreenState(e){this.stateManager.getValue("fullscreen")!==e&&(this.stateManager.set("fullscreen",e),this.eventBus.emit("fullscreen:change",{fullscreen:e}))}async requestFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Pe(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!0),this.eventBus.emit("fullscreen:change",{fullscreen:!0}))}catch(e){this.logger.error("Fullscreen request failed",{error:e})}}async exitFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Me(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!1),this.eventBus.emit("fullscreen:change",{fullscreen:!1}))}catch(e){this.logger.error("Exit fullscreen failed",{error:e})}}async toggleFullscreen(){this.fullscreen?await this.exitFullscreen():await this.requestFullscreen()}requestAirPlay(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.showPicker=="function"?e.showPicker():this.logger.warn("AirPlay plugin not available")}async requestChromecast(){this.checkDestroyed();let e=this.pluginManager.getPlugin("chromecast");e&&typeof e.requestSession=="function"?await e.requestSession():this.logger.warn("Chromecast plugin not available")}stopCasting(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.stop=="function"&&e.stop();let t=this.pluginManager.getPlugin("chromecast");t&&typeof t.stopSession=="function"&&t.stopSession()}seekToLive(){if(this.checkDestroyed(),!this.stateManager.getValue("live")){this.logger.warn("Not a live stream");return}if(this._currentProvider){let i=this._currentProvider;if(typeof i.getLiveInfo=="function"){let s=i.getLiveInfo();if(s?.liveSyncPosition!==void 0){this.seek(s.liveSyncPosition);return}}}let t=this.stateManager.getValue("seekableRange");if(t?.end!==void 0){this.seek(t.end);return}let r=this.stateManager.getValue("duration");Number.isFinite(r)&&r>0&&this.seek(r)}destroy(){return this.destroyPromise?this.destroyPromise:this.destroyed?Promise.resolve():(this.destroyPromise=(async()=>{this.logger.info("Destroying player"),this.destroyed=!0,this.loadGeneration++,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.unwireFullscreen?.(),this.unwireFullscreen=null,this.eventBus.emit("player:destroy",void 0);try{await this.pluginManager.destroyAll()}catch(e){this.logger.error("Error during plugin destruction",e)}this.eventBus.destroy(),this.stateManager.destroy(),this.logger.info("Player destroyed")})(),this.destroyPromise)}get playing(){return this.stateManager.getValue("playing")}get paused(){return this.stateManager.getValue("paused")}get currentTime(){return this.stateManager.getValue("currentTime")}get duration(){return this.stateManager.getValue("duration")}get volume(){return this.stateManager.getValue("volume")}get muted(){return this.stateManager.getValue("muted")}get playbackRate(){return this.stateManager.getValue("playbackRate")}get bufferedAmount(){return this.stateManager.getValue("bufferedAmount")}get currentProvider(){return this._currentProvider}get fullscreen(){return this.stateManager.getValue("fullscreen")}get live(){return this.stateManager.getValue("live")}get autoplay(){return this.stateManager.getValue("autoplay")}get poster(){return this.stateManager.getValue("poster")}checkDestroyed(){if(this.destroyed)throw new Error("Cannot call methods on destroyed player")}detectMimeType(e){let t=e;try{t=new URL(e).pathname}catch{let i=e.split("?")[0]??e;t=i.split("#")[0]??i}switch(t.split(".").pop()?.toLowerCase()??""){case"m3u8":return"application/x-mpegURL";case"mpd":return"application/dash+xml";case"mp4":case"m4v":return"video/mp4";case"webm":return"video/webm";case"ogg":case"ogv":return"video/ogg";case"mov":return"video/quicktime";case"mkv":return"video/x-matroska";case"mp3":return"audio/mpeg";case"wav":return"audio/wav";case"flac":return"audio/flac";case"aac":case"m4a":return"audio/mp4";default:return"video/mp4"}}};async function Bt(n){let e=new Lt(n);return await e.init(),e}function Vt(n){return n<10?`0${n}`:`${n}`}function ue(n){if(!isFinite(n)||isNaN(n))return"0:00";let e=Math.abs(n),t=Math.floor(e/3600),r=Math.floor(e%3600/60),i=Math.floor(e%60),s=n<0?"-":"";return t>0?`${s}${t}:${Vt(r)}:${Vt(i)}`:`${s}${r}:${Vt(i)}`}function we(n){return!Number.isFinite(n)||n<=0?"LIVE":`-${ue(n)}`}var je={play:"M8 5v14l11-7z",volumeHigh:"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",volumeMuted:"M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"};var St=new Map;function Ut(n,e){if(typeof document>"u")return()=>{};let t=document.getElementById(n),r=St.get(n);(!r||!t)&&(r={generation:(r?.generation??0)+1,holders:0,element:t},St.set(n,r)),r.holders+=1;let{generation:i}=r;if(!t){let a=document.createElement("style");a.id=n,a.textContent=e,document.head.appendChild(a),r.element=a}let s=!1;return()=>{if(s)return;s=!0;let a=St.get(n);!a||a.generation!==i||(a.holders-=1,!(a.holders>0)&&(St.delete(n),a.element?.remove()))}}var $t={};Br($t,{createHlsInstance:()=>Xr,describeSupport:()=>Yr,getHlsConstructor:()=>Jr,isHLSSupported:()=>Qr,isHlsJsSupported:()=>ar,loadHlsJs:()=>jr,resetLoader:()=>Zr,supportsNativeHLS:()=>sr});var ne=null,Ne=null,Gr=["application/vnd.apple.mpegurl","application/x-mpegURL"];function sr(){if(typeof document>"u")return!1;let n=document.createElement("video");return Gr.some(e=>n.canPlayType(e)!=="")}function ar(){return ne?ne.isSupported():typeof window>"u"?!1:!!(window.MediaSource||window.WebKitMediaSource)}function Qr(){return sr()||ar()}function Yr(){let n=typeof document>"u"?null:document.createElement("video"),e=r=>n?n.canPlayType(r):"",t=typeof window>"u"?{}:window;return{canPlayType:{"application/vnd.apple.mpegurl":e("application/vnd.apple.mpegurl"),"application/x-mpegURL":e("application/x-mpegURL")},MediaSource:typeof t.MediaSource,ManagedMediaSource:typeof t.ManagedMediaSource,WebKitMediaSource:typeof t.WebKitMediaSource,hlsJsLoaded:ne!==null,hlsJsSupported:ne?ne.isSupported():null,userAgent:typeof navigator>"u"?"":navigator.userAgent}}async function jr(){return ne||Ne||(Ne=(async()=>{try{if(ne=(await import("./hls-SXYGB37P.js")).default,!ne.isSupported())throw new Error("hls.js is not supported in this browser");return ne}catch(n){throw Ne=null,new Error(`Failed to load hls.js: ${n instanceof Error?n.message:"Unknown error"}`)}})(),Ne)}function Xr(n){if(!ne)throw new Error("hls.js is not loaded. Call loadHlsJs() first.");return new ne(n)}function Jr(){return ne}function Zr(){ne=null,Ne=null}function _e(n){if(n.name)return n.name;if(n.height){let e={2160:"4K",1440:"1440p",1080:"1080p",720:"720p",480:"480p",360:"360p",240:"240p",144:"144p"},t=Object.keys(e).map(Number).sort((r,i)=>Math.abs(r-n.height)-Math.abs(i-n.height))[0];return Math.abs(t-n.height)<=20?e[t]:`${n.height}p`}return n.bitrate?ei(n.bitrate):"Unknown"}function ei(n){return n>=1e6?`${(n/1e6).toFixed(1)} Mbps`:n>=1e3?`${Math.round(n/1e3)} Kbps`:`${n} bps`}function or(n,e){return n.map((t,r)=>({index:r,width:t.width||0,height:t.height||0,bitrate:t.bitrate||0,label:_e(t),codec:t.codecSet}))}function lr(n){if(n!==void 0&&n>0)return n;let t=navigator.connection;if(t?.downlink&&t.downlink>0){let r=t.downlink*1e6;return Math.round(r*.85)}return 5e5}function de(n){return typeof n=="number"&&Number.isFinite(n)?n:null}function ti(n){if(!n)return null;let e=de(n.fragmentStart)??de(n.fragments?.[0]?.start)??0,t=de(n.totalduration),r=de(n.edge)??(t===null?null:e+t);return r===null?null:{start:e,end:r}}function cr(n){let e=n?.seekable;if(!e||e.length===0)return null;let t=e.start(0),r=e.end(e.length-1);return!Number.isFinite(t)||!Number.isFinite(r)?null:{start:t,end:r}}function ri(n){if(!n)return null;let e=de(n.targetduration);return de(n.partHoldBack)??de(n.holdBack)??(e!==null?e*3:null)}function ii(n,e){let t=de(n?.targetduration),r=t!==null?t/2:e/2;return Math.max(1.5,de(n?.partTarget)??r)}function Ae(n){if(n.kind==="hls"){let{hls:a,details:c}=n,o=a.media,u=ti(c)??cr(o),v=de(a.targetLatency)??ri(c)??3,P=de(a.latency)??(u&&o?Math.max(0,u.end-o.currentTime):null);if(P===null&&u===null)return null;let C=P??0;return{latency:C,targetLatency:v,atEdge:C<=v+ii(c,v),seekableRange:u,lowLatency:n.lowLatencyRequested!==!1&&(!!c?.partList?.length||c?.canBlockReload===!0)}}let{media:e}=n,t=cr(e);if(!t)return null;let r=n.targetLatency??3,i=n.targetLatency===void 0?7:Math.max(1.5,n.targetLatency/2),s=Math.max(0,t.end-e.currentTime);return{latency:s,targetLatency:r,atEdge:s<=r+i,seekableRange:t,lowLatency:n.lowLatency===!0}}function zt(n,e){if(!e)return;let t=n.getState("liveLatency");Math.abs(t-e.latency)>.05&&(n.setState("liveLatency",e.latency),n.emit("live:latency",{latency:e.latency})),n.getState("liveEdge")!==e.atEdge&&(n.setState("liveEdge",e.atEdge),n.emit("live:edgechange",{atEdge:e.atEdge}));let r=e.seekableRange;if(r){let i=n.getState("seekableRange");(!i||Math.abs(i.start-r.start)>.05||Math.abs(i.end-r.end)>.05)&&(n.setState("seekableRange",{start:r.start,end:r.end}),n.emit("live:seekablerange",{start:r.start,end:r.end}))}n.getState("lowLatencyMode")!==e.lowLatency&&(n.setState("lowLatencyMode",e.lowLatency),n.emit("live:lowlatency",{enabled:e.lowLatency}))}function xt(n){n.getState("lowLatencyMode")&&(n.setState("lowLatencyMode",!1),n.emit("live:lowlatency",{enabled:!1})),n.setState("liveLatency",0),n.setState("liveEdge",!1),n.setState("seekableRange",null)}var qt={NETWORK_ERROR:"networkError",MEDIA_ERROR:"mediaError",KEY_SYSTEM_ERROR:"keySystemError",MUX_ERROR:"muxError",OTHER_ERROR:"otherError"};function ni(n){switch(n){case qt.NETWORK_ERROR:return"network";case qt.MEDIA_ERROR:return"media";case qt.MUX_ERROR:return"mux";default:return"other"}}function si(n){let e=n.frag,t=n.response,r=n.context;return{type:ni(n.type),details:n.details||"Unknown error",fatal:n.fatal||!1,url:n.url??e?.url??t?.url??r?.url,reason:n.reason,response:n.response}}function ai(n){return`audio-${n}`}function dr(n){if(!n)return-1;let e=/^audio-(0|[1-9]\d*)$/.exec(n);return e?Number.parseInt(e[1],10):-1}function oi(n,e,t){return{id:ai(e),label:n.name||n.lang||`Audio ${e+1}`,language:n.lang,active:t}}function ur(n,e){if(!n||typeof n!="object")return null;let{type:t,stats:r}=n;if(t!=="main"&&t!=="audio"&&t!=="subtitle")return null;let i=r?.loading?.start,s=r?.loading?.end,a=r?.loaded;return typeof i!="number"||!Number.isFinite(i)||typeof s!="number"||!Number.isFinite(s)||s<i||typeof a!="number"||!Number.isFinite(a)||a<0?null:{durationMs:s-i,bytes:a,ok:e,kind:t}}function pr(n,e,t){let r=[],i=(c,o)=>{n.on(c,o),r.push({event:c,handler:o})};i("hlsManifestParsed",(c,o)=>{e.logger.debug("HLS manifest parsed",{levels:o.levels.length});let u=o.levels.map((v,P)=>({id:`level-${P}`,label:_e(v),width:v.width,height:v.height,bitrate:v.bitrate,active:P===n.currentLevel}));e.setState("qualities",u),e.emit("quality:levels",{levels:u.map(v=>({id:v.id,label:v.label}))}),t.onManifestParsed?.(o.levels,o)}),i("hlsLevelSwitched",(c,o)=>{let u=n.levels[o.level],v=t.getIsAutoQuality?.()??n.autoLevelEnabled;if(e.logger.debug("HLS level switched",{level:o.level,height:u?.height,auto:v}),u){let P=v?`Auto (${_e(u)})`:_e(u);e.setState("currentQuality",{id:v?"auto":`level-${o.level}`,label:P,width:u.width,height:u.height,bitrate:u.bitrate,active:!0})}e.emit("quality:change",{quality:u?`level-${o.level}`:"auto",auto:v}),t.onLevelSwitched?.(o.level)});let s=(c,o)=>{let u=c.map((v,P)=>oi(v,P,P===o));e.setState("audioTracks",u),e.setState("currentAudioTrack",u[o]??null)};i("hlsAudioTracksUpdated",(c,o)=>{let u=o.audioTracks??[];e.logger.debug("HLS audio tracks updated",{tracks:u.length}),s(u,n.audioTrack),t.onAudioTracksUpdated?.(u)}),i("hlsAudioTrackSwitched",(c,o)=>{e.logger.debug("HLS audio track switched",{id:o.id}),s(n.audioTracks??[],o.id),t.onAudioTrackSwitched?.(o.id)});let a=0;return i("hlsFragLoaded",(c,o)=>{let u=ur(o?.frag,!0);u&&e.emit("media:segment",u);let v=Date.now();v-a>=2e3&&n.bandwidthEstimate&&(a=v,e.setState("bandwidth",Math.round(n.bandwidthEstimate))),t.onFragLoaded?.()}),i("hlsFragBuffered",()=>{e.setState("buffering",!1),t.onBufferUpdate?.()}),i("hlsFragLoading",()=>{e.setState("buffering",!0)}),i("hlsLevelLoaded",(c,o)=>{o.details?.live!==void 0&&(e.setState("live",o.details.live),o.details.live?(t.onLevelDetails?.(o.details),zt(e,Ae({kind:"hls",hls:n,details:o.details,lowLatencyRequested:t.isLowLatencyRequested?.()??!0}))):xt(e),t.onLiveUpdate?.())}),i("hlsError",(c,o)=>{let u=si(o);if(!u.fatal&&(u.details==="fragLoadError"||u.details==="fragLoadTimeOut")){let P=ur(o.frag,!1);P&&e.emit("media:segment",P)}!u.fatal&&(u.details?.includes("bufferStalledError")||o.reason?.includes("buffer holes"))?e.logger.debug(`HLS buffer recovery: ${u.reason||u.details}`,{details:u.details,reason:u.reason}):u.fatal?e.logger.error(`HLS fatal error: ${u.details} (type=${u.type})`,{type:u.type,details:u.details,status:u.response?.code,url:J(u.url)}):e.logger.warn(`HLS error: ${u.details} (type=${u.type}, fatal=${u.fatal})`,{type:u.type,details:u.details,fatal:u.fatal,status:u.response?.code,url:J(u.url)}),t.onError?.(u)}),()=>{for(let{event:c,handler:o}of r)n.off(c,o);r.length=0,e.setState("audioTracks",[]),e.setState("currentAudioTrack",null)}}function Kt(n,e,t,r){let i=[],s=(o,u)=>{n.addEventListener(o,u),i.push({event:o,handler:u})},a=()=>{n.ended||!e.getState("ended")||(e.setState("ended",!1),e.setState("playbackState",n.paused?"paused":"playing"))};s("play",()=>{e.setState("paused",!1),a()}),s("playing",()=>{e.setState("playing",!0),e.setState("paused",!1),e.setState("waiting",!1),e.setState("buffering",!1),e.setState("playbackState","playing"),a(),r&&(r.corePauseRequested=!1),r?.corePlayRequested?r.corePlayRequested=!1:e.emit("playback:play",void 0)}),s("pause",()=>{e.setState("playing",!1),e.setState("paused",!0),e.setState("playbackState","paused"),r&&(r.corePlayRequested=!1),r?.corePauseRequested?r.corePauseRequested=!1:e.emit("playback:pause",void 0)}),s("ended",()=>{e.setState("playing",!1),e.setState("ended",!0),e.setState("playbackState","ended"),e.emit("playback:ended",void 0)}),s("timeupdate",()=>{e.setState("currentTime",n.currentTime),e.emit("playback:timeupdate",{currentTime:n.currentTime}),(e.getState("live")||!Number.isFinite(n.duration))&&zt(e,t?t():Ae({kind:"media",media:n}))}),s("durationchange",()=>{let o=n.duration;!Number.isFinite(o)||o===1/0?(e.setState("live",!0),e.setState("duration",0)):e.setState("duration",o||0),e.emit("media:loadedmetadata",{duration:e.getState("duration")})}),s("waiting",()=>{e.setState("waiting",!0),e.setState("buffering",!0),e.emit("media:waiting",void 0)}),s("canplay",()=>{e.setState("waiting",!1),e.setState("playbackState","ready"),e.emit("media:canplay",void 0)}),s("canplaythrough",()=>{e.setState("buffering",!1),e.emit("media:canplaythrough",void 0)}),s("progress",()=>{if(n.buffered.length>0){let o=n.buffered.end(n.buffered.length-1),u=n.duration>0?o/n.duration:0;e.setState("bufferedAmount",u),e.setState("buffered",n.buffered),e.emit("media:progress",{buffered:u})}}),s("seeking",()=>{e.setState("currentTime",n.currentTime),e.setState("seeking",!0),a()}),s("seeked",()=>{e.setState("seeking",!1),e.emit("playback:seeked",{time:n.currentTime})}),s("volumechange",()=>{e.setState("volume",n.volume),e.setState("muted",n.muted),e.emit("volume:change",{volume:n.volume,muted:n.muted})}),s("ratechange",()=>{e.setState("playbackRate",n.playbackRate),e.emit("playback:ratechange",{rate:n.playbackRate})}),s("loadedmetadata",()=>{e.setState("duration",n.duration)}),s("error",()=>{let o=n.error;if(o){e.logger.error("Video element error",{code:o.code,message:o.message});let u=new Error(o.message||"Video playback error");typeof o.code=="number"&&o.code>0&&Object.assign(u,{code:o.code,detail:{mediaErrorCode:o.code}}),e.emit("media:error",{error:u})}}),s("enterpictureinpicture",()=>{e.setState("pip",!0),e.logger.debug("PiP: entered (standard)")}),s("leavepictureinpicture",()=>{e.setState("pip",!1),e.logger.debug("PiP: exited (standard)"),(!n.paused||e.getState("playing"))&&n.play().catch(()=>{})});let c=n;return"webkitPresentationMode"in n&&s("webkitpresentationmodechanged",()=>{let o=c.webkitPresentationMode,u=o==="picture-in-picture";e.setState("pip",u),e.logger.debug(`PiP: mode changed to ${o} (webkit)`),o==="inline"&&n.paused&&n.play().catch(()=>{})}),()=>{for(let{event:o,handler:u}of i)n.removeEventListener(o,u);i.length=0}}var li=["loadedmetadata","loadeddata","resize","playing"],ci=["addtrack","removetrack","change"];function Wt(n){return typeof n=="object"&&n!==null&&typeof n.length=="number"}function hr(n){let e=null,t=!1,r=!1,i=!1,s=null,a=[],c=null,o=!1,u=()=>t?"video":r?"audio":"unknown",v=()=>{let _=u();_!==c&&(c=_,n.setState("mediaType",_))},P=()=>{let _=s;if(!_)return;if(i&&_.videoWidth>0){t=!0;return}if(_.readyState<1)return;let V=_.videoTracks,I=_.audioTracks;if(Wt(V)){if(V.length>0){t=!0;return}Wt(I)&&I.length>0&&(r=!0)}},C=()=>{o||(P(),v())},Y=()=>{for(let _ of a)_();a=[],s=null};return{beginSource(_){o||e!==_&&(e=_,t=!1,r=!1,i=!1,c=null,v())},attach(_){if(!o){Y(),s=_,i=!1;for(let V of li){let I=()=>{i=!0,C()};_.addEventListener(V,I),a.push(()=>_.removeEventListener(V,I))}for(let V of[s.videoTracks,s.audioTracks])if(!(!Wt(V)||typeof V.addEventListener!="function"))for(let I of ci){let w=()=>C();V.addEventListener(I,w),a.push(()=>V.removeEventListener?.(I,w))}C()}},noteManifestParsed(_){if(o||!_)return;let V=typeof _.video=="boolean"?_.video:null,I=typeof _.audio=="boolean"?_.audio:null;V===!0?t=!0:V===!1&&I===!0&&(r=!0),v()},evaluate:C,current(){return u()},destroy(){o||(o=!0,Y())}}}var Gt="Invalid playlist document",ui=["level","audioTrack","subtitleTrack"];function di(n,e){if(typeof n!="string"||n.length===0)return!1;let t=n.trimStart();return t.startsWith("#EXTM3U")?e&&ui.includes(e)?/^#EXT(?:INF|-X-TARGETDURATION):/m.test(t):!0:!1}function gr(n){let e=n.DefaultConfig.loader;return class extends e{load(r,i,s){let a={...s,onSuccess:(c,o,u,v)=>{if(!di(c?.data,u?.type)){s.onError({code:0,text:Gt},u,v,o);return}s.onSuccess(c,o,u,v)}};super.load(r,i,a)}}}var fr=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";function pi(n){let e=`'${n.canPlayType["application/vnd.apple.mpegurl"]}'/'${n.canPlayType["application/x-mpegURL"]}'`,t=n.hlsJsLoaded?`isSupported ${String(n.hlsJsSupported)}`:"not loaded";return[`native: ${e}`,`MediaSource: ${n.MediaSource}`,`ManagedMediaSource: ${n.ManagedMediaSource}`,`WebKitMediaSource: ${n.WebKitMediaSource}`,`hls.js: ${t}`].join(", ")}var hi={debug:!1,autoStartLoad:!0,startPosition:-1,lowLatencyMode:!1,maxBufferLength:30,maxMaxBufferLength:600,backBufferLength:30,enableWorker:!0,capLevelToPlayerSize:!0,maxNetworkRetries:3,maxMediaRetries:2,retryDelayMs:1e3,retryBackoffFactor:2,loadTimeoutMs:3e4,autoReconnect:!0,reconnectBaseDelayMs:2e3,reconnectMaxDelayMs:3e4,reconnectWindowMs:3e5,validatePlaylists:!0},gi=1.1,fi=["manifestLoadError","manifestLoadTimeOut","manifestParsingError"],kt="Video took too long to load (network timeout)";function mr(n,e){let t=n?.code,i={type:(e==="initial"?t!==MediaError.MEDIA_ERR_DECODE:t===MediaError.MEDIA_ERR_NETWORK)?"network":"media",details:n?.message||(e==="initial"?"Failed to load HLS source":"Native HLS playback error"),fatal:!0};return typeof t=="number"&&t>0&&(i.mediaErrorCode=t),n?.message&&(i.mediaErrorMessage=n.message),i}function vr(n,e,t){let r={...hi,...t},i=null,s=null,a=null,c=!1,o=null,u=null,v=null,P=!0,C={corePlayRequested:!1,corePauseRequested:!1},Y=null,_=null,V=null,I=null,w=0,Z=null,x=0,A=0,R=null,se=0,m=0,K=10,ee=5e3,L=!1,U=null,z=0,S=0,N=0,k=null,$=null,G=!1,ae=!1,ge=!1,re=null,te=0,ye=0,Le=()=>{let l=s&&!c?Ae({kind:"hls",hls:s,details:_,lowLatencyRequested:r.lowLatencyMode===!0}):a?Ae({kind:"media",media:a,targetLatency:I??void 0,lowLatency:V?.lowLatency}):null;return l&&(V=l,s&&!c&&(I=l.targetLatency)),l},gt=()=>a?.seekable?.length?a.seekable.end(a.seekable.length-1):void 0,Ce=(l,p)=>{if(s&&!c&&typeof s.liveSyncPosition=="number")return s.liveSyncPosition;let d=gt()??l?.seekableRange?.end;return d!==void 0?Math.max(0,d-p):void 0},ft=l=>{if(!a)return l;if(i?.getState("live")){let p=Le(),d=(s&&!c?s.targetLatency:void 0)||p?.targetLatency||3,h=p?.seekableRange?.start??0,b=Ce(p,d),M=b!==void 0?Math.max(h,b):l;return Math.max(h,Math.min(l,M))}return Math.max(0,Math.min(l,a.duration||0))},Be=()=>{a&&(a.poster=i?.getState("poster")||"")},Ve=()=>{if(a)return a;let l=i?.container.querySelector("video");return l?(a=l,a):(a=document.createElement("video"),a.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",a.preload="metadata",a.controls=!1,a.playsInline=!0,Be(),i?.container.appendChild(a),a)},Se=l=>{Z?.(l??new Error("HLS load cancelled")),Z=null,u?.(),u=null,v?.(),v=null,R&&(clearTimeout(R),R=null),re&&(clearTimeout(re),re=null),s&&(s.destroy(),s=null)},He=l=>{Se(l),o=null,c=!1,P=!0,x=0,A=0,se=0,m=0,_=null,V=null,I=null,i&&xt(i)},At=()=>{let l=Ht();if(r.validatePlaylists!==!1){let p=n.getHlsConstructor();p&&p.DefaultConfig?.loader&&(l.pLoader=gr(p))}return l},Ct=()=>{let l={},p=(X,le)=>{le!==void 0&&(l[X]=le)},d=r.liveSyncDuration,h=r.liveSyncDurationCount,b=r.liveMaxLatencyDuration,M=r.liveMaxLatencyDurationCount,D=(d!==void 0||b!==void 0)&&(h!==void 0||M!==void 0),F=D&&d!==void 0,j=D&&!F;return D&&i?.logger.warn(`Ignoring ${F?"liveSyncDurationCount/liveMaxLatencyDurationCount":"liveSyncDuration/liveMaxLatencyDuration"}: hls.js rejects a config mixing seconds-based and count-based live latency options`),p("liveSyncDuration",j?void 0:d),p("liveSyncDurationCount",F?void 0:h),p("liveMaxLatencyDuration",j?void 0:b),p("liveMaxLatencyDurationCount",F?void 0:M),p("liveDurationInfinity",r.liveDurationInfinity),p("maxLiveSyncPlaybackRate",r.maxLiveSyncPlaybackRate??(r.lowLatencyMode===!0?gi:void 0)),l},Ht=()=>({debug:r.debug,autoStartLoad:r.autoStartLoad,startPosition:r.startPosition,startLevel:-1,abrEwmaDefaultEstimate:lr(r.initialBandwidthEstimate),lowLatencyMode:r.lowLatencyMode,maxBufferLength:r.maxBufferLength,maxMaxBufferLength:r.maxMaxBufferLength,backBufferLength:r.backBufferLength,enableWorker:r.enableWorker,capLevelToPlayerSize:r.capLevelToPlayerSize,fragLoadingMaxRetry:1,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:1,fragLoadingRetryDelay:500,manifestLoadingRetryDelay:500,levelLoadingRetryDelay:500,...Ct()}),xe=l=>{let p=r.retryDelayMs??1e3,d=r.retryBackoffFactor??2;return p*Math.pow(d,l)*(.7+Math.random()*.3)},Rt=["bufferAppendError","bufferAppendingError","bufferAddCodecError"],mt=l=>{if(l.response?.text===Gt)return"PLAYLIST_INVALID";if(l.details==="bufferFullError")return"MEDIA_BUFFER_FULL";if(Rt.includes(l.details))return"MEDIA_APPEND_ERROR";switch(l.type){case"network":return"MEDIA_NETWORK_ERROR";case"media":case"mux":return"MEDIA_DECODE_ERROR";default:return"PLAYBACK_FAILED"}},Dt=(l,p)=>{let d=l.attempts??(l.type==="network"?x:l.type==="media"?A:0),h={type:l.type,retriesExhausted:p,attempts:d};l.mediaErrorCode!==void 0&&(h.mediaErrorCode=l.mediaErrorCode),l.mediaErrorMessage!==void 0&&(h.mediaErrorMessage=l.mediaErrorMessage),l.timedOut&&(h.timedOut=!0),typeof l.response?.code=="number"&&l.response.code>0&&(h.httpStatus=l.response.code);let b=J(l.url);return b&&(h.url=b),h},oe=(l,p,d)=>{let h=d??(p?`HLS error: ${l.details} (max retries exceeded)`:`HLS error: ${l.details}`);i?.logger.error(h,{type:l.type,details:l.details}),i?.setState("playbackState","error"),i?.setState("buffering",!1),i?.emit("error",{code:mt(l),message:h,fatal:!0,timestamp:Date.now(),detail:Dt(l,p)}),$e(l)},fe=l=>{if(!n.getHlsConstructor()||!s)return!1;if(l.fatal){let d=Date.now();if(d-m>ee?(se=1,m=d):se++,se>=K)return i?.logger.error(`Too many fatal errors (${se} in ${ee}ms), giving up`),oe(l,!0),Se(new Error(l.details)),!0;switch(i?.logger.error("Fatal HLS error",{type:l.type,details:l.details}),l.type){case"network":{let h=r.maxNetworkRetries??3;if(x>=h)return i?.logger.error(`Network error recovery failed after ${x} attempts`),oe(l,!0),!0;x++;let b=xe(x-1);i?.logger.info(`Attempting network error recovery (attempt ${x}/${h}) in ${b}ms`),i?.emit("error:network",{error:new Error(l.details)}),R&&clearTimeout(R);let M=fi.includes(l.details),D=w;R=setTimeout(()=>{D!==w||!s||(M&&o?s.loadSource(o):s.startLoad())},b);break}case"media":{let h=r.maxMediaRetries??2;if(A>=h)return i?.logger.error(`Media error recovery failed after ${A} attempts`),oe(l,!0),!0;A++;let b=xe(A-1);i?.logger.info(`Attempting media error recovery (attempt ${A}/${h}) in ${b}ms`),i?.emit("error:media",{error:new Error(l.details)}),R&&clearTimeout(R);let M=w;R=setTimeout(()=>{M!==w||!s||s.recoverMediaError()},b);break}default:return oe(l,!1),!0}}return!1},vt=(l,p)=>{let d=l.type==="network",h=d?r.maxNetworkRetries??3:r.maxMediaRetries??2,b=d?x:A;if(!o||b>=h){oe(l,b>=h);return}let M=p??a?.currentTime??0;d?x++:A++;let D=b+1,F=xe(D-1);i?.logger.info(`Attempting native ${l.type} error recovery (attempt ${D}/${h}) in ${F}ms`),i?.emit(d?"error:network":"error:media",{error:new Error(l.details)}),R&&clearTimeout(R);let j=w;R=setTimeout(()=>{j===w&&me(l,M)},F)},me=async(l,p)=>{if(!o)return;let d=++w,h=o,b=i?.getState("live")??!1;try{if(Se(new Error("HLS load cancelled: native error recovery")),i?.setState("playbackState","loading"),await be(h),d!==w)return;!b&&a&&p>0&&(a.currentTime=p),i?.setState("playbackState","ready"),i?.setState("buffering",!1);try{await a?.play()}catch{}}catch{if(d!==w)return;i?.logger.warn("Native error recovery attempt failed"),vt(l,p)}},be=async(l,p=!1)=>{let d=w,h=Ve();return c=!0,i&&(v=Kt(h,i,Le,C)),Y?.beginSource(l),Y?.attach(h),new Promise((b,M)=>{let D=null,F=!1,j=null,X=()=>{F=!0,Z===le&&(Z=null),h.removeEventListener("loadedmetadata",ke),h.removeEventListener("error",H),D!==null&&(clearTimeout(D),D=null)},le=T=>{F||(X(),M(T))};Z=le;let ke=()=>{if(F)return;if(d!==w){X(),M(new Error("HLS load cancelled"));return}X(),L=!0,p&&(x=0,A=0);let T=()=>{vt(mr(h.error,"playback"))};h.addEventListener("error",T);let O=()=>{(x>0||A>0)&&(i?.logger.debug("Native playback recovered, resetting retry budgets"),x=0,A=0)};h.addEventListener("playing",O);let ce=()=>{h.removeEventListener("error",T),h.removeEventListener("playing",O)},he=v;v=()=>{ce(),he?.()},i?.setState("source",{src:l,type:"application/x-mpegURL"}),i?.emit("media:loaded",{src:l,type:"application/x-mpegURL"}),b()},H=()=>{if(F)return;if(!p||d!==w){X(),M(new Error(h.error?.message||"Failed to load HLS source"));return}let T=mr(h.error,"initial");j=T;let O=T.type==="network",ce=O?r.maxNetworkRetries??3:r.maxMediaRetries??2,he=O?x:A;if(he>=ce){X(),i?.logger.error(`Native HLS load failed after ${he} ${T.type} retries`,{src:J(l)}),oe(T,!0),M(new Error(T.details));return}O?x++:A++;let yt=xe(he);i?.logger.info(`Retrying native HLS load after ${T.type} error (attempt ${he+1}/${ce}) in ${yt}ms`),i?.emit(O?"error:network":"error:media",{error:new Error(T.details)}),R&&clearTimeout(R),R=setTimeout(()=>{R=null,!(F||d!==w)&&(h.src=l,h.load())},yt)},ie=r.loadTimeoutMs??3e4;ie>0&&(D=setTimeout(()=>{if(F||d!==w)return;if(X(),!p){M(new Error(kt));return}R&&(clearTimeout(R),R=null),i?.logger.error(`Native HLS load timed out after ${ie}ms`,{src:J(l)});let T={type:"network",details:kt,fatal:!0,timedOut:!0,attempts:x+A};j?.mediaErrorCode!==void 0&&(T.mediaErrorCode=j.mediaErrorCode),j?.mediaErrorMessage!==void 0&&(T.mediaErrorMessage=j.mediaErrorMessage),oe(T,!1,kt),M(new Error(kt))},ie)),h.addEventListener("loadedmetadata",ke),h.addEventListener("error",H),h.src=l,h.load()})},ve=async l=>{let p=w;if(await n.loadHlsJs(),p!==w)throw new Error("HLS load cancelled");let d=Ve();return c=!1,s=n.createHlsInstance(At()),i&&(v=Kt(d,i,Le,C)),Y?.beginSource(l),Y?.attach(d),new Promise((h,b)=>{if(!s||!i){b(new Error("HLS not initialized"));return}let M=!1,D=null,F=()=>{D!==null&&(clearTimeout(D),D=null)},j=T=>{M||(M=!0,F(),b(T))};Z=j;let X=()=>{Z===j&&(Z=null)};u=pr(s,i,{onManifestParsed:(T,O)=>{p===w&&(Y?.noteManifestParsed(O),M||(M=!0,X(),F(),L=!0,i?.setState("source",{src:l,type:"application/x-mpegURL"}),i?.emit("media:loaded",{src:l,type:"application/x-mpegURL"}),h()))},onLevelSwitched:()=>{},onLevelDetails:T=>{p===w&&(_=T,Le())},isLowLatencyRequested:()=>r.lowLatencyMode===!0,onError:T=>{if(p!==w)return;fe(T)&&!M&&(M=!0,X(),F(),b(new Error(T.details)))},onFragLoaded:()=>{p===w&&(x>0||A>0)&&(i?.logger.debug("Playback recovered, resetting retry budgets"),x=0,A=0)},getIsAutoQuality:()=>P});let le=s,ke=(T,O)=>{if(p!==w||s!==le||!i||O?.fatal!==!1||O.details!=="fragLoadError"&&O.details!=="fragLoadTimeOut")return;let ce=O.frag?.type,he=O.frag?.stats?.loading?.start,yt=O.frag?.stats?.loading?.end,bt=O.frag?.stats?.loaded;if(ce!=="main"&&ce!=="audio"&&ce!=="subtitle"||typeof he!="number"||!Number.isFinite(he)||yt!==0||typeof bt!="number"||!Number.isFinite(bt)||bt<0)return;let Nt=performance.now()-he;!Number.isFinite(Nt)||Nt<0||i.emit("media:segment",{kind:ce,durationMs:Nt,bytes:bt,ok:!1})};le.on("hlsError",ke);let H=u;u=()=>{le.off("hlsError",ke),H?.()};let ie=r.loadTimeoutMs??3e4;ie>0&&(D=setTimeout(()=>{if(M||p!==w)return;M=!0,X(),i?.logger.error(`HLS load timed out after ${ie}ms`,{src:J(l)});let T={type:"network",details:"Video took too long to load (network timeout)",fatal:!0};oe(T,!0),Se(),b(new Error(T.details))},ie)),s.attachMedia(d),s.loadSource(l)})},Ee=()=>{U&&(clearTimeout(U),U=null),z=0,S=0,N=0,$=null,G=!1,ae=!1},Re=()=>{if(!a||re)return;te=Date.now(),ye=a.currentTime;let l=s?.targetDuration??s?.levels?.[s?.currentLevel]?.details?.targetduration??0,p=Math.max(15,4*(l||0)||15),d=Math.min(p*1e3,3e4),h=()=>{if(!a||!i)return;let b=i.getState("playing"),M=i.getState("seeking");if(!b||M){re=setTimeout(h,d);return}let D=Date.now()-te;if(a.currentTime-ye>.5)te=Date.now(),ye=a.currentTime;else if(D>p*1e3){i.logger.warn("Playback stall detected \u2014 no timeupdate progress",{elapsed:Math.round(D),currentTime:a.currentTime,targetDuration:Math.round(p)}),$e({type:"network",details:"Playback stalled \u2014 no data received",fatal:!0});return}re=setTimeout(h,d)};re=setTimeout(h,d)},pe=()=>{re&&(clearTimeout(re),re=null)},It=(l,p)=>{if(G)return;G=!0;let d=z,h=$;i?.emit("error:reconnect-exhausted",{attempts:d,elapsedMs:l,windowMs:p}),i?.setState("playbackState","error"),i?.setState("buffering",!1),i?.emit("error",{code:h?mt(h):"PLAYBACK_FAILED",message:`HLS auto-reconnect gave up after ${d} attempts over ${Math.round(l/1e3)}s`,fatal:!0,timestamp:Date.now(),detail:{type:h?.type??"other",retriesExhausted:!0,attempts:d,reconnectExhausted:!0}})},Ue=()=>{if(G||U)return;let l=(i?.getState("live")??!1)&&ge,p=r.reconnectWindowMs??3e5,d=l?1/0:p,h=Date.now()-S;if(h>d){i?.logger.warn(`Auto-reconnect window exhausted after ${z} attempts`),It(h,d);return}l&&h>6e5&&i?.emit("error:reconnecting",{attempt:z+1,delayMs:0,elapsedMs:h,windowMs:d,longOutage:!0});let M=r.reconnectBaseDelayMs??2e3,D=r.reconnectMaxDelayMs??3e4,F=Math.min(M*Math.pow(2,z),D),j=F>=D,X=l&&j?3e4:Math.round(F*(.7+Math.random()*.3));i?.logger.info(`Scheduling auto-reconnect attempt ${z+1} in ${X}ms`),i?.emit("error:reconnecting",{attempt:z+1,delayMs:X,elapsedMs:h,windowMs:d}),U=setTimeout(()=>{U=null,g()},X)},$e=l=>{r.autoReconnect===!1||!o||!((i?.getState("live")??!1)&&ge)&&!L||l.type!=="network"&&l.type!=="media"||(S===0&&(S=Date.now(),N=a?.currentTime??0,$=l),Ue())},g=async()=>{if(!i||!o)return;ae=!0;let l=++w;z++;let p=o,d=i.getState("live"),h=c,b=N;i.logger.info(`Auto-reconnect attempt ${z}`,{src:J(p)});try{if(Se(new Error("HLS load cancelled: reconnecting")),x=0,A=0,se=0,m=0,o=p,i.setState("playbackState","loading"),h&&n.supportsNativeHLS()?await be(p):await ve(p),l!==w)return;if(!d&&a&&b>0&&(a.currentTime=b),i.setState("playbackState","ready"),i.setState("buffering",!1),i.emit("error:recovered",{attempt:z,elapsedMs:Date.now()-S}),i.logger.info("Auto-reconnect succeeded"),Ee(),i.getState("paused"))i.logger.info("Stream reconnected while paused; maintaining pause at live edge");else try{await a?.play()}catch{}}catch{if(l!==w)return;i?.logger.warn(`Auto-reconnect attempt ${z} failed`),Ue()}finally{ae=!1}};return{id:"hls-provider",name:e.name,version:fr,type:"provider",description:e.description,canPlay(l){let p=l.toLowerCase();return!!(p.split("?")[0].split("#")[0].endsWith(".m3u8")||p.includes("application/x-mpegurl")||p.includes("application/vnd.apple.mpegurl"))},async init(l){i=l,i.logger.info(`HLS plugin${e.logSuffix} initialized`),Y=hr(i);let p=i.on("playback:play",async()=>{if(a&&a.paused)try{C.corePlayRequested=!0,await a.play()}catch(H){C.corePlayRequested=!1,i?.logger.error("Play failed",H)}}),d=i.on("playback:pause",()=>{if(a){if(a.paused){C.corePlayRequested&&(C.corePlayRequested=!1,a.pause());return}C.corePauseRequested=!0,C.corePlayRequested=!1,a.pause()}}),h=i.on("playback:seeking",({time:H})=>{a&&Number.isFinite(H)&&(a.currentTime=ft(H))}),b=i.on("volume:change",({volume:H})=>{a&&(a.volume=H)}),M=i.on("volume:mute",({muted:H})=>{a&&(a.muted=H)}),D=i.on("playback:ratechange",({rate:H})=>{a&&(a.playbackRate=H)}),F=i.on("quality:select",({quality:H,auto:ie})=>{if(!s||c){i?.logger.warn("Quality selection not available");return}if(ie||H==="auto")P=!0,s.currentLevel=-1,i?.logger.debug("Quality: auto selection enabled"),i?.setState("currentQuality",{id:"auto",label:"Auto",width:0,height:0,bitrate:0,active:!0});else{P=!1;let T=parseInt(H.replace("level-",""),10);if(!isNaN(T)&&T>=0&&T<s.levels.length){s.nextLevel=T,i?.logger.debug(`Quality: queued switch to level ${T}`);let O=s.levels[T];if(O){let ce=_e(O);i?.setState("currentQuality",{id:`level-${T}`,label:`${ce}...`,width:O.width,height:O.height,bitrate:O.bitrate,active:!1})}}}}),j=i.on("track:audio",({trackId:H})=>{if(!s||c){i?.logger.warn("Audio track selection not available");return}let ie=dr(H),T=s.audioTracks??[];if(ie<0||ie>=T.length){i?.logger.warn("Ignoring unknown audio track selection",{trackId:H});return}s.audioTrack=ie,i?.logger.debug(`Audio: queued switch to track ${ie}`)});typeof window<"u"&&(k=()=>{(U!==null||S>0||ae||z>0&&!G)&&(U&&(i?.logger.info("Browser back online, reconnecting immediately"),clearTimeout(U),U=null),g())},window.addEventListener("online",k));let X=i.subscribeToState(H=>{H.key==="poster"&&Be()}),le=i.subscribeToState(H=>{H.key==="live"&&(ge=!0)});i.onDestroy(()=>{p(),d(),h(),b(),M(),D(),F(),j(),X(),le()});let ke=i.subscribeToState(H=>{H.key==="playing"&&(H.value?Re():pe())});i.onDestroy(ke)},async destroy(){i?.logger.info(`HLS plugin${e.logSuffix} destroying`),w++,Ee(),k&&typeof window<"u"&&(window.removeEventListener("online",k),k=null),He(new Error("HLS load cancelled: player destroyed")),Y?.destroy(),Y=null,a?.parentNode&&a.parentNode.removeChild(a),a=null,i=null},async loadSource(l){if(!i)throw new Error("Plugin not initialized");i.logger.info(`Loading HLS source${e.logSuffix}`,{src:J(l)});let p=++w;if(Ee(),L=!1,ge=!1,i.setState("live",!1),He(new Error("HLS load cancelled: superseded by a new load")),o=l,C.corePlayRequested=!1,C.corePauseRequested=!1,Be(),i.setState("playbackState","loading"),i.setState("buffering",!0),i.getState("airplayActive")&&n.supportsNativeHLS())i.logger.info("Using native HLS (AirPlay active)"),await be(l,!0);else if(n.isHlsJsSupported())i.logger.info(`Using ${e.engineLabel} for HLS playback`),await ve(l);else if(n.supportsNativeHLS())i.logger.info("Using native HLS playback (hls.js not supported)"),await be(l,!0);else{let d=n.describeSupport(),h=`HLS playback not supported in this browser (${pi(d)})`;throw i.setState("playbackState","error"),i.setState("buffering",!1),i.emit("error",{code:"SOURCE_NOT_SUPPORTED",message:h,fatal:!0,timestamp:Date.now(),context:{probes:d}}),new Error(h)}if(p===w){if(a){let d=i.getState("muted"),h=i.getState("volume");d!==void 0&&(a.muted=d),h!==void 0&&(a.volume=h)}i.setState("playbackState","ready"),i.setState("buffering",!1)}},getCurrentLevel(){return c||!s?-1:s.currentLevel},setLevel(l){if(c||!s){i?.logger.warn("Quality selection not available in native HLS mode");return}s.currentLevel=l},getLevels(){return c||!s?[]:or(s.levels,s.currentLevel)},getHlsInstance(){return s},isNativeHLS(){return c},getLiveInfo(){if(!(i?.getState("live")||!1))return null;let p=Le();if(c){let h=p?.targetLatency??3;return{isLive:!0,latency:p?.latency??0,targetLatency:h,drift:0,liveSyncPosition:Ce(p,h),lowLatency:p?.lowLatency??!1}}if(!s)return null;let d=s.targetLatency||p?.targetLatency||3;return{isLive:!0,latency:s.latency||0,targetLatency:d,drift:s.drift||0,liveSyncPosition:Ce(p,d),lowLatency:p?.lowLatency??!1}},async switchToNative(){if(c){i?.logger.debug("Already using native HLS");return}if(!n.supportsNativeHLS()){i?.logger.warn("Native HLS not supported in this browser");return}if(!o){i?.logger.warn("No source loaded");return}i?.logger.info("Switching to native HLS for AirPlay");let l=i?.getState("playing")||!1,p=a?.currentTime||0,d=o,h=I,b=++w;if(Ee(),He(new Error("HLS load cancelled: switching to native HLS")),o=d,I=h,await be(d),b===w){if(a&&p>0&&(a.currentTime=p),l&&a)try{await a.play()}catch{i?.logger.debug("Could not auto-resume after switch")}i?.logger.info("Switched to native HLS")}},async switchToHlsJs(){if(!c){i?.logger.debug("Already using hls.js");return}if(!n.isHlsJsSupported()){i?.logger.warn("hls.js not supported in this browser");return}if(!o){i?.logger.warn("No source loaded");return}i?.logger.info("Switching back to hls.js");let l=i?.getState("playing")||!1,p=a?.currentTime||0,d=o,h=I,b=++w;if(Ee(),He(new Error("HLS load cancelled: switching to hls.js")),o=d,I=h,await ve(d),b===w){if(a&&p>0&&(a.currentTime=p),l&&a)try{await a.play()}catch{i?.logger.debug("Could not auto-resume after switch")}i?.logger.info("Switched to hls.js")}}}}function yr(n){return vr($t,{name:"HLS Provider",description:"HLS playback provider using hls.js",logSuffix:"",engineLabel:"hls.js"},n)}var br=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var mi=["mp4","webm","mov","mkv","ogv","m4v"],Er=["mp3","wav","ogg","flac","aac","m4a","opus","weba"],vi=[...mi,...Er],Pt={ABORTED:1,NETWORK:2,DECODE:3,SRC_NOT_SUPPORTED:4},yi={mp4:"video/mp4",m4v:"video/mp4",webm:"video/webm",mov:"video/quicktime",mkv:"video/x-matroska",ogv:"video/ogg",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",flac:"audio/flac",aac:"audio/aac",m4a:"audio/mp4",opus:"audio/opus",weba:"audio/webm"};function wr(n){let e=n?.preload??"metadata",t=n?.loadTimeoutMs??3e4,r=null,i=null,s=null,a=null,c=!1,o=!1,u=!1,v=0,P=null,C=!1,Y=m=>{try{return new URL(m,window.location.href).pathname.split(".").pop()?.toLowerCase()??""}catch{return(m.split(".").pop()?.toLowerCase()??"").split("?")[0]??""}},_=m=>yi[m]||"video/mp4",V=m=>Er.includes(m),I=m=>{let L=(m.startsWith("audio/")?document.createElement("audio"):document.createElement("video")).canPlayType(m);return L==="probably"||L==="maybe"},w=()=>{if(i){if(c){i.poster="";return}i.poster=r?.getState("poster")||""}},Z=()=>{if(i)return i;let m=r?.container.querySelector("video");return m?(i=m,i):(i=document.createElement("video"),i.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",i.preload=e,i.controls=!1,i.playsInline=!0,w(),r?.container.appendChild(i),i)},x=m=>{switch(m?.code){case Pt.ABORTED:return{code:"PLAYBACK_FAILED",message:"Playback aborted"};case Pt.NETWORK:return{code:"MEDIA_NETWORK_ERROR",message:"Network error"};case Pt.DECODE:return{code:"MEDIA_DECODE_ERROR",message:"Decode error - format may not be supported"};case Pt.SRC_NOT_SUPPORTED:return C?{code:"MEDIA_NETWORK_ERROR",message:"Network error"}:{code:"SOURCE_LOAD_FAILED",message:"Format not supported"};default:return{code:"PLAYBACK_FAILED",message:"Unknown video error"}}},A=m=>{let K=[],ee=v,L=(S,N)=>{let k=$=>{ee===v&&N($)};m.addEventListener(S,k),K.push([S,k])},U=()=>{m.ended||!r?.getState("ended")||(r?.setState("ended",!1),r?.setState("playbackState",m.paused?"paused":"playing"))};L("play",()=>{r?.setState("paused",!1),U()}),L("playing",()=>{r?.setState("playing",!0),r?.setState("paused",!1),r?.setState("playbackState","playing"),U(),u=!1,o?o=!1:r?.emit("playback:play",void 0)}),L("pause",()=>{o=!1,r?.setState("playing",!1),r?.setState("paused",!0),r?.setState("playbackState","paused"),u?u=!1:r?.emit("playback:pause",void 0)}),L("ended",()=>{r?.setState("playing",!1),r?.setState("ended",!0),r?.setState("playbackState","ended"),r?.emit("playback:ended",void 0)}),L("timeupdate",()=>{r?.setState("currentTime",m.currentTime),r?.emit("playback:timeupdate",{currentTime:m.currentTime})}),L("durationchange",()=>{r?.setState("duration",m.duration||0)}),L("loadedmetadata",()=>{r?.setState("duration",m.duration||0),r?.emit("media:loadedmetadata",{duration:m.duration||0})}),L("canplay",()=>{r?.setState("buffering",!1),r?.emit("media:canplay",void 0)}),L("canplaythrough",()=>{r?.emit("media:canplaythrough",void 0)}),L("waiting",()=>{r?.setState("buffering",!0),r?.emit("media:waiting",void 0)}),L("progress",()=>{if(m.buffered.length>0){let S=m.buffered.end(m.buffered.length-1),N=m.duration||0,k=N>0?S/N:0;r?.setState("bufferedAmount",k),r?.emit("media:progress",{buffered:k})}}),L("seeking",()=>{r?.setState("currentTime",m.currentTime),r?.setState("seeking",!0),U()}),L("seeked",()=>{r?.setState("seeking",!1),r?.emit("playback:seeked",{time:m.currentTime})}),L("volumechange",()=>{r?.setState("volume",m.volume),r?.setState("muted",m.muted),r?.emit("volume:change",{volume:m.volume,muted:m.muted})}),L("ratechange",()=>{r?.setState("playbackRate",m.playbackRate),r?.emit("playback:ratechange",{rate:m.playbackRate})}),L("stalled",()=>{r?.setState("buffering",!0),r?.emit("media:stalled",void 0),r?.logger.warn("Media stalled - network may be slow")}),L("suspend",()=>{r?.emit("media:suspend",void 0)}),L("abort",()=>{r?.emit("media:abort",void 0)}),L("error",()=>{let S=m.error,{code:N,message:k}=x(S);r?.logger.error("Video error",{mediaErrorCode:S?.code,code:N,message:k}),r?.setState("playbackState","error"),r?.setState("buffering",!1),r?.emit("error",{code:N,message:k,fatal:!0,timestamp:Date.now()})}),L("enterpictureinpicture",()=>{r?.setState("pip",!0),r?.logger.debug("PiP: entered (standard)")}),L("leavepictureinpicture",()=>{r?.setState("pip",!1),r?.logger.debug("PiP: exited (standard)"),(!m.paused||r?.getState("playing"))&&m.play().catch(()=>{})});let z=m;return"webkitPresentationMode"in m&&L("webkitpresentationmodechanged",()=>{let S=z.webkitPresentationMode;r?.setState("pip",S==="picture-in-picture"),r?.logger.debug(`PiP: mode changed to ${S} (webkit)`),S==="inline"&&m.paused&&m.play().catch(()=>{})}),()=>{K.forEach(([S,N])=>{m.removeEventListener(S,N)})}},R=()=>{s?.(),s=null,o=!1,u=!1,i&&(i.pause(),i.removeAttribute("src"),i.load())};return{id:"native-provider",name:"Native Media Provider",version:br,type:"provider",description:"Native HTML5 playback for video (MP4, WebM, MOV) and audio (MP3, WAV, FLAC, AAC)",canPlay(m){let K=Y(m);if(!vi.includes(K))return!1;let ee=_(K);return I(ee)},async init(m){r=m,r.logger.info("Native video plugin initialized");let K=r.on("playback:play",async()=>{if(!r?.getState("chromecastActive")&&i&&i.paused)try{o=!0,await i.play()}catch(k){o=!1,r?.logger.error("Play failed",k)}}),ee=r.on("playback:pause",()=>{if(!r?.getState("chromecastActive")&&i){if(i.paused){o&&(o=!1,i.pause());return}u=!0,o=!1,i.pause()}}),L=r.on("playback:seeking",({time:k})=>{if(r?.getState("chromecastActive")||!i||!Number.isFinite(k))return;let $=Math.max(0,Math.min(k,i.duration||0));i.currentTime=$}),U=r.on("volume:change",({volume:k,muted:$})=>{i&&(i.volume=k,i.muted=$)}),z=r.on("volume:mute",({muted:k})=>{i&&(i.muted=k)}),S=r.on("playback:ratechange",({rate:k})=>{i&&(i.playbackRate=k)}),N=r.subscribeToState(k=>{k.key==="poster"&&w()});r.onDestroy(()=>{K(),ee(),L(),U(),z(),S(),N()})},async destroy(){r?.logger.info("Native video plugin destroying"),v++;let m=P;P=null,m?.(new Error("Player destroyed during load")),R(),i?.parentNode&&i.parentNode.removeChild(i),i=null,r=null,a=null,c=!1,C=!1},async loadSource(m){if(!r)throw new Error("Plugin not initialized");let K=Y(m),ee=_(K),L=V(K);c=L,r.logger.info("Loading native media source",{src:J(m),mimeType:ee,isAudio:L});let U=++v,z=P;if(P=null,z?.(new Error("Load superseded by a newer source")),C=!1,R(),r.setState("playbackState","loading"),r.setState("buffering",!0),r.setState("mediaType",L?"audio":"video"),L){let N=r.getState("title");if(!N||N===a)try{let $=new URL(m,window.location.href).pathname.split("/").pop()||"Audio",G=decodeURIComponent($.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));a=G,r.setState("title",G)}catch{a="Audio",r.setState("title","Audio")}}r.setState("qualities",[]),r.setState("currentQuality",null);let S=Z();return S.style.display=L?"none":"block",w(),s=A(S),new Promise((N,k)=>{let $=null,G=()=>{S.removeEventListener("loadedmetadata",ge),S.removeEventListener("error",re),$!==null&&(clearTimeout($),$=null),P===ae&&(P=null)},ae=te=>{G(),k(te)};P=ae;let ge=()=>{if(U!==v)return;G(),C=!0;let te=r?.getState("muted"),ye=r?.getState("volume");te!==void 0&&(S.muted=te),ye!==void 0&&(S.volume=ye),r?.setState("source",{src:m,type:ee}),r?.setState("playbackState","ready"),r?.setState("buffering",!1),r?.emit("media:loaded",{src:m,type:ee}),N()},re=()=>{if(U!==v)return;G();let te=S.error;k(new Error(te?.message||"Failed to load video source"))};t>0&&($=setTimeout(()=>{U===v&&(G(),r?.setState("playbackState","error"),r?.setState("buffering",!1),k(new Error("Video took too long to load (network timeout)")))},t)),S.addEventListener("loadedmetadata",ge),S.addEventListener("error",re),S.src=m,S.load()})}}}var Lr={"bandwidth-indicator":{rank:0,exit:"hide"},"skip-backward":{rank:1,exit:"overflow"},"skip-forward":{rank:1,exit:"overflow"},pip:{rank:2,exit:"overflow"},chromecast:{rank:4,exit:"overflow"},airplay:{rank:4,exit:"overflow"},volume:{rank:5,exit:"overflow"},captions:{rank:6,exit:"overflow"},quality:{rank:6,exit:"hide"},time:{rank:7,exit:"hide"},play:{rank:"never",exit:"overflow"},"live-indicator":{rank:"never",exit:"overflow"},settings:{rank:"never",exit:"overflow"},fullscreen:{rank:"never",exit:"overflow"},spacer:{rank:"never",exit:"overflow"}};function Mt(n,e){return n.map(t=>{let r=Lr[t],i=e?.[t]??r?.rank??3;return{id:t,rank:i,exit:r?.exit??"overflow"}})}function Qt(n,e){if(!n.includes("quality")||n.includes("settings"))return;let[t]=Mt(["quality"],e);if(t.rank!=="never")throw new Error(`uiPlugin: a layout with "quality" needs "settings" as well. The quality control hides when the bar does not fit, and the settings menu is where its Quality row lives. Add "settings" to controls, pin quality with priority: { quality: 'never' }, or set responsive: false.`)}function bi(n,e,t,r){let i=n.reduce((c,o)=>c+o,0),s=e*Math.max(0,n.length-1),a=r?t+e:0;return i+s+a}function Yt(n,e,t,r){let i=n.map(u=>u.id);if(e<=0)return{inBar:i,overflow:[],hidden:[]};let a=[...n.filter(u=>u.visible&&u.width>0)],c=new Set,o=new Set;for(;bi(a.map(u=>u.width),t,r,c.size>0)>e;){let u=-1;for(let P=0;P<a.length;P++){let C=a[P];C.rank!=="never"&&(u===-1||C.rank<=a[u].rank)&&(u=P)}if(u===-1)break;let[v]=a.splice(u,1);(v.exit==="hide"?o:c).add(v.id)}return{inBar:i.filter(u=>!c.has(u)&&!o.has(u)),overflow:i.filter(u=>c.has(u)),hidden:i.filter(u=>o.has(u))}}var jt=`
/* ============================================
   Container & Base
   ============================================ */
.sp-container {
  position: relative;
  /* Own stacking context: the control bar, menus and overlays all carry
     z-index, and without this they compete with the host page's own layers
     instead of staying inside the player. */
  isolation: isolate;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.sp-container video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

/* The container is a tab stop - the plugin sets tabindex="0" on it so the
   keyboard shortcuts have somewhere to land - so it must show where focus is.
   A pointer press focuses it too, which is why the ring is on :focus-visible
   and the plain :focus keeps outline:none: clicking the video should not draw
   a box around the player. The offset is negative so the ring is painted
   inside the player box; drawn outside it, a host page's own overflow or a
   flush-fitting wrapper can clip it away. */
.sp-container:focus {
  outline: none;
}

.sp-container:focus-visible {
  outline: 3px solid var(--sp-accent, #e50914);
  outline-offset: -3px;
}

/* ============================================
   Gradient Overlay
   ============================================ */
.sp-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 160px;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(0, 0, 0, 0.4) 50%,
    transparent 100%
  );
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease;
  z-index: 5;
}

.sp-gradient--visible {
  opacity: 1;
}

/* ============================================
   Controls Container
   ============================================ */
.sp-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 0 12px 12px;
  /* Composed through a variable so the fullscreen rule below can add the
     device's own inset without restating the 12px. */
  padding-bottom: calc(12px + var(--sp-inset-bottom, 0px));
  gap: 4px;
  /* Declared on the bar because the fit needs the same number the volume rules
     below use: the slider expands mid-interaction and the plugin reserves the
     room in advance (see interactionReserve() in index.ts, which reads this
     property off this element at init). One declaration, so the stylesheet and
     the arithmetic cannot drift. Both the bar and the overflow tray are inside
     .sp-controls, so a volume control inherits it wherever the fit put it. */
  --sp-volume-slider-width: 64px;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.25s ease, transform 0.25s ease;
  z-index: 10;
}

.sp-controls--visible {
  opacity: 1;
  transform: translateY(0);
}

.sp-controls--hidden {
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
}

/* ============================================
   Safe Area (fullscreen only)

   Scoped to :fullscreen on purpose. Applied unconditionally, the inset would
   push an inline player's controls up on any page whose viewport meta says
   viewport-fit=cover, where there is no notch or home indicator over the
   player at all. Both the bar and the progress wrapper are direct children of
   the container, which is the element that goes fullscreen.

   The :-webkit-full-screen twin is a separate rule because an unknown
   pseudo-class anywhere in a selector list invalidates the whole rule.

   Nothing is needed in packages/embed/iframe.html: viewport-fit has no effect
   inside an iframe.
   ============================================ */
:fullscreen > .sp-controls,
:fullscreen > .sp-progress-wrapper {
  --sp-inset-bottom: env(safe-area-inset-bottom, 0px);
}

:-webkit-full-screen > .sp-controls,
:-webkit-full-screen > .sp-progress-wrapper {
  --sp-inset-bottom: env(safe-area-inset-bottom, 0px);
}

/* ============================================
   Progress Bar (Above Controls)
   ============================================ */
.sp-progress-wrapper {
  position: absolute;
  bottom: calc(48px + var(--sp-inset-bottom, 0px));
  left: 12px;
  right: 12px;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.sp-progress-wrapper--visible {
  opacity: 1;
  pointer-events: auto;
}

/* Touch: a 20px wrapper is not a 20px target. The control bar is a later
   sibling at the same z-index and spans 0..56px from the bottom, so it wins
   hit-testing in the 48..56 overlap and the exclusive region for scrubbing is
   12px. The wrapper grows UPWARD to 44px (48..92) because growing downward
   would be swallowed by the bar; the 3px bar itself stays exactly where it was
   (centred 8.5px above the wrapper's bottom edge, which is what
   align-items: center gave it inside 20px). The handle and tooltip
   enlargements are gated behind (hover: hover) and never match a finger, but
   .sp-progress--dragging is not, so the handle still appears mid-drag.

   any-pointer, not pointer: (pointer: coarse) describes the PRIMARY pointer
   only, so a hybrid laptop with a mouse and a touchscreen reports fine and kept
   the 12px exclusive region under a finger. (any-pointer: coarse) is true
   whenever a coarse pointer is available at all, which is the population that
   needs the target. The cost on such a machine is 24px of extra hit area for
   the mouse, over the player's own bottom edge. */
@media (any-pointer: coarse) {
  .sp-progress-wrapper {
    height: 44px;
    align-items: flex-end;
    padding-bottom: 8.5px;
    box-sizing: border-box;
  }
}

.sp-progress {
  position: relative;
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1.5px;
  transition: height 0.15s ease;
}

@media (hover: hover) {
  .sp-progress-wrapper:hover .sp-progress {
    height: 5px;
  }
}

.sp-progress--dragging {
  height: 5px;
}

/* ============================================
   Timeline extension layer (timeline-registry.ts)

   A zero-height line lying exactly on the rail's centre, spanning exactly the
   rail's width, so an extension can position by percentage and land on the
   same pixels the seek slider maps a press to. The 10px offset is the rail
   centre in BOTH wrapper modes: the fine-pointer wrapper is 20px tall with the
   3px rail centred (8.5..11.5 from the bottom), and the coarse-pointer wrapper
   is 44px tall with 8.5px of bottom padding and align-items: flex-end, which
   puts the rail in the same place.

   Inert by default: only the explicit hit targets an extension puts inside it
   take pointer input, so an ordinary press on the rail still seeks.
   ============================================ */
.sp-progress__extension {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 10px;
  height: 0;
  z-index: 3;
  pointer-events: none;
}

/* Editing reserves a lane below the rail for an extension's second handle, by
   lifting the whole wrapper clear of the control bar. The lane above needs no
   reservation - it is over the picture. */
.sp-progress-wrapper--editing {
  bottom: calc(92px + var(--sp-inset-bottom, 0px));
}

.sp-progress__track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  overflow: hidden;
}

.sp-progress__buffered {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.4);
  border-radius: inherit;
  transition: width 0.1s linear;
}

.sp-progress__filled {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--sp-accent, #e50914);
  border-radius: inherit;
}

/* Chapter markers */
.sp-progress__markers {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.sp-progress__marker {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  margin-left: -1px;
  background: rgba(0, 0, 0, 0.65);
}

.sp-progress__handle {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  background: var(--sp-accent, #e50914);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.15s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

@media (hover: hover) {
  .sp-progress-wrapper:hover .sp-progress__handle {
    transform: translate(-50%, -50%) scale(1);
  }
}

.sp-progress--dragging .sp-progress__handle {
  transform: translate(-50%, -50%) scale(1);
}

/* While an extension owns the pointer the bar must not also look like it is
   scrubbing: the tooltip is suppressed inline by the control, and the handle
   stops responding to hover growth.

   This has to come after the :hover and --dragging rules AND match their
   specificity, which is why the hover case is spelled out rather than left to
   the bare class: an extension drag is a pointer drag, so the pointer is over
   the wrapper the whole time and the hover rule is always the competing one. */
.sp-progress-wrapper--ext-dragging .sp-progress__handle,
.sp-progress-wrapper--ext-dragging:hover .sp-progress__handle {
  transform: translate(-50%, -50%);
}

/* Thumbnail Preview */
.sp-thumbnail-preview {
  position: absolute;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  pointer-events: none;
  display: none;
  z-index: 21;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.sp-thumbnail-preview__img {
  background-repeat: no-repeat;
}

/* Progress Tooltip */
.sp-progress__tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  padding: 6px 10px;
  background: rgba(20, 20, 20, 0.95);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  border-radius: 4px;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.sp-progress__tooltip-chapter {
  display: block;
  max-width: 220px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 400;
  font-variant-numeric: normal;
  text-overflow: ellipsis;
}

@media (hover: hover) {
  .sp-progress-wrapper:hover .sp-progress__tooltip {
    opacity: 1;
  }
}

/* ============================================
   Control Buttons
   ============================================ */
.sp-control {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: color 0.15s ease, transform 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
}

@media (hover: hover) {
  .sp-control:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }
}

.sp-control:active {
  transform: scale(0.92);
}

.sp-control:focus-visible {
  outline: 2px solid var(--sp-accent, #e50914);
  outline-offset: 2px;
}

.sp-control:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.sp-control:disabled:hover {
  background: none;
}

.sp-control svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
  display: block;
}

.sp-control--small svg {
  width: 20px;
  height: 20px;
}

/* ============================================
   Spacer
   ============================================ */
.sp-spacer {
  flex: 1;
  min-width: 0;
}

/* ============================================
   Overflow Tray

   The wrapper is deliberately unpositioned: the strip is absolutely
   positioned against .sp-controls (the nearest positioned ancestor), so it
   spans the bar's width and sits directly above it instead of hanging off a
   44px button.

   The strip wraps horizontally and keeps overflow visible. A vertical menu of
   44px rows would be taller than a portrait phone player (211px at 375px wide,
   measured 2026-09-05) and a scrolling one would clip the popovers registered
   controls own.
   ============================================ */
.sp-overflow {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.sp-overflow-tray {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  overflow: visible;
  opacity: 0;
  visibility: hidden;
  transform: translateY(8px);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
  z-index: 20;
}

.sp-overflow-tray--open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

/* Beats a control's own inline style.display = '' on its next update(), so a
   control the fit took off screen stays off screen until the fit says
   otherwise. */
.sp-control--collapsed {
  display: none !important;
}

/* ============================================
   Time Display
   ============================================ */
.sp-time {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  padding: 0 4px;
  letter-spacing: 0.02em;
}

/* Live with DVR: reserve room for "-0:00" so the offset appearing on a
   scrub back, and blanking again at the edge, does not shift the bar. */
.sp-time--live {
  min-width: 5ch;
}

/* ============================================
   Volume Control
   ============================================ */
.sp-volume {
  display: flex;
  align-items: center;
  position: relative;
}

.sp-volume__slider-wrap {
  width: 0;
  overflow: hidden;
  transition: width 0.2s ease;
}

/* Both widths come from --sp-volume-slider-width on .sp-controls, which is also
   what the fit reserves for this control. focus-within is deliberately not
   gated on hover: a tap on the mute button focuses it, which is how the slider
   opens on a phone. */
@media (hover: hover) {
  .sp-volume:hover .sp-volume__slider-wrap {
    width: var(--sp-volume-slider-width);
  }
}

.sp-volume:focus-within .sp-volume__slider-wrap {
  width: var(--sp-volume-slider-width);
}

.sp-volume__slider {
  width: 64px;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1.5px;
  cursor: pointer;
  position: relative;
  margin: 0 8px 0 4px;
}

.sp-volume__level {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #fff;
  border-radius: inherit;
  transition: width 0.1s ease;
}

/* ============================================
   Live Indicator
   ============================================ */
/* Accent text uses --sp-accent-text, not --sp-accent: the brand red as TEXT
   is 4.38:1 on black and 3.84:1 on the menus' own rgba(20,20,20,.95), under
   the 4.5:1 WCAG AA wants for 11-13px labels. The lighter default clears it at
   6.4:1 and 5.7:1. --sp-accent keeps the brand red for progress fills, big
   play and focus rings, which are non-text and need only 3:1. A host that
   themes --sp-accent still colours this text - the chain reads its token
   first - so setting --sp-accent-text is only needed when that colour is too
   dark to read. */
.sp-live {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sp-accent-text, var(--sp-accent, #ff4d57));
  /* Opaque, and no lighter than #202020, because this is the one place accent
     TEXT sits on the control bar rather than on a menu. The bar is a gradient
     over the picture - rgba(0, 0, 0, 0.8) at its darkest point, so about #333
     over a white frame - and --sp-accent-text is only ever derived against the
     menus (see contrast.ts). A translucent chip would let the frame through
     and drop a toned accent below 4.5:1; this one pins the surface at exactly
     the colour the tone was measured on. */
  background: #202020;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 4px;
  transition: background 0.15s ease, opacity 0.15s ease;
}

@media (hover: hover) {
  /* Darkens rather than lightens: the usual rgba(255, 255, 255, 0.1) would put
     the label on a surface lighter than the one its colour was toned for. */
  .sp-live:hover {
    background: #141414;
  }
}

.sp-live__dot {
  width: 8px;
  height: 8px;
  background: currentColor;
  border-radius: 50%;
  animation: sp-pulse 2s ease-in-out infinite;
}

.sp-live--behind {
  opacity: 0.6;
}

.sp-live--behind .sp-live__dot {
  animation: none;
}

.sp-live--behind span {
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Progress bar live mode: accent color for filled bar */
.sp-progress--live .sp-progress__filled {
  background: var(--sp-accent, #e50914);
}

@keyframes sp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ============================================
   Quality / Settings Menu
   ============================================ */
.sp-quality {
  position: relative;
}

.sp-quality__btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sp-quality__label {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.9;
}

.sp-quality-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  /* Bounded to the player, see .sp-settings-panel. border-box because the
     bound is a content-box height by default and this menu adds 8px of padding
     top and bottom: at the 139px bound a 211px player gives, it rendered 155px
     and the host clipped the last 16px of it. */
  box-sizing: border-box;
  max-height: var(--sp-menu-max-height, none);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 8px;
  padding: 8px 0;
  min-width: 150px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transform: translateY(8px);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
  z-index: 20;
}

.sp-quality-menu--open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.sp-quality-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease;
}

.sp-quality-menu__item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.sp-quality-menu__item--active {
  color: var(--sp-accent-text, var(--sp-accent, #ff4d57));
}

.sp-quality-menu__check {
  width: 16px;
  height: 16px;
  fill: currentColor;
  margin-left: 8px;
  opacity: 0;
}

.sp-quality-menu__item--active .sp-quality-menu__check {
  opacity: 1;
}

/* ============================================
   Settings Menu (Gear Icon)
   ============================================ */
.sp-settings {
  position: relative;
}

.sp-settings__btn {
  display: flex;
  align-items: center;
}

.sp-settings-panel {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  /* Bounded to the room above the control bar, written by the UI plugin's
     ResizeObserver as max(120px, container height - the bar's measured height
     - 16px). The bar is measured rather than assumed because its
     padding-bottom carries the safe-area inset in fullscreen, which moves the
     anchor these menus hang from. The Speed sub-panel is 253px (a
     37px header plus six 36px rows) against a 211px portrait phone player, so
     without this the host's overflow: hidden cuts off the Back header and the
     first three speeds and playback speed is unreachable (measured at 375x211
     on 2026-09-05). With the variable unset the panel behaves exactly as it
     did before.

     Not applied to .sp-overflow-tray: that one has to keep overflow visible so
     the popovers its adopted controls own are not clipped.

     border-box because max-height bounds the content box: .sp-settings-panel--main
     is this same element with 4px of padding top and bottom, so wherever the
     bound binds the main menu, it rendered 8px past it and the host clipped the
     difference. The --sub views set padding: 0 and were already exact, which is
     why the browser harness's speed-panel check could not see this. */
  box-sizing: border-box;
  max-height: var(--sp-menu-max-height, none);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 8px;
  min-width: 200px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transform: translateY(8px);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
  z-index: 20;
}

.sp-settings-panel--open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

/* Main menu rows */
.sp-settings-panel--main {
  padding: 4px 0;
}

.sp-settings-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: background 0.1s ease;
}

.sp-settings-panel__row:hover {
  background: rgba(255, 255, 255, 0.1);
}

.sp-settings-panel__label {
  font-weight: 500;
}

.sp-settings-panel__value {
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.sp-settings-panel__arrow {
  display: flex;
  align-items: center;
  transform: rotate(-90deg);
}

.sp-settings-panel__arrow svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

/* Sub-menu panels */
.sp-settings-panel--sub {
  padding: 0;
}

.sp-settings-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.1s ease;
}

.sp-settings-panel__header:hover {
  background: rgba(255, 255, 255, 0.1);
}

.sp-settings-panel__back {
  display: flex;
  align-items: center;
  transform: rotate(-90deg);
}

.sp-settings-panel__back svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.sp-settings-panel__header-label {
  flex: 1;
}

.sp-settings-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease;
}

.sp-settings-panel__item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.sp-settings-panel__item--active {
  color: var(--sp-accent-text, var(--sp-accent, #ff4d57));
}

.sp-settings-panel__check {
  width: 16px;
  height: 16px;
  fill: currentColor;
  margin-left: 8px;
  opacity: 0;
}

.sp-settings-panel__check svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.sp-settings-panel__item--active .sp-settings-panel__check {
  opacity: 1;
}

/* ============================================
   Captions Button
   ============================================ */
.sp-captions--active {
  color: var(--sp-accent-text, var(--sp-accent, #ff4d57));
}

/* ============================================
   Cast Button States
   ============================================ */
.sp-cast--active {
  color: var(--sp-accent-text, var(--sp-accent, #ff4d57));
}

.sp-cast--unavailable {
  opacity: 0.4;
}

/* ============================================
   Big Play Button

   z-index 12 puts it above the gradient (5) and above the gestures plugin's
   tap surface (6), so a tap lands on the button and starts playback instead
   of being read as a tap-to-toggle-controls gesture - exactly how the control
   bar's play button (10) already behaves. It stays below the spinner (15) and
   the error overlay (25), both of which own the middle of the picture when
   they are up.

   Hidden with visibility, not opacity alone, so it takes no pointer events
   while it is away.
   ============================================ */
.sp-big-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Comfortably past the 44px minimum touch target the control bar uses. */
  width: 72px;
  height: 72px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--sp-accent, #e50914);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  transition: opacity 0.2s ease, visibility 0.2s, transform 0.15s ease,
    background 0.15s ease;
}

.sp-big-play--visible {
  opacity: 1;
  visibility: visible;
}

.sp-big-play svg {
  width: 36px;
  height: 36px;
  fill: currentColor;
  /* Optical centring: the play triangle's mass sits left of the glyph box. */
  margin-left: 3px;
}

.sp-big-play:hover {
  transform: translate(-50%, -50%) scale(1.06);
}

.sp-big-play:active {
  transform: translate(-50%, -50%) scale(0.96);
}

.sp-big-play:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}

/* ============================================
   Error Overlay
   ============================================ */
.sp-error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 25;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s;
}

.sp-error-overlay--visible {
  opacity: 1;
  visibility: visible;
}

.sp-error-overlay__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
  max-width: 360px;
}

.sp-error-overlay__icon {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16px;
}

.sp-error-overlay__icon svg {
  width: 48px;
  height: 48px;
  fill: currentColor;
}

/* Reconnecting: pulse the icon so the overlay reads as active work,
   not a dead-end error */
.sp-error-overlay--reconnecting .sp-error-overlay__icon {
  animation: sp-reconnect-pulse 1.2s ease-in-out infinite;
}

@keyframes sp-reconnect-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.sp-error-overlay__message {
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  line-height: 1.5;
  margin: 0 0 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.sp-error-overlay__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.sp-error-overlay__retry {
  background: var(--sp-accent, #e50914);
  color: #fff;
  border: none;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  min-width: 120px;
  min-height: 44px;
  transition: background 0.15s ease, transform 0.15s ease;
  font-family: inherit;
}

.sp-error-overlay__retry:hover {
  filter: brightness(1.1);
}

.sp-error-overlay__retry:active {
  transform: scale(0.96);
}

.sp-error-overlay__retry:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.sp-error-overlay__dismiss {
  background: none;
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  min-width: 100px;
  min-height: 44px;
  transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  font-family: inherit;
}

.sp-error-overlay__dismiss:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}

.sp-error-overlay__dismiss:active {
  transform: scale(0.96);
}

.sp-error-overlay__dismiss:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* ============================================
   Buffering Indicator
   ============================================ */
.sp-buffering {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 15;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sp-buffering--visible {
  opacity: 1;
}

.sp-buffering svg {
  width: 48px;
  height: 48px;
  fill: rgba(255, 255, 255, 0.9);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

@keyframes sp-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.sp-spin {
  animation: sp-spin 0.8s linear infinite;
}

/* ============================================
   Reduced Motion
   ============================================ */
@media (prefers-reduced-motion: reduce) {
  .sp-gradient,
  .sp-controls,
  .sp-progress-wrapper,
  .sp-progress,
  .sp-progress__handle,
  .sp-progress__tooltip,
  .sp-control,
  .sp-volume__slider-wrap,
  .sp-quality-menu,
  .sp-overflow-tray,
  .sp-settings-panel,
  .sp-settings-panel__row,
  .sp-settings-panel__item,
  .sp-settings-panel__header,
  .sp-buffering,
  .sp-big-play,
  .sp-error-overlay,
  .sp-error-overlay__retry,
  .sp-error-overlay__dismiss {
    transition: none;
  }

  .sp-big-play:hover,
  .sp-big-play:active {
    transform: translate(-50%, -50%);
  }

  .sp-live__dot,
  .sp-spin {
    animation: none;
  }
}

/* ============================================
   CSS Custom Properties (Theming)
   ============================================

   Token defaults live at the use sites as var() fallbacks, not in a :root
   block. A :root declaration wrote --sp-accent, --sp-color, --sp-bg,
   --sp-control-height and --sp-icon-size into the HOST document, so mounting a
   player changed variables the page may own. A .sp-container declaration would
   be no better: the container rule wins for every descendant, so it would
   override a host that themes the player from its own :root. A var() fallback
   does neither - it applies only where nothing else defines the token.

   setTheme() writes the same names onto the player's container, which still
   wins over the fallbacks.

   --sp-accent-text is the accent applied to TEXT and active-state glyphs,
   split from --sp-accent because the same colour has to clear 4.5:1 there and
   only 3:1 as a fill. It falls back to --sp-accent, so a themed player needs
   it only when the host's accent is too dark to read against the controls;
   setTheme({ accentTextColor }) writes it, and accentTextTone() derives one.
   ============================================ */
`;var E={play:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${je.play}"/></svg>`,pause:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',replay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',volumeHigh:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${je.volumeHigh}"/></svg>`,volumeLow:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',volumeMute:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${je.volumeMuted}"/></svg>`,fullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',exitFullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',pip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>',exitPip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 9h6v2H9z"/></svg>',settings:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',chromecast:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',chromecastConnected:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',airplay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 22h12l-6-6-6 6zM21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V5h18v12h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',captions:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>',captionsOff:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 5.5v13h-15v-13h15zM19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>',checkmark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',chevronUp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>',more:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',chevronDown:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>',spinner:'<svg viewBox="0 0 24 24" fill="currentColor" class="sp-spin"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',skipForward:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',skipBack:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',forward10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',replay10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',error:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'};function y(n,e,t){let r=document.createElement(n);if(e)for(let[i,s]of Object.entries(e))i==="className"?r.className=s:r.setAttribute(i,s);if(t)for(let i of t)typeof i=="string"?r.appendChild(document.createTextNode(i)):r.appendChild(i);return r}function Q(n,e,t){let r=y("button",{className:`sp-control ${n}`,"aria-label":e,type:"button"});return W(r,t),r}function B(n){return n.querySelector("video")}function Xe(n){for(;n.firstChild;)n.removeChild(n.firstChild)}var Sr=new WeakMap;function W(n,e){return Sr.get(n)===e?!1:(n.innerHTML=e,Sr.set(n,e),!0)}function q(n,e,t){return n.getAttribute(e)===t?!1:(n.setAttribute(e,t),!0)}var Je=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=Q("sp-play","Play",E.play),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("playing"),t=this.api.getState("ended"),r,i;t?(r=E.replay,i="Replay"):e?(r=E.pause,i="Pause"):(r=E.play,i="Play"),W(this.el,r),q(this.el,"aria-label",i)}toggle(){let e=B(this.api.container);if(!e)return;this.api.getState("ended")?(e.currentTime=0,this.api.emit("playback:seeking",{time:0}),e.play().catch(()=>{})):e.paused?e.play().catch(()=>{}):e.pause()}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var Ze=class{constructor(e,t){this.hasStarted=!1;this.lastSource=void 0;this.clickHandler=()=>{this.start()};this.api=e,this.hasOverlayProbe=typeof t=="function",this.isOverlayVisible=t??(()=>!1);let r=document.createElement("button");r.className="sp-big-play",r.setAttribute("type","button"),r.setAttribute("aria-label","Play"),W(r,E.play),r.addEventListener("click",this.clickHandler),this.el=r}render(){return this.el}update(){let e=this.api.getState("playing"),t=B(this.api.container),r=this.hasEnded(t),i=this.api.getState("currentTime"),s=this.api.getState("playbackState"),a=this.api.getState("error"),c=this.api.getState("source");c!==this.lastSource&&(this.lastSource=c,this.hasStarted=!1),e&&(this.hasStarted=!0);let o;(this.hasOverlayProbe?this.isOverlayVisible():a)||s==="loading"||e||t&&!t.paused?o=!1:r?o=!0:this.hasStarted||i!==0?o=!1:o=s==="idle"||s==="ready",W(this.el,r?E.replay:E.play),q(this.el,"aria-label",r?"Replay":"Play"),this.el.classList.toggle("sp-big-play--visible",o)}hasEnded(e){return e?e.ended:!!this.api.getState("ended")}start(){let e=B(this.api.container);e&&(e.ended&&(e.currentTime=0),e.play().catch(()=>{}))}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var et=class{constructor(){this.config=null;this.loaded=!1;this.el=y("div",{className:"sp-thumbnail-preview"}),this.img=y("div",{className:"sp-thumbnail-preview__img"}),this.el.appendChild(this.img)}getElement(){return this.el}setConfig(e){if(this.config=e,this.loaded=!1,e){this.img.style.width=`${e.width}px`,this.img.style.height=`${e.height}px`,this.el.style.width=`${e.width}px`,this.el.style.height=`${e.height}px`;let t=new Image;t.onload=()=>{this.loaded=!0},t.onerror=()=>{this.config=null,this.loaded=!1},t.src=e.src}}show(e,t){if(!this.config||!this.loaded){this.el.style.display="none";return}let{src:r,width:i,height:s,columns:a,interval:c}=this.config,o=Math.floor(e/c),u=o%a,v=Math.floor(o/a);this.img.style.backgroundImage=`url(${r})`,this.img.style.backgroundPosition=`-${u*i}px -${v*s}px`,this.img.style.backgroundSize=`${a*i}px auto`,this.img.style.width=`${i}px`,this.img.style.height=`${s}px`,this.el.style.left=`${t*100}%`,this.el.style.display=""}hide(){this.el.style.display="none"}isConfigured(){return this.config!==null}destroy(){this.el.remove()}};var Ei=new WeakMap,Xt=new WeakMap;function xr(n,e){Xt.set(n,e);let t=Ei.get(n);return t&&e.setFactory(t.factory),()=>{Xt.get(n)===e&&Xt.delete(n)}}var wi=new Set(["ArrowLeft","ArrowRight","Home","End"]),tt=class{constructor(e,t={}){this.isDragging=!1;this.lastSeekTime=0;this.seekThrottleMs=100;this.wasPlayingBeforeDrag=!1;this.renderedChapters=null;this.renderedDuration=0;this.extension=null;this.detachTimelineHost=null;this.extensionDragging=!1;this.extensionEditing=!1;this.onMouseDown=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=B(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.clientX,!0)};this.onDocMouseMove=e=>{this.isDragging&&(this.seek(e.clientX),this.updateVisualPosition(e.clientX))};this.onMouseUp=e=>{if(this.isDragging&&(this.seek(e.clientX,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag)){let t=B(this.api.container);if(t&&t.paused){let r=()=>{t.removeEventListener("seeked",r),t.play().catch(()=>{})};t.addEventListener("seeked",r)}}};this.onTouchStart=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=B(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.touches[0].clientX,!0)};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.seek(e.touches[0].clientX),this.updateVisualPosition(e.touches[0].clientX))};this.onTouchEnd=e=>{if(this.isDragging){let t=e.changedTouches?.[0]?.clientX;if(t!==void 0&&this.seek(t,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag){let r=B(this.api.container);if(r&&r.paused){let i=()=>{r.removeEventListener("seeked",i),r.play().catch(()=>{})};r.addEventListener("seeked",i)}}this.tooltip.style.opacity="",this.thumbnailPreview.hide()}};this.onMouseMove=e=>{this.isExtensionInput(e)||this.updateTooltip(e.clientX)};this.onMouseLeave=()=>{this.isDragging||(this.tooltip.style.opacity="",this.thumbnailPreview.hide())};this.onKeyDown=e=>{let t=B(this.api.container);if(t&&wi.has(e.key)){this.extension?.onSeekStart();try{this.applyKeyboardSeek(e,t)}finally{this.extension?.onSeekEnd()}}};this.api=e,this.options=t,this.wrapper=y("div",{className:"sp-progress-wrapper"}),this.el=y("div",{className:"sp-progress"});let r=y("div",{className:"sp-progress__track"});this.buffered=y("div",{className:"sp-progress__buffered"}),this.filled=y("div",{className:"sp-progress__filled"}),this.markers=y("div",{className:"sp-progress__markers"}),this.handle=y("div",{className:"sp-progress__handle"}),this.tooltip=y("div",{className:"sp-progress__tooltip"}),this.tooltip.textContent="0:00",this.thumbnailPreview=new et,r.appendChild(this.buffered),r.appendChild(this.filled),r.appendChild(this.markers),r.appendChild(this.handle),this.el.appendChild(r),this.el.appendChild(this.thumbnailPreview.getElement()),this.el.appendChild(this.tooltip),this.wrapper.appendChild(this.el),this.extensionLayer=y("div",{className:"sp-progress__extension"}),this.wrapper.appendChild(this.extensionLayer),this.el.setAttribute("role","slider"),this.el.setAttribute("aria-label","Seek"),this.el.setAttribute("aria-valuemin","0"),this.el.setAttribute("aria-valuemax","0"),this.el.setAttribute("aria-valuenow","0"),this.el.setAttribute("aria-valuetext","0:00"),this.el.setAttribute("tabindex","0"),this.wrapper.addEventListener("mousedown",this.onMouseDown),this.wrapper.addEventListener("mousemove",this.onMouseMove),this.wrapper.addEventListener("mouseleave",this.onMouseLeave),this.wrapper.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.el.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd),this.detachTimelineHost=xr(this.api.container,{setFactory:i=>this.mountExtension(i)})}mountExtension(e){if(this.extension&&(this.extension.destroy(),this.extension=null,this.setExtensionDragging(!1),this.setExtensionEditing(!1),Xe(this.extensionLayer)),!e)return;let t={element:this.extensionLayer,getRailRect:()=>this.el.getBoundingClientRect(),setEditing:r=>this.setExtensionEditing(r),setDragging:r=>this.setExtensionDragging(r)};this.extension=e(t),this.extension.update()}isTimelineEditing(){return this.extensionEditing}setExtensionEditing(e){this.extensionEditing!==e&&(this.extensionEditing=e,this.wrapper.classList.toggle("sp-progress-wrapper--editing",e),e&&this.show(),this.options.onEditingChange?.(e))}setExtensionDragging(e){this.extensionDragging!==e&&(this.extensionDragging=e,this.wrapper.classList.toggle("sp-progress-wrapper--ext-dragging",e),e?(this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.tooltip.style.opacity="0",this.thumbnailPreview.hide()):this.tooltip.style.opacity="")}isExtensionInput(e){if(this.extensionDragging)return!0;let t=e.target;return t instanceof Node&&this.extensionLayer.contains(t)}render(){return this.wrapper}show(){this.wrapper.classList.add("sp-progress-wrapper--visible")}hide(){this.wrapper.classList.remove("sp-progress-wrapper--visible")}setThumbnails(e){this.thumbnailPreview.setConfig(e)}update(){let e=this.api.getState("currentTime")||0,t=this.api.getState("duration")||0,r=this.api.getState("buffered"),i=this.api.getState("live"),s=this.api.getState("seekableRange"),a=this.api.getState("thumbnails");if(a&&!this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.setConfig(a),this.el.classList.toggle("sp-progress--live",!!i),this.updateMarkers(t,i,s),i&&s){let c=s.end-s.start;if(c>0){let o=(e-s.start)/c*100;this.filled.style.width=`${Math.max(0,Math.min(100,o))}%`,this.handle.style.left=`${Math.max(0,Math.min(100,o))}%`}if(r&&r.length>0){let o=s.end-s.start;if(o>0){let v=(r.end(r.length-1)-s.start)/o*100;this.buffered.style.width=`${Math.max(0,Math.min(100,v))}%`}}this.el.setAttribute("aria-valuemax",String(Math.floor(s.end))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",`${Math.floor(s.end-e)} seconds behind live`)}else if(t>0){let c=e/t*100;if(this.filled.style.width=`${c}%`,this.handle.style.left=`${c}%`,r&&r.length>0){let u=r.end(r.length-1)/t*100;this.buffered.style.width=`${u}%`}this.el.setAttribute("aria-valuemax",String(Math.floor(t))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",ue(e))}this.extension?.update()}chapterLabelAt(e){let t=this.api.getState("chapters")??[];for(let r=t.length-1;r>=0;r--){let i=t[r];if(e<i.time)continue;let s=t[r+1],a=i.endTime??(s?s.time:1/0);return e<a?i.label:null}return null}updateMarkers(e,t,r){let i=this.api.getState("chapters")??[],s=t?r?r.end-r.start:0:e;if(i.length===0||s<=0){this.renderedChapters!==null&&(this.markers.textContent="",this.renderedChapters=null,this.renderedDuration=0);return}if(i===this.renderedChapters&&s===this.renderedDuration)return;let a=t&&r?r.start:0;this.markers.textContent="";for(let c of i){if(c.time<=a)continue;let o=(c.time-a)/s*100;if(o<=0||o>=100)continue;let u=y("div",{className:"sp-progress__marker"});u.style.left=`${o}%`,u.title=c.label,this.markers.appendChild(u)}this.renderedChapters=i,this.renderedDuration=s}getTimeFromPosition(e){let t=this.el.getBoundingClientRect(),r=Math.max(0,Math.min(1,(e-t.left)/t.width)),i=this.api.getState("live"),s=this.api.getState("seekableRange");if(i&&s){let o=s.end-s.start,u=s.start+r*o;return Number.isFinite(u)?u:null}let a=this.api.getState("duration")||0,c=r*a;return Number.isFinite(c)?c:null}updateTooltip(e){let t=this.el.getBoundingClientRect(),r=Math.max(0,Math.min(1,(e-t.left)/t.width)),i=this.getTimeFromPosition(e)??0,s=this.api.getState("live"),a=this.api.getState("seekableRange");if(s&&a){let o=a.end-i;this.tooltip.textContent=we(o)}else this.tooltip.textContent=ue(i);let c=this.chapterLabelAt(i);if(c){let o=y("span",{className:"sp-progress__tooltip-chapter"});o.textContent=c,this.tooltip.appendChild(o)}this.tooltip.style.left=`${r*100}%`,this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.show(i,r)}updateVisualPosition(e){let t=this.el.getBoundingClientRect(),r=Math.max(0,Math.min(1,(e-t.left)/t.width));this.filled.style.width=`${r*100}%`,this.handle.style.left=`${r*100}%`}applyKeyboardSeek(e,t){let i=this.api.getState("live"),s=this.api.getState("seekableRange");if(i&&s)switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(s.start,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(s.end,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=s.start;break;case"End":e.preventDefault(),t.currentTime=s.end;break}else{let a=this.api.getState("duration")||0;switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(0,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(a,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=0;break;case"End":e.preventDefault(),t.currentTime=a;break}}this.api.emit("playback:seeking",{time:t.currentTime})}seek(e,t=!1){let r=B(this.api.container);if(!r)return;let i=Date.now();if(!t&&this.isDragging&&i-this.lastSeekTime<this.seekThrottleMs)return;this.lastSeekTime=i;let s=this.getTimeFromPosition(e);s!==null&&Number.isFinite(s)&&(r.currentTime=s,t&&this.api.emit("playback:seeking",{time:s}))}destroy(){this.detachTimelineHost?.(),this.detachTimelineHost=null,this.extension?.destroy(),this.extension=null,this.wrapper.removeEventListener("mousedown",this.onMouseDown),this.wrapper.removeEventListener("mousemove",this.onMouseMove),this.wrapper.removeEventListener("mouseleave",this.onMouseLeave),this.wrapper.removeEventListener("touchstart",this.onTouchStart),this.el.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.thumbnailPreview.destroy(),this.wrapper.remove()}};var rt=class{constructor(e){this.api=e,this.el=y("div",{className:"sp-time"}),this.el.setAttribute("aria-live","off")}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("currentTime")||0,r=this.api.getState("duration")||0;if(e){let i=this.api.getState("seekableRange"),s=this.api.getState("liveEdge");this.el.classList.toggle("sp-time--live",!!i),this.el.style.display=i?"":"none";let a=i&&!s?we(i.end-t):"LIVE";this.setText(a==="LIVE"?"":a)}else this.el.classList.remove("sp-time--live"),this.el.style.display="",this.setText(`${ue(t)} / ${ue(r)}`)}setText(e){this.el.textContent!==e&&(this.el.textContent=e),e?this.el.removeAttribute("aria-hidden"):this.el.setAttribute("aria-hidden","true")}destroy(){this.el.remove()}};var it=class{constructor(e){this.isDragging=!1;this.onMouseDown=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onDocMouseMove=e=>{this.isDragging&&this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onMouseUp=()=>{this.isDragging=!1};this.onTouchStart=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX))};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX)))};this.onTouchEnd=()=>{this.isDragging=!1};this.onKeyDown=e=>{let t=B(this.api.container);if(!t)return;let r=.1;switch(e.key){case"ArrowUp":case"ArrowRight":e.preventDefault(),this.setVolume(t.volume+r);break;case"ArrowDown":case"ArrowLeft":e.preventDefault(),this.setVolume(t.volume-r);break}};this.api=e,this.el=y("div",{className:"sp-volume"}),this.btn=y("button",{className:"sp-control sp-volume__btn","aria-label":"Mute",type:"button"}),this.btn.innerHTML=E.volumeHigh,this.btn.onclick=()=>this.toggleMute();let t=y("div",{className:"sp-volume__slider-wrap"});this.slider=y("div",{className:"sp-volume__slider"}),this.slider.setAttribute("role","slider"),this.slider.setAttribute("aria-label","Volume"),this.slider.setAttribute("aria-valuemin","0"),this.slider.setAttribute("aria-valuemax","100"),this.slider.setAttribute("tabindex","0"),this.level=y("div",{className:"sp-volume__level"}),this.slider.appendChild(this.level),t.appendChild(this.slider),this.el.appendChild(this.btn),this.el.appendChild(t),this.slider.addEventListener("mousedown",this.onMouseDown),this.slider.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.slider.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd)}render(){return this.el}update(){let e=this.api.getState("volume")??1,t=this.api.getState("muted")??!1,r,i;t||e===0?(r=E.volumeMute,i="Unmute"):e<.5?(r=E.volumeLow,i="Mute"):(r=E.volumeHigh,i="Mute"),W(this.btn,r),q(this.btn,"aria-label",i);let s=t?0:e,a=`${s*100}%`;this.level.style.width!==a&&(this.level.style.width=a);let c=Math.round(s*100);q(this.slider,"aria-valuenow",String(c)),q(this.slider,"aria-valuetext",`${c}%`)}toggleMute(){let e=B(this.api.container);e&&(e.muted=!e.muted)}setVolume(e){let t=B(this.api.container);if(!t)return;let r=Math.max(0,Math.min(1,e));t.volume=r,r>0&&t.muted&&(t.muted=!1)}getVolumeFromPosition(e){let t=this.slider.getBoundingClientRect();return Math.max(0,Math.min(1,(e-t.left)/t.width))}destroy(){this.slider.removeEventListener("mousedown",this.onMouseDown),this.slider.removeEventListener("touchstart",this.onTouchStart),this.slider.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.el.remove()}};var nt=class{constructor(e){this.handleClick=()=>{this.seekToLive()};this.handleKeyDown=e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.seekToLive())};this.api=e,this.el=y("div",{className:"sp-live"}),this.dot=y("div",{className:"sp-live__dot"}),this.label=document.createElement("span"),this.label.textContent="LIVE",this.el.appendChild(this.dot),this.el.appendChild(this.label),this.el.setAttribute("role","button"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge"),this.el.setAttribute("tabindex","0"),this.el.addEventListener("click",this.handleClick),this.el.addEventListener("keydown",this.handleKeyDown)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("liveEdge");this.el.style.display=e?"":"none",t?(this.el.classList.remove("sp-live--behind"),this.label.textContent="LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge")):(this.el.classList.add("sp-live--behind"),this.label.textContent="GO LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - behind live edge, click to seek to live"))}seekToLive(){this.api.emit("live:seektolive",void 0)}destroy(){this.el.removeEventListener("click",this.handleClick),this.el.removeEventListener("keydown",this.handleKeyDown),this.el.remove()}};var st=class{constructor(e){this.isOpen=!1;this.lastQualitiesJson="";this.api=e,this.el=y("div",{className:"sp-quality"}),this.btn=Q("sp-quality__btn","Quality",E.settings),this.btnLabel=y("span",{className:"sp-quality__label"}),this.btnLabel.textContent="Auto",this.btn.appendChild(this.btnLabel),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.menu=y("div",{className:"sp-quality-menu"}),this.menu.setAttribute("role","menu"),this.menu.addEventListener("click",t=>{t.stopPropagation()}),this.el.appendChild(this.btn),this.el.appendChild(this.menu),this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler)}render(){return this.el}update(){let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality");this.el.style.display=e.length>0?"":"none",e.length===0&&this.isOpen&&this.close(),this.btnLabel.textContent=t?.label||"Auto";let r=JSON.stringify(e.map(s=>s.id)),i=t?.id||"auto";r!==this.lastQualitiesJson&&(this.lastQualitiesJson=r,this.rebuildMenu(e)),this.updateActiveStates(i)}rebuildMenu(e){this.menu.innerHTML="";let t=this.createMenuItem("Auto","auto");this.menu.appendChild(t);let r=[...e].sort((i,s)=>s.height-i.height);for(let i of r){if(i.id==="auto")continue;let s=this.createMenuItem(i.label,i.id);this.menu.appendChild(s)}}updateActiveStates(e){this.menu.querySelectorAll(".sp-quality-menu__item").forEach(r=>{let s=r.getAttribute("data-quality-id")===e;r.classList.toggle("sp-quality-menu__item--active",s)})}createMenuItem(e,t){let r=y("div",{className:"sp-quality-menu__item"});r.setAttribute("role","menuitem"),r.setAttribute("data-quality-id",t);let i=y("span",{className:"sp-quality-menu__label"});return i.textContent=e,r.appendChild(i),r.addEventListener("click",s=>{s.preventDefault(),s.stopPropagation(),this.selectQuality(t)}),r}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.menu.classList.add("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","true")}close(){this.isOpen=!1,this.menu.classList.remove("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","false")}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),this.el.remove()}};function Li(){if(typeof navigator>"u")return!1;let n=navigator.userAgent;return/Chrome/.test(n)&&!/Edge|Edg/.test(n)}function Si(){return typeof HTMLVideoElement>"u"?!1:typeof HTMLVideoElement.prototype.webkitShowPlaybackTargetPicker=="function"}var Fe=class{constructor(e,t){this.api=e,this.type=t,this.supported=t==="chromecast"?Li():Si();let r=t==="chromecast"?E.chromecast:E.airplay,i=t==="chromecast"?"Cast":"AirPlay";this.el=Q(`sp-cast sp-cast--${t}`,i,r),this.el.addEventListener("click",()=>this.handleClick()),this.supported||(this.el.style.display="none")}render(){return this.el}update(){if(!this.supported){this.el.style.display="none";return}if(this.type==="chromecast"){let e=this.api.getState("chromecastAvailable"),t=this.api.getState("chromecastActive");this.el.style.display="",this.el.disabled=!e&&!t,this.el.classList.toggle("sp-cast--active",!!t),this.el.classList.toggle("sp-cast--unavailable",!e&&!t),t?(W(this.el,E.chromecastConnected),q(this.el,"aria-label","Stop casting")):(W(this.el,E.chromecast),q(this.el,"aria-label",e?"Cast":"No Cast devices found"))}else{let e=this.api.getState("airplayActive");this.el.style.display="",this.el.disabled=!1,this.el.classList.toggle("sp-cast--active",!!e),this.el.classList.remove("sp-cast--unavailable"),q(this.el,"aria-label",e?"Stop AirPlay":"AirPlay")}}handleClick(){this.type==="chromecast"?this.handleChromecast():this.handleAirPlay()}handleChromecast(){let e=this.api.getPlugin("chromecast");e&&(e.isConnected()?e.endSession():e.requestSession().catch(()=>{}))}async handleAirPlay(){let e=this.api.getPlugin("airplay");e?await e.showPicker():B(this.api.container)?.webkitShowPlaybackTargetPicker?.()}destroy(){this.el.remove()}};var at=class{constructor(e){this.clickHandler=()=>{this.toggle().catch(()=>{})};this.api=e;let t=document.createElement("video");this.supported="pictureInPictureEnabled"in document||"webkitSetPresentationMode"in t,this.el=Q("sp-pip","Picture-in-Picture",E.pip),this.el.addEventListener("click",this.clickHandler),this.supported?(this.el.disabled=!0,this.el.setAttribute("aria-disabled","true")):this.el.style.display="none"}render(){return this.el}isMediaReady(){let e=B(this.api.container);return!!e&&e.readyState>=HTMLMediaElement.HAVE_METADATA}update(){if(!this.supported)return;let e=!!this.api.getState("pip"),t=e||this.isMediaReady();this.el.disabled=!t,q(this.el,"aria-disabled",String(!t)),W(this.el,e?E.exitPip:E.pip),q(this.el,"aria-label",e?"Exit Picture-in-Picture":"Picture-in-Picture"),this.el.classList.toggle("sp-pip--active",e)}async toggle(){let e=B(this.api.container);if(!e){this.api.logger.warn("PiP: video element not found");return}let t=document.pictureInPictureElement===e||e.webkitPresentationMode==="picture-in-picture";if(!t&&e.readyState<HTMLMediaElement.HAVE_METADATA){this.api.logger.debug("PiP: ignored, media not ready",{readyState:e.readyState});return}try{t?(document.pictureInPictureElement?await document.exitPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("inline"),this.api.logger.debug("PiP: exited")):(e.requestPictureInPicture?await e.requestPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("picture-in-picture"),this.api.logger.debug("PiP: entered"))}catch(r){let i=r instanceof Error?r.message:String(r);this.api.logger.warn("PiP: failed",{error:i})}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var ot=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=Q("sp-fullscreen","Fullscreen",E.fullscreen),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){this.api.getState("fullscreen")?(W(this.el,E.exitFullscreen),q(this.el,"aria-label","Exit fullscreen")):(W(this.el,E.fullscreen),q(this.el,"aria-label","Fullscreen"))}async toggle(){let e=this.api.container;try{Te(e)?await Me(e):await Pe(e)}catch{}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var lt=class{constructor(){this.el=y("div",{className:"sp-spacer"})}render(){return this.el}update(){}destroy(){this.el.remove()}};function xi(n){if(!n)return"Something went wrong.";let e=n.code;if(e)switch(e){case"MEDIA_NETWORK_ERROR":return"Having trouble connecting. Check your internet and try again.";case"MEDIA_DECODE_ERROR":return"This video can't be played right now.";case"SOURCE_LOAD_FAILED":case"SOURCE_NOT_SUPPORTED":case"PROVIDER_NOT_FOUND":return"Unable to load video. Please try again.";case"PLAYBACK_FAILED":return"Playback stopped unexpectedly. Please try again.";case"MEDIA_APPEND_ERROR":return"Video playback was interrupted. Please try again.";case"MEDIA_BUFFER_FULL":return"Your device is low on video memory. Close other apps or tabs and try again.";case"PLAYLIST_INVALID":return"The stream is temporarily unavailable. Please try again."}let t=n.message?.toLowerCase()||"";return t.includes("network")||t.includes("timeout")||t.includes("fetch")||t.includes("connection")?"Having trouble connecting. Check your internet and try again.":t.includes("manifest")?"Unable to load video. Please try again.":t.includes("decode")||t.includes("media")||t.includes("format")||t.includes("codec")?"This video can't be played right now.":t.includes("not found")||t.includes("404")||t.includes("source")||t.includes("not supported")?"Video not found.":"Something went wrong."}var ct=class{constructor(e){this.visible=!1;this.lastSource=null;this.handleRetry=()=>{if(this.retryBtn.disabled)return;this.retryBtn.disabled=!0,this.hide();let t=this.api.getState("source")?.src||this.lastSource;t&&this.api.emit("error:retry",{src:t}),setTimeout(()=>{this.retryBtn.disabled=!1},1e3)};this.handleDismiss=()=>{this.hide(),this.api.emit("error:dismiss",void 0)};this.api=e;let t=document.createElement("div");t.className="sp-error-overlay",t.setAttribute("role","alert"),t.setAttribute("aria-live","assertive");let r=document.createElement("div");r.className="sp-error-overlay__content";let i=document.createElement("div");i.className="sp-error-overlay__icon",i.innerHTML=E.error;let s=document.createElement("p");s.className="sp-error-overlay__message",s.textContent="Something went wrong.";let a=document.createElement("div");a.className="sp-error-overlay__actions",this.retryBtn=document.createElement("button"),this.retryBtn.className="sp-error-overlay__retry",this.retryBtn.setAttribute("type","button"),this.retryBtn.setAttribute("aria-label","Try again"),this.retryBtn.textContent="Try Again",this.retryBtn.addEventListener("click",this.handleRetry),this.dismissBtn=document.createElement("button"),this.dismissBtn.className="sp-error-overlay__dismiss",this.dismissBtn.setAttribute("type","button"),this.dismissBtn.setAttribute("aria-label","Go back"),this.dismissBtn.textContent="Go Back",this.dismissBtn.addEventListener("click",this.handleDismiss),a.appendChild(this.retryBtn),a.appendChild(this.dismissBtn),r.appendChild(i),r.appendChild(s),r.appendChild(a),t.appendChild(r),this.el=t}render(){return this.el}show(e){let t=xi(e),r=this.el.querySelector(".sp-error-overlay__message");r&&(r.textContent=t);let i=this.api.getState("source");i?.src&&(this.lastSource=i.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.remove("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}showReconnecting(){let e=this.el.querySelector(".sp-error-overlay__message");e&&(e.textContent="Connection lost. Reconnecting...");let t=this.api.getState("source");t?.src&&(this.lastSource=t.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.add("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}hide(){this.visible=!1,this.el.classList.remove("sp-error-overlay--visible"),this.el.classList.remove("sp-error-overlay--reconnecting")}isVisible(){return this.visible}update(){let e=this.api.getState("playbackState");this.visible&&e!=="error"&&e!=="loading"&&this.api.getState("playing")&&this.hide()}destroy(){this.retryBtn.removeEventListener("click",this.handleRetry),this.dismissBtn.removeEventListener("click",this.handleDismiss),this.el.remove()}};var ki=[{label:"0.5x",value:.5},{label:"0.75x",value:.75},{label:"Normal",value:1},{label:"1.25x",value:1.25},{label:"1.5x",value:1.5},{label:"2x",value:2}],ut=class{constructor(e){this.isOpen=!1;this.currentPanel="main";this.lastQualitiesJson="";this.lastSpeedAvailable=!0;this.withdrawnRate=null;this.api=e,this.el=y("div",{className:"sp-settings"}),this.btn=Q("sp-settings__btn","Settings",E.settings),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.panel=y("div",{className:"sp-settings-panel"}),this.panel.setAttribute("role","menu"),this.panel.addEventListener("click",t=>t.stopPropagation()),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.closeHandler=t=>{this.el.contains(t.target)||this.close(!1)},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{if(this.isOpen){if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),this.currentPanel!=="main"?this.showPanel("main"):this.close();return}if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault(),t.stopPropagation(),this.navigateItems(t.key==="ArrowDown"?1:-1);return}t.key==="Tab"&&(t.preventDefault(),t.stopPropagation(),this.navigateItems(t.shiftKey?-1:1))}},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){let e=this.isSpeedAvailable();e?this.restoreRate():this.resetRate();let t=this.hasRows();this.el.style.display=t?"":"none",this.isOpen&&!t&&this.close(!1),e!==this.lastSpeedAvailable&&(this.lastSpeedAvailable=e,this.isOpen&&(this.currentPanel==="main"||this.currentPanel==="speed")&&this.showPanel("main"));let r=this.api.getState("qualities")||[],i=JSON.stringify(r.map(s=>s.id));i!==this.lastQualitiesJson&&(this.lastQualitiesJson=i,this.isOpen&&this.currentPanel==="quality"&&this.renderQualityPanel()),this.isOpen&&(this.currentPanel==="quality"?this.updateQualityActiveStates():this.currentPanel==="speed"?this.updateSpeedActiveStates():this.currentPanel==="captions"?this.updateCaptionsActiveStates():this.currentPanel==="audio"&&this.updateAudioActiveStates())}isSpeedAvailable(){return!(this.api.getState("live")&&!this.api.getState("seekableRange"))}resetRate(){let e=this.api.container.querySelector("video"),t=e?e.playbackRate:this.api.getState("playbackRate")??1;t!==1&&(this.withdrawnRate={rate:t,src:this.api.getState("source")?.src},this.api.emit("playback:ratechange",{rate:1}),e&&(e.playbackRate=1))}restoreRate(){let e=this.withdrawnRate;if(!e||(this.withdrawnRate=null,e.src!==this.api.getState("source")?.src))return;this.api.emit("playback:ratechange",{rate:e.rate});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e.rate)}hasRows(){return this.isSpeedAvailable()||(this.api.getState("qualities")||[]).length>0||(this.api.getState("textTracks")||[]).length>0||(this.api.getState("audioTracks")||[]).length>1}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.currentPanel="main",this.renderMainPanel(),this.panel.classList.add("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","true"),this.focusFirstItem()}close(e=!0){let t=this.isOpen;this.isOpen=!1,this.currentPanel="main",this.panel.classList.remove("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","false"),t&&e&&this.btn.focus()}showPanel(e){switch(this.currentPanel=e,e){case"main":this.renderMainPanel();break;case"quality":this.renderQualityPanel();break;case"speed":this.renderSpeedPanel();break;case"captions":this.renderCaptionsPanel();break;case"audio":this.renderAudioPanel();break}this.focusFirstItem()}renderMainPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--main";let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality"),r=this.api.getState("playbackRate")??1;if(e.length>0){let o=this.createMainRow("Quality",t?.label||"Auto",()=>this.showPanel("quality"));this.panel.appendChild(o)}if((this.api.getState("textTracks")||[]).length>0){let o=this.api.getState("currentTextTrack"),u=o?o.label:"Off",v=this.createMainRow("Captions",u,()=>this.showPanel("captions"));this.panel.appendChild(v)}if((this.api.getState("audioTracks")||[]).length>1){let o=this.api.getState("currentAudioTrack"),u=this.createMainRow("Audio",o?.label||"Default",()=>this.showPanel("audio"));this.panel.appendChild(u)}if(!this.isSpeedAvailable())return;let a=r===1?"Normal":`${r}x`,c=this.createMainRow("Speed",a,()=>this.showPanel("speed"));this.panel.appendChild(c)}createMainRow(e,t,r){let i=y("div",{className:"sp-settings-panel__row"});i.setAttribute("role","menuitem"),i.setAttribute("tabindex","0"),i.setAttribute("aria-haspopup","true");let s=y("span",{className:"sp-settings-panel__label"});s.textContent=e;let a=y("span",{className:"sp-settings-panel__value"});a.textContent=t;let c=y("span",{className:"sp-settings-panel__arrow"});return c.innerHTML=E.chevronDown,a.appendChild(c),i.appendChild(s),i.appendChild(a),i.addEventListener("click",o=>{o.preventDefault(),r()}),i.addEventListener("keydown",o=>{(o.key==="Enter"||o.key===" ")&&(o.preventDefault(),r())}),i}renderQualityPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Quality");this.panel.appendChild(e);let t=this.api.getState("qualities")||[],i=this.api.getState("currentQuality")?.id||"auto",s=this.createMenuItem("Auto","auto",i==="auto");s.addEventListener("click",c=>{c.preventDefault(),this.selectQuality("auto")}),this.panel.appendChild(s);let a=[...t].sort((c,o)=>o.height-c.height);for(let c of a){if(c.id==="auto")continue;let o=this.createMenuItem(c.label,c.id,c.id===i);o.addEventListener("click",u=>{u.preventDefault(),this.selectQuality(c.id)}),this.panel.appendChild(o)}}renderSpeedPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Speed");this.panel.appendChild(e);let t=this.api.getState("playbackRate")??1;for(let r of ki){let i=Math.abs(t-r.value)<.01,s=this.createMenuItem(r.label,String(r.value),i);s.addEventListener("click",a=>{a.preventDefault(),this.selectSpeed(r.value)}),this.panel.appendChild(s)}}renderCaptionsPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Captions");this.panel.appendChild(e);let t=this.api.getState("textTracks")||[],i=this.api.getState("currentTextTrack")?.id||"off",s=this.createMenuItem("Off","off",i==="off");s.addEventListener("click",a=>{a.preventDefault(),this.selectCaption(null)}),this.panel.appendChild(s);for(let a of t){let c=this.createMenuItem(a.label,a.id,a.id===i);c.addEventListener("click",o=>{o.preventDefault(),this.selectCaption(a.id)}),this.panel.appendChild(c)}}renderAudioPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Audio");this.panel.appendChild(e);let t=this.api.getState("audioTracks")||[],i=this.api.getState("currentAudioTrack")?.id??null;for(let s of t){let a=this.createMenuItem(s.label,s.id,s.id===i);a.addEventListener("click",c=>{c.preventDefault(),this.selectAudioTrack(s.id)}),this.panel.appendChild(a)}}selectAudioTrack(e){this.api.emit("track:audio",{trackId:e}),this.close()}updateAudioActiveStates(){let t=this.api.getState("currentAudioTrack")?.id??null;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(i=>{let s=i.getAttribute("data-id");i.classList.toggle("sp-settings-panel__item--active",s===t)})}selectCaption(e){this.api.emit("track:text",{trackId:e}),this.close()}updateCaptionsActiveStates(){let t=this.api.getState("currentTextTrack")?.id||"off";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(i=>{let s=i.getAttribute("data-id");i.classList.toggle("sp-settings-panel__item--active",s===t)})}createSubHeader(e){let t=y("div",{className:"sp-settings-panel__header"});t.setAttribute("role","menuitem"),t.setAttribute("tabindex","0");let r=y("span",{className:"sp-settings-panel__back"});r.innerHTML=E.chevronUp;let i=y("span",{className:"sp-settings-panel__header-label"});return i.textContent=e,t.appendChild(r),t.appendChild(i),t.addEventListener("click",s=>{s.preventDefault(),this.showPanel("main")}),t.addEventListener("keydown",s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),this.showPanel("main"))}),t}createMenuItem(e,t,r){let i=y("div",{className:`sp-settings-panel__item${r?" sp-settings-panel__item--active":""}`});i.setAttribute("role","menuitem"),i.setAttribute("tabindex","0"),i.setAttribute("data-id",t);let s=y("span");s.textContent=e;let a=y("span",{className:"sp-settings-panel__check"});return a.innerHTML=E.checkmark,i.appendChild(s),i.appendChild(a),i.addEventListener("keydown",c=>{(c.key==="Enter"||c.key===" ")&&(c.preventDefault(),i.click())}),i}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}selectSpeed(e){this.api.emit("playback:ratechange",{rate:e});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e),this.close()}updateQualityActiveStates(){let t=this.api.getState("currentQuality")?.id||"auto";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(i=>{let s=i.getAttribute("data-id");i.classList.toggle("sp-settings-panel__item--active",s===t)})}updateSpeedActiveStates(){let e=this.api.getState("playbackRate")??1;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let i=r.getAttribute("data-id"),s=parseFloat(i||"1");r.classList.toggle("sp-settings-panel__item--active",Math.abs(e-s)<.01)})}getFocusableItems(){return Array.from(this.panel.querySelectorAll('[role="menuitem"]'))}focusFirstItem(){requestAnimationFrame(()=>{let e=this.getFocusableItems();e.length>0&&e[0].focus()})}navigateItems(e){let t=this.getFocusableItems();if(t.length===0)return;let r=document.activeElement,i=t.indexOf(r),s;i===-1?s=e===1?0:t.length-1:s=(i+e+t.length)%t.length,t[s].focus()}getPanel(){return this.currentPanel}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.el.remove()}};var Ti=10,Oe=class{constructor(e,t,r=Ti){this.clickHandler=()=>{this.skip()};this.api=e,this.direction=t,this.seconds=r;let i=t==="backward"?E.replay10:E.forward10,s=t==="backward"?`Rewind ${r} seconds`:`Forward ${r} seconds`;this.el=Q(`sp-skip sp-skip--${t}`,s,i),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("duration")??0,r=this.api.getState("seekableRange");if(e&&!r){this.el.style.display="none";return}if(e&&r){this.el.style.display="";return}if(t===0){this.el.style.display="none";return}this.el.style.display=""}skip(){let e=B(this.api.container);if(!e)return;let t=this.api.getState("live"),r=this.api.getState("seekableRange"),i;if(t&&r){if(this.direction==="forward"&&this.api.getState("liveEdge"))return;i=this.direction==="backward"?Math.max(r.start,e.currentTime-this.seconds):Math.min(r.end,e.currentTime+this.seconds)}else{let s=e.duration||0;if(!s||!isFinite(s))return;i=this.direction==="backward"?Math.max(0,e.currentTime-this.seconds):Math.min(s,e.currentTime+this.seconds)}e.currentTime=i,this.api.emit("playback:seeking",{time:i})}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var dt=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=Q("sp-captions","Captions",E.captionsOff),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("textTracks")||[],t=this.api.getState("currentTextTrack");if(e.length===0){this.el.style.display="none";return}this.el.style.display="",t?(W(this.el,E.captions),q(this.el,"aria-label",`Captions: ${t.label}`),this.el.classList.add("sp-captions--active")):(W(this.el,E.captionsOff),q(this.el,"aria-label","Captions"),this.el.classList.remove("sp-captions--active"))}toggle(){let e=this.api.getState("textTracks")||[],t=this.api.getState("currentTextTrack");e.length!==0&&(t?this.api.emit("track:text",{trackId:null}):this.api.emit("track:text",{trackId:e[0].id}))}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var Pi='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"/></svg>',pt=class{constructor(e){this.api=e,this.el=y("div",{className:"sp-bandwidth-indicator"}),this.el.innerHTML=Pi,this.el.setAttribute("aria-label","Bandwidth is limiting video quality"),this.el.setAttribute("title","Bandwidth is limiting video quality"),this.el.style.display="none"}render(){return this.el}update(){let e=this.api.getState("bandwidth"),t=this.api.getState("qualities");if(!e||!t||t.length===0){this.el.style.display="none";return}let r=Math.max(...t.map(i=>i.bitrate));r>0&&e<r?this.el.style.display="":this.el.style.display="none"}destroy(){this.el.remove()}};var ht=class{constructor(e){this.api=e;this.isOpen=!1;this.toggleHandler=()=>{this.isOpen?this.close():this.open()};this.el=y("div",{className:"sp-overflow"}),this.btn=Q("sp-overflow__btn","More controls",E.more),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",this.toggleHandler),this.panel=y("div",{className:"sp-overflow-tray",role:"group","aria-label":"More controls"}),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.el.style.display="none",this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{!this.isOpen||t.key!=="Escape"||(t.preventDefault(),t.stopPropagation(),this.close(),this.btn.focus())},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){}adopt(e){this.panel.appendChild(e),this.syncVisibility()}release(e){return e.parentNode===this.panel&&this.panel.removeChild(e),this.syncVisibility(),e}holds(e){return e.parentNode===this.panel}open(){this.isOpen||(this.isOpen=!0,this.panel.classList.add("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","true"))}close(){this.isOpen&&(this.isOpen=!1,this.panel.classList.remove("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","false"))}isMenuOpen(){return this.isOpen}syncVisibility(){let e=Array.from(this.panel.children).some(t=>t.style.display!=="none");this.el.style.display=e?"":"none",!e&&this.isOpen&&this.close()}refresh(){this.syncVisibility()}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.btn.removeEventListener("click",this.toggleHandler),this.el.remove(),this.api.logger.debug("Overflow tray destroyed")}};var Mi=new Map,_i=new Map,kr=new Set;function Jt(n,e){if(e){let t=_i.get(e)?.get(n);if(t)return t}return Mi.get(n)??null}function Tr(n){return kr.add(n),()=>{kr.delete(n)}}var Pr=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var Zt=[32,32,32],Mr=4.5,Ai=`
  aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff
  beige:f5f5dc bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff
  blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0
  chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed
  cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b
  darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9
  darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00
  darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f
  darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f
  darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff
  dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222
  floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc
  ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000
  greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c
  indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5
  lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080
  lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90
  lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa
  lightskyblue:87cefa lightslategray:778899 lightslategrey:778899
  lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32
  linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa
  mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371
  mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc
  mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1
  moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000
  olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6
  palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093
  papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd
  powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f
  royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460
  seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb
  slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f
  steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347
  turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5
  yellow:ffff00 yellowgreen:9acd32`,_r;function Ci(n){return _r??(_r=new Map(Ai.trim().split(/\s+/).map(e=>e.split(":")))),_r.get(n)}var Hi=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/;function Ar(n,e){if(!Hi.test(n))return null;let t=n.endsWith("%")?parseFloat(n)/100*e:parseFloat(n);return Math.min(e,Math.max(0,t))}function Cr(n){let e=/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(n)?.[1];if(!e)return null;let t=e.length<=4?e.split("").map(i=>i+i).join(""):e,r=t.length===8?parseInt(t.slice(6,8),16)/255:1;return[[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)],r]}function Ri(n){let e=/^rgba?\(([^()]*)\)$/.exec(n)?.[1]?.trim();if(!e)return null;let t,r;if(e.includes(","))t=e.split(",").map(a=>a.trim()),t.length===4&&(r=t.pop());else{let[a="",c,...o]=e.split("/").map(u=>u.trim());if(o.length||c==="")return null;t=a.split(/\s+/),r=c}if(t.length!==3)return null;let i=t.map(a=>Ar(a,255)),s=r===void 0?1:Ar(r,1);return i.some(a=>a===null)||s===null?null:[i.map(a=>Math.round(a)),s]}function Di(n,e){let t=n.trim().toLowerCase(),r=Ci(t),i=r?Cr(`#${r}`):Cr(t)??Ri(t);if(!i)return null;let[s,a]=i;return a<=0?null:a>=1?s:s.map((c,o)=>Math.round(c*a+e[o]*(1-a)))}function _t([n,e,t]){let[r,i,s]=[n,e,t].map(a=>{let c=a/255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)});return .2126*r+.7152*i+.0722*s}function Hr(n,e){let t=Math.max(_t(n),_t(e)),r=Math.min(_t(n),_t(e));return(t+.05)/(r+.05)}function Ii(n,e){return n.map(t=>Math.round(t+(255-t)*e))}function Rr(n){return`#${n.map(e=>e.toString(16).padStart(2,"0")).join("")}`}function er(n){let e=Di(n,Zt);if(!e)return n;if(Hr(e,Zt)>=Mr)return Rr(e);for(let t=.04;t<=1;t+=.04){let r=Ii(e,t);if(Hr(r,Zt)>=Mr)return Rr(r)}return"#ffffff"}var Ni=["play","skip-backward","skip-forward","volume","time","live-indicator","bandwidth-indicator","spacer","settings","captions","chromecast","airplay","pip","fullscreen"],Fi="sp-ui-styles",Oi=3e3,Bi=new Set([" ","Enter"]),Vi=new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"]),Ui=48,Dr=64,$i=44,Ir=24,Nr=4,zi=100,qi=16,Ki=56,Wi=120,Fr=1500;function Or(n={}){let e,t=null,r=null,i=null,s=null,a=null,c=null,o=null,u=[],v=null,P=null,C=null,Y=null,_=null,V=null,I=null,w=!0,Z=null,x=null,A=[],R=null,se=null,m=null,K=null,ee=Ir,L=Nr,U=Dr,z=null,S=!0,N=!1,k=!1,$=new Set,G=null,ae=n.controls||Ni,ge=n.hideDelay??Oi,re=n.bigPlayButton!==!1,te=n.responsive!==!1;te&&Qt(ae,n.priority);let ye=g=>{switch(g){case"play":return new Je(e);case"skip-backward":return new Oe(e,"backward");case"skip-forward":return new Oe(e,"forward");case"volume":return new it(e);case"progress":return null;case"time":return new rt(e);case"live-indicator":return new nt(e);case"bandwidth-indicator":return new pt(e);case"quality":return new st(e);case"settings":return new ut(e);case"captions":return new dt(e);case"chromecast":return new Fe(e,"chromecast");case"airplay":return new Fe(e,"airplay");case"pip":return new at(e);case"fullscreen":return new ot(e);case"spacer":return new lt;default:{let f=Jt(g,e.container);if(f)try{return f(e)}catch(l){return e.logger.error(`Control factory for "${g}" threw`,{error:l}),null}return $.add(g),e.logger.debug(`No control registered for slot "${g}" yet`),null}}},Le=()=>{G=null;for(let g of $)e.logger.warn(`Control slot "${g}" has no registered control after ${Fr}ms - is the plugin installed?`);$.clear()},gt=()=>{if(!t)return;$.clear();let g=new Map(Mt(ae,n.priority).map(f=>[f.id,f]));for(let f of ae){let l=ye(f);if(!l)continue;u.push(l);let p=l.render();t.appendChild(p);let d=g.get(f),h={slot:f,control:l,el:p,rank:d?.rank??"never",exit:d?.exit??"overflow",width:-1};A.push(h),f==="time"&&(R=h)}te&&(x=new ht(e),u.push(x),t.appendChild(x.render()),Ce())},Ce=()=>{if(!t||!x)return;let g=x.render(),f=A.find(p=>p.slot==="fullscreen"),l=f&&f.el.parentNode===t?f.el:null;if(l){g.nextSibling!==l&&t.insertBefore(g,l);return}t.lastChild!==g&&t.appendChild(g)},ft=()=>{let g="";for(let f of A)g+=f.el.style.display==="none"?"0":"1";return`${g}:${R?.el.textContent?.length??0}`},Be=g=>{if(!t||!x)return;let f=new Set(g.overflow),l=new Set(g.hidden);for(let p of A)if(p.slot!=="spacer"){if(l.has(p.slot)){x.holds(p.el)&&Ve(p),p.el.classList.add("sp-control--collapsed");continue}p.el.classList.remove("sp-control--collapsed"),f.has(p.slot)?x.holds(p.el)||x.adopt(p.el):x.holds(p.el)&&Ve(p)}x.refresh(),Ce()},Ve=g=>{if(!t||!x)return;let f=x.release(g.el),l=x.render(),p=l.parentNode===t?l:null;for(let d=A.indexOf(g)+1;d<A.length;d++)if(A[d].el.parentNode===t){p=A[d].el;break}t.insertBefore(f,p)},Se=g=>{if(g.slot!=="volume")return 0;let f=g.el.querySelector(".sp-volume__slider-wrap");return f?f.getBoundingClientRect().width:0},He=g=>g.slot==="volume"?U:0,At=g=>{let f=getComputedStyle(g),l=parseFloat(f.paddingLeft),p=parseFloat(f.paddingRight),d=parseFloat(f.columnGap||f.gap),h=parseFloat(f.getPropertyValue("--sp-volume-slider-width"));ee=Number.isFinite(l)&&Number.isFinite(p)?l+p:Ir,L=Number.isFinite(d)?d:Nr,U=Number.isFinite(h)?h:Dr},Ct=()=>{if(!te||!t||!x||t.clientWidth===0)return;At(t);let g=A.filter(h=>h.slot==="spacer"&&h.el.style.display!=="none").length,f=t.clientWidth-ee-g*L,l=[];for(let h of A){if(h.slot==="spacer")continue;let b=h.el.style.display!=="none";b&&h.el.parentNode===t&&!h.el.classList.contains("sp-control--collapsed")?h.width=h.el.getBoundingClientRect().width-Se(h):h.width<0&&(h.width=Ui),l.push({id:h.slot,rank:h.rank,exit:h.exit,width:h.width+He(h),visible:b})}let p=x.render(),d=p.style.display==="none"?0:p.getBoundingClientRect().width;Be(Yt(l,f,L,d||$i)),z=ft(),S=!1},Ht=()=>{te&&(!S&&ft()===z||Ct())},xe=g=>{let f=t?.offsetHeight||Ki;e?.container?.style.setProperty("--sp-menu-max-height",`${Math.max(Wi,Math.round(g)-f-qi)}px`)},Rt=()=>{t&&(u.forEach(g=>g.destroy()),u=[],A=[],R=null,x=null,Xe(t),z=null,S=!0,gt(),oe())},mt=()=>{k&&(k=!1,Rt())},Dt=()=>{k||(k=!0,queueMicrotask(mt))},oe=()=>{u.forEach(h=>h.update()),i?.update();let g=e?.getState("waiting"),f=e?.getState("seeking"),p=e?.getState("playbackState")==="loading",d=g||f&&!e?.getState("paused")||p;s?.classList.toggle("sp-buffering--visible",!!d),a?.update(),c?.update(),Ht()},fe=()=>{Z===null&&(Z=requestAnimationFrame(()=>{Z=null,oe()}))},vt=()=>i?.isTimelineEditing()?!0:u.some(g=>{let f=g;return typeof f.isMenuOpen=="function"&&f.isMenuOpen()}),me=()=>{if(w){ve();return}w=!0,t?.classList.add("sp-controls--visible"),t?.classList.remove("sp-controls--hidden"),r?.classList.add("sp-gradient--visible"),i?.show(),e?.setState("controlsVisible",!0),ve()},be=()=>{if(!e?.getState("paused")){if(vt()){ve();return}w=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),r?.classList.remove("sp-gradient--visible"),i?.hide(),e?.setState("controlsVisible",!1)}},ve=()=>{v&&clearTimeout(v),v=setTimeout(be,ge)},Ee=null,Re=g=>{Ee=g.pointerType},pe=g=>{Ee==="touch"&&!It(g)&&e?.getPlugin("gestures")?.ownsTapInteraction()||me()},It=g=>{let f=g?.target;return f instanceof Node?!!t?.contains(f)||!!i?.render().contains(f):!1},Ue=()=>{be()},$e=g=>{if(!e.container.contains(document.activeElement)||g.defaultPrevented||g.metaKey||g.ctrlKey||g.altKey)return;let f=document.activeElement;if(f instanceof HTMLInputElement||f instanceof HTMLTextAreaElement||f instanceof HTMLSelectElement||f?.isContentEditable)return;let l=f?.getAttribute("role");if((f instanceof HTMLButtonElement||l==="button"||l==="menuitem")&&Bi.has(g.key)||l==="slider"&&Vi.has(g.key))return;let d=e.container.querySelector("video");if(!d)return;let h=e.getState("live"),b=e.getState("seekableRange");switch(g.key){case" ":case"k":g.preventDefault(),d.paused?d.play().catch(()=>{}):d.pause();break;case"m":g.preventDefault(),d.muted=!d.muted;break;case"f":g.preventDefault(),Te(e.container)?Me(e.container).catch(()=>{}):Pe(e.container).catch(()=>{});break;case"ArrowLeft":g.preventDefault(),h&&b?d.currentTime=Math.max(b.start,d.currentTime-5):d.currentTime=Math.max(0,d.currentTime-5),e.emit("playback:seeking",{time:d.currentTime}),me();break;case"ArrowRight":g.preventDefault(),h&&b?d.currentTime=Math.min(b.end,d.currentTime+5):d.currentTime=Math.min(d.duration||0,d.currentTime+5),e.emit("playback:seeking",{time:d.currentTime}),me();break;case"ArrowUp":g.preventDefault(),d.volume=Math.min(1,d.volume+.1),me();break;case"ArrowDown":g.preventDefault(),d.volume=Math.max(0,d.volume-.1),me();break}};return{id:"ui-controls",name:"UI Controls",type:"ui",version:Pr,async init(g){e=g,o=Ut(Fi,jt),n.theme&&this.setTheme(n.theme);let f=e.container;if(!f){e.logger.error("UI plugin: container not found");return}getComputedStyle(f).position==="static"&&(f.style.position="relative"),f.classList.contains("sp-container")||(f.classList.add("sp-container"),N=!0);let p=e.getState("playing");r=document.createElement("div"),r.className=p?"sp-gradient":"sp-gradient sp-gradient--visible",f.appendChild(r),s=document.createElement("div"),s.className="sp-buffering",s.innerHTML=E.spinner,s.setAttribute("aria-hidden","true"),f.appendChild(s),a=new ct(e),f.appendChild(a.render()),Y=e.on("error",d=>{if(d?.fatal){let h=e.getState("error")||d;a?.show(h),fe()}}),_=e.on("error:reconnecting",()=>{a?.showReconnecting(),fe()}),V=e.on("error:recovered",()=>{a?.hide(),fe()}),I=e.on("media:loaded",()=>{a?.hide(),fe()}),re&&(c=new Ze(e,()=>a?.isVisible()??!1),f.appendChild(c.render())),i=new tt(e,{onEditingChange:d=>{d?me():ve()}}),f.appendChild(i.render()),p||i.show(),t=document.createElement("div"),t.className=p?"sp-controls sp-controls--hidden":"sp-controls sp-controls--visible",t.setAttribute("role","toolbar"),t.setAttribute("aria-label","Video controls"),gt(),$.size>0&&(G=setTimeout(Le,Fr)),f.appendChild(t),te&&typeof ResizeObserver=="function"?(se=new ResizeObserver(d=>{xe(d[0]?.contentRect.height??f.clientHeight),S=!0,fe()}),se.observe(f)):te&&typeof window<"u"&&(K=()=>{m&&clearTimeout(m),m=setTimeout(()=>{m=null,xe(f.clientHeight),S=!0,fe()},zi)},window.addEventListener("resize",K)),C=Tr((d,h)=>{ae.includes(d)&&(h&&h!==e.container||(e.logger.debug(`Control "${d}" registered after init, queuing a control bar rebuild`),Dt()))}),f.addEventListener("pointerdown",Re,{passive:!0}),f.addEventListener("pointermove",Re,{passive:!0}),f.addEventListener("mousemove",pe),f.addEventListener("mouseenter",pe),f.addEventListener("mouseleave",Ue),f.addEventListener("touchstart",pe,{passive:!0}),f.addEventListener("click",pe),document.addEventListener("keydown",$e),P=e.subscribeToState(fe),oe(),f.hasAttribute("tabindex")||f.setAttribute("tabindex","0"),w=!p,e.setState("controlsVisible",w),p&&ve(),e.logger.debug("UI controls plugin initialized")},async destroy(){v&&(clearTimeout(v),v=null),Z!==null&&(cancelAnimationFrame(Z),Z=null),se?.disconnect(),se=null,K&&(window.removeEventListener("resize",K),K=null),m&&(clearTimeout(m),m=null),e?.container?.style.removeProperty("--sp-menu-max-height"),P?.(),P=null,Y?.(),Y=null,_?.(),_=null,V?.(),V=null,I?.(),I=null,e?.container&&(e.container.removeEventListener("pointerdown",Re),e.container.removeEventListener("pointermove",Re),e.container.removeEventListener("mousemove",pe),e.container.removeEventListener("mouseenter",pe),e.container.removeEventListener("mouseleave",Ue),e.container.removeEventListener("touchstart",pe),e.container.removeEventListener("click",pe)),document.removeEventListener("keydown",$e),C?.(),C=null,k=!1,G&&(clearTimeout(G),G=null),$.clear(),u.forEach(g=>g.destroy()),u=[],A=[],R=null,x=null,i?.destroy(),i=null,a?.destroy(),a=null,c?.destroy(),c=null,t?.remove(),t=null,r?.remove(),r=null,s?.remove(),s=null,o?.(),o=null,N&&(e?.container?.classList.remove("sp-container"),N=!1),e?.logger.debug("UI controls plugin destroyed")},show(){me()},hide(){w=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),r?.classList.remove("sp-gradient--visible"),i?.hide(),e?.setState("controlsVisible",!1)},setTheme(g){let f=e?.container||document.documentElement;g.primaryColor&&f.style.setProperty("--sp-color",g.primaryColor),g.accentColor&&f.style.setProperty("--sp-accent",g.accentColor),g.accentTextColor&&f.style.setProperty("--sp-accent-text",g.accentTextColor),g.backgroundColor&&f.style.setProperty("--sp-bg",g.backgroundColor),g.controlBarHeight&&f.style.setProperty("--sp-control-height",`${g.controlBarHeight}px`),g.iconSize&&f.style.setProperty("--sp-icon-size",`${g.iconSize}px`)},getControlBar(){return t}}}async function Lo(n,e){let t=e.accentColor??"#e50914",r=await Bt({container:n,src:e.src,poster:e.poster,plugins:[yr(),wr(),Or({theme:{accentColor:t,accentTextColor:er(t)}})]});if(r.getState().error)throw await r.destroy(),new Error("The sample failed to load");return{async play(){let i=n.querySelector("video");if(!i)throw new Error("The player has no media element");await i.play()},onFirstPlaying(i){if(r.playing){i();return}let s=r.subscribeToState(a=>{a.key==="playing"&&a.value===!0&&(s(),i())})},destroy(){return r.destroy()}}}export{Lo as mountHomePlayer};
