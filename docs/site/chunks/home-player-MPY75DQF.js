import{a as mr}from"./chunk-VC46IEJQ.js";var nn=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var $e=null;var Tn=new WeakMap;function Ut(i,e){let t=Tn.get(i);t||(t=new Set,Tn.set(i,t)),t.add(e)}var rt=class{constructor(e){this.subscribers=new Set;this.value=e}get(){if($e){let e=$e;this.subscribers.add(e),Ut(e,()=>this.subscribers.delete(e))}return this.value}set(e){Object.is(this.value,e)||(this.value=e,this.notify())}update(e){this.set(e(this.value))}subscribe(e){return this.subscribers.add(e),()=>this.subscribers.delete(e)}notify(){Array.from(this.subscribers).forEach(e=>{try{e()}catch(t){console.error("[Scarlett Player] Error in signal subscriber:",t)}})}destroy(){this.subscribers.clear()}getSubscriberCount(){return this.subscribers.size}};function zt(i){return new rt(i)}var qe={playbackState:"idle",playing:!1,paused:!0,ended:!1,buffering:!1,waiting:!1,seeking:!1,currentTime:0,duration:NaN,buffered:null,bufferedAmount:0,mediaType:"unknown",source:null,title:"",poster:"",volume:1,muted:!1,playbackRate:1,fullscreen:!1,pip:!1,controlsVisible:!0,qualities:[],currentQuality:null,audioTracks:[],currentAudioTrack:null,textTracks:[],currentTextTrack:null,live:!1,liveEdge:!0,seekableRange:null,liveLatency:0,lowLatencyMode:!1,chapters:[],currentChapter:null,error:null,bandwidth:0,autoplay:!1,loop:!1,airplayAvailable:!1,airplayActive:!1,chromecastAvailable:!1,chromecastActive:!1,thumbnails:null,interacting:!1,hovering:!1,focused:!1},it=class{constructor(e){this.signals=new Map;this.changeSubscribers=new Set;this.definedDefaults=new Map;this.lastValues=new Map;this.destroyed=!1;this.initializeSignals(e)}initializeSignals(e){let t={...qe,...e};for(let[n,r]of Object.entries(t))this.createSignal(n,r)}createSignal(e,t){let n=zt(t);this.lastValues.set(e,t),n.subscribe(()=>{this.notifyChangeSubscribers(e)}),this.signals.set(e,n)}define(e,t){if(this.signals.has(e)){let n=this.definedDefaults.has(e),r=e in qe,s=n?this.definedDefaults.get(e):qe[e];(n||r)&&!Object.is(s,t)&&console.warn(`[StateManager] State key "${String(e)}" is already defined with a different default. Keeping:`,s,"ignoring:",t);return}this.definedDefaults.set(e,t),this.createSignal(e,t)}get(e){if(this.destroyed)throw new Error(`[StateManager] Manager is destroyed (reading '${e}')`);let t=this.signals.get(e);if(!t)throw new Error(`[StateManager] Unknown state key: ${e}`);return t}getValue(e){return this.get(e).get()}set(e,t){this.get(e).set(t)}update(e){for(let[t,n]of Object.entries(e)){let r=t;this.signals.has(r)&&this.set(r,n)}}subscribeToKey(e,t){let n=this.get(e);return n.subscribe(()=>{t(n.get())})}subscribe(e){return this.changeSubscribers.add(e),()=>this.changeSubscribers.delete(e)}notifyChangeSubscribers(e){let n=this.get(e).get(),r=this.lastValues.get(e);this.lastValues.set(e,n);let s={key:e,value:n,previousValue:r};Array.from(this.changeSubscribers).forEach(o=>{try{o(s)}catch(c){console.error("[StateManager] Error in change subscriber:",c)}})}reset(){this.update({...qe,...Object.fromEntries(this.definedDefaults)})}resetKey(e){let t=e in qe?qe[e]:this.definedDefaults.get(e);this.set(e,t)}snapshot(){let e={};for(let[t,n]of this.signals)e[t]=n.get();return Object.freeze(e)}getSubscriberCount(e){return this.signals.get(e)?.getSubscriberCount()??0}destroy(){this.signals.forEach(e=>e.destroy()),this.signals.clear(),this.changeSubscribers.clear(),this.lastValues.clear(),this.destroyed=!0}};var kr={maxListeners:100,async:!1,interceptors:!0},st=class{constructor(e){this.listeners=new Map;this.onceListeners=new Map;this.interceptors=new Map;this.options={...kr,...e}}on(e,t){return this.listeners.has(e)||this.listeners.set(e,new Set),this.listeners.get(e).add(t),this.checkMaxListeners(e),()=>this.off(e,t)}once(e,t){this.onceListeners.has(e)||this.onceListeners.set(e,new Set);let n=this.onceListeners.get(e);return n.add(t),this.listeners.has(e)||this.listeners.set(e,new Set),()=>{n.delete(t)}}off(e,t){let n=this.listeners.get(e);n&&(n.delete(t),n.size===0&&this.listeners.delete(e));let r=this.onceListeners.get(e);r&&(r.delete(t),r.size===0&&this.onceListeners.delete(e))}emit(e,t){let n=this.runInterceptors(e,t);if(n===null)return;let r=this.listeners.get(e);r&&Array.from(r).forEach(c=>{this.safeCallHandler(c,n)});let s=this.onceListeners.get(e);s&&(Array.from(s).forEach(c=>{s.delete(c),this.safeCallHandler(c,n)}),s.size===0&&this.onceListeners.delete(e))}async emitAsync(e,t){let n=await this.runInterceptorsAsync(e,t);if(n===null)return;let r=this.listeners.get(e);if(r){let o=Array.from(r).map(c=>this.safeCallHandlerAsync(c,n));await Promise.all(o)}let s=this.onceListeners.get(e);if(s){let c=Array.from(s).map(a=>(s.delete(a),this.safeCallHandlerAsync(a,n)));await Promise.all(c),s.size===0&&this.onceListeners.delete(e)}}intercept(e,t){if(!this.options.interceptors)return()=>{};this.interceptors.has(e)||this.interceptors.set(e,new Set);let n=this.interceptors.get(e);return n.add(t),()=>{n.delete(t),n.size===0&&this.interceptors.delete(e)}}removeAllListeners(e){e?(this.listeners.delete(e),this.onceListeners.delete(e)):(this.listeners.clear(),this.onceListeners.clear())}listenerCount(e){let t=this.listeners.get(e)?.size??0,n=this.onceListeners.get(e)?.size??0;return t+n}destroy(){this.listeners.clear(),this.onceListeners.clear(),this.interceptors.clear()}runInterceptors(e,t){if(!this.options.interceptors)return t;let n=this.interceptors.get(e);if(!n||n.size===0)return t;let r=t;for(let s of n)try{if(r=s(r),r===null)return null}catch(o){console.error("[EventBus] Error in interceptor:",o)}return r}async runInterceptorsAsync(e,t){if(!this.options.interceptors)return t;let n=this.interceptors.get(e);if(!n||n.size===0)return t;let r=t;for(let s of n)try{let o=s(r);if(r=o instanceof Promise?await o:o,r===null)return null}catch(o){console.error("[EventBus] Error in interceptor:",o)}return r}safeCallHandler(e,t){try{e(t)}catch(n){console.error("[EventBus] Error in event handler:",n)}}async safeCallHandlerAsync(e,t){try{let n=e(t);n instanceof Promise&&await n}catch(n){console.error("[EventBus] Error in event handler:",n)}}checkMaxListeners(e){let t=this.listenerCount(e);t>this.options.maxListeners&&console.warn(`[EventBus] Max listeners (${this.options.maxListeners}) exceeded for event: ${e}. Current count: ${t}. This may indicate a memory leak.`)}};var Mn=["debug","info","warn","error"],Sr=i=>{let t=`${i.scope?`[${i.scope}]`:"[ScarlettPlayer]"} ${i.message}`,n=i.metadata??"";switch(i.level){case"debug":console.debug(t,n);break;case"info":console.info(t,n);break;case"warn":console.warn(t,n);break;case"error":console.error(t,n);break}},ot=class i{constructor(e){this.level=e?.level??"warn",this.scope=e?.scope,this.enabled=e?.enabled??!0,this.handlers=e?.handlers??[Sr]}child(e){return new i({level:this.level,scope:this.scope?`${this.scope}:${e}`:e,enabled:this.enabled,handlers:this.handlers})}debug(e,t){this.log("debug",e,t)}info(e,t){this.log("info",e,t)}warn(e,t){this.log("warn",e,t)}error(e,t){this.log("error",e,t)}setLevel(e){this.level=e}setEnabled(e){this.enabled=e}addHandler(e){this.handlers.push(e)}removeHandler(e){let t=this.handlers.indexOf(e);t!==-1&&this.handlers.splice(t,1)}log(e,t,n){if(!this.enabled||!this.shouldLog(e))return;let r={level:e,message:t,timestamp:Date.now(),scope:this.scope,metadata:n};for(let s of this.handlers)try{s(r)}catch(o){console.error("[Logger] Handler error:",o)}}shouldLog(e){return Mn.indexOf(e)>=Mn.indexOf(this.level)}};var Ie=(C=>(C.SOURCE_NOT_SUPPORTED="SOURCE_NOT_SUPPORTED",C.SOURCE_LOAD_FAILED="SOURCE_LOAD_FAILED",C.PROVIDER_NOT_FOUND="PROVIDER_NOT_FOUND",C.PROVIDER_SETUP_FAILED="PROVIDER_SETUP_FAILED",C.PLUGIN_SETUP_FAILED="PLUGIN_SETUP_FAILED",C.PLUGIN_NOT_FOUND="PLUGIN_NOT_FOUND",C.PLAYBACK_FAILED="PLAYBACK_FAILED",C.MEDIA_DECODE_ERROR="MEDIA_DECODE_ERROR",C.MEDIA_NETWORK_ERROR="MEDIA_NETWORK_ERROR",C.MEDIA_APPEND_ERROR="MEDIA_APPEND_ERROR",C.MEDIA_BUFFER_FULL="MEDIA_BUFFER_FULL",C.PLAYLIST_INVALID="PLAYLIST_INVALID",C.UNKNOWN_ERROR="UNKNOWN_ERROR",C))(Ie||{}),at=class{constructor(e,t,n){this.errors=[];this.eventBus=e,this.logger=t,this.maxHistory=n?.maxHistory??10}handle(e,t){let n=this.normalizeError(e,t);return this.addToHistory(n),this.logError(n),this.eventBus.emit("error",n),n}record(e,t){let n=this.normalizeError(e,t);return this.addToHistory(n),this.logError(n),n}throw(e,t,n){let r={code:e,message:t,fatal:n?.fatal??this.isFatalCode(e),timestamp:Date.now(),context:n?.context,originalError:n?.originalError};return this.handle(r,n?.context)}getHistory(){return[...this.errors]}getLastError(){return this.errors[this.errors.length-1]??null}clearHistory(){this.errors=[]}hasFatalError(){return this.errors.some(e=>e.fatal)}normalizeError(e,t){return this.isPlayerError(e)?{...e,context:{...e.context,...t}}:{code:this.getErrorCode(e),message:e.message,fatal:this.isFatal(e,t),timestamp:Date.now(),context:t,originalError:e}}getErrorCode(e){let t=e.message.toLowerCase();return t.includes("quota")?"MEDIA_BUFFER_FULL":t.includes("append")||t.includes("sourcebuffer")||t.includes("arraybuffer")?"MEDIA_APPEND_ERROR":t.includes("network")?"MEDIA_NETWORK_ERROR":t.includes("decode")?"MEDIA_DECODE_ERROR":t.includes("source")?"SOURCE_LOAD_FAILED":t.includes("plugin")?"PLUGIN_SETUP_FAILED":t.includes("provider")?"PROVIDER_SETUP_FAILED":"UNKNOWN_ERROR"}isFatal(e,t){return t?.operation==="load"?!0:this.isFatalCode(this.getErrorCode(e))}isFatalCode(e){return["SOURCE_NOT_SUPPORTED","PROVIDER_NOT_FOUND","MEDIA_DECODE_ERROR"].includes(e)}isPlayerError(e){return typeof e=="object"&&e!==null&&"code"in e&&"message"in e&&"fatal"in e&&"timestamp"in e}addToHistory(e){this.errors.push(e),this.errors.length>this.maxHistory&&this.errors.shift()}logError(e){let t=`[${e.code}] ${e.message}`;e.fatal?this.logger.error(t,{code:e.code,context:e.context}):this.logger.warn(t,{code:e.code,context:e.context})}};var lt=class{constructor(e,t){this.detachedContainer=null;this.revoked=!1;this.cleanupFns=[];this.pluginId=e,this.stateManager=t.stateManager,this.eventBus=t.eventBus,this.playerContainer=t.container,this.getPluginFn=t.getPlugin,this.getProviderDiagnosticsFn=t.getProviderDiagnostics,this.logger={debug:(n,r)=>t.logger.debug(`[${e}] ${n}`,r),info:(n,r)=>t.logger.info(`[${e}] ${n}`,r),warn:(n,r)=>t.logger.warn(`[${e}] ${n}`,r),error:(n,r)=>t.logger.error(`[${e}] ${n}`,r)}}get container(){return this.revoked?(this.detachedContainer??(this.detachedContainer=document.createElement("div")),this.detachedContainer):this.playerContainer}getState(e){return this.stateManager.getValue(e)}setState(e,t){this.revoked||this.stateManager.set(e,t)}defineState(e,t){this.revoked||this.stateManager.define(e,t)}on(e,t){return this.revoked?()=>{}:this.eventBus.on(e,t)}off(e,t){this.eventBus.off(e,t)}emit(e,t){this.revoked||this.eventBus.emit(e,t)}getPlugin(e){return this.getPluginFn(e)}onDestroy(e){this.cleanupFns.push(e)}subscribeToState(e){return this.revoked?()=>{}:this.stateManager.subscribe(e)}getProviderDiagnostics(){return this.getProviderDiagnosticsFn?this.getProviderDiagnosticsFn():{}}runCleanups(){for(let e of this.cleanupFns)try{e()}catch(t){this.logger.error("Cleanup function failed",{error:t})}this.cleanupFns=[]}revoke(){return this.revoked?!1:(this.revoked=!0,this.runCleanups(),!0)}restore(){this.revoked=!1}getCleanupFns(){return this.cleanupFns}};var Ae={MAX_ERRORS:20,MAX_TIME_RANGES:32,MAX_OBJECT_KEYS:64,MAX_ARRAY_ITEMS:50,MAX_NESTING_DEPTH:4,MAX_NODES:500},_n=new Set(["__proto__","constructor","prototype"]),Lr=/(token|secret|password|credential|auth|authorization|cookie|session|signature)/i,Tr=/^[A-Za-z][A-Za-z0-9_]{0,39}$/,xr=new Set(["id","userid","viewerid","uid","email","ip","url","uri","src","href","key"]),An=new Set(["hls.js","native","new","connecting","connected","disconnected","failed","closed","checking","completed","stable","have-local-offer","have-remote-offer","have-local-pranswer","have-remote-pranswer"]),rn=!1,Pr=new Set(["playback","network","media","source","player","access","unknown"]),Mr=["httpStatus","mediaErrorCode","networkState","readyState","attempts"],_r=["retriesExhausted","reconnectExhausted","reconnecting","timedOut"];function Cn(i){if(typeof i!="string"||i.trim()==="")return null;try{let e=typeof document<"u"?document.baseURI:void 0,t=new URL(i,e);return t.protocol==="blob:"||t.protocol==="data:"?null:t.hostname||null}catch{return null}}function Kt(i,e=1,t=new WeakSet,n={omitted:0}){if(i===void 0)return;if(e>Ae.MAX_NESTING_DEPTH){n.omitted++;return}if(n.nodes=(n.nodes??0)+1,n.nodes>Ae.MAX_NODES){n.omitted++;return}if(i===null)return null;if(typeof i=="boolean")return i;if(typeof i=="number")return Number.isFinite(i)?i:null;if(typeof i=="string"){if(An.has(i))return i;n.omitted++;return}if(typeof i!="object"||typeof i.then=="function"||i instanceof Promise){n.omitted++;return}if(t.has(i)){n.omitted++;return}if(t.add(i),Array.isArray(i)){let o=[],c=Math.min(i.length,Ae.MAX_ARRAY_ITEMS);n.omitted+=i.length-c;for(let a=0;a<c;a++){if(n.nodes>=Ae.MAX_NODES){n.omitted+=c-a;break}try{let u=Kt(i[a],e+1,t,n);u!==void 0&&o.push(u)}catch{n.omitted++}}return o}if(!Ar(i)){n.omitted++;return}let r=Object.create(null),s=Object.keys(i);for(let o=0;o<s.length;o++){if(o>=Ae.MAX_OBJECT_KEYS||n.nodes>=Ae.MAX_NODES){n.omitted+=s.length-o;break}let c=s[o];if(!Cr(c)){n.omitted++;continue}try{let a=i[c],u=Kt(a,e+1,t,n);u!==void 0&&(r[c]=u)}catch{n.omitted++}}return r}function Ar(i){try{let e=Object.getPrototypeOf(i);return e===null||e===Object.prototype}catch{return!1}}function Cr(i){return Tr.test(i)&&!_n.has(i)&&!xr.has(i.toLowerCase())&&!Lr.test(i)}function $t(i,e){let t=Object.create(null);if(rn)return t;rn=!0;try{Rr(t,i,e)}finally{rn=!1}return t}function Rr(i,e,t){for(let n of e)if(!(!n||typeof n.id!="string")&&!_n.has(n.id)){if(typeof n.getDiagnostics!="function"){i[n.id]=null;continue}try{let r=n.getDiagnostics();if(r==null)i[n.id]=null;else if(typeof r.then=="function"||r instanceof Promise)i[n.id]={unavailable:!0};else{let s={omitted:0},o=Kt(r,1,new WeakSet,s);i[n.id]=o!==void 0?o:{unavailable:!0},s.omitted>0&&t?.push(n.id)}}catch{i[n.id]={unavailable:!0}}}t?.sort()}function Rn(i){if(i.context?.category&&Pr.has(i.context.category))return i.context.category;let e=i.detail||{};return[401,403,451].includes(e.httpStatus)?"access":i.code==="MEDIA_NETWORK_ERROR"||i.code==="SOURCE_LOAD_FAILED"||e.type==="network"?"network":i.code==="MEDIA_DECODE_ERROR"||i.code==="MEDIA_APPEND_ERROR"||i.code==="MEDIA_BUFFER_FULL"||e.type==="media"?"media":i.code==="SOURCE_NOT_SUPPORTED"||i.code==="PLAYLIST_INVALID"||i.code==="PROVIDER_NOT_FOUND"?"source":i.code==="PLAYBACK_FAILED"?"playback":i.code==="PROVIDER_SETUP_FAILED"||i.code==="PLUGIN_SETUP_FAILED"||i.code==="PLUGIN_NOT_FOUND"?"player":e.mediaErrorCode===2?"network":e.mediaErrorCode===3?"media":e.mediaErrorCode===4?"source":"unknown"}function Hn(i,e=Ae.MAX_ERRORS){let t=[],n=new Set(Object.values(Ie)),r=e>0?i.slice(-e):[];for(let s of r){let o=n.has(s.code)?s.code:"UNKNOWN_ERROR",c=Rn(s),a=!!s.fatal,u=Number.isFinite(s.timestamp)?s.timestamp:Date.now(),v={code:o,category:c,fatal:a,timestamp:u};if(s.detail&&typeof s.detail=="object"){let x={},N=!1;for(let C of Mr){let L=s.detail[C];typeof L=="number"&&Number.isFinite(L)&&(x[C]=L,N=!0)}for(let C of _r){let L=s.detail[C];typeof L=="boolean"&&(x[C]=L,N=!0)}N&&(v.detail=x)}t.push(v)}return t}function sn(i,e,t){if(t||!i)return{playbackState:"destroyed",playing:!1,paused:!1,ended:!1,buffering:!1,seeking:!1,currentTime:null,duration:null,volume:null,muted:null,playbackRate:null,mediaType:null,live:null,seekableRange:null,liveEdge:null,liveLatency:null,dimensions:null,source:null};let n=i.snapshot(),r=Number.isFinite(n.currentTime)?n.currentTime:null,s=Number.isFinite(n.duration)?n.duration:null,o=Number.isFinite(n.volume)?n.volume:null,c=Number.isFinite(n.playbackRate)?n.playbackRate:null,a=null;(n.mediaType==="video"||n.mediaType==="audio")&&(a=n.mediaType);let u=null;n.seekableRange&&typeof n.seekableRange.start=="number"&&typeof n.seekableRange.end=="number"&&Number.isFinite(n.seekableRange.start)&&Number.isFinite(n.seekableRange.end)&&(u={start:n.seekableRange.start,end:n.seekableRange.end});let v=null,x=null;n.live&&(v=typeof n.liveEdge=="boolean"?n.liveEdge:null,x=Number.isFinite(n.liveLatency)?n.liveLatency:null);let N=null;if(e){let L=e.querySelector("video");L&&L.videoWidth>0&&L.videoHeight>0&&(N={width:L.videoWidth,height:L.videoHeight})}let C=null;return n.source&&n.source.src&&(C={hostname:Cn(n.source.src),...n.source.type?{type:n.source.type}:{}}),{playbackState:n.playbackState||"idle",playing:!!n.playing,paused:!!n.paused,ended:!!n.ended,buffering:!!n.buffering,seeking:!!n.seeking,currentTime:r,duration:s,volume:o,muted:typeof n.muted=="boolean"?n.muted:!1,playbackRate:c,mediaType:a,live:!!n.live,seekableRange:u,liveEdge:v,liveLatency:x,dimensions:N,source:C}}function on(i){let e=Date.now(),t=i.playerVersion;if(i.isDestroyed||!i.stateManager)return{schemaVersion:1,timestamp:e,playerVersion:t,playbackState:sn(null,null,!0),errors:[],providers:Object.create(null),truncatedProviders:[]};let n=sn(i.stateManager,i.container,!1),r=i.errorHandler?Hn(i.errorHandler.getHistory()):[],s=i.pluginManager?i.pluginManager.getReadyPlugins().filter(a=>a.type==="provider"):[],o=[],c=$t(s,o);return{schemaVersion:1,timestamp:e,playerVersion:t,playbackState:n,errors:r,providers:c,truncatedProviders:o}}var ct=class{constructor(e,t,n,r){this.plugins=new Map;this.initPromises=new Map;this.destroyPromises=new Map;this.initializingStack=new Set;this.eventBus=e,this.stateManager=t,this.logger=n,this.container=r.container}register(e,t){if(this.plugins.has(e.id))throw new Error(`Plugin "${e.id}" is already registered`);this.validatePlugin(e);let n=new lt(e.id,{stateManager:this.stateManager,eventBus:this.eventBus,logger:this.logger,container:this.container,getPlugin:r=>this.getReadyPlugin(r),getProviderDiagnostics:()=>this.getProviderDiagnostics()});this.plugins.set(e.id,{plugin:e,state:"registered",config:t,cleanupFns:[],api:n}),this.logger.info(`Plugin registered: ${e.id}`),this.eventBus.emit("plugin:registered",{name:e.id,type:e.type})}async unregister(e){let t=this.plugins.get(e);t&&(t.state==="ready"&&await this.destroyPlugin(e),this.plugins.delete(e),this.logger.info(`Plugin unregistered: ${e}`))}async initAll(){let e=this.resolveDependencyOrder();for(let t of e)await this.initPlugin(t)}async initPlugin(e){let t=this.plugins.get(e);if(!t)throw new Error(`Plugin "${e}" not found`);let n=this.destroyPromises.get(e);if(n&&await n,t.state==="ready")return;if(this.initializingStack.has(e))throw new Error(`Plugin "${e}" is already initializing (possible circular dependency)`);let r=this.initPromises.get(e);if(r)return r;if(t.state==="initializing"){let o=this.initPromises.get(e);return o||void 0}let s=(async()=>{this.initializingStack.add(e);try{for(let o of t.plugin.dependencies||[]){let c=this.plugins.get(o);if(!c)throw new Error(`Plugin "${e}" depends on missing plugin "${o}"`);c.state!=="ready"&&await this.initPlugin(o)}}finally{this.initializingStack.delete(e)}try{if(t.state="initializing",t.api.restore(),t.plugin.onStateChange){let o=this.stateManager.subscribe(t.plugin.onStateChange.bind(t.plugin));t.api.onDestroy(o)}if(t.plugin.onError){let o=this.eventBus.on("error",c=>{t.plugin.onError?.(c.originalError||new Error(c.message))});t.api.onDestroy(o)}await t.plugin.init(t.api,t.config),t.state="ready",this.logger.info(`Plugin ready: ${e}`),this.eventBus.emit("plugin:active",{name:e})}catch(o){throw t.state="error",t.error=o,t.api.runCleanups(),this.logger.error(`Plugin init failed: ${e}`,{error:o}),this.eventBus.emit("plugin:error",{name:e,error:o}),o}finally{this.initPromises.delete(e)}})();return this.initPromises.set(e,s),s}async destroyAll(){let e=this.resolveDependencyOrder().reverse();for(let t of e){let n=this.destroyPlugin(t);if(this.initPromises.has(t)){n.catch(()=>{});continue}await n}}async destroyPlugin(e){let t=this.destroyPromises.get(e);if(t)return t;let n=this.plugins.get(e);if(!n)return;let r=this.initPromises.get(e);if(!r&&n.state!=="ready")return;let s=(async()=>{if(r)try{await r}catch{}if(n.state!=="ready"){n.api.runCleanups();return}try{await n.plugin.destroy()}catch(o){this.logger.error(`Plugin destroy failed: ${e}`,{error:o})}finally{n.api.runCleanups(),n.state="registered",this.eventBus.emit("plugin:destroyed",{name:e})}})();this.destroyPromises.set(e,s);try{await s}finally{this.destroyPromises.get(e)===s&&this.destroyPromises.delete(e)}}abandonPlugin(e){let t=this.plugins.get(e);return!t||!this.destroyPromises.has(e)?!1:t.api.revoke()}getPlugin(e){let t=this.plugins.get(e);return t?t.plugin:null}getReadyPlugin(e){let t=this.plugins.get(e);return t?.state==="ready"?t.plugin:null}hasPlugin(e){return this.plugins.has(e)}getPluginState(e){return this.plugins.get(e)?.state??null}getPluginIds(){return Array.from(this.plugins.keys())}getReadyPlugins(){return Array.from(this.plugins.values()).filter(e=>e.state==="ready").map(e=>e.plugin)}getPluginsByType(e){return Array.from(this.plugins.values()).filter(t=>t.plugin.type===e).map(t=>t.plugin)}getProviderDiagnostics(){let e=this.getReadyPlugins().filter(t=>t.type==="provider");return $t(e)}selectProvider(e){let t=this.getPluginsByType("provider");for(let n of t){let r=n.canPlay;if(typeof r=="function"&&r(e))return n}return null}resolveDependencyOrder(){let e=new Set,t=new Set,n=[],r=(s,o=[])=>{if(e.has(s))return;if(t.has(s)){let a=[...o,s].join(" -> ");throw new Error(`Circular dependency detected: ${a}`)}let c=this.plugins.get(s);if(c){t.add(s);for(let a of c.plugin.dependencies||[])this.plugins.has(a)&&r(a,[...o,s]);t.delete(s),e.add(s),n.push(s)}};for(let s of this.plugins.keys())r(s);return n}validatePlugin(e){if(!e.id||typeof e.id!="string")throw new Error("Plugin must have a valid id");if(!e.name||typeof e.name!="string")throw new Error(`Plugin "${e.id}" must have a valid name`);if(!e.version||typeof e.version!="string")throw new Error(`Plugin "${e.id}" must have a valid version`);if(!e.type||typeof e.type!="string")throw new Error(`Plugin "${e.id}" must have a valid type`);if(typeof e.init!="function")throw new Error(`Plugin "${e.id}" must have an init() method`);if(typeof e.destroy!="function")throw new Error(`Plugin "${e.id}" must have a destroy() method`)}};function an(i){return i.querySelector("video")}function Ne(i){let e=document,t=e.fullscreenElement??e.webkitFullscreenElement??null;return t&&i.contains(t)?!0:!!an(i)?.webkitDisplayingFullscreen}async function Oe(i){let e=i;if(e.requestFullscreen){await e.requestFullscreen();return}if(e.webkitRequestFullscreen){await e.webkitRequestFullscreen();return}let t=an(i);if(t?.webkitEnterFullscreen){t.webkitEnterFullscreen();return}throw new Error("Fullscreen is not supported")}async function Fe(i){let e=an(i);if(e?.webkitDisplayingFullscreen){e.webkitExitFullscreen?.();return}let t=document;if(t.exitFullscreen){await t.exitFullscreen();return}t.webkitExitFullscreen&&await t.webkitExitFullscreen()}function re(i){if(i)try{let e=new URL(i);return e.protocol!=="http:"&&e.protocol!=="https:"?void 0:`${e.origin}${e.pathname}`}catch{return}}var Dn=1e4,qt=class{constructor(e){this._currentProvider=null;this.destroyed=!1;this.seekingWhilePlaying=!1;this.seekResumeTimeout=null;this.initialSrcLoaded=!1;this.loadGeneration=0;this.requestedSource=null;this.providerTeardown=null;this.teardownWaits=new Set;this.pendingRecoveryAutoplay=null;this.playbackCommands=0;this.lastPlaybackCommand=null;this.pendingUnload=null;this.listenersWired=!1;this.readyEmitted=!1;this.fullscreenAnnounced=!1;this.unwireFullscreen=null;this.destroyPromise=null;this.initializing=null;if(typeof e.container=="string"){let t=document.querySelector(e.container);if(!t||!(t instanceof HTMLElement))throw new Error(`ScarlettPlayer: container not found: ${e.container}`);this.container=t}else if(e.container instanceof HTMLElement)this.container=e.container;else throw new Error("ScarlettPlayer requires a valid HTMLElement container or CSS selector");if(this.initialSrc=e.src,this.eventBus=new st,this.stateManager=new it({autoplay:e.autoplay??!1,loop:e.loop??!1,volume:e.volume??1,muted:e.muted??!1,poster:e.poster??""}),this.logger=new ot({level:e.logLevel??"warn",scope:"ScarlettPlayer"}),this.errorHandler=new at(this.eventBus,this.logger),this.pluginManager=new ct(this.eventBus,this.stateManager,this.logger,{container:this.container}),this.eventBus.on("error",t=>{this.stateManager.set("error",t)}),this.eventBus.on("media:loaded",()=>{this.stateManager.set("error",null)}),this.eventBus.on("media:error",({error:t})=>{this.errorHandler.record(t,{channel:"media:error"})}),this.wireFullscreenListeners(),e.plugins)for(let t of e.plugins)this.pluginManager.register(t);this.logger.info("ScarlettPlayer constructed",{autoplay:e.autoplay,plugins:e.plugins?.length??0})}ensureInitialized(){return this.initializing?this.initializing:(this.initializing=this.runInitialization().finally(()=>{this.initializing=null}),this.initializing)}async runInitialization(){for(let e of this.pluginManager.getPluginIds()){if(this.destroyed)return;let t=this.pluginManager.getPlugin(e);!t||t.type==="provider"||this.pluginManager.getPluginState(e)==="registered"&&await this.pluginManager.initPlugin(e)}this.destroyed||(this.wireLifecycleListeners(),this.readyEmitted||(this.readyEmitted=!0,this.eventBus.emit("player:ready",void 0)))}wireLifecycleListeners(){this.listenersWired||(this.listenersWired=!0,this.eventBus.on("live:seektolive",()=>{this.destroyed||this.seekToLive()}),this.eventBus.on("media:load-request",async({src:e,autoplay:t})=>{this.stateManager.getValue("chromecastActive")||await this.load(e,{autoplay:t!==!1})}),this.eventBus.on("error:recovered",()=>{let e=this.pendingRecoveryAutoplay;!e||this.destroyed||(this.pendingRecoveryAutoplay=null,e.generation===this.loadGeneration&&(!e.shouldPlay||!this.stateManager.getValue("paused")||this.play().catch(t=>{this.logger.warn("Autoplay after recovery failed",{error:t?.message})})))}),this.eventBus.on("error:retry",async({src:e})=>{let t=this.stateManager.getValue("live"),n=this.stateManager.getValue("currentTime");await this.load(e),!this.destroyed&&(this.stateManager.getValue("error")||(t?this.seekToLive():n>0&&this.seek(n),!this.destroyed&&await this.play()))}))}async init(){this.checkDestroyed(),await this.ensureInitialized(),this.initialSrc&&!this.initialSrcLoaded&&(this.initialSrcLoaded=!0,await this.load(this.initialSrc))}async load(e,t){this.checkDestroyed(),this.initialSrcLoaded=!0;let n=++this.loadGeneration;this.requestedSource=e,this.pendingRecoveryAutoplay=null;let r=this.playbackCommands;try{if(this.logger.info("Loading source",{source:e}),this.stateManager.update({playing:!1,paused:!0,ended:!1,buffering:!0,currentTime:0,duration:0,bufferedAmount:0,playbackState:"loading",error:null,live:!1}),this._currentProvider){let c=this._currentProvider.id;this.logger.info("Destroying previous provider",{provider:c}),await this.waitForTeardown(this.pluginManager.destroyPlugin(c),c),this._currentProvider=null}if(this.providerTeardown&&await this.waitForTeardown(this.providerTeardown.promise,this.providerTeardown.providerId),await this.ensureInitialized(),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}let s=this.pluginManager.selectProvider(e);if(!s){this.errorHandler.throw("PROVIDER_NOT_FOUND",`No provider found for source: ${e}`,{fatal:!0,context:{source:e}});return}if(this._currentProvider=s,this.logger.info("Provider selected",{provider:s.id}),await this.pluginManager.initPlugin(s.id),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}if(this.stateManager.set("source",{src:e,type:this.detectMimeType(e)}),typeof s.loadSource=="function"&&await s.loadSource(e),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}(t?.autoplay??this.stateManager.getValue("autoplay"))&&await this.play()}catch(s){if(n===this.loadGeneration){let o=this.playbackCommands!==r;this.pendingRecoveryAutoplay={generation:n,shouldPlay:o?this.lastPlaybackCommand==="play":!!(t?.autoplay??this.stateManager.getValue("autoplay"))},this.stateManager.getValue("error")?this.logger.error("Load failed",{source:re(e),error:s.message}):this.errorHandler.handle(s,{operation:"load",source:re(e)})}}}async unload(){if(this.checkDestroyed(),this.pendingUnload&&this.pendingUnload.generation===this.loadGeneration)return this.pendingUnload.promise;let e=this._currentProvider,t=this.requestedSource;if(!e&&t===null&&!this.providerTeardown)return;let n=++this.loadGeneration;this.pendingRecoveryAutoplay=null;let r=this.runUnload(n,e,t),s={generation:n,promise:r};this.pendingUnload=s;try{await r}finally{this.pendingUnload===s&&(this.pendingUnload=null)}}async runUnload(e,t,n){if(this.logger.info("Unloading source"),this._currentProvider=null,this.requestedSource=null,this.seekingWhilePlaying=!1,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),t){let s=this.pluginManager.destroyPlugin(t.id).catch(c=>{this.logger.error("Error destroying provider during unload",{provider:t.id,error:c.message})}),o={promise:s,providerId:t.id};this.providerTeardown=o;try{await this.waitForTeardown(s,t.id)}finally{this.providerTeardown===o&&(this.providerTeardown=null)}}else this.providerTeardown&&await this.waitForTeardown(this.providerTeardown.promise,this.providerTeardown.providerId);if(e!==this.loadGeneration)return;let r=this.stateManager.getValue("lowLatencyMode");this.stateManager.update({source:null,playbackState:"idle",playing:!1,paused:!0,ended:!1,buffering:!1,waiting:!1,seeking:!1,currentTime:0,duration:0,buffered:null,bufferedAmount:0,error:null,mediaType:"unknown",qualities:[],currentQuality:null,audioTracks:[],currentAudioTrack:null,textTracks:[],currentTextTrack:null,live:!1,liveEdge:!1,seekableRange:null,liveLatency:0,lowLatencyMode:!1}),r&&this.eventBus.emit("live:lowlatency",{enabled:!1}),this.logger.info("Source unloaded"),this.eventBus.emit("source:unloaded",{src:n})}async waitForTeardown(e,t){let n,r,s=new Promise(o=>{r=o,n=setTimeout(()=>{this.logger.warn(`Provider teardown did not settle within ${Dn} ms: its init() or destroy() is still pending; cutting it off and going ahead. A load() that needs this provider again still waits for it`,{provider:t}),this.isolateProvider(t),o()},Dn)});this.teardownWaits.add(r);try{await Promise.race([e,s])}finally{clearTimeout(n),this.teardownWaits.delete(r)}}isolateProvider(e){if(this.pluginManager.abandonPlugin(e))for(let t of Array.from(this.container.querySelectorAll("video, audio"))){try{t.pause()}catch{}t.remove()}}async play(){this.checkDestroyed(),this.playbackCommands++,this.lastPlaybackCommand="play",this.pendingRecoveryAutoplay&&(this.pendingRecoveryAutoplay.shouldPlay=!0);try{this.logger.debug("Play requested"),this.eventBus.emit("playback:play",void 0)}catch(e){this.errorHandler.handle(e,{operation:"play"})}}pause(){this.checkDestroyed(),this.playbackCommands++,this.lastPlaybackCommand="pause",this.pendingRecoveryAutoplay&&(this.pendingRecoveryAutoplay.shouldPlay=!1);try{this.logger.debug("Pause requested"),this.seekingWhilePlaying=!1,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:pause",void 0)}catch(e){this.errorHandler.handle(e,{operation:"pause"})}}seek(e){if(this.checkDestroyed(),!Number.isFinite(e)){this.logger.warn("Invalid seek time",{time:e});return}try{this.logger.debug("Seek requested",{time:e}),this.stateManager.getValue("playing")&&(this.seekingWhilePlaying=!0),this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:seeking",{time:e}),this.stateManager.set("currentTime",e),this.seekingWhilePlaying&&(this.seekResumeTimeout=setTimeout(()=>{this.seekingWhilePlaying&&this.stateManager.getValue("playing")&&(this.logger.debug("Resuming playback after seek"),this.seekingWhilePlaying=!1,this.eventBus.emit("playback:play",void 0)),this.seekResumeTimeout=null},300))}catch(t){this.errorHandler.handle(t,{operation:"seek",time:e})}}setVolume(e){this.checkDestroyed();let t=Math.max(0,Math.min(1,e));this.stateManager.set("volume",t),this.eventBus.emit("volume:change",{volume:t,muted:this.stateManager.getValue("muted")})}setMuted(e){this.checkDestroyed(),this.stateManager.set("muted",e),this.eventBus.emit("volume:mute",{muted:e})}setPlaybackRate(e){this.checkDestroyed();let t=Math.max(.0625,Math.min(16,e));this.stateManager.set("playbackRate",t),this.eventBus.emit("playback:ratechange",{rate:t})}setAutoplay(e){this.checkDestroyed(),this.stateManager.set("autoplay",e),this.logger.debug("Autoplay set",{autoplay:e})}setPoster(e){this.checkDestroyed(),this.stateManager.set("poster",e),this.logger.debug("Poster set",{poster:e})}on(e,t){return this.checkDestroyed(),this.eventBus.on(e,t)}once(e,t){return this.checkDestroyed(),this.eventBus.once(e,t)}getPlugin(e){return this.checkDestroyed(),this.pluginManager.getPlugin(e)}registerPlugin(e){this.checkDestroyed(),this.pluginManager.register(e)}getState(){return this.checkDestroyed(),this.stateManager.snapshot()}subscribeToState(e){return this.checkDestroyed(),this.stateManager.subscribe(e)}getQualities(){if(this.checkDestroyed(),!this._currentProvider)return[];let e=this._currentProvider;return typeof e.getLevels=="function"?e.getLevels():[]}setQuality(e){if(this.checkDestroyed(),!this._currentProvider){this.logger.warn("No provider available for quality change");return}let t=this._currentProvider;if(typeof t.setLevel=="function"){if(e!==-1){let n=this.getQualities();if(n.length>0&&(e<0||e>=n.length)){this.logger.warn(`Invalid quality index: ${e} (available: ${n.length})`);return}}t.setLevel(e),this.eventBus.emit("quality:change",{quality:e===-1?"auto":`level-${e}`,auto:e===-1})}}getCurrentQuality(){if(this.checkDestroyed(),!this._currentProvider)return-1;let e=this._currentProvider;return typeof e.getCurrentLevel=="function"?e.getCurrentLevel():-1}wireFullscreenListeners(){let e=()=>{this.fullscreenAnnounced=!0,this.setFullscreenState(Ne(this.container))};document.addEventListener("fullscreenchange",e),document.addEventListener("webkitfullscreenchange",e),this.container.addEventListener("webkitbeginfullscreen",e,!0),this.container.addEventListener("webkitendfullscreen",e,!0),this.unwireFullscreen=()=>{document.removeEventListener("fullscreenchange",e),document.removeEventListener("webkitfullscreenchange",e),this.container.removeEventListener("webkitbeginfullscreen",e,!0),this.container.removeEventListener("webkitendfullscreen",e,!0)}}setFullscreenState(e){this.stateManager.getValue("fullscreen")!==e&&(this.stateManager.set("fullscreen",e),this.eventBus.emit("fullscreen:change",{fullscreen:e}))}async requestFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Oe(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!0),this.eventBus.emit("fullscreen:change",{fullscreen:!0}))}catch(e){this.logger.error("Fullscreen request failed",{error:e})}}async exitFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Fe(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!1),this.eventBus.emit("fullscreen:change",{fullscreen:!1}))}catch(e){this.logger.error("Exit fullscreen failed",{error:e})}}async toggleFullscreen(){this.fullscreen?await this.exitFullscreen():await this.requestFullscreen()}requestAirPlay(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.showPicker=="function"?e.showPicker():this.logger.warn("AirPlay plugin not available")}async requestChromecast(){this.checkDestroyed();let e=this.pluginManager.getPlugin("chromecast");e&&typeof e.requestSession=="function"?await e.requestSession():this.logger.warn("Chromecast plugin not available")}stopCasting(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.stop=="function"&&e.stop();let t=this.pluginManager.getPlugin("chromecast");t&&typeof t.stopSession=="function"&&t.stopSession()}seekToLive(){if(this.checkDestroyed(),!this.stateManager.getValue("live")){this.logger.warn("Not a live stream");return}if(this._currentProvider){let r=this._currentProvider;if(typeof r.getLiveInfo=="function"){let s=r.getLiveInfo();if(s?.liveSyncPosition!==void 0){this.seek(s.liveSyncPosition);return}}}let t=this.stateManager.getValue("seekableRange");if(t?.end!==void 0){this.seek(t.end);return}let n=this.stateManager.getValue("duration");Number.isFinite(n)&&n>0&&this.seek(n)}destroy(){return this.destroyPromise?this.destroyPromise:this.destroyed?Promise.resolve():(this.destroyPromise=(async()=>{this.logger.info("Destroying player"),this.destroyed=!0,this.loadGeneration++,this.pendingRecoveryAutoplay=null;for(let e of this.teardownWaits)e();this.teardownWaits.clear(),this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.unwireFullscreen?.(),this.unwireFullscreen=null,this.eventBus.emit("player:destroy",void 0);try{await this.pluginManager.destroyAll()}catch(e){this.logger.error("Error during plugin destruction",e)}this.eventBus.destroy(),this.stateManager.destroy(),this.logger.info("Player destroyed")})(),this.destroyPromise)}getDiagnostics(){return on({stateManager:this.stateManager,errorHandler:this.errorHandler,pluginManager:this.pluginManager,container:this.container,isDestroyed:this.destroyed,playerVersion:nn})}get playing(){return this.stateManager.getValue("playing")}get paused(){return this.stateManager.getValue("paused")}get currentTime(){return this.stateManager.getValue("currentTime")}get duration(){return this.stateManager.getValue("duration")}get volume(){return this.stateManager.getValue("volume")}get muted(){return this.stateManager.getValue("muted")}get playbackRate(){return this.stateManager.getValue("playbackRate")}get bufferedAmount(){return this.stateManager.getValue("bufferedAmount")}get currentProvider(){return this._currentProvider}get fullscreen(){return this.stateManager.getValue("fullscreen")}get live(){return this.stateManager.getValue("live")}get autoplay(){return this.stateManager.getValue("autoplay")}get poster(){return this.stateManager.getValue("poster")}checkDestroyed(){if(this.destroyed)throw new Error("Cannot call methods on destroyed player")}detectMimeType(e){let t=e;try{t=new URL(e).pathname}catch{let r=e.split("?")[0]??e;t=r.split("#")[0]??r}switch(t.split(".").pop()?.toLowerCase()??""){case"m3u8":return"application/x-mpegURL";case"mpd":return"application/dash+xml";case"mp4":case"m4v":return"video/mp4";case"webm":return"video/webm";case"ogg":case"ogv":return"video/ogg";case"mov":return"video/quicktime";case"mkv":return"video/x-matroska";case"mp3":return"audio/mpeg";case"wav":return"audio/wav";case"flac":return"audio/flac";case"aac":case"m4a":return"audio/mp4";default:return"video/mp4"}}};async function ln(i){let e=new qt(i);return await e.init(),e}function cn(i){return i<10?`0${i}`:`${i}`}function ve(i){if(!isFinite(i)||isNaN(i))return"0:00";let e=Math.abs(i),t=Math.floor(e/3600),n=Math.floor(e%3600/60),r=Math.floor(e%60),s=i<0?"-":"";return t>0?`${s}${t}:${cn(n)}:${cn(r)}`:`${s}${n}:${cn(r)}`}function Ce(i){return!Number.isFinite(i)||i<=0?"LIVE":`-${ve(i)}`}var ut={play:"M8 5v14l11-7z",volumeHigh:"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",volumeMuted:"M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"};var Wt=new Map;function un(i,e){if(typeof document>"u")return()=>{};let t=document.getElementById(i),n=Wt.get(i);(!n||!t)&&(n={generation:(n?.generation??0)+1,holders:0,element:t},Wt.set(i,n)),n.holders+=1;let{generation:r}=n;if(!t){let o=document.createElement("style");o.id=i,o.textContent=e,document.head.appendChild(o),n.element=o}let s=!1;return()=>{if(s)return;s=!0;let o=Wt.get(i);!o||o.generation!==r||(o.holders-=1,!(o.holders>0)&&(Wt.delete(i),o.element?.remove()))}}var dn={};mr(dn,{createHlsInstance:()=>Or,describeSupport:()=>Ir,getHlsConstructor:()=>Fr,isHLSSupported:()=>Dr,isHlsJsSupported:()=>Nn,loadHlsJs:()=>Nr,resetLoader:()=>Br,supportsNativeHLS:()=>In});var de=null,We=null,Hr=["application/vnd.apple.mpegurl","application/x-mpegURL"];function In(){if(typeof document>"u")return!1;let i=document.createElement("video");return Hr.some(e=>i.canPlayType(e)!=="")}function Nn(){return de?de.isSupported():typeof window>"u"?!1:!!(window.MediaSource||window.WebKitMediaSource)}function Dr(){return In()||Nn()}function Ir(){let i=typeof document>"u"?null:document.createElement("video"),e=n=>i?i.canPlayType(n):"",t=typeof window>"u"?{}:window;return{canPlayType:{"application/vnd.apple.mpegurl":e("application/vnd.apple.mpegurl"),"application/x-mpegURL":e("application/x-mpegURL")},MediaSource:typeof t.MediaSource,ManagedMediaSource:typeof t.ManagedMediaSource,WebKitMediaSource:typeof t.WebKitMediaSource,hlsJsLoaded:de!==null,hlsJsSupported:de?de.isSupported():null,userAgent:typeof navigator>"u"?"":navigator.userAgent}}async function Nr(){return de||We||(We=(async()=>{try{if(de=(await import("./hls-SXYGB37P.js")).default,!de.isSupported())throw new Error("hls.js is not supported in this browser");return de}catch(i){throw We=null,new Error(`Failed to load hls.js: ${i instanceof Error?i.message:"Unknown error"}`)}})(),We)}function Or(i){if(!de)throw new Error("hls.js is not loaded. Call loadHlsJs() first.");return new de(i)}function Fr(){return de}function Br(){de=null,We=null}function Be(i){if(i.name)return i.name;if(i.height){let e={2160:"4K",1440:"1440p",1080:"1080p",720:"720p",480:"480p",360:"360p",240:"240p",144:"144p"},t=Object.keys(e).map(Number).sort((n,r)=>Math.abs(n-i.height)-Math.abs(r-i.height))[0];return Math.abs(t-i.height)<=20?e[t]:`${i.height}p`}return i.bitrate?Vr(i.bitrate):"Unknown"}function Vr(i){return i>=1e6?`${(i/1e6).toFixed(1)} Mbps`:i>=1e3?`${Math.round(i/1e3)} Kbps`:`${i} bps`}function On(i,e){return i.map((t,n)=>({index:n,width:t.width||0,height:t.height||0,bitrate:t.bitrate||0,label:Be(t),codec:t.codecSet}))}function Fn(i){if(i!==void 0&&i>0)return i;let t=navigator.connection;if(t?.downlink&&t.downlink>0){let n=t.downlink*1e6;return Math.round(n*.85)}return 5e5}function ye(i){return typeof i=="number"&&Number.isFinite(i)?i:null}function Ur(i){if(!i)return null;let e=ye(i.fragmentStart)??ye(i.fragments?.[0]?.start)??0,t=ye(i.totalduration),n=ye(i.edge)??(t===null?null:e+t);return n===null?null:{start:e,end:n}}function Bn(i){let e=i?.seekable;if(!e||e.length===0)return null;let t=e.start(0),n=e.end(e.length-1);return!Number.isFinite(t)||!Number.isFinite(n)?null:{start:t,end:n}}function zr(i){if(!i)return null;let e=ye(i.targetduration);return ye(i.partHoldBack)??ye(i.holdBack)??(e!==null?e*3:null)}function Kr(i,e){let t=ye(i?.targetduration),n=t!==null?t/2:e/2;return Math.max(1.5,ye(i?.partTarget)??n)}function Ve(i){if(i.kind==="hls"){let{hls:o,details:c}=i,a=o.media,u=Ur(c)??Bn(a),v=ye(o.targetLatency)??zr(c)??3,x=ye(o.latency)??(u&&a?Math.max(0,u.end-a.currentTime):null);if(x===null&&u===null)return null;let N=x??0;return{latency:N,targetLatency:v,atEdge:N<=v+Kr(c,v),seekableRange:u,lowLatency:i.lowLatencyRequested!==!1&&(!!c?.partList?.length||c?.canBlockReload===!0)}}let{media:e}=i,t=Bn(e);if(!t)return null;let n=i.targetLatency??3,r=i.targetLatency===void 0?7:Math.max(1.5,i.targetLatency/2),s=Math.max(0,t.end-e.currentTime);return{latency:s,targetLatency:n,atEdge:s<=n+r,seekableRange:t,lowLatency:i.lowLatency===!0}}function pn(i,e){if(!e)return;let t=i.getState("liveLatency");Math.abs(t-e.latency)>.05&&(i.setState("liveLatency",e.latency),i.emit("live:latency",{latency:e.latency})),i.getState("liveEdge")!==e.atEdge&&(i.setState("liveEdge",e.atEdge),i.emit("live:edgechange",{atEdge:e.atEdge}));let n=e.seekableRange;if(n){let r=i.getState("seekableRange");(!r||Math.abs(r.start-n.start)>.05||Math.abs(r.end-n.end)>.05)&&(i.setState("seekableRange",{start:n.start,end:n.end}),i.emit("live:seekablerange",{start:n.start,end:n.end}))}i.getState("lowLatencyMode")!==e.lowLatency&&(i.setState("lowLatencyMode",e.lowLatency),i.emit("live:lowlatency",{enabled:e.lowLatency}))}function Gt(i){i.getState("lowLatencyMode")&&(i.setState("lowLatencyMode",!1),i.emit("live:lowlatency",{enabled:!1})),i.setState("liveLatency",0),i.setState("liveEdge",!1),i.setState("seekableRange",null)}var hn={NETWORK_ERROR:"networkError",MEDIA_ERROR:"mediaError",KEY_SYSTEM_ERROR:"keySystemError",MUX_ERROR:"muxError",OTHER_ERROR:"otherError"};function $r(i){switch(i){case hn.NETWORK_ERROR:return"network";case hn.MEDIA_ERROR:return"media";case hn.MUX_ERROR:return"mux";default:return"other"}}function qr(i){let e=i.frag,t=i.response,n=i.context;return{type:$r(i.type),details:i.details||"Unknown error",fatal:i.fatal||!1,url:i.url??e?.url??t?.url??n?.url,reason:i.reason,response:i.response}}function Wr(i){return`audio-${i}`}function Un(i){if(!i)return-1;let e=/^audio-(0|[1-9]\d*)$/.exec(i);return e?Number.parseInt(e[1],10):-1}function Gr(i,e,t){return{id:Wr(e),label:i.name||i.lang||`Audio ${e+1}`,language:i.lang,active:t}}function Vn(i,e){if(!i||typeof i!="object")return null;let{type:t,stats:n}=i;if(t!=="main"&&t!=="audio"&&t!=="subtitle")return null;let r=n?.loading?.start,s=n?.loading?.end,o=n?.loaded;return typeof r!="number"||!Number.isFinite(r)||typeof s!="number"||!Number.isFinite(s)||s<r||typeof o!="number"||!Number.isFinite(o)||o<0?null:{durationMs:s-r,bytes:o,ok:e,kind:t}}function zn(i,e,t){let n=[],r=(c,a)=>{i.on(c,a),n.push({event:c,handler:a})};r("hlsManifestParsed",(c,a)=>{e.logger.debug("HLS manifest parsed",{levels:a.levels.length});let u=a.levels.map((v,x)=>({id:`level-${x}`,label:Be(v),width:v.width,height:v.height,bitrate:v.bitrate,active:x===i.currentLevel}));e.setState("qualities",u),e.emit("quality:levels",{levels:u.map(v=>({id:v.id,label:v.label}))}),t.onManifestParsed?.(a.levels,a)}),r("hlsLevelSwitched",(c,a)=>{let u=i.levels[a.level],v=t.getIsAutoQuality?.()??i.autoLevelEnabled;if(e.logger.debug("HLS level switched",{level:a.level,height:u?.height,auto:v}),u){let x=v?`Auto (${Be(u)})`:Be(u);e.setState("currentQuality",{id:v?"auto":`level-${a.level}`,label:x,width:u.width,height:u.height,bitrate:u.bitrate,active:!0})}e.emit("quality:change",{quality:u?`level-${a.level}`:"auto",auto:v}),t.onLevelSwitched?.(a.level)});let s=(c,a)=>{let u=c.map((v,x)=>Gr(v,x,x===a));e.setState("audioTracks",u),e.setState("currentAudioTrack",u[a]??null)};r("hlsAudioTracksUpdated",(c,a)=>{let u=a.audioTracks??[];e.logger.debug("HLS audio tracks updated",{tracks:u.length}),s(u,i.audioTrack),t.onAudioTracksUpdated?.(u)}),r("hlsAudioTrackSwitched",(c,a)=>{e.logger.debug("HLS audio track switched",{id:a.id}),s(i.audioTracks??[],a.id),t.onAudioTrackSwitched?.(a.id)});let o=0;return r("hlsFragLoaded",(c,a)=>{let u=Vn(a?.frag,!0);u&&e.emit("media:segment",u);let v=Date.now();v-o>=2e3&&i.bandwidthEstimate&&(o=v,e.setState("bandwidth",Math.round(i.bandwidthEstimate))),t.onFragLoaded?.()}),r("hlsFragBuffered",()=>{e.setState("buffering",!1),t.onBufferUpdate?.(),t.onFragBuffered?.()}),r("hlsFragLoading",()=>{e.setState("buffering",!0)}),r("hlsLevelLoaded",(c,a)=>{a.details&&t.onPlaylistDetails?.(a.details),a.details?.live!==void 0&&(e.setState("live",a.details.live),a.details.live?(t.onLevelDetails?.(a.details),pn(e,Ve({kind:"hls",hls:i,details:a.details,lowLatencyRequested:t.isLowLatencyRequested?.()??!0}))):Gt(e),t.onLiveUpdate?.())}),r("hlsError",(c,a)=>{let u=qr(a);if(!u.fatal&&(u.details==="fragLoadError"||u.details==="fragLoadTimeOut")){let x=Vn(a.frag,!1);x&&e.emit("media:segment",x)}!u.fatal&&(u.details?.includes("bufferStalledError")||a.reason?.includes("buffer holes"))?e.logger.debug(`HLS buffer recovery: ${u.reason||u.details}`,{details:u.details,reason:u.reason}):u.fatal?e.logger.error(`HLS fatal error: ${u.details} (type=${u.type})`,{type:u.type,details:u.details,status:u.response?.code,url:re(u.url)}):e.logger.warn(`HLS error: ${u.details} (type=${u.type}, fatal=${u.fatal})`,{type:u.type,details:u.details,fatal:u.fatal,status:u.response?.code,url:re(u.url)}),t.onError?.(u)}),()=>{for(let{event:c,handler:a}of n)i.off(c,a);n.length=0,e.setState("audioTracks",[]),e.setState("currentAudioTrack",null)}}function gn(i,e,t,n){let r=[],s=(a,u)=>{i.addEventListener(a,u),r.push({event:a,handler:u})},o=()=>{i.ended||!e.getState("ended")||(e.setState("ended",!1),e.setState("playbackState",i.paused?"paused":"playing"))};s("play",()=>{e.setState("paused",!1),o()}),s("playing",()=>{e.setState("playing",!0),e.setState("paused",!1),e.setState("waiting",!1),e.setState("buffering",!1),e.setState("playbackState","playing"),o(),n&&(n.corePauseRequested=!1),n?.corePlayRequested?n.corePlayRequested=!1:e.emit("playback:play",void 0)}),s("pause",()=>{e.setState("playing",!1),e.setState("paused",!0),e.setState("playbackState","paused"),n&&(n.corePlayRequested=!1),n?.corePauseRequested?n.corePauseRequested=!1:e.emit("playback:pause",void 0)}),s("ended",()=>{e.setState("playing",!1),e.setState("ended",!0),e.setState("playbackState","ended"),e.emit("playback:ended",void 0)}),s("timeupdate",()=>{e.setState("currentTime",i.currentTime),e.emit("playback:timeupdate",{currentTime:i.currentTime}),(e.getState("live")||!Number.isFinite(i.duration))&&pn(e,t?t():Ve({kind:"media",media:i}))}),s("durationchange",()=>{let a=i.duration;!Number.isFinite(a)||a===1/0?(e.setState("live",!0),e.setState("duration",0)):e.setState("duration",a||0),e.emit("media:loadedmetadata",{duration:e.getState("duration")})}),s("waiting",()=>{e.setState("waiting",!0),e.setState("buffering",!0),e.emit("media:waiting",void 0)}),s("canplay",()=>{e.setState("waiting",!1),e.setState("playbackState","ready"),e.emit("media:canplay",void 0)}),s("canplaythrough",()=>{e.setState("buffering",!1),e.emit("media:canplaythrough",void 0)}),s("progress",()=>{if(i.buffered.length>0){let a=i.buffered.end(i.buffered.length-1),u=i.duration>0?a/i.duration:0;e.setState("bufferedAmount",u),e.setState("buffered",i.buffered),e.emit("media:progress",{buffered:u})}}),s("seeking",()=>{e.setState("currentTime",i.currentTime),e.setState("seeking",!0),o()}),s("seeked",()=>{e.setState("seeking",!1),e.emit("playback:seeked",{time:i.currentTime})}),s("volumechange",()=>{e.setState("volume",i.volume),e.setState("muted",i.muted),e.emit("volume:change",{volume:i.volume,muted:i.muted})}),s("ratechange",()=>{e.setState("playbackRate",i.playbackRate),e.emit("playback:ratechange",{rate:i.playbackRate})}),s("loadedmetadata",()=>{e.setState("duration",i.duration)}),s("error",()=>{let a=i.error;if(a){e.logger.error("Video element error",{code:a.code,message:a.message});let u=a.code===4?"Media source not supported":a.code===2?"Media network error":"Video playback error",v=new Error(a.message||u);typeof a.code=="number"&&a.code>0&&Object.assign(v,{code:a.code,detail:{mediaErrorCode:a.code,networkState:i.networkState,readyState:i.readyState}}),e.emit("media:error",{error:v})}}),s("enterpictureinpicture",()=>{e.setState("pip",!0),e.logger.debug("PiP: entered (standard)")}),s("leavepictureinpicture",()=>{e.setState("pip",!1),e.logger.debug("PiP: exited (standard)"),(!i.paused||e.getState("playing"))&&i.play().catch(()=>{})});let c=i;if("webkitPresentationMode"in i){let a=c.webkitPresentationMode;s("webkitpresentationmodechanged",()=>{let u=c.webkitPresentationMode,v=a==="picture-in-picture"&&u==="inline";a=u;let x=u==="picture-in-picture";e.setState("pip",x),e.logger.debug(`PiP: mode changed to ${u} (webkit)`),v&&i.paused&&i.play().catch(()=>{})})}return()=>{for(let{event:a,handler:u}of r)i.removeEventListener(a,u);r.length=0}}var Qr=["loadedmetadata","loadeddata","resize","playing"],jr=["addtrack","removetrack","change"];function fn(i){return typeof i=="object"&&i!==null&&typeof i.length=="number"}function Kn(i){let e=null,t=!1,n=!1,r=!1,s=null,o=[],c=null,a=!1,u=()=>t?"video":n?"audio":"unknown",v=()=>{let L=u();L!==c&&(c=L,i.setState("mediaType",L))},x=()=>{let L=s;if(!L)return;if(r&&L.videoWidth>0){t=!0;return}if(L.readyState<1)return;let j=L.videoTracks,G=L.audioTracks;if(fn(j)){if(j.length>0){t=!0;return}fn(G)&&G.length>0&&(n=!0)}},N=()=>{a||(x(),v())},C=()=>{for(let L of o)L();o=[],s=null};return{beginSource(L){a||e!==L&&(e=L,t=!1,n=!1,r=!1,c=null,v())},attach(L){if(!a){C(),s=L,r=!1;for(let j of Qr){let G=()=>{r=!0,N()};L.addEventListener(j,G),o.push(()=>L.removeEventListener(j,G))}for(let j of[s.videoTracks,s.audioTracks])if(!(!fn(j)||typeof j.addEventListener!="function"))for(let G of jr){let ie=()=>N();j.addEventListener(G,ie),o.push(()=>j.removeEventListener?.(G,ie))}N()}},noteManifestParsed(L){if(a||!L)return;let j=typeof L.video=="boolean"?L.video:null,G=typeof L.audio=="boolean"?L.audio:null;j===!0?t=!0:j===!1&&G===!0&&(n=!0),v()},evaluate:N,current(){return u()},destroy(){a||(a=!0,C())}}}var mn="Invalid playlist document",Yr=["level","audioTrack","subtitleTrack"];function Xr(i,e){if(typeof i!="string"||i.length===0)return!1;let t=i.trimStart();return t.startsWith("#EXTM3U")?e&&Yr.includes(e)?/^#EXT(?:INF|-X-TARGETDURATION):/m.test(t):!0:!1}function $n(i){let e=i.DefaultConfig.loader;return class extends e{load(n,r,s){let o={...s,onSuccess:(c,a,u,v)=>{if(!Xr(c?.data,u?.type)){s.onError({code:0,text:mn},u,v,a);return}s.onSuccess(c,a,u,v)}};super.load(n,r,o)}}}var qn=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";function Jr(i){let e=`'${i.canPlayType["application/vnd.apple.mpegurl"]}'/'${i.canPlayType["application/x-mpegURL"]}'`,t=i.hlsJsLoaded?`isSupported ${String(i.hlsJsSupported)}`:"not loaded";return[`native: ${e}`,`MediaSource: ${i.MediaSource}`,`ManagedMediaSource: ${i.ManagedMediaSource}`,`WebKitMediaSource: ${i.WebKitMediaSource}`,`hls.js: ${t}`].join(", ")}var Zr={debug:!1,autoStartLoad:!0,startPosition:-1,lowLatencyMode:!1,maxBufferLength:30,maxMaxBufferLength:600,backBufferLength:30,enableWorker:!0,capLevelToPlayerSize:!0,maxNetworkRetries:3,maxMediaRetries:2,retryDelayMs:1e3,retryBackoffFactor:2,loadTimeoutMs:3e4,autoReconnect:!0,reconnectBaseDelayMs:2e3,reconnectMaxDelayMs:3e4,reconnectWindowMs:3e5,validatePlaylists:!0},ei=1.1,ti=["manifestLoadError","manifestLoadTimeOut","manifestParsingError"],Ge="Video took too long to load (network timeout)";function Wn(i){return{type:"network",details:Ge,fatal:!0,timedOut:!0,attempts:i}}function Gn(i,e){let t=i?.code,r={type:(e==="initial"?t!==MediaError.MEDIA_ERR_DECODE:t===MediaError.MEDIA_ERR_NETWORK)?"network":"media",details:i?.message||(e==="initial"?"Failed to load HLS source":"Native HLS playback error"),fatal:!0};return typeof t=="number"&&t>0&&(r.mediaErrorCode=t),i?.message&&(r.mediaErrorMessage=i.message),r}function Qn(i,e,t){let n={...Zr,...t},r=null,s=null,o=null,c=!1,a=null,u=null,v=null,x=!0,N={corePlayRequested:!1,corePauseRequested:!1},C=null,L=null,j=null,G=null,ie=null,S=0,U=null,Y=null,z=0,K=0,h=null,V=0,q=0,P=10,te=5e3,le=!1,T=null,M=0,A=0,W=0,Z=null,pe=null,ce=!1,be=!1,he=!1,se=null,Ee=0,Ue=0,Pe=()=>{let l=s&&!c?Ve({kind:"hls",hls:s,details:L,lowLatencyRequested:n.lowLatencyMode===!0}):o?Ve({kind:"media",media:o,targetLatency:G??void 0,lowLatency:j?.lowLatency}):null;return l&&(j=l,s&&!c&&(G=l.targetLatency)),l},Zt=()=>o?.seekable?.length?o.seekable.end(o.seekable.length-1):void 0,Re=(l,d)=>{if(s&&!c&&typeof s.liveSyncPosition=="number")return s.liveSyncPosition;let m=Zt()??l?.seekableRange?.end;return m!==void 0?Math.max(0,m-d):void 0},Ye=l=>{if(!o)return l;if(r?.getState("live")){let d=Pe(),m=(s&&!c?s.targetLatency:void 0)||d?.targetLatency||3,g=d?.seekableRange?.start??0,E=Re(d,m);if(E!==void 0)return Math.max(g,Math.min(l,Math.max(g,E)));let b=o.duration,_=Number.isFinite(b)&&b>0?b:l;return Math.max(g,Math.min(l,_))}return Math.max(0,Math.min(l,o.duration||0))},Xe=()=>{if(!o||!c||!r?.getState("live"))return;let l=o,d=["canplay","progress","durationchange"],m=()=>{for(let b of d)l.removeEventListener(b,g);l.removeEventListener("seeking",m)},g=()=>{if(l.seeking||r?.getState("seeking")){m();return}let b=Pe();if(!b||(m(),b.atEdge))return;let _=Re(b,b.targetLatency??3);if(_===void 0)return;let O=l.seekable.start(l.seekable.length-1);l.currentTime=Math.max(O,Ye(_))};for(let b of d)l.addEventListener(b,g);l.addEventListener("seeking",m);let E=v;v=()=>{m(),E?.()},g()},Je=()=>{o&&(o.poster=r?.getState("poster")||"")},Ze=()=>{if(o)return o;let l=r?.container.querySelector("video");return l?(o=l,o):(o=document.createElement("video"),o.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",o.preload="metadata",o.controls=!1,o.playsInline=!0,Je(),r?.container.appendChild(o),o)},Me=l=>{Y?.(l??new Error("HLS load cancelled")),Y=null,u?.(),u=null,v?.(),v=null,h&&(clearTimeout(h),h=null),se&&(clearTimeout(se),se=null),s&&(s.destroy(),s=null)},ze=l=>{Me(l),a=null,c=!1,x=!0,z=0,K=0,V=0,q=0,L=null,j=null,G=null,ie=null,r&&Gt(r)},Ct=()=>{if(!o||!r)return;let l=r.getState("muted"),d=r.getState("volume");l!==void 0&&(o.muted=l),d!==void 0&&(o.volume=d)},Rt=(l,d,m,g)=>{l.done||l.session!==d||(d===S?m?l.reject(g):l.resolve(d):m&&!l.takenOver?l.reject(g):l.resolve(null))},Ht=(l,d,m)=>{m.then(()=>Rt(l,d,!1,void 0),g=>Rt(l,d,!0,g))},Dt=(l,d)=>new Promise((g,E)=>{let b={session:l,takenOver:!1,done:!1,resolve:_=>{b.done=!0,U===b&&(U=null),g(_)},reject:_=>{b.done=!0,U===b&&(U=null),E(_)}};U=b,Ht(b,l,d)}),It=l=>{let d=U;U=null,!(!d||d.done)&&(d.takenOver?d.resolve(null):d.reject(l))},Nt=(l,d)=>{let m=U;!m||m.done||(m.session=l,m.takenOver=!0,Ht(m,l,d))},en=()=>{let l=Te();if(n.validatePlaylists!==!1){let d=i.getHlsConstructor();d&&d.DefaultConfig?.loader&&(l.pLoader=$n(d))}return l},et=()=>{let l={},d=(ne,oe)=>{oe!==void 0&&(l[ne]=oe)},m=n.liveSyncDuration,g=n.liveSyncDurationCount,E=n.liveMaxLatencyDuration,b=n.liveMaxLatencyDurationCount,_=(m!==void 0||E!==void 0)&&(g!==void 0||b!==void 0),O=_&&m!==void 0,D=_&&!O;return _&&r?.logger.warn(`Ignoring ${O?"liveSyncDurationCount/liveMaxLatencyDurationCount":"liveSyncDuration/liveMaxLatencyDuration"}: hls.js rejects a config mixing seconds-based and count-based live latency options`),d("liveSyncDuration",D?void 0:m),d("liveSyncDurationCount",O?void 0:g),d("liveMaxLatencyDuration",D?void 0:E),d("liveMaxLatencyDurationCount",O?void 0:b),d("liveDurationInfinity",n.liveDurationInfinity),d("maxLiveSyncPlaybackRate",n.maxLiveSyncPlaybackRate??(n.lowLatencyMode===!0?ei:void 0)),l},Te=()=>({debug:n.debug,autoStartLoad:n.autoStartLoad,startPosition:n.startPosition,startLevel:-1,abrEwmaDefaultEstimate:Fn(n.initialBandwidthEstimate),lowLatencyMode:n.lowLatencyMode,maxBufferLength:n.maxBufferLength,maxMaxBufferLength:n.maxMaxBufferLength,backBufferLength:n.backBufferLength,enableWorker:n.enableWorker,capLevelToPlayerSize:n.capLevelToPlayerSize,fragLoadingMaxRetry:1,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:1,fragLoadingRetryDelay:500,manifestLoadingRetryDelay:500,levelLoadingRetryDelay:500,...et()}),Ke=l=>{let d=n.retryDelayMs??1e3,m=n.retryBackoffFactor??2;return d*Math.pow(m,l)*(.7+Math.random()*.3)},we=["bufferAppendError","bufferAppendingError","bufferAddCodecError"],tt=l=>{if(l.response?.text===mn)return"PLAYLIST_INVALID";if(l.details==="bufferFullError")return"MEDIA_BUFFER_FULL";if(we.includes(l.details))return"MEDIA_APPEND_ERROR";switch(l.type){case"network":return"MEDIA_NETWORK_ERROR";case"media":case"mux":return"MEDIA_DECODE_ERROR";default:return"PLAYBACK_FAILED"}},He=(l,d)=>{let m=l.attempts??(l.type==="network"?z:l.type==="media"||l.type==="mux"?K:0),g={type:l.type,retriesExhausted:d,attempts:m};l.mediaErrorCode!==void 0&&(g.mediaErrorCode=l.mediaErrorCode),l.mediaErrorMessage!==void 0&&(g.mediaErrorMessage=l.mediaErrorMessage),l.timedOut&&(g.timedOut=!0),typeof l.response?.code=="number"&&l.response.code>0&&(g.httpStatus=l.response.code);let E=re(l.url);return E&&(g.url=E),g},fe=(l,d,m)=>{let g=S,E=m??(d?`HLS error: ${l.details} (max retries exceeded)`:`HLS error: ${l.details}`);r?.logger.error(E,{type:l.type,details:l.details}),r?.setState("playbackState","error"),r?.setState("buffering",!1);let b=He(l,d);w(l)&&!ce&&(b.reconnecting=!0),r?.emit("error",{code:tt(l),message:E,fatal:!0,timestamp:Date.now(),detail:b}),g===S&&H(l)},xe=()=>{h&&(clearTimeout(h),h=null)},ke=l=>{if(!i.getHlsConstructor()||!s)return!1;if(l.fatal){let m=Date.now();if(m-q>te?(V=1,q=m):V++,V>=P)return r?.logger.error(`Too many fatal errors (${V} in ${te}ms), giving up`),xe(),fe(l,!0),Me(new Error(l.details)),!0;switch(r?.logger.error("Fatal HLS error",{type:l.type,details:l.details}),l.type){case"network":{let g=n.maxNetworkRetries??3;if(z>=g)return r?.logger.error(`Network error recovery failed after ${z} attempts`),xe(),fe(l,!0),!0;z++;let E=Ke(z-1);r?.logger.info(`Attempting network error recovery (attempt ${z}/${g}) in ${E}ms`),r?.emit("error:network",{error:new Error(l.details)}),h&&clearTimeout(h);let b=ti.includes(l.details),_=S;h=setTimeout(()=>{_!==S||!s||(b&&a?s.loadSource(a):s.startLoad())},E);break}case"media":case"mux":{let g=n.maxMediaRetries??2;if(K>=g)return r?.logger.error(`Media error recovery failed after ${K} attempts`),xe(),fe(l,!0),!0;K++;let E=Ke(K-1);r?.logger.info(`Attempting media error recovery (attempt ${K}/${g}) in ${E}ms`),r?.emit("error:media",{error:new Error(l.details)}),h&&clearTimeout(h);let b=S;h=setTimeout(()=>{b!==S||!s||s.recoverMediaError()},E);break}default:return xe(),fe(l,!1),!0}}return!1},Ot=(l,d)=>{let m=l.type==="network",g=m?n.maxNetworkRetries??3:n.maxMediaRetries??2,E=m?z:K;if(!a||E>=g){fe(l,E>=g);return}let b=d??o?.currentTime??0;m?z++:K++;let _=E+1,O=Ke(_-1);r?.logger.info(`Attempting native ${l.type} error recovery (attempt ${_}/${g}) in ${O}ms`),r?.emit(m?"error:network":"error:media",{error:new Error(l.details)}),h&&clearTimeout(h);let D=S;h=setTimeout(()=>{D===S&&Ft(l,b)},O)},Ft=async(l,d)=>{if(!a)return;let m=++S,g=a,E=r?.getState("live")??!1;try{if(Me(new Error("HLS load cancelled: native error recovery")),r?.setState("playbackState","loading"),await De(g),m!==S)return;E?Xe():o&&d>0&&(o.currentTime=d),r?.setState("playbackState","ready"),r?.setState("buffering",!1);try{await o?.play()}catch{}}catch{if(m!==S)return;r?.logger.warn("Native error recovery attempt failed"),Ot(l,d)}},De=async(l,d=!1)=>{let m=S,g=Ze();return c=!0,r&&(v=gn(g,r,Pe,N)),C?.beginSource(l),C?.attach(g),new Promise((E,b)=>{let _=null,O=!1,D=null,ne=()=>{O=!0,Y===oe&&(Y=null),g.removeEventListener("loadedmetadata",ge),g.removeEventListener("error",B),_!==null&&(clearTimeout(_),_=null)},oe=I=>{O||(ne(),b(I))};Y=oe;let ge=()=>{if(O)return;if(m!==S){ne(),b(new Error("HLS load cancelled"));return}ne(),le=!0,d&&(z=0,K=0);let I=()=>{Ot(Gn(g.error,"playback"))};g.addEventListener("error",I);let $=()=>{(z>0||K>0)&&(r?.logger.debug("Native playback recovered, resetting retry budgets"),z=0,K=0)};g.addEventListener("playing",$);let me=()=>{g.removeEventListener("error",I),g.removeEventListener("playing",$)},Le=v;v=()=>{me(),Le?.()},r?.setState("source",{src:l,type:"application/x-mpegURL"}),r?.emit("media:loaded",{src:l,type:"application/x-mpegURL"}),E()},B=()=>{if(O)return;if(!d||m!==S){ne(),b(new Error(g.error?.message||"Failed to load HLS source"));return}let I=Gn(g.error,"initial");D=I;let $=I.type==="network",me=$?n.maxNetworkRetries??3:n.maxMediaRetries??2,Le=$?z:K;if(Le>=me){ne(),r?.logger.error(`Native HLS load failed after ${Le} ${I.type} retries`,{src:re(l)}),fe(I,!0),b(new Error(I.details));return}$?z++:K++;let Bt=Ke(Le);r?.logger.info(`Retrying native HLS load after ${I.type} error (attempt ${Le+1}/${me}) in ${Bt}ms`),r?.emit($?"error:network":"error:media",{error:new Error(I.details)}),h&&clearTimeout(h),h=setTimeout(()=>{h=null,!(O||m!==S)&&(g.src=l,g.load())},Bt)},ae=n.loadTimeoutMs??3e4;ae>0&&(_=setTimeout(()=>{if(O||m!==S)return;if(ne(),!d){b(new Error(Ge));return}r?.logger.error(`Native HLS load timed out after ${ae}ms`,{src:re(l)});let I=Wn(z+K);Me(),g.removeAttribute("src"),g.load(),D?.mediaErrorCode!==void 0&&(I.mediaErrorCode=D.mediaErrorCode),D?.mediaErrorMessage!==void 0&&(I.mediaErrorMessage=D.mediaErrorMessage),fe(I,!1,Ge),b(new Error(Ge))},ae)),g.addEventListener("loadedmetadata",ge),g.addEventListener("error",B),g.src=l,g.load()})},nt=async l=>{let d=S;if(await i.loadHlsJs(),d!==S)throw new Error("HLS load cancelled");let m=Ze();return c=!1,s=i.createHlsInstance(en()),r&&(v=gn(m,r,Pe,N)),C?.beginSource(l),C?.attach(m),new Promise((g,E)=>{if(!s||!r){E(new Error("HLS not initialized"));return}let b=!1,_=null,O=()=>{_!==null&&(clearTimeout(_),_=null)},D=I=>{b||(b=!0,O(),E(I))};Y=D;let ne=()=>{Y===D&&(Y=null)};u=zn(s,r,{onManifestParsed:(I,$)=>{d===S&&(C?.noteManifestParsed($),b||(b=!0,ne(),O(),le=!0,r?.setState("source",{src:l,type:"application/x-mpegURL"}),r?.emit("media:loaded",{src:l,type:"application/x-mpegURL"}),g()))},onLevelSwitched:()=>{},onLevelDetails:I=>{d===S&&(L=I,Pe())},onPlaylistDetails:I=>{if(d!==S)return;let $=I.fragmentStart??I.fragments?.[0]?.start??0;ie=Number.isFinite($)?$:null},isLowLatencyRequested:()=>n.lowLatencyMode===!0,onError:I=>{if(d!==S)return;ke(I)&&!b&&(b=!0,ne(),O(),E(new Error(I.details)))},onFragLoaded:()=>{d===S&&z>0&&(r?.logger.debug("Fragment loaded, resetting network retry budget"),z=0)},onFragBuffered:()=>{d===S&&K>0&&(r?.logger.debug("Fragment buffered, resetting media retry budget"),K=0)},getIsAutoQuality:()=>x});let oe=s,ge=(I,$)=>{if(d!==S||s!==oe||!r||$?.fatal!==!1||$.details!=="fragLoadError"&&$.details!=="fragLoadTimeOut")return;let me=$.frag?.type,Le=$.frag?.stats?.loading?.start,Bt=$.frag?.stats?.loading?.end,Vt=$.frag?.stats?.loaded;if(me!=="main"&&me!=="audio"&&me!=="subtitle"||typeof Le!="number"||!Number.isFinite(Le)||Bt!==0||typeof Vt!="number"||!Number.isFinite(Vt)||Vt<0)return;let tn=performance.now()-Le;!Number.isFinite(tn)||tn<0||r.emit("media:segment",{kind:me,durationMs:tn,bytes:Vt,ok:!1})};oe.on("hlsError",ge);let B=u;u=()=>{oe.off("hlsError",ge),B?.()};let ae=n.loadTimeoutMs??3e4;ae>0&&(_=setTimeout(()=>{b||d!==S||(b=!0,ne(),r?.logger.error(`HLS load timed out after ${ae}ms`,{src:re(l)}),fe(Wn(z),!1,Ge),d===S&&Me(),E(new Error(Ge)))},ae)),s.attachMedia(m),s.loadSource(l)})},_e=()=>{T&&(clearTimeout(T),T=null),M=0,A=0,W=0,pe=null,ce=!1,be=!1},p=()=>{if(!o||se)return;Ee=Date.now(),Ue=o.currentTime;let l=s?.targetDuration??s?.levels?.[s?.currentLevel]?.details?.targetduration??0,d=Math.max(15,4*(l||0)||15),m=Math.min(d*1e3,3e4),g=()=>{if(!o||!r)return;let E=r.getState("playing"),b=r.getState("seeking");if(!E||b){se=setTimeout(g,m);return}let _=Date.now()-Ee;if(o.currentTime-Ue>.5)Ee=Date.now(),Ue=o.currentTime;else if(_>d*1e3){r.logger.warn("Playback stall detected \u2014 no timeupdate progress",{elapsed:Math.round(_),currentTime:o.currentTime,targetDuration:Math.round(d)}),H({type:"network",details:"Playback stalled \u2014 no data received",fatal:!0});return}se=setTimeout(g,m)};se=setTimeout(g,m)},f=()=>{se&&(clearTimeout(se),se=null)},F=(l,d)=>{if(ce)return;ce=!0;let m=M,g=pe;r?.emit("error:reconnect-exhausted",{attempts:m,elapsedMs:l,windowMs:d}),r?.setState("playbackState","error"),r?.setState("buffering",!1),r?.emit("error",{code:g?tt(g):"PLAYBACK_FAILED",message:`HLS auto-reconnect gave up after ${m} attempts over ${Math.round(l/1e3)}s`,fatal:!0,timestamp:Date.now(),detail:{type:g?.type??"other",retriesExhausted:!0,attempts:m,reconnectExhausted:!0}})},R=()=>{if(ce||T)return;let l=S,d=(r?.getState("live")??!1)&&he,m=n.reconnectWindowMs??3e5,g=d?1/0:m,E=Date.now()-A;if(E>g){r?.logger.warn(`Auto-reconnect window exhausted after ${M} attempts`),F(E,g);return}if(d&&E>6e5&&(r?.emit("error:reconnecting",{attempt:M+1,delayMs:0,elapsedMs:E,windowMs:g,longOutage:!0}),l!==S))return;let _=n.reconnectBaseDelayMs??2e3,O=n.reconnectMaxDelayMs??3e4,D=Math.min(_*Math.pow(2,M),O),ne=D>=O,oe=d&&ne?3e4:Math.round(D*(.7+Math.random()*.3));r?.logger.info(`Scheduling auto-reconnect attempt ${M+1} in ${oe}ms`),r?.emit("error:reconnecting",{attempt:M+1,delayMs:oe,elapsedMs:E,windowMs:g}),l===S&&(T=setTimeout(()=>{T=null,ue()},oe))},w=l=>{if(n.autoReconnect===!1||!a)return!1;let d=(r?.getState("live")??!1)&&he,m=pe?.timedOut===!0;return!d&&!le&&!l.timedOut&&!m?!1:l.type==="network"||l.type==="media"||l.type==="mux"},H=l=>{w(l)&&(A===0&&(A=Date.now(),W=o?.currentTime??0,pe=l),R())},ue=async()=>{if(!r||!a)return;be=!0;let l=++S;M++;let d=a,m=r.getState("live"),g=c,E=W;r.logger.info(`Auto-reconnect attempt ${M}`,{src:re(d)});try{if(Me(new Error("HLS load cancelled: reconnecting")),z=0,K=0,V=0,q=0,a=d,r.setState("playbackState","loading"),g&&i.supportsNativeHLS()?await De(d):await nt(d),l!==S)return;if(m?Xe():o&&E>0&&(o.currentTime=E),Ct(),r.setState("playbackState","ready"),r.setState("buffering",!1),r.emit("error:recovered",{attempt:M,elapsedMs:Date.now()-A}),r.logger.info("Auto-reconnect succeeded"),_e(),r.getState("paused"))r.logger.info("Stream reconnected while paused; maintaining pause at live edge");else try{await o?.play()}catch{}}catch{if(l!==S)return;r?.logger.warn(`Auto-reconnect attempt ${M} failed`),R()}finally{be=!1}};return{id:"hls-provider",name:e.name,version:qn,type:"provider",description:e.description,canPlay(l){let d=l.toLowerCase();return!!(d.split("?")[0].split("#")[0].endsWith(".m3u8")||d.includes("application/x-mpegurl")||d.includes("application/vnd.apple.mpegurl"))},async init(l){r=l,r.logger.info(`HLS plugin${e.logSuffix} initialized`),C=Kn(r);let d=r.on("playback:play",async()=>{if(o&&o.paused)try{N.corePlayRequested=!0,await o.play()}catch(B){N.corePlayRequested=!1,r?.logger.error("Play failed",B)}}),m=r.on("playback:pause",()=>{if(o){if(o.paused){N.corePlayRequested&&(N.corePlayRequested=!1,o.pause());return}N.corePauseRequested=!0,N.corePlayRequested=!1,o.pause()}}),g=r.on("playback:seeking",({time:B})=>{o&&Number.isFinite(B)&&(o.currentTime=Ye(B))}),E=r.on("volume:change",({volume:B})=>{o&&(o.volume=B)}),b=r.on("volume:mute",({muted:B})=>{o&&(o.muted=B)}),_=r.on("playback:ratechange",({rate:B})=>{o&&(o.playbackRate=B)}),O=r.on("quality:select",({quality:B,auto:ae})=>{if(!s||c){r?.logger.warn("Quality selection not available");return}if(ae||B==="auto")x=!0,s.currentLevel=-1,r?.logger.debug("Quality: auto selection enabled"),r?.setState("currentQuality",{id:"auto",label:"Auto",width:0,height:0,bitrate:0,active:!0});else{x=!1;let I=parseInt(B.replace("level-",""),10);if(!isNaN(I)&&I>=0&&I<s.levels.length){s.nextLevel=I,r?.logger.debug(`Quality: queued switch to level ${I}`);let $=s.levels[I];if($){let me=Be($);r?.setState("currentQuality",{id:`level-${I}`,label:`${me}...`,width:$.width,height:$.height,bitrate:$.bitrate,active:!1})}}}}),D=r.on("track:audio",({trackId:B})=>{if(!s||c){r?.logger.warn("Audio track selection not available");return}let ae=Un(B),I=s.audioTracks??[];if(ae<0||ae>=I.length){r?.logger.warn("Ignoring unknown audio track selection",{trackId:B});return}s.audioTrack=ae,r?.logger.debug(`Audio: queued switch to track ${ae}`)});typeof window<"u"&&(Z=()=>{(T!==null||A>0||be||M>0&&!ce)&&(T&&(r?.logger.info("Browser back online, reconnecting immediately"),clearTimeout(T),T=null),ue())},window.addEventListener("online",Z));let ne=r.subscribeToState(B=>{B.key==="poster"&&Je()}),oe=r.subscribeToState(B=>{B.key==="live"&&(he=!0)});r.onDestroy(()=>{d(),m(),g(),E(),b(),_(),O(),D(),ne(),oe()});let ge=r.subscribeToState(B=>{B.key==="playing"&&(B.value?p():f())});r.onDestroy(ge)},async destroy(){r?.logger.info(`HLS plugin${e.logSuffix} destroying`),S++,_e(),Z&&typeof window<"u"&&(window.removeEventListener("online",Z),Z=null);let l=new Error("HLS load cancelled: player destroyed");It(l),ze(l),C?.destroy(),C=null,o?.parentNode&&o.parentNode.removeChild(o),o=null,r=null},async loadSource(l){if(!r)throw new Error("Plugin not initialized");r.logger.info(`Loading HLS source${e.logSuffix}`,{src:re(l)});let d=++S;_e(),le=!1,he=!1,r.setState("live",!1);let m=new Error("HLS load cancelled: superseded by a new load");It(m),ze(m),a=l,N.corePlayRequested=!1,N.corePauseRequested=!1,Je(),r.setState("playbackState","loading"),r.setState("buffering",!0);let g;if(r.getState("airplayActive")&&i.supportsNativeHLS())r.logger.info("Using native HLS (AirPlay active)"),g=De(l,!0);else if(i.isHlsJsSupported())r.logger.info(`Using ${e.engineLabel} for HLS playback`),g=nt(l);else if(i.supportsNativeHLS())r.logger.info("Using native HLS playback (hls.js not supported)"),g=De(l,!0);else{let b=i.describeSupport(),_=`HLS playback not supported in this browser (${Jr(b)})`;throw r.setState("playbackState","error"),r.setState("buffering",!1),r.emit("error",{code:"SOURCE_NOT_SUPPORTED",message:_,fatal:!0,timestamp:Date.now(),context:{probes:b}}),new Error(_)}let E=await Dt(d,g);E===null||E!==S||!r||(Ct(),r.setState("playbackState","ready"),r.setState("buffering",!1))},getCurrentLevel(){return c||!s?-1:s.currentLevel},setLevel(l){if(c||!s){r?.logger.warn("Quality selection not available in native HLS mode");return}s.currentLevel=l},getLevels(){return c||!s?[]:On(s.levels,s.currentLevel)},getHlsInstance(){return s},isNativeHLS(){return c},getLiveInfo(){if(!(r?.getState("live")||!1))return null;let d=Pe();if(c){let g=d?.targetLatency??3;return{isLive:!0,latency:d?.latency??0,targetLatency:g,drift:0,liveSyncPosition:Re(d,g),lowLatency:d?.lowLatency??!1}}if(!s)return null;let m=s.targetLatency||d?.targetLatency||3;return{isLive:!0,latency:s.latency||0,targetLatency:m,drift:s.drift||0,liveSyncPosition:Re(d,m),lowLatency:d?.lowLatency??!1}},async switchToNative(){if(c){r?.logger.debug("Already using native HLS");return}if(!i.supportsNativeHLS()){r?.logger.warn("Native HLS not supported in this browser");return}if(!a){r?.logger.warn("No source loaded");return}r?.logger.info("Switching to native HLS for AirPlay");let l=r?.getState("playing")||!1,d=o?.currentTime||0,m=a,g=G,E=U!==null,b=++S;_e(),ze(new Error("HLS load cancelled: switching to native HLS")),a=m,G=g;let _=De(m,E);if(Nt(b,_),await _,b===S){if(o&&d>0&&(o.currentTime=d),l&&o)try{await o.play()}catch{r?.logger.debug("Could not auto-resume after switch")}r?.logger.info("Switched to native HLS")}},async switchToHlsJs(){if(!c){r?.logger.debug("Already using hls.js");return}if(!i.isHlsJsSupported()){r?.logger.warn("hls.js not supported in this browser");return}if(!a){r?.logger.warn("No source loaded");return}r?.logger.info("Switching back to hls.js");let l=r?.getState("playing")||!1,d=o?.currentTime||0,m=a,g=G,E=++S;_e(),ze(new Error("HLS load cancelled: switching to hls.js")),a=m,G=g;let b=nt(m);if(Nt(E,b),await b,E===S){if(o&&d>0&&(o.currentTime=d),l&&o)try{await o.play()}catch{r?.logger.debug("Could not auto-resume after switch")}r?.logger.info("Switched to hls.js")}},getPlaylistStart(){return c?null:ie},getDiagnostics(){let l=c?"native":s?"hls.js":null,d=null,m=null;if(s&&typeof s.currentLevel=="number"&&(d=s.currentLevel,s.levels&&d>=0&&s.levels[d])){let D=s.levels[d];m={},typeof D.bitrate=="number"&&Number.isFinite(D.bitrate)&&(m.bitrate=D.bitrate),typeof D.width=="number"&&Number.isFinite(D.width)&&(m.width=D.width),typeof D.height=="number"&&Number.isFinite(D.height)&&(m.height=D.height)}let g=null;if(s&&typeof s.bandwidthEstimate=="number"&&Number.isFinite(s.bandwidthEstimate))g=Math.round(s.bandwidthEstimate);else if(r){let D=r.getState("bandwidth");typeof D=="number"&&Number.isFinite(D)&&D>0&&(g=Math.round(D))}let E=r?!!r.getState("live"):!1,b=r?!!r.getState("lowLatencyMode"):!1,_=D=>{if(!D)return[];let ne=[],oe=Math.min(D.length,32);for(let ge=0;ge<oe;ge++)try{let B=D.start(ge),ae=D.end(ge);Number.isFinite(B)&&Number.isFinite(ae)&&ne.push({start:B,end:ae})}catch{}return ne},O=o??r?.container?.querySelector("video");return{engine:l,selectedLevel:d,quality:m,bandwidthEstimate:g,live:E,lowLatency:b,retryCount:(z||0)+(K||0),networkRetryCount:z||0,mediaRetryCount:K||0,reconnectAttempts:M||0,isReconnecting:!!be,readyState:O?O.readyState:null,networkState:O?O.networkState:null,buffered:_(O?O.buffered:null),seekable:_(O?O.seekable:null)}}}}function jn(i){return Qn(dn,{name:"HLS Provider",description:"HLS playback provider using hls.js",logSuffix:"",engineLabel:"hls.js"},i)}var Yn=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var ni=["mp4","webm","mov","mkv","ogv","m4v"],Xn=["mp3","wav","ogg","flac","aac","m4a","opus","weba"],ri=[...ni,...Xn],Qt={ABORTED:1,NETWORK:2,DECODE:3,SRC_NOT_SUPPORTED:4},ii={mp4:"video/mp4",m4v:"video/mp4",webm:"video/webm",mov:"video/quicktime",mkv:"video/x-matroska",ogv:"video/ogg",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",flac:"audio/flac",aac:"audio/aac",m4a:"audio/mp4",opus:"audio/opus",weba:"audio/webm"};function Jn(i){let e=i?.preload??"metadata",t=i?.loadTimeoutMs??3e4,n=null,r=null,s=null,o=null,c=!1,a=!1,u=!1,v=0,x=null,N=!1,C=h=>{try{return new URL(h,window.location.href).pathname.split(".").pop()?.toLowerCase()??""}catch{return(h.split(".").pop()?.toLowerCase()??"").split("?")[0]??""}},L=h=>ii[h]||"video/mp4",j=h=>Xn.includes(h),G=h=>{let P=(h.startsWith("audio/")?document.createElement("audio"):document.createElement("video")).canPlayType(h);return P==="probably"||P==="maybe"},ie=()=>{if(r){if(c){r.poster="";return}r.poster=n?.getState("poster")||""}},S=()=>{if(r)return r;let h=n?.container.querySelector("video");return h?(r=h,r):(r=document.createElement("video"),r.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",r.preload=e,r.controls=!1,r.playsInline=!0,ie(),n?.container.appendChild(r),r)},U=h=>{switch(h?.code){case Qt.ABORTED:return{code:"PLAYBACK_FAILED",message:"Playback aborted"};case Qt.NETWORK:return{code:"MEDIA_NETWORK_ERROR",message:"Network error"};case Qt.DECODE:return{code:"MEDIA_DECODE_ERROR",message:"Decode error - format may not be supported"};case Qt.SRC_NOT_SUPPORTED:return N?{code:"MEDIA_NETWORK_ERROR",message:"Network error"}:{code:"SOURCE_LOAD_FAILED",message:"Format not supported"};default:return{code:"PLAYBACK_FAILED",message:"Unknown video error"}}},Y=h=>{let V=[],q=v,P=(T,M)=>{let A=W=>{q===v&&M(W)};h.addEventListener(T,A),V.push([T,A])},te=()=>{h.ended||!n?.getState("ended")||(n?.setState("ended",!1),n?.setState("playbackState",h.paused?"paused":"playing"))};P("play",()=>{n?.setState("paused",!1),te()}),P("playing",()=>{n?.setState("playing",!0),n?.setState("paused",!1),n?.setState("playbackState","playing"),te(),u=!1,a?a=!1:n?.emit("playback:play",void 0)}),P("pause",()=>{a=!1,n?.setState("playing",!1),n?.setState("paused",!0),n?.setState("playbackState","paused"),u?u=!1:n?.emit("playback:pause",void 0)}),P("ended",()=>{n?.setState("playing",!1),n?.setState("ended",!0),n?.setState("playbackState","ended"),n?.emit("playback:ended",void 0)}),P("timeupdate",()=>{n?.setState("currentTime",h.currentTime),n?.emit("playback:timeupdate",{currentTime:h.currentTime})}),P("durationchange",()=>{n?.setState("duration",h.duration||0)}),P("loadedmetadata",()=>{n?.setState("duration",h.duration||0),n?.emit("media:loadedmetadata",{duration:h.duration||0})}),P("canplay",()=>{n?.setState("buffering",!1),n?.emit("media:canplay",void 0)}),P("canplaythrough",()=>{n?.emit("media:canplaythrough",void 0)}),P("waiting",()=>{n?.setState("buffering",!0),n?.emit("media:waiting",void 0)}),P("progress",()=>{if(h.buffered.length>0){let T=h.buffered.end(h.buffered.length-1),M=h.duration||0,A=M>0?T/M:0;n?.setState("bufferedAmount",A),n?.emit("media:progress",{buffered:A})}}),P("seeking",()=>{n?.setState("currentTime",h.currentTime),n?.setState("seeking",!0),te()}),P("seeked",()=>{n?.setState("seeking",!1),n?.emit("playback:seeked",{time:h.currentTime})}),P("volumechange",()=>{n?.setState("volume",h.volume),n?.setState("muted",h.muted),n?.emit("volume:change",{volume:h.volume,muted:h.muted})}),P("ratechange",()=>{n?.setState("playbackRate",h.playbackRate),n?.emit("playback:ratechange",{rate:h.playbackRate})}),P("stalled",()=>{n?.setState("buffering",!0),n?.emit("media:stalled",void 0),n?.logger.warn("Media stalled - network may be slow")}),P("suspend",()=>{n?.emit("media:suspend",void 0)}),P("abort",()=>{n?.emit("media:abort",void 0)}),P("error",()=>{let T=h.error,{code:M,message:A}=U(T);n?.logger.error("Video error",{mediaErrorCode:T?.code,code:M,message:A}),n?.setState("playbackState","error"),n?.setState("buffering",!1);let W={networkState:h.networkState,readyState:h.readyState};typeof T?.code=="number"&&(W.mediaErrorCode=T.code),n?.emit("error",{code:M,message:A,fatal:!0,timestamp:Date.now(),detail:W})}),P("enterpictureinpicture",()=>{n?.setState("pip",!0),n?.logger.debug("PiP: entered (standard)")}),P("leavepictureinpicture",()=>{n?.setState("pip",!1),n?.logger.debug("PiP: exited (standard)"),(!h.paused||n?.getState("playing"))&&h.play().catch(()=>{})});let le=h;if("webkitPresentationMode"in h){let T=le.webkitPresentationMode;P("webkitpresentationmodechanged",()=>{let M=le.webkitPresentationMode,A=T==="picture-in-picture"&&M==="inline";T=M,n?.setState("pip",M==="picture-in-picture"),n?.logger.debug(`PiP: mode changed to ${M} (webkit)`),A&&h.paused&&h.play().catch(()=>{})})}return()=>{V.forEach(([T,M])=>{h.removeEventListener(T,M)})}},z=()=>{s?.(),s=null,a=!1,u=!1,r&&(r.pause(),r.removeAttribute("src"),r.load())};return{id:"native-provider",name:"Native Media Provider",version:Yn,type:"provider",description:"Native HTML5 playback for video (MP4, WebM, MOV) and audio (MP3, WAV, FLAC, AAC)",canPlay(h){let V=C(h);if(!ri.includes(V))return!1;let q=L(V);return G(q)},async init(h){n=h,n.logger.info("Native video plugin initialized");let V=n.on("playback:play",async()=>{if(!n?.getState("chromecastActive")&&r&&r.paused)try{a=!0,await r.play()}catch(A){a=!1,n?.logger.error("Play failed",A)}}),q=n.on("playback:pause",()=>{if(!n?.getState("chromecastActive")&&r){if(r.paused){a&&(a=!1,r.pause());return}u=!0,a=!1,r.pause()}}),P=n.on("playback:seeking",({time:A})=>{if(n?.getState("chromecastActive")||!r||!Number.isFinite(A))return;let W=Math.max(0,Math.min(A,r.duration||0));r.currentTime=W}),te=n.on("volume:change",({volume:A,muted:W})=>{r&&(r.volume=A,r.muted=W)}),le=n.on("volume:mute",({muted:A})=>{r&&(r.muted=A)}),T=n.on("playback:ratechange",({rate:A})=>{r&&(r.playbackRate=A)}),M=n.subscribeToState(A=>{A.key==="poster"&&ie()});n.onDestroy(()=>{V(),q(),P(),te(),le(),T(),M()})},async destroy(){n?.logger.info("Native video plugin destroying"),v++;let h=x;x=null,h?.(new Error("Player destroyed during load")),z(),r?.parentNode&&r.parentNode.removeChild(r),r=null,n=null,o=null,c=!1,N=!1},async loadSource(h){if(!n)throw new Error("Plugin not initialized");let V=C(h),q=L(V),P=j(V);c=P,n.logger.info("Loading native media source",{src:re(h),mimeType:q,isAudio:P});let te=++v,le=x;if(x=null,le?.(new Error("Load superseded by a newer source")),N=!1,z(),n.setState("playbackState","loading"),n.setState("buffering",!0),n.setState("mediaType",P?"audio":"video"),P){let M=n.getState("title");if(!M||M===o)try{let W=new URL(h,window.location.href).pathname.split("/").pop()||"Audio",Z=decodeURIComponent(W.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));o=Z,n.setState("title",Z)}catch{o="Audio",n.setState("title","Audio")}}n.setState("qualities",[]),n.setState("currentQuality",null);let T=S();return T.style.display=P?"none":"block",ie(),s=Y(T),new Promise((M,A)=>{let W=null,Z=()=>{T.removeEventListener("loadedmetadata",ce),T.removeEventListener("error",be),W!==null&&(clearTimeout(W),W=null),x===pe&&(x=null)},pe=he=>{Z(),A(he)};x=pe;let ce=()=>{if(te!==v)return;Z(),N=!0;let he=n?.getState("muted"),se=n?.getState("volume");he!==void 0&&(T.muted=he),se!==void 0&&(T.volume=se),n?.setState("source",{src:h,type:q}),n?.setState("playbackState","ready"),n?.setState("buffering",!1),n?.emit("media:loaded",{src:h,type:q}),M()},be=()=>{if(te!==v)return;Z();let he=T.error;A(new Error(he?.message||"Failed to load video source"))};t>0&&(W=setTimeout(()=>{te===v&&(Z(),n?.setState("playbackState","error"),n?.setState("buffering",!1),A(new Error("Video took too long to load (network timeout)")))},t)),T.addEventListener("loadedmetadata",ce),T.addEventListener("error",be),T.src=h,T.load()})},getDiagnostics(){let h=r??n?.container?.querySelector("video"),V=P=>{if(!P)return[];let te=[],le=Math.min(P.length,32);for(let T=0;T<le;T++)try{let M=P.start(T),A=P.end(T);Number.isFinite(M)&&Number.isFinite(A)&&te.push({start:M,end:A})}catch{}return te},q=null;return h&&h.videoWidth>0&&h.videoHeight>0&&(q={width:h.videoWidth,height:h.videoHeight}),{readyState:h?h.readyState:null,networkState:h?h.networkState:null,dimensions:q,buffered:V(h?h.buffered:null),seekable:V(h?h.seekable:null)}}}}var Zn={"bandwidth-indicator":{rank:0,exit:"hide"},"skip-backward":{rank:1,exit:"overflow"},"skip-forward":{rank:1,exit:"overflow"},pip:{rank:2,exit:"overflow"},"keyboard-help":{rank:3,exit:"overflow"},chromecast:{rank:4,exit:"overflow"},airplay:{rank:4,exit:"overflow"},volume:{rank:5,exit:"overflow"},captions:{rank:6,exit:"overflow"},quality:{rank:6,exit:"hide"},time:{rank:7,exit:"hide"},play:{rank:"never",exit:"overflow"},"live-indicator":{rank:"never",exit:"overflow"},settings:{rank:"never",exit:"overflow"},fullscreen:{rank:"never",exit:"overflow"},spacer:{rank:"never",exit:"overflow"}};function jt(i,e){return i.map(t=>{let n=Zn[t],r=e?.[t]??n?.rank??3;return{id:t,rank:r,exit:n?.exit??"overflow"}})}function vn(i,e){if(!i.includes("quality")||i.includes("settings"))return;let[t]=jt(["quality"],e);if(t.rank!=="never")throw new Error(`uiPlugin: a layout with "quality" needs "settings" as well. The quality control hides when the bar does not fit, and the settings menu is where its Quality row lives. Add "settings" to controls, pin quality with priority: { quality: 'never' }, or set responsive: false.`)}function si(i,e,t,n){let r=i.reduce((c,a)=>c+a,0),s=e*Math.max(0,i.length-1),o=n?t+e:0;return r+s+o}function yn(i,e,t,n){let r=i.map(u=>u.id);if(e<=0)return{inBar:r,overflow:[],hidden:[]};let o=[...i.filter(u=>u.visible&&u.width>0)],c=new Set,a=new Set;for(;si(o.map(u=>u.width),t,n,c.size>0)>e;){let u=-1;for(let x=0;x<o.length;x++){let N=o[x];N.rank!=="never"&&(u===-1||N.rank<=o[u].rank)&&(u=x)}if(u===-1)break;let[v]=o.splice(u,1);(v.exit==="hide"?a:c).add(v.id)}return{inBar:r.filter(u=>!c.has(u)&&!a.has(u)),overflow:r.filter(u=>c.has(u)),hidden:r.filter(u=>a.has(u))}}var bn=`
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
`;var k={play:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${ut.play}"/></svg>`,pause:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',replay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',volumeHigh:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${ut.volumeHigh}"/></svg>`,volumeLow:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',volumeMute:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${ut.volumeMuted}"/></svg>`,fullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',exitFullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',pip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>',exitPip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 9h6v2H9z"/></svg>',settings:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',chromecast:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',chromecastConnected:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',airplay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 22h12l-6-6-6 6zM21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V5h18v12h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',captions:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>',captionsOff:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 5.5v13h-15v-13h15zM19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>',checkmark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',chevronUp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>',more:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',chevronDown:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>',close:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',keyboardHelp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>',spinner:'<svg viewBox="0 0 24 24" fill="currentColor" class="sp-spin"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',skipForward:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',skipBack:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',forward10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',replay10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',error:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'};function y(i,e,t){let n=document.createElement(i);if(e)for(let[r,s]of Object.entries(e))r==="className"?n.className=s:n.setAttribute(r,s);if(t)for(let r of t)typeof r=="string"?n.appendChild(document.createTextNode(r)):n.appendChild(r);return n}function J(i,e,t){let n=y("button",{className:`sp-control ${i}`,"aria-label":e,type:"button"});return ee(n,t),n}function Q(i){return i.querySelector("video")}function pt(i){for(;i.firstChild;)i.removeChild(i.firstChild)}var er=new WeakMap;function ee(i,e){return er.get(i)===e?!1:(i.innerHTML=e,er.set(i,e),!0)}function X(i,e,t){return i.getAttribute(e)===t?!1:(i.setAttribute(e,t),!0)}function Yt(i,e){if(e.duration===1/0){let s=i.getState("source");return s&&i.emit("media:load-request",{src:s.src,autoplay:!0}),null}let t=i.getPlugin("hls-provider")?.getPlaylistStart?.(),n=e.seekable,r=typeof t=="number"&&Number.isFinite(t)&&t>=0&&t<e.duration?t:n&&n.length>0?n.start(0):0;return e.currentTime=r,r}var ht=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=J("sp-play","Play",k.play),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("playing"),t=this.api.getState("ended"),n,r;t?(n=k.replay,r="Replay"):e?(n=k.pause,r="Pause"):(n=k.play,r="Play"),ee(this.el,n),X(this.el,"aria-label",r)}toggle(){let e=Q(this.api.container);if(!e)return;if(this.api.getState("ended")){let n=Yt(this.api,e);if(n===null)return;this.api.emit("playback:seeking",{time:n}),e.play().catch(()=>{})}else e.paused?e.play().catch(()=>{}):e.pause()}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var gt=class{constructor(e,t){this.hasStarted=!1;this.lastSource=void 0;this.clickHandler=()=>{this.start()};this.api=e,this.hasOverlayProbe=typeof t=="function",this.isOverlayVisible=t??(()=>!1);let n=document.createElement("button");n.className="sp-big-play",n.setAttribute("type","button"),n.setAttribute("aria-label","Play"),ee(n,k.play),n.addEventListener("click",this.clickHandler),this.el=n}render(){return this.el}update(){let e=this.api.getState("playing"),t=Q(this.api.container),n=this.hasEnded(t),r=this.api.getState("currentTime"),s=this.api.getState("playbackState"),o=this.api.getState("error"),c=this.api.getState("source");c!==this.lastSource&&(this.lastSource=c,this.hasStarted=!1),e&&(this.hasStarted=!0);let a;(this.hasOverlayProbe?this.isOverlayVisible():o)||s==="loading"||e||t&&!t.paused?a=!1:n?a=!0:this.hasStarted||r!==0?a=!1:a=s==="idle"||s==="ready",ee(this.el,n?k.replay:k.play),X(this.el,"aria-label",n?"Replay":"Play"),this.el.classList.toggle("sp-big-play--visible",a)}hasEnded(e){return e?e.ended:!!this.api.getState("ended")}start(){let e=Q(this.api.container);e&&(e.ended&&Yt(this.api,e)===null||e.play().catch(()=>{}))}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var ft=class{constructor(){this.config=null;this.loaded=!1;this.el=y("div",{className:"sp-thumbnail-preview"}),this.img=y("div",{className:"sp-thumbnail-preview__img"}),this.el.appendChild(this.img)}getElement(){return this.el}setConfig(e){if(this.config=e,this.loaded=!1,e){this.img.style.width=`${e.width}px`,this.img.style.height=`${e.height}px`,this.el.style.width=`${e.width}px`,this.el.style.height=`${e.height}px`;let t=new Image;t.onload=()=>{this.loaded=!0},t.onerror=()=>{this.config=null,this.loaded=!1},t.src=e.src}}show(e,t){if(!this.config||!this.loaded){this.el.style.display="none";return}let{src:n,width:r,height:s,columns:o,interval:c}=this.config,a=Math.floor(e/c),u=a%o,v=Math.floor(a/o);this.img.style.backgroundImage=`url(${n})`,this.img.style.backgroundPosition=`-${u*r}px -${v*s}px`,this.img.style.backgroundSize=`${o*r}px auto`,this.img.style.width=`${r}px`,this.img.style.height=`${s}px`,this.el.style.left=`${t*100}%`,this.el.style.display=""}hide(){this.el.style.display="none"}isConfigured(){return this.config!==null}destroy(){this.el.remove()}};var oi=new WeakMap,En=new WeakMap;function tr(i,e){En.set(i,e);let t=oi.get(i);return t&&e.setFactory(t.factory),()=>{En.get(i)===e&&En.delete(i)}}var ai=new Set(["ArrowLeft","ArrowRight","Home","End"]),mt=class{constructor(e,t={}){this.isDragging=!1;this.lastSeekTime=0;this.seekThrottleMs=100;this.wasPlayingBeforeDrag=!1;this.renderedChapters=null;this.renderedDuration=0;this.extension=null;this.detachTimelineHost=null;this.extensionDragging=!1;this.extensionEditing=!1;this.onMouseDown=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=Q(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.clientX,!0)};this.onDocMouseMove=e=>{this.isDragging&&(this.seek(e.clientX),this.updateVisualPosition(e.clientX))};this.onMouseUp=e=>{if(this.isDragging&&(this.seek(e.clientX,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag)){let t=Q(this.api.container);if(t&&t.paused){let n=()=>{t.removeEventListener("seeked",n),t.play().catch(()=>{})};t.addEventListener("seeked",n)}}};this.onTouchStart=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=Q(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.touches[0].clientX,!0)};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.seek(e.touches[0].clientX),this.updateVisualPosition(e.touches[0].clientX))};this.onTouchEnd=e=>{if(this.isDragging){let t=e.changedTouches?.[0]?.clientX;if(t!==void 0&&this.seek(t,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag){let n=Q(this.api.container);if(n&&n.paused){let r=()=>{n.removeEventListener("seeked",r),n.play().catch(()=>{})};n.addEventListener("seeked",r)}}this.tooltip.style.opacity="",this.thumbnailPreview.hide()}};this.onMouseMove=e=>{this.isExtensionInput(e)||this.updateTooltip(e.clientX)};this.onMouseLeave=()=>{this.isDragging||(this.tooltip.style.opacity="",this.thumbnailPreview.hide())};this.onKeyDown=e=>{let t=Q(this.api.container);if(t&&ai.has(e.key)){this.extension?.onSeekStart();try{this.applyKeyboardSeek(e,t)}finally{this.extension?.onSeekEnd()}}};this.api=e,this.options=t,this.wrapper=y("div",{className:"sp-progress-wrapper"}),this.el=y("div",{className:"sp-progress"});let n=y("div",{className:"sp-progress__track"});this.buffered=y("div",{className:"sp-progress__buffered"}),this.filled=y("div",{className:"sp-progress__filled"}),this.markers=y("div",{className:"sp-progress__markers"}),this.handle=y("div",{className:"sp-progress__handle"}),this.tooltip=y("div",{className:"sp-progress__tooltip"}),this.tooltip.textContent="0:00",this.thumbnailPreview=new ft,n.appendChild(this.buffered),n.appendChild(this.filled),n.appendChild(this.markers),n.appendChild(this.handle),this.el.appendChild(n),this.el.appendChild(this.thumbnailPreview.getElement()),this.el.appendChild(this.tooltip),this.wrapper.appendChild(this.el),this.extensionLayer=y("div",{className:"sp-progress__extension"}),this.wrapper.appendChild(this.extensionLayer),this.el.setAttribute("role","slider"),this.el.setAttribute("aria-label","Seek"),this.el.setAttribute("aria-valuemin","0"),this.el.setAttribute("aria-valuemax","0"),this.el.setAttribute("aria-valuenow","0"),this.el.setAttribute("aria-valuetext","0:00"),this.el.setAttribute("tabindex","0"),this.wrapper.addEventListener("mousedown",this.onMouseDown),this.wrapper.addEventListener("mousemove",this.onMouseMove),this.wrapper.addEventListener("mouseleave",this.onMouseLeave),this.wrapper.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.el.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd),this.detachTimelineHost=tr(this.api.container,{setFactory:r=>this.mountExtension(r)})}mountExtension(e){if(this.extension&&(this.extension.destroy(),this.extension=null,this.setExtensionDragging(!1),this.setExtensionEditing(!1),pt(this.extensionLayer)),!e)return;let t={element:this.extensionLayer,getRailRect:()=>this.el.getBoundingClientRect(),setEditing:n=>this.setExtensionEditing(n),setDragging:n=>this.setExtensionDragging(n)};this.extension=e(t),this.extension.update()}isTimelineEditing(){return this.extensionEditing}setExtensionEditing(e){this.extensionEditing!==e&&(this.extensionEditing=e,this.wrapper.classList.toggle("sp-progress-wrapper--editing",e),e&&this.show(),this.options.onEditingChange?.(e))}setExtensionDragging(e){this.extensionDragging!==e&&(this.extensionDragging=e,this.wrapper.classList.toggle("sp-progress-wrapper--ext-dragging",e),e?(this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.tooltip.style.opacity="0",this.thumbnailPreview.hide()):this.tooltip.style.opacity="")}isExtensionInput(e){if(this.extensionDragging)return!0;let t=e.target;return t instanceof Node&&this.extensionLayer.contains(t)}render(){return this.wrapper}show(){this.wrapper.classList.add("sp-progress-wrapper--visible")}hide(){this.wrapper.classList.remove("sp-progress-wrapper--visible")}setThumbnails(e){this.thumbnailPreview.setConfig(e)}update(){let e=this.api.getState("currentTime")||0,t=this.api.getState("duration")||0,n=this.api.getState("buffered"),r=this.api.getState("live"),s=this.api.getState("seekableRange"),o=this.api.getState("thumbnails");if(o&&!this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.setConfig(o),this.el.classList.toggle("sp-progress--live",!!r),this.updateMarkers(t,r,s),r&&s){let c=s.end-s.start;if(c>0){let a=(e-s.start)/c*100;this.filled.style.width=`${Math.max(0,Math.min(100,a))}%`,this.handle.style.left=`${Math.max(0,Math.min(100,a))}%`}if(n&&n.length>0){let a=s.end-s.start;if(a>0){let v=(n.end(n.length-1)-s.start)/a*100;this.buffered.style.width=`${Math.max(0,Math.min(100,v))}%`}}this.el.setAttribute("aria-valuemax",String(Math.floor(s.end))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",`${Math.floor(s.end-e)} seconds behind live`)}else if(t>0){let c=e/t*100;if(this.filled.style.width=`${c}%`,this.handle.style.left=`${c}%`,n&&n.length>0){let u=n.end(n.length-1)/t*100;this.buffered.style.width=`${u}%`}this.el.setAttribute("aria-valuemax",String(Math.floor(t))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",ve(e))}this.extension?.update()}chapterLabelAt(e){let t=this.api.getState("chapters")??[];for(let n=t.length-1;n>=0;n--){let r=t[n];if(e<r.time)continue;let s=t[n+1],o=r.endTime??(s?s.time:1/0);return e<o?r.label:null}return null}updateMarkers(e,t,n){let r=this.api.getState("chapters")??[],s=t?n?n.end-n.start:0:e;if(r.length===0||s<=0){this.renderedChapters!==null&&(this.markers.textContent="",this.renderedChapters=null,this.renderedDuration=0);return}if(r===this.renderedChapters&&s===this.renderedDuration)return;let o=t&&n?n.start:0;this.markers.textContent="";for(let c of r){if(c.time<=o)continue;let a=(c.time-o)/s*100;if(a<=0||a>=100)continue;let u=y("div",{className:"sp-progress__marker"});u.style.left=`${a}%`,u.title=c.label,this.markers.appendChild(u)}this.renderedChapters=r,this.renderedDuration=s}getTimeFromPosition(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width)),r=this.api.getState("live"),s=this.api.getState("seekableRange");if(r&&s){let a=s.end-s.start,u=s.start+n*a;return Number.isFinite(u)?u:null}let o=this.api.getState("duration")||0,c=n*o;return Number.isFinite(c)?c:null}updateTooltip(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width)),r=this.getTimeFromPosition(e)??0,s=this.api.getState("live"),o=this.api.getState("seekableRange");if(s&&o){let a=o.end-r;this.tooltip.textContent=Ce(a)}else this.tooltip.textContent=ve(r);let c=this.chapterLabelAt(r);if(c){let a=y("span",{className:"sp-progress__tooltip-chapter"});a.textContent=c,this.tooltip.appendChild(a)}this.tooltip.style.left=`${n*100}%`,this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.show(r,n)}updateVisualPosition(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width));this.filled.style.width=`${n*100}%`,this.handle.style.left=`${n*100}%`}applyKeyboardSeek(e,t){let r=this.api.getState("live"),s=this.api.getState("seekableRange");if(r&&s)switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(s.start,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(s.end,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=s.start;break;case"End":e.preventDefault(),t.currentTime=s.end;break}else{let o=this.api.getState("duration")||0;switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(0,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(o,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=0;break;case"End":e.preventDefault(),t.currentTime=o;break}}this.api.emit("playback:seeking",{time:t.currentTime})}seek(e,t=!1){let n=Q(this.api.container);if(!n)return;let r=Date.now();if(!t&&this.isDragging&&r-this.lastSeekTime<this.seekThrottleMs)return;this.lastSeekTime=r;let s=this.getTimeFromPosition(e);s!==null&&Number.isFinite(s)&&(n.currentTime=s,t&&this.api.emit("playback:seeking",{time:s}))}destroy(){this.detachTimelineHost?.(),this.detachTimelineHost=null,this.extension?.destroy(),this.extension=null,this.wrapper.removeEventListener("mousedown",this.onMouseDown),this.wrapper.removeEventListener("mousemove",this.onMouseMove),this.wrapper.removeEventListener("mouseleave",this.onMouseLeave),this.wrapper.removeEventListener("touchstart",this.onTouchStart),this.el.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.thumbnailPreview.destroy(),this.wrapper.remove()}};var vt=class{constructor(e){this.api=e,this.el=y("div",{className:"sp-time"}),this.el.setAttribute("aria-live","off")}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("currentTime")||0,n=this.api.getState("duration")||0;if(e){let r=this.api.getState("seekableRange"),s=this.api.getState("liveEdge");this.el.classList.toggle("sp-time--live",!!r),this.el.style.display=r?"":"none";let o=r&&!s?Ce(r.end-t):"LIVE";this.setText(o==="LIVE"?"":o)}else this.el.classList.remove("sp-time--live"),this.el.style.display="",this.setText(`${ve(t)} / ${ve(n)}`)}setText(e){this.el.textContent!==e&&(this.el.textContent=e),e?this.el.removeAttribute("aria-hidden"):this.el.setAttribute("aria-hidden","true")}destroy(){this.el.remove()}};var yt=class{constructor(e){this.isDragging=!1;this.onMouseDown=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onDocMouseMove=e=>{this.isDragging&&this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onMouseUp=()=>{this.isDragging=!1};this.onTouchStart=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX))};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX)))};this.onTouchEnd=()=>{this.isDragging=!1};this.onKeyDown=e=>{let t=Q(this.api.container);if(!t)return;let n=.1;switch(e.key){case"ArrowUp":case"ArrowRight":e.preventDefault(),this.setVolume(t.volume+n);break;case"ArrowDown":case"ArrowLeft":e.preventDefault(),this.setVolume(t.volume-n);break}};this.api=e,this.el=y("div",{className:"sp-volume"}),this.btn=y("button",{className:"sp-control sp-volume__btn","aria-label":"Mute",type:"button"}),this.btn.innerHTML=k.volumeHigh,this.btn.onclick=()=>this.toggleMute();let t=y("div",{className:"sp-volume__slider-wrap"});this.slider=y("div",{className:"sp-volume__slider"}),this.slider.setAttribute("role","slider"),this.slider.setAttribute("aria-label","Volume"),this.slider.setAttribute("aria-valuemin","0"),this.slider.setAttribute("aria-valuemax","100"),this.slider.setAttribute("tabindex","0"),this.level=y("div",{className:"sp-volume__level"}),this.slider.appendChild(this.level),t.appendChild(this.slider),this.el.appendChild(this.btn),this.el.appendChild(t),this.slider.addEventListener("mousedown",this.onMouseDown),this.slider.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.slider.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd)}render(){return this.el}update(){let e=this.api.getState("volume")??1,t=this.api.getState("muted")??!1,n,r;t||e===0?(n=k.volumeMute,r="Unmute"):e<.5?(n=k.volumeLow,r="Mute"):(n=k.volumeHigh,r="Mute"),ee(this.btn,n),X(this.btn,"aria-label",r);let s=t?0:e,o=`${s*100}%`;this.level.style.width!==o&&(this.level.style.width=o);let c=Math.round(s*100);X(this.slider,"aria-valuenow",String(c)),X(this.slider,"aria-valuetext",`${c}%`)}toggleMute(){let e=Q(this.api.container);e&&(e.muted=!e.muted)}setVolume(e){let t=Q(this.api.container);if(!t)return;let n=Math.max(0,Math.min(1,e));t.volume=n,n>0&&t.muted&&(t.muted=!1)}getVolumeFromPosition(e){let t=this.slider.getBoundingClientRect();return Math.max(0,Math.min(1,(e-t.left)/t.width))}destroy(){this.slider.removeEventListener("mousedown",this.onMouseDown),this.slider.removeEventListener("touchstart",this.onTouchStart),this.slider.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.el.remove()}};var bt=class{constructor(e){this.handleClick=()=>{this.seekToLive()};this.handleKeyDown=e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.seekToLive())};this.api=e,this.el=y("div",{className:"sp-live"}),this.dot=y("div",{className:"sp-live__dot"}),this.label=document.createElement("span"),this.label.textContent="LIVE",this.el.appendChild(this.dot),this.el.appendChild(this.label),this.el.setAttribute("role","button"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge"),this.el.setAttribute("tabindex","0"),this.el.addEventListener("click",this.handleClick),this.el.addEventListener("keydown",this.handleKeyDown)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("liveEdge");this.el.style.display=e?"":"none",t?(this.el.classList.remove("sp-live--behind"),this.label.textContent="LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge")):(this.el.classList.add("sp-live--behind"),this.label.textContent="GO LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - behind live edge, click to seek to live"))}seekToLive(){this.api.emit("live:seektolive",void 0)}destroy(){this.el.removeEventListener("click",this.handleClick),this.el.removeEventListener("keydown",this.handleKeyDown),this.el.remove()}};var Et=class{constructor(e){this.isOpen=!1;this.lastQualitiesJson="";this.api=e,this.el=y("div",{className:"sp-quality"}),this.btn=J("sp-quality__btn","Quality",k.settings),this.btnLabel=y("span",{className:"sp-quality__label"}),this.btnLabel.textContent="Auto",this.btn.appendChild(this.btnLabel),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.menu=y("div",{className:"sp-quality-menu"}),this.menu.setAttribute("role","menu"),this.menu.addEventListener("click",t=>{t.stopPropagation()}),this.el.appendChild(this.btn),this.el.appendChild(this.menu),this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler)}render(){return this.el}update(){let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality");this.el.style.display=e.length>0?"":"none",e.length===0&&this.isOpen&&this.close(),this.btnLabel.textContent=t?.label||"Auto";let n=JSON.stringify(e.map(s=>s.id)),r=t?.id||"auto";n!==this.lastQualitiesJson&&(this.lastQualitiesJson=n,this.rebuildMenu(e)),this.updateActiveStates(r)}rebuildMenu(e){this.menu.innerHTML="";let t=this.createMenuItem("Auto","auto");this.menu.appendChild(t);let n=[...e].sort((r,s)=>s.height-r.height);for(let r of n){if(r.id==="auto")continue;let s=this.createMenuItem(r.label,r.id);this.menu.appendChild(s)}}updateActiveStates(e){this.menu.querySelectorAll(".sp-quality-menu__item").forEach(n=>{let s=n.getAttribute("data-quality-id")===e;n.classList.toggle("sp-quality-menu__item--active",s)})}createMenuItem(e,t){let n=y("div",{className:"sp-quality-menu__item"});n.setAttribute("role","menuitem"),n.setAttribute("data-quality-id",t);let r=y("span",{className:"sp-quality-menu__label"});return r.textContent=e,n.appendChild(r),n.addEventListener("click",s=>{s.preventDefault(),s.stopPropagation(),this.selectQuality(t)}),n}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.menu.classList.add("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","true")}close(){this.isOpen=!1,this.menu.classList.remove("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","false")}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),this.el.remove()}};function li(){if(typeof navigator>"u")return!1;let i=navigator.userAgent;return/Chrome/.test(i)&&!/Edge|Edg/.test(i)}function ci(){return typeof HTMLVideoElement>"u"?!1:typeof HTMLVideoElement.prototype.webkitShowPlaybackTargetPicker=="function"}var Qe=class{constructor(e,t){this.api=e,this.type=t,this.supported=t==="chromecast"?li():ci();let n=t==="chromecast"?k.chromecast:k.airplay,r=t==="chromecast"?"Cast":"AirPlay";this.el=J(`sp-cast sp-cast--${t}`,r,n),this.el.addEventListener("click",()=>this.handleClick()),this.supported||(this.el.style.display="none")}render(){return this.el}update(){if(!this.supported){this.el.style.display="none";return}if(this.type==="chromecast"){let e=this.api.getState("chromecastAvailable"),t=this.api.getState("chromecastActive");this.el.style.display="",this.el.disabled=!e&&!t,this.el.classList.toggle("sp-cast--active",!!t),this.el.classList.toggle("sp-cast--unavailable",!e&&!t),t?(ee(this.el,k.chromecastConnected),X(this.el,"aria-label","Stop casting")):(ee(this.el,k.chromecast),X(this.el,"aria-label",e?"Cast":"No Cast devices found"))}else{let e=this.api.getState("airplayActive");this.el.style.display="",this.el.disabled=!1,this.el.classList.toggle("sp-cast--active",!!e),this.el.classList.remove("sp-cast--unavailable"),X(this.el,"aria-label",e?"Stop AirPlay":"AirPlay")}}handleClick(){this.type==="chromecast"?this.handleChromecast():this.handleAirPlay()}handleChromecast(){let e=this.api.getPlugin("chromecast");e&&(e.isConnected()?e.endSession():e.requestSession().catch(()=>{}))}async handleAirPlay(){let e=this.api.getPlugin("airplay");e?await e.showPicker():Q(this.api.container)?.webkitShowPlaybackTargetPicker?.()}destroy(){this.el.remove()}};var wt=class{constructor(e){this.clickHandler=()=>{this.toggle().catch(()=>{})};this.api=e;let t=document.createElement("video");this.supported="pictureInPictureEnabled"in document||"webkitSetPresentationMode"in t,this.el=J("sp-pip","Picture-in-Picture",k.pip),this.el.addEventListener("click",this.clickHandler),this.supported?(this.el.disabled=!0,this.el.setAttribute("aria-disabled","true")):this.el.style.display="none"}render(){return this.el}isMediaReady(){let e=Q(this.api.container);return!!e&&e.readyState>=HTMLMediaElement.HAVE_METADATA}update(){if(!this.supported)return;let e=!!this.api.getState("pip"),t=e||this.isMediaReady();this.el.disabled=!t,X(this.el,"aria-disabled",String(!t)),ee(this.el,e?k.exitPip:k.pip),X(this.el,"aria-label",e?"Exit Picture-in-Picture":"Picture-in-Picture"),this.el.classList.toggle("sp-pip--active",e)}async toggle(){let e=Q(this.api.container);if(!e){this.api.logger.warn("PiP: video element not found");return}let t=document.pictureInPictureElement===e||e.webkitPresentationMode==="picture-in-picture";if(!t&&e.readyState<HTMLMediaElement.HAVE_METADATA){this.api.logger.debug("PiP: ignored, media not ready",{readyState:e.readyState});return}try{t?(document.pictureInPictureElement?await document.exitPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("inline"),this.api.logger.debug("PiP: exited")):(e.requestPictureInPicture?await e.requestPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("picture-in-picture"),this.api.logger.debug("PiP: entered"))}catch(n){let r=n instanceof Error?n.message:String(n);this.api.logger.warn("PiP: failed",{error:r})}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var kt=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=J("sp-fullscreen","Fullscreen",k.fullscreen),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){this.api.getState("fullscreen")?(ee(this.el,k.exitFullscreen),X(this.el,"aria-label","Exit fullscreen")):(ee(this.el,k.fullscreen),X(this.el,"aria-label","Fullscreen"))}async toggle(){let e=this.api.container;try{Ne(e)?await Fe(e):await Oe(e)}catch{}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var St=class{constructor(){this.el=y("div",{className:"sp-spacer"})}render(){return this.el}update(){}destroy(){this.el.remove()}};function ui(i){if(!i)return"Something went wrong.";let e=i.code;if(e)switch(e){case"MEDIA_NETWORK_ERROR":return"Having trouble connecting. Check your internet and try again.";case"MEDIA_DECODE_ERROR":return"This video can't be played right now.";case"SOURCE_LOAD_FAILED":case"SOURCE_NOT_SUPPORTED":case"PROVIDER_NOT_FOUND":return"Unable to load video. Please try again.";case"PLAYBACK_FAILED":return"Playback stopped unexpectedly. Please try again.";case"MEDIA_APPEND_ERROR":return"Video playback was interrupted. Please try again.";case"MEDIA_BUFFER_FULL":return"Your device is low on video memory. Close other apps or tabs and try again.";case"PLAYLIST_INVALID":return"The stream is temporarily unavailable. Please try again."}let t=i.message?.toLowerCase()||"";return t.includes("network")||t.includes("timeout")||t.includes("fetch")||t.includes("connection")?"Having trouble connecting. Check your internet and try again.":t.includes("manifest")?"Unable to load video. Please try again.":t.includes("decode")||t.includes("media")||t.includes("format")||t.includes("codec")?"This video can't be played right now.":t.includes("not found")||t.includes("404")||t.includes("source")||t.includes("not supported")?"Video not found.":"Something went wrong."}var Lt=class{constructor(e){this.visible=!1;this.lastSource=null;this.handleRetry=()=>{if(this.retryBtn.disabled)return;this.retryBtn.disabled=!0,this.hide();let t=this.api.getState("source")?.src||this.lastSource;t&&this.api.emit("error:retry",{src:t}),setTimeout(()=>{this.retryBtn.disabled=!1},1e3)};this.handleDismiss=()=>{this.hide(),this.api.emit("error:dismiss",void 0)};this.api=e;let t=document.createElement("div");t.className="sp-error-overlay",t.setAttribute("role","alert"),t.setAttribute("aria-live","assertive");let n=document.createElement("div");n.className="sp-error-overlay__content";let r=document.createElement("div");r.className="sp-error-overlay__icon",r.innerHTML=k.error;let s=document.createElement("p");s.className="sp-error-overlay__message",s.textContent="Something went wrong.";let o=document.createElement("div");o.className="sp-error-overlay__actions",this.retryBtn=document.createElement("button"),this.retryBtn.className="sp-error-overlay__retry",this.retryBtn.setAttribute("type","button"),this.retryBtn.setAttribute("aria-label","Try again"),this.retryBtn.textContent="Try Again",this.retryBtn.addEventListener("click",this.handleRetry),this.dismissBtn=document.createElement("button"),this.dismissBtn.className="sp-error-overlay__dismiss",this.dismissBtn.setAttribute("type","button"),this.dismissBtn.setAttribute("aria-label","Go back"),this.dismissBtn.textContent="Go Back",this.dismissBtn.addEventListener("click",this.handleDismiss),o.appendChild(this.retryBtn),o.appendChild(this.dismissBtn),n.appendChild(r),n.appendChild(s),n.appendChild(o),t.appendChild(n),this.el=t}render(){return this.el}show(e){let t=ui(e),n=this.el.querySelector(".sp-error-overlay__message");n&&(n.textContent=t);let r=this.api.getState("source");r?.src&&(this.lastSource=r.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.remove("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}showReconnecting(){let e=this.el.querySelector(".sp-error-overlay__message");e&&(e.textContent="Connection lost. Reconnecting...");let t=this.api.getState("source");t?.src&&(this.lastSource=t.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.add("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}hide(){this.visible=!1,this.el.classList.remove("sp-error-overlay--visible"),this.el.classList.remove("sp-error-overlay--reconnecting")}isVisible(){return this.visible}update(){let e=this.api.getState("playbackState");this.visible&&e!=="error"&&e!=="loading"&&this.api.getState("playing")&&this.hide()}destroy(){this.retryBtn.removeEventListener("click",this.handleRetry),this.dismissBtn.removeEventListener("click",this.handleDismiss),this.el.remove()}};var di=90,pi=60,hi=[{label:"0.5x",value:.5},{label:"0.75x",value:.75},{label:"Normal",value:1},{label:"1.25x",value:1.25},{label:"1.5x",value:1.5},{label:"2x",value:2}],Tt=class{constructor(e){this.isOpen=!1;this.currentPanel="main";this.lastQualitiesJson="";this.lastSpeedAvailable=!0;this.withdrawnRate=null;this.speedLatch={source:void 0,shown:!1};this.api=e,this.el=y("div",{className:"sp-settings"}),this.btn=J("sp-settings__btn","Settings",k.settings),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.panel=y("div",{className:"sp-settings-panel"}),this.panel.setAttribute("role","menu"),this.panel.addEventListener("click",t=>t.stopPropagation()),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.closeHandler=t=>{this.el.contains(t.target)||this.close(!1)},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{if(this.isOpen){if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),this.currentPanel!=="main"?this.showPanel("main"):this.close();return}if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault(),t.stopPropagation(),this.navigateItems(t.key==="ArrowDown"?1:-1);return}t.key==="Tab"&&(t.preventDefault(),t.stopPropagation(),this.navigateItems(t.shiftKey?-1:1))}},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){let e=this.isSpeedAvailable();e?this.restoreRate():this.resetRate();let t=this.hasRows();this.el.style.display=t?"":"none",this.isOpen&&!t&&this.close(!1),e!==this.lastSpeedAvailable&&(this.lastSpeedAvailable=e,this.isOpen&&(this.currentPanel==="main"||this.currentPanel==="speed")&&this.showPanel("main"));let n=this.api.getState("qualities")||[],r=JSON.stringify(n.map(s=>s.id));r!==this.lastQualitiesJson&&(this.lastQualitiesJson=r,this.isOpen&&this.currentPanel==="quality"&&this.renderQualityPanel()),this.isOpen&&(this.currentPanel==="quality"?this.updateQualityActiveStates():this.currentPanel==="speed"?this.updateSpeedActiveStates():this.currentPanel==="captions"?this.updateCaptionsActiveStates():this.currentPanel==="audio"&&this.updateAudioActiveStates())}isSpeedAvailable(){let e=this.api.getState("source");this.speedLatch.source!==e&&(this.speedLatch={source:e,shown:!1},this.withdrawnRate=null);let t=this.api.getState("live"),n=this.api.getState("seekableRange"),r=n?n.end-n.start:0;return!n||r<pi?this.speedLatch.shown=!1:t&&r>=di&&(this.speedLatch.shown=!0),!t||this.speedLatch.shown}resetRate(){let e=this.api.container.querySelector("video"),t=e?e.playbackRate:this.api.getState("playbackRate")??1;t!==1&&(this.withdrawnRate={rate:t,src:this.api.getState("source")?.src},this.api.emit("playback:ratechange",{rate:1}),e&&(e.playbackRate=1))}restoreRate(){let e=this.withdrawnRate;if(!e||(this.withdrawnRate=null,e.src!==this.api.getState("source")?.src))return;this.api.emit("playback:ratechange",{rate:e.rate});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e.rate)}hasRows(){return this.isSpeedAvailable()||(this.api.getState("qualities")||[]).length>0||(this.api.getState("textTracks")||[]).length>0||(this.api.getState("audioTracks")||[]).length>1}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.currentPanel="main",this.renderMainPanel(),this.panel.classList.add("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","true"),this.focusFirstItem()}close(e=!0){let t=this.isOpen;this.isOpen=!1,this.currentPanel="main",this.panel.classList.remove("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","false"),t&&e&&this.btn.focus()}showPanel(e){switch(this.currentPanel=e,e){case"main":this.renderMainPanel();break;case"quality":this.renderQualityPanel();break;case"speed":this.renderSpeedPanel();break;case"captions":this.renderCaptionsPanel();break;case"audio":this.renderAudioPanel();break}this.focusFirstItem()}renderMainPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--main";let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality"),n=this.api.getState("playbackRate")??1;if(e.length>0){let a=this.createMainRow("Quality",t?.label||"Auto",()=>this.showPanel("quality"));this.panel.appendChild(a)}if((this.api.getState("textTracks")||[]).length>0){let a=this.api.getState("currentTextTrack"),u=a?a.label:"Off",v=this.createMainRow("Captions",u,()=>this.showPanel("captions"));this.panel.appendChild(v)}if((this.api.getState("audioTracks")||[]).length>1){let a=this.api.getState("currentAudioTrack"),u=this.createMainRow("Audio",a?.label||"Default",()=>this.showPanel("audio"));this.panel.appendChild(u)}if(!this.isSpeedAvailable())return;let o=n===1?"Normal":`${n}x`,c=this.createMainRow("Speed",o,()=>this.showPanel("speed"));this.panel.appendChild(c)}createMainRow(e,t,n){let r=y("div",{className:"sp-settings-panel__row"});r.setAttribute("role","menuitem"),r.setAttribute("tabindex","0"),r.setAttribute("aria-haspopup","true");let s=y("span",{className:"sp-settings-panel__label"});s.textContent=e;let o=y("span",{className:"sp-settings-panel__value"});o.textContent=t;let c=y("span",{className:"sp-settings-panel__arrow"});return c.innerHTML=k.chevronDown,o.appendChild(c),r.appendChild(s),r.appendChild(o),r.addEventListener("click",a=>{a.preventDefault(),n()}),r.addEventListener("keydown",a=>{(a.key==="Enter"||a.key===" ")&&(a.preventDefault(),n())}),r}renderQualityPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Quality");this.panel.appendChild(e);let t=this.api.getState("qualities")||[],r=this.api.getState("currentQuality")?.id||"auto",s=this.createMenuItem("Auto","auto",r==="auto");s.addEventListener("click",c=>{c.preventDefault(),this.selectQuality("auto")}),this.panel.appendChild(s);let o=[...t].sort((c,a)=>a.height-c.height);for(let c of o){if(c.id==="auto")continue;let a=this.createMenuItem(c.label,c.id,c.id===r);a.addEventListener("click",u=>{u.preventDefault(),this.selectQuality(c.id)}),this.panel.appendChild(a)}}renderSpeedPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Speed");this.panel.appendChild(e);let t=this.api.getState("playbackRate")??1;for(let n of hi){let r=Math.abs(t-n.value)<.01,s=this.createMenuItem(n.label,String(n.value),r);s.addEventListener("click",o=>{o.preventDefault(),this.selectSpeed(n.value)}),this.panel.appendChild(s)}}renderCaptionsPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Captions");this.panel.appendChild(e);let t=this.api.getState("textTracks")||[],r=this.api.getState("currentTextTrack")?.id||"off",s=this.createMenuItem("Off","off",r==="off");s.addEventListener("click",o=>{o.preventDefault(),this.selectCaption(null)}),this.panel.appendChild(s);for(let o of t){let c=this.createMenuItem(o.label,o.id,o.id===r);c.addEventListener("click",a=>{a.preventDefault(),this.selectCaption(o.id)}),this.panel.appendChild(c)}}renderAudioPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Audio");this.panel.appendChild(e);let t=this.api.getState("audioTracks")||[],r=this.api.getState("currentAudioTrack")?.id??null;for(let s of t){let o=this.createMenuItem(s.label,s.id,s.id===r);o.addEventListener("click",c=>{c.preventDefault(),this.selectAudioTrack(s.id)}),this.panel.appendChild(o)}}selectAudioTrack(e){this.api.emit("track:audio",{trackId:e}),this.close()}updateAudioActiveStates(){let t=this.api.getState("currentAudioTrack")?.id??null;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}selectCaption(e){this.api.emit("track:text",{trackId:e}),this.close()}updateCaptionsActiveStates(){let t=this.api.getState("currentTextTrack")?.id||"off";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}createSubHeader(e){let t=y("div",{className:"sp-settings-panel__header"});t.setAttribute("role","menuitem"),t.setAttribute("tabindex","0");let n=y("span",{className:"sp-settings-panel__back"});n.innerHTML=k.chevronUp;let r=y("span",{className:"sp-settings-panel__header-label"});return r.textContent=e,t.appendChild(n),t.appendChild(r),t.addEventListener("click",s=>{s.preventDefault(),this.showPanel("main")}),t.addEventListener("keydown",s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),this.showPanel("main"))}),t}createMenuItem(e,t,n){let r=y("div",{className:`sp-settings-panel__item${n?" sp-settings-panel__item--active":""}`});r.setAttribute("role","menuitem"),r.setAttribute("tabindex","0"),r.setAttribute("data-id",t);let s=y("span");s.textContent=e;let o=y("span",{className:"sp-settings-panel__check"});return o.innerHTML=k.checkmark,r.appendChild(s),r.appendChild(o),r.addEventListener("keydown",c=>{(c.key==="Enter"||c.key===" ")&&(c.preventDefault(),r.click())}),r}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}selectSpeed(e){if(!this.isSpeedAvailable())return;this.api.emit("playback:ratechange",{rate:e});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e),this.close()}updateQualityActiveStates(){let t=this.api.getState("currentQuality")?.id||"auto";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}updateSpeedActiveStates(){let e=this.api.getState("playbackRate")??1;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(n=>{let r=n.getAttribute("data-id"),s=parseFloat(r||"1");n.classList.toggle("sp-settings-panel__item--active",Math.abs(e-s)<.01)})}getFocusableItems(){return Array.from(this.panel.querySelectorAll('[role="menuitem"]'))}focusFirstItem(){requestAnimationFrame(()=>{let e=this.getFocusableItems();e.length>0&&e[0].focus()})}navigateItems(e){let t=this.getFocusableItems();if(t.length===0)return;let n=document.activeElement,r=t.indexOf(n),s;r===-1?s=e===1?0:t.length-1:s=(r+e+t.length)%t.length,t[s].focus()}getPanel(){return this.currentPanel}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.el.remove()}};var gi=10,je=class{constructor(e,t,n=gi){this.clickHandler=()=>{this.skip()};this.api=e,this.direction=t,this.seconds=n;let r=t==="backward"?k.replay10:k.forward10,s=t==="backward"?`Rewind ${n} seconds`:`Forward ${n} seconds`;this.el=J(`sp-skip sp-skip--${t}`,s,r),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("duration")??0,n=this.api.getState("seekableRange");if(e&&!n){this.el.style.display="none";return}if(e&&n){this.el.style.display="";return}if(t===0){this.el.style.display="none";return}this.el.style.display=""}skip(){let e=Q(this.api.container);if(!e)return;let t=this.api.getState("live"),n=this.api.getState("seekableRange"),r;if(t&&n){if(this.direction==="forward"&&this.api.getState("liveEdge"))return;r=this.direction==="backward"?Math.max(n.start,e.currentTime-this.seconds):Math.min(n.end,e.currentTime+this.seconds)}else{let s=e.duration||0;if(!s||!isFinite(s))return;r=this.direction==="backward"?Math.max(0,e.currentTime-this.seconds):Math.min(s,e.currentTime+this.seconds)}e.currentTime=r,this.api.emit("playback:seeking",{time:r})}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};function Xt(i){let e=i.getState("textTracks")||[],t=i.getState("currentTextTrack");return e.length===0?!1:(t?i.emit("track:text",{trackId:null}):i.emit("track:text",{trackId:e[0].id}),!0)}var xt=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=J("sp-captions","Captions",k.captionsOff),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("textTracks")||[],t=this.api.getState("currentTextTrack");if(e.length===0){this.el.style.display="none";return}this.el.style.display="",t?(ee(this.el,k.captions),X(this.el,"aria-label",`Captions: ${t.label}`),this.el.classList.add("sp-captions--active")):(ee(this.el,k.captionsOff),X(this.el,"aria-label","Captions"),this.el.classList.remove("sp-captions--active"))}toggle(){Xt(this.api)}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var Pt=class{constructor(e){this.el=J("sp-kbd-help-btn","Keyboard shortcuts",k.keyboardHelp),this.el.addEventListener("click",()=>e())}render(){return this.el}update(){}destroy(){this.el.remove()}};var wn=[{keys:"Space / K",action:"Play / pause"},{keys:"Left / Right arrow",action:"Seek 5 seconds back / forward"},{keys:"Up / Down arrow",action:"Volume up / down"},{keys:"M",action:"Toggle mute"},{keys:"F",action:"Toggle fullscreen"},{keys:"C",action:"Toggle captions",note:"Needs caption tracks. Turns the current track off, or enables the first available one."},{keys:"0-9",action:"Seek to 0-90% of the video",note:"On a live stream with DVR, seeks to the same share of the seekable window; on live without DVR, digits do nothing."},{keys:"?",action:"Show this help"},{keys:"Home / End",action:"Jump to the start / end",note:"Only while the progress bar is focused - they are progress-slider shortcuts, not player-wide ones."}];var Mt=class{constructor(e){this.opened=!1;this.invoker=null;this.api=e,this.el=y("div",{className:"sp-kbd-help",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts"}),this.panel=y("div",{className:"sp-kbd-help__panel"});let t=y("div",{className:"sp-kbd-help__header"}),n=y("span",{className:"sp-kbd-help__title"});n.textContent="Keyboard shortcuts",this.closeBtn=y("button",{className:"sp-kbd-help__close",type:"button","aria-label":"Close keyboard shortcuts"}),this.closeBtn.innerHTML=k.close,this.closeHandler=()=>this.close(),this.closeBtn.addEventListener("click",this.closeHandler),t.appendChild(n),t.appendChild(this.closeBtn),this.body=y("div",{className:"sp-kbd-help__body"}),this.renderEntries(),this.panel.appendChild(t),this.panel.appendChild(this.body),this.el.appendChild(this.panel),this.keyHandler=r=>{if(this.opened&&this.api.container.contains(document.activeElement)){if(r.key==="Escape"){r.preventDefault(),r.stopPropagation(),this.close();return}r.key==="Tab"&&(r.preventDefault(),r.stopPropagation(),this.trapTab(r.shiftKey))}}}renderEntries(){let e=y("div",{className:"sp-kbd-help__list"});for(let r of wn){let s=y("div",{className:"sp-kbd-help__row"}),o=y("span",{className:"sp-kbd-help__keys"});o.textContent=r.keys;let c=y("span",{className:"sp-kbd-help__action"});c.textContent=r.action,s.appendChild(o),s.appendChild(c),e.appendChild(s)}this.body.appendChild(e);let t=wn.filter(r=>r.note);if(t.length===0)return;let n=y("div",{className:"sp-kbd-help__notes"});for(let r of t){let s=y("p",{className:"sp-kbd-help__note"});s.textContent=`${r.keys}: ${r.note}`,n.appendChild(s)}this.body.appendChild(n)}open(e){if(this.opened)return!0;let t=document.activeElement;if(t instanceof HTMLElement){let n=t.closest('[role="dialog"], [aria-modal="true"]');if(n&&!this.el.contains(n)&&!n.contains(this.api.container))return!1}return this.opened=!0,this.invoker=e instanceof HTMLElement&&this.api.container.contains(e)?e:this.api.container,this.api.container.appendChild(this.el),document.addEventListener("keydown",this.keyHandler),this.closeBtn.focus(),!0}close(e=!0){if(!this.opened)return;this.opened=!1,document.removeEventListener("keydown",this.keyHandler),this.el.remove();let t=this.invoker;if(this.invoker=null,!e)return;let n=t?.isConnected?t:this.api.container;n.isConnected&&(n.focus(),document.activeElement!==n&&this.api.container.isConnected&&this.api.container.focus())}isOpen(){return this.opened}trapTab(e){let t=Array.from(this.el.querySelectorAll("button, [href], [tabindex]")).filter(s=>!(s instanceof HTMLButtonElement&&s.disabled));if(t.length===0)return;let n=t.indexOf(document.activeElement);(e?t[(n<=0?t.length:n)-1]:t[(n+1)%t.length]).focus()}destroy(){this.close(!1),this.closeBtn.removeEventListener("click",this.closeHandler)}};var fi='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"/></svg>',_t=class{constructor(e){this.api=e,this.el=y("div",{className:"sp-bandwidth-indicator"}),this.el.innerHTML=fi,this.el.setAttribute("aria-label","Bandwidth is limiting video quality"),this.el.setAttribute("title","Bandwidth is limiting video quality"),this.el.style.display="none"}render(){return this.el}update(){let e=this.api.getState("bandwidth"),t=this.api.getState("qualities");if(!e||!t||t.length===0){this.el.style.display="none";return}let n=Math.max(...t.map(r=>r.bitrate));n>0&&e<n?this.el.style.display="":this.el.style.display="none"}destroy(){this.el.remove()}};var At=class{constructor(e){this.api=e;this.isOpen=!1;this.toggleHandler=()=>{this.isOpen?this.close():this.open()};this.el=y("div",{className:"sp-overflow"}),this.btn=J("sp-overflow__btn","More controls",k.more),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",this.toggleHandler),this.panel=y("div",{className:"sp-overflow-tray",role:"group","aria-label":"More controls"}),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.el.style.display="none",this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{!this.isOpen||t.key!=="Escape"||(t.preventDefault(),t.stopPropagation(),this.close(),this.btn.focus())},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){}adopt(e){this.panel.appendChild(e),this.syncVisibility()}release(e){return e.parentNode===this.panel&&this.panel.removeChild(e),this.syncVisibility(),e}holds(e){return e.parentNode===this.panel}open(){this.isOpen||(this.isOpen=!0,this.panel.classList.add("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","true"))}close(){this.isOpen&&(this.isOpen=!1,this.panel.classList.remove("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","false"))}isMenuOpen(){return this.isOpen}syncVisibility(){let e=Array.from(this.panel.children).some(t=>t.style.display!=="none");this.el.style.display=e?"":"none",!e&&this.isOpen&&this.close()}refresh(){this.syncVisibility()}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.btn.removeEventListener("click",this.toggleHandler),this.el.remove(),this.api.logger.debug("Overflow tray destroyed")}};var mi=new Map,vi=new Map,nr=new Set;function kn(i,e){if(e){let t=vi.get(e)?.get(i);if(t)return t}return mi.get(i)??null}function rr(i){return nr.add(i),()=>{nr.delete(i)}}var ir=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var Sn=[32,32,32],sr=4.5,yi=`
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
  yellow:ffff00 yellowgreen:9acd32`,or;function bi(i){return or??(or=new Map(yi.trim().split(/\s+/).map(e=>e.split(":")))),or.get(i)}var Ei=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/;function ar(i,e){if(!Ei.test(i))return null;let t=i.endsWith("%")?parseFloat(i)/100*e:parseFloat(i);return Math.min(e,Math.max(0,t))}function lr(i){let e=/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(i)?.[1];if(!e)return null;let t=e.length<=4?e.split("").map(r=>r+r).join(""):e,n=t.length===8?parseInt(t.slice(6,8),16)/255:1;return[[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)],n]}function wi(i){let e=/^rgba?\(([^()]*)\)$/.exec(i)?.[1]?.trim();if(!e)return null;let t,n;if(e.includes(","))t=e.split(",").map(o=>o.trim()),t.length===4&&(n=t.pop());else{let[o="",c,...a]=e.split("/").map(u=>u.trim());if(a.length||c==="")return null;t=o.split(/\s+/),n=c}if(t.length!==3)return null;let r=t.map(o=>ar(o,255)),s=n===void 0?1:ar(n,1);return r.some(o=>o===null)||s===null?null:[r.map(o=>Math.round(o)),s]}function ki(i,e){let t=i.trim().toLowerCase(),n=bi(t),r=n?lr(`#${n}`):lr(t)??wi(t);if(!r)return null;let[s,o]=r;return o<=0?null:o>=1?s:s.map((c,a)=>Math.round(c*o+e[a]*(1-o)))}function Jt([i,e,t]){let[n,r,s]=[i,e,t].map(o=>{let c=o/255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)});return .2126*n+.7152*r+.0722*s}function cr(i,e){let t=Math.max(Jt(i),Jt(e)),n=Math.min(Jt(i),Jt(e));return(t+.05)/(n+.05)}function Si(i,e){return i.map(t=>Math.round(t+(255-t)*e))}function ur(i){return`#${i.map(e=>e.toString(16).padStart(2,"0")).join("")}`}function Ln(i){let e=ki(i,Sn);if(!e)return i;if(cr(e,Sn)>=sr)return ur(e);for(let t=.04;t<=1;t+=.04){let n=Si(e,t);if(cr(n,Sn)>=sr)return ur(n)}return"#ffffff"}var Li=["play","skip-backward","skip-forward","volume","time","live-indicator","bandwidth-indicator","spacer","settings","captions","chromecast","airplay","pip","fullscreen"],Ti="sp-ui-styles",xi=3e3,Pi=new Set([" ","Enter"]),Mi=new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"]),_i=48,dr=64,Ai=44,pr=24,hr=4,Ci=100,Ri=16,Hi=56,Di=120,gr=1500;function fr(i={}){let e,t=null,n=null,r=null,s=null,o=null,c=null,a=null,u=[],v=null,x=null,N=null,C=null,L=null,j=null,G=null,ie=!0,S=null,U=null,Y=[],z=null,K=null,h=null,V=null,q=null,P=pr,te=hr,le=dr,T=null,M=!0,A=!1,W=!1,Z=new Set,pe=null,ce=i.controls||Li,be=i.hideDelay??xi,he=i.bigPlayButton!==!1,se=i.keyboard!==!1,Ee=i.responsive!==!1;Ee&&vn(ce,i.priority);let Ue=()=>{for(let f of u){let F=f;typeof F.close=="function"&&F.close(!1)}let p=document.activeElement instanceof HTMLElement?document.activeElement:null;return K?.open(p)??!1},Pe=p=>{switch(p){case"play":return new ht(e);case"skip-backward":return new je(e,"backward");case"skip-forward":return new je(e,"forward");case"volume":return new yt(e);case"progress":return null;case"time":return new vt(e);case"live-indicator":return new bt(e);case"bandwidth-indicator":return new _t(e);case"quality":return new Et(e);case"settings":return new Tt(e);case"captions":return new xt(e);case"chromecast":return new Qe(e,"chromecast");case"airplay":return new Qe(e,"airplay");case"pip":return new wt(e);case"fullscreen":return new kt(e);case"spacer":return new St;case"keyboard-help":return se?new Pt(Ue):null;default:{let f=kn(p,e.container);if(f)try{return f(e)}catch(F){return e.logger.error(`Control factory for "${p}" threw`,{error:F}),null}return Z.add(p),e.logger.debug(`No control registered for slot "${p}" yet`),null}}},Zt=()=>{pe=null;for(let p of Z)e.logger.warn(`Control slot "${p}" has no registered control after ${gr}ms - is the plugin installed?`);Z.clear()},Re=()=>{if(!t)return;Z.clear();let p=new Map(jt(ce,i.priority).map(f=>[f.id,f]));for(let f of ce){let F=Pe(f);if(!F)continue;u.push(F);let R=F.render();t.appendChild(R);let w=p.get(f),H={slot:f,control:F,el:R,rank:w?.rank??"never",exit:w?.exit??"overflow",width:-1};Y.push(H),f==="time"&&(z=H)}Ee&&(U=new At(e),u.push(U),t.appendChild(U.render()),Ye())},Ye=()=>{if(!t||!U)return;let p=U.render(),f=Y.find(R=>R.slot==="fullscreen"),F=f&&f.el.parentNode===t?f.el:null;if(F){p.nextSibling!==F&&t.insertBefore(p,F);return}t.lastChild!==p&&t.appendChild(p)},Xe=()=>{let p="";for(let f of Y)p+=f.el.style.display==="none"?"0":"1";return`${p}:${z?.el.textContent?.length??0}`},Je=p=>{if(!t||!U)return;let f=new Set(p.overflow),F=new Set(p.hidden);for(let R of Y)if(R.slot!=="spacer"){if(F.has(R.slot)){U.holds(R.el)&&Ze(R),R.el.classList.add("sp-control--collapsed");continue}R.el.classList.remove("sp-control--collapsed"),f.has(R.slot)?U.holds(R.el)||U.adopt(R.el):U.holds(R.el)&&Ze(R)}U.refresh(),Ye()},Ze=p=>{if(!t||!U)return;let f=U.release(p.el),F=U.render(),R=F.parentNode===t?F:null;for(let w=Y.indexOf(p)+1;w<Y.length;w++)if(Y[w].el.parentNode===t){R=Y[w].el;break}t.insertBefore(f,R)},Me=p=>{if(p.slot!=="volume")return 0;let f=p.el.querySelector(".sp-volume__slider-wrap");return f?f.getBoundingClientRect().width:0},ze=p=>p.slot==="volume"?le:0,Ct=p=>{let f=getComputedStyle(p),F=parseFloat(f.paddingLeft),R=parseFloat(f.paddingRight),w=parseFloat(f.columnGap||f.gap),H=parseFloat(f.getPropertyValue("--sp-volume-slider-width"));P=Number.isFinite(F)&&Number.isFinite(R)?F+R:pr,te=Number.isFinite(w)?w:hr,le=Number.isFinite(H)?H:dr},Rt=()=>{if(!Ee||!t||!U||t.clientWidth===0)return;Ct(t);let p=Y.filter(H=>H.slot==="spacer"&&H.el.style.display!=="none").length,f=t.clientWidth-P-p*te,F=[];for(let H of Y){if(H.slot==="spacer")continue;let ue=H.el.style.display!=="none";ue&&H.el.parentNode===t&&!H.el.classList.contains("sp-control--collapsed")?H.width=H.el.getBoundingClientRect().width-Me(H):H.width<0&&(H.width=_i),F.push({id:H.slot,rank:H.rank,exit:H.exit,width:H.width+ze(H),visible:ue})}let R=U.render(),w=R.style.display==="none"?0:R.getBoundingClientRect().width;Je(yn(F,f,te,w||Ai)),T=Xe(),M=!1},Ht=()=>{Ee&&(!M&&Xe()===T||Rt())},Dt=p=>{let f=t?.offsetHeight||Hi;e?.container?.style.setProperty("--sp-menu-max-height",`${Math.max(Di,Math.round(p)-f-Ri)}px`)},It=()=>{t&&(u.forEach(p=>p.destroy()),u=[],Y=[],z=null,U=null,pt(t),T=null,M=!0,Re(),et())},Nt=()=>{W&&(W=!1,It())},en=()=>{W||(W=!0,queueMicrotask(Nt))},et=()=>{u.forEach(H=>H.update()),r?.update();let p=e?.getState("waiting"),f=e?.getState("seeking"),R=e?.getState("playbackState")==="loading",w=p||f&&!e?.getState("paused")||R;s?.classList.toggle("sp-buffering--visible",!!w),o?.update(),c?.update(),Ht()},Te=()=>{S===null&&(S=requestAnimationFrame(()=>{S=null,et()}))},Ke=()=>r?.isTimelineEditing()?!0:u.some(p=>{let f=p;return typeof f.isMenuOpen=="function"&&f.isMenuOpen()}),we=()=>{if(ie){He();return}ie=!0,t?.classList.add("sp-controls--visible"),t?.classList.remove("sp-controls--hidden"),n?.classList.add("sp-gradient--visible"),r?.show(),e?.setState("controlsVisible",!0),He()},tt=()=>{if(!e?.getState("paused")){if(Ke()){He();return}ie=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),n?.classList.remove("sp-gradient--visible"),r?.hide(),e?.setState("controlsVisible",!1)}},He=()=>{v&&clearTimeout(v),v=setTimeout(tt,be)},fe=null,xe=p=>{fe=p.pointerType},ke=p=>{fe==="touch"&&!Ot(p)&&e?.getPlugin("gestures")?.ownsTapInteraction()||we()},Ot=p=>{let f=p?.target;return f instanceof Node?!!t?.contains(f)||!!r?.render().contains(f):!1},Ft=()=>{tt()},De=p=>p.key.length===1&&p.key>="0"&&p.key<="9"&&!p.shiftKey&&!(typeof p.getModifierState=="function"&&p.getModifierState("AltGraph")),nt=(p,f)=>{let F=e.getState("live"),R=e.getState("seekableRange");if(F){if(!R)return null;let{start:Se,end:l}=R;return!Number.isFinite(Se)||!Number.isFinite(l)||l<=Se?null:Math.min(l,Math.max(Se,Se+p/10*(l-Se)))}let w=Number(e.getState("duration")),H=f.duration,ue=Number.isFinite(w)&&w>0?w:Number.isFinite(H)&&H>0?H:null;return ue===null?null:Math.min(ue,Math.max(0,p/10*ue))},_e=p=>{if(!e.container.contains(document.activeElement)||p.defaultPrevented||p.metaKey||p.ctrlKey||p.altKey)return;let f=document.activeElement;if(f instanceof HTMLInputElement||f instanceof HTMLTextAreaElement||f instanceof HTMLSelectElement||f?.isContentEditable)return;let F=f?.getAttribute("role");if((f instanceof HTMLButtonElement||F==="button"||F==="menuitem")&&Pi.has(p.key)||F==="slider"&&Mi.has(p.key)||K?.isOpen())return;if(p.key==="?"){Ue()&&p.preventDefault();return}if(p.key==="c"||p.key==="C"){Xt(e)&&p.preventDefault();return}let w=e.container.querySelector("video");if(!w)return;if(De(p)){let Se=nt(Number(p.key),w);if(Se===null)return;p.preventDefault(),w.currentTime=Se,e.emit("playback:seeking",{time:w.currentTime}),we();return}let H=e.getState("live"),ue=e.getState("seekableRange");switch(p.key){case" ":case"k":p.preventDefault(),w.paused?w.play().catch(()=>{}):w.pause();break;case"m":p.preventDefault(),w.muted=!w.muted;break;case"f":p.preventDefault(),Ne(e.container)?Fe(e.container).catch(()=>{}):Oe(e.container).catch(()=>{});break;case"ArrowLeft":p.preventDefault(),H&&ue?w.currentTime=Math.max(ue.start,w.currentTime-5):w.currentTime=Math.max(0,w.currentTime-5),e.emit("playback:seeking",{time:w.currentTime}),we();break;case"ArrowRight":p.preventDefault(),H&&ue?w.currentTime=Math.min(ue.end,w.currentTime+5):w.currentTime=Math.min(w.duration||0,w.currentTime+5),e.emit("playback:seeking",{time:w.currentTime}),we();break;case"ArrowUp":p.preventDefault(),w.volume=Math.min(1,w.volume+.1),we();break;case"ArrowDown":p.preventDefault(),w.volume=Math.max(0,w.volume-.1),we();break}};return{id:"ui-controls",name:"UI Controls",type:"ui",version:ir,async init(p){e=p,a=un(Ti,bn),i.theme&&this.setTheme(i.theme);let f=e.container;if(!f){e.logger.error("UI plugin: container not found");return}getComputedStyle(f).position==="static"&&(f.style.position="relative"),f.classList.contains("sp-container")||(f.classList.add("sp-container"),A=!0);let R=e.getState("playing");n=document.createElement("div"),n.className=R?"sp-gradient":"sp-gradient sp-gradient--visible",f.appendChild(n),s=document.createElement("div"),s.className="sp-buffering",s.innerHTML=k.spinner,s.setAttribute("aria-hidden","true"),f.appendChild(s),o=new Lt(e),f.appendChild(o.render()),C=e.on("error",w=>{if(w?.fatal){let H=e.getState("error")||w;o?.show(H),Te()}}),L=e.on("error:reconnecting",()=>{o?.showReconnecting(),Te()}),j=e.on("error:recovered",()=>{o?.hide(),Te()}),G=e.on("media:loaded",()=>{o?.hide(),Te()}),he&&(c=new gt(e,()=>o?.isVisible()??!1),f.appendChild(c.render())),K=new Mt(e),r=new mt(e,{onEditingChange:w=>{w?we():He()}}),f.appendChild(r.render()),R||r.show(),t=document.createElement("div"),t.className=R?"sp-controls sp-controls--hidden":"sp-controls sp-controls--visible",t.setAttribute("role","toolbar"),t.setAttribute("aria-label","Video controls"),Re(),Z.size>0&&(pe=setTimeout(Zt,gr)),f.appendChild(t),Ee&&typeof ResizeObserver=="function"?(h=new ResizeObserver(w=>{Dt(w[0]?.contentRect.height??f.clientHeight),M=!0,Te()}),h.observe(f)):Ee&&typeof window<"u"&&(q=()=>{V&&clearTimeout(V),V=setTimeout(()=>{V=null,Dt(f.clientHeight),M=!0,Te()},Ci)},window.addEventListener("resize",q)),N=rr((w,H)=>{ce.includes(w)&&(H&&H!==e.container||(e.logger.debug(`Control "${w}" registered after init, queuing a control bar rebuild`),en()))}),f.addEventListener("pointerdown",xe,{passive:!0}),f.addEventListener("pointermove",xe,{passive:!0}),f.addEventListener("mousemove",ke),f.addEventListener("mouseenter",ke),f.addEventListener("mouseleave",Ft),f.addEventListener("touchstart",ke,{passive:!0}),f.addEventListener("click",ke),se&&document.addEventListener("keydown",_e),x=e.subscribeToState(Te),et(),f.hasAttribute("tabindex")||f.setAttribute("tabindex","0"),ie=!R,e.setState("controlsVisible",ie),R&&He(),e.logger.debug("UI controls plugin initialized")},async destroy(){v&&(clearTimeout(v),v=null),S!==null&&(cancelAnimationFrame(S),S=null),h?.disconnect(),h=null,q&&(window.removeEventListener("resize",q),q=null),V&&(clearTimeout(V),V=null),e?.container?.style.removeProperty("--sp-menu-max-height"),x?.(),x=null,K?.destroy(),K=null,C?.(),C=null,L?.(),L=null,j?.(),j=null,G?.(),G=null,e?.container&&(e.container.removeEventListener("pointerdown",xe),e.container.removeEventListener("pointermove",xe),e.container.removeEventListener("mousemove",ke),e.container.removeEventListener("mouseenter",ke),e.container.removeEventListener("mouseleave",Ft),e.container.removeEventListener("touchstart",ke),e.container.removeEventListener("click",ke)),se&&document.removeEventListener("keydown",_e),N?.(),N=null,W=!1,pe&&(clearTimeout(pe),pe=null),Z.clear(),u.forEach(p=>p.destroy()),u=[],Y=[],z=null,U=null,r?.destroy(),r=null,o?.destroy(),o=null,c?.destroy(),c=null,t?.remove(),t=null,n?.remove(),n=null,s?.remove(),s=null,a?.(),a=null,A&&(e?.container?.classList.remove("sp-container"),A=!1),e?.logger.debug("UI controls plugin destroyed")},show(){we()},hide(){ie=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),n?.classList.remove("sp-gradient--visible"),r?.hide(),e?.setState("controlsVisible",!1)},setTheme(p){let f=e?.container||document.documentElement;p.primaryColor&&f.style.setProperty("--sp-color",p.primaryColor),p.accentColor&&f.style.setProperty("--sp-accent",p.accentColor),p.accentTextColor&&f.style.setProperty("--sp-accent-text",p.accentTextColor),p.backgroundColor&&f.style.setProperty("--sp-bg",p.backgroundColor),p.controlBarHeight&&f.style.setProperty("--sp-control-height",`${p.controlBarHeight}px`),p.iconSize&&f.style.setProperty("--sp-icon-size",`${p.iconSize}px`)},getControlBar(){return t}}}async function Ml(i,e){let t=e.accentColor??"#e50914",n=await ln({container:i,src:e.src,poster:e.poster,plugins:[jn(),Jn(),fr({theme:{accentColor:t,accentTextColor:Ln(t)}})]});if(n.getState().error)throw await n.destroy(),new Error("The sample failed to load");return{async play(){let r=i.querySelector("video");if(!r)throw new Error("The player has no media element");await r.play()},onFirstPlaying(r){if(n.playing){r();return}let s=n.subscribeToState(o=>{o.key==="playing"&&o.value===!0&&(s(),r())})},destroy(){return n.destroy()}}}export{Ml as mountHomePlayer};
