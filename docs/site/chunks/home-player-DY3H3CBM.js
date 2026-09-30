import{a as Nr}from"./chunk-VC46IEJQ.js";var Ae=null;var Jt=new WeakMap;function yt(i,e){let t=Jt.get(i);t||(t=new Set,Jt.set(i,t)),t.add(e)}var Oe=class{constructor(e){this.subscribers=new Set;this.value=e}get(){if(Ae){let e=Ae;this.subscribers.add(e),yt(e,()=>this.subscribers.delete(e))}return this.value}set(e){Object.is(this.value,e)||(this.value=e,this.notify())}update(e){this.set(e(this.value))}subscribe(e){return this.subscribers.add(e),()=>this.subscribers.delete(e)}notify(){Array.from(this.subscribers).forEach(e=>{try{e()}catch(t){console.error("[Scarlett Player] Error in signal subscriber:",t)}})}destroy(){this.subscribers.clear()}getSubscriberCount(){return this.subscribers.size}};function bt(i){return new Oe(i)}var Ce={playbackState:"idle",playing:!1,paused:!0,ended:!1,buffering:!1,waiting:!1,seeking:!1,currentTime:0,duration:NaN,buffered:null,bufferedAmount:0,mediaType:"unknown",source:null,title:"",poster:"",volume:1,muted:!1,playbackRate:1,fullscreen:!1,pip:!1,controlsVisible:!0,qualities:[],currentQuality:null,audioTracks:[],currentAudioTrack:null,textTracks:[],currentTextTrack:null,live:!1,liveEdge:!0,seekableRange:null,liveLatency:0,lowLatencyMode:!1,chapters:[],currentChapter:null,error:null,bandwidth:0,autoplay:!1,loop:!1,airplayAvailable:!1,airplayActive:!1,chromecastAvailable:!1,chromecastActive:!1,thumbnails:null,interacting:!1,hovering:!1,focused:!1},Be=class{constructor(e){this.signals=new Map;this.changeSubscribers=new Set;this.definedDefaults=new Map;this.lastValues=new Map;this.destroyed=!1;this.initializeSignals(e)}initializeSignals(e){let t={...Ce,...e};for(let[r,n]of Object.entries(t))this.createSignal(r,n)}createSignal(e,t){let r=bt(t);this.lastValues.set(e,t),r.subscribe(()=>{this.notifyChangeSubscribers(e)}),this.signals.set(e,r)}define(e,t){if(this.signals.has(e)){let r=this.definedDefaults.has(e),n=e in Ce,s=r?this.definedDefaults.get(e):Ce[e];(r||n)&&!Object.is(s,t)&&console.warn(`[StateManager] State key "${String(e)}" is already defined with a different default. Keeping:`,s,"ignoring:",t);return}this.definedDefaults.set(e,t),this.createSignal(e,t)}get(e){if(this.destroyed)throw new Error(`[StateManager] Manager is destroyed (reading '${e}')`);let t=this.signals.get(e);if(!t)throw new Error(`[StateManager] Unknown state key: ${e}`);return t}getValue(e){return this.get(e).get()}set(e,t){this.get(e).set(t)}update(e){for(let[t,r]of Object.entries(e)){let n=t;this.signals.has(n)&&this.set(n,r)}}subscribeToKey(e,t){let r=this.get(e);return r.subscribe(()=>{t(r.get())})}subscribe(e){return this.changeSubscribers.add(e),()=>this.changeSubscribers.delete(e)}notifyChangeSubscribers(e){let r=this.get(e).get(),n=this.lastValues.get(e);this.lastValues.set(e,r);let s={key:e,value:r,previousValue:n};Array.from(this.changeSubscribers).forEach(a=>{try{a(s)}catch(d){console.error("[StateManager] Error in change subscriber:",d)}})}reset(){this.update({...Ce,...Object.fromEntries(this.definedDefaults)})}resetKey(e){let t=e in Ce?Ce[e]:this.definedDefaults.get(e);this.set(e,t)}snapshot(){let e={};for(let[t,r]of this.signals)e[t]=r.get();return Object.freeze(e)}getSubscriberCount(e){return this.signals.get(e)?.getSubscriberCount()??0}destroy(){this.signals.forEach(e=>e.destroy()),this.signals.clear(),this.changeSubscribers.clear(),this.lastValues.clear(),this.destroyed=!0}};var $r={maxListeners:100,async:!1,interceptors:!0},Ve=class{constructor(e){this.listeners=new Map;this.onceListeners=new Map;this.interceptors=new Map;this.options={...$r,...e}}on(e,t){return this.listeners.has(e)||this.listeners.set(e,new Set),this.listeners.get(e).add(t),this.checkMaxListeners(e),()=>this.off(e,t)}once(e,t){this.onceListeners.has(e)||this.onceListeners.set(e,new Set);let r=this.onceListeners.get(e);return r.add(t),this.listeners.has(e)||this.listeners.set(e,new Set),()=>{r.delete(t)}}off(e,t){let r=this.listeners.get(e);r&&(r.delete(t),r.size===0&&this.listeners.delete(e));let n=this.onceListeners.get(e);n&&(n.delete(t),n.size===0&&this.onceListeners.delete(e))}emit(e,t){let r=this.runInterceptors(e,t);if(r===null)return;let n=this.listeners.get(e);n&&Array.from(n).forEach(d=>{this.safeCallHandler(d,r)});let s=this.onceListeners.get(e);s&&(Array.from(s).forEach(d=>{s.delete(d),this.safeCallHandler(d,r)}),s.size===0&&this.onceListeners.delete(e))}async emitAsync(e,t){let r=await this.runInterceptorsAsync(e,t);if(r===null)return;let n=this.listeners.get(e);if(n){let a=Array.from(n).map(d=>this.safeCallHandlerAsync(d,r));await Promise.all(a)}let s=this.onceListeners.get(e);if(s){let d=Array.from(s).map(o=>(s.delete(o),this.safeCallHandlerAsync(o,r)));await Promise.all(d),s.size===0&&this.onceListeners.delete(e)}}intercept(e,t){if(!this.options.interceptors)return()=>{};this.interceptors.has(e)||this.interceptors.set(e,new Set);let r=this.interceptors.get(e);return r.add(t),()=>{r.delete(t),r.size===0&&this.interceptors.delete(e)}}removeAllListeners(e){e?(this.listeners.delete(e),this.onceListeners.delete(e)):(this.listeners.clear(),this.onceListeners.clear())}listenerCount(e){let t=this.listeners.get(e)?.size??0,r=this.onceListeners.get(e)?.size??0;return t+r}destroy(){this.listeners.clear(),this.onceListeners.clear(),this.interceptors.clear()}runInterceptors(e,t){if(!this.options.interceptors)return t;let r=this.interceptors.get(e);if(!r||r.size===0)return t;let n=t;for(let s of r)try{if(n=s(n),n===null)return null}catch(a){console.error("[EventBus] Error in interceptor:",a)}return n}async runInterceptorsAsync(e,t){if(!this.options.interceptors)return t;let r=this.interceptors.get(e);if(!r||r.size===0)return t;let n=t;for(let s of r)try{let a=s(n);if(n=a instanceof Promise?await a:a,n===null)return null}catch(a){console.error("[EventBus] Error in interceptor:",a)}return n}safeCallHandler(e,t){try{e(t)}catch(r){console.error("[EventBus] Error in event handler:",r)}}async safeCallHandlerAsync(e,t){try{let r=e(t);r instanceof Promise&&await r}catch(r){console.error("[EventBus] Error in event handler:",r)}}checkMaxListeners(e){let t=this.listenerCount(e);t>this.options.maxListeners&&console.warn(`[EventBus] Max listeners (${this.options.maxListeners}) exceeded for event: ${e}. Current count: ${t}. This may indicate a memory leak.`)}};var tr=["debug","info","warn","error"],zr=i=>{let t=`${i.scope?`[${i.scope}]`:"[ScarlettPlayer]"} ${i.message}`,r=i.metadata??"";switch(i.level){case"debug":console.debug(t,r);break;case"info":console.info(t,r);break;case"warn":console.warn(t,r);break;case"error":console.error(t,r);break}},Ue=class i{constructor(e){this.level=e?.level??"warn",this.scope=e?.scope,this.enabled=e?.enabled??!0,this.handlers=e?.handlers??[zr]}child(e){return new i({level:this.level,scope:this.scope?`${this.scope}:${e}`:e,enabled:this.enabled,handlers:this.handlers})}debug(e,t){this.log("debug",e,t)}info(e,t){this.log("info",e,t)}warn(e,t){this.log("warn",e,t)}error(e,t){this.log("error",e,t)}setLevel(e){this.level=e}setEnabled(e){this.enabled=e}addHandler(e){this.handlers.push(e)}removeHandler(e){let t=this.handlers.indexOf(e);t!==-1&&this.handlers.splice(t,1)}log(e,t,r){if(!this.enabled||!this.shouldLog(e))return;let n={level:e,message:t,timestamp:Date.now(),scope:this.scope,metadata:r};for(let s of this.handlers)try{s(n)}catch(a){console.error("[Logger] Handler error:",a)}}shouldLog(e){return tr.indexOf(e)>=tr.indexOf(this.level)}};var $e=class{constructor(e,t,r){this.errors=[];this.eventBus=e,this.logger=t,this.maxHistory=r?.maxHistory??10}handle(e,t){let r=this.normalizeError(e,t);return this.addToHistory(r),this.logError(r),this.eventBus.emit("error",r),r}record(e,t){let r=this.normalizeError(e,t);return this.addToHistory(r),this.logError(r),r}throw(e,t,r){let n={code:e,message:t,fatal:r?.fatal??this.isFatalCode(e),timestamp:Date.now(),context:r?.context,originalError:r?.originalError};return this.handle(n,r?.context)}getHistory(){return[...this.errors]}getLastError(){return this.errors[this.errors.length-1]??null}clearHistory(){this.errors=[]}hasFatalError(){return this.errors.some(e=>e.fatal)}normalizeError(e,t){return this.isPlayerError(e)?{...e,context:{...e.context,...t}}:{code:this.getErrorCode(e),message:e.message,fatal:this.isFatal(e,t),timestamp:Date.now(),context:t,originalError:e}}getErrorCode(e){let t=e.message.toLowerCase();return t.includes("quota")?"MEDIA_BUFFER_FULL":t.includes("append")||t.includes("sourcebuffer")||t.includes("arraybuffer")?"MEDIA_APPEND_ERROR":t.includes("network")?"MEDIA_NETWORK_ERROR":t.includes("decode")?"MEDIA_DECODE_ERROR":t.includes("source")?"SOURCE_LOAD_FAILED":t.includes("plugin")?"PLUGIN_SETUP_FAILED":t.includes("provider")?"PROVIDER_SETUP_FAILED":"UNKNOWN_ERROR"}isFatal(e,t){return t?.operation==="load"?!0:this.isFatalCode(this.getErrorCode(e))}isFatalCode(e){return["SOURCE_NOT_SUPPORTED","PROVIDER_NOT_FOUND","MEDIA_DECODE_ERROR"].includes(e)}isPlayerError(e){return typeof e=="object"&&e!==null&&"code"in e&&"message"in e&&"fatal"in e&&"timestamp"in e}addToHistory(e){this.errors.push(e),this.errors.length>this.maxHistory&&this.errors.shift()}logError(e){let t=`[${e.code}] ${e.message}`;e.fatal?this.logger.error(t,{code:e.code,context:e.context}):this.logger.warn(t,{code:e.code,context:e.context})}};var ze=class{constructor(e,t){this.cleanupFns=[];this.pluginId=e,this.stateManager=t.stateManager,this.eventBus=t.eventBus,this.container=t.container,this.getPluginFn=t.getPlugin,this.logger={debug:(r,n)=>t.logger.debug(`[${e}] ${r}`,n),info:(r,n)=>t.logger.info(`[${e}] ${r}`,n),warn:(r,n)=>t.logger.warn(`[${e}] ${r}`,n),error:(r,n)=>t.logger.error(`[${e}] ${r}`,n)}}getState(e){return this.stateManager.getValue(e)}setState(e,t){this.stateManager.set(e,t)}defineState(e,t){this.stateManager.define(e,t)}on(e,t){return this.eventBus.on(e,t)}off(e,t){this.eventBus.off(e,t)}emit(e,t){this.eventBus.emit(e,t)}getPlugin(e){return this.getPluginFn(e)}onDestroy(e){this.cleanupFns.push(e)}subscribeToState(e){return this.stateManager.subscribe(e)}runCleanups(){for(let e of this.cleanupFns)try{e()}catch(t){this.logger.error("Cleanup function failed",{error:t})}this.cleanupFns=[]}getCleanupFns(){return this.cleanupFns}};var Ke=class{constructor(e,t,r,n){this.plugins=new Map;this.initPromises=new Map;this.initializingStack=new Set;this.eventBus=e,this.stateManager=t,this.logger=r,this.container=n.container}register(e,t){if(this.plugins.has(e.id))throw new Error(`Plugin "${e.id}" is already registered`);this.validatePlugin(e);let r=new ze(e.id,{stateManager:this.stateManager,eventBus:this.eventBus,logger:this.logger,container:this.container,getPlugin:n=>this.getReadyPlugin(n)});this.plugins.set(e.id,{plugin:e,state:"registered",config:t,cleanupFns:[],api:r}),this.logger.info(`Plugin registered: ${e.id}`),this.eventBus.emit("plugin:registered",{name:e.id,type:e.type})}async unregister(e){let t=this.plugins.get(e);t&&(t.state==="ready"&&await this.destroyPlugin(e),this.plugins.delete(e),this.logger.info(`Plugin unregistered: ${e}`))}async initAll(){let e=this.resolveDependencyOrder();for(let t of e)await this.initPlugin(t)}async initPlugin(e){let t=this.plugins.get(e);if(!t)throw new Error(`Plugin "${e}" not found`);if(t.state==="ready")return;if(this.initializingStack.has(e))throw new Error(`Plugin "${e}" is already initializing (possible circular dependency)`);let r=this.initPromises.get(e);if(r)return r;if(t.state==="initializing"){let s=this.initPromises.get(e);return s||void 0}let n=(async()=>{this.initializingStack.add(e);try{for(let s of t.plugin.dependencies||[]){let a=this.plugins.get(s);if(!a)throw new Error(`Plugin "${e}" depends on missing plugin "${s}"`);a.state!=="ready"&&await this.initPlugin(s)}}finally{this.initializingStack.delete(e)}try{if(t.state="initializing",t.plugin.onStateChange){let s=this.stateManager.subscribe(t.plugin.onStateChange.bind(t.plugin));t.api.onDestroy(s)}if(t.plugin.onError){let s=this.eventBus.on("error",a=>{t.plugin.onError?.(a.originalError||new Error(a.message))});t.api.onDestroy(s)}await t.plugin.init(t.api,t.config),t.state="ready",this.logger.info(`Plugin ready: ${e}`),this.eventBus.emit("plugin:active",{name:e})}catch(s){throw t.state="error",t.error=s,this.logger.error(`Plugin init failed: ${e}`,{error:s}),this.eventBus.emit("plugin:error",{name:e,error:s}),s}finally{this.initPromises.delete(e)}})();return this.initPromises.set(e,n),n}async destroyAll(){let e=this.resolveDependencyOrder().reverse();for(let t of e)await this.destroyPlugin(t)}async destroyPlugin(e){let t=this.plugins.get(e);if(!(!t||t.state!=="ready"))try{await t.plugin.destroy()}catch(r){this.logger.error(`Plugin destroy failed: ${e}`,{error:r})}finally{t.api.runCleanups(),t.state="registered",this.eventBus.emit("plugin:destroyed",{name:e})}}getPlugin(e){let t=this.plugins.get(e);return t?t.plugin:null}getReadyPlugin(e){let t=this.plugins.get(e);return t?.state==="ready"?t.plugin:null}hasPlugin(e){return this.plugins.has(e)}getPluginState(e){return this.plugins.get(e)?.state??null}getPluginIds(){return Array.from(this.plugins.keys())}getReadyPlugins(){return Array.from(this.plugins.values()).filter(e=>e.state==="ready").map(e=>e.plugin)}getPluginsByType(e){return Array.from(this.plugins.values()).filter(t=>t.plugin.type===e).map(t=>t.plugin)}selectProvider(e){let t=this.getPluginsByType("provider");for(let r of t){let n=r.canPlay;if(typeof n=="function"&&n(e))return r}return null}resolveDependencyOrder(){let e=new Set,t=new Set,r=[],n=(s,a=[])=>{if(e.has(s))return;if(t.has(s)){let o=[...a,s].join(" -> ");throw new Error(`Circular dependency detected: ${o}`)}let d=this.plugins.get(s);if(d){t.add(s);for(let o of d.plugin.dependencies||[])this.plugins.has(o)&&n(o,[...a,s]);t.delete(s),e.add(s),r.push(s)}};for(let s of this.plugins.keys())n(s);return r}validatePlugin(e){if(!e.id||typeof e.id!="string")throw new Error("Plugin must have a valid id");if(!e.name||typeof e.name!="string")throw new Error(`Plugin "${e.id}" must have a valid name`);if(!e.version||typeof e.version!="string")throw new Error(`Plugin "${e.id}" must have a valid version`);if(!e.type||typeof e.type!="string")throw new Error(`Plugin "${e.id}" must have a valid type`);if(typeof e.init!="function")throw new Error(`Plugin "${e.id}" must have an init() method`);if(typeof e.destroy!="function")throw new Error(`Plugin "${e.id}" must have a destroy() method`)}};function Rt(i){return i.querySelector("video")}function we(i){let e=document,t=e.fullscreenElement??e.webkitFullscreenElement??null;return t&&i.contains(t)?!0:!!Rt(i)?.webkitDisplayingFullscreen}async function Le(i){let e=i;if(e.requestFullscreen){await e.requestFullscreen();return}if(e.webkitRequestFullscreen){await e.webkitRequestFullscreen();return}let t=Rt(i);if(t?.webkitEnterFullscreen){t.webkitEnterFullscreen();return}throw new Error("Fullscreen is not supported")}async function Se(i){let e=Rt(i);if(e?.webkitDisplayingFullscreen){e.webkitExitFullscreen?.();return}let t=document;if(t.exitFullscreen){await t.exitFullscreen();return}t.webkitExitFullscreen&&await t.webkitExitFullscreen()}function j(i){if(i)try{let e=new URL(i);return e.protocol!=="http:"&&e.protocol!=="https:"?void 0:`${e.origin}${e.pathname}`}catch{return}}var Et=class{constructor(e){this._currentProvider=null;this.destroyed=!1;this.seekingWhilePlaying=!1;this.seekResumeTimeout=null;this.initialSrcLoaded=!1;this.loadGeneration=0;this.listenersWired=!1;this.readyEmitted=!1;this.fullscreenAnnounced=!1;this.unwireFullscreen=null;this.destroyPromise=null;this.initializing=null;if(typeof e.container=="string"){let t=document.querySelector(e.container);if(!t||!(t instanceof HTMLElement))throw new Error(`ScarlettPlayer: container not found: ${e.container}`);this.container=t}else if(e.container instanceof HTMLElement)this.container=e.container;else throw new Error("ScarlettPlayer requires a valid HTMLElement container or CSS selector");if(this.initialSrc=e.src,this.eventBus=new Ve,this.stateManager=new Be({autoplay:e.autoplay??!1,loop:e.loop??!1,volume:e.volume??1,muted:e.muted??!1,poster:e.poster??""}),this.logger=new Ue({level:e.logLevel??"warn",scope:"ScarlettPlayer"}),this.errorHandler=new $e(this.eventBus,this.logger),this.pluginManager=new Ke(this.eventBus,this.stateManager,this.logger,{container:this.container}),this.eventBus.on("error",t=>{this.stateManager.set("error",t)}),this.eventBus.on("media:loaded",()=>{this.stateManager.set("error",null)}),this.eventBus.on("media:error",({error:t})=>{this.errorHandler.record(t,{channel:"media:error"})}),this.wireFullscreenListeners(),e.plugins)for(let t of e.plugins)this.pluginManager.register(t);this.logger.info("ScarlettPlayer constructed",{autoplay:e.autoplay,plugins:e.plugins?.length??0})}ensureInitialized(){return this.initializing?this.initializing:(this.initializing=this.runInitialization().finally(()=>{this.initializing=null}),this.initializing)}async runInitialization(){for(let e of this.pluginManager.getPluginIds()){if(this.destroyed)return;let t=this.pluginManager.getPlugin(e);!t||t.type==="provider"||this.pluginManager.getPluginState(e)==="registered"&&await this.pluginManager.initPlugin(e)}this.destroyed||(this.wireLifecycleListeners(),this.readyEmitted||(this.readyEmitted=!0,this.eventBus.emit("player:ready",void 0)))}wireLifecycleListeners(){this.listenersWired||(this.listenersWired=!0,this.eventBus.on("live:seektolive",()=>{this.destroyed||this.seekToLive()}),this.eventBus.on("media:load-request",async({src:e,autoplay:t})=>{this.stateManager.getValue("chromecastActive")||await this.load(e,{autoplay:t!==!1})}),this.eventBus.on("error:retry",async({src:e})=>{let t=this.stateManager.getValue("live"),r=this.stateManager.getValue("currentTime");await this.load(e),!this.destroyed&&(this.stateManager.getValue("error")||(t?this.seekToLive():r>0&&this.seek(r),!this.destroyed&&await this.play()))}))}async init(){this.checkDestroyed(),await this.ensureInitialized(),this.initialSrc&&!this.initialSrcLoaded&&(this.initialSrcLoaded=!0,await this.load(this.initialSrc))}async load(e,t){this.checkDestroyed(),this.initialSrcLoaded=!0;let r=++this.loadGeneration;try{if(this.logger.info("Loading source",{source:e}),this.stateManager.update({playing:!1,paused:!0,ended:!1,buffering:!0,currentTime:0,duration:0,bufferedAmount:0,playbackState:"loading",error:null,live:!1}),this._currentProvider){let a=this._currentProvider.id;this.logger.info("Destroying previous provider",{provider:a}),await this.pluginManager.destroyPlugin(a),this._currentProvider=null}if(await this.ensureInitialized(),r!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}let n=this.pluginManager.selectProvider(e);if(!n){this.errorHandler.throw("PROVIDER_NOT_FOUND",`No provider found for source: ${e}`,{fatal:!0,context:{source:e}});return}if(this._currentProvider=n,this.logger.info("Provider selected",{provider:n.id}),await this.pluginManager.initPlugin(n.id),r!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}if(this.stateManager.set("source",{src:e,type:this.detectMimeType(e)}),typeof n.loadSource=="function"&&await n.loadSource(e),r!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}(t?.autoplay??this.stateManager.getValue("autoplay"))&&await this.play()}catch(n){r===this.loadGeneration&&(this.stateManager.getValue("error")?this.logger.error("Load failed",{source:j(e),error:n.message}):this.errorHandler.handle(n,{operation:"load",source:j(e)}))}}async play(){this.checkDestroyed();try{this.logger.debug("Play requested"),this.eventBus.emit("playback:play",void 0)}catch(e){this.errorHandler.handle(e,{operation:"play"})}}pause(){this.checkDestroyed();try{this.logger.debug("Pause requested"),this.seekingWhilePlaying=!1,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:pause",void 0)}catch(e){this.errorHandler.handle(e,{operation:"pause"})}}seek(e){if(this.checkDestroyed(),!Number.isFinite(e)){this.logger.warn("Invalid seek time",{time:e});return}try{this.logger.debug("Seek requested",{time:e}),this.stateManager.getValue("playing")&&(this.seekingWhilePlaying=!0),this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:seeking",{time:e}),this.stateManager.set("currentTime",e),this.seekingWhilePlaying&&(this.seekResumeTimeout=setTimeout(()=>{this.seekingWhilePlaying&&this.stateManager.getValue("playing")&&(this.logger.debug("Resuming playback after seek"),this.seekingWhilePlaying=!1,this.eventBus.emit("playback:play",void 0)),this.seekResumeTimeout=null},300))}catch(t){this.errorHandler.handle(t,{operation:"seek",time:e})}}setVolume(e){this.checkDestroyed();let t=Math.max(0,Math.min(1,e));this.stateManager.set("volume",t),this.eventBus.emit("volume:change",{volume:t,muted:this.stateManager.getValue("muted")})}setMuted(e){this.checkDestroyed(),this.stateManager.set("muted",e),this.eventBus.emit("volume:mute",{muted:e})}setPlaybackRate(e){this.checkDestroyed();let t=Math.max(.0625,Math.min(16,e));this.stateManager.set("playbackRate",t),this.eventBus.emit("playback:ratechange",{rate:t})}setAutoplay(e){this.checkDestroyed(),this.stateManager.set("autoplay",e),this.logger.debug("Autoplay set",{autoplay:e})}setPoster(e){this.checkDestroyed(),this.stateManager.set("poster",e),this.logger.debug("Poster set",{poster:e})}on(e,t){return this.checkDestroyed(),this.eventBus.on(e,t)}once(e,t){return this.checkDestroyed(),this.eventBus.once(e,t)}getPlugin(e){return this.checkDestroyed(),this.pluginManager.getPlugin(e)}registerPlugin(e){this.checkDestroyed(),this.pluginManager.register(e)}getState(){return this.checkDestroyed(),this.stateManager.snapshot()}subscribeToState(e){return this.checkDestroyed(),this.stateManager.subscribe(e)}getQualities(){if(this.checkDestroyed(),!this._currentProvider)return[];let e=this._currentProvider;return typeof e.getLevels=="function"?e.getLevels():[]}setQuality(e){if(this.checkDestroyed(),!this._currentProvider){this.logger.warn("No provider available for quality change");return}let t=this._currentProvider;if(typeof t.setLevel=="function"){if(e!==-1){let r=this.getQualities();if(r.length>0&&(e<0||e>=r.length)){this.logger.warn(`Invalid quality index: ${e} (available: ${r.length})`);return}}t.setLevel(e),this.eventBus.emit("quality:change",{quality:e===-1?"auto":`level-${e}`,auto:e===-1})}}getCurrentQuality(){if(this.checkDestroyed(),!this._currentProvider)return-1;let e=this._currentProvider;return typeof e.getCurrentLevel=="function"?e.getCurrentLevel():-1}wireFullscreenListeners(){let e=()=>{this.fullscreenAnnounced=!0,this.setFullscreenState(we(this.container))};document.addEventListener("fullscreenchange",e),document.addEventListener("webkitfullscreenchange",e),this.container.addEventListener("webkitbeginfullscreen",e,!0),this.container.addEventListener("webkitendfullscreen",e,!0),this.unwireFullscreen=()=>{document.removeEventListener("fullscreenchange",e),document.removeEventListener("webkitfullscreenchange",e),this.container.removeEventListener("webkitbeginfullscreen",e,!0),this.container.removeEventListener("webkitendfullscreen",e,!0)}}setFullscreenState(e){this.stateManager.getValue("fullscreen")!==e&&(this.stateManager.set("fullscreen",e),this.eventBus.emit("fullscreen:change",{fullscreen:e}))}async requestFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Le(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!0),this.eventBus.emit("fullscreen:change",{fullscreen:!0}))}catch(e){this.logger.error("Fullscreen request failed",{error:e})}}async exitFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Se(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!1),this.eventBus.emit("fullscreen:change",{fullscreen:!1}))}catch(e){this.logger.error("Exit fullscreen failed",{error:e})}}async toggleFullscreen(){this.fullscreen?await this.exitFullscreen():await this.requestFullscreen()}requestAirPlay(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.showPicker=="function"?e.showPicker():this.logger.warn("AirPlay plugin not available")}async requestChromecast(){this.checkDestroyed();let e=this.pluginManager.getPlugin("chromecast");e&&typeof e.requestSession=="function"?await e.requestSession():this.logger.warn("Chromecast plugin not available")}stopCasting(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.stop=="function"&&e.stop();let t=this.pluginManager.getPlugin("chromecast");t&&typeof t.stopSession=="function"&&t.stopSession()}seekToLive(){if(this.checkDestroyed(),!this.stateManager.getValue("live")){this.logger.warn("Not a live stream");return}if(this._currentProvider){let n=this._currentProvider;if(typeof n.getLiveInfo=="function"){let s=n.getLiveInfo();if(s?.liveSyncPosition!==void 0){this.seek(s.liveSyncPosition);return}}}let t=this.stateManager.getValue("seekableRange");if(t?.end!==void 0){this.seek(t.end);return}let r=this.stateManager.getValue("duration");Number.isFinite(r)&&r>0&&this.seek(r)}destroy(){return this.destroyPromise?this.destroyPromise:this.destroyed?Promise.resolve():(this.destroyPromise=(async()=>{this.logger.info("Destroying player"),this.destroyed=!0,this.loadGeneration++,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.unwireFullscreen?.(),this.unwireFullscreen=null,this.eventBus.emit("player:destroy",void 0);try{await this.pluginManager.destroyAll()}catch(e){this.logger.error("Error during plugin destruction",e)}this.eventBus.destroy(),this.stateManager.destroy(),this.logger.info("Player destroyed")})(),this.destroyPromise)}get playing(){return this.stateManager.getValue("playing")}get paused(){return this.stateManager.getValue("paused")}get currentTime(){return this.stateManager.getValue("currentTime")}get duration(){return this.stateManager.getValue("duration")}get volume(){return this.stateManager.getValue("volume")}get muted(){return this.stateManager.getValue("muted")}get playbackRate(){return this.stateManager.getValue("playbackRate")}get bufferedAmount(){return this.stateManager.getValue("bufferedAmount")}get currentProvider(){return this._currentProvider}get fullscreen(){return this.stateManager.getValue("fullscreen")}get live(){return this.stateManager.getValue("live")}get autoplay(){return this.stateManager.getValue("autoplay")}get poster(){return this.stateManager.getValue("poster")}checkDestroyed(){if(this.destroyed)throw new Error("Cannot call methods on destroyed player")}detectMimeType(e){let t=e;try{t=new URL(e).pathname}catch{let n=e.split("?")[0]??e;t=n.split("#")[0]??n}switch(t.split(".").pop()?.toLowerCase()??""){case"m3u8":return"application/x-mpegURL";case"mpd":return"application/dash+xml";case"mp4":case"m4v":return"video/mp4";case"webm":return"video/webm";case"ogg":case"ogv":return"video/ogg";case"mov":return"video/quicktime";case"mkv":return"video/x-matroska";case"mp3":return"audio/mpeg";case"wav":return"audio/wav";case"flac":return"audio/flac";case"aac":case"m4a":return"audio/mp4";default:return"video/mp4"}}};async function It(i){let e=new Et(i);return await e.init(),e}function Nt(i){return i<10?`0${i}`:`${i}`}function ue(i){if(!isFinite(i)||isNaN(i))return"0:00";let e=Math.abs(i),t=Math.floor(e/3600),r=Math.floor(e%3600/60),n=Math.floor(e%60),s=i<0?"-":"";return t>0?`${s}${t}:${Nt(r)}:${Nt(n)}`:`${s}${r}:${Nt(n)}`}function fe(i){return!Number.isFinite(i)||i<=0?"LIVE":`-${ue(i)}`}var qe={play:"M8 5v14l11-7z",volumeHigh:"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",volumeMuted:"M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"};var wt=new Map;function Ft(i,e){if(typeof document>"u")return()=>{};let t=document.getElementById(i),r=wt.get(i);(!r||!t)&&(r={generation:(r?.generation??0)+1,holders:0,element:t},wt.set(i,r)),r.holders+=1;let{generation:n}=r;if(!t){let a=document.createElement("style");a.id=i,a.textContent=e,document.head.appendChild(a),r.element=a}let s=!1;return()=>{if(s)return;s=!0;let a=wt.get(i);!a||a.generation!==n||(a.holders-=1,!(a.holders>0)&&(wt.delete(i),a.element?.remove()))}}var Ot={};Nr(Ot,{createHlsInstance:()=>Qr,describeSupport:()=>Wr,getHlsConstructor:()=>Yr,isHLSSupported:()=>qr,isHlsJsSupported:()=>nr,loadHlsJs:()=>Gr,resetLoader:()=>jr,supportsNativeHLS:()=>rr});var re=null,He=null,Kr=["application/vnd.apple.mpegurl","application/x-mpegURL"];function rr(){if(typeof document>"u")return!1;let i=document.createElement("video");return Kr.some(e=>i.canPlayType(e)!=="")}function nr(){return re?re.isSupported():typeof window>"u"?!1:!!(window.MediaSource||window.WebKitMediaSource)}function qr(){return rr()||nr()}function Wr(){let i=typeof document>"u"?null:document.createElement("video"),e=r=>i?i.canPlayType(r):"",t=typeof window>"u"?{}:window;return{canPlayType:{"application/vnd.apple.mpegurl":e("application/vnd.apple.mpegurl"),"application/x-mpegURL":e("application/x-mpegURL")},MediaSource:typeof t.MediaSource,ManagedMediaSource:typeof t.ManagedMediaSource,WebKitMediaSource:typeof t.WebKitMediaSource,hlsJsLoaded:re!==null,hlsJsSupported:re?re.isSupported():null,userAgent:typeof navigator>"u"?"":navigator.userAgent}}async function Gr(){return re||He||(He=(async()=>{try{if(re=(await import("./hls-SXYGB37P.js")).default,!re.isSupported())throw new Error("hls.js is not supported in this browser");return re}catch(i){throw He=null,new Error(`Failed to load hls.js: ${i instanceof Error?i.message:"Unknown error"}`)}})(),He)}function Qr(i){if(!re)throw new Error("hls.js is not loaded. Call loadHlsJs() first.");return new re(i)}function Yr(){return re}function jr(){re=null,He=null}function xe(i){if(i.name)return i.name;if(i.height){let e={2160:"4K",1440:"1440p",1080:"1080p",720:"720p",480:"480p",360:"360p",240:"240p",144:"144p"},t=Object.keys(e).map(Number).sort((r,n)=>Math.abs(r-i.height)-Math.abs(n-i.height))[0];return Math.abs(t-i.height)<=20?e[t]:`${i.height}p`}return i.bitrate?Xr(i.bitrate):"Unknown"}function Xr(i){return i>=1e6?`${(i/1e6).toFixed(1)} Mbps`:i>=1e3?`${Math.round(i/1e3)} Kbps`:`${i} bps`}function ir(i,e){return i.map((t,r)=>({index:r,width:t.width||0,height:t.height||0,bitrate:t.bitrate||0,label:xe(t),codec:t.codecSet}))}function sr(i){if(i!==void 0&&i>0)return i;let t=navigator.connection;if(t?.downlink&&t.downlink>0){let r=t.downlink*1e6;return Math.round(r*.85)}return 5e5}function de(i){return typeof i=="number"&&Number.isFinite(i)?i:null}function Jr(i){if(!i)return null;let e=de(i.fragmentStart)??de(i.fragments?.[0]?.start)??0,t=de(i.totalduration),r=de(i.edge)??(t===null?null:e+t);return r===null?null:{start:e,end:r}}function ar(i){let e=i?.seekable;if(!e||e.length===0)return null;let t=e.start(0),r=e.end(e.length-1);return!Number.isFinite(t)||!Number.isFinite(r)?null:{start:t,end:r}}function Zr(i){if(!i)return null;let e=de(i.targetduration);return de(i.partHoldBack)??de(i.holdBack)??(e!==null?e*3:null)}function en(i,e){let t=de(i?.targetduration),r=t!==null?t/2:e/2;return Math.max(1.5,de(i?.partTarget)??r)}function Te(i){if(i.kind==="hls"){let{hls:a,details:d}=i,o=a.media,u=Jr(d)??ar(o),v=de(a.targetLatency)??Zr(d)??3,P=de(a.latency)??(u&&o?Math.max(0,u.end-o.currentTime):null);if(P===null&&u===null)return null;let C=P??0;return{latency:C,targetLatency:v,atEdge:C<=v+en(d,v),seekableRange:u,lowLatency:i.lowLatencyRequested!==!1&&(!!d?.partList?.length||d?.canBlockReload===!0)}}let{media:e}=i,t=ar(e);if(!t)return null;let r=i.targetLatency??3,n=i.targetLatency===void 0?7:Math.max(1.5,i.targetLatency/2),s=Math.max(0,t.end-e.currentTime);return{latency:s,targetLatency:r,atEdge:s<=r+n,seekableRange:t,lowLatency:i.lowLatency===!0}}function Bt(i,e){if(!e)return;let t=i.getState("liveLatency");Math.abs(t-e.latency)>.05&&(i.setState("liveLatency",e.latency),i.emit("live:latency",{latency:e.latency})),i.getState("liveEdge")!==e.atEdge&&(i.setState("liveEdge",e.atEdge),i.emit("live:edgechange",{atEdge:e.atEdge}));let r=e.seekableRange;if(r){let n=i.getState("seekableRange");(!n||Math.abs(n.start-r.start)>.05||Math.abs(n.end-r.end)>.05)&&(i.setState("seekableRange",{start:r.start,end:r.end}),i.emit("live:seekablerange",{start:r.start,end:r.end}))}i.getState("lowLatencyMode")!==e.lowLatency&&(i.setState("lowLatencyMode",e.lowLatency),i.emit("live:lowlatency",{enabled:e.lowLatency}))}function Lt(i){i.getState("lowLatencyMode")&&(i.setState("lowLatencyMode",!1),i.emit("live:lowlatency",{enabled:!1})),i.setState("liveLatency",0),i.setState("liveEdge",!1),i.setState("seekableRange",null)}var Vt={NETWORK_ERROR:"networkError",MEDIA_ERROR:"mediaError",KEY_SYSTEM_ERROR:"keySystemError",MUX_ERROR:"muxError",OTHER_ERROR:"otherError"};function tn(i){switch(i){case Vt.NETWORK_ERROR:return"network";case Vt.MEDIA_ERROR:return"media";case Vt.MUX_ERROR:return"mux";default:return"other"}}function rn(i){let e=i.frag,t=i.response,r=i.context;return{type:tn(i.type),details:i.details||"Unknown error",fatal:i.fatal||!1,url:i.url??e?.url??t?.url??r?.url,reason:i.reason,response:i.response}}function nn(i){return`audio-${i}`}function lr(i){if(!i)return-1;let e=/^audio-(0|[1-9]\d*)$/.exec(i);return e?Number.parseInt(e[1],10):-1}function sn(i,e,t){return{id:nn(e),label:i.name||i.lang||`Audio ${e+1}`,language:i.lang,active:t}}function or(i,e){if(!i||typeof i!="object")return null;let{type:t,stats:r}=i;if(t!=="main"&&t!=="audio"&&t!=="subtitle")return null;let n=r?.loading?.start,s=r?.loading?.end,a=r?.loaded;return typeof n!="number"||!Number.isFinite(n)||typeof s!="number"||!Number.isFinite(s)||s<n||typeof a!="number"||!Number.isFinite(a)||a<0?null:{durationMs:s-n,bytes:a,ok:e,kind:t}}function cr(i,e,t){let r=[],n=(d,o)=>{i.on(d,o),r.push({event:d,handler:o})};n("hlsManifestParsed",(d,o)=>{e.logger.debug("HLS manifest parsed",{levels:o.levels.length});let u=o.levels.map((v,P)=>({id:`level-${P}`,label:xe(v),width:v.width,height:v.height,bitrate:v.bitrate,active:P===i.currentLevel}));e.setState("qualities",u),e.emit("quality:levels",{levels:u.map(v=>({id:v.id,label:v.label}))}),t.onManifestParsed?.(o.levels,o)}),n("hlsLevelSwitched",(d,o)=>{let u=i.levels[o.level],v=t.getIsAutoQuality?.()??i.autoLevelEnabled;if(e.logger.debug("HLS level switched",{level:o.level,height:u?.height,auto:v}),u){let P=v?`Auto (${xe(u)})`:xe(u);e.setState("currentQuality",{id:v?"auto":`level-${o.level}`,label:P,width:u.width,height:u.height,bitrate:u.bitrate,active:!0})}e.emit("quality:change",{quality:u?`level-${o.level}`:"auto",auto:v}),t.onLevelSwitched?.(o.level)});let s=(d,o)=>{let u=d.map((v,P)=>sn(v,P,P===o));e.setState("audioTracks",u),e.setState("currentAudioTrack",u[o]??null)};n("hlsAudioTracksUpdated",(d,o)=>{let u=o.audioTracks??[];e.logger.debug("HLS audio tracks updated",{tracks:u.length}),s(u,i.audioTrack),t.onAudioTracksUpdated?.(u)}),n("hlsAudioTrackSwitched",(d,o)=>{e.logger.debug("HLS audio track switched",{id:o.id}),s(i.audioTracks??[],o.id),t.onAudioTrackSwitched?.(o.id)});let a=0;return n("hlsFragLoaded",(d,o)=>{let u=or(o?.frag,!0);u&&e.emit("media:segment",u);let v=Date.now();v-a>=2e3&&i.bandwidthEstimate&&(a=v,e.setState("bandwidth",Math.round(i.bandwidthEstimate))),t.onFragLoaded?.()}),n("hlsFragBuffered",()=>{e.setState("buffering",!1),t.onBufferUpdate?.()}),n("hlsFragLoading",()=>{e.setState("buffering",!0)}),n("hlsLevelLoaded",(d,o)=>{o.details?.live!==void 0&&(e.setState("live",o.details.live),o.details.live?(t.onLevelDetails?.(o.details),Bt(e,Te({kind:"hls",hls:i,details:o.details,lowLatencyRequested:t.isLowLatencyRequested?.()??!0}))):Lt(e),t.onLiveUpdate?.())}),n("hlsError",(d,o)=>{let u=rn(o);if(!u.fatal&&(u.details==="fragLoadError"||u.details==="fragLoadTimeOut")){let P=or(o.frag,!1);P&&e.emit("media:segment",P)}!u.fatal&&(u.details?.includes("bufferStalledError")||o.reason?.includes("buffer holes"))?e.logger.debug(`HLS buffer recovery: ${u.reason||u.details}`,{details:u.details,reason:u.reason}):u.fatal?e.logger.error(`HLS fatal error: ${u.details} (type=${u.type})`,{type:u.type,details:u.details,status:u.response?.code,url:j(u.url)}):e.logger.warn(`HLS error: ${u.details} (type=${u.type}, fatal=${u.fatal})`,{type:u.type,details:u.details,fatal:u.fatal,status:u.response?.code,url:j(u.url)}),t.onError?.(u)}),()=>{for(let{event:d,handler:o}of r)i.off(d,o);r.length=0,e.setState("audioTracks",[]),e.setState("currentAudioTrack",null)}}function Ut(i,e,t,r){let n=[],s=(o,u)=>{i.addEventListener(o,u),n.push({event:o,handler:u})},a=()=>{i.ended||!e.getState("ended")||(e.setState("ended",!1),e.setState("playbackState",i.paused?"paused":"playing"))};s("play",()=>{e.setState("paused",!1),a()}),s("playing",()=>{e.setState("playing",!0),e.setState("paused",!1),e.setState("waiting",!1),e.setState("buffering",!1),e.setState("playbackState","playing"),a(),r&&(r.corePauseRequested=!1),r?.corePlayRequested?r.corePlayRequested=!1:e.emit("playback:play",void 0)}),s("pause",()=>{e.setState("playing",!1),e.setState("paused",!0),e.setState("playbackState","paused"),r&&(r.corePlayRequested=!1),r?.corePauseRequested?r.corePauseRequested=!1:e.emit("playback:pause",void 0)}),s("ended",()=>{e.setState("playing",!1),e.setState("ended",!0),e.setState("playbackState","ended"),e.emit("playback:ended",void 0)}),s("timeupdate",()=>{e.setState("currentTime",i.currentTime),e.emit("playback:timeupdate",{currentTime:i.currentTime}),(e.getState("live")||!Number.isFinite(i.duration))&&Bt(e,t?t():Te({kind:"media",media:i}))}),s("durationchange",()=>{let o=i.duration;!Number.isFinite(o)||o===1/0?(e.setState("live",!0),e.setState("duration",0)):e.setState("duration",o||0),e.emit("media:loadedmetadata",{duration:e.getState("duration")})}),s("waiting",()=>{e.setState("waiting",!0),e.setState("buffering",!0),e.emit("media:waiting",void 0)}),s("canplay",()=>{e.setState("waiting",!1),e.setState("playbackState","ready"),e.emit("media:canplay",void 0)}),s("canplaythrough",()=>{e.setState("buffering",!1),e.emit("media:canplaythrough",void 0)}),s("progress",()=>{if(i.buffered.length>0){let o=i.buffered.end(i.buffered.length-1),u=i.duration>0?o/i.duration:0;e.setState("bufferedAmount",u),e.setState("buffered",i.buffered),e.emit("media:progress",{buffered:u})}}),s("seeking",()=>{e.setState("currentTime",i.currentTime),e.setState("seeking",!0),a()}),s("seeked",()=>{e.setState("seeking",!1),e.emit("playback:seeked",{time:i.currentTime})}),s("volumechange",()=>{e.setState("volume",i.volume),e.setState("muted",i.muted),e.emit("volume:change",{volume:i.volume,muted:i.muted})}),s("ratechange",()=>{e.setState("playbackRate",i.playbackRate),e.emit("playback:ratechange",{rate:i.playbackRate})}),s("loadedmetadata",()=>{e.setState("duration",i.duration)}),s("error",()=>{let o=i.error;if(o){e.logger.error("Video element error",{code:o.code,message:o.message});let u=new Error(o.message||"Video playback error");typeof o.code=="number"&&o.code>0&&Object.assign(u,{code:o.code,detail:{mediaErrorCode:o.code}}),e.emit("media:error",{error:u})}}),s("enterpictureinpicture",()=>{e.setState("pip",!0),e.logger.debug("PiP: entered (standard)")}),s("leavepictureinpicture",()=>{e.setState("pip",!1),e.logger.debug("PiP: exited (standard)"),(!i.paused||e.getState("playing"))&&i.play().catch(()=>{})});let d=i;return"webkitPresentationMode"in i&&s("webkitpresentationmodechanged",()=>{let o=d.webkitPresentationMode,u=o==="picture-in-picture";e.setState("pip",u),e.logger.debug(`PiP: mode changed to ${o} (webkit)`),o==="inline"&&i.paused&&i.play().catch(()=>{})}),()=>{for(let{event:o,handler:u}of n)i.removeEventListener(o,u);n.length=0}}var an=["loadedmetadata","loadeddata","resize","playing"],on=["addtrack","removetrack","change"];function $t(i){return typeof i=="object"&&i!==null&&typeof i.length=="number"}function ur(i){let e=null,t=!1,r=!1,n=!1,s=null,a=[],d=null,o=!1,u=()=>t?"video":r?"audio":"unknown",v=()=>{let M=u();M!==d&&(d=M,i.setState("mediaType",M))},P=()=>{let M=s;if(!M)return;if(n&&M.videoWidth>0){t=!0;return}if(M.readyState<1)return;let O=M.videoTracks,D=M.audioTracks;if($t(O)){if(O.length>0){t=!0;return}$t(D)&&D.length>0&&(r=!0)}},C=()=>{o||(P(),v())},Q=()=>{for(let M of a)M();a=[],s=null};return{beginSource(M){o||e!==M&&(e=M,t=!1,r=!1,n=!1,d=null,v())},attach(M){if(!o){Q(),s=M,n=!1;for(let O of an){let D=()=>{n=!0,C()};M.addEventListener(O,D),a.push(()=>M.removeEventListener(O,D))}for(let O of[s.videoTracks,s.audioTracks])if(!(!$t(O)||typeof O.addEventListener!="function"))for(let D of on){let w=()=>C();O.addEventListener(D,w),a.push(()=>O.removeEventListener?.(D,w))}C()}},noteManifestParsed(M){if(o||!M)return;let O=typeof M.video=="boolean"?M.video:null,D=typeof M.audio=="boolean"?M.audio:null;O===!0?t=!0:O===!1&&D===!0&&(r=!0),v()},evaluate:C,current(){return u()},destroy(){o||(o=!0,Q())}}}var zt="Invalid playlist document",ln=["level","audioTrack","subtitleTrack"];function cn(i,e){if(typeof i!="string"||i.length===0)return!1;let t=i.trimStart();return t.startsWith("#EXTM3U")?e&&ln.includes(e)?/^#EXT(?:INF|-X-TARGETDURATION):/m.test(t):!0:!1}function dr(i){let e=i.DefaultConfig.loader;return class extends e{load(r,n,s){let a={...s,onSuccess:(d,o,u,v)=>{if(!cn(d?.data,u?.type)){s.onError({code:0,text:zt},u,v,o);return}s.onSuccess(d,o,u,v)}};super.load(r,n,a)}}}var pr=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";function un(i){let e=`'${i.canPlayType["application/vnd.apple.mpegurl"]}'/'${i.canPlayType["application/x-mpegURL"]}'`,t=i.hlsJsLoaded?`isSupported ${String(i.hlsJsSupported)}`:"not loaded";return[`native: ${e}`,`MediaSource: ${i.MediaSource}`,`ManagedMediaSource: ${i.ManagedMediaSource}`,`WebKitMediaSource: ${i.WebKitMediaSource}`,`hls.js: ${t}`].join(", ")}var dn={debug:!1,autoStartLoad:!0,startPosition:-1,lowLatencyMode:!1,maxBufferLength:30,maxMaxBufferLength:600,backBufferLength:30,enableWorker:!0,capLevelToPlayerSize:!0,maxNetworkRetries:3,maxMediaRetries:2,retryDelayMs:1e3,retryBackoffFactor:2,loadTimeoutMs:3e4,autoReconnect:!0,reconnectBaseDelayMs:2e3,reconnectMaxDelayMs:3e4,reconnectWindowMs:3e5,validatePlaylists:!0},pn=1.1,hn=["manifestLoadError","manifestLoadTimeOut","manifestParsingError"],St="Video took too long to load (network timeout)";function hr(i,e){let t=i?.code,n={type:(e==="initial"?t!==MediaError.MEDIA_ERR_DECODE:t===MediaError.MEDIA_ERR_NETWORK)?"network":"media",details:i?.message||(e==="initial"?"Failed to load HLS source":"Native HLS playback error"),fatal:!0};return typeof t=="number"&&t>0&&(n.mediaErrorCode=t),i?.message&&(n.mediaErrorMessage=i.message),n}function gr(i,e,t){let r={...dn,...t},n=null,s=null,a=null,d=!1,o=null,u=null,v=null,P=!0,C={corePlayRequested:!1,corePauseRequested:!1},Q=null,M=null,O=null,D=null,w=0,X=null,x=0,_=0,R=null,se=0,m=0,z=10,J=5e3,L=!1,B=null,U=0,S=0,I=0,T=null,V=null,q=!1,ae=!1,ge=!1,te=null,Z=0,me=0,ke=()=>{let p=s&&!d?Te({kind:"hls",hls:s,details:M,lowLatencyRequested:r.lowLatencyMode===!0}):a?Te({kind:"media",media:a,targetLatency:D??void 0,lowLatency:O?.lowLatency}):null;return p&&(O=p,s&&!d&&(D=p.targetLatency)),p},Pe=()=>{a&&(a.poster=n?.getState("poster")||"")},Ie=()=>{if(a)return a;let p=n?.container.querySelector("video");return p?(a=p,a):(a=document.createElement("video"),a.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",a.preload="metadata",a.controls=!1,a.playsInline=!0,Pe(),n?.container.appendChild(a),a)},ve=p=>{X?.(p??new Error("HLS load cancelled")),X=null,u?.(),u=null,v?.(),v=null,R&&(clearTimeout(R),R=null),te&&(clearTimeout(te),te=null),s&&(s.destroy(),s=null)},Me=p=>{ve(p),o=null,d=!1,P=!0,x=0,_=0,se=0,m=0,M=null,O=null,D=null,n&&Lt(n)},ct=()=>{let p=Mt();if(r.validatePlaylists!==!1){let l=i.getHlsConstructor();l&&l.DefaultConfig?.loader&&(p.pLoader=dr(l))}return p},Pt=()=>{let p={},l=(Y,le)=>{le!==void 0&&(p[Y]=le)},c=r.liveSyncDuration,h=r.liveSyncDurationCount,f=r.liveMaxLatencyDuration,g=r.liveMaxLatencyDurationCount,y=(c!==void 0||f!==void 0)&&(h!==void 0||g!==void 0),A=y&&c!==void 0,W=y&&!A;return y&&n?.logger.warn(`Ignoring ${A?"liveSyncDurationCount/liveMaxLatencyDurationCount":"liveSyncDuration/liveMaxLatencyDuration"}: hls.js rejects a config mixing seconds-based and count-based live latency options`),l("liveSyncDuration",W?void 0:c),l("liveSyncDurationCount",A?void 0:h),l("liveMaxLatencyDuration",W?void 0:f),l("liveMaxLatencyDurationCount",A?void 0:g),l("liveDurationInfinity",r.liveDurationInfinity),l("maxLiveSyncPlaybackRate",r.maxLiveSyncPlaybackRate??(r.lowLatencyMode===!0?pn:void 0)),p},Mt=()=>({debug:r.debug,autoStartLoad:r.autoStartLoad,startPosition:r.startPosition,startLevel:-1,abrEwmaDefaultEstimate:sr(r.initialBandwidthEstimate),lowLatencyMode:r.lowLatencyMode,maxBufferLength:r.maxBufferLength,maxMaxBufferLength:r.maxMaxBufferLength,backBufferLength:r.backBufferLength,enableWorker:r.enableWorker,capLevelToPlayerSize:r.capLevelToPlayerSize,fragLoadingMaxRetry:1,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:1,fragLoadingRetryDelay:500,manifestLoadingRetryDelay:500,levelLoadingRetryDelay:500,...Pt()}),_e=p=>{let l=r.retryDelayMs??1e3,c=r.retryBackoffFactor??2;return l*Math.pow(c,p)*(.7+Math.random()*.3)},_t=["bufferAppendError","bufferAppendingError","bufferAddCodecError"],ut=p=>{if(p.response?.text===zt)return"PLAYLIST_INVALID";if(p.details==="bufferFullError")return"MEDIA_BUFFER_FULL";if(_t.includes(p.details))return"MEDIA_APPEND_ERROR";switch(p.type){case"network":return"MEDIA_NETWORK_ERROR";case"media":case"mux":return"MEDIA_DECODE_ERROR";default:return"PLAYBACK_FAILED"}},dt=(p,l)=>{let c=p.attempts??(p.type==="network"?x:p.type==="media"?_:0),h={type:p.type,retriesExhausted:l,attempts:c};p.mediaErrorCode!==void 0&&(h.mediaErrorCode=p.mediaErrorCode),p.mediaErrorMessage!==void 0&&(h.mediaErrorMessage=p.mediaErrorMessage),p.timedOut&&(h.timedOut=!0),typeof p.response?.code=="number"&&p.response.code>0&&(h.httpStatus=p.response.code);let f=j(p.url);return f&&(h.url=f),h},pe=(p,l,c)=>{let h=c??(l?`HLS error: ${p.details} (max retries exceeded)`:`HLS error: ${p.details}`);n?.logger.error(h,{type:p.type,details:p.details}),n?.setState("playbackState","error"),n?.setState("buffering",!1),n?.emit("error",{code:ut(p),message:h,fatal:!0,timestamp:Date.now(),detail:dt(p,l)}),oe(p)},At=p=>{if(!i.getHlsConstructor()||!s)return!1;if(p.fatal){let c=Date.now();if(c-m>J?(se=1,m=c):se++,se>=z)return n?.logger.error(`Too many fatal errors (${se} in ${J}ms), giving up`),pe(p,!0),ve(new Error(p.details)),!0;switch(n?.logger.error("Fatal HLS error",{type:p.type,details:p.details}),p.type){case"network":{let h=r.maxNetworkRetries??3;if(x>=h)return n?.logger.error(`Network error recovery failed after ${x} attempts`),pe(p,!0),!0;x++;let f=_e(x-1);n?.logger.info(`Attempting network error recovery (attempt ${x}/${h}) in ${f}ms`),n?.emit("error:network",{error:new Error(p.details)}),R&&clearTimeout(R);let g=hn.includes(p.details),y=w;R=setTimeout(()=>{y!==w||!s||(g&&o?s.loadSource(o):s.startLoad())},f);break}case"media":{let h=r.maxMediaRetries??2;if(_>=h)return n?.logger.error(`Media error recovery failed after ${_} attempts`),pe(p,!0),!0;_++;let f=_e(_-1);n?.logger.info(`Attempting media error recovery (attempt ${_}/${h}) in ${f}ms`),n?.emit("error:media",{error:new Error(p.details)}),R&&clearTimeout(R);let g=w;R=setTimeout(()=>{g!==w||!s||s.recoverMediaError()},f);break}default:return pe(p,!1),!0}}return!1},pt=(p,l)=>{let c=p.type==="network",h=c?r.maxNetworkRetries??3:r.maxMediaRetries??2,f=c?x:_;if(!o||f>=h){pe(p,f>=h);return}let g=l??a?.currentTime??0;c?x++:_++;let y=f+1,A=_e(y-1);n?.logger.info(`Attempting native ${p.type} error recovery (attempt ${y}/${h}) in ${A}ms`),n?.emit(c?"error:network":"error:media",{error:new Error(p.details)}),R&&clearTimeout(R);let W=w;R=setTimeout(()=>{W===w&&Ne(p,g)},A)},Ne=async(p,l)=>{if(!o)return;let c=++w,h=o,f=n?.getState("live")??!1;try{if(ve(new Error("HLS load cancelled: native error recovery")),n?.setState("playbackState","loading"),await ne(h),c!==w)return;!f&&a&&l>0&&(a.currentTime=l),n?.setState("playbackState","ready"),n?.setState("buffering",!1);try{await a?.play()}catch{}}catch{if(c!==w)return;n?.logger.warn("Native error recovery attempt failed"),pt(p,l)}},ne=async(p,l=!1)=>{let c=w,h=Ie();return d=!0,n&&(v=Ut(h,n,ke,C)),Q?.beginSource(p),Q?.attach(h),new Promise((f,g)=>{let y=null,A=!1,W=null,Y=()=>{A=!0,X===le&&(X=null),h.removeEventListener("loadedmetadata",Ee),h.removeEventListener("error",H),y!==null&&(clearTimeout(y),y=null)},le=k=>{A||(Y(),g(k))};X=le;let Ee=()=>{if(A)return;if(c!==w){Y(),g(new Error("HLS load cancelled"));return}Y(),L=!0,l&&(x=0,_=0);let k=()=>{pt(hr(h.error,"playback"))};h.addEventListener("error",k);let N=()=>{(x>0||_>0)&&(n?.logger.debug("Native playback recovered, resetting retry budgets"),x=0,_=0)};h.addEventListener("playing",N);let ce=()=>{h.removeEventListener("error",k),h.removeEventListener("playing",N)},he=v;v=()=>{ce(),he?.()},n?.setState("source",{src:p,type:"application/x-mpegURL"}),n?.emit("media:loaded",{src:p,type:"application/x-mpegURL"}),f()},H=()=>{if(A)return;if(!l||c!==w){Y(),g(new Error(h.error?.message||"Failed to load HLS source"));return}let k=hr(h.error,"initial");W=k;let N=k.type==="network",ce=N?r.maxNetworkRetries??3:r.maxMediaRetries??2,he=N?x:_;if(he>=ce){Y(),n?.logger.error(`Native HLS load failed after ${he} ${k.type} retries`,{src:j(p)}),pe(k,!0),g(new Error(k.details));return}N?x++:_++;let mt=_e(he);n?.logger.info(`Retrying native HLS load after ${k.type} error (attempt ${he+1}/${ce}) in ${mt}ms`),n?.emit(N?"error:network":"error:media",{error:new Error(k.details)}),R&&clearTimeout(R),R=setTimeout(()=>{R=null,!(A||c!==w)&&(h.src=p,h.load())},mt)},ee=r.loadTimeoutMs??3e4;ee>0&&(y=setTimeout(()=>{if(A||c!==w)return;if(Y(),!l){g(new Error(St));return}R&&(clearTimeout(R),R=null),n?.logger.error(`Native HLS load timed out after ${ee}ms`,{src:j(p)});let k={type:"network",details:St,fatal:!0,timedOut:!0,attempts:x+_};W?.mediaErrorCode!==void 0&&(k.mediaErrorCode=W.mediaErrorCode),W?.mediaErrorMessage!==void 0&&(k.mediaErrorMessage=W.mediaErrorMessage),pe(k,!1,St),g(new Error(St))},ee)),h.addEventListener("loadedmetadata",Ee),h.addEventListener("error",H),h.src=p,h.load()})},Fe=async p=>{let l=w;if(await i.loadHlsJs(),l!==w)throw new Error("HLS load cancelled");let c=Ie();return d=!1,s=i.createHlsInstance(ct()),n&&(v=Ut(c,n,ke,C)),Q?.beginSource(p),Q?.attach(c),new Promise((h,f)=>{if(!s||!n){f(new Error("HLS not initialized"));return}let g=!1,y=null,A=()=>{y!==null&&(clearTimeout(y),y=null)},W=k=>{g||(g=!0,A(),f(k))};X=W;let Y=()=>{X===W&&(X=null)};u=cr(s,n,{onManifestParsed:(k,N)=>{l===w&&(Q?.noteManifestParsed(N),g||(g=!0,Y(),A(),L=!0,n?.setState("source",{src:p,type:"application/x-mpegURL"}),n?.emit("media:loaded",{src:p,type:"application/x-mpegURL"}),h()))},onLevelSwitched:()=>{},onLevelDetails:k=>{l===w&&(M=k,ke())},isLowLatencyRequested:()=>r.lowLatencyMode===!0,onError:k=>{if(l!==w)return;At(k)&&!g&&(g=!0,Y(),A(),f(new Error(k.details)))},onFragLoaded:()=>{l===w&&(x>0||_>0)&&(n?.logger.debug("Playback recovered, resetting retry budgets"),x=0,_=0)},getIsAutoQuality:()=>P});let le=s,Ee=(k,N)=>{if(l!==w||s!==le||!n||N?.fatal!==!1||N.details!=="fragLoadError"&&N.details!=="fragLoadTimeOut")return;let ce=N.frag?.type,he=N.frag?.stats?.loading?.start,mt=N.frag?.stats?.loading?.end,vt=N.frag?.stats?.loaded;if(ce!=="main"&&ce!=="audio"&&ce!=="subtitle"||typeof he!="number"||!Number.isFinite(he)||mt!==0||typeof vt!="number"||!Number.isFinite(vt)||vt<0)return;let Ht=performance.now()-he;!Number.isFinite(Ht)||Ht<0||n.emit("media:segment",{kind:ce,durationMs:Ht,bytes:vt,ok:!1})};le.on("hlsError",Ee);let H=u;u=()=>{le.off("hlsError",Ee),H?.()};let ee=r.loadTimeoutMs??3e4;ee>0&&(y=setTimeout(()=>{if(g||l!==w)return;g=!0,Y(),n?.logger.error(`HLS load timed out after ${ee}ms`,{src:j(p)});let k={type:"network",details:"Video took too long to load (network timeout)",fatal:!0};pe(k,!0),ve(),f(new Error(k.details))},ee)),s.attachMedia(c),s.loadSource(p)})},ie=()=>{B&&(clearTimeout(B),B=null),U=0,S=0,I=0,V=null,q=!1,ae=!1},ht=()=>{if(!a||te)return;Z=Date.now(),me=a.currentTime;let p=s?.targetDuration??s?.levels?.[s?.currentLevel]?.details?.targetduration??0,l=Math.max(15,4*(p||0)||15),c=Math.min(l*1e3,3e4),h=()=>{if(!a||!n)return;let f=n.getState("playing"),g=n.getState("seeking");if(!f||g){te=setTimeout(h,c);return}let y=Date.now()-Z;if(a.currentTime-me>.5)Z=Date.now(),me=a.currentTime;else if(y>l*1e3){n.logger.warn("Playback stall detected \u2014 no timeupdate progress",{elapsed:Math.round(y),currentTime:a.currentTime,targetDuration:Math.round(l)}),oe({type:"network",details:"Playback stalled \u2014 no data received",fatal:!0});return}te=setTimeout(h,c)};te=setTimeout(h,c)},ye=()=>{te&&(clearTimeout(te),te=null)},gt=(p,l)=>{if(q)return;q=!0;let c=U,h=V;n?.emit("error:reconnect-exhausted",{attempts:c,elapsedMs:p,windowMs:l}),n?.setState("playbackState","error"),n?.setState("buffering",!1),n?.emit("error",{code:h?ut(h):"PLAYBACK_FAILED",message:`HLS auto-reconnect gave up after ${c} attempts over ${Math.round(p/1e3)}s`,fatal:!0,timestamp:Date.now(),detail:{type:h?.type??"other",retriesExhausted:!0,attempts:c,reconnectExhausted:!0}})},be=()=>{if(q||B)return;let p=(n?.getState("live")??!1)&&ge,l=r.reconnectWindowMs??3e5,c=p?1/0:l,h=Date.now()-S;if(h>c){n?.logger.warn(`Auto-reconnect window exhausted after ${U} attempts`),gt(h,c);return}p&&h>6e5&&n?.emit("error:reconnecting",{attempt:U+1,delayMs:0,elapsedMs:h,windowMs:c,longOutage:!0});let g=r.reconnectBaseDelayMs??2e3,y=r.reconnectMaxDelayMs??3e4,A=Math.min(g*Math.pow(2,U),y),W=A>=y,Y=p&&W?3e4:Math.round(A*(.7+Math.random()*.3));n?.logger.info(`Scheduling auto-reconnect attempt ${U+1} in ${Y}ms`),n?.emit("error:reconnecting",{attempt:U+1,delayMs:Y,elapsedMs:h,windowMs:c}),B=setTimeout(()=>{B=null,ft()},Y)},oe=p=>{r.autoReconnect===!1||!o||!((n?.getState("live")??!1)&&ge)&&!L||p.type!=="network"&&p.type!=="media"||(S===0&&(S=Date.now(),I=a?.currentTime??0,V=p),be())},ft=async()=>{if(!n||!o)return;ae=!0;let p=++w;U++;let l=o,c=n.getState("live"),h=d,f=I;n.logger.info(`Auto-reconnect attempt ${U}`,{src:j(l)});try{if(ve(new Error("HLS load cancelled: reconnecting")),x=0,_=0,se=0,m=0,o=l,n.setState("playbackState","loading"),h&&i.supportsNativeHLS()?await ne(l):await Fe(l),p!==w)return;if(!c&&a&&f>0&&(a.currentTime=f),n.setState("playbackState","ready"),n.setState("buffering",!1),n.emit("error:recovered",{attempt:U,elapsedMs:Date.now()-S}),n.logger.info("Auto-reconnect succeeded"),ie(),n.getState("paused"))n.logger.info("Stream reconnected while paused; maintaining pause at live edge");else try{await a?.play()}catch{}}catch{if(p!==w)return;n?.logger.warn(`Auto-reconnect attempt ${U} failed`),be()}finally{ae=!1}};return{id:"hls-provider",name:e.name,version:pr,type:"provider",description:e.description,canPlay(p){let l=p.toLowerCase();return!!(l.split("?")[0].split("#")[0].endsWith(".m3u8")||l.includes("application/x-mpegurl")||l.includes("application/vnd.apple.mpegurl"))},async init(p){n=p,n.logger.info(`HLS plugin${e.logSuffix} initialized`),Q=ur(n);let l=n.on("playback:play",async()=>{if(a&&a.paused)try{C.corePlayRequested=!0,await a.play()}catch(H){C.corePlayRequested=!1,n?.logger.error("Play failed",H)}}),c=n.on("playback:pause",()=>{if(a){if(a.paused){C.corePlayRequested&&(C.corePlayRequested=!1,a.pause());return}C.corePauseRequested=!0,C.corePlayRequested=!1,a.pause()}}),h=n.on("playback:seeking",({time:H})=>{if(!a||!Number.isFinite(H))return;let ee=Math.max(0,Math.min(H,a.duration||0));a.currentTime=ee}),f=n.on("volume:change",({volume:H})=>{a&&(a.volume=H)}),g=n.on("volume:mute",({muted:H})=>{a&&(a.muted=H)}),y=n.on("playback:ratechange",({rate:H})=>{a&&(a.playbackRate=H)}),A=n.on("quality:select",({quality:H,auto:ee})=>{if(!s||d){n?.logger.warn("Quality selection not available");return}if(ee||H==="auto")P=!0,s.currentLevel=-1,n?.logger.debug("Quality: auto selection enabled"),n?.setState("currentQuality",{id:"auto",label:"Auto",width:0,height:0,bitrate:0,active:!0});else{P=!1;let k=parseInt(H.replace("level-",""),10);if(!isNaN(k)&&k>=0&&k<s.levels.length){s.nextLevel=k,n?.logger.debug(`Quality: queued switch to level ${k}`);let N=s.levels[k];if(N){let ce=xe(N);n?.setState("currentQuality",{id:`level-${k}`,label:`${ce}...`,width:N.width,height:N.height,bitrate:N.bitrate,active:!1})}}}}),W=n.on("track:audio",({trackId:H})=>{if(!s||d){n?.logger.warn("Audio track selection not available");return}let ee=lr(H),k=s.audioTracks??[];if(ee<0||ee>=k.length){n?.logger.warn("Ignoring unknown audio track selection",{trackId:H});return}s.audioTrack=ee,n?.logger.debug(`Audio: queued switch to track ${ee}`)});typeof window<"u"&&(T=()=>{(B!==null||S>0||ae||U>0&&!q)&&(B&&(n?.logger.info("Browser back online, reconnecting immediately"),clearTimeout(B),B=null),ft())},window.addEventListener("online",T));let Y=n.subscribeToState(H=>{H.key==="poster"&&Pe()}),le=n.subscribeToState(H=>{H.key==="live"&&(ge=!0)});n.onDestroy(()=>{l(),c(),h(),f(),g(),y(),A(),W(),Y(),le()});let Ee=n.subscribeToState(H=>{H.key==="playing"&&(H.value?ht():ye())});n.onDestroy(Ee)},async destroy(){n?.logger.info(`HLS plugin${e.logSuffix} destroying`),w++,ie(),T&&typeof window<"u"&&(window.removeEventListener("online",T),T=null),Me(new Error("HLS load cancelled: player destroyed")),Q?.destroy(),Q=null,a?.parentNode&&a.parentNode.removeChild(a),a=null,n=null},async loadSource(p){if(!n)throw new Error("Plugin not initialized");n.logger.info(`Loading HLS source${e.logSuffix}`,{src:j(p)});let l=++w;if(ie(),L=!1,ge=!1,n.setState("live",!1),Me(new Error("HLS load cancelled: superseded by a new load")),o=p,C.corePlayRequested=!1,C.corePauseRequested=!1,Pe(),n.setState("playbackState","loading"),n.setState("buffering",!0),n.getState("airplayActive")&&i.supportsNativeHLS())n.logger.info("Using native HLS (AirPlay active)"),await ne(p,!0);else if(i.isHlsJsSupported())n.logger.info(`Using ${e.engineLabel} for HLS playback`),await Fe(p);else if(i.supportsNativeHLS())n.logger.info("Using native HLS playback (hls.js not supported)"),await ne(p,!0);else{let c=i.describeSupport(),h=`HLS playback not supported in this browser (${un(c)})`;throw n.setState("playbackState","error"),n.setState("buffering",!1),n.emit("error",{code:"SOURCE_NOT_SUPPORTED",message:h,fatal:!0,timestamp:Date.now(),context:{probes:c}}),new Error(h)}if(l===w){if(a){let c=n.getState("muted"),h=n.getState("volume");c!==void 0&&(a.muted=c),h!==void 0&&(a.volume=h)}n.setState("playbackState","ready"),n.setState("buffering",!1)}},getCurrentLevel(){return d||!s?-1:s.currentLevel},setLevel(p){if(d||!s){n?.logger.warn("Quality selection not available in native HLS mode");return}s.currentLevel=p},getLevels(){return d||!s?[]:ir(s.levels,s.currentLevel)},getHlsInstance(){return s},isNativeHLS(){return d},getLiveInfo(){if(!(n?.getState("live")||!1))return null;let l=ke();if(d){let h=l?.targetLatency??3,f=a?.seekable?.length?a.seekable.end(a.seekable.length-1):void 0;return{isLive:!0,latency:l?.latency??0,targetLatency:h,drift:0,liveSyncPosition:f!==void 0?Math.max(0,f-h):void 0,lowLatency:l?.lowLatency??!1}}if(!s)return null;let c=s.targetLatency||l?.targetLatency||3;return{isLive:!0,latency:s.latency||0,targetLatency:c,drift:s.drift||0,liveSyncPosition:s.liveSyncPosition??(a?.seekable?.length?Math.max(0,a.seekable.end(a.seekable.length-1)-c):void 0),lowLatency:l?.lowLatency??!1}},async switchToNative(){if(d){n?.logger.debug("Already using native HLS");return}if(!i.supportsNativeHLS()){n?.logger.warn("Native HLS not supported in this browser");return}if(!o){n?.logger.warn("No source loaded");return}n?.logger.info("Switching to native HLS for AirPlay");let p=n?.getState("playing")||!1,l=a?.currentTime||0,c=o,h=D,f=++w;if(ie(),Me(new Error("HLS load cancelled: switching to native HLS")),o=c,D=h,await ne(c),f===w){if(a&&l>0&&(a.currentTime=l),p&&a)try{await a.play()}catch{n?.logger.debug("Could not auto-resume after switch")}n?.logger.info("Switched to native HLS")}},async switchToHlsJs(){if(!d){n?.logger.debug("Already using hls.js");return}if(!i.isHlsJsSupported()){n?.logger.warn("hls.js not supported in this browser");return}if(!o){n?.logger.warn("No source loaded");return}n?.logger.info("Switching back to hls.js");let p=n?.getState("playing")||!1,l=a?.currentTime||0,c=o,h=D,f=++w;if(ie(),Me(new Error("HLS load cancelled: switching to hls.js")),o=c,D=h,await Fe(c),f===w){if(a&&l>0&&(a.currentTime=l),p&&a)try{await a.play()}catch{n?.logger.debug("Could not auto-resume after switch")}n?.logger.info("Switched to hls.js")}}}}function fr(i){return gr(Ot,{name:"HLS Provider",description:"HLS playback provider using hls.js",logSuffix:"",engineLabel:"hls.js"},i)}var mr=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var gn=["mp4","webm","mov","mkv","ogv","m4v"],vr=["mp3","wav","ogg","flac","aac","m4a","opus","weba"],fn=[...gn,...vr],xt={ABORTED:1,NETWORK:2,DECODE:3,SRC_NOT_SUPPORTED:4},mn={mp4:"video/mp4",m4v:"video/mp4",webm:"video/webm",mov:"video/quicktime",mkv:"video/x-matroska",ogv:"video/ogg",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",flac:"audio/flac",aac:"audio/aac",m4a:"audio/mp4",opus:"audio/opus",weba:"audio/webm"};function yr(i){let e=i?.preload??"metadata",t=i?.loadTimeoutMs??3e4,r=null,n=null,s=null,a=null,d=!1,o=!1,u=!1,v=0,P=null,C=!1,Q=m=>{try{return new URL(m,window.location.href).pathname.split(".").pop()?.toLowerCase()??""}catch{return(m.split(".").pop()?.toLowerCase()??"").split("?")[0]??""}},M=m=>mn[m]||"video/mp4",O=m=>vr.includes(m),D=m=>{let L=(m.startsWith("audio/")?document.createElement("audio"):document.createElement("video")).canPlayType(m);return L==="probably"||L==="maybe"},w=()=>{if(n){if(d){n.poster="";return}n.poster=r?.getState("poster")||""}},X=()=>{if(n)return n;let m=r?.container.querySelector("video");return m?(n=m,n):(n=document.createElement("video"),n.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",n.preload=e,n.controls=!1,n.playsInline=!0,w(),r?.container.appendChild(n),n)},x=m=>{switch(m?.code){case xt.ABORTED:return{code:"PLAYBACK_FAILED",message:"Playback aborted"};case xt.NETWORK:return{code:"MEDIA_NETWORK_ERROR",message:"Network error"};case xt.DECODE:return{code:"MEDIA_DECODE_ERROR",message:"Decode error - format may not be supported"};case xt.SRC_NOT_SUPPORTED:return C?{code:"MEDIA_NETWORK_ERROR",message:"Network error"}:{code:"SOURCE_LOAD_FAILED",message:"Format not supported"};default:return{code:"PLAYBACK_FAILED",message:"Unknown video error"}}},_=m=>{let z=[],J=v,L=(S,I)=>{let T=V=>{J===v&&I(V)};m.addEventListener(S,T),z.push([S,T])},B=()=>{m.ended||!r?.getState("ended")||(r?.setState("ended",!1),r?.setState("playbackState",m.paused?"paused":"playing"))};L("play",()=>{r?.setState("paused",!1),B()}),L("playing",()=>{r?.setState("playing",!0),r?.setState("paused",!1),r?.setState("playbackState","playing"),B(),u=!1,o?o=!1:r?.emit("playback:play",void 0)}),L("pause",()=>{o=!1,r?.setState("playing",!1),r?.setState("paused",!0),r?.setState("playbackState","paused"),u?u=!1:r?.emit("playback:pause",void 0)}),L("ended",()=>{r?.setState("playing",!1),r?.setState("ended",!0),r?.setState("playbackState","ended"),r?.emit("playback:ended",void 0)}),L("timeupdate",()=>{r?.setState("currentTime",m.currentTime),r?.emit("playback:timeupdate",{currentTime:m.currentTime})}),L("durationchange",()=>{r?.setState("duration",m.duration||0)}),L("loadedmetadata",()=>{r?.setState("duration",m.duration||0),r?.emit("media:loadedmetadata",{duration:m.duration||0})}),L("canplay",()=>{r?.setState("buffering",!1),r?.emit("media:canplay",void 0)}),L("canplaythrough",()=>{r?.emit("media:canplaythrough",void 0)}),L("waiting",()=>{r?.setState("buffering",!0),r?.emit("media:waiting",void 0)}),L("progress",()=>{if(m.buffered.length>0){let S=m.buffered.end(m.buffered.length-1),I=m.duration||0,T=I>0?S/I:0;r?.setState("bufferedAmount",T),r?.emit("media:progress",{buffered:T})}}),L("seeking",()=>{r?.setState("currentTime",m.currentTime),r?.setState("seeking",!0),B()}),L("seeked",()=>{r?.setState("seeking",!1),r?.emit("playback:seeked",{time:m.currentTime})}),L("volumechange",()=>{r?.setState("volume",m.volume),r?.setState("muted",m.muted),r?.emit("volume:change",{volume:m.volume,muted:m.muted})}),L("ratechange",()=>{r?.setState("playbackRate",m.playbackRate),r?.emit("playback:ratechange",{rate:m.playbackRate})}),L("stalled",()=>{r?.setState("buffering",!0),r?.emit("media:stalled",void 0),r?.logger.warn("Media stalled - network may be slow")}),L("suspend",()=>{r?.emit("media:suspend",void 0)}),L("abort",()=>{r?.emit("media:abort",void 0)}),L("error",()=>{let S=m.error,{code:I,message:T}=x(S);r?.logger.error("Video error",{mediaErrorCode:S?.code,code:I,message:T}),r?.setState("playbackState","error"),r?.setState("buffering",!1),r?.emit("error",{code:I,message:T,fatal:!0,timestamp:Date.now()})}),L("enterpictureinpicture",()=>{r?.setState("pip",!0),r?.logger.debug("PiP: entered (standard)")}),L("leavepictureinpicture",()=>{r?.setState("pip",!1),r?.logger.debug("PiP: exited (standard)"),(!m.paused||r?.getState("playing"))&&m.play().catch(()=>{})});let U=m;return"webkitPresentationMode"in m&&L("webkitpresentationmodechanged",()=>{let S=U.webkitPresentationMode;r?.setState("pip",S==="picture-in-picture"),r?.logger.debug(`PiP: mode changed to ${S} (webkit)`),S==="inline"&&m.paused&&m.play().catch(()=>{})}),()=>{z.forEach(([S,I])=>{m.removeEventListener(S,I)})}},R=()=>{s?.(),s=null,o=!1,u=!1,n&&(n.pause(),n.removeAttribute("src"),n.load())};return{id:"native-provider",name:"Native Media Provider",version:mr,type:"provider",description:"Native HTML5 playback for video (MP4, WebM, MOV) and audio (MP3, WAV, FLAC, AAC)",canPlay(m){let z=Q(m);if(!fn.includes(z))return!1;let J=M(z);return D(J)},async init(m){r=m,r.logger.info("Native video plugin initialized");let z=r.on("playback:play",async()=>{if(!r?.getState("chromecastActive")&&n&&n.paused)try{o=!0,await n.play()}catch(T){o=!1,r?.logger.error("Play failed",T)}}),J=r.on("playback:pause",()=>{if(!r?.getState("chromecastActive")&&n){if(n.paused){o&&(o=!1,n.pause());return}u=!0,o=!1,n.pause()}}),L=r.on("playback:seeking",({time:T})=>{if(r?.getState("chromecastActive")||!n||!Number.isFinite(T))return;let V=Math.max(0,Math.min(T,n.duration||0));n.currentTime=V}),B=r.on("volume:change",({volume:T,muted:V})=>{n&&(n.volume=T,n.muted=V)}),U=r.on("volume:mute",({muted:T})=>{n&&(n.muted=T)}),S=r.on("playback:ratechange",({rate:T})=>{n&&(n.playbackRate=T)}),I=r.subscribeToState(T=>{T.key==="poster"&&w()});r.onDestroy(()=>{z(),J(),L(),B(),U(),S(),I()})},async destroy(){r?.logger.info("Native video plugin destroying"),v++;let m=P;P=null,m?.(new Error("Player destroyed during load")),R(),n?.parentNode&&n.parentNode.removeChild(n),n=null,r=null,a=null,d=!1,C=!1},async loadSource(m){if(!r)throw new Error("Plugin not initialized");let z=Q(m),J=M(z),L=O(z);d=L,r.logger.info("Loading native media source",{src:j(m),mimeType:J,isAudio:L});let B=++v,U=P;if(P=null,U?.(new Error("Load superseded by a newer source")),C=!1,R(),r.setState("playbackState","loading"),r.setState("buffering",!0),r.setState("mediaType",L?"audio":"video"),L){let I=r.getState("title");if(!I||I===a)try{let V=new URL(m,window.location.href).pathname.split("/").pop()||"Audio",q=decodeURIComponent(V.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));a=q,r.setState("title",q)}catch{a="Audio",r.setState("title","Audio")}}r.setState("qualities",[]),r.setState("currentQuality",null);let S=X();return S.style.display=L?"none":"block",w(),s=_(S),new Promise((I,T)=>{let V=null,q=()=>{S.removeEventListener("loadedmetadata",ge),S.removeEventListener("error",te),V!==null&&(clearTimeout(V),V=null),P===ae&&(P=null)},ae=Z=>{q(),T(Z)};P=ae;let ge=()=>{if(B!==v)return;q(),C=!0;let Z=r?.getState("muted"),me=r?.getState("volume");Z!==void 0&&(S.muted=Z),me!==void 0&&(S.volume=me),r?.setState("source",{src:m,type:J}),r?.setState("playbackState","ready"),r?.setState("buffering",!1),r?.emit("media:loaded",{src:m,type:J}),I()},te=()=>{if(B!==v)return;q();let Z=S.error;T(new Error(Z?.message||"Failed to load video source"))};t>0&&(V=setTimeout(()=>{B===v&&(q(),r?.setState("playbackState","error"),r?.setState("buffering",!1),T(new Error("Video took too long to load (network timeout)")))},t)),S.addEventListener("loadedmetadata",ge),S.addEventListener("error",te),S.src=m,S.load()})}}}var br={"bandwidth-indicator":{rank:0,exit:"hide"},"skip-backward":{rank:1,exit:"overflow"},"skip-forward":{rank:1,exit:"overflow"},pip:{rank:2,exit:"overflow"},chromecast:{rank:4,exit:"overflow"},airplay:{rank:4,exit:"overflow"},volume:{rank:5,exit:"overflow"},captions:{rank:6,exit:"overflow"},quality:{rank:6,exit:"hide"},time:{rank:7,exit:"hide"},play:{rank:"never",exit:"overflow"},"live-indicator":{rank:"never",exit:"overflow"},settings:{rank:"never",exit:"overflow"},fullscreen:{rank:"never",exit:"overflow"},spacer:{rank:"never",exit:"overflow"}};function Tt(i,e){return i.map(t=>{let r=br[t],n=e?.[t]??r?.rank??3;return{id:t,rank:n,exit:r?.exit??"overflow"}})}function qt(i,e){if(!i.includes("quality")||i.includes("settings"))return;let[t]=Tt(["quality"],e);if(t.rank!=="never")throw new Error(`uiPlugin: a layout with "quality" needs "settings" as well. The quality control hides when the bar does not fit, and the settings menu is where its Quality row lives. Add "settings" to controls, pin quality with priority: { quality: 'never' }, or set responsive: false.`)}function vn(i,e,t,r){let n=i.reduce((d,o)=>d+o,0),s=e*Math.max(0,i.length-1),a=r?t+e:0;return n+s+a}function Wt(i,e,t,r){let n=i.map(u=>u.id);if(e<=0)return{inBar:n,overflow:[],hidden:[]};let a=[...i.filter(u=>u.visible&&u.width>0)],d=new Set,o=new Set;for(;vn(a.map(u=>u.width),t,r,d.size>0)>e;){let u=-1;for(let P=0;P<a.length;P++){let C=a[P];C.rank!=="never"&&(u===-1||C.rank<=a[u].rank)&&(u=P)}if(u===-1)break;let[v]=a.splice(u,1);(v.exit==="hide"?o:d).add(v.id)}return{inBar:n.filter(u=>!d.has(u)&&!o.has(u)),overflow:n.filter(u=>d.has(u)),hidden:n.filter(u=>o.has(u))}}var Gt=`
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
`;var E={play:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${qe.play}"/></svg>`,pause:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',replay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',volumeHigh:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${qe.volumeHigh}"/></svg>`,volumeLow:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',volumeMute:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${qe.volumeMuted}"/></svg>`,fullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',exitFullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',pip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>',exitPip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 9h6v2H9z"/></svg>',settings:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',chromecast:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',chromecastConnected:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',airplay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 22h12l-6-6-6 6zM21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V5h18v12h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',captions:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>',captionsOff:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 5.5v13h-15v-13h15zM19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>',checkmark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',chevronUp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>',more:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',chevronDown:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>',spinner:'<svg viewBox="0 0 24 24" fill="currentColor" class="sp-spin"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',skipForward:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',skipBack:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',forward10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',replay10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',error:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'};function b(i,e,t){let r=document.createElement(i);if(e)for(let[n,s]of Object.entries(e))n==="className"?r.className=s:r.setAttribute(n,s);if(t)for(let n of t)typeof n=="string"?r.appendChild(document.createTextNode(n)):r.appendChild(n);return r}function G(i,e,t){let r=b("button",{className:`sp-control ${i}`,"aria-label":e,type:"button"});return K(r,t),r}function F(i){return i.querySelector("video")}function We(i){for(;i.firstChild;)i.removeChild(i.firstChild)}var Er=new WeakMap;function K(i,e){return Er.get(i)===e?!1:(i.innerHTML=e,Er.set(i,e),!0)}function $(i,e,t){return i.getAttribute(e)===t?!1:(i.setAttribute(e,t),!0)}var Ge=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=G("sp-play","Play",E.play),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("playing"),t=this.api.getState("ended"),r,n;t?(r=E.replay,n="Replay"):e?(r=E.pause,n="Pause"):(r=E.play,n="Play"),K(this.el,r),$(this.el,"aria-label",n)}toggle(){let e=F(this.api.container);if(!e)return;this.api.getState("ended")?(e.currentTime=0,this.api.emit("playback:seeking",{time:0}),e.play().catch(()=>{})):e.paused?e.play().catch(()=>{}):e.pause()}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var Qe=class{constructor(e,t){this.hasStarted=!1;this.lastSource=void 0;this.clickHandler=()=>{this.start()};this.api=e,this.hasOverlayProbe=typeof t=="function",this.isOverlayVisible=t??(()=>!1);let r=document.createElement("button");r.className="sp-big-play",r.setAttribute("type","button"),r.setAttribute("aria-label","Play"),K(r,E.play),r.addEventListener("click",this.clickHandler),this.el=r}render(){return this.el}update(){let e=this.api.getState("playing"),t=F(this.api.container),r=this.hasEnded(t),n=this.api.getState("currentTime"),s=this.api.getState("playbackState"),a=this.api.getState("error"),d=this.api.getState("source");d!==this.lastSource&&(this.lastSource=d,this.hasStarted=!1),e&&(this.hasStarted=!0);let o;(this.hasOverlayProbe?this.isOverlayVisible():a)||s==="loading"||e||t&&!t.paused?o=!1:r?o=!0:this.hasStarted||n!==0?o=!1:o=s==="idle"||s==="ready",K(this.el,r?E.replay:E.play),$(this.el,"aria-label",r?"Replay":"Play"),this.el.classList.toggle("sp-big-play--visible",o)}hasEnded(e){return e?e.ended:!!this.api.getState("ended")}start(){let e=F(this.api.container);e&&(e.ended&&(e.currentTime=0),e.play().catch(()=>{}))}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var Ye=class{constructor(){this.config=null;this.loaded=!1;this.el=b("div",{className:"sp-thumbnail-preview"}),this.img=b("div",{className:"sp-thumbnail-preview__img"}),this.el.appendChild(this.img)}getElement(){return this.el}setConfig(e){if(this.config=e,this.loaded=!1,e){this.img.style.width=`${e.width}px`,this.img.style.height=`${e.height}px`,this.el.style.width=`${e.width}px`,this.el.style.height=`${e.height}px`;let t=new Image;t.onload=()=>{this.loaded=!0},t.onerror=()=>{this.config=null,this.loaded=!1},t.src=e.src}}show(e,t){if(!this.config||!this.loaded){this.el.style.display="none";return}let{src:r,width:n,height:s,columns:a,interval:d}=this.config,o=Math.floor(e/d),u=o%a,v=Math.floor(o/a);this.img.style.backgroundImage=`url(${r})`,this.img.style.backgroundPosition=`-${u*n}px -${v*s}px`,this.img.style.backgroundSize=`${a*n}px auto`,this.img.style.width=`${n}px`,this.img.style.height=`${s}px`,this.el.style.left=`${t*100}%`,this.el.style.display=""}hide(){this.el.style.display="none"}isConfigured(){return this.config!==null}destroy(){this.el.remove()}};var yn=new WeakMap,Qt=new WeakMap;function wr(i,e){Qt.set(i,e);let t=yn.get(i);return t&&e.setFactory(t.factory),()=>{Qt.get(i)===e&&Qt.delete(i)}}var bn=new Set(["ArrowLeft","ArrowRight","Home","End"]),je=class{constructor(e,t={}){this.isDragging=!1;this.lastSeekTime=0;this.seekThrottleMs=100;this.wasPlayingBeforeDrag=!1;this.renderedChapters=null;this.renderedDuration=0;this.extension=null;this.detachTimelineHost=null;this.extensionDragging=!1;this.extensionEditing=!1;this.onMouseDown=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=F(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.clientX,!0)};this.onDocMouseMove=e=>{this.isDragging&&(this.seek(e.clientX),this.updateVisualPosition(e.clientX))};this.onMouseUp=e=>{if(this.isDragging&&(this.seek(e.clientX,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag)){let t=F(this.api.container);if(t&&t.paused){let r=()=>{t.removeEventListener("seeked",r),t.play().catch(()=>{})};t.addEventListener("seeked",r)}}};this.onTouchStart=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=F(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.touches[0].clientX,!0)};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.seek(e.touches[0].clientX),this.updateVisualPosition(e.touches[0].clientX))};this.onTouchEnd=e=>{if(this.isDragging){let t=e.changedTouches?.[0]?.clientX;if(t!==void 0&&this.seek(t,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag){let r=F(this.api.container);if(r&&r.paused){let n=()=>{r.removeEventListener("seeked",n),r.play().catch(()=>{})};r.addEventListener("seeked",n)}}this.tooltip.style.opacity="",this.thumbnailPreview.hide()}};this.onMouseMove=e=>{this.isExtensionInput(e)||this.updateTooltip(e.clientX)};this.onMouseLeave=()=>{this.isDragging||(this.tooltip.style.opacity="",this.thumbnailPreview.hide())};this.onKeyDown=e=>{let t=F(this.api.container);if(t&&bn.has(e.key)){this.extension?.onSeekStart();try{this.applyKeyboardSeek(e,t)}finally{this.extension?.onSeekEnd()}}};this.api=e,this.options=t,this.wrapper=b("div",{className:"sp-progress-wrapper"}),this.el=b("div",{className:"sp-progress"});let r=b("div",{className:"sp-progress__track"});this.buffered=b("div",{className:"sp-progress__buffered"}),this.filled=b("div",{className:"sp-progress__filled"}),this.markers=b("div",{className:"sp-progress__markers"}),this.handle=b("div",{className:"sp-progress__handle"}),this.tooltip=b("div",{className:"sp-progress__tooltip"}),this.tooltip.textContent="0:00",this.thumbnailPreview=new Ye,r.appendChild(this.buffered),r.appendChild(this.filled),r.appendChild(this.markers),r.appendChild(this.handle),this.el.appendChild(r),this.el.appendChild(this.thumbnailPreview.getElement()),this.el.appendChild(this.tooltip),this.wrapper.appendChild(this.el),this.extensionLayer=b("div",{className:"sp-progress__extension"}),this.wrapper.appendChild(this.extensionLayer),this.el.setAttribute("role","slider"),this.el.setAttribute("aria-label","Seek"),this.el.setAttribute("aria-valuemin","0"),this.el.setAttribute("aria-valuemax","0"),this.el.setAttribute("aria-valuenow","0"),this.el.setAttribute("aria-valuetext","0:00"),this.el.setAttribute("tabindex","0"),this.wrapper.addEventListener("mousedown",this.onMouseDown),this.wrapper.addEventListener("mousemove",this.onMouseMove),this.wrapper.addEventListener("mouseleave",this.onMouseLeave),this.wrapper.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.el.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd),this.detachTimelineHost=wr(this.api.container,{setFactory:n=>this.mountExtension(n)})}mountExtension(e){if(this.extension&&(this.extension.destroy(),this.extension=null,this.setExtensionDragging(!1),this.setExtensionEditing(!1),We(this.extensionLayer)),!e)return;let t={element:this.extensionLayer,getRailRect:()=>this.el.getBoundingClientRect(),setEditing:r=>this.setExtensionEditing(r),setDragging:r=>this.setExtensionDragging(r)};this.extension=e(t),this.extension.update()}isTimelineEditing(){return this.extensionEditing}setExtensionEditing(e){this.extensionEditing!==e&&(this.extensionEditing=e,this.wrapper.classList.toggle("sp-progress-wrapper--editing",e),e&&this.show(),this.options.onEditingChange?.(e))}setExtensionDragging(e){this.extensionDragging!==e&&(this.extensionDragging=e,this.wrapper.classList.toggle("sp-progress-wrapper--ext-dragging",e),e?(this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.tooltip.style.opacity="0",this.thumbnailPreview.hide()):this.tooltip.style.opacity="")}isExtensionInput(e){if(this.extensionDragging)return!0;let t=e.target;return t instanceof Node&&this.extensionLayer.contains(t)}render(){return this.wrapper}show(){this.wrapper.classList.add("sp-progress-wrapper--visible")}hide(){this.wrapper.classList.remove("sp-progress-wrapper--visible")}setThumbnails(e){this.thumbnailPreview.setConfig(e)}update(){let e=this.api.getState("currentTime")||0,t=this.api.getState("duration")||0,r=this.api.getState("buffered"),n=this.api.getState("live"),s=this.api.getState("seekableRange"),a=this.api.getState("thumbnails");if(a&&!this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.setConfig(a),this.el.classList.toggle("sp-progress--live",!!n),this.updateMarkers(t,n,s),n&&s){let d=s.end-s.start;if(d>0){let o=(e-s.start)/d*100;this.filled.style.width=`${Math.max(0,Math.min(100,o))}%`,this.handle.style.left=`${Math.max(0,Math.min(100,o))}%`}if(r&&r.length>0){let o=s.end-s.start;if(o>0){let v=(r.end(r.length-1)-s.start)/o*100;this.buffered.style.width=`${Math.max(0,Math.min(100,v))}%`}}this.el.setAttribute("aria-valuemax",String(Math.floor(s.end))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",`${Math.floor(s.end-e)} seconds behind live`)}else if(t>0){let d=e/t*100;if(this.filled.style.width=`${d}%`,this.handle.style.left=`${d}%`,r&&r.length>0){let u=r.end(r.length-1)/t*100;this.buffered.style.width=`${u}%`}this.el.setAttribute("aria-valuemax",String(Math.floor(t))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",ue(e))}this.extension?.update()}chapterLabelAt(e){let t=this.api.getState("chapters")??[];for(let r=t.length-1;r>=0;r--){let n=t[r];if(e<n.time)continue;let s=t[r+1],a=n.endTime??(s?s.time:1/0);return e<a?n.label:null}return null}updateMarkers(e,t,r){let n=this.api.getState("chapters")??[],s=t?r?r.end-r.start:0:e;if(n.length===0||s<=0){this.renderedChapters!==null&&(this.markers.textContent="",this.renderedChapters=null,this.renderedDuration=0);return}if(n===this.renderedChapters&&s===this.renderedDuration)return;let a=t&&r?r.start:0;this.markers.textContent="";for(let d of n){if(d.time<=a)continue;let o=(d.time-a)/s*100;if(o<=0||o>=100)continue;let u=b("div",{className:"sp-progress__marker"});u.style.left=`${o}%`,u.title=d.label,this.markers.appendChild(u)}this.renderedChapters=n,this.renderedDuration=s}getTimeFromPosition(e){let t=this.el.getBoundingClientRect(),r=Math.max(0,Math.min(1,(e-t.left)/t.width)),n=this.api.getState("live"),s=this.api.getState("seekableRange");if(n&&s){let o=s.end-s.start,u=s.start+r*o;return Number.isFinite(u)?u:null}let a=this.api.getState("duration")||0,d=r*a;return Number.isFinite(d)?d:null}updateTooltip(e){let t=this.el.getBoundingClientRect(),r=Math.max(0,Math.min(1,(e-t.left)/t.width)),n=this.getTimeFromPosition(e)??0,s=this.api.getState("live"),a=this.api.getState("seekableRange");if(s&&a){let o=a.end-n;this.tooltip.textContent=fe(o)}else this.tooltip.textContent=ue(n);let d=this.chapterLabelAt(n);if(d){let o=b("span",{className:"sp-progress__tooltip-chapter"});o.textContent=d,this.tooltip.appendChild(o)}this.tooltip.style.left=`${r*100}%`,this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.show(n,r)}updateVisualPosition(e){let t=this.el.getBoundingClientRect(),r=Math.max(0,Math.min(1,(e-t.left)/t.width));this.filled.style.width=`${r*100}%`,this.handle.style.left=`${r*100}%`}applyKeyboardSeek(e,t){let n=this.api.getState("live"),s=this.api.getState("seekableRange");if(n&&s)switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(s.start,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(s.end,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=s.start;break;case"End":e.preventDefault(),t.currentTime=s.end;break}else{let a=this.api.getState("duration")||0;switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(0,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(a,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=0;break;case"End":e.preventDefault(),t.currentTime=a;break}}this.api.emit("playback:seeking",{time:t.currentTime})}seek(e,t=!1){let r=F(this.api.container);if(!r)return;let n=Date.now();if(!t&&this.isDragging&&n-this.lastSeekTime<this.seekThrottleMs)return;this.lastSeekTime=n;let s=this.getTimeFromPosition(e);s!==null&&Number.isFinite(s)&&(r.currentTime=s,t&&this.api.emit("playback:seeking",{time:s}))}destroy(){this.detachTimelineHost?.(),this.detachTimelineHost=null,this.extension?.destroy(),this.extension=null,this.wrapper.removeEventListener("mousedown",this.onMouseDown),this.wrapper.removeEventListener("mousemove",this.onMouseMove),this.wrapper.removeEventListener("mouseleave",this.onMouseLeave),this.wrapper.removeEventListener("touchstart",this.onTouchStart),this.el.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.thumbnailPreview.destroy(),this.wrapper.remove()}};var Xe=class{constructor(e){this.api=e,this.el=b("div",{className:"sp-time"}),this.el.setAttribute("aria-live","off")}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("currentTime")||0,r=this.api.getState("duration")||0;if(e){let n=this.api.getState("seekableRange");if(n){let s=n.end-t;this.el.textContent=fe(s)}else this.el.textContent=fe(0)}else this.el.textContent=`${ue(t)} / ${ue(r)}`}destroy(){this.el.remove()}};var Je=class{constructor(e){this.isDragging=!1;this.onMouseDown=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onDocMouseMove=e=>{this.isDragging&&this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onMouseUp=()=>{this.isDragging=!1};this.onTouchStart=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX))};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX)))};this.onTouchEnd=()=>{this.isDragging=!1};this.onKeyDown=e=>{let t=F(this.api.container);if(!t)return;let r=.1;switch(e.key){case"ArrowUp":case"ArrowRight":e.preventDefault(),this.setVolume(t.volume+r);break;case"ArrowDown":case"ArrowLeft":e.preventDefault(),this.setVolume(t.volume-r);break}};this.api=e,this.el=b("div",{className:"sp-volume"}),this.btn=b("button",{className:"sp-control sp-volume__btn","aria-label":"Mute",type:"button"}),this.btn.innerHTML=E.volumeHigh,this.btn.onclick=()=>this.toggleMute();let t=b("div",{className:"sp-volume__slider-wrap"});this.slider=b("div",{className:"sp-volume__slider"}),this.slider.setAttribute("role","slider"),this.slider.setAttribute("aria-label","Volume"),this.slider.setAttribute("aria-valuemin","0"),this.slider.setAttribute("aria-valuemax","100"),this.slider.setAttribute("tabindex","0"),this.level=b("div",{className:"sp-volume__level"}),this.slider.appendChild(this.level),t.appendChild(this.slider),this.el.appendChild(this.btn),this.el.appendChild(t),this.slider.addEventListener("mousedown",this.onMouseDown),this.slider.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.slider.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd)}render(){return this.el}update(){let e=this.api.getState("volume")??1,t=this.api.getState("muted")??!1,r,n;t||e===0?(r=E.volumeMute,n="Unmute"):e<.5?(r=E.volumeLow,n="Mute"):(r=E.volumeHigh,n="Mute"),K(this.btn,r),$(this.btn,"aria-label",n);let s=t?0:e,a=`${s*100}%`;this.level.style.width!==a&&(this.level.style.width=a);let d=Math.round(s*100);$(this.slider,"aria-valuenow",String(d)),$(this.slider,"aria-valuetext",`${d}%`)}toggleMute(){let e=F(this.api.container);e&&(e.muted=!e.muted)}setVolume(e){let t=F(this.api.container);if(!t)return;let r=Math.max(0,Math.min(1,e));t.volume=r,r>0&&t.muted&&(t.muted=!1)}getVolumeFromPosition(e){let t=this.slider.getBoundingClientRect();return Math.max(0,Math.min(1,(e-t.left)/t.width))}destroy(){this.slider.removeEventListener("mousedown",this.onMouseDown),this.slider.removeEventListener("touchstart",this.onTouchStart),this.slider.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.el.remove()}};var Ze=class{constructor(e){this.handleClick=()=>{this.seekToLive()};this.handleKeyDown=e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.seekToLive())};this.api=e,this.el=b("div",{className:"sp-live"}),this.dot=b("div",{className:"sp-live__dot"}),this.label=document.createElement("span"),this.label.textContent="LIVE",this.el.appendChild(this.dot),this.el.appendChild(this.label),this.el.setAttribute("role","button"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge"),this.el.setAttribute("tabindex","0"),this.el.addEventListener("click",this.handleClick),this.el.addEventListener("keydown",this.handleKeyDown)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("liveEdge");this.el.style.display=e?"":"none",t?(this.el.classList.remove("sp-live--behind"),this.label.textContent="LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge")):(this.el.classList.add("sp-live--behind"),this.label.textContent="GO LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - behind live edge, click to seek to live"))}seekToLive(){this.api.emit("live:seektolive",void 0)}destroy(){this.el.removeEventListener("click",this.handleClick),this.el.removeEventListener("keydown",this.handleKeyDown),this.el.remove()}};var et=class{constructor(e){this.isOpen=!1;this.lastQualitiesJson="";this.api=e,this.el=b("div",{className:"sp-quality"}),this.btn=G("sp-quality__btn","Quality",E.settings),this.btnLabel=b("span",{className:"sp-quality__label"}),this.btnLabel.textContent="Auto",this.btn.appendChild(this.btnLabel),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.menu=b("div",{className:"sp-quality-menu"}),this.menu.setAttribute("role","menu"),this.menu.addEventListener("click",t=>{t.stopPropagation()}),this.el.appendChild(this.btn),this.el.appendChild(this.menu),this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler)}render(){return this.el}update(){let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality");this.el.style.display=e.length>0?"":"none",e.length===0&&this.isOpen&&this.close(),this.btnLabel.textContent=t?.label||"Auto";let r=JSON.stringify(e.map(s=>s.id)),n=t?.id||"auto";r!==this.lastQualitiesJson&&(this.lastQualitiesJson=r,this.rebuildMenu(e)),this.updateActiveStates(n)}rebuildMenu(e){this.menu.innerHTML="";let t=this.createMenuItem("Auto","auto");this.menu.appendChild(t);let r=[...e].sort((n,s)=>s.height-n.height);for(let n of r){if(n.id==="auto")continue;let s=this.createMenuItem(n.label,n.id);this.menu.appendChild(s)}}updateActiveStates(e){this.menu.querySelectorAll(".sp-quality-menu__item").forEach(r=>{let s=r.getAttribute("data-quality-id")===e;r.classList.toggle("sp-quality-menu__item--active",s)})}createMenuItem(e,t){let r=b("div",{className:"sp-quality-menu__item"});r.setAttribute("role","menuitem"),r.setAttribute("data-quality-id",t);let n=b("span",{className:"sp-quality-menu__label"});return n.textContent=e,r.appendChild(n),r.addEventListener("click",s=>{s.preventDefault(),s.stopPropagation(),this.selectQuality(t)}),r}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.menu.classList.add("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","true")}close(){this.isOpen=!1,this.menu.classList.remove("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","false")}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),this.el.remove()}};function En(){if(typeof navigator>"u")return!1;let i=navigator.userAgent;return/Chrome/.test(i)&&!/Edge|Edg/.test(i)}function wn(){return typeof HTMLVideoElement>"u"?!1:typeof HTMLVideoElement.prototype.webkitShowPlaybackTargetPicker=="function"}var Re=class{constructor(e,t){this.api=e,this.type=t,this.supported=t==="chromecast"?En():wn();let r=t==="chromecast"?E.chromecast:E.airplay,n=t==="chromecast"?"Cast":"AirPlay";this.el=G(`sp-cast sp-cast--${t}`,n,r),this.el.addEventListener("click",()=>this.handleClick()),this.supported||(this.el.style.display="none")}render(){return this.el}update(){if(!this.supported){this.el.style.display="none";return}if(this.type==="chromecast"){let e=this.api.getState("chromecastAvailable"),t=this.api.getState("chromecastActive");this.el.style.display="",this.el.disabled=!e&&!t,this.el.classList.toggle("sp-cast--active",!!t),this.el.classList.toggle("sp-cast--unavailable",!e&&!t),t?(K(this.el,E.chromecastConnected),$(this.el,"aria-label","Stop casting")):(K(this.el,E.chromecast),$(this.el,"aria-label",e?"Cast":"No Cast devices found"))}else{let e=this.api.getState("airplayActive");this.el.style.display="",this.el.disabled=!1,this.el.classList.toggle("sp-cast--active",!!e),this.el.classList.remove("sp-cast--unavailable"),$(this.el,"aria-label",e?"Stop AirPlay":"AirPlay")}}handleClick(){this.type==="chromecast"?this.handleChromecast():this.handleAirPlay()}handleChromecast(){let e=this.api.getPlugin("chromecast");e&&(e.isConnected()?e.endSession():e.requestSession().catch(()=>{}))}async handleAirPlay(){let e=this.api.getPlugin("airplay");e?await e.showPicker():F(this.api.container)?.webkitShowPlaybackTargetPicker?.()}destroy(){this.el.remove()}};var tt=class{constructor(e){this.clickHandler=()=>{this.toggle().catch(()=>{})};this.api=e;let t=document.createElement("video");this.supported="pictureInPictureEnabled"in document||"webkitSetPresentationMode"in t,this.el=G("sp-pip","Picture-in-Picture",E.pip),this.el.addEventListener("click",this.clickHandler),this.supported?(this.el.disabled=!0,this.el.setAttribute("aria-disabled","true")):this.el.style.display="none"}render(){return this.el}isMediaReady(){let e=F(this.api.container);return!!e&&e.readyState>=HTMLMediaElement.HAVE_METADATA}update(){if(!this.supported)return;let e=!!this.api.getState("pip"),t=e||this.isMediaReady();this.el.disabled=!t,$(this.el,"aria-disabled",String(!t)),K(this.el,e?E.exitPip:E.pip),$(this.el,"aria-label",e?"Exit Picture-in-Picture":"Picture-in-Picture"),this.el.classList.toggle("sp-pip--active",e)}async toggle(){let e=F(this.api.container);if(!e){this.api.logger.warn("PiP: video element not found");return}let t=document.pictureInPictureElement===e||e.webkitPresentationMode==="picture-in-picture";if(!t&&e.readyState<HTMLMediaElement.HAVE_METADATA){this.api.logger.debug("PiP: ignored, media not ready",{readyState:e.readyState});return}try{t?(document.pictureInPictureElement?await document.exitPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("inline"),this.api.logger.debug("PiP: exited")):(e.requestPictureInPicture?await e.requestPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("picture-in-picture"),this.api.logger.debug("PiP: entered"))}catch(r){let n=r instanceof Error?r.message:String(r);this.api.logger.warn("PiP: failed",{error:n})}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var rt=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=G("sp-fullscreen","Fullscreen",E.fullscreen),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){this.api.getState("fullscreen")?(K(this.el,E.exitFullscreen),$(this.el,"aria-label","Exit fullscreen")):(K(this.el,E.fullscreen),$(this.el,"aria-label","Fullscreen"))}async toggle(){let e=this.api.container;try{we(e)?await Se(e):await Le(e)}catch{}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var nt=class{constructor(){this.el=b("div",{className:"sp-spacer"})}render(){return this.el}update(){}destroy(){this.el.remove()}};function Ln(i){if(!i)return"Something went wrong.";let e=i.code;if(e)switch(e){case"MEDIA_NETWORK_ERROR":return"Having trouble connecting. Check your internet and try again.";case"MEDIA_DECODE_ERROR":return"This video can't be played right now.";case"SOURCE_LOAD_FAILED":case"SOURCE_NOT_SUPPORTED":case"PROVIDER_NOT_FOUND":return"Unable to load video. Please try again.";case"PLAYBACK_FAILED":return"Playback stopped unexpectedly. Please try again.";case"MEDIA_APPEND_ERROR":return"Video playback was interrupted. Please try again.";case"MEDIA_BUFFER_FULL":return"Your device is low on video memory. Close other apps or tabs and try again.";case"PLAYLIST_INVALID":return"The stream is temporarily unavailable. Please try again."}let t=i.message?.toLowerCase()||"";return t.includes("network")||t.includes("timeout")||t.includes("fetch")||t.includes("connection")?"Having trouble connecting. Check your internet and try again.":t.includes("manifest")?"Unable to load video. Please try again.":t.includes("decode")||t.includes("media")||t.includes("format")||t.includes("codec")?"This video can't be played right now.":t.includes("not found")||t.includes("404")||t.includes("source")||t.includes("not supported")?"Video not found.":"Something went wrong."}var it=class{constructor(e){this.visible=!1;this.lastSource=null;this.handleRetry=()=>{if(this.retryBtn.disabled)return;this.retryBtn.disabled=!0,this.hide();let t=this.api.getState("source")?.src||this.lastSource;t&&this.api.emit("error:retry",{src:t}),setTimeout(()=>{this.retryBtn.disabled=!1},1e3)};this.handleDismiss=()=>{this.hide(),this.api.emit("error:dismiss",void 0)};this.api=e;let t=document.createElement("div");t.className="sp-error-overlay",t.setAttribute("role","alert"),t.setAttribute("aria-live","assertive");let r=document.createElement("div");r.className="sp-error-overlay__content";let n=document.createElement("div");n.className="sp-error-overlay__icon",n.innerHTML=E.error;let s=document.createElement("p");s.className="sp-error-overlay__message",s.textContent="Something went wrong.";let a=document.createElement("div");a.className="sp-error-overlay__actions",this.retryBtn=document.createElement("button"),this.retryBtn.className="sp-error-overlay__retry",this.retryBtn.setAttribute("type","button"),this.retryBtn.setAttribute("aria-label","Try again"),this.retryBtn.textContent="Try Again",this.retryBtn.addEventListener("click",this.handleRetry),this.dismissBtn=document.createElement("button"),this.dismissBtn.className="sp-error-overlay__dismiss",this.dismissBtn.setAttribute("type","button"),this.dismissBtn.setAttribute("aria-label","Go back"),this.dismissBtn.textContent="Go Back",this.dismissBtn.addEventListener("click",this.handleDismiss),a.appendChild(this.retryBtn),a.appendChild(this.dismissBtn),r.appendChild(n),r.appendChild(s),r.appendChild(a),t.appendChild(r),this.el=t}render(){return this.el}show(e){let t=Ln(e),r=this.el.querySelector(".sp-error-overlay__message");r&&(r.textContent=t);let n=this.api.getState("source");n?.src&&(this.lastSource=n.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.remove("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}showReconnecting(){let e=this.el.querySelector(".sp-error-overlay__message");e&&(e.textContent="Connection lost. Reconnecting...");let t=this.api.getState("source");t?.src&&(this.lastSource=t.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.add("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}hide(){this.visible=!1,this.el.classList.remove("sp-error-overlay--visible"),this.el.classList.remove("sp-error-overlay--reconnecting")}isVisible(){return this.visible}update(){let e=this.api.getState("playbackState");this.visible&&e!=="error"&&e!=="loading"&&this.api.getState("playing")&&this.hide()}destroy(){this.retryBtn.removeEventListener("click",this.handleRetry),this.dismissBtn.removeEventListener("click",this.handleDismiss),this.el.remove()}};var Sn=[{label:"0.5x",value:.5},{label:"0.75x",value:.75},{label:"Normal",value:1},{label:"1.25x",value:1.25},{label:"1.5x",value:1.5},{label:"2x",value:2}],st=class{constructor(e){this.isOpen=!1;this.currentPanel="main";this.lastQualitiesJson="";this.api=e,this.el=b("div",{className:"sp-settings"}),this.btn=G("sp-settings__btn","Settings",E.settings),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.panel=b("div",{className:"sp-settings-panel"}),this.panel.setAttribute("role","menu"),this.panel.addEventListener("click",t=>t.stopPropagation()),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.closeHandler=t=>{this.el.contains(t.target)||this.close(!1)},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{if(this.isOpen){if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),this.currentPanel!=="main"?this.showPanel("main"):this.close();return}if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault(),t.stopPropagation(),this.navigateItems(t.key==="ArrowDown"?1:-1);return}t.key==="Tab"&&(t.preventDefault(),t.stopPropagation(),this.navigateItems(t.shiftKey?-1:1))}},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){let e=this.api.getState("qualities")||[],t=JSON.stringify(e.map(r=>r.id));t!==this.lastQualitiesJson&&(this.lastQualitiesJson=t,this.isOpen&&this.currentPanel==="quality"&&this.renderQualityPanel()),this.isOpen&&(this.currentPanel==="quality"?this.updateQualityActiveStates():this.currentPanel==="speed"?this.updateSpeedActiveStates():this.currentPanel==="captions"?this.updateCaptionsActiveStates():this.currentPanel==="audio"&&this.updateAudioActiveStates())}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.currentPanel="main",this.renderMainPanel(),this.panel.classList.add("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","true"),this.focusFirstItem()}close(e=!0){let t=this.isOpen;this.isOpen=!1,this.currentPanel="main",this.panel.classList.remove("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","false"),t&&e&&this.btn.focus()}showPanel(e){switch(this.currentPanel=e,e){case"main":this.renderMainPanel();break;case"quality":this.renderQualityPanel();break;case"speed":this.renderSpeedPanel();break;case"captions":this.renderCaptionsPanel();break;case"audio":this.renderAudioPanel();break}this.focusFirstItem()}renderMainPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--main";let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality"),r=this.api.getState("playbackRate")??1;if(e.length>0){let o=this.createMainRow("Quality",t?.label||"Auto",()=>this.showPanel("quality"));this.panel.appendChild(o)}if((this.api.getState("textTracks")||[]).length>0){let o=this.api.getState("currentTextTrack"),u=o?o.label:"Off",v=this.createMainRow("Captions",u,()=>this.showPanel("captions"));this.panel.appendChild(v)}if((this.api.getState("audioTracks")||[]).length>1){let o=this.api.getState("currentAudioTrack"),u=this.createMainRow("Audio",o?.label||"Default",()=>this.showPanel("audio"));this.panel.appendChild(u)}let a=r===1?"Normal":`${r}x`,d=this.createMainRow("Speed",a,()=>this.showPanel("speed"));this.panel.appendChild(d)}createMainRow(e,t,r){let n=b("div",{className:"sp-settings-panel__row"});n.setAttribute("role","menuitem"),n.setAttribute("tabindex","0"),n.setAttribute("aria-haspopup","true");let s=b("span",{className:"sp-settings-panel__label"});s.textContent=e;let a=b("span",{className:"sp-settings-panel__value"});a.textContent=t;let d=b("span",{className:"sp-settings-panel__arrow"});return d.innerHTML=E.chevronDown,a.appendChild(d),n.appendChild(s),n.appendChild(a),n.addEventListener("click",o=>{o.preventDefault(),r()}),n.addEventListener("keydown",o=>{(o.key==="Enter"||o.key===" ")&&(o.preventDefault(),r())}),n}renderQualityPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Quality");this.panel.appendChild(e);let t=this.api.getState("qualities")||[],n=this.api.getState("currentQuality")?.id||"auto",s=this.createMenuItem("Auto","auto",n==="auto");s.addEventListener("click",d=>{d.preventDefault(),this.selectQuality("auto")}),this.panel.appendChild(s);let a=[...t].sort((d,o)=>o.height-d.height);for(let d of a){if(d.id==="auto")continue;let o=this.createMenuItem(d.label,d.id,d.id===n);o.addEventListener("click",u=>{u.preventDefault(),this.selectQuality(d.id)}),this.panel.appendChild(o)}}renderSpeedPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Speed");this.panel.appendChild(e);let t=this.api.getState("playbackRate")??1;for(let r of Sn){let n=Math.abs(t-r.value)<.01,s=this.createMenuItem(r.label,String(r.value),n);s.addEventListener("click",a=>{a.preventDefault(),this.selectSpeed(r.value)}),this.panel.appendChild(s)}}renderCaptionsPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Captions");this.panel.appendChild(e);let t=this.api.getState("textTracks")||[],n=this.api.getState("currentTextTrack")?.id||"off",s=this.createMenuItem("Off","off",n==="off");s.addEventListener("click",a=>{a.preventDefault(),this.selectCaption(null)}),this.panel.appendChild(s);for(let a of t){let d=this.createMenuItem(a.label,a.id,a.id===n);d.addEventListener("click",o=>{o.preventDefault(),this.selectCaption(a.id)}),this.panel.appendChild(d)}}renderAudioPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Audio");this.panel.appendChild(e);let t=this.api.getState("audioTracks")||[],n=this.api.getState("currentAudioTrack")?.id??null;for(let s of t){let a=this.createMenuItem(s.label,s.id,s.id===n);a.addEventListener("click",d=>{d.preventDefault(),this.selectAudioTrack(s.id)}),this.panel.appendChild(a)}}selectAudioTrack(e){this.api.emit("track:audio",{trackId:e}),this.close()}updateAudioActiveStates(){let t=this.api.getState("currentAudioTrack")?.id??null;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(n=>{let s=n.getAttribute("data-id");n.classList.toggle("sp-settings-panel__item--active",s===t)})}selectCaption(e){this.api.emit("track:text",{trackId:e}),this.close()}updateCaptionsActiveStates(){let t=this.api.getState("currentTextTrack")?.id||"off";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(n=>{let s=n.getAttribute("data-id");n.classList.toggle("sp-settings-panel__item--active",s===t)})}createSubHeader(e){let t=b("div",{className:"sp-settings-panel__header"});t.setAttribute("role","menuitem"),t.setAttribute("tabindex","0");let r=b("span",{className:"sp-settings-panel__back"});r.innerHTML=E.chevronUp;let n=b("span",{className:"sp-settings-panel__header-label"});return n.textContent=e,t.appendChild(r),t.appendChild(n),t.addEventListener("click",s=>{s.preventDefault(),this.showPanel("main")}),t.addEventListener("keydown",s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),this.showPanel("main"))}),t}createMenuItem(e,t,r){let n=b("div",{className:`sp-settings-panel__item${r?" sp-settings-panel__item--active":""}`});n.setAttribute("role","menuitem"),n.setAttribute("tabindex","0"),n.setAttribute("data-id",t);let s=b("span");s.textContent=e;let a=b("span",{className:"sp-settings-panel__check"});return a.innerHTML=E.checkmark,n.appendChild(s),n.appendChild(a),n.addEventListener("keydown",d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),n.click())}),n}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}selectSpeed(e){this.api.emit("playback:ratechange",{rate:e});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e),this.close()}updateQualityActiveStates(){let t=this.api.getState("currentQuality")?.id||"auto";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(n=>{let s=n.getAttribute("data-id");n.classList.toggle("sp-settings-panel__item--active",s===t)})}updateSpeedActiveStates(){let e=this.api.getState("playbackRate")??1;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let n=r.getAttribute("data-id"),s=parseFloat(n||"1");r.classList.toggle("sp-settings-panel__item--active",Math.abs(e-s)<.01)})}getFocusableItems(){return Array.from(this.panel.querySelectorAll('[role="menuitem"]'))}focusFirstItem(){requestAnimationFrame(()=>{let e=this.getFocusableItems();e.length>0&&e[0].focus()})}navigateItems(e){let t=this.getFocusableItems();if(t.length===0)return;let r=document.activeElement,n=t.indexOf(r),s;n===-1?s=e===1?0:t.length-1:s=(n+e+t.length)%t.length,t[s].focus()}getPanel(){return this.currentPanel}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.el.remove()}};var xn=10,De=class{constructor(e,t,r=xn){this.clickHandler=()=>{this.skip()};this.api=e,this.direction=t,this.seconds=r;let n=t==="backward"?E.replay10:E.forward10,s=t==="backward"?`Rewind ${r} seconds`:`Forward ${r} seconds`;this.el=G(`sp-skip sp-skip--${t}`,s,n),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("duration")??0,r=this.api.getState("seekableRange");if(e&&!r){this.el.style.display="none";return}if(e&&r){this.el.style.display="";return}if(t===0){this.el.style.display="none";return}this.el.style.display=""}skip(){let e=F(this.api.container);if(!e)return;let t=this.api.getState("live"),r=this.api.getState("seekableRange");if(t&&r){this.direction==="backward"?e.currentTime=Math.max(r.start,e.currentTime-this.seconds):e.currentTime=Math.min(r.end,e.currentTime+this.seconds);return}let n=e.duration||0;!n||!isFinite(n)||(this.direction==="backward"?e.currentTime=Math.max(0,e.currentTime-this.seconds):e.currentTime=Math.min(n,e.currentTime+this.seconds))}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var at=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=G("sp-captions","Captions",E.captionsOff),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("textTracks")||[],t=this.api.getState("currentTextTrack");if(e.length===0){this.el.style.display="none";return}this.el.style.display="",t?(K(this.el,E.captions),$(this.el,"aria-label",`Captions: ${t.label}`),this.el.classList.add("sp-captions--active")):(K(this.el,E.captionsOff),$(this.el,"aria-label","Captions"),this.el.classList.remove("sp-captions--active"))}toggle(){let e=this.api.getState("textTracks")||[],t=this.api.getState("currentTextTrack");e.length!==0&&(t?this.api.emit("track:text",{trackId:null}):this.api.emit("track:text",{trackId:e[0].id}))}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var Tn='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"/></svg>',ot=class{constructor(e){this.api=e,this.el=b("div",{className:"sp-bandwidth-indicator"}),this.el.innerHTML=Tn,this.el.setAttribute("aria-label","Bandwidth is limiting video quality"),this.el.setAttribute("title","Bandwidth is limiting video quality"),this.el.style.display="none"}render(){return this.el}update(){let e=this.api.getState("bandwidth"),t=this.api.getState("qualities");if(!e||!t||t.length===0){this.el.style.display="none";return}let r=Math.max(...t.map(n=>n.bitrate));r>0&&e<r?this.el.style.display="":this.el.style.display="none"}destroy(){this.el.remove()}};var lt=class{constructor(e){this.api=e;this.isOpen=!1;this.toggleHandler=()=>{this.isOpen?this.close():this.open()};this.el=b("div",{className:"sp-overflow"}),this.btn=G("sp-overflow__btn","More controls",E.more),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",this.toggleHandler),this.panel=b("div",{className:"sp-overflow-tray",role:"group","aria-label":"More controls"}),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.el.style.display="none",this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{!this.isOpen||t.key!=="Escape"||(t.preventDefault(),t.stopPropagation(),this.close(),this.btn.focus())},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){}adopt(e){this.panel.appendChild(e),this.syncVisibility()}release(e){return e.parentNode===this.panel&&this.panel.removeChild(e),this.syncVisibility(),e}holds(e){return e.parentNode===this.panel}open(){this.isOpen||(this.isOpen=!0,this.panel.classList.add("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","true"))}close(){this.isOpen&&(this.isOpen=!1,this.panel.classList.remove("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","false"))}isMenuOpen(){return this.isOpen}syncVisibility(){let e=Array.from(this.panel.children).some(t=>t.style.display!=="none");this.el.style.display=e?"":"none",!e&&this.isOpen&&this.close()}refresh(){this.syncVisibility()}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.btn.removeEventListener("click",this.toggleHandler),this.el.remove(),this.api.logger.debug("Overflow tray destroyed")}};var kn=new Map,Pn=new Map,Lr=new Set;function Yt(i,e){if(e){let t=Pn.get(e)?.get(i);if(t)return t}return kn.get(i)??null}function Sr(i){return Lr.add(i),()=>{Lr.delete(i)}}var xr=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var jt=[32,32,32],Tr=4.5,Mn=`
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
  yellow:ffff00 yellowgreen:9acd32`,kr;function _n(i){return kr??(kr=new Map(Mn.trim().split(/\s+/).map(e=>e.split(":")))),kr.get(i)}var An=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/;function Pr(i,e){if(!An.test(i))return null;let t=i.endsWith("%")?parseFloat(i)/100*e:parseFloat(i);return Math.min(e,Math.max(0,t))}function Mr(i){let e=/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(i)?.[1];if(!e)return null;let t=e.length<=4?e.split("").map(n=>n+n).join(""):e,r=t.length===8?parseInt(t.slice(6,8),16)/255:1;return[[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)],r]}function Cn(i){let e=/^rgba?\(([^()]*)\)$/.exec(i)?.[1]?.trim();if(!e)return null;let t,r;if(e.includes(","))t=e.split(",").map(a=>a.trim()),t.length===4&&(r=t.pop());else{let[a="",d,...o]=e.split("/").map(u=>u.trim());if(o.length||d==="")return null;t=a.split(/\s+/),r=d}if(t.length!==3)return null;let n=t.map(a=>Pr(a,255)),s=r===void 0?1:Pr(r,1);return n.some(a=>a===null)||s===null?null:[n.map(a=>Math.round(a)),s]}function Hn(i,e){let t=i.trim().toLowerCase(),r=_n(t),n=r?Mr(`#${r}`):Mr(t)??Cn(t);if(!n)return null;let[s,a]=n;return a<=0?null:a>=1?s:s.map((d,o)=>Math.round(d*a+e[o]*(1-a)))}function kt([i,e,t]){let[r,n,s]=[i,e,t].map(a=>{let d=a/255;return d<=.03928?d/12.92:Math.pow((d+.055)/1.055,2.4)});return .2126*r+.7152*n+.0722*s}function _r(i,e){let t=Math.max(kt(i),kt(e)),r=Math.min(kt(i),kt(e));return(t+.05)/(r+.05)}function Rn(i,e){return i.map(t=>Math.round(t+(255-t)*e))}function Ar(i){return`#${i.map(e=>e.toString(16).padStart(2,"0")).join("")}`}function Xt(i){let e=Hn(i,jt);if(!e)return i;if(_r(e,jt)>=Tr)return Ar(e);for(let t=.04;t<=1;t+=.04){let r=Rn(e,t);if(_r(r,jt)>=Tr)return Ar(r)}return"#ffffff"}var Dn=["play","skip-backward","skip-forward","volume","time","live-indicator","bandwidth-indicator","spacer","settings","captions","chromecast","airplay","pip","fullscreen"],In="sp-ui-styles",Nn=3e3,Fn=new Set([" ","Enter"]),On=new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"]),Bn=48,Cr=64,Vn=44,Hr=24,Rr=4,Un=100,$n=16,zn=56,Kn=120,Dr=1500;function Ir(i={}){let e,t=null,r=null,n=null,s=null,a=null,d=null,o=null,u=[],v=null,P=null,C=null,Q=null,M=null,O=null,D=null,w=!0,X=null,x=null,_=[],R=null,se=null,m=null,z=null,J=Hr,L=Rr,B=Cr,U=null,S=!0,I=!1,T=!1,V=new Set,q=null,ae=i.controls||Dn,ge=i.hideDelay??Nn,te=i.bigPlayButton!==!1,Z=i.responsive!==!1;Z&&qt(ae,i.priority);let me=l=>{switch(l){case"play":return new Ge(e);case"skip-backward":return new De(e,"backward");case"skip-forward":return new De(e,"forward");case"volume":return new Je(e);case"progress":return null;case"time":return new Xe(e);case"live-indicator":return new Ze(e);case"bandwidth-indicator":return new ot(e);case"quality":return new et(e);case"settings":return new st(e);case"captions":return new at(e);case"chromecast":return new Re(e,"chromecast");case"airplay":return new Re(e,"airplay");case"pip":return new tt(e);case"fullscreen":return new rt(e);case"spacer":return new nt;default:{let c=Yt(l,e.container);if(c)try{return c(e)}catch(h){return e.logger.error(`Control factory for "${l}" threw`,{error:h}),null}return V.add(l),e.logger.debug(`No control registered for slot "${l}" yet`),null}}},ke=()=>{q=null;for(let l of V)e.logger.warn(`Control slot "${l}" has no registered control after ${Dr}ms - is the plugin installed?`);V.clear()},Pe=()=>{if(!t)return;V.clear();let l=new Map(Tt(ae,i.priority).map(c=>[c.id,c]));for(let c of ae){let h=me(c);if(!h)continue;u.push(h);let f=h.render();t.appendChild(f);let g=l.get(c),y={slot:c,control:h,el:f,rank:g?.rank??"never",exit:g?.exit??"overflow",width:-1};_.push(y),c==="time"&&(R=y)}Z&&(x=new lt(e),u.push(x),t.appendChild(x.render()),Ie())},Ie=()=>{if(!t||!x)return;let l=x.render(),c=_.find(f=>f.slot==="fullscreen"),h=c&&c.el.parentNode===t?c.el:null;if(h){l.nextSibling!==h&&t.insertBefore(l,h);return}t.lastChild!==l&&t.appendChild(l)},ve=()=>{let l="";for(let c of _)l+=c.el.style.display==="none"?"0":"1";return`${l}:${R?.el.textContent?.length??0}`},Me=l=>{if(!t||!x)return;let c=new Set(l.overflow),h=new Set(l.hidden);for(let f of _)if(f.slot!=="spacer"){if(h.has(f.slot)){x.holds(f.el)&&ct(f),f.el.classList.add("sp-control--collapsed");continue}f.el.classList.remove("sp-control--collapsed"),c.has(f.slot)?x.holds(f.el)||x.adopt(f.el):x.holds(f.el)&&ct(f)}x.refresh(),Ie()},ct=l=>{if(!t||!x)return;let c=x.release(l.el),h=x.render(),f=h.parentNode===t?h:null;for(let g=_.indexOf(l)+1;g<_.length;g++)if(_[g].el.parentNode===t){f=_[g].el;break}t.insertBefore(c,f)},Pt=l=>{if(l.slot!=="volume")return 0;let c=l.el.querySelector(".sp-volume__slider-wrap");return c?c.getBoundingClientRect().width:0},Mt=l=>l.slot==="volume"?B:0,_e=l=>{let c=getComputedStyle(l),h=parseFloat(c.paddingLeft),f=parseFloat(c.paddingRight),g=parseFloat(c.columnGap||c.gap),y=parseFloat(c.getPropertyValue("--sp-volume-slider-width"));J=Number.isFinite(h)&&Number.isFinite(f)?h+f:Hr,L=Number.isFinite(g)?g:Rr,B=Number.isFinite(y)?y:Cr},_t=()=>{if(!Z||!t||!x||t.clientWidth===0)return;_e(t);let l=_.filter(y=>y.slot==="spacer"&&y.el.style.display!=="none").length,c=t.clientWidth-J-l*L,h=[];for(let y of _){if(y.slot==="spacer")continue;let A=y.el.style.display!=="none";A&&y.el.parentNode===t&&!y.el.classList.contains("sp-control--collapsed")?y.width=y.el.getBoundingClientRect().width-Pt(y):y.width<0&&(y.width=Bn),h.push({id:y.slot,rank:y.rank,exit:y.exit,width:y.width+Mt(y),visible:A})}let f=x.render(),g=f.style.display==="none"?0:f.getBoundingClientRect().width;Me(Wt(h,c,L,g||Vn)),U=ve(),S=!1},ut=()=>{Z&&(!S&&ve()===U||_t())},dt=l=>{let c=t?.offsetHeight||zn;e?.container?.style.setProperty("--sp-menu-max-height",`${Math.max(Kn,Math.round(l)-c-$n)}px`)},pe=()=>{t&&(u.forEach(l=>l.destroy()),u=[],_=[],R=null,x=null,We(t),U=null,S=!0,Pe(),Ne())},At=()=>{T&&(T=!1,pe())},pt=()=>{T||(T=!0,queueMicrotask(At))},Ne=()=>{u.forEach(y=>y.update()),n?.update();let l=e?.getState("waiting"),c=e?.getState("seeking"),f=e?.getState("playbackState")==="loading",g=l||c&&!e?.getState("paused")||f;s?.classList.toggle("sp-buffering--visible",!!g),a?.update(),d?.update(),ut()},ne=()=>{X===null&&(X=requestAnimationFrame(()=>{X=null,Ne()}))},Fe=()=>n?.isTimelineEditing()?!0:u.some(l=>{let c=l;return typeof c.isMenuOpen=="function"&&c.isMenuOpen()}),ie=()=>{if(w){ye();return}w=!0,t?.classList.add("sp-controls--visible"),t?.classList.remove("sp-controls--hidden"),r?.classList.add("sp-gradient--visible"),n?.show(),e?.setState("controlsVisible",!0),ye()},ht=()=>{if(!e?.getState("paused")){if(Fe()){ye();return}w=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),r?.classList.remove("sp-gradient--visible"),n?.hide(),e?.setState("controlsVisible",!1)}},ye=()=>{v&&clearTimeout(v),v=setTimeout(ht,ge)},gt=null,be=l=>{gt=l.pointerType},oe=l=>{gt==="touch"&&!ft(l)&&e?.getPlugin("gestures")?.ownsTapInteraction()||ie()},ft=l=>{let c=l?.target;return c instanceof Node?!!t?.contains(c)||!!n?.render().contains(c):!1},Ct=()=>{ht()},p=l=>{if(!e.container.contains(document.activeElement)||l.defaultPrevented||l.metaKey||l.ctrlKey||l.altKey)return;let c=document.activeElement;if(c instanceof HTMLInputElement||c instanceof HTMLTextAreaElement||c instanceof HTMLSelectElement||c?.isContentEditable)return;let h=c?.getAttribute("role");if((c instanceof HTMLButtonElement||h==="button"||h==="menuitem")&&Fn.has(l.key)||h==="slider"&&On.has(l.key))return;let g=e.container.querySelector("video");if(!g)return;let y=e.getState("live"),A=e.getState("seekableRange");switch(l.key){case" ":case"k":l.preventDefault(),g.paused?g.play().catch(()=>{}):g.pause();break;case"m":l.preventDefault(),g.muted=!g.muted;break;case"f":l.preventDefault(),we(e.container)?Se(e.container).catch(()=>{}):Le(e.container).catch(()=>{});break;case"ArrowLeft":l.preventDefault(),y&&A?g.currentTime=Math.max(A.start,g.currentTime-5):g.currentTime=Math.max(0,g.currentTime-5),e.emit("playback:seeking",{time:g.currentTime}),ie();break;case"ArrowRight":l.preventDefault(),y&&A?g.currentTime=Math.min(A.end,g.currentTime+5):g.currentTime=Math.min(g.duration||0,g.currentTime+5),e.emit("playback:seeking",{time:g.currentTime}),ie();break;case"ArrowUp":l.preventDefault(),g.volume=Math.min(1,g.volume+.1),ie();break;case"ArrowDown":l.preventDefault(),g.volume=Math.max(0,g.volume-.1),ie();break}};return{id:"ui-controls",name:"UI Controls",type:"ui",version:xr,async init(l){e=l,o=Ft(In,Gt),i.theme&&this.setTheme(i.theme);let c=e.container;if(!c){e.logger.error("UI plugin: container not found");return}getComputedStyle(c).position==="static"&&(c.style.position="relative"),c.classList.contains("sp-container")||(c.classList.add("sp-container"),I=!0);let f=e.getState("playing");r=document.createElement("div"),r.className=f?"sp-gradient":"sp-gradient sp-gradient--visible",c.appendChild(r),s=document.createElement("div"),s.className="sp-buffering",s.innerHTML=E.spinner,s.setAttribute("aria-hidden","true"),c.appendChild(s),a=new it(e),c.appendChild(a.render()),Q=e.on("error",g=>{if(g?.fatal){let y=e.getState("error")||g;a?.show(y),ne()}}),M=e.on("error:reconnecting",()=>{a?.showReconnecting(),ne()}),O=e.on("error:recovered",()=>{a?.hide(),ne()}),D=e.on("media:loaded",()=>{a?.hide(),ne()}),te&&(d=new Qe(e,()=>a?.isVisible()??!1),c.appendChild(d.render())),n=new je(e,{onEditingChange:g=>{g?ie():ye()}}),c.appendChild(n.render()),f||n.show(),t=document.createElement("div"),t.className=f?"sp-controls sp-controls--hidden":"sp-controls sp-controls--visible",t.setAttribute("role","toolbar"),t.setAttribute("aria-label","Video controls"),Pe(),V.size>0&&(q=setTimeout(ke,Dr)),c.appendChild(t),Z&&typeof ResizeObserver=="function"?(se=new ResizeObserver(g=>{dt(g[0]?.contentRect.height??c.clientHeight),S=!0,ne()}),se.observe(c)):Z&&typeof window<"u"&&(z=()=>{m&&clearTimeout(m),m=setTimeout(()=>{m=null,dt(c.clientHeight),S=!0,ne()},Un)},window.addEventListener("resize",z)),C=Sr((g,y)=>{ae.includes(g)&&(y&&y!==e.container||(e.logger.debug(`Control "${g}" registered after init, queuing a control bar rebuild`),pt()))}),c.addEventListener("pointerdown",be,{passive:!0}),c.addEventListener("pointermove",be,{passive:!0}),c.addEventListener("mousemove",oe),c.addEventListener("mouseenter",oe),c.addEventListener("mouseleave",Ct),c.addEventListener("touchstart",oe,{passive:!0}),c.addEventListener("click",oe),document.addEventListener("keydown",p),P=e.subscribeToState(ne),Ne(),c.hasAttribute("tabindex")||c.setAttribute("tabindex","0"),w=!f,e.setState("controlsVisible",w),f&&ye(),e.logger.debug("UI controls plugin initialized")},async destroy(){v&&(clearTimeout(v),v=null),X!==null&&(cancelAnimationFrame(X),X=null),se?.disconnect(),se=null,z&&(window.removeEventListener("resize",z),z=null),m&&(clearTimeout(m),m=null),e?.container?.style.removeProperty("--sp-menu-max-height"),P?.(),P=null,Q?.(),Q=null,M?.(),M=null,O?.(),O=null,D?.(),D=null,e?.container&&(e.container.removeEventListener("pointerdown",be),e.container.removeEventListener("pointermove",be),e.container.removeEventListener("mousemove",oe),e.container.removeEventListener("mouseenter",oe),e.container.removeEventListener("mouseleave",Ct),e.container.removeEventListener("touchstart",oe),e.container.removeEventListener("click",oe)),document.removeEventListener("keydown",p),C?.(),C=null,T=!1,q&&(clearTimeout(q),q=null),V.clear(),u.forEach(l=>l.destroy()),u=[],_=[],R=null,x=null,n?.destroy(),n=null,a?.destroy(),a=null,d?.destroy(),d=null,t?.remove(),t=null,r?.remove(),r=null,s?.remove(),s=null,o?.(),o=null,I&&(e?.container?.classList.remove("sp-container"),I=!1),e?.logger.debug("UI controls plugin destroyed")},show(){ie()},hide(){w=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),r?.classList.remove("sp-gradient--visible"),n?.hide(),e?.setState("controlsVisible",!1)},setTheme(l){let c=e?.container||document.documentElement;l.primaryColor&&c.style.setProperty("--sp-color",l.primaryColor),l.accentColor&&c.style.setProperty("--sp-accent",l.accentColor),l.accentTextColor&&c.style.setProperty("--sp-accent-text",l.accentTextColor),l.backgroundColor&&c.style.setProperty("--sp-bg",l.backgroundColor),l.controlBarHeight&&c.style.setProperty("--sp-control-height",`${l.controlBarHeight}px`),l.iconSize&&c.style.setProperty("--sp-icon-size",`${l.iconSize}px`)},getControlBar(){return t}}}async function bo(i,e){let t=e.accentColor??"#e50914",r=await It({container:i,src:e.src,poster:e.poster,plugins:[fr(),yr(),Ir({theme:{accentColor:t,accentTextColor:Xt(t)}})]});if(r.getState().error)throw await r.destroy(),new Error("The sample failed to load");return{async play(){let n=i.querySelector("video");if(!n)throw new Error("The player has no media element");await n.play()},onFirstPlaying(n){if(r.playing){n();return}let s=r.subscribeToState(a=>{a.key==="playing"&&a.value===!0&&(s(),n())})},destroy(){return r.destroy()}}}export{bo as mountHomePlayer};
