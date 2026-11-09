import{a as Lr}from"./chunk-VC46IEJQ.js";var rn=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var Je=null;var Hn=new WeakMap;function zt(i,e){let t=Hn.get(i);t||(t=new Set,Hn.set(i,t)),t.add(e)}var ct=class{constructor(e){this.subscribers=new Set;this.value=e}get(){if(Je){let e=Je;this.subscribers.add(e),zt(e,()=>this.subscribers.delete(e))}return this.value}set(e){Object.is(this.value,e)||(this.value=e,this.notify())}update(e){this.set(e(this.value))}subscribe(e){return this.subscribers.add(e),()=>this.subscribers.delete(e)}notify(){Array.from(this.subscribers).forEach(e=>{try{e()}catch(t){console.error("[Scarlett Player] Error in signal subscriber:",t)}})}destroy(){this.subscribers.clear()}getSubscriberCount(){return this.subscribers.size}};function Kt(i){return new ct(i)}var Ze={playbackState:"idle",playing:!1,paused:!0,ended:!1,buffering:!1,waiting:!1,seeking:!1,currentTime:0,duration:NaN,buffered:null,bufferedAmount:0,mediaType:"unknown",source:null,title:"",poster:"",volume:1,muted:!1,playbackRate:1,fullscreen:!1,pip:!1,controlsVisible:!0,qualities:[],currentQuality:null,audioTracks:[],currentAudioTrack:null,textTracks:[],currentTextTrack:null,live:!1,liveEdge:!0,seekableRange:null,liveLatency:0,lowLatencyMode:!1,chapters:[],currentChapter:null,error:null,bandwidth:0,autoplay:!1,loop:!1,airplayAvailable:!1,airplayActive:!1,chromecastAvailable:!1,chromecastActive:!1,thumbnails:null,interacting:!1,hovering:!1,focused:!1},ut=class{constructor(e){this.signals=new Map;this.changeSubscribers=new Set;this.definedDefaults=new Map;this.lastValues=new Map;this.destroyed=!1;this.initializeSignals(e)}initializeSignals(e){let t={...Ze,...e};for(let[n,r]of Object.entries(t))this.createSignal(n,r)}createSignal(e,t){let n=Kt(t);this.lastValues.set(e,t),n.subscribe(()=>{this.notifyChangeSubscribers(e)}),this.signals.set(e,n)}define(e,t){if(this.signals.has(e)){let n=this.definedDefaults.has(e),r=e in Ze,s=n?this.definedDefaults.get(e):Ze[e];(n||r)&&!Object.is(s,t)&&console.warn(`[StateManager] State key "${String(e)}" is already defined with a different default. Keeping:`,s,"ignoring:",t);return}this.definedDefaults.set(e,t),this.createSignal(e,t)}get(e){if(this.destroyed)throw new Error(`[StateManager] Manager is destroyed (reading '${e}')`);let t=this.signals.get(e);if(!t)throw new Error(`[StateManager] Unknown state key: ${e}`);return t}getValue(e){return this.get(e).get()}set(e,t){this.get(e).set(t)}update(e){for(let[t,n]of Object.entries(e)){let r=t;this.signals.has(r)&&this.set(r,n)}}subscribeToKey(e,t){let n=this.get(e);return n.subscribe(()=>{t(n.get())})}subscribe(e){return this.changeSubscribers.add(e),()=>this.changeSubscribers.delete(e)}notifyChangeSubscribers(e){let n=this.get(e).get(),r=this.lastValues.get(e);this.lastValues.set(e,n);let s={key:e,value:n,previousValue:r};Array.from(this.changeSubscribers).forEach(o=>{try{o(s)}catch(l){console.error("[StateManager] Error in change subscriber:",l)}})}reset(){this.update({...Ze,...Object.fromEntries(this.definedDefaults)})}resetKey(e){let t=e in Ze?Ze[e]:this.definedDefaults.get(e);this.set(e,t)}snapshot(){let e={};for(let[t,n]of this.signals)e[t]=n.get();return Object.freeze(e)}getSubscriberCount(e){return this.signals.get(e)?.getSubscriberCount()??0}destroy(){this.signals.forEach(e=>e.destroy()),this.signals.clear(),this.changeSubscribers.clear(),this.lastValues.clear(),this.destroyed=!0}};var Ar={maxListeners:100,async:!1,interceptors:!0},dt=class{constructor(e){this.listeners=new Map;this.onceListeners=new Map;this.interceptors=new Map;this.options={...Ar,...e}}on(e,t){return this.listeners.has(e)||this.listeners.set(e,new Set),this.listeners.get(e).add(t),this.checkMaxListeners(e),()=>this.off(e,t)}once(e,t){this.onceListeners.has(e)||this.onceListeners.set(e,new Set);let n=this.onceListeners.get(e);return n.add(t),this.listeners.has(e)||this.listeners.set(e,new Set),()=>{n.delete(t)}}off(e,t){let n=this.listeners.get(e);n&&(n.delete(t),n.size===0&&this.listeners.delete(e));let r=this.onceListeners.get(e);r&&(r.delete(t),r.size===0&&this.onceListeners.delete(e))}emit(e,t){let n=this.runInterceptors(e,t);if(n===null)return;let r=this.listeners.get(e);r&&Array.from(r).forEach(l=>{this.safeCallHandler(l,n)});let s=this.onceListeners.get(e);s&&(Array.from(s).forEach(l=>{s.delete(l),this.safeCallHandler(l,n)}),s.size===0&&this.onceListeners.delete(e))}async emitAsync(e,t){let n=await this.runInterceptorsAsync(e,t);if(n===null)return;let r=this.listeners.get(e);if(r){let o=Array.from(r).map(l=>this.safeCallHandlerAsync(l,n));await Promise.all(o)}let s=this.onceListeners.get(e);if(s){let l=Array.from(s).map(c=>(s.delete(c),this.safeCallHandlerAsync(c,n)));await Promise.all(l),s.size===0&&this.onceListeners.delete(e)}}intercept(e,t){if(!this.options.interceptors)return()=>{};this.interceptors.has(e)||this.interceptors.set(e,new Set);let n=this.interceptors.get(e);return n.add(t),()=>{n.delete(t),n.size===0&&this.interceptors.delete(e)}}removeAllListeners(e){e?(this.listeners.delete(e),this.onceListeners.delete(e)):(this.listeners.clear(),this.onceListeners.clear())}listenerCount(e){let t=this.listeners.get(e)?.size??0,n=this.onceListeners.get(e)?.size??0;return t+n}destroy(){this.listeners.clear(),this.onceListeners.clear(),this.interceptors.clear()}runInterceptors(e,t){if(!this.options.interceptors)return t;let n=this.interceptors.get(e);if(!n||n.size===0)return t;let r=t;for(let s of n)try{if(r=s(r),r===null)return null}catch(o){console.error("[EventBus] Error in interceptor:",o)}return r}async runInterceptorsAsync(e,t){if(!this.options.interceptors)return t;let n=this.interceptors.get(e);if(!n||n.size===0)return t;let r=t;for(let s of n)try{let o=s(r);if(r=o instanceof Promise?await o:o,r===null)return null}catch(o){console.error("[EventBus] Error in interceptor:",o)}return r}safeCallHandler(e,t){try{e(t)}catch(n){console.error("[EventBus] Error in event handler:",n)}}async safeCallHandlerAsync(e,t){try{let n=e(t);n instanceof Promise&&await n}catch(n){console.error("[EventBus] Error in event handler:",n)}}checkMaxListeners(e){let t=this.listenerCount(e);t>this.options.maxListeners&&console.warn(`[EventBus] Max listeners (${this.options.maxListeners}) exceeded for event: ${e}. Current count: ${t}. This may indicate a memory leak.`)}};var Nn=["debug","info","warn","error"],Cr=i=>{let t=`${i.scope?`[${i.scope}]`:"[ScarlettPlayer]"} ${i.message}`,n=i.metadata??"";switch(i.level){case"debug":console.debug(t,n);break;case"info":console.info(t,n);break;case"warn":console.warn(t,n);break;case"error":console.error(t,n);break}},pt=class i{constructor(e){this.level=e?.level??"warn",this.scope=e?.scope,this.enabled=e?.enabled??!0,this.handlers=e?.handlers??[Cr]}child(e){return new i({level:this.level,scope:this.scope?`${this.scope}:${e}`:e,enabled:this.enabled,handlers:this.handlers})}debug(e,t){this.log("debug",e,t)}info(e,t){this.log("info",e,t)}warn(e,t){this.log("warn",e,t)}error(e,t){this.log("error",e,t)}setLevel(e){this.level=e}setEnabled(e){this.enabled=e}addHandler(e){this.handlers.push(e)}removeHandler(e){let t=this.handlers.indexOf(e);t!==-1&&this.handlers.splice(t,1)}log(e,t,n){if(!this.enabled||!this.shouldLog(e))return;let r={level:e,message:t,timestamp:Date.now(),scope:this.scope,metadata:n};for(let s of this.handlers)try{s(r)}catch(o){console.error("[Logger] Handler error:",o)}}shouldLog(e){return Nn.indexOf(e)>=Nn.indexOf(this.level)}};var Be=(S=>(S.SOURCE_NOT_SUPPORTED="SOURCE_NOT_SUPPORTED",S.SOURCE_LOAD_FAILED="SOURCE_LOAD_FAILED",S.PROVIDER_NOT_FOUND="PROVIDER_NOT_FOUND",S.PROVIDER_SETUP_FAILED="PROVIDER_SETUP_FAILED",S.PLUGIN_SETUP_FAILED="PLUGIN_SETUP_FAILED",S.PLUGIN_NOT_FOUND="PLUGIN_NOT_FOUND",S.PLAYBACK_FAILED="PLAYBACK_FAILED",S.MEDIA_DECODE_ERROR="MEDIA_DECODE_ERROR",S.MEDIA_NETWORK_ERROR="MEDIA_NETWORK_ERROR",S.MEDIA_APPEND_ERROR="MEDIA_APPEND_ERROR",S.MEDIA_BUFFER_FULL="MEDIA_BUFFER_FULL",S.PLAYLIST_INVALID="PLAYLIST_INVALID",S.UNKNOWN_ERROR="UNKNOWN_ERROR",S))(Be||{}),ht=class{constructor(e,t,n){this.errors=[];this.eventBus=e,this.logger=t,this.maxHistory=n?.maxHistory??10}handle(e,t){let n=this.normalizeError(e,t);return this.addToHistory(n),this.logError(n),this.eventBus.emit("error",n),n}record(e,t){let n=this.normalizeError(e,t);return this.addToHistory(n),this.logError(n),n}throw(e,t,n){let r={code:e,message:t,fatal:n?.fatal??this.isFatalCode(e),timestamp:Date.now(),context:n?.context,originalError:n?.originalError};return this.handle(r,n?.context)}getHistory(){return[...this.errors]}getLastError(){return this.errors[this.errors.length-1]??null}clearHistory(){this.errors=[]}hasFatalError(){return this.errors.some(e=>e.fatal)}normalizeError(e,t){return this.isPlayerError(e)?{...e,context:{...e.context,...t}}:{code:this.getErrorCode(e),message:e.message,fatal:this.isFatal(e,t),timestamp:Date.now(),context:t,originalError:e}}getErrorCode(e){let t=e.message.toLowerCase();return t.includes("quota")?"MEDIA_BUFFER_FULL":t.includes("append")||t.includes("sourcebuffer")||t.includes("arraybuffer")?"MEDIA_APPEND_ERROR":t.includes("network")?"MEDIA_NETWORK_ERROR":t.includes("decode")?"MEDIA_DECODE_ERROR":t.includes("source")?"SOURCE_LOAD_FAILED":t.includes("plugin")?"PLUGIN_SETUP_FAILED":t.includes("provider")?"PROVIDER_SETUP_FAILED":"UNKNOWN_ERROR"}isFatal(e,t){return t?.operation==="load"?!0:this.isFatalCode(this.getErrorCode(e))}isFatalCode(e){return["SOURCE_NOT_SUPPORTED","PROVIDER_NOT_FOUND","MEDIA_DECODE_ERROR"].includes(e)}isPlayerError(e){return typeof e=="object"&&e!==null&&"code"in e&&"message"in e&&"fatal"in e&&"timestamp"in e}addToHistory(e){this.errors.push(e),this.errors.length>this.maxHistory&&this.errors.shift()}logError(e){let t=`[${e.code}] ${e.message}`;e.fatal?this.logger.error(t,{code:e.code,context:e.context}):this.logger.warn(t,{code:e.code,context:e.context})}};var gt=class{constructor(e,t){this.detachedContainer=null;this.revoked=!1;this.cleanupFns=[];this.pluginId=e,this.stateManager=t.stateManager,this.eventBus=t.eventBus,this.playerContainer=t.container,this.getPluginFn=t.getPlugin,this.getProviderDiagnosticsFn=t.getProviderDiagnostics,this.logger={debug:(n,r)=>t.logger.debug(`[${e}] ${n}`,r),info:(n,r)=>t.logger.info(`[${e}] ${n}`,r),warn:(n,r)=>t.logger.warn(`[${e}] ${n}`,r),error:(n,r)=>t.logger.error(`[${e}] ${n}`,r)}}get container(){return this.revoked?(this.detachedContainer??(this.detachedContainer=document.createElement("div")),this.detachedContainer):this.playerContainer}getState(e){return this.stateManager.getValue(e)}setState(e,t){this.revoked||this.stateManager.set(e,t)}defineState(e,t){this.revoked||this.stateManager.define(e,t)}on(e,t){return this.revoked?()=>{}:this.eventBus.on(e,t)}off(e,t){this.eventBus.off(e,t)}emit(e,t){this.revoked||this.eventBus.emit(e,t)}getPlugin(e){return this.getPluginFn(e)}onDestroy(e){this.cleanupFns.push(e)}subscribeToState(e){return this.revoked?()=>{}:this.stateManager.subscribe(e)}getProviderDiagnostics(){return this.getProviderDiagnosticsFn?this.getProviderDiagnosticsFn():{}}runCleanups(){for(let e of this.cleanupFns)try{e()}catch(t){this.logger.error("Cleanup function failed",{error:t})}this.cleanupFns=[]}revoke(){return this.revoked?!1:(this.revoked=!0,this.runCleanups(),!0)}restore(){this.revoked=!1}getCleanupFns(){return this.cleanupFns}};var He={MAX_ERRORS:20,MAX_TIME_RANGES:32,MAX_OBJECT_KEYS:64,MAX_ARRAY_ITEMS:50,MAX_NESTING_DEPTH:4,MAX_NODES:500},On=new Set(["__proto__","constructor","prototype"]),Rr=/(token|secret|password|credential|auth|authorization|cookie|session|signature)/i,Hr=/^[A-Za-z][A-Za-z0-9_]{0,39}$/,Dr=new Set(["id","userid","viewerid","uid","email","ip","url","uri","src","href","key"]),Fn=new Set(["hls.js","native","new","connecting","connected","disconnected","failed","closed","checking","completed","stable","have-local-offer","have-remote-offer","have-local-pranswer","have-remote-pranswer"]),sn=!1,Ir=new Set(["playback","network","media","source","player","access","unknown"]),Nr=["httpStatus","mediaErrorCode","networkState","readyState","attempts"],Or=["retriesExhausted","reconnectExhausted","reconnecting","timedOut","stalled"];function Bn(i){if(typeof i!="string"||i.trim()==="")return null;try{let e=typeof document<"u"?document.baseURI:void 0,t=new URL(i,e);return t.protocol==="blob:"||t.protocol==="data:"?null:t.hostname||null}catch{return null}}function $t(i,e=1,t=new WeakSet,n={omitted:0}){if(i===void 0)return;if(e>He.MAX_NESTING_DEPTH){n.omitted++;return}if(n.nodes=(n.nodes??0)+1,n.nodes>He.MAX_NODES){n.omitted++;return}if(i===null)return null;if(typeof i=="boolean")return i;if(typeof i=="number")return Number.isFinite(i)?i:null;if(typeof i=="string"){if(Fn.has(i))return i;n.omitted++;return}if(typeof i!="object"||typeof i.then=="function"||i instanceof Promise){n.omitted++;return}if(t.has(i)){n.omitted++;return}if(t.add(i),Array.isArray(i)){let o=[],l=Math.min(i.length,He.MAX_ARRAY_ITEMS);n.omitted+=i.length-l;for(let c=0;c<l;c++){if(n.nodes>=He.MAX_NODES){n.omitted+=l-c;break}try{let u=$t(i[c],e+1,t,n);u!==void 0&&o.push(u)}catch{n.omitted++}}return o}if(!Fr(i)){n.omitted++;return}let r=Object.create(null),s=Object.keys(i);for(let o=0;o<s.length;o++){if(o>=He.MAX_OBJECT_KEYS||n.nodes>=He.MAX_NODES){n.omitted+=s.length-o;break}let l=s[o];if(!Br(l)){n.omitted++;continue}try{let c=i[l],u=$t(c,e+1,t,n);u!==void 0&&(r[l]=u)}catch{n.omitted++}}return r}function Fr(i){try{let e=Object.getPrototypeOf(i);return e===null||e===Object.prototype}catch{return!1}}function Br(i){return Hr.test(i)&&!On.has(i)&&!Dr.has(i.toLowerCase())&&!Rr.test(i)}function qt(i,e){let t=Object.create(null);if(sn)return t;sn=!0;try{Vr(t,i,e)}finally{sn=!1}return t}function Vr(i,e,t){for(let n of e)if(!(!n||typeof n.id!="string")&&!On.has(n.id)){if(typeof n.getDiagnostics!="function"){i[n.id]=null;continue}try{let r=n.getDiagnostics();if(r==null)i[n.id]=null;else if(typeof r.then=="function"||r instanceof Promise)i[n.id]={unavailable:!0};else{let s={omitted:0},o=$t(r,1,new WeakSet,s);i[n.id]=o!==void 0?o:{unavailable:!0},s.omitted>0&&t?.push(n.id)}}catch{i[n.id]={unavailable:!0}}}t?.sort()}function Vn(i){if(i.context?.category&&Ir.has(i.context.category))return i.context.category;let e=i.detail||{};return[401,403,451].includes(e.httpStatus)?"access":i.code==="MEDIA_NETWORK_ERROR"||i.code==="SOURCE_LOAD_FAILED"||e.type==="network"?"network":i.code==="MEDIA_DECODE_ERROR"||i.code==="MEDIA_APPEND_ERROR"||i.code==="MEDIA_BUFFER_FULL"||e.type==="media"?"media":i.code==="SOURCE_NOT_SUPPORTED"||i.code==="PLAYLIST_INVALID"||i.code==="PROVIDER_NOT_FOUND"?"source":i.code==="PLAYBACK_FAILED"?"playback":i.code==="PROVIDER_SETUP_FAILED"||i.code==="PLUGIN_SETUP_FAILED"||i.code==="PLUGIN_NOT_FOUND"?"player":e.mediaErrorCode===2?"network":e.mediaErrorCode===3?"media":e.mediaErrorCode===4?"source":"unknown"}function Un(i,e=He.MAX_ERRORS){let t=[],n=new Set(Object.values(Be)),r=e>0?i.slice(-e):[];for(let s of r){let o=n.has(s.code)?s.code:"UNKNOWN_ERROR",l=Vn(s),c=!!s.fatal,u=Number.isFinite(s.timestamp)?s.timestamp:Date.now(),y={code:o,category:l,fatal:c,timestamp:u};if(s.detail&&typeof s.detail=="object"){let M={},b=!1;for(let S of Nr){let L=s.detail[S];typeof L=="number"&&Number.isFinite(L)&&(M[S]=L,b=!0)}for(let S of Or){let L=s.detail[S];typeof L=="boolean"&&(M[S]=L,b=!0)}b&&(y.detail=M)}t.push(y)}return t}function on(i,e,t){if(t||!i)return{playbackState:"destroyed",playing:!1,paused:!1,ended:!1,buffering:!1,seeking:!1,currentTime:null,duration:null,volume:null,muted:null,playbackRate:null,mediaType:null,live:null,seekableRange:null,liveEdge:null,liveLatency:null,dimensions:null,source:null};let n=i.snapshot(),r=Number.isFinite(n.currentTime)?n.currentTime:null,s=Number.isFinite(n.duration)?n.duration:null,o=Number.isFinite(n.volume)?n.volume:null,l=Number.isFinite(n.playbackRate)?n.playbackRate:null,c=null;(n.mediaType==="video"||n.mediaType==="audio")&&(c=n.mediaType);let u=null;n.seekableRange&&typeof n.seekableRange.start=="number"&&typeof n.seekableRange.end=="number"&&Number.isFinite(n.seekableRange.start)&&Number.isFinite(n.seekableRange.end)&&(u={start:n.seekableRange.start,end:n.seekableRange.end});let y=null,M=null;n.live&&(y=typeof n.liveEdge=="boolean"?n.liveEdge:null,M=Number.isFinite(n.liveLatency)?n.liveLatency:null);let b=null;if(e){let L=e.querySelector("video");L&&L.videoWidth>0&&L.videoHeight>0&&(b={width:L.videoWidth,height:L.videoHeight})}let S=null;return n.source&&n.source.src&&(S={hostname:Bn(n.source.src),...n.source.type?{type:n.source.type}:{}}),{playbackState:n.playbackState||"idle",playing:!!n.playing,paused:!!n.paused,ended:!!n.ended,buffering:!!n.buffering,seeking:!!n.seeking,currentTime:r,duration:s,volume:o,muted:typeof n.muted=="boolean"?n.muted:!1,playbackRate:l,mediaType:c,live:!!n.live,seekableRange:u,liveEdge:y,liveLatency:M,dimensions:b,source:S}}function an(i){let e=Date.now(),t=i.playerVersion;if(i.isDestroyed||!i.stateManager)return{schemaVersion:1,timestamp:e,playerVersion:t,playbackState:on(null,null,!0),errors:[],providers:Object.create(null),truncatedProviders:[]};let n=on(i.stateManager,i.container,!1),r=i.errorHandler?Un(i.errorHandler.getHistory()):[],s=i.pluginManager?i.pluginManager.getReadyPlugins().filter(c=>c.type==="provider"):[],o=[],l=qt(s,o);return{schemaVersion:1,timestamp:e,playerVersion:t,playbackState:n,errors:r,providers:l,truncatedProviders:o}}var ft=class{constructor(e,t,n,r){this.plugins=new Map;this.initPromises=new Map;this.destroyPromises=new Map;this.initializingStack=new Set;this.eventBus=e,this.stateManager=t,this.logger=n,this.container=r.container}register(e,t){if(this.plugins.has(e.id))throw new Error(`Plugin "${e.id}" is already registered`);this.validatePlugin(e);let n=new gt(e.id,{stateManager:this.stateManager,eventBus:this.eventBus,logger:this.logger,container:this.container,getPlugin:r=>this.getReadyPlugin(r),getProviderDiagnostics:()=>this.getProviderDiagnostics()});this.plugins.set(e.id,{plugin:e,state:"registered",config:t,cleanupFns:[],api:n}),this.logger.info(`Plugin registered: ${e.id}`),this.eventBus.emit("plugin:registered",{name:e.id,type:e.type})}async unregister(e){let t=this.plugins.get(e);t&&(t.state==="ready"&&await this.destroyPlugin(e),this.plugins.delete(e),this.logger.info(`Plugin unregistered: ${e}`))}async initAll(){let e=this.resolveDependencyOrder();for(let t of e)await this.initPlugin(t)}async initPlugin(e){let t=this.plugins.get(e);if(!t)throw new Error(`Plugin "${e}" not found`);let n=this.destroyPromises.get(e);if(n&&await n,t.state==="ready")return;if(this.initializingStack.has(e))throw new Error(`Plugin "${e}" is already initializing (possible circular dependency)`);let r=this.initPromises.get(e);if(r)return r;if(t.state==="initializing"){let o=this.initPromises.get(e);return o||void 0}let s=(async()=>{this.initializingStack.add(e);try{for(let o of t.plugin.dependencies||[]){let l=this.plugins.get(o);if(!l)throw new Error(`Plugin "${e}" depends on missing plugin "${o}"`);l.state!=="ready"&&await this.initPlugin(o)}}finally{this.initializingStack.delete(e)}try{if(t.state="initializing",t.api.restore(),t.plugin.onStateChange){let o=this.stateManager.subscribe(t.plugin.onStateChange.bind(t.plugin));t.api.onDestroy(o)}if(t.plugin.onError){let o=this.eventBus.on("error",l=>{t.plugin.onError?.(l.originalError||new Error(l.message))});t.api.onDestroy(o)}await t.plugin.init(t.api,t.config),t.state="ready",this.logger.info(`Plugin ready: ${e}`),this.eventBus.emit("plugin:active",{name:e})}catch(o){throw t.state="error",t.error=o,t.api.runCleanups(),this.logger.error(`Plugin init failed: ${e}`,{error:o}),this.eventBus.emit("plugin:error",{name:e,error:o}),o}finally{this.initPromises.delete(e)}})();return this.initPromises.set(e,s),s}async destroyAll(){let e=this.resolveDependencyOrder().reverse();for(let t of e){let n=this.destroyPlugin(t);if(this.initPromises.has(t)){n.catch(()=>{});continue}await n}}async destroyPlugin(e){let t=this.destroyPromises.get(e);if(t)return t;let n=this.plugins.get(e);if(!n)return;let r=this.initPromises.get(e);if(!r&&n.state!=="ready")return;let s=(async()=>{if(r)try{await r}catch{}if(n.state!=="ready"){n.api.runCleanups();return}try{await n.plugin.destroy()}catch(o){this.logger.error(`Plugin destroy failed: ${e}`,{error:o})}finally{n.api.runCleanups(),n.state="registered",this.eventBus.emit("plugin:destroyed",{name:e})}})();this.destroyPromises.set(e,s);try{await s}finally{this.destroyPromises.get(e)===s&&this.destroyPromises.delete(e)}}abandonPlugin(e){let t=this.plugins.get(e);return!t||!this.destroyPromises.has(e)?!1:t.api.revoke()}getPlugin(e){let t=this.plugins.get(e);return t?t.plugin:null}getReadyPlugin(e){let t=this.plugins.get(e);return t?.state==="ready"?t.plugin:null}hasPlugin(e){return this.plugins.has(e)}getPluginState(e){return this.plugins.get(e)?.state??null}getPluginIds(){return Array.from(this.plugins.keys())}getReadyPlugins(){return Array.from(this.plugins.values()).filter(e=>e.state==="ready").map(e=>e.plugin)}getPluginsByType(e){return Array.from(this.plugins.values()).filter(t=>t.plugin.type===e).map(t=>t.plugin)}getProviderDiagnostics(){let e=this.getReadyPlugins().filter(t=>t.type==="provider");return qt(e)}selectProvider(e){let t=this.getPluginsByType("provider");for(let n of t){let r=n.canPlay;if(typeof r=="function"&&r(e))return n}return null}resolveDependencyOrder(){let e=new Set,t=new Set,n=[],r=(s,o=[])=>{if(e.has(s))return;if(t.has(s)){let c=[...o,s].join(" -> ");throw new Error(`Circular dependency detected: ${c}`)}let l=this.plugins.get(s);if(l){t.add(s);for(let c of l.plugin.dependencies||[])this.plugins.has(c)&&r(c,[...o,s]);t.delete(s),e.add(s),n.push(s)}};for(let s of this.plugins.keys())r(s);return n}validatePlugin(e){if(!e.id||typeof e.id!="string")throw new Error("Plugin must have a valid id");if(!e.name||typeof e.name!="string")throw new Error(`Plugin "${e.id}" must have a valid name`);if(!e.version||typeof e.version!="string")throw new Error(`Plugin "${e.id}" must have a valid version`);if(!e.type||typeof e.type!="string")throw new Error(`Plugin "${e.id}" must have a valid type`);if(typeof e.init!="function")throw new Error(`Plugin "${e.id}" must have an init() method`);if(typeof e.destroy!="function")throw new Error(`Plugin "${e.id}" must have a destroy() method`)}};function ln(i){return i.querySelector("video")}function Ve(i){let e=document,t=e.fullscreenElement??e.webkitFullscreenElement??null;return t&&i.contains(t)?!0:!!ln(i)?.webkitDisplayingFullscreen}async function Ue(i){let e=i;if(e.requestFullscreen){await e.requestFullscreen();return}if(e.webkitRequestFullscreen){await e.webkitRequestFullscreen();return}let t=ln(i);if(t?.webkitEnterFullscreen){t.webkitEnterFullscreen();return}throw new Error("Fullscreen is not supported")}async function ze(i){let e=ln(i);if(e?.webkitDisplayingFullscreen){e.webkitExitFullscreen?.();return}let t=document;if(t.exitFullscreen){await t.exitFullscreen();return}t.webkitExitFullscreen&&await t.webkitExitFullscreen()}var Ur=":redacted",zr=/^[0-9a-fA-F]{32,}$/,Kr=/^[A-Za-z0-9-]+$/;function $r(i){try{return decodeURIComponent(i)}catch{return i}}function qr(i){if(zr.test(i))return!0;let e=i.split("_");return e.length<3||!e.every(t=>Kr.test(t))?!1:e.some(t=>/^[0-9a-fA-F]{16,}$/.test(t)||t.length>=20&&/[A-Za-z]/.test(t)&&/[0-9]/.test(t))}function ee(i){if(i)try{let e=new URL(i);if(e.protocol!=="http:"&&e.protocol!=="https:")return;let t=e.pathname.split("/").map(n=>qr($r(n))?Ur:n).join("/");return`${e.origin}${t}`}catch{return}}var zn=1e4,Wt=class{constructor(e){this._currentProvider=null;this.destroyed=!1;this.seekingWhilePlaying=!1;this.seekResumeTimeout=null;this.initialSrcLoaded=!1;this.loadGeneration=0;this.requestedSource=null;this.providerTeardown=null;this.teardownWaits=new Set;this.pendingRecoveryAutoplay=null;this.playbackCommands=0;this.lastPlaybackCommand=null;this.pendingUnload=null;this.listenersWired=!1;this.readyEmitted=!1;this.fullscreenAnnounced=!1;this.unwireFullscreen=null;this.destroyPromise=null;this.initializing=null;if(typeof e.container=="string"){let t=document.querySelector(e.container);if(!t||!(t instanceof HTMLElement))throw new Error(`ScarlettPlayer: container not found: ${e.container}`);this.container=t}else if(e.container instanceof HTMLElement)this.container=e.container;else throw new Error("ScarlettPlayer requires a valid HTMLElement container or CSS selector");if(this.initialSrc=e.src,this.eventBus=new dt,this.stateManager=new ut({autoplay:e.autoplay??!1,loop:e.loop??!1,volume:e.volume??1,muted:e.muted??!1,poster:e.poster??""}),this.logger=new pt({level:e.logLevel??"warn",scope:"ScarlettPlayer"}),this.errorHandler=new ht(this.eventBus,this.logger),this.pluginManager=new ft(this.eventBus,this.stateManager,this.logger,{container:this.container}),this.eventBus.on("error",t=>{this.stateManager.set("error",t)}),this.eventBus.on("media:loaded",()=>{this.stateManager.set("error",null)}),this.eventBus.on("media:error",({error:t})=>{this.errorHandler.record(t,{channel:"media:error"})}),this.wireFullscreenListeners(),e.plugins)for(let t of e.plugins)this.pluginManager.register(t);this.logger.info("ScarlettPlayer constructed",{autoplay:e.autoplay,plugins:e.plugins?.length??0})}ensureInitialized(){return this.initializing?this.initializing:(this.initializing=this.runInitialization().finally(()=>{this.initializing=null}),this.initializing)}async runInitialization(){for(let e of this.pluginManager.getPluginIds()){if(this.destroyed)return;let t=this.pluginManager.getPlugin(e);!t||t.type==="provider"||this.pluginManager.getPluginState(e)==="registered"&&await this.pluginManager.initPlugin(e)}this.destroyed||(this.wireLifecycleListeners(),this.readyEmitted||(this.readyEmitted=!0,this.eventBus.emit("player:ready",void 0)))}wireLifecycleListeners(){this.listenersWired||(this.listenersWired=!0,this.eventBus.on("live:seektolive",()=>{this.destroyed||this.seekToLive()}),this.eventBus.on("media:load-request",async({src:e,autoplay:t})=>{this.stateManager.getValue("chromecastActive")||await this.load(e,{autoplay:t!==!1})}),this.eventBus.on("error:recovered",()=>{let e=this.pendingRecoveryAutoplay;!e||this.destroyed||(this.pendingRecoveryAutoplay=null,e.generation===this.loadGeneration&&(!e.shouldPlay||!this.stateManager.getValue("paused")||this.play().catch(t=>{this.logger.warn("Autoplay after recovery failed",{error:t?.message})})))}),this.eventBus.on("error:retry",async({src:e})=>{let t=this.stateManager.getValue("live"),n=this.stateManager.getValue("currentTime");await this.load(e),!this.destroyed&&(this.stateManager.getValue("error")||(t?this.seekToLive():n>0&&this.seek(n),!this.destroyed&&await this.play()))}))}async init(){this.checkDestroyed(),await this.ensureInitialized(),this.initialSrc&&!this.initialSrcLoaded&&(this.initialSrcLoaded=!0,await this.load(this.initialSrc))}async load(e,t){this.checkDestroyed(),this.initialSrcLoaded=!0;let n=++this.loadGeneration;this.requestedSource=e,this.pendingRecoveryAutoplay=null;let r=this.playbackCommands;try{if(this.logger.info("Loading source",{source:ee(e)}),this.stateManager.update({playing:!1,paused:!0,ended:!1,buffering:!0,currentTime:0,duration:0,bufferedAmount:0,playbackState:"loading",error:null,live:!1}),this._currentProvider){let l=this._currentProvider.id;this.logger.info("Destroying previous provider",{provider:l}),await this.waitForTeardown(this.pluginManager.destroyPlugin(l),l),this._currentProvider=null}if(this.providerTeardown&&await this.waitForTeardown(this.providerTeardown.promise,this.providerTeardown.providerId),await this.ensureInitialized(),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:ee(e)});return}let s=this.pluginManager.selectProvider(e);if(!s){this.errorHandler.throw("PROVIDER_NOT_FOUND",`No provider found for source: ${e}`,{fatal:!0,context:{source:e}});return}if(this._currentProvider=s,this.logger.info("Provider selected",{provider:s.id}),await this.pluginManager.initPlugin(s.id),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:ee(e)});return}if(this.stateManager.set("source",{src:e,type:this.detectMimeType(e)}),typeof s.loadSource=="function"&&await s.loadSource(e),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:ee(e)});return}(t?.autoplay??this.stateManager.getValue("autoplay"))&&await this.play()}catch(s){if(n===this.loadGeneration){let o=this.playbackCommands!==r;this.pendingRecoveryAutoplay={generation:n,shouldPlay:o?this.lastPlaybackCommand==="play":!!(t?.autoplay??this.stateManager.getValue("autoplay"))},this.stateManager.getValue("error")?this.logger.error("Load failed",{source:ee(e),error:s.message}):this.errorHandler.handle(s,{operation:"load",source:ee(e)})}}}async unload(){if(this.checkDestroyed(),this.pendingUnload&&this.pendingUnload.generation===this.loadGeneration)return this.pendingUnload.promise;let e=this._currentProvider,t=this.requestedSource;if(!e&&t===null&&!this.providerTeardown)return;let n=++this.loadGeneration;this.pendingRecoveryAutoplay=null;let r=this.runUnload(n,e,t),s={generation:n,promise:r};this.pendingUnload=s;try{await r}finally{this.pendingUnload===s&&(this.pendingUnload=null)}}async runUnload(e,t,n){if(this.logger.info("Unloading source"),this._currentProvider=null,this.requestedSource=null,this.seekingWhilePlaying=!1,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),t){let s=this.pluginManager.destroyPlugin(t.id).catch(l=>{this.logger.error("Error destroying provider during unload",{provider:t.id,error:l.message})}),o={promise:s,providerId:t.id};this.providerTeardown=o;try{await this.waitForTeardown(s,t.id)}finally{this.providerTeardown===o&&(this.providerTeardown=null)}}else this.providerTeardown&&await this.waitForTeardown(this.providerTeardown.promise,this.providerTeardown.providerId);if(e!==this.loadGeneration)return;let r=this.stateManager.getValue("lowLatencyMode");this.stateManager.update({source:null,playbackState:"idle",playing:!1,paused:!0,ended:!1,buffering:!1,waiting:!1,seeking:!1,currentTime:0,duration:0,buffered:null,bufferedAmount:0,error:null,mediaType:"unknown",qualities:[],currentQuality:null,audioTracks:[],currentAudioTrack:null,textTracks:[],currentTextTrack:null,live:!1,liveEdge:!1,seekableRange:null,liveLatency:0,lowLatencyMode:!1}),r&&this.eventBus.emit("live:lowlatency",{enabled:!1}),this.logger.info("Source unloaded"),this.eventBus.emit("source:unloaded",{src:n})}async waitForTeardown(e,t){let n,r,s=new Promise(o=>{r=o,n=setTimeout(()=>{this.logger.warn(`Provider teardown did not settle within ${zn} ms: its init() or destroy() is still pending; cutting it off and going ahead. A load() that needs this provider again still waits for it`,{provider:t}),this.isolateProvider(t),o()},zn)});this.teardownWaits.add(r);try{await Promise.race([e,s])}finally{clearTimeout(n),this.teardownWaits.delete(r)}}isolateProvider(e){if(this.pluginManager.abandonPlugin(e))for(let t of Array.from(this.container.querySelectorAll("video, audio"))){try{t.pause()}catch{}t.remove()}}async play(){this.checkDestroyed(),this.playbackCommands++,this.lastPlaybackCommand="play",this.pendingRecoveryAutoplay&&(this.pendingRecoveryAutoplay.shouldPlay=!0);try{this.logger.debug("Play requested"),this.eventBus.emit("playback:play",void 0)}catch(e){this.errorHandler.handle(e,{operation:"play"})}}pause(){this.checkDestroyed(),this.playbackCommands++,this.lastPlaybackCommand="pause",this.pendingRecoveryAutoplay&&(this.pendingRecoveryAutoplay.shouldPlay=!1);try{this.logger.debug("Pause requested"),this.seekingWhilePlaying=!1,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:pause",void 0)}catch(e){this.errorHandler.handle(e,{operation:"pause"})}}seek(e){if(this.checkDestroyed(),!Number.isFinite(e)){this.logger.warn("Invalid seek time",{time:e});return}try{this.logger.debug("Seek requested",{time:e}),this.stateManager.getValue("playing")&&(this.seekingWhilePlaying=!0),this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:seeking",{time:e}),this.stateManager.set("currentTime",e),this.seekingWhilePlaying&&(this.seekResumeTimeout=setTimeout(()=>{this.seekingWhilePlaying&&this.stateManager.getValue("playing")&&(this.logger.debug("Resuming playback after seek"),this.seekingWhilePlaying=!1,this.eventBus.emit("playback:play",void 0)),this.seekResumeTimeout=null},300))}catch(t){this.errorHandler.handle(t,{operation:"seek",time:e})}}setVolume(e){this.checkDestroyed();let t=Math.max(0,Math.min(1,e));this.stateManager.set("volume",t),this.eventBus.emit("volume:change",{volume:t,muted:this.stateManager.getValue("muted")})}setMuted(e){this.checkDestroyed(),this.stateManager.set("muted",e),this.eventBus.emit("volume:mute",{muted:e})}setPlaybackRate(e){this.checkDestroyed();let t=Math.max(.0625,Math.min(16,e));this.stateManager.set("playbackRate",t),this.eventBus.emit("playback:ratechange",{rate:t})}setAutoplay(e){this.checkDestroyed(),this.stateManager.set("autoplay",e),this.logger.debug("Autoplay set",{autoplay:e})}setPoster(e){this.checkDestroyed(),this.stateManager.set("poster",e),this.logger.debug("Poster set",{poster:ee(e)})}on(e,t){return this.checkDestroyed(),this.eventBus.on(e,t)}once(e,t){return this.checkDestroyed(),this.eventBus.once(e,t)}getPlugin(e){return this.checkDestroyed(),this.pluginManager.getPlugin(e)}registerPlugin(e){this.checkDestroyed(),this.pluginManager.register(e)}getState(){return this.checkDestroyed(),this.stateManager.snapshot()}subscribeToState(e){return this.checkDestroyed(),this.stateManager.subscribe(e)}getQualities(){if(this.checkDestroyed(),!this._currentProvider)return[];let e=this._currentProvider;return typeof e.getLevels=="function"?e.getLevels():[]}setQuality(e){if(this.checkDestroyed(),!this._currentProvider){this.logger.warn("No provider available for quality change");return}let t=this._currentProvider;if(typeof t.setLevel=="function"){if(e!==-1){let n=this.getQualities();if(n.length>0&&(e<0||e>=n.length)){this.logger.warn(`Invalid quality index: ${e} (available: ${n.length})`);return}}t.setLevel(e),this.eventBus.emit("quality:change",{quality:e===-1?"auto":`level-${e}`,auto:e===-1})}}getCurrentQuality(){if(this.checkDestroyed(),!this._currentProvider)return-1;let e=this._currentProvider;return typeof e.getCurrentLevel=="function"?e.getCurrentLevel():-1}wireFullscreenListeners(){let e=()=>{this.fullscreenAnnounced=!0,this.setFullscreenState(Ve(this.container))};document.addEventListener("fullscreenchange",e),document.addEventListener("webkitfullscreenchange",e),this.container.addEventListener("webkitbeginfullscreen",e,!0),this.container.addEventListener("webkitendfullscreen",e,!0),this.unwireFullscreen=()=>{document.removeEventListener("fullscreenchange",e),document.removeEventListener("webkitfullscreenchange",e),this.container.removeEventListener("webkitbeginfullscreen",e,!0),this.container.removeEventListener("webkitendfullscreen",e,!0)}}setFullscreenState(e){this.stateManager.getValue("fullscreen")!==e&&(this.stateManager.set("fullscreen",e),this.eventBus.emit("fullscreen:change",{fullscreen:e}))}async requestFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Ue(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!0),this.eventBus.emit("fullscreen:change",{fullscreen:!0}))}catch(e){this.logger.error("Fullscreen request failed",{error:e})}}async exitFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await ze(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!1),this.eventBus.emit("fullscreen:change",{fullscreen:!1}))}catch(e){this.logger.error("Exit fullscreen failed",{error:e})}}async toggleFullscreen(){this.fullscreen?await this.exitFullscreen():await this.requestFullscreen()}requestAirPlay(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.showPicker=="function"?e.showPicker():this.logger.warn("AirPlay plugin not available")}async requestChromecast(){this.checkDestroyed();let e=this.pluginManager.getPlugin("chromecast");e&&typeof e.requestSession=="function"?await e.requestSession():this.logger.warn("Chromecast plugin not available")}stopCasting(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.stop=="function"&&e.stop();let t=this.pluginManager.getPlugin("chromecast");t&&typeof t.stopSession=="function"&&t.stopSession()}seekToLive(){if(this.checkDestroyed(),!this.stateManager.getValue("live")){this.logger.warn("Not a live stream");return}if(this._currentProvider){let r=this._currentProvider;if(typeof r.getLiveInfo=="function"){let s=r.getLiveInfo();if(s?.liveSyncPosition!==void 0){this.seek(s.liveSyncPosition);return}}}let t=this.stateManager.getValue("seekableRange");if(t?.end!==void 0){this.seek(t.end);return}let n=this.stateManager.getValue("duration");Number.isFinite(n)&&n>0&&this.seek(n)}destroy(){return this.destroyPromise?this.destroyPromise:this.destroyed?Promise.resolve():(this.destroyPromise=(async()=>{this.logger.info("Destroying player"),this.destroyed=!0,this.loadGeneration++,this.pendingRecoveryAutoplay=null;for(let e of this.teardownWaits)e();this.teardownWaits.clear(),this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.unwireFullscreen?.(),this.unwireFullscreen=null,this.eventBus.emit("player:destroy",void 0);try{await this.pluginManager.destroyAll()}catch(e){this.logger.error("Error during plugin destruction",e)}this.eventBus.destroy(),this.stateManager.destroy(),this.logger.info("Player destroyed")})(),this.destroyPromise)}getDiagnostics(){return an({stateManager:this.stateManager,errorHandler:this.errorHandler,pluginManager:this.pluginManager,container:this.container,isDestroyed:this.destroyed,playerVersion:rn})}get playing(){return this.stateManager.getValue("playing")}get paused(){return this.stateManager.getValue("paused")}get currentTime(){return this.stateManager.getValue("currentTime")}get duration(){return this.stateManager.getValue("duration")}get volume(){return this.stateManager.getValue("volume")}get muted(){return this.stateManager.getValue("muted")}get playbackRate(){return this.stateManager.getValue("playbackRate")}get bufferedAmount(){return this.stateManager.getValue("bufferedAmount")}get currentProvider(){return this._currentProvider}get fullscreen(){return this.stateManager.getValue("fullscreen")}get live(){return this.stateManager.getValue("live")}get autoplay(){return this.stateManager.getValue("autoplay")}get poster(){return this.stateManager.getValue("poster")}checkDestroyed(){if(this.destroyed)throw new Error("Cannot call methods on destroyed player")}detectMimeType(e){let t=e;try{t=new URL(e).pathname}catch{let r=e.split("?")[0]??e;t=r.split("#")[0]??r}switch(t.split(".").pop()?.toLowerCase()??""){case"m3u8":return"application/x-mpegURL";case"mpd":return"application/dash+xml";case"mp4":case"m4v":return"video/mp4";case"webm":return"video/webm";case"ogg":case"ogv":return"video/ogg";case"mov":return"video/quicktime";case"mkv":return"video/x-matroska";case"mp3":return"audio/mpeg";case"wav":return"audio/wav";case"flac":return"audio/flac";case"aac":case"m4a":return"audio/mp4";default:return"video/mp4"}}};async function cn(i){let e=new Wt(i);return await e.init(),e}function un(i){return i<10?`0${i}`:`${i}`}function Le(i){if(!isFinite(i)||isNaN(i))return"0:00";let e=Math.abs(i),t=Math.floor(e/3600),n=Math.floor(e%3600/60),r=Math.floor(e%60),s=i<0?"-":"";return t>0?`${s}${t}:${un(n)}:${un(r)}`:`${s}${n}:${un(r)}`}function De(i){return!Number.isFinite(i)||i<=0?"LIVE":`-${Le(i)}`}var mt={play:"M8 5v14l11-7z",volumeHigh:"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",volumeMuted:"M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"};var Gt=new Map;function dn(i,e){if(typeof document>"u")return()=>{};let t=document.getElementById(i),n=Gt.get(i);(!n||!t)&&(n={generation:(n?.generation??0)+1,holders:0,element:t},Gt.set(i,n)),n.holders+=1;let{generation:r}=n;if(!t){let o=document.createElement("style");o.id=i,o.textContent=e,document.head.appendChild(o),n.element=o}let s=!1;return()=>{if(s)return;s=!0;let o=Gt.get(i);!o||o.generation!==r||(o.holders-=1,!(o.holders>0)&&(Gt.delete(i),o.element?.remove()))}}var pn={};Lr(pn,{createHlsInstance:()=>Jr,describeSupport:()=>Qr,getHlsConstructor:()=>Zr,isHLSSupported:()=>Gr,isHlsJsSupported:()=>$n,loadHlsJs:()=>Xr,resetLoader:()=>ei,supportsNativeHLS:()=>Kn});var he=null,et=null,Wr=["application/vnd.apple.mpegurl","application/x-mpegURL"];function Kn(){if(typeof document>"u")return!1;let i=document.createElement("video");return Wr.some(e=>i.canPlayType(e)!=="")}function $n(){return he?he.isSupported():typeof window>"u"?!1:!!(window.MediaSource||window.WebKitMediaSource)}function Gr(){return Kn()||$n()}function Qr(){let i=typeof document>"u"?null:document.createElement("video"),e=n=>i?i.canPlayType(n):"",t=typeof window>"u"?{}:window;return{canPlayType:{"application/vnd.apple.mpegurl":e("application/vnd.apple.mpegurl"),"application/x-mpegURL":e("application/x-mpegURL")},MediaSource:typeof t.MediaSource,ManagedMediaSource:typeof t.ManagedMediaSource,WebKitMediaSource:typeof t.WebKitMediaSource,hlsJsLoaded:he!==null,hlsJsSupported:he?he.isSupported():null,userAgent:typeof navigator>"u"?"":navigator.userAgent}}var jr=1e3;async function Yr(i){try{return await i()}catch{return await new Promise(e=>setTimeout(e,jr)),i()}}async function Xr(){return he||et||(et=(async()=>{try{if(he=(await Yr(()=>import("./hls-SXYGB37P.js"))).default,!he.isSupported())throw new Error("hls.js is not supported in this browser");return he}catch(i){throw et=null,new Error(`Failed to load hls.js: ${i instanceof Error?i.message:"Unknown error"}`)}})(),et)}function Jr(i){if(!he)throw new Error("hls.js is not loaded. Call loadHlsJs() first.");return new he(i)}function Zr(){return he}function ei(){he=null,et=null}function Ke(i){if(i.name)return i.name;if(i.height){let e={2160:"4K",1440:"1440p",1080:"1080p",720:"720p",480:"480p",360:"360p",240:"240p",144:"144p"},t=Object.keys(e).map(Number).sort((n,r)=>Math.abs(n-i.height)-Math.abs(r-i.height))[0];return Math.abs(t-i.height)<=20?e[t]:`${i.height}p`}return i.bitrate?ti(i.bitrate):"Unknown"}function ti(i){return i>=1e6?`${(i/1e6).toFixed(1)} Mbps`:i>=1e3?`${Math.round(i/1e3)} Kbps`:`${i} bps`}function qn(i,e){return i.map((t,n)=>({index:n,width:t.width||0,height:t.height||0,bitrate:t.bitrate||0,label:Ke(t),codec:t.codecSet}))}function Wn(i){if(i!==void 0&&i>0)return i;let t=navigator.connection;if(t?.downlink&&t.downlink>0){let n=t.downlink*1e6;return Math.round(n*.85)}return 5e5}function Te(i){return typeof i=="number"&&Number.isFinite(i)?i:null}function ni(i){if(!i)return null;let e=Te(i.fragmentStart)??Te(i.fragments?.[0]?.start)??0,t=Te(i.totalduration),n=Te(i.edge)??(t===null?null:e+t);return n===null?null:{start:e,end:n}}function Gn(i){let e=i?.seekable;if(!e||e.length===0)return null;let t=e.start(0),n=e.end(e.length-1);return!Number.isFinite(t)||!Number.isFinite(n)?null:{start:t,end:n}}function ri(i){if(!i)return null;let e=Te(i.targetduration);return Te(i.partHoldBack)??Te(i.holdBack)??(e!==null?e*3:null)}function ii(i,e){let t=Te(i?.targetduration),n=t!==null?t/2:e/2;return Math.max(1.5,Te(i?.partTarget)??n)}function $e(i){if(i.kind==="hls"){let{hls:o,details:l}=i,c=o.media,u=ni(l)??Gn(c),y=Te(o.targetLatency)??ri(l)??3,M=Te(o.latency)??(u&&c?Math.max(0,u.end-c.currentTime):null);if(M===null&&u===null)return null;let b=M??0;return{latency:b,targetLatency:y,atEdge:b<=y+ii(l,y),seekableRange:u,lowLatency:i.lowLatencyRequested!==!1&&(!!l?.partList?.length||l?.canBlockReload===!0)}}let{media:e}=i,t=Gn(e);if(!t)return null;let n=i.targetLatency??3,r=i.targetLatency===void 0?7:Math.max(1.5,i.targetLatency/2),s=Math.max(0,t.end-e.currentTime);return{latency:s,targetLatency:n,atEdge:s<=n+r,seekableRange:t,lowLatency:i.lowLatency===!0}}function hn(i,e){if(!e)return;let t=i.getState("liveLatency");Math.abs(t-e.latency)>.05&&(i.setState("liveLatency",e.latency),i.emit("live:latency",{latency:e.latency})),i.getState("liveEdge")!==e.atEdge&&(i.setState("liveEdge",e.atEdge),i.emit("live:edgechange",{atEdge:e.atEdge}));let n=e.seekableRange;if(n){let r=i.getState("seekableRange");(!r||Math.abs(r.start-n.start)>.05||Math.abs(r.end-n.end)>.05)&&(i.setState("seekableRange",{start:n.start,end:n.end}),i.emit("live:seekablerange",{start:n.start,end:n.end}))}i.getState("lowLatencyMode")!==e.lowLatency&&(i.setState("lowLatencyMode",e.lowLatency),i.emit("live:lowlatency",{enabled:e.lowLatency}))}function vt(i){i.getState("lowLatencyMode")&&(i.setState("lowLatencyMode",!1),i.emit("live:lowlatency",{enabled:!1})),i.setState("liveLatency",0),i.setState("liveEdge",!1),i.setState("seekableRange",null)}var gn={NETWORK_ERROR:"networkError",MEDIA_ERROR:"mediaError",KEY_SYSTEM_ERROR:"keySystemError",MUX_ERROR:"muxError",OTHER_ERROR:"otherError"};function si(i){switch(i){case gn.NETWORK_ERROR:return"network";case gn.MEDIA_ERROR:return"media";case gn.MUX_ERROR:return"mux";default:return"other"}}function oi(i){let e=i.frag,t=i.response,n=i.context;return{type:si(i.type),details:i.details||"Unknown error",fatal:i.fatal||!1,url:i.url??e?.url??t?.url??n?.url,reason:i.reason,response:i.response}}function ai(i){return`audio-${i}`}function jn(i){if(!i)return-1;let e=/^audio-(0|[1-9]\d*)$/.exec(i);return e?Number.parseInt(e[1],10):-1}function li(i,e,t){return{id:ai(e),label:i.name||i.lang||`Audio ${e+1}`,language:i.lang,active:t}}function Qn(i,e){if(!i||typeof i!="object")return null;let{type:t,stats:n}=i;if(t!=="main"&&t!=="audio"&&t!=="subtitle")return null;let r=n?.loading?.start,s=n?.loading?.end,o=n?.loaded;return typeof r!="number"||!Number.isFinite(r)||typeof s!="number"||!Number.isFinite(s)||s<r||typeof o!="number"||!Number.isFinite(o)||o<0?null:{durationMs:s-r,bytes:o,ok:e,kind:t}}function Yn(i,e,t){let n=[],r=(l,c)=>{i.on(l,c),n.push({event:l,handler:c})};r("hlsManifestParsed",(l,c)=>{e.logger.debug("HLS manifest parsed",{levels:c.levels.length});let u=c.levels.map((y,M)=>({id:`level-${M}`,label:Ke(y),width:y.width,height:y.height,bitrate:y.bitrate,active:M===i.currentLevel}));e.setState("qualities",u),e.emit("quality:levels",{levels:u.map(y=>({id:y.id,label:y.label}))}),t.onManifestParsed?.(c.levels,c)}),r("hlsLevelSwitched",(l,c)=>{let u=i.levels[c.level],y=t.getIsAutoQuality?.()??i.autoLevelEnabled;if(e.logger.debug("HLS level switched",{level:c.level,height:u?.height,auto:y}),u){let M=y?`Auto (${Ke(u)})`:Ke(u);e.setState("currentQuality",{id:y?"auto":`level-${c.level}`,label:M,width:u.width,height:u.height,bitrate:u.bitrate,active:!0})}e.emit("quality:change",{quality:u?`level-${c.level}`:"auto",auto:y}),t.onLevelSwitched?.(c.level)});let s=(l,c)=>{let u=l.map((y,M)=>li(y,M,M===c));e.setState("audioTracks",u),e.setState("currentAudioTrack",u[c]??null)};r("hlsAudioTracksUpdated",(l,c)=>{let u=c.audioTracks??[];e.logger.debug("HLS audio tracks updated",{tracks:u.length}),s(u,i.audioTrack),t.onAudioTracksUpdated?.(u)}),r("hlsAudioTrackSwitched",(l,c)=>{e.logger.debug("HLS audio track switched",{id:c.id}),s(i.audioTracks??[],c.id),t.onAudioTrackSwitched?.(c.id)});let o=0;return r("hlsFragLoaded",(l,c)=>{let u=Qn(c?.frag,!0);u&&e.emit("media:segment",u);let y=Date.now();y-o>=2e3&&i.bandwidthEstimate&&(o=y,e.setState("bandwidth",Math.round(i.bandwidthEstimate))),t.onFragLoaded?.()}),r("hlsFragBuffered",()=>{e.setState("buffering",!1),t.onBufferUpdate?.(),t.onFragBuffered?.()}),r("hlsFragLoading",()=>{e.setState("buffering",!0)}),r("hlsLevelLoaded",(l,c)=>{c.details&&t.onPlaylistDetails?.(c.details),c.details?.live!==void 0&&(e.setState("live",c.details.live),c.details.live?(t.onLevelDetails?.(c.details),hn(e,$e({kind:"hls",hls:i,details:c.details,lowLatencyRequested:t.isLowLatencyRequested?.()??!0}))):vt(e),t.onLiveUpdate?.())}),r("hlsError",(l,c)=>{let u=oi(c);if(!u.fatal&&(u.details==="fragLoadError"||u.details==="fragLoadTimeOut")){let M=Qn(c.frag,!1);M&&e.emit("media:segment",M)}!u.fatal&&(u.details?.includes("bufferStalledError")||c.reason?.includes("buffer holes"))?e.logger.debug(`HLS buffer recovery: ${u.reason||u.details}`,{details:u.details,reason:u.reason}):u.fatal?e.logger.error(`HLS fatal error: ${u.details} (type=${u.type})`,{type:u.type,details:u.details,status:u.response?.code,url:ee(u.url)}):e.logger.warn(`HLS error: ${u.details} (type=${u.type}, fatal=${u.fatal})`,{type:u.type,details:u.details,fatal:u.fatal,status:u.response?.code,url:ee(u.url)}),t.onError?.(u)}),()=>{for(let{event:l,handler:c}of n)i.off(l,c);n.length=0,e.setState("audioTracks",[]),e.setState("currentAudioTrack",null)}}function fn(i,e,t,n,r){let s=[],o=null,l=null,c=i.currentTime,u=(b,S)=>{let L=V=>{b==="timeupdate"&&i.currentTime!==c&&(c=i.currentTime,l=Date.now()),b!=="error"&&(o=b),S(V)};i.addEventListener(b,L),s.push({event:b,handler:L})},y=()=>{i.ended||!e.getState("ended")||(e.setState("ended",!1),e.setState("playbackState",i.paused?"paused":"playing"))};u("play",()=>{e.setState("paused",!1),y()}),u("playing",()=>{e.setState("playing",!0),e.setState("paused",!1),e.setState("waiting",!1),e.setState("buffering",!1),e.setState("playbackState","playing"),y(),n&&(n.corePauseRequested=!1),n?.corePlayRequested?n.corePlayRequested=!1:e.emit("playback:play",void 0)}),u("pause",()=>{e.setState("playing",!1),e.setState("paused",!0),e.setState("playbackState","paused"),n&&(n.corePlayRequested=!1),n?.corePauseRequested?n.corePauseRequested=!1:e.emit("playback:pause",void 0)}),u("ended",()=>{e.setState("playing",!1),e.setState("ended",!0),e.setState("playbackState","ended"),e.emit("playback:ended",void 0)}),u("timeupdate",()=>{e.setState("currentTime",i.currentTime),e.emit("playback:timeupdate",{currentTime:i.currentTime}),(e.getState("live")||!Number.isFinite(i.duration))&&hn(e,t?t():$e({kind:"media",media:i}))}),u("durationchange",()=>{let b=i.duration;Number.isNaN(b)?e.setState("duration",0):Number.isFinite(b)?(r?.native&&e.getState("live")===!0&&(e.setState("live",!1),vt(e),e.logger.info("Native live stream ended (finite duration)")),e.setState("duration",b||0)):(e.setState("live",!0),e.setState("duration",0)),e.emit("media:loadedmetadata",{duration:e.getState("duration")})}),u("waiting",()=>{e.setState("waiting",!0),e.setState("buffering",!0),e.emit("media:waiting",void 0)}),u("canplay",()=>{e.setState("waiting",!1),e.setState("playbackState","ready"),e.emit("media:canplay",void 0)}),u("canplaythrough",()=>{e.setState("buffering",!1),e.emit("media:canplaythrough",void 0)}),u("progress",()=>{if(i.buffered.length>0){let b=i.buffered.end(i.buffered.length-1),S=i.duration>0?b/i.duration:0;e.setState("bufferedAmount",S),e.setState("buffered",i.buffered),e.emit("media:progress",{buffered:S})}}),u("seeking",()=>{e.setState("currentTime",i.currentTime),e.setState("seeking",!0),y()}),u("seeked",()=>{e.setState("seeking",!1),e.emit("playback:seeked",{time:i.currentTime})}),u("volumechange",()=>{e.setState("volume",i.volume),e.setState("muted",i.muted),e.emit("volume:change",{volume:i.volume,muted:i.muted})}),u("ratechange",()=>{e.setState("playbackRate",i.playbackRate),e.emit("playback:ratechange",{rate:i.playbackRate})}),u("loadedmetadata",()=>{e.setState("duration",i.duration)}),u("error",()=>{let b=i.error;if(b){if(b.code===4&&i.networkState===3&&!i.currentSrc&&!i.getAttribute("src")){e.logger.debug("Video element released its source (not a playback error)",{code:b.code,readyState:i.readyState});return}let S=null;if(b.code===4&&i.readyState===0){let U=r?.reload?.()??null;if(U){if(!U.report){e.logger.info("Native reload failed (not reported)",{phase:U.phase,attempt:U.attempt,code:b.code,networkState:i.networkState,currentSrcSet:!!i.currentSrc,msSinceProgress:l===null?void 0:Date.now()-l,lastEvent:o??void 0,visibility:typeof document<"u"?document.visibilityState:void 0});return}S={reconnecting:!0,attempts:U.attempt}}}e.logger.error("Video element error",{code:b.code,message:b.message});let L=b.code===4?"Media source not supported":b.code===2?"Media network error":"Video playback error",V=new Error(b.message||L);typeof b.code=="number"&&b.code>0&&Object.assign(V,{code:b.code,detail:{mediaErrorCode:b.code,networkState:i.networkState,readyState:i.readyState,...S}}),e.emit("media:error",{error:V})}}),u("enterpictureinpicture",()=>{e.setState("pip",!0),e.logger.debug("PiP: entered (standard)")}),u("leavepictureinpicture",()=>{e.setState("pip",!1),e.logger.debug("PiP: exited (standard)"),(!i.paused||e.getState("playing"))&&i.play().catch(()=>{})});let M=i;if("webkitPresentationMode"in i){let b=M.webkitPresentationMode;u("webkitpresentationmodechanged",()=>{let S=M.webkitPresentationMode,L=b==="picture-in-picture"&&S==="inline";b=S;let V=S==="picture-in-picture";e.setState("pip",V),e.logger.debug(`PiP: mode changed to ${S} (webkit)`),L&&i.paused&&i.play().catch(()=>{})})}return()=>{for(let{event:b,handler:S}of s)i.removeEventListener(b,S);s.length=0}}var ci=["loadedmetadata","loadeddata","resize","playing"],ui=["addtrack","removetrack","change"];function mn(i){return typeof i=="object"&&i!==null&&typeof i.length=="number"}function Xn(i){let e=null,t=!1,n=!1,r=!1,s=null,o=[],l=null,c=!1,u=()=>t?"video":n?"audio":"unknown",y=()=>{let L=u();L!==l&&(l=L,i.setState("mediaType",L))},M=()=>{let L=s;if(!L)return;if(r&&L.videoWidth>0){t=!0;return}if(L.readyState<1)return;let V=L.videoTracks,U=L.audioTracks;if(mn(V)){if(V.length>0){t=!0;return}mn(U)&&U.length>0&&(n=!0)}},b=()=>{c||(M(),y())},S=()=>{for(let L of o)L();o=[],s=null};return{beginSource(L){c||e!==L&&(e=L,t=!1,n=!1,r=!1,l=null,y())},attach(L){if(!c){S(),s=L,r=!1;for(let V of ci){let U=()=>{r=!0,b()};L.addEventListener(V,U),o.push(()=>L.removeEventListener(V,U))}for(let V of[s.videoTracks,s.audioTracks])if(!(!mn(V)||typeof V.addEventListener!="function"))for(let U of ui){let ce=()=>b();V.addEventListener(U,ce),o.push(()=>V.removeEventListener?.(U,ce))}b()}},noteManifestParsed(L){if(c||!L)return;let V=typeof L.video=="boolean"?L.video:null,U=typeof L.audio=="boolean"?L.audio:null;V===!0?t=!0:V===!1&&U===!0&&(n=!0),y()},evaluate:b,current(){return u()},destroy(){c||(c=!0,S())}}}var vn="Invalid playlist document",di=["level","audioTrack","subtitleTrack"];function pi(i,e){if(typeof i!="string"||i.length===0)return!1;let t=i.trimStart();return t.startsWith("#EXTM3U")?e&&di.includes(e)?/^#EXT(?:INF|-X-TARGETDURATION):/m.test(t):!0:!1}function Jn(i){let e=i.DefaultConfig.loader;return class extends e{load(n,r,s){let o={...s,onSuccess:(l,c,u,y)=>{if(!pi(l?.data,u?.type)){s.onError({code:0,text:vn},u,y,c);return}s.onSuccess(l,c,u,y)}};super.load(n,r,o)}}}var Zn=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";function hi(i){let e=`'${i.canPlayType["application/vnd.apple.mpegurl"]}'/'${i.canPlayType["application/x-mpegURL"]}'`,t=i.hlsJsLoaded?`isSupported ${String(i.hlsJsSupported)}`:"not loaded";return[`native: ${e}`,`MediaSource: ${i.MediaSource}`,`ManagedMediaSource: ${i.ManagedMediaSource}`,`WebKitMediaSource: ${i.WebKitMediaSource}`,`hls.js: ${t}`].join(", ")}var gi={debug:!1,autoStartLoad:!0,startPosition:-1,lowLatencyMode:!1,maxBufferLength:30,maxMaxBufferLength:600,backBufferLength:30,enableWorker:!0,capLevelToPlayerSize:!0,maxNetworkRetries:3,maxMediaRetries:2,retryDelayMs:1e3,retryBackoffFactor:2,loadTimeoutMs:3e4,autoReconnect:!0,reconnectBaseDelayMs:2e3,reconnectMaxDelayMs:3e4,reconnectWindowMs:3e5,stallTimeoutMs:12e4,validatePlaylists:!0},fi=1.1,mi=["manifestLoadError","manifestLoadTimeOut","manifestParsingError"],tt="Video took too long to load (network timeout)";function er(i){return{type:"network",details:tt,fatal:!0,timedOut:!0,attempts:i}}function tr(i,e){let t=i?.code,r={type:(e==="initial"?t!==MediaError.MEDIA_ERR_DECODE:t===MediaError.MEDIA_ERR_NETWORK)?"network":"media",details:i?.message||(e==="initial"?"Failed to load HLS source":"Native HLS playback error"),fatal:!0};return typeof t=="number"&&t>0&&(r.mediaErrorCode=t),i?.message&&(r.mediaErrorMessage=i.message),r}function nr(i,e,t){let n={...gi,...t},r=null,s=null,o=null,l=!1,c=null,u=null,y=null,M=!0,b={corePlayRequested:!1,corePauseRequested:!1},S=null,L=null,V=null,U=null,ce=null,x=0,z=null,Y=null,K=0,$=0,h=null,B=0,q=0,C=10,se=5e3,ue=!1,P=null,_=0,D=0,W=0,re=null,ge=null,pe=!1,be=!1,fe=!1,oe=null,ve=0,Ce=0,Re=null,xe=0,Ee=0,qe=0,it=15e3,Ie=!1,_e=()=>{let a=s&&!l?$e({kind:"hls",hls:s,details:L,lowLatencyRequested:n.lowLatencyMode===!0}):o?$e({kind:"media",media:o,targetLatency:U??void 0,lowLatency:V?.lowLatency}):null;return a&&(V=a,s&&!l&&(U=a.targetLatency)),a},Zt=()=>o?.seekable?.length?o.seekable.end(o.seekable.length-1):void 0,We=(a,d)=>{if(s&&!l&&typeof s.liveSyncPosition=="number")return s.liveSyncPosition;let g=Zt()??a?.seekableRange?.end;return g!==void 0?Math.max(0,g-d):void 0},Ft=a=>{if(!o)return a;if(r?.getState("live")){let d=_e(),g=(s&&!l?s.targetLatency:void 0)||d?.targetLatency||3,v=d?.seekableRange?.start??0,m=We(d,g);if(m!==void 0)return Math.max(v,Math.min(a,Math.max(v,m)));let w=o.duration,A=Number.isFinite(w)&&w>0?w:a;return Math.max(v,Math.min(a,A))}return Math.max(0,Math.min(a,o.duration||0))},Bt=()=>{if(!o||!l||!r?.getState("live"))return;let a=o,d=["canplay","progress","durationchange"],g=()=>{for(let w of d)a.removeEventListener(w,v);a.removeEventListener("seeking",g)},v=()=>{if(a.seeking||r?.getState("seeking")){g();return}let w=_e();if(!w||(g(),w.atEdge))return;let A=We(w,w.targetLatency??3);if(A===void 0)return;let N=a.seekable.start(a.seekable.length-1);a.currentTime=Math.max(N,Ft(A))};for(let w of d)a.addEventListener(w,v);a.addEventListener("seeking",g);let m=y;y=()=>{g(),m?.()},v()},st=()=>{o&&(o.poster=r?.getState("poster")||"")},ot=()=>{if(o)return o;let a=r?.container.querySelector("video");return a?(o=a,o):(o=document.createElement("video"),o.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",o.preload="metadata",o.controls=!1,o.playsInline=!0,st(),r?.container.appendChild(o),o)},Ae=a=>{Y?.(a??new Error("HLS load cancelled")),Y=null,u?.(),u=null,y?.(),y=null,h&&(clearTimeout(h),h=null),oe&&(clearTimeout(oe),oe=null),s&&(s.destroy(),s=null)},Ge=a=>{Ae(a),c=null,l=!1,M=!0,K=0,$=0,B=0,q=0,Ie=!1,L=null,V=null,U=null,ce=null,r&&vt(r)},Vt=()=>{if(!o||!r)return;let a=r.getState("muted"),d=r.getState("volume");a!==void 0&&(o.muted=a),d!==void 0&&(o.volume=d)},Qe=(a,d,g,v)=>{a.done||a.session!==d||(d===x?g?a.reject(v):a.resolve(d):g&&!a.takenOver?a.reject(v):a.resolve(null))},Pe=(a,d,g)=>{g.then(()=>Qe(a,d,!1,void 0),v=>Qe(a,d,!0,v))},en=(a,d)=>new Promise((v,m)=>{let w={session:a,takenOver:!1,done:!1,resolve:A=>{w.done=!0,z===w&&(z=null),v(A)},reject:A=>{w.done=!0,z===w&&(z=null),m(A)}};z=w,Pe(w,a,d)}),we=a=>{let d=z;z=null,!(!d||d.done)&&(d.takenOver?d.resolve(null):d.reject(a))},at=(a,d)=>{let g=z;!g||g.done||(g.session=a,g.takenOver=!0,Pe(g,a,d))},Ne=()=>{let a=je();if(n.validatePlaylists!==!1){let d=i.getHlsConstructor();d&&d.DefaultConfig?.loader&&(a.pLoader=Jn(d))}return a},Ut=()=>{let a={},d=(G,X)=>{X!==void 0&&(a[G]=X)},g=n.liveSyncDuration,v=n.liveSyncDurationCount,m=n.liveMaxLatencyDuration,w=n.liveMaxLatencyDurationCount,A=(g!==void 0||m!==void 0)&&(v!==void 0||w!==void 0),N=A&&g!==void 0,I=A&&!N;return A&&r?.logger.warn(`Ignoring ${N?"liveSyncDurationCount/liveMaxLatencyDurationCount":"liveSyncDuration/liveMaxLatencyDuration"}: hls.js rejects a config mixing seconds-based and count-based live latency options`),d("liveSyncDuration",I?void 0:g),d("liveSyncDurationCount",N?void 0:v),d("liveMaxLatencyDuration",I?void 0:m),d("liveMaxLatencyDurationCount",N?void 0:w),d("liveDurationInfinity",n.liveDurationInfinity),d("maxLiveSyncPlaybackRate",n.maxLiveSyncPlaybackRate??(n.lowLatencyMode===!0?fi:void 0)),a},je=()=>({debug:n.debug,autoStartLoad:n.autoStartLoad,startPosition:n.startPosition,startLevel:-1,abrEwmaDefaultEstimate:Wn(n.initialBandwidthEstimate),lowLatencyMode:n.lowLatencyMode,maxBufferLength:n.maxBufferLength,maxMaxBufferLength:n.maxMaxBufferLength,backBufferLength:n.backBufferLength,enableWorker:n.enableWorker,capLevelToPlayerSize:n.capLevelToPlayerSize,fragLoadingMaxRetry:1,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:1,fragLoadingRetryDelay:500,manifestLoadingRetryDelay:500,levelLoadingRetryDelay:500,...Ut()}),me=a=>{let d=n.retryDelayMs??1e3,g=n.retryBackoffFactor??2;return d*Math.pow(g,a)*(.7+Math.random()*.3)},tn=["bufferAppendError","bufferAppendingError","bufferAddCodecError"],lt=a=>{if(a.response?.text===vn)return"PLAYLIST_INVALID";if(a.details==="bufferFullError")return"MEDIA_BUFFER_FULL";if(tn.includes(a.details))return"MEDIA_APPEND_ERROR";switch(a.type){case"network":return"MEDIA_NETWORK_ERROR";case"media":case"mux":return"MEDIA_DECODE_ERROR";default:return"PLAYBACK_FAILED"}},nn=(a,d)=>{let g=a.attempts??(a.type==="network"?K:a.type==="media"||a.type==="mux"?$:0),v={type:a.type,retriesExhausted:d,attempts:g};a.mediaErrorCode!==void 0&&(v.mediaErrorCode=a.mediaErrorCode),a.mediaErrorMessage!==void 0&&(v.mediaErrorMessage=a.mediaErrorMessage),a.timedOut&&(v.timedOut=!0),typeof a.response?.code=="number"&&a.response.code>0&&(v.httpStatus=a.response.code);let m=ee(a.url);return m&&(v.url=m),v},Me=(a,d,g)=>{let v=x,m=g??(d?`HLS error: ${a.details} (max retries exceeded)`:`HLS error: ${a.details}`);r?.logger.error(m,{type:a.type,details:a.details}),r?.setState("playbackState","error"),r?.setState("buffering",!1);let w=nn(a,d);An(a)&&!pe&&(w.reconnecting=!0),r?.emit("error",{code:lt(a),message:m,fatal:!0,timestamp:Date.now(),detail:w}),v===x&&Cn(a)},Oe=()=>{h&&(clearTimeout(h),h=null)},p=a=>{if(!i.getHlsConstructor()||!s)return!1;if(a.fatal){let g=Date.now();if(g-q>se?(B=1,q=g):B++,B>=C)return r?.logger.error(`Too many fatal errors (${B} in ${se}ms), giving up`),Oe(),Me(a,!0),Ae(new Error(a.details)),!0;switch(r?.logger.error("Fatal HLS error",{type:a.type,details:a.details}),a.type){case"network":{let v=n.maxNetworkRetries??3;if(K>=v)return r?.logger.error(`Network error recovery failed after ${K} attempts`),Oe(),Me(a,!0),!0;K++;let m=me(K-1);r?.logger.info(`Attempting network error recovery (attempt ${K}/${v}) in ${m}ms`),r?.emit("error:network",{error:new Error(a.details)}),h&&clearTimeout(h);let w=mi.includes(a.details),A=x;h=setTimeout(()=>{A!==x||!s||(w&&c?s.loadSource(c):s.startLoad())},m);break}case"media":case"mux":{let v=n.maxMediaRetries??2;if($>=v)return r?.logger.error(`Media error recovery failed after ${$} attempts`),Oe(),Me(a,!0),!0;$++;let m=me($-1);r?.logger.info(`Attempting media error recovery (attempt ${$}/${v}) in ${m}ms`),r?.emit("error:media",{error:new Error(a.details)}),h&&clearTimeout(h);let w=x;h=setTimeout(()=>{w!==x||!s||s.recoverMediaError()},m);break}default:return Oe(),Me(a,!1),!0}}return!1},f=(a,d)=>{let g=a.type==="network",v=g?n.maxNetworkRetries??3:n.maxMediaRetries??2,m=g?K:$;if(!c||m>=v){Me(a,m>=v);return}let w=d??o?.currentTime??0;g?K++:$++;let A=m+1,N=me(A-1);r?.logger.info(`Attempting native ${a.type} error recovery (attempt ${A}/${v}) in ${N}ms`),r?.emit(g?"error:network":"error:media",{error:new Error(a.details)}),h&&clearTimeout(h);let I=x;h=setTimeout(()=>{I===x&&F(a,w)},N)},F=async(a,d)=>{if(!c)return;let g=++x,v=c,m=r?.getState("live")??!1;try{if(Ae(new Error("HLS load cancelled: native error recovery")),r?.setState("playbackState","loading"),await R(v,!1,{phase:"recovery",attempt:K+$}),g!==x)return;m?Bt():o&&d>0&&(o.currentTime=d),r?.setState("playbackState","ready"),r?.setState("buffering",!1);try{await o?.play()}catch(w){r?.logger.info("Native error recovery: resume refused; waiting for the viewer",{reason:w?.name})}}catch{if(g!==x)return;r?.logger.warn("Native error recovery attempt failed"),f(a,d)}},R=async(a,d=!1,g)=>{let v=x,m=ot();l=!0;let w=g!==void 0;return r&&(y=fn(m,r,_e,b,{native:!0,reload:()=>{if(!g||!w)return null;let A=!Ie;return Ie=!0,{phase:g.phase,attempt:g.attempt,report:A}}})),S?.beginSource(a),S?.attach(m),new Promise((A,N)=>{let I=null,G=!1,X=null,ae=()=>{G=!0,w=!1,Y===O&&(Y=null),m.removeEventListener("loadedmetadata",le),m.removeEventListener("error",Q),I!==null&&(clearTimeout(I),I=null)},O=Z=>{G||(ae(),N(Z))};Y=O;let le=()=>{if(G)return;if(v!==x){ae(),N(new Error("HLS load cancelled"));return}ae(),ue=!0,Ie=!1,d&&(K=0,$=0);let Z=()=>{f(tr(m.error,"playback"))};m.addEventListener("error",Z);let ke=()=>{(K>0||$>0)&&(r?.logger.debug("Native playback recovered, resetting retry budgets"),K=0,$=0)};m.addEventListener("playing",ke);let Ye=()=>{m.removeEventListener("error",Z),m.removeEventListener("playing",ke)},Se=y;y=()=>{Ye(),Se?.()},r?.setState("source",{src:a,type:"application/x-mpegURL"}),r?.emit("media:loaded",{src:a,type:"application/x-mpegURL"}),A()},Q=()=>{if(G)return;if(!d||v!==x){ae(),N(new Error(m.error?.message||"Failed to load HLS source"));return}let Z=tr(m.error,"initial");X=Z;let ke=Z.type==="network",Ye=ke?n.maxNetworkRetries??3:n.maxMediaRetries??2,Se=ke?K:$;if(Se>=Ye){ae(),r?.logger.error(`Native HLS load failed after ${Se} ${Z.type} retries`,{src:ee(a)}),Me(Z,!0),N(new Error(Z.details));return}ke?K++:$++;let Xe=me(Se);r?.logger.info(`Retrying native HLS load after ${Z.type} error (attempt ${Se+1}/${Ye}) in ${Xe}ms`),r?.emit(ke?"error:network":"error:media",{error:new Error(Z.details)}),h&&clearTimeout(h),h=setTimeout(()=>{h=null,!(G||v!==x)&&(m.src=a,m.load())},Xe)},J=n.loadTimeoutMs??3e4;J>0&&(I=setTimeout(()=>{if(G||v!==x)return;if(ae(),!d){N(new Error(tt));return}r?.logger.error(`Native HLS load timed out after ${J}ms`,{src:ee(a)});let Z=er(K+$);Ae(),m.removeAttribute("src"),m.load(),X?.mediaErrorCode!==void 0&&(Z.mediaErrorCode=X.mediaErrorCode),X?.mediaErrorMessage!==void 0&&(Z.mediaErrorMessage=X.mediaErrorMessage),Me(Z,!1,tt),N(new Error(tt))},J)),m.addEventListener("loadedmetadata",le),m.addEventListener("error",Q),m.src=a,m.load()})},k=async a=>{let d=x;if(await i.loadHlsJs(),d!==x)throw new Error("HLS load cancelled");let g=ot();return l=!1,s=i.createHlsInstance(Ne()),r&&(y=fn(g,r,_e,b)),S?.beginSource(a),S?.attach(g),new Promise((v,m)=>{if(!s||!r){m(new Error("HLS not initialized"));return}let w=!1,A=null,N=()=>{A!==null&&(clearTimeout(A),A=null)},I=Q=>{w||(w=!0,N(),m(Q))};Y=I;let G=()=>{Y===I&&(Y=null)};u=Yn(s,r,{onManifestParsed:(Q,J)=>{d===x&&(S?.noteManifestParsed(J),w||(w=!0,G(),N(),ue=!0,r?.setState("source",{src:a,type:"application/x-mpegURL"}),r?.emit("media:loaded",{src:a,type:"application/x-mpegURL"}),v()))},onLevelSwitched:()=>{},onLevelDetails:Q=>{d===x&&(L=Q,_e())},onPlaylistDetails:Q=>{if(d!==x)return;let J=Q.fragmentStart??Q.fragments?.[0]?.start??0;ce=Number.isFinite(J)?J:null},isLowLatencyRequested:()=>n.lowLatencyMode===!0,onError:Q=>{if(d!==x)return;p(Q)&&!w&&(w=!0,G(),N(),m(new Error(Q.details)))},onFragLoaded:()=>{d===x&&K>0&&(r?.logger.debug("Fragment loaded, resetting network retry budget"),K=0)},onFragBuffered:()=>{d===x&&$>0&&(r?.logger.debug("Fragment buffered, resetting media retry budget"),$=0)},getIsAutoQuality:()=>M});let X=s,ae=(Q,J)=>{if(d!==x||s!==X||!r||J?.fatal!==!1||J.details!=="fragLoadError"&&J.details!=="fragLoadTimeOut")return;let Z=J.frag?.type,ke=J.frag?.stats?.loading?.start,Ye=J.frag?.stats?.loading?.end,Se=J.frag?.stats?.loaded;if(Z!=="main"&&Z!=="audio"&&Z!=="subtitle"||typeof ke!="number"||!Number.isFinite(ke)||Ye!==0||typeof Se!="number"||!Number.isFinite(Se)||Se<0)return;let Xe=performance.now()-ke;!Number.isFinite(Xe)||Xe<0||r.emit("media:segment",{kind:Z,durationMs:Xe,bytes:Se,ok:!1})};X.on("hlsError",ae);let O=u;u=()=>{X.off("hlsError",ae),O?.()};let le=n.loadTimeoutMs??3e4;le>0&&(A=setTimeout(()=>{w||d!==x||(w=!0,G(),r?.logger.error(`HLS load timed out after ${le}ms`,{src:ee(a)}),Me(er(K),!1,tt),d===x&&Ae(),m(new Error(tt)))},le)),s.attachMedia(g),s.loadSource(a)})},H=(a=!1)=>{a||ye(),P&&(clearTimeout(P),P=null),_=0,D=0,W=0,ge=null,pe=!1,be=!1,Ie=!1},de=()=>!(typeof document<"u"&&document.hidden||typeof navigator<"u"&&navigator.onLine===!1),ye=()=>{Re&&(clearTimeout(Re),Re=null),xe=0},Fe=()=>{if(Re=null,!r||xe===0)return;if(r.getState("paused")||!de()){xe=0;return}let a=Date.now()-xe,d=n.stallTimeoutMs??0;if(a-d>2*it){r.logger.info("Stall ceiling ran late; page was suspended, restarting the clock",{elapsedMs:Math.round(a)}),xe=Date.now(),Re=setTimeout(Fe,d);return}r.logger.warn(`Playback stalled for ${Math.round(a/1e3)}s, giving up`),Pn(),P&&(clearTimeout(P),P=null),x++,Ae(new Error("HLS load cancelled: playback stalled")),be=!1,xe=0,Mn(a,n.stallTimeoutMs??0,!0)},xn=()=>{if(!o||oe)return;ve=Date.now(),Ce=o.currentTime,Ee=0;let a=s?.targetDuration??s?.levels?.[s?.currentLevel]?.details?.targetduration??0,d=Math.max(15,4*(a||0)||15),g=Math.min(d*1e3,3e4);it=g,qe=Date.now();let v=()=>{if(!o||!r)return;let m=Date.now(),w=m-qe,A=w>2*g;if(qe=m,A){r.logger.info("Stall check ran late; page was suspended, not stalled",{sinceLastCheckMs:Math.round(w)}),ve=m,Ce=o.currentTime,Ee=0,oe=setTimeout(v,g);return}let N=r.getState("playing"),I=r.getState("seeking"),G=!1;if(N&&I&&de()?(Ee===0&&(Ee=Date.now()),G=Date.now()-Ee>=d*1e3):Ee=0,!N||I&&!G||!de()){ve=Date.now(),Ce=o.currentTime,oe=setTimeout(v,g);return}let X=G?Date.now()-Ee:Date.now()-ve,ae=o.currentTime-Ce;if(!G&&ae>.5)ve=Date.now(),Ce=o.currentTime,ye();else if(G||X>d*1e3){r.logger.warn("Playback stall detected \u2014 no timeupdate progress",{elapsed:Math.round(X),currentTime:o.currentTime,targetDuration:Math.round(d)});let O=n.stallTimeoutMs??0;O>0&&xe===0&&(xe=Date.now(),Re=setTimeout(Fe,O)),Ee=0,Cn({type:"network",details:"Playback stalled \u2014 no data received",fatal:!0});return}oe=setTimeout(v,g)};oe=setTimeout(v,g)},Pn=()=>{oe&&(clearTimeout(oe),oe=null)},Mn=(a,d,g=!1)=>{if(pe)return;pe=!0;let v=_,m=ge;r?.emit("error:reconnect-exhausted",{attempts:v,elapsedMs:a,windowMs:d}),r?.setState("playbackState","error"),r?.setState("buffering",!1),r?.emit("error",{code:g?"MEDIA_NETWORK_ERROR":m?lt(m):"PLAYBACK_FAILED",message:g?`Playback stalled for ${Math.round(a/1e3)}s and did not recover`:`HLS auto-reconnect gave up after ${v} attempts over ${Math.round(a/1e3)}s`,fatal:!0,timestamp:Date.now(),detail:{type:m?.type??(g?"network":"other"),retriesExhausted:!0,attempts:v,reconnectExhausted:!0,...g?{stalled:!0}:{}}})},_n=()=>{if(pe||P)return;let a=x,d=(r?.getState("live")??!1)&&fe,g=n.reconnectWindowMs??3e5,v=d?1/0:g,m=Date.now()-D;if(m>v){r?.logger.warn(`Auto-reconnect window exhausted after ${_} attempts`),Mn(m,v);return}if(d&&m>6e5&&(r?.emit("error:reconnecting",{attempt:_+1,delayMs:0,elapsedMs:m,windowMs:v,longOutage:!0}),a!==x))return;let A=n.reconnectBaseDelayMs??2e3,N=n.reconnectMaxDelayMs??3e4,I=Math.min(A*Math.pow(2,_),N),G=I>=N,X=d&&G?3e4:Math.round(I*(.7+Math.random()*.3));r?.logger.info(`Scheduling auto-reconnect attempt ${_+1} in ${X}ms`),r?.emit("error:reconnecting",{attempt:_+1,delayMs:X,elapsedMs:m,windowMs:v}),a===x&&(P=setTimeout(()=>{P=null,Rn()},X))},An=a=>{if(n.autoReconnect===!1||!c)return!1;let d=(r?.getState("live")??!1)&&fe,g=ge?.timedOut===!0;return!d&&!ue&&!a.timedOut&&!g?!1:a.type==="network"||a.type==="media"||a.type==="mux"},Cn=a=>{An(a)&&(D===0&&(D=Date.now(),W=o?.currentTime??0,ge=a),_n())},Rn=async()=>{if(!r||!c)return;be=!0;let a=++x;_++;let d=c,g=r.getState("live"),v=l,m=W;r.logger.info(`Auto-reconnect attempt ${_}`,{src:ee(d)});try{if(Ae(new Error("HLS load cancelled: reconnecting")),K=0,$=0,B=0,q=0,c=d,r.setState("playbackState","loading"),v&&i.supportsNativeHLS()?await R(d,!1,{phase:"reconnect",attempt:_}):await k(d),a!==x)return;g?Bt():o&&m>0&&(o.currentTime=m),Vt(),r.setState("playbackState","ready"),r.setState("buffering",!1),r.emit("error:recovered",{attempt:_,elapsedMs:Date.now()-D}),r.logger.info("Auto-reconnect succeeded"),H(!0);let w=r.getState("paused");if(r.getState("playing")&&xn(),w)r.logger.info("Stream reconnected while paused; maintaining pause at live edge");else try{await o?.play()}catch(A){r.logger.info("Auto-reconnect: resume refused; waiting for the viewer",{reason:A?.name})}}catch{if(a!==x)return;r?.logger.warn(`Auto-reconnect attempt ${_} failed`),_n()}finally{be=!1}};return{id:"hls-provider",name:e.name,version:Zn,type:"provider",description:e.description,canPlay(a){let d=a.toLowerCase();return!!(d.split("?")[0].split("#")[0].endsWith(".m3u8")||d.includes("application/x-mpegurl")||d.includes("application/vnd.apple.mpegurl"))},async init(a){r=a,r.logger.info(`HLS plugin${e.logSuffix} initialized`),S=Xn(r);let d=r.on("playback:play",async()=>{if(o&&o.paused)try{b.corePlayRequested=!0,await o.play()}catch(O){b.corePlayRequested=!1,O?.name==="NotAllowedError"?(r?.logger.info("Play blocked by the autoplay policy; waiting for the viewer"),r?.emit("playback:blocked",{reason:"autoplay",name:"NotAllowedError"})):r?.logger.warn("Play failed",O)}}),g=r.on("playback:pause",()=>{if(o){if(o.paused){b.corePlayRequested&&(b.corePlayRequested=!1,o.pause());return}b.corePauseRequested=!0,b.corePlayRequested=!1,o.pause()}}),v=r.on("playback:seeking",({time:O})=>{o&&Number.isFinite(O)&&(o.currentTime=Ft(O))}),m=r.on("volume:change",({volume:O})=>{o&&(o.volume=O)}),w=r.on("volume:mute",({muted:O})=>{o&&(o.muted=O)}),A=r.on("playback:ratechange",({rate:O})=>{o&&(o.playbackRate=O)}),N=r.on("quality:select",({quality:O,auto:le})=>{if(!s||l){r?.logger.warn("Quality selection not available");return}if(le||O==="auto")M=!0,s.currentLevel=-1,r?.logger.debug("Quality: auto selection enabled"),r?.setState("currentQuality",{id:"auto",label:"Auto",width:0,height:0,bitrate:0,active:!0});else{M=!1;let Q=parseInt(O.replace("level-",""),10);if(!isNaN(Q)&&Q>=0&&Q<s.levels.length){s.nextLevel=Q,r?.logger.debug(`Quality: queued switch to level ${Q}`);let J=s.levels[Q];if(J){let Z=Ke(J);r?.setState("currentQuality",{id:`level-${Q}`,label:`${Z}...`,width:J.width,height:J.height,bitrate:J.bitrate,active:!1})}}}}),I=r.on("track:audio",({trackId:O})=>{if(!s||l){r?.logger.warn("Audio track selection not available");return}let le=jn(O),Q=s.audioTracks??[];if(le<0||le>=Q.length){r?.logger.warn("Ignoring unknown audio track selection",{trackId:O});return}s.audioTrack=le,r?.logger.debug(`Audio: queued switch to track ${le}`)});typeof window<"u"&&(re=()=>{(P!==null||D>0||be||_>0&&!pe)&&(P&&(r?.logger.info("Browser back online, reconnecting immediately"),clearTimeout(P),P=null),Rn())},window.addEventListener("online",re));let G=r.subscribeToState(O=>{O.key==="poster"&&st()}),X=r.subscribeToState(O=>{O.key==="live"&&(fe=!0)});r.onDestroy(()=>{d(),g(),v(),m(),w(),A(),N(),I(),G(),X()});let ae=r.subscribeToState(O=>{O.key==="playing"&&(O.value?xn():Pn())});r.onDestroy(ae)},async destroy(){r?.logger.info(`HLS plugin${e.logSuffix} destroying`),x++,H(),re&&typeof window<"u"&&(window.removeEventListener("online",re),re=null);let a=new Error("HLS load cancelled: player destroyed");we(a),Ge(a),S?.destroy(),S=null,o?.parentNode&&o.parentNode.removeChild(o),o=null,r=null},async loadSource(a){if(!r)throw new Error("Plugin not initialized");r.logger.info(`Loading HLS source${e.logSuffix}`,{src:ee(a)});let d=++x;H(),ue=!1,fe=!1,r.setState("live",!1);let g=new Error("HLS load cancelled: superseded by a new load");we(g),Ge(g),c=a,b.corePlayRequested=!1,b.corePauseRequested=!1,st(),r.setState("playbackState","loading"),r.setState("buffering",!0);let v;if(r.getState("airplayActive")&&i.supportsNativeHLS())r.logger.info("Using native HLS (AirPlay active)"),v=R(a,!0);else if(i.isHlsJsSupported())r.logger.info(`Using ${e.engineLabel} for HLS playback`),v=k(a);else if(i.supportsNativeHLS())r.logger.info("Using native HLS playback (hls.js not supported)"),v=R(a,!0);else{let w=i.describeSupport(),A=`HLS playback not supported in this browser (${hi(w)})`;throw r.setState("playbackState","error"),r.setState("buffering",!1),r.emit("error",{code:"SOURCE_NOT_SUPPORTED",message:A,fatal:!0,timestamp:Date.now(),context:{probes:w}}),new Error(A)}let m=await en(d,v);m===null||m!==x||!r||(Vt(),r.setState("playbackState","ready"),r.setState("buffering",!1))},getCurrentLevel(){return l||!s?-1:s.currentLevel},setLevel(a){if(l||!s){r?.logger.warn("Quality selection not available in native HLS mode");return}s.currentLevel=a},getLevels(){return l||!s?[]:qn(s.levels,s.currentLevel)},getHlsInstance(){return s},isNativeHLS(){return l},getLiveInfo(){if(!(r?.getState("live")||!1))return null;let d=_e();if(l){let v=d?.targetLatency??3;return{isLive:!0,latency:d?.latency??0,targetLatency:v,drift:0,liveSyncPosition:We(d,v),lowLatency:d?.lowLatency??!1}}if(!s)return null;let g=s.targetLatency||d?.targetLatency||3;return{isLive:!0,latency:s.latency||0,targetLatency:g,drift:s.drift||0,liveSyncPosition:We(d,g),lowLatency:d?.lowLatency??!1}},async switchToNative(){if(l){r?.logger.debug("Already using native HLS");return}if(!i.supportsNativeHLS()){r?.logger.warn("Native HLS not supported in this browser");return}if(!c){r?.logger.warn("No source loaded");return}r?.logger.info("Switching to native HLS for AirPlay");let a=r?.getState("playing")||!1,d=o?.currentTime||0,g=c,v=U,m=z!==null,w=++x;H(),Ge(new Error("HLS load cancelled: switching to native HLS")),c=g,U=v;let A=R(g,m,m?void 0:{phase:"switch",attempt:1});if(at(w,A),await A,w===x){if(o&&d>0&&(o.currentTime=d),a&&o)try{await o.play()}catch(N){r?.logger.info("Could not auto-resume after switch",{reason:N?.name})}r?.logger.info("Switched to native HLS")}},async switchToHlsJs(){if(!l){r?.logger.debug("Already using hls.js");return}if(!i.isHlsJsSupported()){r?.logger.warn("hls.js not supported in this browser");return}if(!c){r?.logger.warn("No source loaded");return}r?.logger.info("Switching back to hls.js");let a=r?.getState("playing")||!1,d=o?.currentTime||0,g=c,v=U,m=++x;H(),Ge(new Error("HLS load cancelled: switching to hls.js")),c=g,U=v;let w=k(g);if(at(m,w),await w,m===x){if(o&&d>0&&(o.currentTime=d),a&&o)try{await o.play()}catch(A){r?.logger.info("Could not auto-resume after switch",{reason:A?.name})}r?.logger.info("Switched to hls.js")}},getPlaylistStart(){return l?null:ce},getDiagnostics(){let a=l?"native":s?"hls.js":null,d=null,g=null;if(s&&typeof s.currentLevel=="number"&&(d=s.currentLevel,s.levels&&d>=0&&s.levels[d])){let I=s.levels[d];g={},typeof I.bitrate=="number"&&Number.isFinite(I.bitrate)&&(g.bitrate=I.bitrate),typeof I.width=="number"&&Number.isFinite(I.width)&&(g.width=I.width),typeof I.height=="number"&&Number.isFinite(I.height)&&(g.height=I.height)}let v=null;if(s&&typeof s.bandwidthEstimate=="number"&&Number.isFinite(s.bandwidthEstimate))v=Math.round(s.bandwidthEstimate);else if(r){let I=r.getState("bandwidth");typeof I=="number"&&Number.isFinite(I)&&I>0&&(v=Math.round(I))}let m=r?!!r.getState("live"):!1,w=r?!!r.getState("lowLatencyMode"):!1,A=I=>{if(!I)return[];let G=[],X=Math.min(I.length,32);for(let ae=0;ae<X;ae++)try{let O=I.start(ae),le=I.end(ae);Number.isFinite(O)&&Number.isFinite(le)&&G.push({start:O,end:le})}catch{}return G},N=o??r?.container?.querySelector("video");return{engine:a,selectedLevel:d,quality:g,bandwidthEstimate:v,live:m,lowLatency:w,retryCount:(K||0)+($||0),networkRetryCount:K||0,mediaRetryCount:$||0,reconnectAttempts:_||0,isReconnecting:!!be,readyState:N?N.readyState:null,networkState:N?N.networkState:null,buffered:A(N?N.buffered:null),seekable:A(N?N.seekable:null)}}}}function rr(i){return nr(pn,{name:"HLS Provider",description:"HLS playback provider using hls.js",logSuffix:"",engineLabel:"hls.js"},i)}var ir=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var vi=["mp4","webm","mov","mkv","ogv","m4v"],sr=["mp3","wav","ogg","flac","aac","m4a","opus","weba"],yi=[...vi,...sr],Qt={ABORTED:1,NETWORK:2,DECODE:3,SRC_NOT_SUPPORTED:4},bi={mp4:"video/mp4",m4v:"video/mp4",webm:"video/webm",mov:"video/quicktime",mkv:"video/x-matroska",ogv:"video/ogg",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",flac:"audio/flac",aac:"audio/aac",m4a:"audio/mp4",opus:"audio/opus",weba:"audio/webm"};function or(i){let e=i?.preload??"metadata",t=i?.loadTimeoutMs??3e4,n=null,r=null,s=null,o=null,l=!1,c=!1,u=!1,y=0,M=null,b=!1,S=h=>{try{return new URL(h,window.location.href).pathname.split(".").pop()?.toLowerCase()??""}catch{return(h.split(".").pop()?.toLowerCase()??"").split("?")[0]??""}},L=h=>bi[h]||"video/mp4",V=h=>sr.includes(h),U=h=>{let C=(h.startsWith("audio/")?document.createElement("audio"):document.createElement("video")).canPlayType(h);return C==="probably"||C==="maybe"},ce=()=>{if(r){if(l){r.poster="";return}r.poster=n?.getState("poster")||""}},x=()=>{if(r)return r;let h=n?.container.querySelector("video");return h?(r=h,r):(r=document.createElement("video"),r.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",r.preload=e,r.controls=!1,r.playsInline=!0,ce(),n?.container.appendChild(r),r)},z=h=>{switch(h?.code){case Qt.ABORTED:return{code:"PLAYBACK_FAILED",message:"Playback aborted"};case Qt.NETWORK:return{code:"MEDIA_NETWORK_ERROR",message:"Network error"};case Qt.DECODE:return{code:"MEDIA_DECODE_ERROR",message:"Decode error - format may not be supported"};case Qt.SRC_NOT_SUPPORTED:return b?{code:"MEDIA_NETWORK_ERROR",message:"Network error"}:{code:"SOURCE_LOAD_FAILED",message:"Format not supported"};default:return{code:"PLAYBACK_FAILED",message:"Unknown video error"}}},Y=h=>{let B=[],q=y,C=(P,_)=>{let D=W=>{q===y&&_(W)};h.addEventListener(P,D),B.push([P,D])},se=()=>{h.ended||!n?.getState("ended")||(n?.setState("ended",!1),n?.setState("playbackState",h.paused?"paused":"playing"))};C("play",()=>{n?.setState("paused",!1),se()}),C("playing",()=>{n?.setState("playing",!0),n?.setState("paused",!1),n?.setState("playbackState","playing"),se(),u=!1,c?c=!1:n?.emit("playback:play",void 0)}),C("pause",()=>{c=!1,n?.setState("playing",!1),n?.setState("paused",!0),n?.setState("playbackState","paused"),u?u=!1:n?.emit("playback:pause",void 0)}),C("ended",()=>{n?.setState("playing",!1),n?.setState("ended",!0),n?.setState("playbackState","ended"),n?.emit("playback:ended",void 0)}),C("timeupdate",()=>{n?.setState("currentTime",h.currentTime),n?.emit("playback:timeupdate",{currentTime:h.currentTime})}),C("durationchange",()=>{n?.setState("duration",h.duration||0)}),C("loadedmetadata",()=>{n?.setState("duration",h.duration||0),n?.emit("media:loadedmetadata",{duration:h.duration||0})}),C("canplay",()=>{n?.setState("buffering",!1),n?.emit("media:canplay",void 0)}),C("canplaythrough",()=>{n?.emit("media:canplaythrough",void 0)}),C("waiting",()=>{n?.setState("buffering",!0),n?.emit("media:waiting",void 0)}),C("progress",()=>{if(h.buffered.length>0){let P=h.buffered.end(h.buffered.length-1),_=h.duration||0,D=_>0?P/_:0;n?.setState("bufferedAmount",D),n?.emit("media:progress",{buffered:D})}}),C("seeking",()=>{n?.setState("currentTime",h.currentTime),n?.setState("seeking",!0),se()}),C("seeked",()=>{n?.setState("seeking",!1),n?.emit("playback:seeked",{time:h.currentTime})}),C("volumechange",()=>{n?.setState("volume",h.volume),n?.setState("muted",h.muted),n?.emit("volume:change",{volume:h.volume,muted:h.muted})}),C("ratechange",()=>{n?.setState("playbackRate",h.playbackRate),n?.emit("playback:ratechange",{rate:h.playbackRate})}),C("stalled",()=>{n?.setState("buffering",!0),n?.emit("media:stalled",void 0),n?.logger.warn("Media stalled - network may be slow")}),C("suspend",()=>{n?.emit("media:suspend",void 0)}),C("abort",()=>{n?.emit("media:abort",void 0)}),C("error",()=>{let P=h.error,{code:_,message:D}=z(P);n?.logger.error("Video error",{mediaErrorCode:P?.code,code:_,message:D}),n?.setState("playbackState","error"),n?.setState("buffering",!1);let W={networkState:h.networkState,readyState:h.readyState};typeof P?.code=="number"&&(W.mediaErrorCode=P.code),n?.emit("error",{code:_,message:D,fatal:!0,timestamp:Date.now(),detail:W})}),C("enterpictureinpicture",()=>{n?.setState("pip",!0),n?.logger.debug("PiP: entered (standard)")}),C("leavepictureinpicture",()=>{n?.setState("pip",!1),n?.logger.debug("PiP: exited (standard)"),(!h.paused||n?.getState("playing"))&&h.play().catch(()=>{})});let ue=h;if("webkitPresentationMode"in h){let P=ue.webkitPresentationMode;C("webkitpresentationmodechanged",()=>{let _=ue.webkitPresentationMode,D=P==="picture-in-picture"&&_==="inline";P=_,n?.setState("pip",_==="picture-in-picture"),n?.logger.debug(`PiP: mode changed to ${_} (webkit)`),D&&h.paused&&h.play().catch(()=>{})})}return()=>{B.forEach(([P,_])=>{h.removeEventListener(P,_)})}},K=()=>{s?.(),s=null,c=!1,u=!1,r&&(r.pause(),r.removeAttribute("src"),r.load())};return{id:"native-provider",name:"Native Media Provider",version:ir,type:"provider",description:"Native HTML5 playback for video (MP4, WebM, MOV) and audio (MP3, WAV, FLAC, AAC)",canPlay(h){let B=S(h);if(!yi.includes(B))return!1;let q=L(B);return U(q)},async init(h){n=h,n.logger.info("Native video plugin initialized");let B=n.on("playback:play",async()=>{if(!n?.getState("chromecastActive")&&r&&r.paused)try{c=!0,await r.play()}catch(D){c=!1,n?.logger.error("Play failed",D)}}),q=n.on("playback:pause",()=>{if(!n?.getState("chromecastActive")&&r){if(r.paused){c&&(c=!1,r.pause());return}u=!0,c=!1,r.pause()}}),C=n.on("playback:seeking",({time:D})=>{if(n?.getState("chromecastActive")||!r||!Number.isFinite(D))return;let W=Math.max(0,Math.min(D,r.duration||0));r.currentTime=W}),se=n.on("volume:change",({volume:D,muted:W})=>{r&&(r.volume=D,r.muted=W)}),ue=n.on("volume:mute",({muted:D})=>{r&&(r.muted=D)}),P=n.on("playback:ratechange",({rate:D})=>{r&&(r.playbackRate=D)}),_=n.subscribeToState(D=>{D.key==="poster"&&ce()});n.onDestroy(()=>{B(),q(),C(),se(),ue(),P(),_()})},async destroy(){n?.logger.info("Native video plugin destroying"),y++;let h=M;M=null,h?.(new Error("Player destroyed during load")),K(),r?.parentNode&&r.parentNode.removeChild(r),r=null,n=null,o=null,l=!1,b=!1},async loadSource(h){if(!n)throw new Error("Plugin not initialized");let B=S(h),q=L(B),C=V(B);l=C,n.logger.info("Loading native media source",{src:ee(h),mimeType:q,isAudio:C});let se=++y,ue=M;if(M=null,ue?.(new Error("Load superseded by a newer source")),b=!1,K(),n.setState("playbackState","loading"),n.setState("buffering",!0),n.setState("mediaType",C?"audio":"video"),C){let _=n.getState("title");if(!_||_===o)try{let W=new URL(h,window.location.href).pathname.split("/").pop()||"Audio",re=decodeURIComponent(W.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));o=re,n.setState("title",re)}catch{o="Audio",n.setState("title","Audio")}}n.setState("qualities",[]),n.setState("currentQuality",null);let P=x();return P.style.display=C?"none":"block",ce(),s=Y(P),new Promise((_,D)=>{let W=null,re=()=>{P.removeEventListener("loadedmetadata",pe),P.removeEventListener("error",be),W!==null&&(clearTimeout(W),W=null),M===ge&&(M=null)},ge=fe=>{re(),D(fe)};M=ge;let pe=()=>{if(se!==y)return;re(),b=!0;let fe=n?.getState("muted"),oe=n?.getState("volume");fe!==void 0&&(P.muted=fe),oe!==void 0&&(P.volume=oe),n?.setState("source",{src:h,type:q}),n?.setState("playbackState","ready"),n?.setState("buffering",!1),n?.emit("media:loaded",{src:h,type:q}),_()},be=()=>{if(se!==y)return;re();let fe=P.error;D(new Error(fe?.message||"Failed to load video source"))};t>0&&(W=setTimeout(()=>{se===y&&(re(),n?.setState("playbackState","error"),n?.setState("buffering",!1),D(new Error("Video took too long to load (network timeout)")))},t)),P.addEventListener("loadedmetadata",pe),P.addEventListener("error",be),P.src=h,P.load()})},getDiagnostics(){let h=r??n?.container?.querySelector("video"),B=C=>{if(!C)return[];let se=[],ue=Math.min(C.length,32);for(let P=0;P<ue;P++)try{let _=C.start(P),D=C.end(P);Number.isFinite(_)&&Number.isFinite(D)&&se.push({start:_,end:D})}catch{}return se},q=null;return h&&h.videoWidth>0&&h.videoHeight>0&&(q={width:h.videoWidth,height:h.videoHeight}),{readyState:h?h.readyState:null,networkState:h?h.networkState:null,dimensions:q,buffered:B(h?h.buffered:null),seekable:B(h?h.seekable:null)}}}}var ar={"bandwidth-indicator":{rank:0,exit:"hide"},"skip-backward":{rank:1,exit:"overflow"},"skip-forward":{rank:1,exit:"overflow"},pip:{rank:2,exit:"overflow"},"keyboard-help":{rank:3,exit:"overflow"},chromecast:{rank:4,exit:"overflow"},airplay:{rank:4,exit:"overflow"},volume:{rank:5,exit:"overflow"},captions:{rank:6,exit:"overflow"},quality:{rank:6,exit:"hide"},time:{rank:7,exit:"hide"},play:{rank:"never",exit:"overflow"},"live-indicator":{rank:"never",exit:"overflow"},settings:{rank:"never",exit:"overflow"},fullscreen:{rank:"never",exit:"overflow"},spacer:{rank:"never",exit:"overflow"}};function jt(i,e){return i.map(t=>{let n=ar[t],r=e?.[t]??n?.rank??3;return{id:t,rank:r,exit:n?.exit??"overflow"}})}function yn(i,e){if(!i.includes("quality")||i.includes("settings"))return;let[t]=jt(["quality"],e);if(t.rank!=="never")throw new Error(`uiPlugin: a layout with "quality" needs "settings" as well. The quality control hides when the bar does not fit, and the settings menu is where its Quality row lives. Add "settings" to controls, pin quality with priority: { quality: 'never' }, or set responsive: false.`)}function Ei(i,e,t,n){let r=i.reduce((l,c)=>l+c,0),s=e*Math.max(0,i.length-1),o=n?t+e:0;return r+s+o}function bn(i,e,t,n){let r=i.map(u=>u.id);if(e<=0)return{inBar:r,overflow:[],hidden:[]};let o=[...i.filter(u=>u.visible&&u.width>0)],l=new Set,c=new Set;for(;Ei(o.map(u=>u.width),t,n,l.size>0)>e;){let u=-1;for(let M=0;M<o.length;M++){let b=o[M];b.rank!=="never"&&(u===-1||b.rank<=o[u].rank)&&(u=M)}if(u===-1)break;let[y]=o.splice(u,1);(y.exit==="hide"?c:l).add(y.id)}return{inBar:r.filter(u=>!l.has(u)&&!c.has(u)),overflow:r.filter(u=>l.has(u)),hidden:r.filter(u=>c.has(u))}}var En=`
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
   Keyboard Help Dialog
   ============================================ */

/* The dialog itself is a scrim over the whole player, rendered inside the
   player's container (never portalled to document.body) so container-scoped
   themes and the player's focus scoping keep applying to it. Above every
   other layer: menus sit at 20 and the error overlay at 25, and help must
   cover both. */
.sp-kbd-help {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

/* Bounded to the player's box so a short or narrow player still shows a
   usable dialog: the body below is the part that scrolls, and everything
   else stays pinned. */
.sp-kbd-help__panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: min(320px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.sp-kbd-help__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sp-kbd-help__title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.sp-kbd-help__close {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.sp-kbd-help__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.sp-kbd-help__close:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.sp-kbd-help__close svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

/* The bounded scrollable body: the list scrolls inside the panel while the
   header and its close button stay reachable. */
.sp-kbd-help__body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 16px 12px;
}

.sp-kbd-help__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.sp-kbd-help__keys {
  white-space: nowrap;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.sp-kbd-help__action {
  text-align: right;
}

.sp-kbd-help__notes {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sp-kbd-help__note {
  margin: 0 0 4px;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.55);
}

.sp-kbd-help__note:last-child {
  margin-bottom: 0;
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
`;var T={play:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${mt.play}"/></svg>`,pause:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',replay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',volumeHigh:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${mt.volumeHigh}"/></svg>`,volumeLow:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',volumeMute:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${mt.volumeMuted}"/></svg>`,fullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',exitFullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',pip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>',exitPip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 9h6v2H9z"/></svg>',settings:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',chromecast:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',chromecastConnected:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',airplay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 22h12l-6-6-6 6zM21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V5h18v12h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',captions:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>',captionsOff:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 5.5v13h-15v-13h15zM19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>',checkmark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',chevronUp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>',more:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',chevronDown:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>',close:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',keyboardHelp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>',spinner:'<svg viewBox="0 0 24 24" fill="currentColor" class="sp-spin"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',skipForward:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',skipBack:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',forward10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',replay10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',error:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'};function E(i,e,t){let n=document.createElement(i);if(e)for(let[r,s]of Object.entries(e))r==="className"?n.className=s:n.setAttribute(r,s);if(t)for(let r of t)typeof r=="string"?n.appendChild(document.createTextNode(r)):n.appendChild(r);return n}function ne(i,e,t){let n=E("button",{className:`sp-control ${i}`,"aria-label":e,type:"button"});return ie(n,t),n}function j(i){return i.querySelector("video")}function bt(i){for(;i.firstChild;)i.removeChild(i.firstChild)}var lr=new WeakMap;function ie(i,e){return lr.get(i)===e?!1:(i.innerHTML=e,lr.set(i,e),!0)}function te(i,e,t){return i.getAttribute(e)===t?!1:(i.setAttribute(e,t),!0)}function Yt(i,e){if(e.duration===1/0){let s=i.getState("source");return s&&i.emit("media:load-request",{src:s.src,autoplay:!0}),null}let t=i.getPlugin("hls-provider")?.getPlaylistStart?.(),n=e.seekable,r=typeof t=="number"&&Number.isFinite(t)&&t>=0&&t<e.duration?t:n&&n.length>0?n.start(0):0;return e.currentTime=r,r}var Et=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=ne("sp-play","Play",T.play),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("playing"),t=this.api.getState("ended"),n,r;t?(n=T.replay,r="Replay"):e?(n=T.pause,r="Pause"):(n=T.play,r="Play"),ie(this.el,n),te(this.el,"aria-label",r)}toggle(){let e=j(this.api.container);if(!e)return;if(this.api.getState("ended")){let n=Yt(this.api,e);if(n===null)return;this.api.emit("playback:seeking",{time:n}),e.play().catch(()=>{})}else e.paused?e.play().catch(()=>{}):e.pause()}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var wt=class{constructor(e,t){this.hasStarted=!1;this.lastSource=void 0;this.clickHandler=()=>{this.start()};this.api=e,this.hasOverlayProbe=typeof t=="function",this.isOverlayVisible=t??(()=>!1);let n=document.createElement("button");n.className="sp-big-play",n.setAttribute("type","button"),n.setAttribute("aria-label","Play"),ie(n,T.play),n.addEventListener("click",this.clickHandler),this.el=n}render(){return this.el}update(){let e=this.api.getState("playing"),t=j(this.api.container),n=this.hasEnded(t),r=this.api.getState("currentTime"),s=this.api.getState("playbackState"),o=this.api.getState("error"),l=this.api.getState("source");l!==this.lastSource&&(this.lastSource=l,this.hasStarted=!1),e&&(this.hasStarted=!0);let c;(this.hasOverlayProbe?this.isOverlayVisible():o)||s==="loading"||e||t&&!t.paused?c=!1:n?c=!0:this.hasStarted||r!==0?c=!1:c=s==="idle"||s==="ready",ie(this.el,n?T.replay:T.play),te(this.el,"aria-label",n?"Replay":"Play"),this.el.classList.toggle("sp-big-play--visible",c)}hasEnded(e){return e?e.ended:!!this.api.getState("ended")}start(){let e=j(this.api.container);e&&(e.ended&&Yt(this.api,e)===null||e.play().catch(()=>{}))}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var kt=class{constructor(){this.config=null;this.loaded=!1;this.el=E("div",{className:"sp-thumbnail-preview"}),this.img=E("div",{className:"sp-thumbnail-preview__img"}),this.el.appendChild(this.img)}getElement(){return this.el}setConfig(e){if(this.config=e,this.loaded=!1,e){this.img.style.width=`${e.width}px`,this.img.style.height=`${e.height}px`,this.el.style.width=`${e.width}px`,this.el.style.height=`${e.height}px`;let t=new Image;t.onload=()=>{this.loaded=!0},t.onerror=()=>{this.config=null,this.loaded=!1},t.src=e.src}}show(e,t){if(!this.config||!this.loaded){this.el.style.display="none";return}let{src:n,width:r,height:s,columns:o,interval:l}=this.config,c=Math.floor(e/l),u=c%o,y=Math.floor(c/o);this.img.style.backgroundImage=`url(${n})`,this.img.style.backgroundPosition=`-${u*r}px -${y*s}px`,this.img.style.backgroundSize=`${o*r}px auto`,this.img.style.width=`${r}px`,this.img.style.height=`${s}px`,this.el.style.left=`${t*100}%`,this.el.style.display=""}hide(){this.el.style.display="none"}isConfigured(){return this.config!==null}destroy(){this.el.remove()}};var wi=new WeakMap,wn=new WeakMap;function cr(i,e){wn.set(i,e);let t=wi.get(i);return t&&e.setFactory(t.factory),()=>{wn.get(i)===e&&wn.delete(i)}}var ki=new Set(["ArrowLeft","ArrowRight","Home","End"]),St=class{constructor(e,t={}){this.isDragging=!1;this.lastSeekTime=0;this.seekThrottleMs=100;this.wasPlayingBeforeDrag=!1;this.renderedChapters=null;this.renderedDuration=0;this.extension=null;this.detachTimelineHost=null;this.extensionDragging=!1;this.extensionEditing=!1;this.onMouseDown=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=j(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.clientX,!0)};this.onDocMouseMove=e=>{this.isDragging&&(this.seek(e.clientX),this.updateVisualPosition(e.clientX))};this.onMouseUp=e=>{if(this.isDragging&&(this.seek(e.clientX,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag)){let t=j(this.api.container);if(t&&t.paused){let n=()=>{t.removeEventListener("seeked",n),t.play().catch(()=>{})};t.addEventListener("seeked",n)}}};this.onTouchStart=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=j(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.touches[0].clientX,!0)};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.seek(e.touches[0].clientX),this.updateVisualPosition(e.touches[0].clientX))};this.onTouchEnd=e=>{if(this.isDragging){let t=e.changedTouches?.[0]?.clientX;if(t!==void 0&&this.seek(t,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag){let n=j(this.api.container);if(n&&n.paused){let r=()=>{n.removeEventListener("seeked",r),n.play().catch(()=>{})};n.addEventListener("seeked",r)}}this.tooltip.style.opacity="",this.thumbnailPreview.hide()}};this.onMouseMove=e=>{this.isExtensionInput(e)||this.updateTooltip(e.clientX)};this.onMouseLeave=()=>{this.isDragging||(this.tooltip.style.opacity="",this.thumbnailPreview.hide())};this.onKeyDown=e=>{let t=j(this.api.container);if(t&&ki.has(e.key)){this.extension?.onSeekStart();try{this.applyKeyboardSeek(e,t)}finally{this.extension?.onSeekEnd()}}};this.api=e,this.options=t,this.wrapper=E("div",{className:"sp-progress-wrapper"}),this.el=E("div",{className:"sp-progress"});let n=E("div",{className:"sp-progress__track"});this.buffered=E("div",{className:"sp-progress__buffered"}),this.filled=E("div",{className:"sp-progress__filled"}),this.markers=E("div",{className:"sp-progress__markers"}),this.handle=E("div",{className:"sp-progress__handle"}),this.tooltip=E("div",{className:"sp-progress__tooltip"}),this.tooltip.textContent="0:00",this.thumbnailPreview=new kt,n.appendChild(this.buffered),n.appendChild(this.filled),n.appendChild(this.markers),n.appendChild(this.handle),this.el.appendChild(n),this.el.appendChild(this.thumbnailPreview.getElement()),this.el.appendChild(this.tooltip),this.wrapper.appendChild(this.el),this.extensionLayer=E("div",{className:"sp-progress__extension"}),this.wrapper.appendChild(this.extensionLayer),this.el.setAttribute("role","slider"),this.el.setAttribute("aria-label","Seek"),this.el.setAttribute("aria-valuemin","0"),this.el.setAttribute("aria-valuemax","0"),this.el.setAttribute("aria-valuenow","0"),this.el.setAttribute("aria-valuetext","0:00"),this.el.setAttribute("tabindex","0"),this.wrapper.addEventListener("mousedown",this.onMouseDown),this.wrapper.addEventListener("mousemove",this.onMouseMove),this.wrapper.addEventListener("mouseleave",this.onMouseLeave),this.wrapper.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.el.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd),this.detachTimelineHost=cr(this.api.container,{setFactory:r=>this.mountExtension(r)})}mountExtension(e){if(this.extension&&(this.extension.destroy(),this.extension=null,this.setExtensionDragging(!1),this.setExtensionEditing(!1),bt(this.extensionLayer)),!e)return;let t={element:this.extensionLayer,getRailRect:()=>this.el.getBoundingClientRect(),setEditing:n=>this.setExtensionEditing(n),setDragging:n=>this.setExtensionDragging(n)};this.extension=e(t),this.extension.update()}isTimelineEditing(){return this.extensionEditing}setExtensionEditing(e){this.extensionEditing!==e&&(this.extensionEditing=e,this.wrapper.classList.toggle("sp-progress-wrapper--editing",e),e&&this.show(),this.options.onEditingChange?.(e))}setExtensionDragging(e){this.extensionDragging!==e&&(this.extensionDragging=e,this.wrapper.classList.toggle("sp-progress-wrapper--ext-dragging",e),e?(this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.tooltip.style.opacity="0",this.thumbnailPreview.hide()):this.tooltip.style.opacity="")}isExtensionInput(e){if(this.extensionDragging)return!0;let t=e.target;return t instanceof Node&&this.extensionLayer.contains(t)}render(){return this.wrapper}show(){this.wrapper.classList.add("sp-progress-wrapper--visible")}hide(){this.wrapper.classList.remove("sp-progress-wrapper--visible")}setThumbnails(e){this.thumbnailPreview.setConfig(e)}update(){let e=this.api.getState("currentTime")||0,t=this.api.getState("duration")||0,n=this.api.getState("buffered"),r=this.api.getState("live"),s=this.api.getState("seekableRange"),o=this.api.getState("thumbnails");if(o&&!this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.setConfig(o),this.el.classList.toggle("sp-progress--live",!!r),this.updateMarkers(t,r,s),r&&s){let l=s.end-s.start;if(l>0){let c=(e-s.start)/l*100;this.filled.style.width=`${Math.max(0,Math.min(100,c))}%`,this.handle.style.left=`${Math.max(0,Math.min(100,c))}%`}if(n&&n.length>0){let c=s.end-s.start;if(c>0){let y=(n.end(n.length-1)-s.start)/c*100;this.buffered.style.width=`${Math.max(0,Math.min(100,y))}%`}}this.el.setAttribute("aria-valuemax",String(Math.floor(s.end))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",`${Math.floor(s.end-e)} seconds behind live`)}else if(t>0){let l=e/t*100;if(this.filled.style.width=`${l}%`,this.handle.style.left=`${l}%`,n&&n.length>0){let u=n.end(n.length-1)/t*100;this.buffered.style.width=`${u}%`}this.el.setAttribute("aria-valuemax",String(Math.floor(t))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",Le(e))}this.extension?.update()}chapterLabelAt(e){let t=this.api.getState("chapters")??[];for(let n=t.length-1;n>=0;n--){let r=t[n];if(e<r.time)continue;let s=t[n+1],o=r.endTime??(s?s.time:1/0);return e<o?r.label:null}return null}updateMarkers(e,t,n){let r=this.api.getState("chapters")??[],s=t?n?n.end-n.start:0:e;if(r.length===0||s<=0){this.renderedChapters!==null&&(this.markers.textContent="",this.renderedChapters=null,this.renderedDuration=0);return}if(r===this.renderedChapters&&s===this.renderedDuration)return;let o=t&&n?n.start:0;this.markers.textContent="";for(let l of r){if(l.time<=o)continue;let c=(l.time-o)/s*100;if(c<=0||c>=100)continue;let u=E("div",{className:"sp-progress__marker"});u.style.left=`${c}%`,u.title=l.label,this.markers.appendChild(u)}this.renderedChapters=r,this.renderedDuration=s}getTimeFromPosition(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width)),r=this.api.getState("live"),s=this.api.getState("seekableRange");if(r&&s){let c=s.end-s.start,u=s.start+n*c;return Number.isFinite(u)?u:null}let o=this.api.getState("duration")||0,l=n*o;return Number.isFinite(l)?l:null}updateTooltip(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width)),r=this.getTimeFromPosition(e)??0,s=this.api.getState("live"),o=this.api.getState("seekableRange");if(s&&o){let c=o.end-r;this.tooltip.textContent=De(c)}else this.tooltip.textContent=Le(r);let l=this.chapterLabelAt(r);if(l){let c=E("span",{className:"sp-progress__tooltip-chapter"});c.textContent=l,this.tooltip.appendChild(c)}this.tooltip.style.left=`${n*100}%`,this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.show(r,n)}updateVisualPosition(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width));this.filled.style.width=`${n*100}%`,this.handle.style.left=`${n*100}%`}applyKeyboardSeek(e,t){let r=this.api.getState("live"),s=this.api.getState("seekableRange");if(r&&s)switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(s.start,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(s.end,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=s.start;break;case"End":e.preventDefault(),t.currentTime=s.end;break}else{let o=this.api.getState("duration")||0;switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(0,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(o,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=0;break;case"End":e.preventDefault(),t.currentTime=o;break}}this.api.emit("playback:seeking",{time:t.currentTime})}seek(e,t=!1){let n=j(this.api.container);if(!n)return;let r=Date.now();if(!t&&this.isDragging&&r-this.lastSeekTime<this.seekThrottleMs)return;this.lastSeekTime=r;let s=this.getTimeFromPosition(e);s!==null&&Number.isFinite(s)&&(n.currentTime=s,t&&this.api.emit("playback:seeking",{time:s}))}destroy(){this.detachTimelineHost?.(),this.detachTimelineHost=null,this.extension?.destroy(),this.extension=null,this.wrapper.removeEventListener("mousedown",this.onMouseDown),this.wrapper.removeEventListener("mousemove",this.onMouseMove),this.wrapper.removeEventListener("mouseleave",this.onMouseLeave),this.wrapper.removeEventListener("touchstart",this.onTouchStart),this.el.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.thumbnailPreview.destroy(),this.wrapper.remove()}};var Lt=class{constructor(e){this.api=e,this.el=E("div",{className:"sp-time"}),this.el.setAttribute("aria-live","off")}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("currentTime")||0,n=this.api.getState("duration")||0;if(e){let r=this.api.getState("seekableRange"),s=this.api.getState("liveEdge");this.el.classList.toggle("sp-time--live",!!r),this.el.style.display=r?"":"none";let o=r&&!s?De(r.end-t):"LIVE";this.setText(o==="LIVE"?"":o)}else this.el.classList.remove("sp-time--live"),this.el.style.display="",this.setText(`${Le(t)} / ${Le(n)}`)}setText(e){this.el.textContent!==e&&(this.el.textContent=e),e?this.el.removeAttribute("aria-hidden"):this.el.setAttribute("aria-hidden","true")}destroy(){this.el.remove()}};var Tt=class{constructor(e){this.isDragging=!1;this.onMouseDown=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onDocMouseMove=e=>{this.isDragging&&this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onMouseUp=()=>{this.isDragging=!1};this.onTouchStart=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX))};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX)))};this.onTouchEnd=()=>{this.isDragging=!1};this.onKeyDown=e=>{let t=j(this.api.container);if(!t)return;let n=.1;switch(e.key){case"ArrowUp":case"ArrowRight":e.preventDefault(),this.setVolume(t.volume+n);break;case"ArrowDown":case"ArrowLeft":e.preventDefault(),this.setVolume(t.volume-n);break}};this.api=e,this.el=E("div",{className:"sp-volume"}),this.btn=E("button",{className:"sp-control sp-volume__btn","aria-label":"Mute",type:"button"}),this.btn.innerHTML=T.volumeHigh,this.btn.onclick=()=>this.toggleMute();let t=E("div",{className:"sp-volume__slider-wrap"});this.slider=E("div",{className:"sp-volume__slider"}),this.slider.setAttribute("role","slider"),this.slider.setAttribute("aria-label","Volume"),this.slider.setAttribute("aria-valuemin","0"),this.slider.setAttribute("aria-valuemax","100"),this.slider.setAttribute("tabindex","0"),this.level=E("div",{className:"sp-volume__level"}),this.slider.appendChild(this.level),t.appendChild(this.slider),this.el.appendChild(this.btn),this.el.appendChild(t),this.slider.addEventListener("mousedown",this.onMouseDown),this.slider.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.slider.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd)}render(){return this.el}update(){let e=this.api.getState("volume")??1,t=this.api.getState("muted")??!1,n,r;t||e===0?(n=T.volumeMute,r="Unmute"):e<.5?(n=T.volumeLow,r="Mute"):(n=T.volumeHigh,r="Mute"),ie(this.btn,n),te(this.btn,"aria-label",r);let s=t?0:e,o=`${s*100}%`;this.level.style.width!==o&&(this.level.style.width=o);let l=Math.round(s*100);te(this.slider,"aria-valuenow",String(l)),te(this.slider,"aria-valuetext",`${l}%`)}toggleMute(){let e=j(this.api.container);e&&(e.muted=!e.muted)}setVolume(e){let t=j(this.api.container);if(!t)return;let n=Math.max(0,Math.min(1,e));t.volume=n,n>0&&t.muted&&(t.muted=!1)}getVolumeFromPosition(e){let t=this.slider.getBoundingClientRect();return Math.max(0,Math.min(1,(e-t.left)/t.width))}destroy(){this.slider.removeEventListener("mousedown",this.onMouseDown),this.slider.removeEventListener("touchstart",this.onTouchStart),this.slider.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.el.remove()}};var xt=class{constructor(e){this.handleClick=()=>{this.seekToLive()};this.handleKeyDown=e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.seekToLive())};this.api=e,this.el=E("div",{className:"sp-live"}),this.dot=E("div",{className:"sp-live__dot"}),this.label=document.createElement("span"),this.label.textContent="LIVE",this.el.appendChild(this.dot),this.el.appendChild(this.label),this.el.setAttribute("role","button"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge"),this.el.setAttribute("tabindex","0"),this.el.addEventListener("click",this.handleClick),this.el.addEventListener("keydown",this.handleKeyDown)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("liveEdge");this.el.style.display=e?"":"none",t?(this.el.classList.remove("sp-live--behind"),this.label.textContent="LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge")):(this.el.classList.add("sp-live--behind"),this.label.textContent="GO LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - behind live edge, click to seek to live"))}seekToLive(){this.api.emit("live:seektolive",void 0)}destroy(){this.el.removeEventListener("click",this.handleClick),this.el.removeEventListener("keydown",this.handleKeyDown),this.el.remove()}};var Pt=class{constructor(e){this.isOpen=!1;this.lastQualitiesJson="";this.api=e,this.el=E("div",{className:"sp-quality"}),this.btn=ne("sp-quality__btn","Quality",T.settings),this.btnLabel=E("span",{className:"sp-quality__label"}),this.btnLabel.textContent="Auto",this.btn.appendChild(this.btnLabel),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.menu=E("div",{className:"sp-quality-menu"}),this.menu.setAttribute("role","menu"),this.menu.addEventListener("click",t=>{t.stopPropagation()}),this.el.appendChild(this.btn),this.el.appendChild(this.menu),this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler)}render(){return this.el}update(){let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality");this.el.style.display=e.length>0?"":"none",e.length===0&&this.isOpen&&this.close(),this.btnLabel.textContent=t?.label||"Auto";let n=JSON.stringify(e.map(s=>s.id)),r=t?.id||"auto";n!==this.lastQualitiesJson&&(this.lastQualitiesJson=n,this.rebuildMenu(e)),this.updateActiveStates(r)}rebuildMenu(e){this.menu.innerHTML="";let t=this.createMenuItem("Auto","auto");this.menu.appendChild(t);let n=[...e].sort((r,s)=>s.height-r.height);for(let r of n){if(r.id==="auto")continue;let s=this.createMenuItem(r.label,r.id);this.menu.appendChild(s)}}updateActiveStates(e){this.menu.querySelectorAll(".sp-quality-menu__item").forEach(n=>{let s=n.getAttribute("data-quality-id")===e;n.classList.toggle("sp-quality-menu__item--active",s)})}createMenuItem(e,t){let n=E("div",{className:"sp-quality-menu__item"});n.setAttribute("role","menuitem"),n.setAttribute("data-quality-id",t);let r=E("span",{className:"sp-quality-menu__label"});return r.textContent=e,n.appendChild(r),n.addEventListener("click",s=>{s.preventDefault(),s.stopPropagation(),this.selectQuality(t)}),n}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.menu.classList.add("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","true")}close(){this.isOpen=!1,this.menu.classList.remove("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","false")}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),this.el.remove()}};function Si(){if(typeof navigator>"u")return!1;let i=navigator.userAgent;return/Chrome/.test(i)&&!/Edge|Edg/.test(i)}function Li(){return typeof HTMLVideoElement>"u"?!1:typeof HTMLVideoElement.prototype.webkitShowPlaybackTargetPicker=="function"}var nt=class{constructor(e,t){this.api=e,this.type=t,this.supported=t==="chromecast"?Si():Li();let n=t==="chromecast"?T.chromecast:T.airplay,r=t==="chromecast"?"Cast":"AirPlay";this.el=ne(`sp-cast sp-cast--${t}`,r,n),this.el.addEventListener("click",()=>this.handleClick()),this.supported||(this.el.style.display="none")}render(){return this.el}update(){if(!this.supported){this.el.style.display="none";return}if(this.type==="chromecast"){let e=this.api.getState("chromecastAvailable"),t=this.api.getState("chromecastActive");this.el.style.display="",this.el.disabled=!e&&!t,this.el.classList.toggle("sp-cast--active",!!t),this.el.classList.toggle("sp-cast--unavailable",!e&&!t),t?(ie(this.el,T.chromecastConnected),te(this.el,"aria-label","Stop casting")):(ie(this.el,T.chromecast),te(this.el,"aria-label",e?"Cast":"No Cast devices found"))}else{let e=this.api.getState("airplayActive");this.el.style.display="",this.el.disabled=!1,this.el.classList.toggle("sp-cast--active",!!e),this.el.classList.remove("sp-cast--unavailable"),te(this.el,"aria-label",e?"Stop AirPlay":"AirPlay")}}handleClick(){this.type==="chromecast"?this.handleChromecast():this.handleAirPlay()}handleChromecast(){let e=this.api.getPlugin("chromecast");e&&(e.isConnected()?e.endSession():e.requestSession().catch(()=>{}))}async handleAirPlay(){let e=this.api.getPlugin("airplay");e?await e.showPicker():j(this.api.container)?.webkitShowPlaybackTargetPicker?.()}destroy(){this.el.remove()}};var Mt=class{constructor(e){this.clickHandler=()=>{this.toggle().catch(()=>{})};this.api=e;let t=document.createElement("video");this.supported="pictureInPictureEnabled"in document||"webkitSetPresentationMode"in t,this.el=ne("sp-pip","Picture-in-Picture",T.pip),this.el.addEventListener("click",this.clickHandler),this.supported?(this.el.disabled=!0,this.el.setAttribute("aria-disabled","true")):this.el.style.display="none"}render(){return this.el}isMediaReady(){let e=j(this.api.container);return!!e&&e.readyState>=HTMLMediaElement.HAVE_METADATA}update(){if(!this.supported)return;let e=!!this.api.getState("pip"),t=e||this.isMediaReady();this.el.disabled=!t,te(this.el,"aria-disabled",String(!t)),ie(this.el,e?T.exitPip:T.pip),te(this.el,"aria-label",e?"Exit Picture-in-Picture":"Picture-in-Picture"),this.el.classList.toggle("sp-pip--active",e)}async toggle(){let e=j(this.api.container);if(!e){this.api.logger.warn("PiP: video element not found");return}let t=document.pictureInPictureElement===e||e.webkitPresentationMode==="picture-in-picture";if(!t&&e.readyState<HTMLMediaElement.HAVE_METADATA){this.api.logger.debug("PiP: ignored, media not ready",{readyState:e.readyState});return}try{t?(document.pictureInPictureElement?await document.exitPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("inline"),this.api.logger.debug("PiP: exited")):(e.requestPictureInPicture?await e.requestPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("picture-in-picture"),this.api.logger.debug("PiP: entered"))}catch(n){let r=n instanceof Error?n.message:String(n);this.api.logger.warn("PiP: failed",{error:r})}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var _t=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=ne("sp-fullscreen","Fullscreen",T.fullscreen),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){this.api.getState("fullscreen")?(ie(this.el,T.exitFullscreen),te(this.el,"aria-label","Exit fullscreen")):(ie(this.el,T.fullscreen),te(this.el,"aria-label","Fullscreen"))}async toggle(){let e=this.api.container;try{Ve(e)?await ze(e):await Ue(e)}catch{}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var At=class{constructor(){this.el=E("div",{className:"sp-spacer"})}render(){return this.el}update(){}destroy(){this.el.remove()}};function Ti(i){if(!i)return"Something went wrong.";let e=i.code;if(e)switch(e){case"MEDIA_NETWORK_ERROR":return"Having trouble connecting. Check your internet and try again.";case"MEDIA_DECODE_ERROR":return"This video can't be played right now.";case"SOURCE_LOAD_FAILED":case"SOURCE_NOT_SUPPORTED":case"PROVIDER_NOT_FOUND":return"Unable to load video. Please try again.";case"PLAYBACK_FAILED":return"Playback stopped unexpectedly. Please try again.";case"MEDIA_APPEND_ERROR":return"Video playback was interrupted. Please try again.";case"MEDIA_BUFFER_FULL":return"Your device is low on video memory. Close other apps or tabs and try again.";case"PLAYLIST_INVALID":return"The stream is temporarily unavailable. Please try again."}let t=i.message?.toLowerCase()||"";return t.includes("network")||t.includes("timeout")||t.includes("fetch")||t.includes("connection")?"Having trouble connecting. Check your internet and try again.":t.includes("manifest")?"Unable to load video. Please try again.":t.includes("decode")||t.includes("media")||t.includes("format")||t.includes("codec")?"This video can't be played right now.":t.includes("not found")||t.includes("404")||t.includes("source")||t.includes("not supported")?"Video not found.":"Something went wrong."}var Ct=class{constructor(e){this.visible=!1;this.lastSource=null;this.handleRetry=()=>{if(this.retryBtn.disabled)return;this.retryBtn.disabled=!0,this.hide();let t=this.api.getState("source")?.src||this.lastSource;t&&this.api.emit("error:retry",{src:t}),setTimeout(()=>{this.retryBtn.disabled=!1},1e3)};this.handleDismiss=()=>{this.hide(),this.api.emit("error:dismiss",void 0)};this.api=e;let t=document.createElement("div");t.className="sp-error-overlay",t.setAttribute("role","alert"),t.setAttribute("aria-live","assertive");let n=document.createElement("div");n.className="sp-error-overlay__content";let r=document.createElement("div");r.className="sp-error-overlay__icon",r.innerHTML=T.error;let s=document.createElement("p");s.className="sp-error-overlay__message",s.textContent="Something went wrong.";let o=document.createElement("div");o.className="sp-error-overlay__actions",this.retryBtn=document.createElement("button"),this.retryBtn.className="sp-error-overlay__retry",this.retryBtn.setAttribute("type","button"),this.retryBtn.setAttribute("aria-label","Try again"),this.retryBtn.textContent="Try Again",this.retryBtn.addEventListener("click",this.handleRetry),this.dismissBtn=document.createElement("button"),this.dismissBtn.className="sp-error-overlay__dismiss",this.dismissBtn.setAttribute("type","button"),this.dismissBtn.setAttribute("aria-label","Go back"),this.dismissBtn.textContent="Go Back",this.dismissBtn.addEventListener("click",this.handleDismiss),o.appendChild(this.retryBtn),o.appendChild(this.dismissBtn),n.appendChild(r),n.appendChild(s),n.appendChild(o),t.appendChild(n),this.el=t}render(){return this.el}show(e){let t=Ti(e),n=this.el.querySelector(".sp-error-overlay__message");n&&(n.textContent=t);let r=this.api.getState("source");r?.src&&(this.lastSource=r.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.remove("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}showReconnecting(){let e=this.el.querySelector(".sp-error-overlay__message");e&&(e.textContent="Connection lost. Reconnecting...");let t=this.api.getState("source");t?.src&&(this.lastSource=t.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.add("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}hide(){this.visible=!1,this.el.classList.remove("sp-error-overlay--visible"),this.el.classList.remove("sp-error-overlay--reconnecting")}isVisible(){return this.visible}update(){let e=this.api.getState("playbackState");this.visible&&e!=="error"&&e!=="loading"&&this.api.getState("playing")&&this.hide()}destroy(){this.retryBtn.removeEventListener("click",this.handleRetry),this.dismissBtn.removeEventListener("click",this.handleDismiss),this.el.remove()}};var xi=90,Pi=60,Mi=[{label:"0.5x",value:.5},{label:"0.75x",value:.75},{label:"Normal",value:1},{label:"1.25x",value:1.25},{label:"1.5x",value:1.5},{label:"2x",value:2}],Rt=class{constructor(e){this.isOpen=!1;this.currentPanel="main";this.lastQualitiesJson="";this.lastSpeedAvailable=!0;this.withdrawnRate=null;this.speedLatch={source:void 0,shown:!1};this.api=e,this.el=E("div",{className:"sp-settings"}),this.btn=ne("sp-settings__btn","Settings",T.settings),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.panel=E("div",{className:"sp-settings-panel"}),this.panel.setAttribute("role","menu"),this.panel.addEventListener("click",t=>t.stopPropagation()),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.closeHandler=t=>{this.el.contains(t.target)||this.close(!1)},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{if(this.isOpen){if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),this.currentPanel!=="main"?this.showPanel("main"):this.close();return}if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault(),t.stopPropagation(),this.navigateItems(t.key==="ArrowDown"?1:-1);return}t.key==="Tab"&&(t.preventDefault(),t.stopPropagation(),this.navigateItems(t.shiftKey?-1:1))}},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){let e=this.isSpeedAvailable();e?this.restoreRate():this.resetRate();let t=this.hasRows();this.el.style.display=t?"":"none",this.isOpen&&!t&&this.close(!1),e!==this.lastSpeedAvailable&&(this.lastSpeedAvailable=e,this.isOpen&&(this.currentPanel==="main"||this.currentPanel==="speed")&&this.showPanel("main"));let n=this.api.getState("qualities")||[],r=JSON.stringify(n.map(s=>s.id));r!==this.lastQualitiesJson&&(this.lastQualitiesJson=r,this.isOpen&&this.currentPanel==="quality"&&this.renderQualityPanel()),this.isOpen&&(this.currentPanel==="quality"?this.updateQualityActiveStates():this.currentPanel==="speed"?this.updateSpeedActiveStates():this.currentPanel==="captions"?this.updateCaptionsActiveStates():this.currentPanel==="audio"&&this.updateAudioActiveStates())}isSpeedAvailable(){let e=this.api.getState("source");this.speedLatch.source!==e&&(this.speedLatch={source:e,shown:!1},this.withdrawnRate=null);let t=this.api.getState("live"),n=this.api.getState("seekableRange"),r=n?n.end-n.start:0;return!n||r<Pi?this.speedLatch.shown=!1:t&&r>=xi&&(this.speedLatch.shown=!0),!t||this.speedLatch.shown}resetRate(){let e=this.api.container.querySelector("video"),t=e?e.playbackRate:this.api.getState("playbackRate")??1;t!==1&&(this.withdrawnRate={rate:t,src:this.api.getState("source")?.src},this.api.emit("playback:ratechange",{rate:1}),e&&(e.playbackRate=1))}restoreRate(){let e=this.withdrawnRate;if(!e||(this.withdrawnRate=null,e.src!==this.api.getState("source")?.src))return;this.api.emit("playback:ratechange",{rate:e.rate});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e.rate)}hasRows(){return this.isSpeedAvailable()||(this.api.getState("qualities")||[]).length>0||(this.api.getState("textTracks")||[]).length>0||(this.api.getState("audioTracks")||[]).length>1}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.currentPanel="main",this.renderMainPanel(),this.panel.classList.add("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","true"),this.focusFirstItem()}close(e=!0){let t=this.isOpen;this.isOpen=!1,this.currentPanel="main",this.panel.classList.remove("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","false"),t&&e&&this.btn.focus()}showPanel(e){switch(this.currentPanel=e,e){case"main":this.renderMainPanel();break;case"quality":this.renderQualityPanel();break;case"speed":this.renderSpeedPanel();break;case"captions":this.renderCaptionsPanel();break;case"audio":this.renderAudioPanel();break}this.focusFirstItem()}renderMainPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--main";let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality"),n=this.api.getState("playbackRate")??1;if(e.length>0){let c=this.createMainRow("Quality",t?.label||"Auto",()=>this.showPanel("quality"));this.panel.appendChild(c)}if((this.api.getState("textTracks")||[]).length>0){let c=this.api.getState("currentTextTrack"),u=c?c.label:"Off",y=this.createMainRow("Captions",u,()=>this.showPanel("captions"));this.panel.appendChild(y)}if((this.api.getState("audioTracks")||[]).length>1){let c=this.api.getState("currentAudioTrack"),u=this.createMainRow("Audio",c?.label||"Default",()=>this.showPanel("audio"));this.panel.appendChild(u)}if(!this.isSpeedAvailable())return;let o=n===1?"Normal":`${n}x`,l=this.createMainRow("Speed",o,()=>this.showPanel("speed"));this.panel.appendChild(l)}createMainRow(e,t,n){let r=E("div",{className:"sp-settings-panel__row"});r.setAttribute("role","menuitem"),r.setAttribute("tabindex","0"),r.setAttribute("aria-haspopup","true");let s=E("span",{className:"sp-settings-panel__label"});s.textContent=e;let o=E("span",{className:"sp-settings-panel__value"});o.textContent=t;let l=E("span",{className:"sp-settings-panel__arrow"});return l.innerHTML=T.chevronDown,o.appendChild(l),r.appendChild(s),r.appendChild(o),r.addEventListener("click",c=>{c.preventDefault(),n()}),r.addEventListener("keydown",c=>{(c.key==="Enter"||c.key===" ")&&(c.preventDefault(),n())}),r}renderQualityPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Quality");this.panel.appendChild(e);let t=this.api.getState("qualities")||[],r=this.api.getState("currentQuality")?.id||"auto",s=this.createMenuItem("Auto","auto",r==="auto");s.addEventListener("click",l=>{l.preventDefault(),this.selectQuality("auto")}),this.panel.appendChild(s);let o=[...t].sort((l,c)=>c.height-l.height);for(let l of o){if(l.id==="auto")continue;let c=this.createMenuItem(l.label,l.id,l.id===r);c.addEventListener("click",u=>{u.preventDefault(),this.selectQuality(l.id)}),this.panel.appendChild(c)}}renderSpeedPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Speed");this.panel.appendChild(e);let t=this.api.getState("playbackRate")??1;for(let n of Mi){let r=Math.abs(t-n.value)<.01,s=this.createMenuItem(n.label,String(n.value),r);s.addEventListener("click",o=>{o.preventDefault(),this.selectSpeed(n.value)}),this.panel.appendChild(s)}}renderCaptionsPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Captions");this.panel.appendChild(e);let t=this.api.getState("textTracks")||[],r=this.api.getState("currentTextTrack")?.id||"off",s=this.createMenuItem("Off","off",r==="off");s.addEventListener("click",o=>{o.preventDefault(),this.selectCaption(null)}),this.panel.appendChild(s);for(let o of t){let l=this.createMenuItem(o.label,o.id,o.id===r);l.addEventListener("click",c=>{c.preventDefault(),this.selectCaption(o.id)}),this.panel.appendChild(l)}}renderAudioPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Audio");this.panel.appendChild(e);let t=this.api.getState("audioTracks")||[],r=this.api.getState("currentAudioTrack")?.id??null;for(let s of t){let o=this.createMenuItem(s.label,s.id,s.id===r);o.addEventListener("click",l=>{l.preventDefault(),this.selectAudioTrack(s.id)}),this.panel.appendChild(o)}}selectAudioTrack(e){this.api.emit("track:audio",{trackId:e}),this.close()}updateAudioActiveStates(){let t=this.api.getState("currentAudioTrack")?.id??null;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}selectCaption(e){this.api.emit("track:text",{trackId:e}),this.close()}updateCaptionsActiveStates(){let t=this.api.getState("currentTextTrack")?.id||"off";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}createSubHeader(e){let t=E("div",{className:"sp-settings-panel__header"});t.setAttribute("role","menuitem"),t.setAttribute("tabindex","0");let n=E("span",{className:"sp-settings-panel__back"});n.innerHTML=T.chevronUp;let r=E("span",{className:"sp-settings-panel__header-label"});return r.textContent=e,t.appendChild(n),t.appendChild(r),t.addEventListener("click",s=>{s.preventDefault(),this.showPanel("main")}),t.addEventListener("keydown",s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),this.showPanel("main"))}),t}createMenuItem(e,t,n){let r=E("div",{className:`sp-settings-panel__item${n?" sp-settings-panel__item--active":""}`});r.setAttribute("role","menuitem"),r.setAttribute("tabindex","0"),r.setAttribute("data-id",t);let s=E("span");s.textContent=e;let o=E("span",{className:"sp-settings-panel__check"});return o.innerHTML=T.checkmark,r.appendChild(s),r.appendChild(o),r.addEventListener("keydown",l=>{(l.key==="Enter"||l.key===" ")&&(l.preventDefault(),r.click())}),r}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}selectSpeed(e){if(!this.isSpeedAvailable())return;this.api.emit("playback:ratechange",{rate:e});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e),this.close()}updateQualityActiveStates(){let t=this.api.getState("currentQuality")?.id||"auto";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}updateSpeedActiveStates(){let e=this.api.getState("playbackRate")??1;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(n=>{let r=n.getAttribute("data-id"),s=parseFloat(r||"1");n.classList.toggle("sp-settings-panel__item--active",Math.abs(e-s)<.01)})}getFocusableItems(){return Array.from(this.panel.querySelectorAll('[role="menuitem"]'))}focusFirstItem(){requestAnimationFrame(()=>{let e=this.getFocusableItems();e.length>0&&e[0].focus()})}navigateItems(e){let t=this.getFocusableItems();if(t.length===0)return;let n=document.activeElement,r=t.indexOf(n),s;r===-1?s=e===1?0:t.length-1:s=(r+e+t.length)%t.length,t[s].focus()}getPanel(){return this.currentPanel}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.el.remove()}};var _i=10,rt=class{constructor(e,t,n=_i){this.clickHandler=()=>{this.skip()};this.api=e,this.direction=t,this.seconds=n;let r=t==="backward"?T.replay10:T.forward10,s=t==="backward"?`Rewind ${n} seconds`:`Forward ${n} seconds`;this.el=ne(`sp-skip sp-skip--${t}`,s,r),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("duration")??0,n=this.api.getState("seekableRange");if(e&&!n){this.el.style.display="none";return}if(e&&n){this.el.style.display="";return}if(t===0){this.el.style.display="none";return}this.el.style.display=""}skip(){let e=j(this.api.container);if(!e)return;let t=this.api.getState("live"),n=this.api.getState("seekableRange"),r;if(t&&n){if(this.direction==="forward"&&this.api.getState("liveEdge"))return;r=this.direction==="backward"?Math.max(n.start,e.currentTime-this.seconds):Math.min(n.end,e.currentTime+this.seconds)}else{let s=e.duration||0;if(!s||!isFinite(s))return;r=this.direction==="backward"?Math.max(0,e.currentTime-this.seconds):Math.min(s,e.currentTime+this.seconds)}e.currentTime=r,this.api.emit("playback:seeking",{time:r})}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};function Xt(i){let e=i.getState("textTracks")||[],t=i.getState("currentTextTrack");return e.length===0?!1:(t?i.emit("track:text",{trackId:null}):i.emit("track:text",{trackId:e[0].id}),!0)}var Ht=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=ne("sp-captions","Captions",T.captionsOff),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("textTracks")||[],t=this.api.getState("currentTextTrack");if(e.length===0){this.el.style.display="none";return}this.el.style.display="",t?(ie(this.el,T.captions),te(this.el,"aria-label",`Captions: ${t.label}`),this.el.classList.add("sp-captions--active")):(ie(this.el,T.captionsOff),te(this.el,"aria-label","Captions"),this.el.classList.remove("sp-captions--active"))}toggle(){Xt(this.api)}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var Dt=class{constructor(e){this.el=ne("sp-kbd-help-btn","Keyboard shortcuts",T.keyboardHelp),this.el.addEventListener("click",()=>e())}render(){return this.el}update(){}destroy(){this.el.remove()}};var kn=[{keys:"Space / K",action:"Play / pause"},{keys:"Left / Right arrow",action:"Seek 5 seconds back / forward"},{keys:"Up / Down arrow",action:"Volume up / down"},{keys:"M",action:"Toggle mute"},{keys:"F",action:"Toggle fullscreen"},{keys:"C",action:"Toggle captions",note:"Needs caption tracks. Turns the current track off, or enables the first available one."},{keys:"0-9",action:"Seek to 0-90% of the video",note:"On a live stream with DVR, seeks to the same share of the seekable window; on live without DVR, digits do nothing."},{keys:"?",action:"Show this help"},{keys:"Home / End",action:"Jump to the start / end",note:"Only while the progress bar is focused - they are progress-slider shortcuts, not player-wide ones."}];var It=class{constructor(e){this.opened=!1;this.invoker=null;this.api=e,this.el=E("div",{className:"sp-kbd-help",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts"}),this.panel=E("div",{className:"sp-kbd-help__panel"});let t=E("div",{className:"sp-kbd-help__header"}),n=E("span",{className:"sp-kbd-help__title"});n.textContent="Keyboard shortcuts",this.closeBtn=E("button",{className:"sp-kbd-help__close",type:"button","aria-label":"Close keyboard shortcuts"}),this.closeBtn.innerHTML=T.close,this.closeHandler=()=>this.close(),this.closeBtn.addEventListener("click",this.closeHandler),t.appendChild(n),t.appendChild(this.closeBtn),this.body=E("div",{className:"sp-kbd-help__body"}),this.renderEntries(),this.panel.appendChild(t),this.panel.appendChild(this.body),this.el.appendChild(this.panel),this.keyHandler=r=>{if(this.opened&&this.api.container.contains(document.activeElement)){if(r.key==="Escape"){r.preventDefault(),r.stopPropagation(),this.close();return}r.key==="Tab"&&(r.preventDefault(),r.stopPropagation(),this.trapTab(r.shiftKey))}}}renderEntries(){let e=E("div",{className:"sp-kbd-help__list"});for(let r of kn){let s=E("div",{className:"sp-kbd-help__row"}),o=E("span",{className:"sp-kbd-help__keys"});o.textContent=r.keys;let l=E("span",{className:"sp-kbd-help__action"});l.textContent=r.action,s.appendChild(o),s.appendChild(l),e.appendChild(s)}this.body.appendChild(e);let t=kn.filter(r=>r.note);if(t.length===0)return;let n=E("div",{className:"sp-kbd-help__notes"});for(let r of t){let s=E("p",{className:"sp-kbd-help__note"});s.textContent=`${r.keys}: ${r.note}`,n.appendChild(s)}this.body.appendChild(n)}open(e){if(this.opened)return!0;let t=document.activeElement;if(t instanceof HTMLElement){let n=t.closest('[role="dialog"], [aria-modal="true"]');if(n&&!this.el.contains(n)&&!n.contains(this.api.container))return!1}return this.opened=!0,this.invoker=e instanceof HTMLElement&&this.api.container.contains(e)?e:this.api.container,this.api.container.appendChild(this.el),document.addEventListener("keydown",this.keyHandler),this.closeBtn.focus(),!0}close(e=!0){if(!this.opened)return;this.opened=!1,document.removeEventListener("keydown",this.keyHandler),this.el.remove();let t=this.invoker;if(this.invoker=null,!e)return;let n=t?.isConnected?t:this.api.container;n.isConnected&&(n.focus(),document.activeElement!==n&&this.api.container.isConnected&&this.api.container.focus())}isOpen(){return this.opened}trapTab(e){let t=Array.from(this.el.querySelectorAll("button, [href], [tabindex]")).filter(s=>!(s instanceof HTMLButtonElement&&s.disabled));if(t.length===0)return;let n=t.indexOf(document.activeElement);(e?t[(n<=0?t.length:n)-1]:t[(n+1)%t.length]).focus()}destroy(){this.close(!1),this.closeBtn.removeEventListener("click",this.closeHandler)}};var Ai='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"/></svg>',Nt=class{constructor(e){this.api=e,this.el=E("div",{className:"sp-bandwidth-indicator"}),this.el.innerHTML=Ai,this.el.setAttribute("aria-label","Bandwidth is limiting video quality"),this.el.setAttribute("title","Bandwidth is limiting video quality"),this.el.style.display="none"}render(){return this.el}update(){let e=this.api.getState("bandwidth"),t=this.api.getState("qualities");if(!e||!t||t.length===0){this.el.style.display="none";return}let n=Math.max(...t.map(r=>r.bitrate));n>0&&e<n?this.el.style.display="":this.el.style.display="none"}destroy(){this.el.remove()}};var Ot=class{constructor(e){this.api=e;this.isOpen=!1;this.toggleHandler=()=>{this.isOpen?this.close():this.open()};this.el=E("div",{className:"sp-overflow"}),this.btn=ne("sp-overflow__btn","More controls",T.more),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",this.toggleHandler),this.panel=E("div",{className:"sp-overflow-tray",role:"group","aria-label":"More controls"}),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.el.style.display="none",this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{!this.isOpen||t.key!=="Escape"||(t.preventDefault(),t.stopPropagation(),this.close(),this.btn.focus())},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){}adopt(e){this.panel.appendChild(e),this.syncVisibility()}release(e){return e.parentNode===this.panel&&this.panel.removeChild(e),this.syncVisibility(),e}holds(e){return e.parentNode===this.panel}open(){this.isOpen||(this.isOpen=!0,this.panel.classList.add("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","true"))}close(){this.isOpen&&(this.isOpen=!1,this.panel.classList.remove("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","false"))}isMenuOpen(){return this.isOpen}syncVisibility(){let e=Array.from(this.panel.children).some(t=>t.style.display!=="none");this.el.style.display=e?"":"none",!e&&this.isOpen&&this.close()}refresh(){this.syncVisibility()}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.btn.removeEventListener("click",this.toggleHandler),this.el.remove(),this.api.logger.debug("Overflow tray destroyed")}};var Ci=new Map,Ri=new Map,ur=new Set;function Sn(i,e){if(e){let t=Ri.get(e)?.get(i);if(t)return t}return Ci.get(i)??null}function dr(i){return ur.add(i),()=>{ur.delete(i)}}var pr=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var Ln=[32,32,32],hr=4.5,Hi=`
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
  yellow:ffff00 yellowgreen:9acd32`,gr;function Di(i){return gr??(gr=new Map(Hi.trim().split(/\s+/).map(e=>e.split(":")))),gr.get(i)}var Ii=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/;function fr(i,e){if(!Ii.test(i))return null;let t=i.endsWith("%")?parseFloat(i)/100*e:parseFloat(i);return Math.min(e,Math.max(0,t))}function mr(i){let e=/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(i)?.[1];if(!e)return null;let t=e.length<=4?e.split("").map(r=>r+r).join(""):e,n=t.length===8?parseInt(t.slice(6,8),16)/255:1;return[[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)],n]}function Ni(i){let e=/^rgba?\(([^()]*)\)$/.exec(i)?.[1]?.trim();if(!e)return null;let t,n;if(e.includes(","))t=e.split(",").map(o=>o.trim()),t.length===4&&(n=t.pop());else{let[o="",l,...c]=e.split("/").map(u=>u.trim());if(c.length||l==="")return null;t=o.split(/\s+/),n=l}if(t.length!==3)return null;let r=t.map(o=>fr(o,255)),s=n===void 0?1:fr(n,1);return r.some(o=>o===null)||s===null?null:[r.map(o=>Math.round(o)),s]}function Oi(i,e){let t=i.trim().toLowerCase(),n=Di(t),r=n?mr(`#${n}`):mr(t)??Ni(t);if(!r)return null;let[s,o]=r;return o<=0?null:o>=1?s:s.map((l,c)=>Math.round(l*o+e[c]*(1-o)))}function Jt([i,e,t]){let[n,r,s]=[i,e,t].map(o=>{let l=o/255;return l<=.03928?l/12.92:Math.pow((l+.055)/1.055,2.4)});return .2126*n+.7152*r+.0722*s}function vr(i,e){let t=Math.max(Jt(i),Jt(e)),n=Math.min(Jt(i),Jt(e));return(t+.05)/(n+.05)}function Fi(i,e){return i.map(t=>Math.round(t+(255-t)*e))}function yr(i){return`#${i.map(e=>e.toString(16).padStart(2,"0")).join("")}`}function Tn(i){let e=Oi(i,Ln);if(!e)return i;if(vr(e,Ln)>=hr)return yr(e);for(let t=.04;t<=1;t+=.04){let n=Fi(e,t);if(vr(n,Ln)>=hr)return yr(n)}return"#ffffff"}var Bi=["play","skip-backward","skip-forward","volume","time","live-indicator","bandwidth-indicator","spacer","settings","captions","chromecast","airplay","pip","fullscreen"],Vi="sp-ui-styles",Ui=3e3,zi=new Set([" ","Enter"]),Ki=new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"]),$i=48,br=64,qi=44,Er=24,wr=4,Wi=100,Gi=16,Qi=56,ji=120,kr=1500;function Sr(i={}){let e,t=null,n=null,r=null,s=null,o=null,l=null,c=null,u=[],y=null,M=null,b=null,S=null,L=null,V=null,U=null,ce=!0,x=null,z=null,Y=[],K=null,$=null,h=null,B=null,q=null,C=Er,se=wr,ue=br,P=null,_=!0,D=!1,W=!1,re=new Set,ge=null,pe=i.controls||Bi,be=i.hideDelay??Ui,fe=i.bigPlayButton!==!1,oe=i.keyboard!==!1,ve=i.responsive!==!1;ve&&yn(pe,i.priority);let Ce=()=>{for(let f of u){let F=f;typeof F.close=="function"&&F.close(!1)}let p=document.activeElement instanceof HTMLElement?document.activeElement:null;return $?.open(p)??!1},Re=p=>{switch(p){case"play":return new Et(e);case"skip-backward":return new rt(e,"backward");case"skip-forward":return new rt(e,"forward");case"volume":return new Tt(e);case"progress":return null;case"time":return new Lt(e);case"live-indicator":return new xt(e);case"bandwidth-indicator":return new Nt(e);case"quality":return new Pt(e);case"settings":return new Rt(e);case"captions":return new Ht(e);case"chromecast":return new nt(e,"chromecast");case"airplay":return new nt(e,"airplay");case"pip":return new Mt(e);case"fullscreen":return new _t(e);case"spacer":return new At;case"keyboard-help":return oe?new Dt(Ce):null;default:{let f=Sn(p,e.container);if(f)try{return f(e)}catch(F){return e.logger.error(`Control factory for "${p}" threw`,{error:F}),null}return re.add(p),e.logger.debug(`No control registered for slot "${p}" yet`),null}}},xe=()=>{ge=null;for(let p of re)e.logger.warn(`Control slot "${p}" has no registered control after ${kr}ms - is the plugin installed?`);re.clear()},Ee=()=>{if(!t)return;re.clear();let p=new Map(jt(pe,i.priority).map(f=>[f.id,f]));for(let f of pe){let F=Re(f);if(!F)continue;u.push(F);let R=F.render();t.appendChild(R);let k=p.get(f),H={slot:f,control:F,el:R,rank:k?.rank??"never",exit:k?.exit??"overflow",width:-1};Y.push(H),f==="time"&&(K=H)}ve&&(z=new Ot(e),u.push(z),t.appendChild(z.render()),qe())},qe=()=>{if(!t||!z)return;let p=z.render(),f=Y.find(R=>R.slot==="fullscreen"),F=f&&f.el.parentNode===t?f.el:null;if(F){p.nextSibling!==F&&t.insertBefore(p,F);return}t.lastChild!==p&&t.appendChild(p)},it=()=>{let p="";for(let f of Y)p+=f.el.style.display==="none"?"0":"1";return`${p}:${K?.el.textContent?.length??0}`},Ie=p=>{if(!t||!z)return;let f=new Set(p.overflow),F=new Set(p.hidden);for(let R of Y)if(R.slot!=="spacer"){if(F.has(R.slot)){z.holds(R.el)&&_e(R),R.el.classList.add("sp-control--collapsed");continue}R.el.classList.remove("sp-control--collapsed"),f.has(R.slot)?z.holds(R.el)||z.adopt(R.el):z.holds(R.el)&&_e(R)}z.refresh(),qe()},_e=p=>{if(!t||!z)return;let f=z.release(p.el),F=z.render(),R=F.parentNode===t?F:null;for(let k=Y.indexOf(p)+1;k<Y.length;k++)if(Y[k].el.parentNode===t){R=Y[k].el;break}t.insertBefore(f,R)},Zt=p=>{if(p.slot!=="volume")return 0;let f=p.el.querySelector(".sp-volume__slider-wrap");return f?f.getBoundingClientRect().width:0},We=p=>p.slot==="volume"?ue:0,Ft=p=>{let f=getComputedStyle(p),F=parseFloat(f.paddingLeft),R=parseFloat(f.paddingRight),k=parseFloat(f.columnGap||f.gap),H=parseFloat(f.getPropertyValue("--sp-volume-slider-width"));C=Number.isFinite(F)&&Number.isFinite(R)?F+R:Er,se=Number.isFinite(k)?k:wr,ue=Number.isFinite(H)?H:br},Bt=()=>{if(!ve||!t||!z||t.clientWidth===0)return;Ft(t);let p=Y.filter(H=>H.slot==="spacer"&&H.el.style.display!=="none").length,f=t.clientWidth-C-p*se,F=[];for(let H of Y){if(H.slot==="spacer")continue;let de=H.el.style.display!=="none";de&&H.el.parentNode===t&&!H.el.classList.contains("sp-control--collapsed")?H.width=H.el.getBoundingClientRect().width-Zt(H):H.width<0&&(H.width=$i),F.push({id:H.slot,rank:H.rank,exit:H.exit,width:H.width+We(H),visible:de})}let R=z.render(),k=R.style.display==="none"?0:R.getBoundingClientRect().width;Ie(bn(F,f,se,k||qi)),P=it(),_=!1},st=()=>{ve&&(!_&&it()===P||Bt())},ot=p=>{let f=t?.offsetHeight||Qi;e?.container?.style.setProperty("--sp-menu-max-height",`${Math.max(ji,Math.round(p)-f-Gi)}px`)},Ae=()=>{t&&(u.forEach(p=>p.destroy()),u=[],Y=[],K=null,z=null,bt(t),P=null,_=!0,Ee(),Qe())},Ge=()=>{W&&(W=!1,Ae())},Vt=()=>{W||(W=!0,queueMicrotask(Ge))},Qe=()=>{u.forEach(H=>H.update()),r?.update();let p=e?.getState("waiting"),f=e?.getState("seeking"),R=e?.getState("playbackState")==="loading",k=p||f&&!e?.getState("paused")||R;s?.classList.toggle("sp-buffering--visible",!!k),o?.update(),l?.update(),st()},Pe=()=>{x===null&&(x=requestAnimationFrame(()=>{x=null,Qe()}))},en=()=>r?.isTimelineEditing()?!0:u.some(p=>{let f=p;return typeof f.isMenuOpen=="function"&&f.isMenuOpen()}),we=()=>{if(ce){Ne();return}ce=!0,t?.classList.add("sp-controls--visible"),t?.classList.remove("sp-controls--hidden"),n?.classList.add("sp-gradient--visible"),r?.show(),e?.setState("controlsVisible",!0),Ne()},at=()=>{if(!e?.getState("paused")){if(en()){Ne();return}ce=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),n?.classList.remove("sp-gradient--visible"),r?.hide(),e?.setState("controlsVisible",!1)}},Ne=()=>{y&&clearTimeout(y),y=setTimeout(at,be)},Ut=null,je=p=>{Ut=p.pointerType},me=p=>{Ut==="touch"&&!tn(p)&&e?.getPlugin("gestures")?.ownsTapInteraction()||we()},tn=p=>{let f=p?.target;return f instanceof Node?!!t?.contains(f)||!!r?.render().contains(f):!1},lt=()=>{at()},nn=p=>p.key.length===1&&p.key>="0"&&p.key<="9"&&!p.shiftKey&&!(typeof p.getModifierState=="function"&&p.getModifierState("AltGraph")),Me=(p,f)=>{let F=e.getState("live"),R=e.getState("seekableRange");if(F){if(!R)return null;let{start:ye,end:Fe}=R;return!Number.isFinite(ye)||!Number.isFinite(Fe)||Fe<=ye?null:Math.min(Fe,Math.max(ye,ye+p/10*(Fe-ye)))}let k=Number(e.getState("duration")),H=f.duration,de=Number.isFinite(k)&&k>0?k:Number.isFinite(H)&&H>0?H:null;return de===null?null:Math.min(de,Math.max(0,p/10*de))},Oe=p=>{if(!e.container.contains(document.activeElement)||p.defaultPrevented||p.metaKey||p.ctrlKey||p.altKey)return;let f=document.activeElement;if(f instanceof HTMLInputElement||f instanceof HTMLTextAreaElement||f instanceof HTMLSelectElement||f?.isContentEditable)return;let F=f?.getAttribute("role");if((f instanceof HTMLButtonElement||F==="button"||F==="menuitem")&&zi.has(p.key)||F==="slider"&&Ki.has(p.key)||$?.isOpen())return;if(p.key==="?"){Ce()&&p.preventDefault();return}if(p.key==="c"||p.key==="C"){Xt(e)&&p.preventDefault();return}let k=e.container.querySelector("video");if(!k)return;if(nn(p)){let ye=Me(Number(p.key),k);if(ye===null)return;p.preventDefault(),k.currentTime=ye,e.emit("playback:seeking",{time:k.currentTime}),we();return}let H=e.getState("live"),de=e.getState("seekableRange");switch(p.key){case" ":case"k":p.preventDefault(),k.paused?k.play().catch(()=>{}):k.pause();break;case"m":p.preventDefault(),k.muted=!k.muted;break;case"f":p.preventDefault(),Ve(e.container)?ze(e.container).catch(()=>{}):Ue(e.container).catch(()=>{});break;case"ArrowLeft":p.preventDefault(),H&&de?k.currentTime=Math.max(de.start,k.currentTime-5):k.currentTime=Math.max(0,k.currentTime-5),e.emit("playback:seeking",{time:k.currentTime}),we();break;case"ArrowRight":p.preventDefault(),H&&de?k.currentTime=Math.min(de.end,k.currentTime+5):k.currentTime=Math.min(k.duration||0,k.currentTime+5),e.emit("playback:seeking",{time:k.currentTime}),we();break;case"ArrowUp":p.preventDefault(),k.volume=Math.min(1,k.volume+.1),we();break;case"ArrowDown":p.preventDefault(),k.volume=Math.max(0,k.volume-.1),we();break}};return{id:"ui-controls",name:"UI Controls",type:"ui",version:pr,async init(p){e=p,c=dn(Vi,En),i.theme&&this.setTheme(i.theme);let f=e.container;if(!f){e.logger.error("UI plugin: container not found");return}getComputedStyle(f).position==="static"&&(f.style.position="relative"),f.classList.contains("sp-container")||(f.classList.add("sp-container"),D=!0);let R=e.getState("playing");n=document.createElement("div"),n.className=R?"sp-gradient":"sp-gradient sp-gradient--visible",f.appendChild(n),s=document.createElement("div"),s.className="sp-buffering",s.innerHTML=T.spinner,s.setAttribute("aria-hidden","true"),f.appendChild(s),o=new Ct(e),f.appendChild(o.render()),S=e.on("error",k=>{if(k?.fatal){let H=e.getState("error")||k;o?.show(H),Pe()}}),L=e.on("error:reconnecting",()=>{o?.showReconnecting(),Pe()}),V=e.on("error:recovered",()=>{o?.hide(),Pe()}),U=e.on("media:loaded",()=>{o?.hide(),Pe()}),fe&&(l=new wt(e,()=>o?.isVisible()??!1),f.appendChild(l.render())),$=new It(e),r=new St(e,{onEditingChange:k=>{k?we():Ne()}}),f.appendChild(r.render()),R||r.show(),t=document.createElement("div"),t.className=R?"sp-controls sp-controls--hidden":"sp-controls sp-controls--visible",t.setAttribute("role","toolbar"),t.setAttribute("aria-label","Video controls"),Ee(),re.size>0&&(ge=setTimeout(xe,kr)),f.appendChild(t),ve&&typeof ResizeObserver=="function"?(h=new ResizeObserver(k=>{ot(k[0]?.contentRect.height??f.clientHeight),_=!0,Pe()}),h.observe(f)):ve&&typeof window<"u"&&(q=()=>{B&&clearTimeout(B),B=setTimeout(()=>{B=null,ot(f.clientHeight),_=!0,Pe()},Wi)},window.addEventListener("resize",q)),b=dr((k,H)=>{pe.includes(k)&&(H&&H!==e.container||(e.logger.debug(`Control "${k}" registered after init, queuing a control bar rebuild`),Vt()))}),f.addEventListener("pointerdown",je,{passive:!0}),f.addEventListener("pointermove",je,{passive:!0}),f.addEventListener("mousemove",me),f.addEventListener("mouseenter",me),f.addEventListener("mouseleave",lt),f.addEventListener("touchstart",me,{passive:!0}),f.addEventListener("click",me),oe&&document.addEventListener("keydown",Oe),M=e.subscribeToState(Pe),Qe(),f.hasAttribute("tabindex")||f.setAttribute("tabindex","0"),ce=!R,e.setState("controlsVisible",ce),R&&Ne(),e.logger.debug("UI controls plugin initialized")},async destroy(){y&&(clearTimeout(y),y=null),x!==null&&(cancelAnimationFrame(x),x=null),h?.disconnect(),h=null,q&&(window.removeEventListener("resize",q),q=null),B&&(clearTimeout(B),B=null),e?.container?.style.removeProperty("--sp-menu-max-height"),M?.(),M=null,$?.destroy(),$=null,S?.(),S=null,L?.(),L=null,V?.(),V=null,U?.(),U=null,e?.container&&(e.container.removeEventListener("pointerdown",je),e.container.removeEventListener("pointermove",je),e.container.removeEventListener("mousemove",me),e.container.removeEventListener("mouseenter",me),e.container.removeEventListener("mouseleave",lt),e.container.removeEventListener("touchstart",me),e.container.removeEventListener("click",me)),oe&&document.removeEventListener("keydown",Oe),b?.(),b=null,W=!1,ge&&(clearTimeout(ge),ge=null),re.clear(),u.forEach(p=>p.destroy()),u=[],Y=[],K=null,z=null,r?.destroy(),r=null,o?.destroy(),o=null,l?.destroy(),l=null,t?.remove(),t=null,n?.remove(),n=null,s?.remove(),s=null,c?.(),c=null,D&&(e?.container?.classList.remove("sp-container"),D=!1),e?.logger.debug("UI controls plugin destroyed")},show(){we()},hide(){ce=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),n?.classList.remove("sp-gradient--visible"),r?.hide(),e?.setState("controlsVisible",!1)},setTheme(p){let f=e?.container||document.documentElement;p.primaryColor&&f.style.setProperty("--sp-color",p.primaryColor),p.accentColor&&f.style.setProperty("--sp-accent",p.accentColor),p.accentTextColor&&f.style.setProperty("--sp-accent-text",p.accentTextColor),p.backgroundColor&&f.style.setProperty("--sp-bg",p.backgroundColor),p.controlBarHeight&&f.style.setProperty("--sp-control-height",`${p.controlBarHeight}px`),p.iconSize&&f.style.setProperty("--sp-icon-size",`${p.iconSize}px`)},getControlBar(){return t}}}async function $l(i,e){let t=e.accentColor??"#e50914",n=await cn({container:i,src:e.src,poster:e.poster,plugins:[rr(),or(),Sr({theme:{accentColor:t,accentTextColor:Tn(t)}})]});if(n.getState().error)throw await n.destroy(),new Error("The sample failed to load");return{async play(){let r=i.querySelector("video");if(!r)throw new Error("The player has no media element");await r.play()},onFirstPlaying(r){if(n.playing){r();return}let s=n.subscribeToState(o=>{o.key==="playing"&&o.value===!0&&(s(),r())})},destroy(){return n.destroy()}}}export{$l as mountHomePlayer};
