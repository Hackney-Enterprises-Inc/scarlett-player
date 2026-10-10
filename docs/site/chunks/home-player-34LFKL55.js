import{a as ir}from"./chunk-VC46IEJQ.js";var qt=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var Ne=null;var fn=new WeakMap;function Tt(i,e){let t=fn.get(i);t||(t=new Set,fn.set(i,t)),t.add(e)}var qe=class{constructor(e){this.subscribers=new Set;this.value=e}get(){if(Ne){let e=Ne;this.subscribers.add(e),Tt(e,()=>this.subscribers.delete(e))}return this.value}set(e){Object.is(this.value,e)||(this.value=e,this.notify())}update(e){this.set(e(this.value))}subscribe(e){return this.subscribers.add(e),()=>this.subscribers.delete(e)}notify(){Array.from(this.subscribers).forEach(e=>{try{e()}catch(t){console.error("[Scarlett Player] Error in signal subscriber:",t)}})}destroy(){this.subscribers.clear()}getSubscriberCount(){return this.subscribers.size}};function Pt(i){return new qe(i)}var Oe={playbackState:"idle",playing:!1,paused:!0,ended:!1,buffering:!1,waiting:!1,seeking:!1,currentTime:0,duration:NaN,buffered:null,bufferedAmount:0,mediaType:"unknown",source:null,title:"",poster:"",volume:1,muted:!1,playbackRate:1,fullscreen:!1,pip:!1,controlsVisible:!0,qualities:[],currentQuality:null,audioTracks:[],currentAudioTrack:null,textTracks:[],currentTextTrack:null,live:!1,liveEdge:!0,seekableRange:null,liveLatency:0,lowLatencyMode:!1,chapters:[],currentChapter:null,error:null,bandwidth:0,autoplay:!1,loop:!1,airplayAvailable:!1,airplayActive:!1,chromecastAvailable:!1,chromecastActive:!1,thumbnails:null,interacting:!1,hovering:!1,focused:!1},We=class{constructor(e){this.signals=new Map;this.changeSubscribers=new Set;this.definedDefaults=new Map;this.lastValues=new Map;this.destroyed=!1;this.initializeSignals(e)}initializeSignals(e){let t={...Oe,...e};for(let[n,r]of Object.entries(t))this.createSignal(n,r)}createSignal(e,t){let n=Pt(t);this.lastValues.set(e,t),n.subscribe(()=>{this.notifyChangeSubscribers(e)}),this.signals.set(e,n)}define(e,t){if(this.signals.has(e)){let n=this.definedDefaults.has(e),r=e in Oe,s=n?this.definedDefaults.get(e):Oe[e];(n||r)&&!Object.is(s,t)&&console.warn(`[StateManager] State key "${String(e)}" is already defined with a different default. Keeping:`,s,"ignoring:",t);return}this.definedDefaults.set(e,t),this.createSignal(e,t)}get(e){if(this.destroyed)throw new Error(`[StateManager] Manager is destroyed (reading '${e}')`);let t=this.signals.get(e);if(!t)throw new Error(`[StateManager] Unknown state key: ${e}`);return t}getValue(e){return this.get(e).get()}set(e,t){this.get(e).set(t)}update(e){for(let[t,n]of Object.entries(e)){let r=t;this.signals.has(r)&&this.set(r,n)}}subscribeToKey(e,t){let n=this.get(e);return n.subscribe(()=>{t(n.get())})}subscribe(e){return this.changeSubscribers.add(e),()=>this.changeSubscribers.delete(e)}notifyChangeSubscribers(e){let n=this.get(e).get(),r=this.lastValues.get(e);this.lastValues.set(e,n);let s={key:e,value:n,previousValue:r};Array.from(this.changeSubscribers).forEach(o=>{try{o(s)}catch(u){console.error("[StateManager] Error in change subscriber:",u)}})}reset(){this.update({...Oe,...Object.fromEntries(this.definedDefaults)})}resetKey(e){let t=e in Oe?Oe[e]:this.definedDefaults.get(e);this.set(e,t)}snapshot(){let e={};for(let[t,n]of this.signals)e[t]=n.get();return Object.freeze(e)}getSubscriberCount(e){return this.signals.get(e)?.getSubscriberCount()??0}destroy(){this.signals.forEach(e=>e.destroy()),this.signals.clear(),this.changeSubscribers.clear(),this.lastValues.clear(),this.destroyed=!0}};var ur={maxListeners:100,async:!1,interceptors:!0},Ge=class{constructor(e){this.listeners=new Map;this.onceListeners=new Map;this.interceptors=new Map;this.options={...ur,...e}}on(e,t){return this.listeners.has(e)||this.listeners.set(e,new Set),this.listeners.get(e).add(t),this.checkMaxListeners(e),()=>this.off(e,t)}once(e,t){this.onceListeners.has(e)||this.onceListeners.set(e,new Set);let n=this.onceListeners.get(e);return n.add(t),this.listeners.has(e)||this.listeners.set(e,new Set),()=>{n.delete(t)}}off(e,t){let n=this.listeners.get(e);n&&(n.delete(t),n.size===0&&this.listeners.delete(e));let r=this.onceListeners.get(e);r&&(r.delete(t),r.size===0&&this.onceListeners.delete(e))}emit(e,t){let n=this.runInterceptors(e,t);if(n===null)return;let r=this.listeners.get(e);r&&Array.from(r).forEach(u=>{this.safeCallHandler(u,n)});let s=this.onceListeners.get(e);s&&(Array.from(s).forEach(u=>{s.delete(u),this.safeCallHandler(u,n)}),s.size===0&&this.onceListeners.delete(e))}async emitAsync(e,t){let n=await this.runInterceptorsAsync(e,t);if(n===null)return;let r=this.listeners.get(e);if(r){let o=Array.from(r).map(u=>this.safeCallHandlerAsync(u,n));await Promise.all(o)}let s=this.onceListeners.get(e);if(s){let u=Array.from(s).map(a=>(s.delete(a),this.safeCallHandlerAsync(a,n)));await Promise.all(u),s.size===0&&this.onceListeners.delete(e)}}intercept(e,t){if(!this.options.interceptors)return()=>{};this.interceptors.has(e)||this.interceptors.set(e,new Set);let n=this.interceptors.get(e);return n.add(t),()=>{n.delete(t),n.size===0&&this.interceptors.delete(e)}}removeAllListeners(e){e?(this.listeners.delete(e),this.onceListeners.delete(e)):(this.listeners.clear(),this.onceListeners.clear())}listenerCount(e){let t=this.listeners.get(e)?.size??0,n=this.onceListeners.get(e)?.size??0;return t+n}destroy(){this.listeners.clear(),this.onceListeners.clear(),this.interceptors.clear()}runInterceptors(e,t){if(!this.options.interceptors)return t;let n=this.interceptors.get(e);if(!n||n.size===0)return t;let r=t;for(let s of n)try{if(r=s(r),r===null)return null}catch(o){console.error("[EventBus] Error in interceptor:",o)}return r}async runInterceptorsAsync(e,t){if(!this.options.interceptors)return t;let n=this.interceptors.get(e);if(!n||n.size===0)return t;let r=t;for(let s of n)try{let o=s(r);if(r=o instanceof Promise?await o:o,r===null)return null}catch(o){console.error("[EventBus] Error in interceptor:",o)}return r}safeCallHandler(e,t){try{e(t)}catch(n){console.error("[EventBus] Error in event handler:",n)}}async safeCallHandlerAsync(e,t){try{let n=e(t);n instanceof Promise&&await n}catch(n){console.error("[EventBus] Error in event handler:",n)}}checkMaxListeners(e){let t=this.listenerCount(e);t>this.options.maxListeners&&console.warn(`[EventBus] Max listeners (${this.options.maxListeners}) exceeded for event: ${e}. Current count: ${t}. This may indicate a memory leak.`)}};var yn=["debug","info","warn","error"],dr=i=>{let t=`${i.scope?`[${i.scope}]`:"[ScarlettPlayer]"} ${i.message}`,n=i.metadata??"";switch(i.level){case"debug":console.debug(t,n);break;case"info":console.info(t,n);break;case"warn":console.warn(t,n);break;case"error":console.error(t,n);break}},Qe=class i{constructor(e){this.level=e?.level??"warn",this.scope=e?.scope,this.enabled=e?.enabled??!0,this.handlers=e?.handlers??[dr]}child(e){return new i({level:this.level,scope:this.scope?`${this.scope}:${e}`:e,enabled:this.enabled,handlers:this.handlers})}debug(e,t){this.log("debug",e,t)}info(e,t){this.log("info",e,t)}warn(e,t){this.log("warn",e,t)}error(e,t){this.log("error",e,t)}setLevel(e){this.level=e}setEnabled(e){this.enabled=e}addHandler(e){this.handlers.push(e)}removeHandler(e){let t=this.handlers.indexOf(e);t!==-1&&this.handlers.splice(t,1)}log(e,t,n){if(!this.enabled||!this.shouldLog(e))return;let r={level:e,message:t,timestamp:Date.now(),scope:this.scope,metadata:n};for(let s of this.handlers)try{s(r)}catch(o){console.error("[Logger] Handler error:",o)}}shouldLog(e){return yn.indexOf(e)>=yn.indexOf(this.level)}};var xe=(M=>(M.SOURCE_NOT_SUPPORTED="SOURCE_NOT_SUPPORTED",M.SOURCE_LOAD_FAILED="SOURCE_LOAD_FAILED",M.PROVIDER_NOT_FOUND="PROVIDER_NOT_FOUND",M.PROVIDER_SETUP_FAILED="PROVIDER_SETUP_FAILED",M.PLUGIN_SETUP_FAILED="PLUGIN_SETUP_FAILED",M.PLUGIN_NOT_FOUND="PLUGIN_NOT_FOUND",M.PLAYBACK_FAILED="PLAYBACK_FAILED",M.MEDIA_DECODE_ERROR="MEDIA_DECODE_ERROR",M.MEDIA_NETWORK_ERROR="MEDIA_NETWORK_ERROR",M.MEDIA_APPEND_ERROR="MEDIA_APPEND_ERROR",M.MEDIA_BUFFER_FULL="MEDIA_BUFFER_FULL",M.PLAYLIST_INVALID="PLAYLIST_INVALID",M.UNKNOWN_ERROR="UNKNOWN_ERROR",M))(xe||{}),je=class{constructor(e,t,n){this.errors=[];this.eventBus=e,this.logger=t,this.maxHistory=n?.maxHistory??10}handle(e,t){let n=this.normalizeError(e,t);return this.addToHistory(n),this.logError(n),this.eventBus.emit("error",n),n}record(e,t){let n=this.normalizeError(e,t);return this.addToHistory(n),this.logError(n),n}throw(e,t,n){let r={code:e,message:t,fatal:n?.fatal??this.isFatalCode(e),timestamp:Date.now(),context:n?.context,originalError:n?.originalError};return this.handle(r,n?.context)}getHistory(){return[...this.errors]}getLastError(){return this.errors[this.errors.length-1]??null}clearHistory(){this.errors=[]}hasFatalError(){return this.errors.some(e=>e.fatal)}normalizeError(e,t){return this.isPlayerError(e)?{...e,context:{...e.context,...t}}:{code:this.getErrorCode(e),message:e.message,fatal:this.isFatal(e,t),timestamp:Date.now(),context:t,originalError:e}}getErrorCode(e){let t=e.message.toLowerCase();return t.includes("quota")?"MEDIA_BUFFER_FULL":t.includes("append")||t.includes("sourcebuffer")||t.includes("arraybuffer")?"MEDIA_APPEND_ERROR":t.includes("network")?"MEDIA_NETWORK_ERROR":t.includes("decode")?"MEDIA_DECODE_ERROR":t.includes("source")?"SOURCE_LOAD_FAILED":t.includes("plugin")?"PLUGIN_SETUP_FAILED":t.includes("provider")?"PROVIDER_SETUP_FAILED":"UNKNOWN_ERROR"}isFatal(e,t){return t?.operation==="load"?!0:this.isFatalCode(this.getErrorCode(e))}isFatalCode(e){return["SOURCE_NOT_SUPPORTED","PROVIDER_NOT_FOUND","MEDIA_DECODE_ERROR"].includes(e)}isPlayerError(e){return typeof e=="object"&&e!==null&&"code"in e&&"message"in e&&"fatal"in e&&"timestamp"in e}addToHistory(e){this.errors.push(e),this.errors.length>this.maxHistory&&this.errors.shift()}logError(e){let t=`[${e.code}] ${e.message}`;e.fatal?this.logger.error(t,{code:e.code,context:e.context}):this.logger.warn(t,{code:e.code,context:e.context})}};var Ye=class{constructor(e,t){this.cleanupFns=[];this.pluginId=e,this.stateManager=t.stateManager,this.eventBus=t.eventBus,this.container=t.container,this.getPluginFn=t.getPlugin,this.getProviderDiagnosticsFn=t.getProviderDiagnostics,this.logger={debug:(n,r)=>t.logger.debug(`[${e}] ${n}`,r),info:(n,r)=>t.logger.info(`[${e}] ${n}`,r),warn:(n,r)=>t.logger.warn(`[${e}] ${n}`,r),error:(n,r)=>t.logger.error(`[${e}] ${n}`,r)}}getState(e){return this.stateManager.getValue(e)}setState(e,t){this.stateManager.set(e,t)}defineState(e,t){this.stateManager.define(e,t)}on(e,t){return this.eventBus.on(e,t)}off(e,t){this.eventBus.off(e,t)}emit(e,t){this.eventBus.emit(e,t)}getPlugin(e){return this.getPluginFn(e)}onDestroy(e){this.cleanupFns.push(e)}subscribeToState(e){return this.stateManager.subscribe(e)}getProviderDiagnostics(){return this.getProviderDiagnosticsFn?this.getProviderDiagnosticsFn():{}}runCleanups(){for(let e of this.cleanupFns)try{e()}catch(t){this.logger.error("Cleanup function failed",{error:t})}this.cleanupFns=[]}getCleanupFns(){return this.cleanupFns}};var be={MAX_ERRORS:20,MAX_TIME_RANGES:32,MAX_OBJECT_KEYS:64,MAX_ARRAY_ITEMS:50,MAX_NESTING_DEPTH:4,MAX_NODES:500},bn=new Set(["__proto__","constructor","prototype"]),pr=/(token|secret|password|credential|auth|authorization|cookie|session|signature)/i,hr=/^[A-Za-z][A-Za-z0-9_]{0,39}$/,gr=new Set(["id","userid","viewerid","uid","email","ip","url","uri","src","href","key"]),En=new Set(["hls.js","native","new","connecting","connected","disconnected","failed","closed","checking","completed","stable","have-local-offer","have-remote-offer","have-local-pranswer","have-remote-pranswer"]),Wt=!1,fr=new Set(["playback","network","media","source","player","access","unknown"]),mr=["httpStatus","mediaErrorCode","networkState","readyState","attempts"],vr=["retriesExhausted","reconnectExhausted","reconnecting","timedOut"];function wn(i){if(typeof i!="string"||i.trim()==="")return null;try{let e=typeof document<"u"?document.baseURI:void 0,t=new URL(i,e);return t.protocol==="blob:"||t.protocol==="data:"?null:t.hostname||null}catch{return null}}function Mt(i,e=1,t=new WeakSet,n={omitted:0}){if(i===void 0)return;if(e>be.MAX_NESTING_DEPTH){n.omitted++;return}if(n.nodes=(n.nodes??0)+1,n.nodes>be.MAX_NODES){n.omitted++;return}if(i===null)return null;if(typeof i=="boolean")return i;if(typeof i=="number")return Number.isFinite(i)?i:null;if(typeof i=="string"){if(En.has(i))return i;n.omitted++;return}if(typeof i!="object"||typeof i.then=="function"||i instanceof Promise){n.omitted++;return}if(t.has(i)){n.omitted++;return}if(t.add(i),Array.isArray(i)){let o=[],u=Math.min(i.length,be.MAX_ARRAY_ITEMS);n.omitted+=i.length-u;for(let a=0;a<u;a++){if(n.nodes>=be.MAX_NODES){n.omitted+=u-a;break}try{let d=Mt(i[a],e+1,t,n);d!==void 0&&o.push(d)}catch{n.omitted++}}return o}if(!yr(i)){n.omitted++;return}let r=Object.create(null),s=Object.keys(i);for(let o=0;o<s.length;o++){if(o>=be.MAX_OBJECT_KEYS||n.nodes>=be.MAX_NODES){n.omitted+=s.length-o;break}let u=s[o];if(!br(u)){n.omitted++;continue}try{let a=i[u],d=Mt(a,e+1,t,n);d!==void 0&&(r[u]=d)}catch{n.omitted++}}return r}function yr(i){try{let e=Object.getPrototypeOf(i);return e===null||e===Object.prototype}catch{return!1}}function br(i){return hr.test(i)&&!bn.has(i)&&!gr.has(i.toLowerCase())&&!pr.test(i)}function _t(i,e){let t=Object.create(null);if(Wt)return t;Wt=!0;try{Er(t,i,e)}finally{Wt=!1}return t}function Er(i,e,t){for(let n of e)if(!(!n||typeof n.id!="string")&&!bn.has(n.id)){if(typeof n.getDiagnostics!="function"){i[n.id]=null;continue}try{let r=n.getDiagnostics();if(r==null)i[n.id]=null;else if(typeof r.then=="function"||r instanceof Promise)i[n.id]={unavailable:!0};else{let s={omitted:0},o=Mt(r,1,new WeakSet,s);i[n.id]=o!==void 0?o:{unavailable:!0},s.omitted>0&&t?.push(n.id)}}catch{i[n.id]={unavailable:!0}}}t?.sort()}function kn(i){if(i.context?.category&&fr.has(i.context.category))return i.context.category;let e=i.detail||{};return[401,403,451].includes(e.httpStatus)?"access":i.code==="MEDIA_NETWORK_ERROR"||i.code==="SOURCE_LOAD_FAILED"||e.type==="network"?"network":i.code==="MEDIA_DECODE_ERROR"||i.code==="MEDIA_APPEND_ERROR"||i.code==="MEDIA_BUFFER_FULL"||e.type==="media"?"media":i.code==="SOURCE_NOT_SUPPORTED"||i.code==="PLAYLIST_INVALID"||i.code==="PROVIDER_NOT_FOUND"?"source":i.code==="PLAYBACK_FAILED"?"playback":i.code==="PROVIDER_SETUP_FAILED"||i.code==="PLUGIN_SETUP_FAILED"||i.code==="PLUGIN_NOT_FOUND"?"player":e.mediaErrorCode===2?"network":e.mediaErrorCode===3?"media":e.mediaErrorCode===4?"source":"unknown"}function Sn(i,e=be.MAX_ERRORS){let t=[],n=new Set(Object.values(xe)),r=e>0?i.slice(-e):[];for(let s of r){let o=n.has(s.code)?s.code:"UNKNOWN_ERROR",u=kn(s),a=!!s.fatal,d=Number.isFinite(s.timestamp)?s.timestamp:Date.now(),y={code:o,category:u,fatal:a,timestamp:d};if(s.detail&&typeof s.detail=="object"){let P={},R=!1;for(let M of mr){let w=s.detail[M];typeof w=="number"&&Number.isFinite(w)&&(P[M]=w,R=!0)}for(let M of vr){let w=s.detail[M];typeof w=="boolean"&&(P[M]=w,R=!0)}R&&(y.detail=P)}t.push(y)}return t}function Gt(i,e,t){if(t||!i)return{playbackState:"destroyed",playing:!1,paused:!1,ended:!1,buffering:!1,seeking:!1,currentTime:null,duration:null,volume:null,muted:null,playbackRate:null,mediaType:null,live:null,seekableRange:null,liveEdge:null,liveLatency:null,dimensions:null,source:null};let n=i.snapshot(),r=Number.isFinite(n.currentTime)?n.currentTime:null,s=Number.isFinite(n.duration)?n.duration:null,o=Number.isFinite(n.volume)?n.volume:null,u=Number.isFinite(n.playbackRate)?n.playbackRate:null,a=null;(n.mediaType==="video"||n.mediaType==="audio")&&(a=n.mediaType);let d=null;n.seekableRange&&typeof n.seekableRange.start=="number"&&typeof n.seekableRange.end=="number"&&Number.isFinite(n.seekableRange.start)&&Number.isFinite(n.seekableRange.end)&&(d={start:n.seekableRange.start,end:n.seekableRange.end});let y=null,P=null;n.live&&(y=typeof n.liveEdge=="boolean"?n.liveEdge:null,P=Number.isFinite(n.liveLatency)?n.liveLatency:null);let R=null;if(e){let w=e.querySelector("video");w&&w.videoWidth>0&&w.videoHeight>0&&(R={width:w.videoWidth,height:w.videoHeight})}let M=null;return n.source&&n.source.src&&(M={hostname:wn(n.source.src),...n.source.type?{type:n.source.type}:{}}),{playbackState:n.playbackState||"idle",playing:!!n.playing,paused:!!n.paused,ended:!!n.ended,buffering:!!n.buffering,seeking:!!n.seeking,currentTime:r,duration:s,volume:o,muted:typeof n.muted=="boolean"?n.muted:!1,playbackRate:u,mediaType:a,live:!!n.live,seekableRange:d,liveEdge:y,liveLatency:P,dimensions:R,source:M}}function Qt(i){let e=Date.now(),t=i.playerVersion;if(i.isDestroyed||!i.stateManager)return{schemaVersion:1,timestamp:e,playerVersion:t,playbackState:Gt(null,null,!0),errors:[],providers:Object.create(null),truncatedProviders:[]};let n=Gt(i.stateManager,i.container,!1),r=i.errorHandler?Sn(i.errorHandler.getHistory()):[],s=i.pluginManager?i.pluginManager.getReadyPlugins().filter(a=>a.type==="provider"):[],o=[],u=_t(s,o);return{schemaVersion:1,timestamp:e,playerVersion:t,playbackState:n,errors:r,providers:u,truncatedProviders:o}}var Xe=class{constructor(e,t,n,r){this.plugins=new Map;this.initPromises=new Map;this.destroyPromises=new Map;this.initializingStack=new Set;this.eventBus=e,this.stateManager=t,this.logger=n,this.container=r.container}register(e,t){if(this.plugins.has(e.id))throw new Error(`Plugin "${e.id}" is already registered`);this.validatePlugin(e);let n=new Ye(e.id,{stateManager:this.stateManager,eventBus:this.eventBus,logger:this.logger,container:this.container,getPlugin:r=>this.getReadyPlugin(r),getProviderDiagnostics:()=>this.getProviderDiagnostics()});this.plugins.set(e.id,{plugin:e,state:"registered",config:t,cleanupFns:[],api:n}),this.logger.info(`Plugin registered: ${e.id}`),this.eventBus.emit("plugin:registered",{name:e.id,type:e.type})}async unregister(e){let t=this.plugins.get(e);t&&(t.state==="ready"&&await this.destroyPlugin(e),this.plugins.delete(e),this.logger.info(`Plugin unregistered: ${e}`))}async initAll(){let e=this.resolveDependencyOrder();for(let t of e)await this.initPlugin(t)}async initPlugin(e){let t=this.plugins.get(e);if(!t)throw new Error(`Plugin "${e}" not found`);let n=this.destroyPromises.get(e);if(n&&await n,t.state==="ready")return;if(this.initializingStack.has(e))throw new Error(`Plugin "${e}" is already initializing (possible circular dependency)`);let r=this.initPromises.get(e);if(r)return r;if(t.state==="initializing"){let o=this.initPromises.get(e);return o||void 0}let s=(async()=>{this.initializingStack.add(e);try{for(let o of t.plugin.dependencies||[]){let u=this.plugins.get(o);if(!u)throw new Error(`Plugin "${e}" depends on missing plugin "${o}"`);u.state!=="ready"&&await this.initPlugin(o)}}finally{this.initializingStack.delete(e)}try{if(t.state="initializing",t.plugin.onStateChange){let o=this.stateManager.subscribe(t.plugin.onStateChange.bind(t.plugin));t.api.onDestroy(o)}if(t.plugin.onError){let o=this.eventBus.on("error",u=>{t.plugin.onError?.(u.originalError||new Error(u.message))});t.api.onDestroy(o)}await t.plugin.init(t.api,t.config),t.state="ready",this.logger.info(`Plugin ready: ${e}`),this.eventBus.emit("plugin:active",{name:e})}catch(o){throw t.state="error",t.error=o,t.api.runCleanups(),this.logger.error(`Plugin init failed: ${e}`,{error:o}),this.eventBus.emit("plugin:error",{name:e,error:o}),o}finally{this.initPromises.delete(e)}})();return this.initPromises.set(e,s),s}async destroyAll(){let e=this.resolveDependencyOrder().reverse();for(let t of e){let n=this.destroyPlugin(t);if(this.initPromises.has(t)){n.catch(()=>{});continue}await n}}async destroyPlugin(e){let t=this.destroyPromises.get(e);if(t)return t;let n=this.plugins.get(e);if(!n)return;let r=this.initPromises.get(e);if(!r&&n.state!=="ready")return;let s=(async()=>{if(r)try{await r}catch{}if(n.state!=="ready"){n.api.runCleanups();return}try{await n.plugin.destroy()}catch(o){this.logger.error(`Plugin destroy failed: ${e}`,{error:o})}finally{n.api.runCleanups(),n.state="registered",this.eventBus.emit("plugin:destroyed",{name:e})}})();this.destroyPromises.set(e,s);try{await s}finally{this.destroyPromises.get(e)===s&&this.destroyPromises.delete(e)}}getPlugin(e){let t=this.plugins.get(e);return t?t.plugin:null}getReadyPlugin(e){let t=this.plugins.get(e);return t?.state==="ready"?t.plugin:null}hasPlugin(e){return this.plugins.has(e)}getPluginState(e){return this.plugins.get(e)?.state??null}getPluginIds(){return Array.from(this.plugins.keys())}getReadyPlugins(){return Array.from(this.plugins.values()).filter(e=>e.state==="ready").map(e=>e.plugin)}getPluginsByType(e){return Array.from(this.plugins.values()).filter(t=>t.plugin.type===e).map(t=>t.plugin)}getProviderDiagnostics(){let e=this.getReadyPlugins().filter(t=>t.type==="provider");return _t(e)}selectProvider(e){let t=this.getPluginsByType("provider");for(let n of t){let r=n.canPlay;if(typeof r=="function"&&r(e))return n}return null}resolveDependencyOrder(){let e=new Set,t=new Set,n=[],r=(s,o=[])=>{if(e.has(s))return;if(t.has(s)){let a=[...o,s].join(" -> ");throw new Error(`Circular dependency detected: ${a}`)}let u=this.plugins.get(s);if(u){t.add(s);for(let a of u.plugin.dependencies||[])this.plugins.has(a)&&r(a,[...o,s]);t.delete(s),e.add(s),n.push(s)}};for(let s of this.plugins.keys())r(s);return n}validatePlugin(e){if(!e.id||typeof e.id!="string")throw new Error("Plugin must have a valid id");if(!e.name||typeof e.name!="string")throw new Error(`Plugin "${e.id}" must have a valid name`);if(!e.version||typeof e.version!="string")throw new Error(`Plugin "${e.id}" must have a valid version`);if(!e.type||typeof e.type!="string")throw new Error(`Plugin "${e.id}" must have a valid type`);if(typeof e.init!="function")throw new Error(`Plugin "${e.id}" must have an init() method`);if(typeof e.destroy!="function")throw new Error(`Plugin "${e.id}" must have a destroy() method`)}};function jt(i){return i.querySelector("video")}function Te(i){let e=document,t=e.fullscreenElement??e.webkitFullscreenElement??null;return t&&i.contains(t)?!0:!!jt(i)?.webkitDisplayingFullscreen}async function Pe(i){let e=i;if(e.requestFullscreen){await e.requestFullscreen();return}if(e.webkitRequestFullscreen){await e.webkitRequestFullscreen();return}let t=jt(i);if(t?.webkitEnterFullscreen){t.webkitEnterFullscreen();return}throw new Error("Fullscreen is not supported")}async function Me(i){let e=jt(i);if(e?.webkitDisplayingFullscreen){e.webkitExitFullscreen?.();return}let t=document;if(t.exitFullscreen){await t.exitFullscreen();return}t.webkitExitFullscreen&&await t.webkitExitFullscreen()}function X(i){if(i)try{let e=new URL(i);return e.protocol!=="http:"&&e.protocol!=="https:"?void 0:`${e.origin}${e.pathname}`}catch{return}}var At=class{constructor(e){this._currentProvider=null;this.destroyed=!1;this.seekingWhilePlaying=!1;this.seekResumeTimeout=null;this.initialSrcLoaded=!1;this.loadGeneration=0;this.requestedSource=null;this.providerTeardown=null;this.pendingUnload=null;this.listenersWired=!1;this.readyEmitted=!1;this.fullscreenAnnounced=!1;this.unwireFullscreen=null;this.destroyPromise=null;this.initializing=null;if(typeof e.container=="string"){let t=document.querySelector(e.container);if(!t||!(t instanceof HTMLElement))throw new Error(`ScarlettPlayer: container not found: ${e.container}`);this.container=t}else if(e.container instanceof HTMLElement)this.container=e.container;else throw new Error("ScarlettPlayer requires a valid HTMLElement container or CSS selector");if(this.initialSrc=e.src,this.eventBus=new Ge,this.stateManager=new We({autoplay:e.autoplay??!1,loop:e.loop??!1,volume:e.volume??1,muted:e.muted??!1,poster:e.poster??""}),this.logger=new Qe({level:e.logLevel??"warn",scope:"ScarlettPlayer"}),this.errorHandler=new je(this.eventBus,this.logger),this.pluginManager=new Xe(this.eventBus,this.stateManager,this.logger,{container:this.container}),this.eventBus.on("error",t=>{this.stateManager.set("error",t)}),this.eventBus.on("media:loaded",()=>{this.stateManager.set("error",null)}),this.eventBus.on("media:error",({error:t})=>{this.errorHandler.record(t,{channel:"media:error"})}),this.wireFullscreenListeners(),e.plugins)for(let t of e.plugins)this.pluginManager.register(t);this.logger.info("ScarlettPlayer constructed",{autoplay:e.autoplay,plugins:e.plugins?.length??0})}ensureInitialized(){return this.initializing?this.initializing:(this.initializing=this.runInitialization().finally(()=>{this.initializing=null}),this.initializing)}async runInitialization(){for(let e of this.pluginManager.getPluginIds()){if(this.destroyed)return;let t=this.pluginManager.getPlugin(e);!t||t.type==="provider"||this.pluginManager.getPluginState(e)==="registered"&&await this.pluginManager.initPlugin(e)}this.destroyed||(this.wireLifecycleListeners(),this.readyEmitted||(this.readyEmitted=!0,this.eventBus.emit("player:ready",void 0)))}wireLifecycleListeners(){this.listenersWired||(this.listenersWired=!0,this.eventBus.on("live:seektolive",()=>{this.destroyed||this.seekToLive()}),this.eventBus.on("media:load-request",async({src:e,autoplay:t})=>{this.stateManager.getValue("chromecastActive")||await this.load(e,{autoplay:t!==!1})}),this.eventBus.on("error:retry",async({src:e})=>{let t=this.stateManager.getValue("live"),n=this.stateManager.getValue("currentTime");await this.load(e),!this.destroyed&&(this.stateManager.getValue("error")||(t?this.seekToLive():n>0&&this.seek(n),!this.destroyed&&await this.play()))}))}async init(){this.checkDestroyed(),await this.ensureInitialized(),this.initialSrc&&!this.initialSrcLoaded&&(this.initialSrcLoaded=!0,await this.load(this.initialSrc))}async load(e,t){this.checkDestroyed(),this.initialSrcLoaded=!0;let n=++this.loadGeneration;this.requestedSource=e;try{if(this.logger.info("Loading source",{source:e}),this.stateManager.update({playing:!1,paused:!0,ended:!1,buffering:!0,currentTime:0,duration:0,bufferedAmount:0,playbackState:"loading",error:null,live:!1}),this._currentProvider){let o=this._currentProvider.id;this.logger.info("Destroying previous provider",{provider:o}),await this.pluginManager.destroyPlugin(o),this._currentProvider=null}if(this.providerTeardown&&await this.providerTeardown,await this.ensureInitialized(),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}let r=this.pluginManager.selectProvider(e);if(!r){this.errorHandler.throw("PROVIDER_NOT_FOUND",`No provider found for source: ${e}`,{fatal:!0,context:{source:e}});return}if(this._currentProvider=r,this.logger.info("Provider selected",{provider:r.id}),await this.pluginManager.initPlugin(r.id),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}if(this.stateManager.set("source",{src:e,type:this.detectMimeType(e)}),typeof r.loadSource=="function"&&await r.loadSource(e),n!==this.loadGeneration){this.logger.info("Load superseded by newer load call",{source:e});return}(t?.autoplay??this.stateManager.getValue("autoplay"))&&await this.play()}catch(r){n===this.loadGeneration&&(this.stateManager.getValue("error")?this.logger.error("Load failed",{source:X(e),error:r.message}):this.errorHandler.handle(r,{operation:"load",source:X(e)}))}}async unload(){if(this.checkDestroyed(),this.pendingUnload&&this.pendingUnload.generation===this.loadGeneration)return this.pendingUnload.promise;let e=this._currentProvider,t=this.requestedSource;if(!e&&t===null&&!this.providerTeardown)return;let n=++this.loadGeneration,r=this.runUnload(n,e,t),s={generation:n,promise:r};this.pendingUnload=s;try{await r}finally{this.pendingUnload===s&&(this.pendingUnload=null)}}async runUnload(e,t,n){if(this.logger.info("Unloading source"),this._currentProvider=null,this.requestedSource=null,this.seekingWhilePlaying=!1,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),t){let s=this.pluginManager.destroyPlugin(t.id).catch(o=>{this.logger.error("Error destroying provider during unload",{provider:t.id,error:o.message})});this.providerTeardown=s;try{await s}finally{this.providerTeardown===s&&(this.providerTeardown=null)}}else this.providerTeardown&&await this.providerTeardown;if(e!==this.loadGeneration)return;let r=this.stateManager.getValue("lowLatencyMode");this.stateManager.update({source:null,playbackState:"idle",playing:!1,paused:!0,ended:!1,buffering:!1,waiting:!1,seeking:!1,currentTime:0,duration:0,buffered:null,bufferedAmount:0,error:null,mediaType:"unknown",qualities:[],currentQuality:null,audioTracks:[],currentAudioTrack:null,textTracks:[],currentTextTrack:null,live:!1,liveEdge:!1,seekableRange:null,liveLatency:0,lowLatencyMode:!1}),r&&this.eventBus.emit("live:lowlatency",{enabled:!1}),this.logger.info("Source unloaded"),this.eventBus.emit("source:unloaded",{src:n})}async play(){this.checkDestroyed();try{this.logger.debug("Play requested"),this.eventBus.emit("playback:play",void 0)}catch(e){this.errorHandler.handle(e,{operation:"play"})}}pause(){this.checkDestroyed();try{this.logger.debug("Pause requested"),this.seekingWhilePlaying=!1,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:pause",void 0)}catch(e){this.errorHandler.handle(e,{operation:"pause"})}}seek(e){if(this.checkDestroyed(),!Number.isFinite(e)){this.logger.warn("Invalid seek time",{time:e});return}try{this.logger.debug("Seek requested",{time:e}),this.stateManager.getValue("playing")&&(this.seekingWhilePlaying=!0),this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.eventBus.emit("playback:seeking",{time:e}),this.stateManager.set("currentTime",e),this.seekingWhilePlaying&&(this.seekResumeTimeout=setTimeout(()=>{this.seekingWhilePlaying&&this.stateManager.getValue("playing")&&(this.logger.debug("Resuming playback after seek"),this.seekingWhilePlaying=!1,this.eventBus.emit("playback:play",void 0)),this.seekResumeTimeout=null},300))}catch(t){this.errorHandler.handle(t,{operation:"seek",time:e})}}setVolume(e){this.checkDestroyed();let t=Math.max(0,Math.min(1,e));this.stateManager.set("volume",t),this.eventBus.emit("volume:change",{volume:t,muted:this.stateManager.getValue("muted")})}setMuted(e){this.checkDestroyed(),this.stateManager.set("muted",e),this.eventBus.emit("volume:mute",{muted:e})}setPlaybackRate(e){this.checkDestroyed();let t=Math.max(.0625,Math.min(16,e));this.stateManager.set("playbackRate",t),this.eventBus.emit("playback:ratechange",{rate:t})}setAutoplay(e){this.checkDestroyed(),this.stateManager.set("autoplay",e),this.logger.debug("Autoplay set",{autoplay:e})}setPoster(e){this.checkDestroyed(),this.stateManager.set("poster",e),this.logger.debug("Poster set",{poster:e})}on(e,t){return this.checkDestroyed(),this.eventBus.on(e,t)}once(e,t){return this.checkDestroyed(),this.eventBus.once(e,t)}getPlugin(e){return this.checkDestroyed(),this.pluginManager.getPlugin(e)}registerPlugin(e){this.checkDestroyed(),this.pluginManager.register(e)}getState(){return this.checkDestroyed(),this.stateManager.snapshot()}subscribeToState(e){return this.checkDestroyed(),this.stateManager.subscribe(e)}getQualities(){if(this.checkDestroyed(),!this._currentProvider)return[];let e=this._currentProvider;return typeof e.getLevels=="function"?e.getLevels():[]}setQuality(e){if(this.checkDestroyed(),!this._currentProvider){this.logger.warn("No provider available for quality change");return}let t=this._currentProvider;if(typeof t.setLevel=="function"){if(e!==-1){let n=this.getQualities();if(n.length>0&&(e<0||e>=n.length)){this.logger.warn(`Invalid quality index: ${e} (available: ${n.length})`);return}}t.setLevel(e),this.eventBus.emit("quality:change",{quality:e===-1?"auto":`level-${e}`,auto:e===-1})}}getCurrentQuality(){if(this.checkDestroyed(),!this._currentProvider)return-1;let e=this._currentProvider;return typeof e.getCurrentLevel=="function"?e.getCurrentLevel():-1}wireFullscreenListeners(){let e=()=>{this.fullscreenAnnounced=!0,this.setFullscreenState(Te(this.container))};document.addEventListener("fullscreenchange",e),document.addEventListener("webkitfullscreenchange",e),this.container.addEventListener("webkitbeginfullscreen",e,!0),this.container.addEventListener("webkitendfullscreen",e,!0),this.unwireFullscreen=()=>{document.removeEventListener("fullscreenchange",e),document.removeEventListener("webkitfullscreenchange",e),this.container.removeEventListener("webkitbeginfullscreen",e,!0),this.container.removeEventListener("webkitendfullscreen",e,!0)}}setFullscreenState(e){this.stateManager.getValue("fullscreen")!==e&&(this.stateManager.set("fullscreen",e),this.eventBus.emit("fullscreen:change",{fullscreen:e}))}async requestFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Pe(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!0),this.eventBus.emit("fullscreen:change",{fullscreen:!0}))}catch(e){this.logger.error("Fullscreen request failed",{error:e})}}async exitFullscreen(){this.checkDestroyed(),this.fullscreenAnnounced=!1;try{await Me(this.container),this.fullscreenAnnounced||(this.stateManager.set("fullscreen",!1),this.eventBus.emit("fullscreen:change",{fullscreen:!1}))}catch(e){this.logger.error("Exit fullscreen failed",{error:e})}}async toggleFullscreen(){this.fullscreen?await this.exitFullscreen():await this.requestFullscreen()}requestAirPlay(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.showPicker=="function"?e.showPicker():this.logger.warn("AirPlay plugin not available")}async requestChromecast(){this.checkDestroyed();let e=this.pluginManager.getPlugin("chromecast");e&&typeof e.requestSession=="function"?await e.requestSession():this.logger.warn("Chromecast plugin not available")}stopCasting(){this.checkDestroyed();let e=this.pluginManager.getPlugin("airplay");e&&typeof e.stop=="function"&&e.stop();let t=this.pluginManager.getPlugin("chromecast");t&&typeof t.stopSession=="function"&&t.stopSession()}seekToLive(){if(this.checkDestroyed(),!this.stateManager.getValue("live")){this.logger.warn("Not a live stream");return}if(this._currentProvider){let r=this._currentProvider;if(typeof r.getLiveInfo=="function"){let s=r.getLiveInfo();if(s?.liveSyncPosition!==void 0){this.seek(s.liveSyncPosition);return}}}let t=this.stateManager.getValue("seekableRange");if(t?.end!==void 0){this.seek(t.end);return}let n=this.stateManager.getValue("duration");Number.isFinite(n)&&n>0&&this.seek(n)}destroy(){return this.destroyPromise?this.destroyPromise:this.destroyed?Promise.resolve():(this.destroyPromise=(async()=>{this.logger.info("Destroying player"),this.destroyed=!0,this.loadGeneration++,this.seekResumeTimeout!==null&&(clearTimeout(this.seekResumeTimeout),this.seekResumeTimeout=null),this.unwireFullscreen?.(),this.unwireFullscreen=null,this.eventBus.emit("player:destroy",void 0);try{await this.pluginManager.destroyAll()}catch(e){this.logger.error("Error during plugin destruction",e)}this.eventBus.destroy(),this.stateManager.destroy(),this.logger.info("Player destroyed")})(),this.destroyPromise)}getDiagnostics(){return Qt({stateManager:this.stateManager,errorHandler:this.errorHandler,pluginManager:this.pluginManager,container:this.container,isDestroyed:this.destroyed,playerVersion:qt})}get playing(){return this.stateManager.getValue("playing")}get paused(){return this.stateManager.getValue("paused")}get currentTime(){return this.stateManager.getValue("currentTime")}get duration(){return this.stateManager.getValue("duration")}get volume(){return this.stateManager.getValue("volume")}get muted(){return this.stateManager.getValue("muted")}get playbackRate(){return this.stateManager.getValue("playbackRate")}get bufferedAmount(){return this.stateManager.getValue("bufferedAmount")}get currentProvider(){return this._currentProvider}get fullscreen(){return this.stateManager.getValue("fullscreen")}get live(){return this.stateManager.getValue("live")}get autoplay(){return this.stateManager.getValue("autoplay")}get poster(){return this.stateManager.getValue("poster")}checkDestroyed(){if(this.destroyed)throw new Error("Cannot call methods on destroyed player")}detectMimeType(e){let t=e;try{t=new URL(e).pathname}catch{let r=e.split("?")[0]??e;t=r.split("#")[0]??r}switch(t.split(".").pop()?.toLowerCase()??""){case"m3u8":return"application/x-mpegURL";case"mpd":return"application/dash+xml";case"mp4":case"m4v":return"video/mp4";case"webm":return"video/webm";case"ogg":case"ogv":return"video/ogg";case"mov":return"video/quicktime";case"mkv":return"video/x-matroska";case"mp3":return"audio/mpeg";case"wav":return"audio/wav";case"flac":return"audio/flac";case"aac":case"m4a":return"audio/mp4";default:return"video/mp4"}}};async function Yt(i){let e=new At(i);return await e.init(),e}function Xt(i){return i<10?`0${i}`:`${i}`}function pe(i){if(!isFinite(i)||isNaN(i))return"0:00";let e=Math.abs(i),t=Math.floor(e/3600),n=Math.floor(e%3600/60),r=Math.floor(e%60),s=i<0?"-":"";return t>0?`${s}${t}:${Xt(n)}:${Xt(r)}`:`${s}${n}:${Xt(r)}`}function Ee(i){return!Number.isFinite(i)||i<=0?"LIVE":`-${pe(i)}`}var Je={play:"M8 5v14l11-7z",volumeHigh:"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",volumeMuted:"M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"};var Ct=new Map;function Jt(i,e){if(typeof document>"u")return()=>{};let t=document.getElementById(i),n=Ct.get(i);(!n||!t)&&(n={generation:(n?.generation??0)+1,holders:0,element:t},Ct.set(i,n)),n.holders+=1;let{generation:r}=n;if(!t){let o=document.createElement("style");o.id=i,o.textContent=e,document.head.appendChild(o),n.element=o}let s=!1;return()=>{if(s)return;s=!0;let o=Ct.get(i);!o||o.generation!==r||(o.holders-=1,!(o.holders>0)&&(Ct.delete(i),o.element?.remove()))}}var Zt={};ir(Zt,{createHlsInstance:()=>xr,describeSupport:()=>Sr,getHlsConstructor:()=>Tr,isHLSSupported:()=>kr,isHlsJsSupported:()=>xn,loadHlsJs:()=>Lr,resetLoader:()=>Pr,supportsNativeHLS:()=>Ln});var ne=null,Fe=null,wr=["application/vnd.apple.mpegurl","application/x-mpegURL"];function Ln(){if(typeof document>"u")return!1;let i=document.createElement("video");return wr.some(e=>i.canPlayType(e)!=="")}function xn(){return ne?ne.isSupported():typeof window>"u"?!1:!!(window.MediaSource||window.WebKitMediaSource)}function kr(){return Ln()||xn()}function Sr(){let i=typeof document>"u"?null:document.createElement("video"),e=n=>i?i.canPlayType(n):"",t=typeof window>"u"?{}:window;return{canPlayType:{"application/vnd.apple.mpegurl":e("application/vnd.apple.mpegurl"),"application/x-mpegURL":e("application/x-mpegURL")},MediaSource:typeof t.MediaSource,ManagedMediaSource:typeof t.ManagedMediaSource,WebKitMediaSource:typeof t.WebKitMediaSource,hlsJsLoaded:ne!==null,hlsJsSupported:ne?ne.isSupported():null,userAgent:typeof navigator>"u"?"":navigator.userAgent}}async function Lr(){return ne||Fe||(Fe=(async()=>{try{if(ne=(await import("./hls-SXYGB37P.js")).default,!ne.isSupported())throw new Error("hls.js is not supported in this browser");return ne}catch(i){throw Fe=null,new Error(`Failed to load hls.js: ${i instanceof Error?i.message:"Unknown error"}`)}})(),Fe)}function xr(i){if(!ne)throw new Error("hls.js is not loaded. Call loadHlsJs() first.");return new ne(i)}function Tr(){return ne}function Pr(){ne=null,Fe=null}function _e(i){if(i.name)return i.name;if(i.height){let e={2160:"4K",1440:"1440p",1080:"1080p",720:"720p",480:"480p",360:"360p",240:"240p",144:"144p"},t=Object.keys(e).map(Number).sort((n,r)=>Math.abs(n-i.height)-Math.abs(r-i.height))[0];return Math.abs(t-i.height)<=20?e[t]:`${i.height}p`}return i.bitrate?Mr(i.bitrate):"Unknown"}function Mr(i){return i>=1e6?`${(i/1e6).toFixed(1)} Mbps`:i>=1e3?`${Math.round(i/1e3)} Kbps`:`${i} bps`}function Tn(i,e){return i.map((t,n)=>({index:n,width:t.width||0,height:t.height||0,bitrate:t.bitrate||0,label:_e(t),codec:t.codecSet}))}function Pn(i){if(i!==void 0&&i>0)return i;let t=navigator.connection;if(t?.downlink&&t.downlink>0){let n=t.downlink*1e6;return Math.round(n*.85)}return 5e5}function he(i){return typeof i=="number"&&Number.isFinite(i)?i:null}function _r(i){if(!i)return null;let e=he(i.fragmentStart)??he(i.fragments?.[0]?.start)??0,t=he(i.totalduration),n=he(i.edge)??(t===null?null:e+t);return n===null?null:{start:e,end:n}}function Mn(i){let e=i?.seekable;if(!e||e.length===0)return null;let t=e.start(0),n=e.end(e.length-1);return!Number.isFinite(t)||!Number.isFinite(n)?null:{start:t,end:n}}function Ar(i){if(!i)return null;let e=he(i.targetduration);return he(i.partHoldBack)??he(i.holdBack)??(e!==null?e*3:null)}function Cr(i,e){let t=he(i?.targetduration),n=t!==null?t/2:e/2;return Math.max(1.5,he(i?.partTarget)??n)}function Ae(i){if(i.kind==="hls"){let{hls:o,details:u}=i,a=o.media,d=_r(u)??Mn(a),y=he(o.targetLatency)??Ar(u)??3,P=he(o.latency)??(d&&a?Math.max(0,d.end-a.currentTime):null);if(P===null&&d===null)return null;let R=P??0;return{latency:R,targetLatency:y,atEdge:R<=y+Cr(u,y),seekableRange:d,lowLatency:i.lowLatencyRequested!==!1&&(!!u?.partList?.length||u?.canBlockReload===!0)}}let{media:e}=i,t=Mn(e);if(!t)return null;let n=i.targetLatency??3,r=i.targetLatency===void 0?7:Math.max(1.5,i.targetLatency/2),s=Math.max(0,t.end-e.currentTime);return{latency:s,targetLatency:n,atEdge:s<=n+r,seekableRange:t,lowLatency:i.lowLatency===!0}}function en(i,e){if(!e)return;let t=i.getState("liveLatency");Math.abs(t-e.latency)>.05&&(i.setState("liveLatency",e.latency),i.emit("live:latency",{latency:e.latency})),i.getState("liveEdge")!==e.atEdge&&(i.setState("liveEdge",e.atEdge),i.emit("live:edgechange",{atEdge:e.atEdge}));let n=e.seekableRange;if(n){let r=i.getState("seekableRange");(!r||Math.abs(r.start-n.start)>.05||Math.abs(r.end-n.end)>.05)&&(i.setState("seekableRange",{start:n.start,end:n.end}),i.emit("live:seekablerange",{start:n.start,end:n.end}))}i.getState("lowLatencyMode")!==e.lowLatency&&(i.setState("lowLatencyMode",e.lowLatency),i.emit("live:lowlatency",{enabled:e.lowLatency}))}function Rt(i){i.getState("lowLatencyMode")&&(i.setState("lowLatencyMode",!1),i.emit("live:lowlatency",{enabled:!1})),i.setState("liveLatency",0),i.setState("liveEdge",!1),i.setState("seekableRange",null)}var tn={NETWORK_ERROR:"networkError",MEDIA_ERROR:"mediaError",KEY_SYSTEM_ERROR:"keySystemError",MUX_ERROR:"muxError",OTHER_ERROR:"otherError"};function Rr(i){switch(i){case tn.NETWORK_ERROR:return"network";case tn.MEDIA_ERROR:return"media";case tn.MUX_ERROR:return"mux";default:return"other"}}function Hr(i){let e=i.frag,t=i.response,n=i.context;return{type:Rr(i.type),details:i.details||"Unknown error",fatal:i.fatal||!1,url:i.url??e?.url??t?.url??n?.url,reason:i.reason,response:i.response}}function Dr(i){return`audio-${i}`}function An(i){if(!i)return-1;let e=/^audio-(0|[1-9]\d*)$/.exec(i);return e?Number.parseInt(e[1],10):-1}function Ir(i,e,t){return{id:Dr(e),label:i.name||i.lang||`Audio ${e+1}`,language:i.lang,active:t}}function _n(i,e){if(!i||typeof i!="object")return null;let{type:t,stats:n}=i;if(t!=="main"&&t!=="audio"&&t!=="subtitle")return null;let r=n?.loading?.start,s=n?.loading?.end,o=n?.loaded;return typeof r!="number"||!Number.isFinite(r)||typeof s!="number"||!Number.isFinite(s)||s<r||typeof o!="number"||!Number.isFinite(o)||o<0?null:{durationMs:s-r,bytes:o,ok:e,kind:t}}function Cn(i,e,t){let n=[],r=(u,a)=>{i.on(u,a),n.push({event:u,handler:a})};r("hlsManifestParsed",(u,a)=>{e.logger.debug("HLS manifest parsed",{levels:a.levels.length});let d=a.levels.map((y,P)=>({id:`level-${P}`,label:_e(y),width:y.width,height:y.height,bitrate:y.bitrate,active:P===i.currentLevel}));e.setState("qualities",d),e.emit("quality:levels",{levels:d.map(y=>({id:y.id,label:y.label}))}),t.onManifestParsed?.(a.levels,a)}),r("hlsLevelSwitched",(u,a)=>{let d=i.levels[a.level],y=t.getIsAutoQuality?.()??i.autoLevelEnabled;if(e.logger.debug("HLS level switched",{level:a.level,height:d?.height,auto:y}),d){let P=y?`Auto (${_e(d)})`:_e(d);e.setState("currentQuality",{id:y?"auto":`level-${a.level}`,label:P,width:d.width,height:d.height,bitrate:d.bitrate,active:!0})}e.emit("quality:change",{quality:d?`level-${a.level}`:"auto",auto:y}),t.onLevelSwitched?.(a.level)});let s=(u,a)=>{let d=u.map((y,P)=>Ir(y,P,P===a));e.setState("audioTracks",d),e.setState("currentAudioTrack",d[a]??null)};r("hlsAudioTracksUpdated",(u,a)=>{let d=a.audioTracks??[];e.logger.debug("HLS audio tracks updated",{tracks:d.length}),s(d,i.audioTrack),t.onAudioTracksUpdated?.(d)}),r("hlsAudioTrackSwitched",(u,a)=>{e.logger.debug("HLS audio track switched",{id:a.id}),s(i.audioTracks??[],a.id),t.onAudioTrackSwitched?.(a.id)});let o=0;return r("hlsFragLoaded",(u,a)=>{let d=_n(a?.frag,!0);d&&e.emit("media:segment",d);let y=Date.now();y-o>=2e3&&i.bandwidthEstimate&&(o=y,e.setState("bandwidth",Math.round(i.bandwidthEstimate))),t.onFragLoaded?.()}),r("hlsFragBuffered",()=>{e.setState("buffering",!1),t.onBufferUpdate?.()}),r("hlsFragLoading",()=>{e.setState("buffering",!0)}),r("hlsLevelLoaded",(u,a)=>{a.details?.live!==void 0&&(e.setState("live",a.details.live),a.details.live?(t.onLevelDetails?.(a.details),en(e,Ae({kind:"hls",hls:i,details:a.details,lowLatencyRequested:t.isLowLatencyRequested?.()??!0}))):Rt(e),t.onLiveUpdate?.())}),r("hlsError",(u,a)=>{let d=Hr(a);if(!d.fatal&&(d.details==="fragLoadError"||d.details==="fragLoadTimeOut")){let P=_n(a.frag,!1);P&&e.emit("media:segment",P)}!d.fatal&&(d.details?.includes("bufferStalledError")||a.reason?.includes("buffer holes"))?e.logger.debug(`HLS buffer recovery: ${d.reason||d.details}`,{details:d.details,reason:d.reason}):d.fatal?e.logger.error(`HLS fatal error: ${d.details} (type=${d.type})`,{type:d.type,details:d.details,status:d.response?.code,url:X(d.url)}):e.logger.warn(`HLS error: ${d.details} (type=${d.type}, fatal=${d.fatal})`,{type:d.type,details:d.details,fatal:d.fatal,status:d.response?.code,url:X(d.url)}),t.onError?.(d)}),()=>{for(let{event:u,handler:a}of n)i.off(u,a);n.length=0,e.setState("audioTracks",[]),e.setState("currentAudioTrack",null)}}function nn(i,e,t,n){let r=[],s=(a,d)=>{i.addEventListener(a,d),r.push({event:a,handler:d})},o=()=>{i.ended||!e.getState("ended")||(e.setState("ended",!1),e.setState("playbackState",i.paused?"paused":"playing"))};s("play",()=>{e.setState("paused",!1),o()}),s("playing",()=>{e.setState("playing",!0),e.setState("paused",!1),e.setState("waiting",!1),e.setState("buffering",!1),e.setState("playbackState","playing"),o(),n&&(n.corePauseRequested=!1),n?.corePlayRequested?n.corePlayRequested=!1:e.emit("playback:play",void 0)}),s("pause",()=>{e.setState("playing",!1),e.setState("paused",!0),e.setState("playbackState","paused"),n&&(n.corePlayRequested=!1),n?.corePauseRequested?n.corePauseRequested=!1:e.emit("playback:pause",void 0)}),s("ended",()=>{e.setState("playing",!1),e.setState("ended",!0),e.setState("playbackState","ended"),e.emit("playback:ended",void 0)}),s("timeupdate",()=>{e.setState("currentTime",i.currentTime),e.emit("playback:timeupdate",{currentTime:i.currentTime}),(e.getState("live")||!Number.isFinite(i.duration))&&en(e,t?t():Ae({kind:"media",media:i}))}),s("durationchange",()=>{let a=i.duration;!Number.isFinite(a)||a===1/0?(e.setState("live",!0),e.setState("duration",0)):e.setState("duration",a||0),e.emit("media:loadedmetadata",{duration:e.getState("duration")})}),s("waiting",()=>{e.setState("waiting",!0),e.setState("buffering",!0),e.emit("media:waiting",void 0)}),s("canplay",()=>{e.setState("waiting",!1),e.setState("playbackState","ready"),e.emit("media:canplay",void 0)}),s("canplaythrough",()=>{e.setState("buffering",!1),e.emit("media:canplaythrough",void 0)}),s("progress",()=>{if(i.buffered.length>0){let a=i.buffered.end(i.buffered.length-1),d=i.duration>0?a/i.duration:0;e.setState("bufferedAmount",d),e.setState("buffered",i.buffered),e.emit("media:progress",{buffered:d})}}),s("seeking",()=>{e.setState("currentTime",i.currentTime),e.setState("seeking",!0),o()}),s("seeked",()=>{e.setState("seeking",!1),e.emit("playback:seeked",{time:i.currentTime})}),s("volumechange",()=>{e.setState("volume",i.volume),e.setState("muted",i.muted),e.emit("volume:change",{volume:i.volume,muted:i.muted})}),s("ratechange",()=>{e.setState("playbackRate",i.playbackRate),e.emit("playback:ratechange",{rate:i.playbackRate})}),s("loadedmetadata",()=>{e.setState("duration",i.duration)}),s("error",()=>{let a=i.error;if(a){e.logger.error("Video element error",{code:a.code,message:a.message});let d=a.code===4?"Media source not supported":a.code===2?"Media network error":"Video playback error",y=new Error(a.message||d);typeof a.code=="number"&&a.code>0&&Object.assign(y,{code:a.code,detail:{mediaErrorCode:a.code,networkState:i.networkState,readyState:i.readyState}}),e.emit("media:error",{error:y})}}),s("enterpictureinpicture",()=>{e.setState("pip",!0),e.logger.debug("PiP: entered (standard)")}),s("leavepictureinpicture",()=>{e.setState("pip",!1),e.logger.debug("PiP: exited (standard)"),(!i.paused||e.getState("playing"))&&i.play().catch(()=>{})});let u=i;return"webkitPresentationMode"in i&&s("webkitpresentationmodechanged",()=>{let a=u.webkitPresentationMode,d=a==="picture-in-picture";e.setState("pip",d),e.logger.debug(`PiP: mode changed to ${a} (webkit)`),a==="inline"&&i.paused&&i.play().catch(()=>{})}),()=>{for(let{event:a,handler:d}of r)i.removeEventListener(a,d);r.length=0}}var Nr=["loadedmetadata","loadeddata","resize","playing"],Or=["addtrack","removetrack","change"];function rn(i){return typeof i=="object"&&i!==null&&typeof i.length=="number"}function Rn(i){let e=null,t=!1,n=!1,r=!1,s=null,o=[],u=null,a=!1,d=()=>t?"video":n?"audio":"unknown",y=()=>{let w=d();w!==u&&(u=w,i.setState("mediaType",w))},P=()=>{let w=s;if(!w)return;if(r&&w.videoWidth>0){t=!0;return}if(w.readyState<1)return;let q=w.videoTracks,U=w.audioTracks;if(rn(q)){if(q.length>0){t=!0;return}rn(U)&&U.length>0&&(n=!0)}},R=()=>{a||(P(),y())},M=()=>{for(let w of o)w();o=[],s=null};return{beginSource(w){a||e!==w&&(e=w,t=!1,n=!1,r=!1,u=null,y())},attach(w){if(!a){M(),s=w,r=!1;for(let q of Nr){let U=()=>{r=!0,R()};w.addEventListener(q,U),o.push(()=>w.removeEventListener(q,U))}for(let q of[s.videoTracks,s.audioTracks])if(!(!rn(q)||typeof q.addEventListener!="function"))for(let U of Or){let x=()=>R();q.addEventListener(U,x),o.push(()=>q.removeEventListener?.(U,x))}R()}},noteManifestParsed(w){if(a||!w)return;let q=typeof w.video=="boolean"?w.video:null,U=typeof w.audio=="boolean"?w.audio:null;q===!0?t=!0:q===!1&&U===!0&&(n=!0),y()},evaluate:R,current(){return d()},destroy(){a||(a=!0,M())}}}var sn="Invalid playlist document",Fr=["level","audioTrack","subtitleTrack"];function Br(i,e){if(typeof i!="string"||i.length===0)return!1;let t=i.trimStart();return t.startsWith("#EXTM3U")?e&&Fr.includes(e)?/^#EXT(?:INF|-X-TARGETDURATION):/m.test(t):!0:!1}function Hn(i){let e=i.DefaultConfig.loader;return class extends e{load(n,r,s){let o={...s,onSuccess:(u,a,d,y)=>{if(!Br(u?.data,d?.type)){s.onError({code:0,text:sn},d,y,a);return}s.onSuccess(u,a,d,y)}};super.load(n,r,o)}}}var Dn=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";function Vr(i){let e=`'${i.canPlayType["application/vnd.apple.mpegurl"]}'/'${i.canPlayType["application/x-mpegURL"]}'`,t=i.hlsJsLoaded?`isSupported ${String(i.hlsJsSupported)}`:"not loaded";return[`native: ${e}`,`MediaSource: ${i.MediaSource}`,`ManagedMediaSource: ${i.ManagedMediaSource}`,`WebKitMediaSource: ${i.WebKitMediaSource}`,`hls.js: ${t}`].join(", ")}var Ur={debug:!1,autoStartLoad:!0,startPosition:-1,lowLatencyMode:!1,maxBufferLength:30,maxMaxBufferLength:600,backBufferLength:30,enableWorker:!0,capLevelToPlayerSize:!0,maxNetworkRetries:3,maxMediaRetries:2,retryDelayMs:1e3,retryBackoffFactor:2,loadTimeoutMs:3e4,autoReconnect:!0,reconnectBaseDelayMs:2e3,reconnectMaxDelayMs:3e4,reconnectWindowMs:3e5,validatePlaylists:!0},zr=1.1,Kr=["manifestLoadError","manifestLoadTimeOut","manifestParsingError"],Ht="Video took too long to load (network timeout)";function In(i,e){let t=i?.code,r={type:(e==="initial"?t!==MediaError.MEDIA_ERR_DECODE:t===MediaError.MEDIA_ERR_NETWORK)?"network":"media",details:i?.message||(e==="initial"?"Failed to load HLS source":"Native HLS playback error"),fatal:!0};return typeof t=="number"&&t>0&&(r.mediaErrorCode=t),i?.message&&(r.mediaErrorMessage=i.message),r}function Nn(i,e,t){let n={...Ur,...t},r=null,s=null,o=null,u=!1,a=null,d=null,y=null,P=!0,R={corePlayRequested:!1,corePauseRequested:!1},M=null,w=null,q=null,U=null,x=0,J=null,_=0,H=0,N=null,re=0,m=0,F=10,W=5e3,S=!1,O=null,z=0,T=0,I=0,A=null,V=null,Q=!1,te=!1,oe=!1,ee=null,ae=0,ge=0,ie=()=>{let p=s&&!u?Ae({kind:"hls",hls:s,details:w,lowLatencyRequested:n.lowLatencyMode===!0}):o?Ae({kind:"media",media:o,targetLatency:U??void 0,lowLatency:q?.lowLatency}):null;return p&&(q=p,s&&!u&&(U=p.targetLatency)),p},bt=()=>o?.seekable?.length?o.seekable.end(o.seekable.length-1):void 0,Ce=(p,l)=>{if(s&&!u&&typeof s.liveSyncPosition=="number")return s.liveSyncPosition;let c=bt()??p?.seekableRange?.end;return c!==void 0?Math.max(0,c-l):void 0},Et=p=>{if(!o)return p;if(r?.getState("live")){let l=ie(),c=(s&&!u?s.targetLatency:void 0)||l?.targetLatency||3,h=l?.seekableRange?.start??0,f=Ce(l,c);if(f!==void 0)return Math.max(h,Math.min(p,Math.max(h,f)));let g=o.duration,v=Number.isFinite(g)&&g>0?g:p;return Math.max(h,Math.min(p,v))}return Math.max(0,Math.min(p,o.duration||0))},Ue=()=>{if(!o||!u||!r?.getState("live"))return;let p=o,l=["canplay","progress","durationchange"],c=()=>{for(let g of l)p.removeEventListener(g,h);p.removeEventListener("seeking",c)},h=()=>{if(p.seeking||r?.getState("seeking")){c();return}let g=ie();if(!g||(c(),g.atEdge))return;let v=Ce(g,g.targetLatency??3);if(v===void 0)return;let L=p.seekable.start(p.seekable.length-1);p.currentTime=Math.max(L,Et(v))};for(let g of l)p.addEventListener(g,h);p.addEventListener("seeking",c);let f=y;y=()=>{c(),f?.()},h()},Re=()=>{o&&(o.poster=r?.getState("poster")||"")},ze=()=>{if(o)return o;let p=r?.container.querySelector("video");return p?(o=p,o):(o=document.createElement("video"),o.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",o.preload="metadata",o.controls=!1,o.playsInline=!0,Re(),r?.container.appendChild(o),o)},we=p=>{J?.(p??new Error("HLS load cancelled")),J=null,d?.(),d=null,y?.(),y=null,N&&(clearTimeout(N),N=null),ee&&(clearTimeout(ee),ee=null),s&&(s.destroy(),s=null)},ke=p=>{we(p),a=null,u=!1,P=!0,_=0,H=0,re=0,m=0,w=null,q=null,U=null,r&&Rt(r)},Ft=()=>{let p=Vt();if(n.validatePlaylists!==!1){let l=i.getHlsConstructor();l&&l.DefaultConfig?.loader&&(p.pLoader=Hn(l))}return p},Bt=()=>{let p={},l=(B,se)=>{se!==void 0&&(p[B]=se)},c=n.liveSyncDuration,h=n.liveSyncDurationCount,f=n.liveMaxLatencyDuration,g=n.liveMaxLatencyDurationCount,v=(c!==void 0||f!==void 0)&&(h!==void 0||g!==void 0),L=v&&c!==void 0,k=v&&!L;return v&&r?.logger.warn(`Ignoring ${L?"liveSyncDurationCount/liveMaxLatencyDurationCount":"liveSyncDuration/liveMaxLatencyDuration"}: hls.js rejects a config mixing seconds-based and count-based live latency options`),l("liveSyncDuration",k?void 0:c),l("liveSyncDurationCount",L?void 0:h),l("liveMaxLatencyDuration",k?void 0:f),l("liveMaxLatencyDurationCount",L?void 0:g),l("liveDurationInfinity",n.liveDurationInfinity),l("maxLiveSyncPlaybackRate",n.maxLiveSyncPlaybackRate??(n.lowLatencyMode===!0?zr:void 0)),p},Vt=()=>({debug:n.debug,autoStartLoad:n.autoStartLoad,startPosition:n.startPosition,startLevel:-1,abrEwmaDefaultEstimate:Pn(n.initialBandwidthEstimate),lowLatencyMode:n.lowLatencyMode,maxBufferLength:n.maxBufferLength,maxMaxBufferLength:n.maxMaxBufferLength,backBufferLength:n.backBufferLength,enableWorker:n.enableWorker,capLevelToPlayerSize:n.capLevelToPlayerSize,fragLoadingMaxRetry:1,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:1,fragLoadingRetryDelay:500,manifestLoadingRetryDelay:500,levelLoadingRetryDelay:500,...Bt()}),He=p=>{let l=n.retryDelayMs??1e3,c=n.retryBackoffFactor??2;return l*Math.pow(c,p)*(.7+Math.random()*.3)},Ut=["bufferAppendError","bufferAppendingError","bufferAddCodecError"],Ke=p=>{if(p.response?.text===sn)return"PLAYLIST_INVALID";if(p.details==="bufferFullError")return"MEDIA_BUFFER_FULL";if(Ut.includes(p.details))return"MEDIA_APPEND_ERROR";switch(p.type){case"network":return"MEDIA_NETWORK_ERROR";case"media":case"mux":return"MEDIA_DECODE_ERROR";default:return"PLAYBACK_FAILED"}},zt=(p,l)=>{let c=p.attempts??(p.type==="network"?_:p.type==="media"?H:0),h={type:p.type,retriesExhausted:l,attempts:c};p.mediaErrorCode!==void 0&&(h.mediaErrorCode=p.mediaErrorCode),p.mediaErrorMessage!==void 0&&(h.mediaErrorMessage=p.mediaErrorMessage),p.timedOut&&(h.timedOut=!0),typeof p.response?.code=="number"&&p.response.code>0&&(h.httpStatus=p.response.code);let f=X(p.url);return f&&(h.url=f),h},fe=(p,l,c)=>{let h=c??(l?`HLS error: ${p.details} (max retries exceeded)`:`HLS error: ${p.details}`);r?.logger.error(h,{type:p.type,details:p.details}),r?.setState("playbackState","error"),r?.setState("buffering",!1);let f=zt(p,l);kt(p)&&!Q&&(f.reconnecting=!0),r?.emit("error",{code:Ke(p),message:h,fatal:!0,timestamp:Date.now(),detail:f}),$e(p)},Kt=p=>{if(!i.getHlsConstructor()||!s)return!1;if(p.fatal){let c=Date.now();if(c-m>W?(re=1,m=c):re++,re>=F)return r?.logger.error(`Too many fatal errors (${re} in ${W}ms), giving up`),fe(p,!0),we(new Error(p.details)),!0;switch(r?.logger.error("Fatal HLS error",{type:p.type,details:p.details}),p.type){case"network":{let h=n.maxNetworkRetries??3;if(_>=h)return r?.logger.error(`Network error recovery failed after ${_} attempts`),fe(p,!0),!0;_++;let f=He(_-1);r?.logger.info(`Attempting network error recovery (attempt ${_}/${h}) in ${f}ms`),r?.emit("error:network",{error:new Error(p.details)}),N&&clearTimeout(N);let g=Kr.includes(p.details),v=x;N=setTimeout(()=>{v!==x||!s||(g&&a?s.loadSource(a):s.startLoad())},f);break}case"media":{let h=n.maxMediaRetries??2;if(H>=h)return r?.logger.error(`Media error recovery failed after ${H} attempts`),fe(p,!0),!0;H++;let f=He(H-1);r?.logger.info(`Attempting media error recovery (attempt ${H}/${h}) in ${f}ms`),r?.emit("error:media",{error:new Error(p.details)}),N&&clearTimeout(N);let g=x;N=setTimeout(()=>{g!==x||!s||s.recoverMediaError()},f);break}default:return fe(p,!1),!0}}return!1},De=(p,l)=>{let c=p.type==="network",h=c?n.maxNetworkRetries??3:n.maxMediaRetries??2,f=c?_:H;if(!a||f>=h){fe(p,f>=h);return}let g=l??o?.currentTime??0;c?_++:H++;let v=f+1,L=He(v-1);r?.logger.info(`Attempting native ${p.type} error recovery (attempt ${v}/${h}) in ${L}ms`),r?.emit(c?"error:network":"error:media",{error:new Error(p.details)}),N&&clearTimeout(N);let k=x;N=setTimeout(()=>{k===x&&ve(p,g)},L)},ve=async(p,l)=>{if(!a)return;let c=++x,h=a,f=r?.getState("live")??!1;try{if(we(new Error("HLS load cancelled: native error recovery")),r?.setState("playbackState","loading"),await Se(h),c!==x)return;f?Ue():o&&l>0&&(o.currentTime=l),r?.setState("playbackState","ready"),r?.setState("buffering",!1);try{await o?.play()}catch{}}catch{if(c!==x)return;r?.logger.warn("Native error recovery attempt failed"),De(p,l)}},Se=async(p,l=!1)=>{let c=x,h=ze();return u=!0,r&&(y=nn(h,r,ie,R)),M?.beginSource(p),M?.attach(h),new Promise((f,g)=>{let v=null,L=!1,k=null,B=()=>{L=!0,J===se&&(J=null),h.removeEventListener("loadedmetadata",ce),h.removeEventListener("error",D),v!==null&&(clearTimeout(v),v=null)},se=C=>{L||(B(),g(C))};J=se;let ce=()=>{if(L)return;if(c!==x){B(),g(new Error("HLS load cancelled"));return}B(),S=!0,l&&(_=0,H=0);let C=()=>{De(In(h.error,"playback"))};h.addEventListener("error",C);let K=()=>{(_>0||H>0)&&(r?.logger.debug("Native playback recovered, resetting retry budgets"),_=0,H=0)};h.addEventListener("playing",K);let de=()=>{h.removeEventListener("error",C),h.removeEventListener("playing",K)},me=y;y=()=>{de(),me?.()},r?.setState("source",{src:p,type:"application/x-mpegURL"}),r?.emit("media:loaded",{src:p,type:"application/x-mpegURL"}),f()},D=()=>{if(L)return;if(!l||c!==x){B(),g(new Error(h.error?.message||"Failed to load HLS source"));return}let C=In(h.error,"initial");k=C;let K=C.type==="network",de=K?n.maxNetworkRetries??3:n.maxMediaRetries??2,me=K?_:H;if(me>=de){B(),r?.logger.error(`Native HLS load failed after ${me} ${C.type} retries`,{src:X(p)}),fe(C,!0),g(new Error(C.details));return}K?_++:H++;let Lt=He(me);r?.logger.info(`Retrying native HLS load after ${C.type} error (attempt ${me+1}/${de}) in ${Lt}ms`),r?.emit(K?"error:network":"error:media",{error:new Error(C.details)}),N&&clearTimeout(N),N=setTimeout(()=>{N=null,!(L||c!==x)&&(h.src=p,h.load())},Lt)},Z=n.loadTimeoutMs??3e4;Z>0&&(v=setTimeout(()=>{if(L||c!==x)return;if(B(),!l){g(new Error(Ht));return}N&&(clearTimeout(N),N=null),r?.logger.error(`Native HLS load timed out after ${Z}ms`,{src:X(p)});let C={type:"network",details:Ht,fatal:!0,timedOut:!0,attempts:_+H};k?.mediaErrorCode!==void 0&&(C.mediaErrorCode=k.mediaErrorCode),k?.mediaErrorMessage!==void 0&&(C.mediaErrorMessage=k.mediaErrorMessage),fe(C,!1,Ht),g(new Error(Ht))},Z)),h.addEventListener("loadedmetadata",ce),h.addEventListener("error",D),h.src=p,h.load()})},le=async p=>{let l=x;if(await i.loadHlsJs(),l!==x)throw new Error("HLS load cancelled");let c=ze();return u=!1,s=i.createHlsInstance(Ft()),r&&(y=nn(c,r,ie,R)),M?.beginSource(p),M?.attach(c),new Promise((h,f)=>{if(!s||!r){f(new Error("HLS not initialized"));return}let g=!1,v=null,L=()=>{v!==null&&(clearTimeout(v),v=null)},k=C=>{g||(g=!0,L(),f(C))};J=k;let B=()=>{J===k&&(J=null)};d=Cn(s,r,{onManifestParsed:(C,K)=>{l===x&&(M?.noteManifestParsed(K),g||(g=!0,B(),L(),S=!0,r?.setState("source",{src:p,type:"application/x-mpegURL"}),r?.emit("media:loaded",{src:p,type:"application/x-mpegURL"}),h()))},onLevelSwitched:()=>{},onLevelDetails:C=>{l===x&&(w=C,ie())},isLowLatencyRequested:()=>n.lowLatencyMode===!0,onError:C=>{if(l!==x)return;Kt(C)&&!g&&(g=!0,B(),L(),f(new Error(C.details)))},onFragLoaded:()=>{l===x&&(_>0||H>0)&&(r?.logger.debug("Playback recovered, resetting retry budgets"),_=0,H=0)},getIsAutoQuality:()=>P});let se=s,ce=(C,K)=>{if(l!==x||s!==se||!r||K?.fatal!==!1||K.details!=="fragLoadError"&&K.details!=="fragLoadTimeOut")return;let de=K.frag?.type,me=K.frag?.stats?.loading?.start,Lt=K.frag?.stats?.loading?.end,xt=K.frag?.stats?.loaded;if(de!=="main"&&de!=="audio"&&de!=="subtitle"||typeof me!="number"||!Number.isFinite(me)||Lt!==0||typeof xt!="number"||!Number.isFinite(xt)||xt<0)return;let $t=performance.now()-me;!Number.isFinite($t)||$t<0||r.emit("media:segment",{kind:de,durationMs:$t,bytes:xt,ok:!1})};se.on("hlsError",ce);let D=d;d=()=>{se.off("hlsError",ce),D?.()};let Z=n.loadTimeoutMs??3e4;Z>0&&(v=setTimeout(()=>{if(g||l!==x)return;g=!0,B(),r?.logger.error(`HLS load timed out after ${Z}ms`,{src:X(p)});let C={type:"network",details:"Video took too long to load (network timeout)",fatal:!0};fe(C,!0),we(),f(new Error(C.details))},Z)),s.attachMedia(c),s.loadSource(p)})},ye=()=>{O&&(clearTimeout(O),O=null),z=0,T=0,I=0,V=null,Q=!1,te=!1},Le=()=>{if(!o||ee)return;ae=Date.now(),ge=o.currentTime;let p=s?.targetDuration??s?.levels?.[s?.currentLevel]?.details?.targetduration??0,l=Math.max(15,4*(p||0)||15),c=Math.min(l*1e3,3e4),h=()=>{if(!o||!r)return;let f=r.getState("playing"),g=r.getState("seeking");if(!f||g){ee=setTimeout(h,c);return}let v=Date.now()-ae;if(o.currentTime-ge>.5)ae=Date.now(),ge=o.currentTime;else if(v>l*1e3){r.logger.warn("Playback stall detected \u2014 no timeupdate progress",{elapsed:Math.round(v),currentTime:o.currentTime,targetDuration:Math.round(l)}),$e({type:"network",details:"Playback stalled \u2014 no data received",fatal:!0});return}ee=setTimeout(h,c)};ee=setTimeout(h,c)},wt=()=>{ee&&(clearTimeout(ee),ee=null)},Ie=(p,l)=>{if(Q)return;Q=!0;let c=z,h=V;r?.emit("error:reconnect-exhausted",{attempts:c,elapsedMs:p,windowMs:l}),r?.setState("playbackState","error"),r?.setState("buffering",!1),r?.emit("error",{code:h?Ke(h):"PLAYBACK_FAILED",message:`HLS auto-reconnect gave up after ${c} attempts over ${Math.round(p/1e3)}s`,fatal:!0,timestamp:Date.now(),detail:{type:h?.type??"other",retriesExhausted:!0,attempts:c,reconnectExhausted:!0}})},ue=()=>{if(Q||O)return;let p=(r?.getState("live")??!1)&&oe,l=n.reconnectWindowMs??3e5,c=p?1/0:l,h=Date.now()-T;if(h>c){r?.logger.warn(`Auto-reconnect window exhausted after ${z} attempts`),Ie(h,c);return}p&&h>6e5&&r?.emit("error:reconnecting",{attempt:z+1,delayMs:0,elapsedMs:h,windowMs:c,longOutage:!0});let g=n.reconnectBaseDelayMs??2e3,v=n.reconnectMaxDelayMs??3e4,L=Math.min(g*Math.pow(2,z),v),k=L>=v,B=p&&k?3e4:Math.round(L*(.7+Math.random()*.3));r?.logger.info(`Scheduling auto-reconnect attempt ${z+1} in ${B}ms`),r?.emit("error:reconnecting",{attempt:z+1,delayMs:B,elapsedMs:h,windowMs:c}),O=setTimeout(()=>{O=null,St()},B)},kt=p=>n.autoReconnect===!1||!a||!((r?.getState("live")??!1)&&oe)&&!S?!1:p.type==="network"||p.type==="media",$e=p=>{kt(p)&&(T===0&&(T=Date.now(),I=o?.currentTime??0,V=p),ue())},St=async()=>{if(!r||!a)return;te=!0;let p=++x;z++;let l=a,c=r.getState("live"),h=u,f=I;r.logger.info(`Auto-reconnect attempt ${z}`,{src:X(l)});try{if(we(new Error("HLS load cancelled: reconnecting")),_=0,H=0,re=0,m=0,a=l,r.setState("playbackState","loading"),h&&i.supportsNativeHLS()?await Se(l):await le(l),p!==x)return;if(c?Ue():o&&f>0&&(o.currentTime=f),r.setState("playbackState","ready"),r.setState("buffering",!1),r.emit("error:recovered",{attempt:z,elapsedMs:Date.now()-T}),r.logger.info("Auto-reconnect succeeded"),ye(),r.getState("paused"))r.logger.info("Stream reconnected while paused; maintaining pause at live edge");else try{await o?.play()}catch{}}catch{if(p!==x)return;r?.logger.warn(`Auto-reconnect attempt ${z} failed`),ue()}finally{te=!1}};return{id:"hls-provider",name:e.name,version:Dn,type:"provider",description:e.description,canPlay(p){let l=p.toLowerCase();return!!(l.split("?")[0].split("#")[0].endsWith(".m3u8")||l.includes("application/x-mpegurl")||l.includes("application/vnd.apple.mpegurl"))},async init(p){r=p,r.logger.info(`HLS plugin${e.logSuffix} initialized`),M=Rn(r);let l=r.on("playback:play",async()=>{if(o&&o.paused)try{R.corePlayRequested=!0,await o.play()}catch(D){R.corePlayRequested=!1,r?.logger.error("Play failed",D)}}),c=r.on("playback:pause",()=>{if(o){if(o.paused){R.corePlayRequested&&(R.corePlayRequested=!1,o.pause());return}R.corePauseRequested=!0,R.corePlayRequested=!1,o.pause()}}),h=r.on("playback:seeking",({time:D})=>{o&&Number.isFinite(D)&&(o.currentTime=Et(D))}),f=r.on("volume:change",({volume:D})=>{o&&(o.volume=D)}),g=r.on("volume:mute",({muted:D})=>{o&&(o.muted=D)}),v=r.on("playback:ratechange",({rate:D})=>{o&&(o.playbackRate=D)}),L=r.on("quality:select",({quality:D,auto:Z})=>{if(!s||u){r?.logger.warn("Quality selection not available");return}if(Z||D==="auto")P=!0,s.currentLevel=-1,r?.logger.debug("Quality: auto selection enabled"),r?.setState("currentQuality",{id:"auto",label:"Auto",width:0,height:0,bitrate:0,active:!0});else{P=!1;let C=parseInt(D.replace("level-",""),10);if(!isNaN(C)&&C>=0&&C<s.levels.length){s.nextLevel=C,r?.logger.debug(`Quality: queued switch to level ${C}`);let K=s.levels[C];if(K){let de=_e(K);r?.setState("currentQuality",{id:`level-${C}`,label:`${de}...`,width:K.width,height:K.height,bitrate:K.bitrate,active:!1})}}}}),k=r.on("track:audio",({trackId:D})=>{if(!s||u){r?.logger.warn("Audio track selection not available");return}let Z=An(D),C=s.audioTracks??[];if(Z<0||Z>=C.length){r?.logger.warn("Ignoring unknown audio track selection",{trackId:D});return}s.audioTrack=Z,r?.logger.debug(`Audio: queued switch to track ${Z}`)});typeof window<"u"&&(A=()=>{(O!==null||T>0||te||z>0&&!Q)&&(O&&(r?.logger.info("Browser back online, reconnecting immediately"),clearTimeout(O),O=null),St())},window.addEventListener("online",A));let B=r.subscribeToState(D=>{D.key==="poster"&&Re()}),se=r.subscribeToState(D=>{D.key==="live"&&(oe=!0)});r.onDestroy(()=>{l(),c(),h(),f(),g(),v(),L(),k(),B(),se()});let ce=r.subscribeToState(D=>{D.key==="playing"&&(D.value?Le():wt())});r.onDestroy(ce)},async destroy(){r?.logger.info(`HLS plugin${e.logSuffix} destroying`),x++,ye(),A&&typeof window<"u"&&(window.removeEventListener("online",A),A=null),ke(new Error("HLS load cancelled: player destroyed")),M?.destroy(),M=null,o?.parentNode&&o.parentNode.removeChild(o),o=null,r=null},async loadSource(p){if(!r)throw new Error("Plugin not initialized");r.logger.info(`Loading HLS source${e.logSuffix}`,{src:X(p)});let l=++x;if(ye(),S=!1,oe=!1,r.setState("live",!1),ke(new Error("HLS load cancelled: superseded by a new load")),a=p,R.corePlayRequested=!1,R.corePauseRequested=!1,Re(),r.setState("playbackState","loading"),r.setState("buffering",!0),r.getState("airplayActive")&&i.supportsNativeHLS())r.logger.info("Using native HLS (AirPlay active)"),await Se(p,!0);else if(i.isHlsJsSupported())r.logger.info(`Using ${e.engineLabel} for HLS playback`),await le(p);else if(i.supportsNativeHLS())r.logger.info("Using native HLS playback (hls.js not supported)"),await Se(p,!0);else{let c=i.describeSupport(),h=`HLS playback not supported in this browser (${Vr(c)})`;throw r.setState("playbackState","error"),r.setState("buffering",!1),r.emit("error",{code:"SOURCE_NOT_SUPPORTED",message:h,fatal:!0,timestamp:Date.now(),context:{probes:c}}),new Error(h)}if(l===x){if(o){let c=r.getState("muted"),h=r.getState("volume");c!==void 0&&(o.muted=c),h!==void 0&&(o.volume=h)}r.setState("playbackState","ready"),r.setState("buffering",!1)}},getCurrentLevel(){return u||!s?-1:s.currentLevel},setLevel(p){if(u||!s){r?.logger.warn("Quality selection not available in native HLS mode");return}s.currentLevel=p},getLevels(){return u||!s?[]:Tn(s.levels,s.currentLevel)},getHlsInstance(){return s},isNativeHLS(){return u},getLiveInfo(){if(!(r?.getState("live")||!1))return null;let l=ie();if(u){let h=l?.targetLatency??3;return{isLive:!0,latency:l?.latency??0,targetLatency:h,drift:0,liveSyncPosition:Ce(l,h),lowLatency:l?.lowLatency??!1}}if(!s)return null;let c=s.targetLatency||l?.targetLatency||3;return{isLive:!0,latency:s.latency||0,targetLatency:c,drift:s.drift||0,liveSyncPosition:Ce(l,c),lowLatency:l?.lowLatency??!1}},async switchToNative(){if(u){r?.logger.debug("Already using native HLS");return}if(!i.supportsNativeHLS()){r?.logger.warn("Native HLS not supported in this browser");return}if(!a){r?.logger.warn("No source loaded");return}r?.logger.info("Switching to native HLS for AirPlay");let p=r?.getState("playing")||!1,l=o?.currentTime||0,c=a,h=U,f=++x;if(ye(),ke(new Error("HLS load cancelled: switching to native HLS")),a=c,U=h,await Se(c),f===x){if(o&&l>0&&(o.currentTime=l),p&&o)try{await o.play()}catch{r?.logger.debug("Could not auto-resume after switch")}r?.logger.info("Switched to native HLS")}},async switchToHlsJs(){if(!u){r?.logger.debug("Already using hls.js");return}if(!i.isHlsJsSupported()){r?.logger.warn("hls.js not supported in this browser");return}if(!a){r?.logger.warn("No source loaded");return}r?.logger.info("Switching back to hls.js");let p=r?.getState("playing")||!1,l=o?.currentTime||0,c=a,h=U,f=++x;if(ye(),ke(new Error("HLS load cancelled: switching to hls.js")),a=c,U=h,await le(c),f===x){if(o&&l>0&&(o.currentTime=l),p&&o)try{await o.play()}catch{r?.logger.debug("Could not auto-resume after switch")}r?.logger.info("Switched to hls.js")}},getDiagnostics(){let p=u?"native":s?"hls.js":null,l=null,c=null;if(s&&typeof s.currentLevel=="number"&&(l=s.currentLevel,s.levels&&l>=0&&s.levels[l])){let k=s.levels[l];c={},typeof k.bitrate=="number"&&Number.isFinite(k.bitrate)&&(c.bitrate=k.bitrate),typeof k.width=="number"&&Number.isFinite(k.width)&&(c.width=k.width),typeof k.height=="number"&&Number.isFinite(k.height)&&(c.height=k.height)}let h=null;if(s&&typeof s.bandwidthEstimate=="number"&&Number.isFinite(s.bandwidthEstimate))h=Math.round(s.bandwidthEstimate);else if(r){let k=r.getState("bandwidth");typeof k=="number"&&Number.isFinite(k)&&k>0&&(h=Math.round(k))}let f=r?!!r.getState("live"):!1,g=r?!!r.getState("lowLatencyMode"):!1,v=k=>{if(!k)return[];let B=[],se=Math.min(k.length,32);for(let ce=0;ce<se;ce++)try{let D=k.start(ce),Z=k.end(ce);Number.isFinite(D)&&Number.isFinite(Z)&&B.push({start:D,end:Z})}catch{}return B},L=o??r?.container?.querySelector("video");return{engine:p,selectedLevel:l,quality:c,bandwidthEstimate:h,live:f,lowLatency:g,retryCount:(_||0)+(H||0),networkRetryCount:_||0,mediaRetryCount:H||0,reconnectAttempts:z||0,isReconnecting:!!te,readyState:L?L.readyState:null,networkState:L?L.networkState:null,buffered:v(L?L.buffered:null),seekable:v(L?L.seekable:null)}}}}function On(i){return Nn(Zt,{name:"HLS Provider",description:"HLS playback provider using hls.js",logSuffix:"",engineLabel:"hls.js"},i)}var Fn=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var $r=["mp4","webm","mov","mkv","ogv","m4v"],Bn=["mp3","wav","ogg","flac","aac","m4a","opus","weba"],qr=[...$r,...Bn],Dt={ABORTED:1,NETWORK:2,DECODE:3,SRC_NOT_SUPPORTED:4},Wr={mp4:"video/mp4",m4v:"video/mp4",webm:"video/webm",mov:"video/quicktime",mkv:"video/x-matroska",ogv:"video/ogg",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",flac:"audio/flac",aac:"audio/aac",m4a:"audio/mp4",opus:"audio/opus",weba:"audio/webm"};function Vn(i){let e=i?.preload??"metadata",t=i?.loadTimeoutMs??3e4,n=null,r=null,s=null,o=null,u=!1,a=!1,d=!1,y=0,P=null,R=!1,M=m=>{try{return new URL(m,window.location.href).pathname.split(".").pop()?.toLowerCase()??""}catch{return(m.split(".").pop()?.toLowerCase()??"").split("?")[0]??""}},w=m=>Wr[m]||"video/mp4",q=m=>Bn.includes(m),U=m=>{let S=(m.startsWith("audio/")?document.createElement("audio"):document.createElement("video")).canPlayType(m);return S==="probably"||S==="maybe"},x=()=>{if(r){if(u){r.poster="";return}r.poster=n?.getState("poster")||""}},J=()=>{if(r)return r;let m=n?.container.querySelector("video");return m?(r=m,r):(r=document.createElement("video"),r.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000",r.preload=e,r.controls=!1,r.playsInline=!0,x(),n?.container.appendChild(r),r)},_=m=>{switch(m?.code){case Dt.ABORTED:return{code:"PLAYBACK_FAILED",message:"Playback aborted"};case Dt.NETWORK:return{code:"MEDIA_NETWORK_ERROR",message:"Network error"};case Dt.DECODE:return{code:"MEDIA_DECODE_ERROR",message:"Decode error - format may not be supported"};case Dt.SRC_NOT_SUPPORTED:return R?{code:"MEDIA_NETWORK_ERROR",message:"Network error"}:{code:"SOURCE_LOAD_FAILED",message:"Format not supported"};default:return{code:"PLAYBACK_FAILED",message:"Unknown video error"}}},H=m=>{let F=[],W=y,S=(T,I)=>{let A=V=>{W===y&&I(V)};m.addEventListener(T,A),F.push([T,A])},O=()=>{m.ended||!n?.getState("ended")||(n?.setState("ended",!1),n?.setState("playbackState",m.paused?"paused":"playing"))};S("play",()=>{n?.setState("paused",!1),O()}),S("playing",()=>{n?.setState("playing",!0),n?.setState("paused",!1),n?.setState("playbackState","playing"),O(),d=!1,a?a=!1:n?.emit("playback:play",void 0)}),S("pause",()=>{a=!1,n?.setState("playing",!1),n?.setState("paused",!0),n?.setState("playbackState","paused"),d?d=!1:n?.emit("playback:pause",void 0)}),S("ended",()=>{n?.setState("playing",!1),n?.setState("ended",!0),n?.setState("playbackState","ended"),n?.emit("playback:ended",void 0)}),S("timeupdate",()=>{n?.setState("currentTime",m.currentTime),n?.emit("playback:timeupdate",{currentTime:m.currentTime})}),S("durationchange",()=>{n?.setState("duration",m.duration||0)}),S("loadedmetadata",()=>{n?.setState("duration",m.duration||0),n?.emit("media:loadedmetadata",{duration:m.duration||0})}),S("canplay",()=>{n?.setState("buffering",!1),n?.emit("media:canplay",void 0)}),S("canplaythrough",()=>{n?.emit("media:canplaythrough",void 0)}),S("waiting",()=>{n?.setState("buffering",!0),n?.emit("media:waiting",void 0)}),S("progress",()=>{if(m.buffered.length>0){let T=m.buffered.end(m.buffered.length-1),I=m.duration||0,A=I>0?T/I:0;n?.setState("bufferedAmount",A),n?.emit("media:progress",{buffered:A})}}),S("seeking",()=>{n?.setState("currentTime",m.currentTime),n?.setState("seeking",!0),O()}),S("seeked",()=>{n?.setState("seeking",!1),n?.emit("playback:seeked",{time:m.currentTime})}),S("volumechange",()=>{n?.setState("volume",m.volume),n?.setState("muted",m.muted),n?.emit("volume:change",{volume:m.volume,muted:m.muted})}),S("ratechange",()=>{n?.setState("playbackRate",m.playbackRate),n?.emit("playback:ratechange",{rate:m.playbackRate})}),S("stalled",()=>{n?.setState("buffering",!0),n?.emit("media:stalled",void 0),n?.logger.warn("Media stalled - network may be slow")}),S("suspend",()=>{n?.emit("media:suspend",void 0)}),S("abort",()=>{n?.emit("media:abort",void 0)}),S("error",()=>{let T=m.error,{code:I,message:A}=_(T);n?.logger.error("Video error",{mediaErrorCode:T?.code,code:I,message:A}),n?.setState("playbackState","error"),n?.setState("buffering",!1);let V={networkState:m.networkState,readyState:m.readyState};typeof T?.code=="number"&&(V.mediaErrorCode=T.code),n?.emit("error",{code:I,message:A,fatal:!0,timestamp:Date.now(),detail:V})}),S("enterpictureinpicture",()=>{n?.setState("pip",!0),n?.logger.debug("PiP: entered (standard)")}),S("leavepictureinpicture",()=>{n?.setState("pip",!1),n?.logger.debug("PiP: exited (standard)"),(!m.paused||n?.getState("playing"))&&m.play().catch(()=>{})});let z=m;return"webkitPresentationMode"in m&&S("webkitpresentationmodechanged",()=>{let T=z.webkitPresentationMode;n?.setState("pip",T==="picture-in-picture"),n?.logger.debug(`PiP: mode changed to ${T} (webkit)`),T==="inline"&&m.paused&&m.play().catch(()=>{})}),()=>{F.forEach(([T,I])=>{m.removeEventListener(T,I)})}},N=()=>{s?.(),s=null,a=!1,d=!1,r&&(r.pause(),r.removeAttribute("src"),r.load())};return{id:"native-provider",name:"Native Media Provider",version:Fn,type:"provider",description:"Native HTML5 playback for video (MP4, WebM, MOV) and audio (MP3, WAV, FLAC, AAC)",canPlay(m){let F=M(m);if(!qr.includes(F))return!1;let W=w(F);return U(W)},async init(m){n=m,n.logger.info("Native video plugin initialized");let F=n.on("playback:play",async()=>{if(!n?.getState("chromecastActive")&&r&&r.paused)try{a=!0,await r.play()}catch(A){a=!1,n?.logger.error("Play failed",A)}}),W=n.on("playback:pause",()=>{if(!n?.getState("chromecastActive")&&r){if(r.paused){a&&(a=!1,r.pause());return}d=!0,a=!1,r.pause()}}),S=n.on("playback:seeking",({time:A})=>{if(n?.getState("chromecastActive")||!r||!Number.isFinite(A))return;let V=Math.max(0,Math.min(A,r.duration||0));r.currentTime=V}),O=n.on("volume:change",({volume:A,muted:V})=>{r&&(r.volume=A,r.muted=V)}),z=n.on("volume:mute",({muted:A})=>{r&&(r.muted=A)}),T=n.on("playback:ratechange",({rate:A})=>{r&&(r.playbackRate=A)}),I=n.subscribeToState(A=>{A.key==="poster"&&x()});n.onDestroy(()=>{F(),W(),S(),O(),z(),T(),I()})},async destroy(){n?.logger.info("Native video plugin destroying"),y++;let m=P;P=null,m?.(new Error("Player destroyed during load")),N(),r?.parentNode&&r.parentNode.removeChild(r),r=null,n=null,o=null,u=!1,R=!1},async loadSource(m){if(!n)throw new Error("Plugin not initialized");let F=M(m),W=w(F),S=q(F);u=S,n.logger.info("Loading native media source",{src:X(m),mimeType:W,isAudio:S});let O=++y,z=P;if(P=null,z?.(new Error("Load superseded by a newer source")),R=!1,N(),n.setState("playbackState","loading"),n.setState("buffering",!0),n.setState("mediaType",S?"audio":"video"),S){let I=n.getState("title");if(!I||I===o)try{let V=new URL(m,window.location.href).pathname.split("/").pop()||"Audio",Q=decodeURIComponent(V.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));o=Q,n.setState("title",Q)}catch{o="Audio",n.setState("title","Audio")}}n.setState("qualities",[]),n.setState("currentQuality",null);let T=J();return T.style.display=S?"none":"block",x(),s=H(T),new Promise((I,A)=>{let V=null,Q=()=>{T.removeEventListener("loadedmetadata",oe),T.removeEventListener("error",ee),V!==null&&(clearTimeout(V),V=null),P===te&&(P=null)},te=ae=>{Q(),A(ae)};P=te;let oe=()=>{if(O!==y)return;Q(),R=!0;let ae=n?.getState("muted"),ge=n?.getState("volume");ae!==void 0&&(T.muted=ae),ge!==void 0&&(T.volume=ge),n?.setState("source",{src:m,type:W}),n?.setState("playbackState","ready"),n?.setState("buffering",!1),n?.emit("media:loaded",{src:m,type:W}),I()},ee=()=>{if(O!==y)return;Q();let ae=T.error;A(new Error(ae?.message||"Failed to load video source"))};t>0&&(V=setTimeout(()=>{O===y&&(Q(),n?.setState("playbackState","error"),n?.setState("buffering",!1),A(new Error("Video took too long to load (network timeout)")))},t)),T.addEventListener("loadedmetadata",oe),T.addEventListener("error",ee),T.src=m,T.load()})},getDiagnostics(){let m=r??n?.container?.querySelector("video"),F=S=>{if(!S)return[];let O=[],z=Math.min(S.length,32);for(let T=0;T<z;T++)try{let I=S.start(T),A=S.end(T);Number.isFinite(I)&&Number.isFinite(A)&&O.push({start:I,end:A})}catch{}return O},W=null;return m&&m.videoWidth>0&&m.videoHeight>0&&(W={width:m.videoWidth,height:m.videoHeight}),{readyState:m?m.readyState:null,networkState:m?m.networkState:null,dimensions:W,buffered:F(m?m.buffered:null),seekable:F(m?m.seekable:null)}}}}var Un={"bandwidth-indicator":{rank:0,exit:"hide"},"skip-backward":{rank:1,exit:"overflow"},"skip-forward":{rank:1,exit:"overflow"},pip:{rank:2,exit:"overflow"},"keyboard-help":{rank:3,exit:"overflow"},chromecast:{rank:4,exit:"overflow"},airplay:{rank:4,exit:"overflow"},volume:{rank:5,exit:"overflow"},captions:{rank:6,exit:"overflow"},quality:{rank:6,exit:"hide"},time:{rank:7,exit:"hide"},play:{rank:"never",exit:"overflow"},"live-indicator":{rank:"never",exit:"overflow"},settings:{rank:"never",exit:"overflow"},fullscreen:{rank:"never",exit:"overflow"},spacer:{rank:"never",exit:"overflow"}};function It(i,e){return i.map(t=>{let n=Un[t],r=e?.[t]??n?.rank??3;return{id:t,rank:r,exit:n?.exit??"overflow"}})}function on(i,e){if(!i.includes("quality")||i.includes("settings"))return;let[t]=It(["quality"],e);if(t.rank!=="never")throw new Error(`uiPlugin: a layout with "quality" needs "settings" as well. The quality control hides when the bar does not fit, and the settings menu is where its Quality row lives. Add "settings" to controls, pin quality with priority: { quality: 'never' }, or set responsive: false.`)}function Gr(i,e,t,n){let r=i.reduce((u,a)=>u+a,0),s=e*Math.max(0,i.length-1),o=n?t+e:0;return r+s+o}function an(i,e,t,n){let r=i.map(d=>d.id);if(e<=0)return{inBar:r,overflow:[],hidden:[]};let o=[...i.filter(d=>d.visible&&d.width>0)],u=new Set,a=new Set;for(;Gr(o.map(d=>d.width),t,n,u.size>0)>e;){let d=-1;for(let P=0;P<o.length;P++){let R=o[P];R.rank!=="never"&&(d===-1||R.rank<=o[d].rank)&&(d=P)}if(d===-1)break;let[y]=o.splice(d,1);(y.exit==="hide"?a:u).add(y.id)}return{inBar:r.filter(d=>!u.has(d)&&!a.has(d)),overflow:r.filter(d=>u.has(d)),hidden:r.filter(d=>a.has(d))}}var ln=`
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
`;var E={play:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${Je.play}"/></svg>`,pause:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',replay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',volumeHigh:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${Je.volumeHigh}"/></svg>`,volumeLow:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',volumeMute:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="${Je.volumeMuted}"/></svg>`,fullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',exitFullscreen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',pip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>',exitPip:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 9h6v2H9z"/></svg>',settings:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',chromecast:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',chromecastConnected:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',airplay:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 22h12l-6-6-6 6zM21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V5h18v12h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',captions:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>',captionsOff:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 5.5v13h-15v-13h15zM19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>',checkmark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',chevronUp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>',more:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',chevronDown:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>',close:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',keyboardHelp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>',spinner:'<svg viewBox="0 0 24 24" fill="currentColor" class="sp-spin"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',skipForward:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',skipBack:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',forward10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',replay10:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><path d="M10.9 16V11.73l-.72.36-.48-.86 1.48-.73h.85V16h-1.13zm2.77-2.14c0-.66.13-1.2.38-1.6.26-.41.66-.62 1.2-.62.55 0 .95.21 1.21.62.25.4.38.94.38 1.6 0 .67-.13 1.2-.38 1.61-.26.41-.66.61-1.21.61-.54 0-.94-.2-1.2-.61-.25-.41-.38-.94-.38-1.61zm1.12 0c0 .45.05.79.15 1.03.1.23.26.35.48.35s.38-.12.49-.35c.1-.24.15-.58.15-1.03s-.05-.78-.15-1.02c-.11-.23-.27-.35-.49-.35s-.38.12-.48.35c-.1.24-.15.57-.15 1.02z"/></svg>',error:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'};function b(i,e,t){let n=document.createElement(i);if(e)for(let[r,s]of Object.entries(e))r==="className"?n.className=s:n.setAttribute(r,s);if(t)for(let r of t)typeof r=="string"?n.appendChild(document.createTextNode(r)):n.appendChild(r);return n}function j(i,e,t){let n=b("button",{className:`sp-control ${i}`,"aria-label":e,type:"button"});return Y(n,t),n}function $(i){return i.querySelector("video")}function et(i){for(;i.firstChild;)i.removeChild(i.firstChild)}var zn=new WeakMap;function Y(i,e){return zn.get(i)===e?!1:(i.innerHTML=e,zn.set(i,e),!0)}function G(i,e,t){return i.getAttribute(e)===t?!1:(i.setAttribute(e,t),!0)}var tt=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=j("sp-play","Play",E.play),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("playing"),t=this.api.getState("ended"),n,r;t?(n=E.replay,r="Replay"):e?(n=E.pause,r="Pause"):(n=E.play,r="Play"),Y(this.el,n),G(this.el,"aria-label",r)}toggle(){let e=$(this.api.container);if(!e)return;this.api.getState("ended")?(e.currentTime=0,this.api.emit("playback:seeking",{time:0}),e.play().catch(()=>{})):e.paused?e.play().catch(()=>{}):e.pause()}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var nt=class{constructor(e,t){this.hasStarted=!1;this.lastSource=void 0;this.clickHandler=()=>{this.start()};this.api=e,this.hasOverlayProbe=typeof t=="function",this.isOverlayVisible=t??(()=>!1);let n=document.createElement("button");n.className="sp-big-play",n.setAttribute("type","button"),n.setAttribute("aria-label","Play"),Y(n,E.play),n.addEventListener("click",this.clickHandler),this.el=n}render(){return this.el}update(){let e=this.api.getState("playing"),t=$(this.api.container),n=this.hasEnded(t),r=this.api.getState("currentTime"),s=this.api.getState("playbackState"),o=this.api.getState("error"),u=this.api.getState("source");u!==this.lastSource&&(this.lastSource=u,this.hasStarted=!1),e&&(this.hasStarted=!0);let a;(this.hasOverlayProbe?this.isOverlayVisible():o)||s==="loading"||e||t&&!t.paused?a=!1:n?a=!0:this.hasStarted||r!==0?a=!1:a=s==="idle"||s==="ready",Y(this.el,n?E.replay:E.play),G(this.el,"aria-label",n?"Replay":"Play"),this.el.classList.toggle("sp-big-play--visible",a)}hasEnded(e){return e?e.ended:!!this.api.getState("ended")}start(){let e=$(this.api.container);e&&(e.ended&&(e.currentTime=0),e.play().catch(()=>{}))}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var rt=class{constructor(){this.config=null;this.loaded=!1;this.el=b("div",{className:"sp-thumbnail-preview"}),this.img=b("div",{className:"sp-thumbnail-preview__img"}),this.el.appendChild(this.img)}getElement(){return this.el}setConfig(e){if(this.config=e,this.loaded=!1,e){this.img.style.width=`${e.width}px`,this.img.style.height=`${e.height}px`,this.el.style.width=`${e.width}px`,this.el.style.height=`${e.height}px`;let t=new Image;t.onload=()=>{this.loaded=!0},t.onerror=()=>{this.config=null,this.loaded=!1},t.src=e.src}}show(e,t){if(!this.config||!this.loaded){this.el.style.display="none";return}let{src:n,width:r,height:s,columns:o,interval:u}=this.config,a=Math.floor(e/u),d=a%o,y=Math.floor(a/o);this.img.style.backgroundImage=`url(${n})`,this.img.style.backgroundPosition=`-${d*r}px -${y*s}px`,this.img.style.backgroundSize=`${o*r}px auto`,this.img.style.width=`${r}px`,this.img.style.height=`${s}px`,this.el.style.left=`${t*100}%`,this.el.style.display=""}hide(){this.el.style.display="none"}isConfigured(){return this.config!==null}destroy(){this.el.remove()}};var Qr=new WeakMap,cn=new WeakMap;function Kn(i,e){cn.set(i,e);let t=Qr.get(i);return t&&e.setFactory(t.factory),()=>{cn.get(i)===e&&cn.delete(i)}}var jr=new Set(["ArrowLeft","ArrowRight","Home","End"]),it=class{constructor(e,t={}){this.isDragging=!1;this.lastSeekTime=0;this.seekThrottleMs=100;this.wasPlayingBeforeDrag=!1;this.renderedChapters=null;this.renderedDuration=0;this.extension=null;this.detachTimelineHost=null;this.extensionDragging=!1;this.extensionEditing=!1;this.onMouseDown=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=$(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.clientX,!0)};this.onDocMouseMove=e=>{this.isDragging&&(this.seek(e.clientX),this.updateVisualPosition(e.clientX))};this.onMouseUp=e=>{if(this.isDragging&&(this.seek(e.clientX,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag)){let t=$(this.api.container);if(t&&t.paused){let n=()=>{t.removeEventListener("seeked",n),t.play().catch(()=>{})};t.addEventListener("seeked",n)}}};this.onTouchStart=e=>{if(this.isExtensionInput(e))return;e.preventDefault(),this.extension?.onSeekStart();let t=$(this.api.container);this.wasPlayingBeforeDrag=t?!t.paused:!1,this.isDragging=!0,this.el.classList.add("sp-progress--dragging"),this.lastSeekTime=0,this.seek(e.touches[0].clientX,!0)};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.seek(e.touches[0].clientX),this.updateVisualPosition(e.touches[0].clientX))};this.onTouchEnd=e=>{if(this.isDragging){let t=e.changedTouches?.[0]?.clientX;if(t!==void 0&&this.seek(t,!0),this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.extension?.onSeekEnd(),this.wasPlayingBeforeDrag){let n=$(this.api.container);if(n&&n.paused){let r=()=>{n.removeEventListener("seeked",r),n.play().catch(()=>{})};n.addEventListener("seeked",r)}}this.tooltip.style.opacity="",this.thumbnailPreview.hide()}};this.onMouseMove=e=>{this.isExtensionInput(e)||this.updateTooltip(e.clientX)};this.onMouseLeave=()=>{this.isDragging||(this.tooltip.style.opacity="",this.thumbnailPreview.hide())};this.onKeyDown=e=>{let t=$(this.api.container);if(t&&jr.has(e.key)){this.extension?.onSeekStart();try{this.applyKeyboardSeek(e,t)}finally{this.extension?.onSeekEnd()}}};this.api=e,this.options=t,this.wrapper=b("div",{className:"sp-progress-wrapper"}),this.el=b("div",{className:"sp-progress"});let n=b("div",{className:"sp-progress__track"});this.buffered=b("div",{className:"sp-progress__buffered"}),this.filled=b("div",{className:"sp-progress__filled"}),this.markers=b("div",{className:"sp-progress__markers"}),this.handle=b("div",{className:"sp-progress__handle"}),this.tooltip=b("div",{className:"sp-progress__tooltip"}),this.tooltip.textContent="0:00",this.thumbnailPreview=new rt,n.appendChild(this.buffered),n.appendChild(this.filled),n.appendChild(this.markers),n.appendChild(this.handle),this.el.appendChild(n),this.el.appendChild(this.thumbnailPreview.getElement()),this.el.appendChild(this.tooltip),this.wrapper.appendChild(this.el),this.extensionLayer=b("div",{className:"sp-progress__extension"}),this.wrapper.appendChild(this.extensionLayer),this.el.setAttribute("role","slider"),this.el.setAttribute("aria-label","Seek"),this.el.setAttribute("aria-valuemin","0"),this.el.setAttribute("aria-valuemax","0"),this.el.setAttribute("aria-valuenow","0"),this.el.setAttribute("aria-valuetext","0:00"),this.el.setAttribute("tabindex","0"),this.wrapper.addEventListener("mousedown",this.onMouseDown),this.wrapper.addEventListener("mousemove",this.onMouseMove),this.wrapper.addEventListener("mouseleave",this.onMouseLeave),this.wrapper.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.el.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd),this.detachTimelineHost=Kn(this.api.container,{setFactory:r=>this.mountExtension(r)})}mountExtension(e){if(this.extension&&(this.extension.destroy(),this.extension=null,this.setExtensionDragging(!1),this.setExtensionEditing(!1),et(this.extensionLayer)),!e)return;let t={element:this.extensionLayer,getRailRect:()=>this.el.getBoundingClientRect(),setEditing:n=>this.setExtensionEditing(n),setDragging:n=>this.setExtensionDragging(n)};this.extension=e(t),this.extension.update()}isTimelineEditing(){return this.extensionEditing}setExtensionEditing(e){this.extensionEditing!==e&&(this.extensionEditing=e,this.wrapper.classList.toggle("sp-progress-wrapper--editing",e),e&&this.show(),this.options.onEditingChange?.(e))}setExtensionDragging(e){this.extensionDragging!==e&&(this.extensionDragging=e,this.wrapper.classList.toggle("sp-progress-wrapper--ext-dragging",e),e?(this.isDragging=!1,this.el.classList.remove("sp-progress--dragging"),this.tooltip.style.opacity="0",this.thumbnailPreview.hide()):this.tooltip.style.opacity="")}isExtensionInput(e){if(this.extensionDragging)return!0;let t=e.target;return t instanceof Node&&this.extensionLayer.contains(t)}render(){return this.wrapper}show(){this.wrapper.classList.add("sp-progress-wrapper--visible")}hide(){this.wrapper.classList.remove("sp-progress-wrapper--visible")}setThumbnails(e){this.thumbnailPreview.setConfig(e)}update(){let e=this.api.getState("currentTime")||0,t=this.api.getState("duration")||0,n=this.api.getState("buffered"),r=this.api.getState("live"),s=this.api.getState("seekableRange"),o=this.api.getState("thumbnails");if(o&&!this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.setConfig(o),this.el.classList.toggle("sp-progress--live",!!r),this.updateMarkers(t,r,s),r&&s){let u=s.end-s.start;if(u>0){let a=(e-s.start)/u*100;this.filled.style.width=`${Math.max(0,Math.min(100,a))}%`,this.handle.style.left=`${Math.max(0,Math.min(100,a))}%`}if(n&&n.length>0){let a=s.end-s.start;if(a>0){let y=(n.end(n.length-1)-s.start)/a*100;this.buffered.style.width=`${Math.max(0,Math.min(100,y))}%`}}this.el.setAttribute("aria-valuemax",String(Math.floor(s.end))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",`${Math.floor(s.end-e)} seconds behind live`)}else if(t>0){let u=e/t*100;if(this.filled.style.width=`${u}%`,this.handle.style.left=`${u}%`,n&&n.length>0){let d=n.end(n.length-1)/t*100;this.buffered.style.width=`${d}%`}this.el.setAttribute("aria-valuemax",String(Math.floor(t))),this.el.setAttribute("aria-valuenow",String(Math.floor(e))),this.el.setAttribute("aria-valuetext",pe(e))}this.extension?.update()}chapterLabelAt(e){let t=this.api.getState("chapters")??[];for(let n=t.length-1;n>=0;n--){let r=t[n];if(e<r.time)continue;let s=t[n+1],o=r.endTime??(s?s.time:1/0);return e<o?r.label:null}return null}updateMarkers(e,t,n){let r=this.api.getState("chapters")??[],s=t?n?n.end-n.start:0:e;if(r.length===0||s<=0){this.renderedChapters!==null&&(this.markers.textContent="",this.renderedChapters=null,this.renderedDuration=0);return}if(r===this.renderedChapters&&s===this.renderedDuration)return;let o=t&&n?n.start:0;this.markers.textContent="";for(let u of r){if(u.time<=o)continue;let a=(u.time-o)/s*100;if(a<=0||a>=100)continue;let d=b("div",{className:"sp-progress__marker"});d.style.left=`${a}%`,d.title=u.label,this.markers.appendChild(d)}this.renderedChapters=r,this.renderedDuration=s}getTimeFromPosition(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width)),r=this.api.getState("live"),s=this.api.getState("seekableRange");if(r&&s){let a=s.end-s.start,d=s.start+n*a;return Number.isFinite(d)?d:null}let o=this.api.getState("duration")||0,u=n*o;return Number.isFinite(u)?u:null}updateTooltip(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width)),r=this.getTimeFromPosition(e)??0,s=this.api.getState("live"),o=this.api.getState("seekableRange");if(s&&o){let a=o.end-r;this.tooltip.textContent=Ee(a)}else this.tooltip.textContent=pe(r);let u=this.chapterLabelAt(r);if(u){let a=b("span",{className:"sp-progress__tooltip-chapter"});a.textContent=u,this.tooltip.appendChild(a)}this.tooltip.style.left=`${n*100}%`,this.thumbnailPreview.isConfigured()&&this.thumbnailPreview.show(r,n)}updateVisualPosition(e){let t=this.el.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e-t.left)/t.width));this.filled.style.width=`${n*100}%`,this.handle.style.left=`${n*100}%`}applyKeyboardSeek(e,t){let r=this.api.getState("live"),s=this.api.getState("seekableRange");if(r&&s)switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(s.start,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(s.end,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=s.start;break;case"End":e.preventDefault(),t.currentTime=s.end;break}else{let o=this.api.getState("duration")||0;switch(e.key){case"ArrowLeft":e.preventDefault(),t.currentTime=Math.max(0,t.currentTime-5);break;case"ArrowRight":e.preventDefault(),t.currentTime=Math.min(o,t.currentTime+5);break;case"Home":e.preventDefault(),t.currentTime=0;break;case"End":e.preventDefault(),t.currentTime=o;break}}this.api.emit("playback:seeking",{time:t.currentTime})}seek(e,t=!1){let n=$(this.api.container);if(!n)return;let r=Date.now();if(!t&&this.isDragging&&r-this.lastSeekTime<this.seekThrottleMs)return;this.lastSeekTime=r;let s=this.getTimeFromPosition(e);s!==null&&Number.isFinite(s)&&(n.currentTime=s,t&&this.api.emit("playback:seeking",{time:s}))}destroy(){this.detachTimelineHost?.(),this.detachTimelineHost=null,this.extension?.destroy(),this.extension=null,this.wrapper.removeEventListener("mousedown",this.onMouseDown),this.wrapper.removeEventListener("mousemove",this.onMouseMove),this.wrapper.removeEventListener("mouseleave",this.onMouseLeave),this.wrapper.removeEventListener("touchstart",this.onTouchStart),this.el.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.thumbnailPreview.destroy(),this.wrapper.remove()}};var st=class{constructor(e){this.api=e,this.el=b("div",{className:"sp-time"}),this.el.setAttribute("aria-live","off")}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("currentTime")||0,n=this.api.getState("duration")||0;if(e){let r=this.api.getState("seekableRange"),s=this.api.getState("liveEdge");this.el.classList.toggle("sp-time--live",!!r),this.el.style.display=r?"":"none";let o=r&&!s?Ee(r.end-t):"LIVE";this.setText(o==="LIVE"?"":o)}else this.el.classList.remove("sp-time--live"),this.el.style.display="",this.setText(`${pe(t)} / ${pe(n)}`)}setText(e){this.el.textContent!==e&&(this.el.textContent=e),e?this.el.removeAttribute("aria-hidden"):this.el.setAttribute("aria-hidden","true")}destroy(){this.el.remove()}};var ot=class{constructor(e){this.isDragging=!1;this.onMouseDown=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onDocMouseMove=e=>{this.isDragging&&this.setVolume(this.getVolumeFromPosition(e.clientX))};this.onMouseUp=()=>{this.isDragging=!1};this.onTouchStart=e=>{e.preventDefault(),this.isDragging=!0,this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX))};this.onDocTouchMove=e=>{this.isDragging&&(e.preventDefault(),this.setVolume(this.getVolumeFromPosition(e.touches[0].clientX)))};this.onTouchEnd=()=>{this.isDragging=!1};this.onKeyDown=e=>{let t=$(this.api.container);if(!t)return;let n=.1;switch(e.key){case"ArrowUp":case"ArrowRight":e.preventDefault(),this.setVolume(t.volume+n);break;case"ArrowDown":case"ArrowLeft":e.preventDefault(),this.setVolume(t.volume-n);break}};this.api=e,this.el=b("div",{className:"sp-volume"}),this.btn=b("button",{className:"sp-control sp-volume__btn","aria-label":"Mute",type:"button"}),this.btn.innerHTML=E.volumeHigh,this.btn.onclick=()=>this.toggleMute();let t=b("div",{className:"sp-volume__slider-wrap"});this.slider=b("div",{className:"sp-volume__slider"}),this.slider.setAttribute("role","slider"),this.slider.setAttribute("aria-label","Volume"),this.slider.setAttribute("aria-valuemin","0"),this.slider.setAttribute("aria-valuemax","100"),this.slider.setAttribute("tabindex","0"),this.level=b("div",{className:"sp-volume__level"}),this.slider.appendChild(this.level),t.appendChild(this.slider),this.el.appendChild(this.btn),this.el.appendChild(t),this.slider.addEventListener("mousedown",this.onMouseDown),this.slider.addEventListener("touchstart",this.onTouchStart,{passive:!1}),this.slider.addEventListener("keydown",this.onKeyDown),document.addEventListener("mousemove",this.onDocMouseMove),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchmove",this.onDocTouchMove,{passive:!1}),document.addEventListener("touchend",this.onTouchEnd),document.addEventListener("touchcancel",this.onTouchEnd)}render(){return this.el}update(){let e=this.api.getState("volume")??1,t=this.api.getState("muted")??!1,n,r;t||e===0?(n=E.volumeMute,r="Unmute"):e<.5?(n=E.volumeLow,r="Mute"):(n=E.volumeHigh,r="Mute"),Y(this.btn,n),G(this.btn,"aria-label",r);let s=t?0:e,o=`${s*100}%`;this.level.style.width!==o&&(this.level.style.width=o);let u=Math.round(s*100);G(this.slider,"aria-valuenow",String(u)),G(this.slider,"aria-valuetext",`${u}%`)}toggleMute(){let e=$(this.api.container);e&&(e.muted=!e.muted)}setVolume(e){let t=$(this.api.container);if(!t)return;let n=Math.max(0,Math.min(1,e));t.volume=n,n>0&&t.muted&&(t.muted=!1)}getVolumeFromPosition(e){let t=this.slider.getBoundingClientRect();return Math.max(0,Math.min(1,(e-t.left)/t.width))}destroy(){this.slider.removeEventListener("mousedown",this.onMouseDown),this.slider.removeEventListener("touchstart",this.onTouchStart),this.slider.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("mousemove",this.onDocMouseMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchmove",this.onDocTouchMove),document.removeEventListener("touchend",this.onTouchEnd),document.removeEventListener("touchcancel",this.onTouchEnd),this.el.remove()}};var at=class{constructor(e){this.handleClick=()=>{this.seekToLive()};this.handleKeyDown=e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.seekToLive())};this.api=e,this.el=b("div",{className:"sp-live"}),this.dot=b("div",{className:"sp-live__dot"}),this.label=document.createElement("span"),this.label.textContent="LIVE",this.el.appendChild(this.dot),this.el.appendChild(this.label),this.el.setAttribute("role","button"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge"),this.el.setAttribute("tabindex","0"),this.el.addEventListener("click",this.handleClick),this.el.addEventListener("keydown",this.handleKeyDown)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("liveEdge");this.el.style.display=e?"":"none",t?(this.el.classList.remove("sp-live--behind"),this.label.textContent="LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - currently at live edge")):(this.el.classList.add("sp-live--behind"),this.label.textContent="GO LIVE",this.dot.setAttribute("aria-hidden","true"),this.el.setAttribute("aria-label","Live broadcast - behind live edge, click to seek to live"))}seekToLive(){this.api.emit("live:seektolive",void 0)}destroy(){this.el.removeEventListener("click",this.handleClick),this.el.removeEventListener("keydown",this.handleKeyDown),this.el.remove()}};var lt=class{constructor(e){this.isOpen=!1;this.lastQualitiesJson="";this.api=e,this.el=b("div",{className:"sp-quality"}),this.btn=j("sp-quality__btn","Quality",E.settings),this.btnLabel=b("span",{className:"sp-quality__label"}),this.btnLabel.textContent="Auto",this.btn.appendChild(this.btnLabel),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.menu=b("div",{className:"sp-quality-menu"}),this.menu.setAttribute("role","menu"),this.menu.addEventListener("click",t=>{t.stopPropagation()}),this.el.appendChild(this.btn),this.el.appendChild(this.menu),this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler)}render(){return this.el}update(){let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality");this.el.style.display=e.length>0?"":"none",e.length===0&&this.isOpen&&this.close(),this.btnLabel.textContent=t?.label||"Auto";let n=JSON.stringify(e.map(s=>s.id)),r=t?.id||"auto";n!==this.lastQualitiesJson&&(this.lastQualitiesJson=n,this.rebuildMenu(e)),this.updateActiveStates(r)}rebuildMenu(e){this.menu.innerHTML="";let t=this.createMenuItem("Auto","auto");this.menu.appendChild(t);let n=[...e].sort((r,s)=>s.height-r.height);for(let r of n){if(r.id==="auto")continue;let s=this.createMenuItem(r.label,r.id);this.menu.appendChild(s)}}updateActiveStates(e){this.menu.querySelectorAll(".sp-quality-menu__item").forEach(n=>{let s=n.getAttribute("data-quality-id")===e;n.classList.toggle("sp-quality-menu__item--active",s)})}createMenuItem(e,t){let n=b("div",{className:"sp-quality-menu__item"});n.setAttribute("role","menuitem"),n.setAttribute("data-quality-id",t);let r=b("span",{className:"sp-quality-menu__label"});return r.textContent=e,n.appendChild(r),n.addEventListener("click",s=>{s.preventDefault(),s.stopPropagation(),this.selectQuality(t)}),n}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.menu.classList.add("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","true")}close(){this.isOpen=!1,this.menu.classList.remove("sp-quality-menu--open"),this.btn.setAttribute("aria-expanded","false")}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),this.el.remove()}};function Yr(){if(typeof navigator>"u")return!1;let i=navigator.userAgent;return/Chrome/.test(i)&&!/Edge|Edg/.test(i)}function Xr(){return typeof HTMLVideoElement>"u"?!1:typeof HTMLVideoElement.prototype.webkitShowPlaybackTargetPicker=="function"}var Be=class{constructor(e,t){this.api=e,this.type=t,this.supported=t==="chromecast"?Yr():Xr();let n=t==="chromecast"?E.chromecast:E.airplay,r=t==="chromecast"?"Cast":"AirPlay";this.el=j(`sp-cast sp-cast--${t}`,r,n),this.el.addEventListener("click",()=>this.handleClick()),this.supported||(this.el.style.display="none")}render(){return this.el}update(){if(!this.supported){this.el.style.display="none";return}if(this.type==="chromecast"){let e=this.api.getState("chromecastAvailable"),t=this.api.getState("chromecastActive");this.el.style.display="",this.el.disabled=!e&&!t,this.el.classList.toggle("sp-cast--active",!!t),this.el.classList.toggle("sp-cast--unavailable",!e&&!t),t?(Y(this.el,E.chromecastConnected),G(this.el,"aria-label","Stop casting")):(Y(this.el,E.chromecast),G(this.el,"aria-label",e?"Cast":"No Cast devices found"))}else{let e=this.api.getState("airplayActive");this.el.style.display="",this.el.disabled=!1,this.el.classList.toggle("sp-cast--active",!!e),this.el.classList.remove("sp-cast--unavailable"),G(this.el,"aria-label",e?"Stop AirPlay":"AirPlay")}}handleClick(){this.type==="chromecast"?this.handleChromecast():this.handleAirPlay()}handleChromecast(){let e=this.api.getPlugin("chromecast");e&&(e.isConnected()?e.endSession():e.requestSession().catch(()=>{}))}async handleAirPlay(){let e=this.api.getPlugin("airplay");e?await e.showPicker():$(this.api.container)?.webkitShowPlaybackTargetPicker?.()}destroy(){this.el.remove()}};var ct=class{constructor(e){this.clickHandler=()=>{this.toggle().catch(()=>{})};this.api=e;let t=document.createElement("video");this.supported="pictureInPictureEnabled"in document||"webkitSetPresentationMode"in t,this.el=j("sp-pip","Picture-in-Picture",E.pip),this.el.addEventListener("click",this.clickHandler),this.supported?(this.el.disabled=!0,this.el.setAttribute("aria-disabled","true")):this.el.style.display="none"}render(){return this.el}isMediaReady(){let e=$(this.api.container);return!!e&&e.readyState>=HTMLMediaElement.HAVE_METADATA}update(){if(!this.supported)return;let e=!!this.api.getState("pip"),t=e||this.isMediaReady();this.el.disabled=!t,G(this.el,"aria-disabled",String(!t)),Y(this.el,e?E.exitPip:E.pip),G(this.el,"aria-label",e?"Exit Picture-in-Picture":"Picture-in-Picture"),this.el.classList.toggle("sp-pip--active",e)}async toggle(){let e=$(this.api.container);if(!e){this.api.logger.warn("PiP: video element not found");return}let t=document.pictureInPictureElement===e||e.webkitPresentationMode==="picture-in-picture";if(!t&&e.readyState<HTMLMediaElement.HAVE_METADATA){this.api.logger.debug("PiP: ignored, media not ready",{readyState:e.readyState});return}try{t?(document.pictureInPictureElement?await document.exitPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("inline"),this.api.logger.debug("PiP: exited")):(e.requestPictureInPicture?await e.requestPictureInPicture():e.webkitSetPresentationMode&&e.webkitSetPresentationMode("picture-in-picture"),this.api.logger.debug("PiP: entered"))}catch(n){let r=n instanceof Error?n.message:String(n);this.api.logger.warn("PiP: failed",{error:r})}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var ut=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=j("sp-fullscreen","Fullscreen",E.fullscreen),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){this.api.getState("fullscreen")?(Y(this.el,E.exitFullscreen),G(this.el,"aria-label","Exit fullscreen")):(Y(this.el,E.fullscreen),G(this.el,"aria-label","Fullscreen"))}async toggle(){let e=this.api.container;try{Te(e)?await Me(e):await Pe(e)}catch{}}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var dt=class{constructor(){this.el=b("div",{className:"sp-spacer"})}render(){return this.el}update(){}destroy(){this.el.remove()}};function Jr(i){if(!i)return"Something went wrong.";let e=i.code;if(e)switch(e){case"MEDIA_NETWORK_ERROR":return"Having trouble connecting. Check your internet and try again.";case"MEDIA_DECODE_ERROR":return"This video can't be played right now.";case"SOURCE_LOAD_FAILED":case"SOURCE_NOT_SUPPORTED":case"PROVIDER_NOT_FOUND":return"Unable to load video. Please try again.";case"PLAYBACK_FAILED":return"Playback stopped unexpectedly. Please try again.";case"MEDIA_APPEND_ERROR":return"Video playback was interrupted. Please try again.";case"MEDIA_BUFFER_FULL":return"Your device is low on video memory. Close other apps or tabs and try again.";case"PLAYLIST_INVALID":return"The stream is temporarily unavailable. Please try again."}let t=i.message?.toLowerCase()||"";return t.includes("network")||t.includes("timeout")||t.includes("fetch")||t.includes("connection")?"Having trouble connecting. Check your internet and try again.":t.includes("manifest")?"Unable to load video. Please try again.":t.includes("decode")||t.includes("media")||t.includes("format")||t.includes("codec")?"This video can't be played right now.":t.includes("not found")||t.includes("404")||t.includes("source")||t.includes("not supported")?"Video not found.":"Something went wrong."}var pt=class{constructor(e){this.visible=!1;this.lastSource=null;this.handleRetry=()=>{if(this.retryBtn.disabled)return;this.retryBtn.disabled=!0,this.hide();let t=this.api.getState("source")?.src||this.lastSource;t&&this.api.emit("error:retry",{src:t}),setTimeout(()=>{this.retryBtn.disabled=!1},1e3)};this.handleDismiss=()=>{this.hide(),this.api.emit("error:dismiss",void 0)};this.api=e;let t=document.createElement("div");t.className="sp-error-overlay",t.setAttribute("role","alert"),t.setAttribute("aria-live","assertive");let n=document.createElement("div");n.className="sp-error-overlay__content";let r=document.createElement("div");r.className="sp-error-overlay__icon",r.innerHTML=E.error;let s=document.createElement("p");s.className="sp-error-overlay__message",s.textContent="Something went wrong.";let o=document.createElement("div");o.className="sp-error-overlay__actions",this.retryBtn=document.createElement("button"),this.retryBtn.className="sp-error-overlay__retry",this.retryBtn.setAttribute("type","button"),this.retryBtn.setAttribute("aria-label","Try again"),this.retryBtn.textContent="Try Again",this.retryBtn.addEventListener("click",this.handleRetry),this.dismissBtn=document.createElement("button"),this.dismissBtn.className="sp-error-overlay__dismiss",this.dismissBtn.setAttribute("type","button"),this.dismissBtn.setAttribute("aria-label","Go back"),this.dismissBtn.textContent="Go Back",this.dismissBtn.addEventListener("click",this.handleDismiss),o.appendChild(this.retryBtn),o.appendChild(this.dismissBtn),n.appendChild(r),n.appendChild(s),n.appendChild(o),t.appendChild(n),this.el=t}render(){return this.el}show(e){let t=Jr(e),n=this.el.querySelector(".sp-error-overlay__message");n&&(n.textContent=t);let r=this.api.getState("source");r?.src&&(this.lastSource=r.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.remove("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}showReconnecting(){let e=this.el.querySelector(".sp-error-overlay__message");e&&(e.textContent="Connection lost. Reconnecting...");let t=this.api.getState("source");t?.src&&(this.lastSource=t.src),this.visible=!0,this.retryBtn.disabled=!1,this.el.classList.add("sp-error-overlay--reconnecting"),this.el.classList.add("sp-error-overlay--visible")}hide(){this.visible=!1,this.el.classList.remove("sp-error-overlay--visible"),this.el.classList.remove("sp-error-overlay--reconnecting")}isVisible(){return this.visible}update(){let e=this.api.getState("playbackState");this.visible&&e!=="error"&&e!=="loading"&&this.api.getState("playing")&&this.hide()}destroy(){this.retryBtn.removeEventListener("click",this.handleRetry),this.dismissBtn.removeEventListener("click",this.handleDismiss),this.el.remove()}};var Zr=90,ei=60,ti=[{label:"0.5x",value:.5},{label:"0.75x",value:.75},{label:"Normal",value:1},{label:"1.25x",value:1.25},{label:"1.5x",value:1.5},{label:"2x",value:2}],ht=class{constructor(e){this.isOpen=!1;this.currentPanel="main";this.lastQualitiesJson="";this.lastSpeedAvailable=!0;this.withdrawnRate=null;this.speedLatch={source:void 0,shown:!1};this.api=e,this.el=b("div",{className:"sp-settings"}),this.btn=j("sp-settings__btn","Settings",E.settings),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",t=>{t.stopPropagation(),this.toggle()}),this.panel=b("div",{className:"sp-settings-panel"}),this.panel.setAttribute("role","menu"),this.panel.addEventListener("click",t=>t.stopPropagation()),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.closeHandler=t=>{this.el.contains(t.target)||this.close(!1)},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{if(this.isOpen){if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),this.currentPanel!=="main"?this.showPanel("main"):this.close();return}if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault(),t.stopPropagation(),this.navigateItems(t.key==="ArrowDown"?1:-1);return}t.key==="Tab"&&(t.preventDefault(),t.stopPropagation(),this.navigateItems(t.shiftKey?-1:1))}},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){let e=this.isSpeedAvailable();e?this.restoreRate():this.resetRate();let t=this.hasRows();this.el.style.display=t?"":"none",this.isOpen&&!t&&this.close(!1),e!==this.lastSpeedAvailable&&(this.lastSpeedAvailable=e,this.isOpen&&(this.currentPanel==="main"||this.currentPanel==="speed")&&this.showPanel("main"));let n=this.api.getState("qualities")||[],r=JSON.stringify(n.map(s=>s.id));r!==this.lastQualitiesJson&&(this.lastQualitiesJson=r,this.isOpen&&this.currentPanel==="quality"&&this.renderQualityPanel()),this.isOpen&&(this.currentPanel==="quality"?this.updateQualityActiveStates():this.currentPanel==="speed"?this.updateSpeedActiveStates():this.currentPanel==="captions"?this.updateCaptionsActiveStates():this.currentPanel==="audio"&&this.updateAudioActiveStates())}isSpeedAvailable(){let e=this.api.getState("source");this.speedLatch.source!==e&&(this.speedLatch={source:e,shown:!1},this.withdrawnRate=null);let t=this.api.getState("live"),n=this.api.getState("seekableRange"),r=n?n.end-n.start:0;return!n||r<ei?this.speedLatch.shown=!1:t&&r>=Zr&&(this.speedLatch.shown=!0),!t||this.speedLatch.shown}resetRate(){let e=this.api.container.querySelector("video"),t=e?e.playbackRate:this.api.getState("playbackRate")??1;t!==1&&(this.withdrawnRate={rate:t,src:this.api.getState("source")?.src},this.api.emit("playback:ratechange",{rate:1}),e&&(e.playbackRate=1))}restoreRate(){let e=this.withdrawnRate;if(!e||(this.withdrawnRate=null,e.src!==this.api.getState("source")?.src))return;this.api.emit("playback:ratechange",{rate:e.rate});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e.rate)}hasRows(){return this.isSpeedAvailable()||(this.api.getState("qualities")||[]).length>0||(this.api.getState("textTracks")||[]).length>0||(this.api.getState("audioTracks")||[]).length>1}toggle(){this.isOpen?this.close():this.open()}open(){this.isOpen=!0,this.currentPanel="main",this.renderMainPanel(),this.panel.classList.add("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","true"),this.focusFirstItem()}close(e=!0){let t=this.isOpen;this.isOpen=!1,this.currentPanel="main",this.panel.classList.remove("sp-settings-panel--open"),this.btn.setAttribute("aria-expanded","false"),t&&e&&this.btn.focus()}showPanel(e){switch(this.currentPanel=e,e){case"main":this.renderMainPanel();break;case"quality":this.renderQualityPanel();break;case"speed":this.renderSpeedPanel();break;case"captions":this.renderCaptionsPanel();break;case"audio":this.renderAudioPanel();break}this.focusFirstItem()}renderMainPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--main";let e=this.api.getState("qualities")||[],t=this.api.getState("currentQuality"),n=this.api.getState("playbackRate")??1;if(e.length>0){let a=this.createMainRow("Quality",t?.label||"Auto",()=>this.showPanel("quality"));this.panel.appendChild(a)}if((this.api.getState("textTracks")||[]).length>0){let a=this.api.getState("currentTextTrack"),d=a?a.label:"Off",y=this.createMainRow("Captions",d,()=>this.showPanel("captions"));this.panel.appendChild(y)}if((this.api.getState("audioTracks")||[]).length>1){let a=this.api.getState("currentAudioTrack"),d=this.createMainRow("Audio",a?.label||"Default",()=>this.showPanel("audio"));this.panel.appendChild(d)}if(!this.isSpeedAvailable())return;let o=n===1?"Normal":`${n}x`,u=this.createMainRow("Speed",o,()=>this.showPanel("speed"));this.panel.appendChild(u)}createMainRow(e,t,n){let r=b("div",{className:"sp-settings-panel__row"});r.setAttribute("role","menuitem"),r.setAttribute("tabindex","0"),r.setAttribute("aria-haspopup","true");let s=b("span",{className:"sp-settings-panel__label"});s.textContent=e;let o=b("span",{className:"sp-settings-panel__value"});o.textContent=t;let u=b("span",{className:"sp-settings-panel__arrow"});return u.innerHTML=E.chevronDown,o.appendChild(u),r.appendChild(s),r.appendChild(o),r.addEventListener("click",a=>{a.preventDefault(),n()}),r.addEventListener("keydown",a=>{(a.key==="Enter"||a.key===" ")&&(a.preventDefault(),n())}),r}renderQualityPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Quality");this.panel.appendChild(e);let t=this.api.getState("qualities")||[],r=this.api.getState("currentQuality")?.id||"auto",s=this.createMenuItem("Auto","auto",r==="auto");s.addEventListener("click",u=>{u.preventDefault(),this.selectQuality("auto")}),this.panel.appendChild(s);let o=[...t].sort((u,a)=>a.height-u.height);for(let u of o){if(u.id==="auto")continue;let a=this.createMenuItem(u.label,u.id,u.id===r);a.addEventListener("click",d=>{d.preventDefault(),this.selectQuality(u.id)}),this.panel.appendChild(a)}}renderSpeedPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Speed");this.panel.appendChild(e);let t=this.api.getState("playbackRate")??1;for(let n of ti){let r=Math.abs(t-n.value)<.01,s=this.createMenuItem(n.label,String(n.value),r);s.addEventListener("click",o=>{o.preventDefault(),this.selectSpeed(n.value)}),this.panel.appendChild(s)}}renderCaptionsPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Captions");this.panel.appendChild(e);let t=this.api.getState("textTracks")||[],r=this.api.getState("currentTextTrack")?.id||"off",s=this.createMenuItem("Off","off",r==="off");s.addEventListener("click",o=>{o.preventDefault(),this.selectCaption(null)}),this.panel.appendChild(s);for(let o of t){let u=this.createMenuItem(o.label,o.id,o.id===r);u.addEventListener("click",a=>{a.preventDefault(),this.selectCaption(o.id)}),this.panel.appendChild(u)}}renderAudioPanel(){this.panel.innerHTML="",this.panel.className="sp-settings-panel sp-settings-panel--open sp-settings-panel--sub";let e=this.createSubHeader("Audio");this.panel.appendChild(e);let t=this.api.getState("audioTracks")||[],r=this.api.getState("currentAudioTrack")?.id??null;for(let s of t){let o=this.createMenuItem(s.label,s.id,s.id===r);o.addEventListener("click",u=>{u.preventDefault(),this.selectAudioTrack(s.id)}),this.panel.appendChild(o)}}selectAudioTrack(e){this.api.emit("track:audio",{trackId:e}),this.close()}updateAudioActiveStates(){let t=this.api.getState("currentAudioTrack")?.id??null;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}selectCaption(e){this.api.emit("track:text",{trackId:e}),this.close()}updateCaptionsActiveStates(){let t=this.api.getState("currentTextTrack")?.id||"off";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}createSubHeader(e){let t=b("div",{className:"sp-settings-panel__header"});t.setAttribute("role","menuitem"),t.setAttribute("tabindex","0");let n=b("span",{className:"sp-settings-panel__back"});n.innerHTML=E.chevronUp;let r=b("span",{className:"sp-settings-panel__header-label"});return r.textContent=e,t.appendChild(n),t.appendChild(r),t.addEventListener("click",s=>{s.preventDefault(),this.showPanel("main")}),t.addEventListener("keydown",s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),this.showPanel("main"))}),t}createMenuItem(e,t,n){let r=b("div",{className:`sp-settings-panel__item${n?" sp-settings-panel__item--active":""}`});r.setAttribute("role","menuitem"),r.setAttribute("tabindex","0"),r.setAttribute("data-id",t);let s=b("span");s.textContent=e;let o=b("span",{className:"sp-settings-panel__check"});return o.innerHTML=E.checkmark,r.appendChild(s),r.appendChild(o),r.addEventListener("keydown",u=>{(u.key==="Enter"||u.key===" ")&&(u.preventDefault(),r.click())}),r}selectQuality(e){this.api.emit("quality:select",{quality:e,auto:e==="auto"}),this.close()}selectSpeed(e){if(!this.isSpeedAvailable())return;this.api.emit("playback:ratechange",{rate:e});let t=this.api.container.querySelector("video");t&&(t.playbackRate=e),this.close()}updateQualityActiveStates(){let t=this.api.getState("currentQuality")?.id||"auto";this.panel.querySelectorAll(".sp-settings-panel__item").forEach(r=>{let s=r.getAttribute("data-id");r.classList.toggle("sp-settings-panel__item--active",s===t)})}updateSpeedActiveStates(){let e=this.api.getState("playbackRate")??1;this.panel.querySelectorAll(".sp-settings-panel__item").forEach(n=>{let r=n.getAttribute("data-id"),s=parseFloat(r||"1");n.classList.toggle("sp-settings-panel__item--active",Math.abs(e-s)<.01)})}getFocusableItems(){return Array.from(this.panel.querySelectorAll('[role="menuitem"]'))}focusFirstItem(){requestAnimationFrame(()=>{let e=this.getFocusableItems();e.length>0&&e[0].focus()})}navigateItems(e){let t=this.getFocusableItems();if(t.length===0)return;let n=document.activeElement,r=t.indexOf(n),s;r===-1?s=e===1?0:t.length-1:s=(r+e+t.length)%t.length,t[s].focus()}getPanel(){return this.currentPanel}isMenuOpen(){return this.isOpen}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.el.remove()}};var ni=10,Ve=class{constructor(e,t,n=ni){this.clickHandler=()=>{this.skip()};this.api=e,this.direction=t,this.seconds=n;let r=t==="backward"?E.replay10:E.forward10,s=t==="backward"?`Rewind ${n} seconds`:`Forward ${n} seconds`;this.el=j(`sp-skip sp-skip--${t}`,s,r),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("live"),t=this.api.getState("duration")??0,n=this.api.getState("seekableRange");if(e&&!n){this.el.style.display="none";return}if(e&&n){this.el.style.display="";return}if(t===0){this.el.style.display="none";return}this.el.style.display=""}skip(){let e=$(this.api.container);if(!e)return;let t=this.api.getState("live"),n=this.api.getState("seekableRange"),r;if(t&&n){if(this.direction==="forward"&&this.api.getState("liveEdge"))return;r=this.direction==="backward"?Math.max(n.start,e.currentTime-this.seconds):Math.min(n.end,e.currentTime+this.seconds)}else{let s=e.duration||0;if(!s||!isFinite(s))return;r=this.direction==="backward"?Math.max(0,e.currentTime-this.seconds):Math.min(s,e.currentTime+this.seconds)}e.currentTime=r,this.api.emit("playback:seeking",{time:r})}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};function Nt(i){let e=i.getState("textTracks")||[],t=i.getState("currentTextTrack");return e.length===0?!1:(t?i.emit("track:text",{trackId:null}):i.emit("track:text",{trackId:e[0].id}),!0)}var gt=class{constructor(e){this.clickHandler=()=>{this.toggle()};this.api=e,this.el=j("sp-captions","Captions",E.captionsOff),this.el.addEventListener("click",this.clickHandler)}render(){return this.el}update(){let e=this.api.getState("textTracks")||[],t=this.api.getState("currentTextTrack");if(e.length===0){this.el.style.display="none";return}this.el.style.display="",t?(Y(this.el,E.captions),G(this.el,"aria-label",`Captions: ${t.label}`),this.el.classList.add("sp-captions--active")):(Y(this.el,E.captionsOff),G(this.el,"aria-label","Captions"),this.el.classList.remove("sp-captions--active"))}toggle(){Nt(this.api)}destroy(){this.el.removeEventListener("click",this.clickHandler),this.el.remove()}};var ft=class{constructor(e){this.el=j("sp-kbd-help-btn","Keyboard shortcuts",E.keyboardHelp),this.el.addEventListener("click",()=>e())}render(){return this.el}update(){}destroy(){this.el.remove()}};var un=[{keys:"Space / K",action:"Play / pause"},{keys:"Left / Right arrow",action:"Seek 5 seconds back / forward"},{keys:"Up / Down arrow",action:"Volume up / down"},{keys:"M",action:"Toggle mute"},{keys:"F",action:"Toggle fullscreen"},{keys:"C",action:"Toggle captions",note:"Needs caption tracks. Turns the current track off, or enables the first available one."},{keys:"0-9",action:"Seek to 0-90% of the video",note:"On a live stream with DVR, seeks to the same share of the seekable window; on live without DVR, digits do nothing."},{keys:"?",action:"Show this help"},{keys:"Home / End",action:"Jump to the start / end",note:"Only while the progress bar is focused - they are progress-slider shortcuts, not player-wide ones."}];var mt=class{constructor(e){this.opened=!1;this.invoker=null;this.api=e,this.el=b("div",{className:"sp-kbd-help",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts"}),this.panel=b("div",{className:"sp-kbd-help__panel"});let t=b("div",{className:"sp-kbd-help__header"}),n=b("span",{className:"sp-kbd-help__title"});n.textContent="Keyboard shortcuts",this.closeBtn=b("button",{className:"sp-kbd-help__close",type:"button","aria-label":"Close keyboard shortcuts"}),this.closeBtn.innerHTML=E.close,this.closeHandler=()=>this.close(),this.closeBtn.addEventListener("click",this.closeHandler),t.appendChild(n),t.appendChild(this.closeBtn),this.body=b("div",{className:"sp-kbd-help__body"}),this.renderEntries(),this.panel.appendChild(t),this.panel.appendChild(this.body),this.el.appendChild(this.panel),this.keyHandler=r=>{if(this.opened&&this.api.container.contains(document.activeElement)){if(r.key==="Escape"){r.preventDefault(),r.stopPropagation(),this.close();return}r.key==="Tab"&&(r.preventDefault(),r.stopPropagation(),this.trapTab(r.shiftKey))}}}renderEntries(){let e=b("div",{className:"sp-kbd-help__list"});for(let r of un){let s=b("div",{className:"sp-kbd-help__row"}),o=b("span",{className:"sp-kbd-help__keys"});o.textContent=r.keys;let u=b("span",{className:"sp-kbd-help__action"});u.textContent=r.action,s.appendChild(o),s.appendChild(u),e.appendChild(s)}this.body.appendChild(e);let t=un.filter(r=>r.note);if(t.length===0)return;let n=b("div",{className:"sp-kbd-help__notes"});for(let r of t){let s=b("p",{className:"sp-kbd-help__note"});s.textContent=`${r.keys}: ${r.note}`,n.appendChild(s)}this.body.appendChild(n)}open(e){if(this.opened)return!0;let t=document.activeElement;if(t instanceof HTMLElement){let n=t.closest('[role="dialog"], [aria-modal="true"]');if(n&&!this.el.contains(n)&&!n.contains(this.api.container))return!1}return this.opened=!0,this.invoker=e instanceof HTMLElement&&this.api.container.contains(e)?e:this.api.container,this.api.container.appendChild(this.el),document.addEventListener("keydown",this.keyHandler),this.closeBtn.focus(),!0}close(e=!0){if(!this.opened)return;this.opened=!1,document.removeEventListener("keydown",this.keyHandler),this.el.remove();let t=this.invoker;if(this.invoker=null,!e)return;let n=t?.isConnected?t:this.api.container;n.isConnected&&(n.focus(),document.activeElement!==n&&this.api.container.isConnected&&this.api.container.focus())}isOpen(){return this.opened}trapTab(e){let t=Array.from(this.el.querySelectorAll("button, [href], [tabindex]")).filter(s=>!(s instanceof HTMLButtonElement&&s.disabled));if(t.length===0)return;let n=t.indexOf(document.activeElement);(e?t[(n<=0?t.length:n)-1]:t[(n+1)%t.length]).focus()}destroy(){this.close(!1),this.closeBtn.removeEventListener("click",this.closeHandler)}};var ri='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"/></svg>',vt=class{constructor(e){this.api=e,this.el=b("div",{className:"sp-bandwidth-indicator"}),this.el.innerHTML=ri,this.el.setAttribute("aria-label","Bandwidth is limiting video quality"),this.el.setAttribute("title","Bandwidth is limiting video quality"),this.el.style.display="none"}render(){return this.el}update(){let e=this.api.getState("bandwidth"),t=this.api.getState("qualities");if(!e||!t||t.length===0){this.el.style.display="none";return}let n=Math.max(...t.map(r=>r.bitrate));n>0&&e<n?this.el.style.display="":this.el.style.display="none"}destroy(){this.el.remove()}};var yt=class{constructor(e){this.api=e;this.isOpen=!1;this.toggleHandler=()=>{this.isOpen?this.close():this.open()};this.el=b("div",{className:"sp-overflow"}),this.btn=j("sp-overflow__btn","More controls",E.more),this.btn.setAttribute("aria-haspopup","true"),this.btn.setAttribute("aria-expanded","false"),this.btn.addEventListener("click",this.toggleHandler),this.panel=b("div",{className:"sp-overflow-tray",role:"group","aria-label":"More controls"}),this.el.appendChild(this.btn),this.el.appendChild(this.panel),this.el.style.display="none",this.closeHandler=t=>{this.el.contains(t.target)||this.close()},document.addEventListener("click",this.closeHandler),this.keyHandler=t=>{!this.isOpen||t.key!=="Escape"||(t.preventDefault(),t.stopPropagation(),this.close(),this.btn.focus())},document.addEventListener("keydown",this.keyHandler)}render(){return this.el}update(){}adopt(e){this.panel.appendChild(e),this.syncVisibility()}release(e){return e.parentNode===this.panel&&this.panel.removeChild(e),this.syncVisibility(),e}holds(e){return e.parentNode===this.panel}open(){this.isOpen||(this.isOpen=!0,this.panel.classList.add("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","true"))}close(){this.isOpen&&(this.isOpen=!1,this.panel.classList.remove("sp-overflow-tray--open"),this.btn.setAttribute("aria-expanded","false"))}isMenuOpen(){return this.isOpen}syncVisibility(){let e=Array.from(this.panel.children).some(t=>t.style.display!=="none");this.el.style.display=e?"":"none",!e&&this.isOpen&&this.close()}refresh(){this.syncVisibility()}destroy(){document.removeEventListener("click",this.closeHandler),document.removeEventListener("keydown",this.keyHandler),this.btn.removeEventListener("click",this.toggleHandler),this.el.remove(),this.api.logger.debug("Overflow tray destroyed")}};var ii=new Map,si=new Map,$n=new Set;function dn(i,e){if(e){let t=si.get(e)?.get(i);if(t)return t}return ii.get(i)??null}function qn(i){return $n.add(i),()=>{$n.delete(i)}}var Wn=typeof __PKG_VERSION__<"u"?__PKG_VERSION__:"0.0.0-dev";var pn=[32,32,32],Gn=4.5,oi=`
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
  yellow:ffff00 yellowgreen:9acd32`,Qn;function ai(i){return Qn??(Qn=new Map(oi.trim().split(/\s+/).map(e=>e.split(":")))),Qn.get(i)}var li=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/;function jn(i,e){if(!li.test(i))return null;let t=i.endsWith("%")?parseFloat(i)/100*e:parseFloat(i);return Math.min(e,Math.max(0,t))}function Yn(i){let e=/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(i)?.[1];if(!e)return null;let t=e.length<=4?e.split("").map(r=>r+r).join(""):e,n=t.length===8?parseInt(t.slice(6,8),16)/255:1;return[[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)],n]}function ci(i){let e=/^rgba?\(([^()]*)\)$/.exec(i)?.[1]?.trim();if(!e)return null;let t,n;if(e.includes(","))t=e.split(",").map(o=>o.trim()),t.length===4&&(n=t.pop());else{let[o="",u,...a]=e.split("/").map(d=>d.trim());if(a.length||u==="")return null;t=o.split(/\s+/),n=u}if(t.length!==3)return null;let r=t.map(o=>jn(o,255)),s=n===void 0?1:jn(n,1);return r.some(o=>o===null)||s===null?null:[r.map(o=>Math.round(o)),s]}function ui(i,e){let t=i.trim().toLowerCase(),n=ai(t),r=n?Yn(`#${n}`):Yn(t)??ci(t);if(!r)return null;let[s,o]=r;return o<=0?null:o>=1?s:s.map((u,a)=>Math.round(u*o+e[a]*(1-o)))}function Ot([i,e,t]){let[n,r,s]=[i,e,t].map(o=>{let u=o/255;return u<=.03928?u/12.92:Math.pow((u+.055)/1.055,2.4)});return .2126*n+.7152*r+.0722*s}function Xn(i,e){let t=Math.max(Ot(i),Ot(e)),n=Math.min(Ot(i),Ot(e));return(t+.05)/(n+.05)}function di(i,e){return i.map(t=>Math.round(t+(255-t)*e))}function Jn(i){return`#${i.map(e=>e.toString(16).padStart(2,"0")).join("")}`}function hn(i){let e=ui(i,pn);if(!e)return i;if(Xn(e,pn)>=Gn)return Jn(e);for(let t=.04;t<=1;t+=.04){let n=di(e,t);if(Xn(n,pn)>=Gn)return Jn(n)}return"#ffffff"}var pi=["play","skip-backward","skip-forward","volume","time","live-indicator","bandwidth-indicator","spacer","settings","captions","chromecast","airplay","pip","fullscreen"],hi="sp-ui-styles",gi=3e3,fi=new Set([" ","Enter"]),mi=new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"]),vi=48,Zn=64,yi=44,er=24,tr=4,bi=100,Ei=16,wi=56,ki=120,nr=1500;function rr(i={}){let e,t=null,n=null,r=null,s=null,o=null,u=null,a=null,d=[],y=null,P=null,R=null,M=null,w=null,q=null,U=null,x=!0,J=null,_=null,H=[],N=null,re=null,m=null,F=null,W=null,S=er,O=tr,z=Zn,T=null,I=!0,A=!1,V=!1,Q=new Set,te=null,oe=i.controls||pi,ee=i.hideDelay??gi,ae=i.bigPlayButton!==!1,ge=i.keyboard!==!1,ie=i.responsive!==!1;ie&&on(oe,i.priority);let bt=()=>{for(let c of d){let h=c;typeof h.close=="function"&&h.close(!1)}let l=document.activeElement instanceof HTMLElement?document.activeElement:null;return re?.open(l)??!1},Ce=l=>{switch(l){case"play":return new tt(e);case"skip-backward":return new Ve(e,"backward");case"skip-forward":return new Ve(e,"forward");case"volume":return new ot(e);case"progress":return null;case"time":return new st(e);case"live-indicator":return new at(e);case"bandwidth-indicator":return new vt(e);case"quality":return new lt(e);case"settings":return new ht(e);case"captions":return new gt(e);case"chromecast":return new Be(e,"chromecast");case"airplay":return new Be(e,"airplay");case"pip":return new ct(e);case"fullscreen":return new ut(e);case"spacer":return new dt;case"keyboard-help":return ge?new ft(bt):null;default:{let c=dn(l,e.container);if(c)try{return c(e)}catch(h){return e.logger.error(`Control factory for "${l}" threw`,{error:h}),null}return Q.add(l),e.logger.debug(`No control registered for slot "${l}" yet`),null}}},Et=()=>{te=null;for(let l of Q)e.logger.warn(`Control slot "${l}" has no registered control after ${nr}ms - is the plugin installed?`);Q.clear()},Ue=()=>{if(!t)return;Q.clear();let l=new Map(It(oe,i.priority).map(c=>[c.id,c]));for(let c of oe){let h=Ce(c);if(!h)continue;d.push(h);let f=h.render();t.appendChild(f);let g=l.get(c),v={slot:c,control:h,el:f,rank:g?.rank??"never",exit:g?.exit??"overflow",width:-1};H.push(v),c==="time"&&(N=v)}ie&&(_=new yt(e),d.push(_),t.appendChild(_.render()),Re())},Re=()=>{if(!t||!_)return;let l=_.render(),c=H.find(f=>f.slot==="fullscreen"),h=c&&c.el.parentNode===t?c.el:null;if(h){l.nextSibling!==h&&t.insertBefore(l,h);return}t.lastChild!==l&&t.appendChild(l)},ze=()=>{let l="";for(let c of H)l+=c.el.style.display==="none"?"0":"1";return`${l}:${N?.el.textContent?.length??0}`},we=l=>{if(!t||!_)return;let c=new Set(l.overflow),h=new Set(l.hidden);for(let f of H)if(f.slot!=="spacer"){if(h.has(f.slot)){_.holds(f.el)&&ke(f),f.el.classList.add("sp-control--collapsed");continue}f.el.classList.remove("sp-control--collapsed"),c.has(f.slot)?_.holds(f.el)||_.adopt(f.el):_.holds(f.el)&&ke(f)}_.refresh(),Re()},ke=l=>{if(!t||!_)return;let c=_.release(l.el),h=_.render(),f=h.parentNode===t?h:null;for(let g=H.indexOf(l)+1;g<H.length;g++)if(H[g].el.parentNode===t){f=H[g].el;break}t.insertBefore(c,f)},Ft=l=>{if(l.slot!=="volume")return 0;let c=l.el.querySelector(".sp-volume__slider-wrap");return c?c.getBoundingClientRect().width:0},Bt=l=>l.slot==="volume"?z:0,Vt=l=>{let c=getComputedStyle(l),h=parseFloat(c.paddingLeft),f=parseFloat(c.paddingRight),g=parseFloat(c.columnGap||c.gap),v=parseFloat(c.getPropertyValue("--sp-volume-slider-width"));S=Number.isFinite(h)&&Number.isFinite(f)?h+f:er,O=Number.isFinite(g)?g:tr,z=Number.isFinite(v)?v:Zn},He=()=>{if(!ie||!t||!_||t.clientWidth===0)return;Vt(t);let l=H.filter(v=>v.slot==="spacer"&&v.el.style.display!=="none").length,c=t.clientWidth-S-l*O,h=[];for(let v of H){if(v.slot==="spacer")continue;let L=v.el.style.display!=="none";L&&v.el.parentNode===t&&!v.el.classList.contains("sp-control--collapsed")?v.width=v.el.getBoundingClientRect().width-Ft(v):v.width<0&&(v.width=vi),h.push({id:v.slot,rank:v.rank,exit:v.exit,width:v.width+Bt(v),visible:L})}let f=_.render(),g=f.style.display==="none"?0:f.getBoundingClientRect().width;we(an(h,c,O,g||yi)),T=ze(),I=!1},Ut=()=>{ie&&(!I&&ze()===T||He())},Ke=l=>{let c=t?.offsetHeight||wi;e?.container?.style.setProperty("--sp-menu-max-height",`${Math.max(ki,Math.round(l)-c-Ei)}px`)},zt=()=>{t&&(d.forEach(l=>l.destroy()),d=[],H=[],N=null,_=null,et(t),T=null,I=!0,Ue(),De())},fe=()=>{V&&(V=!1,zt())},Kt=()=>{V||(V=!0,queueMicrotask(fe))},De=()=>{d.forEach(v=>v.update()),r?.update();let l=e?.getState("waiting"),c=e?.getState("seeking"),f=e?.getState("playbackState")==="loading",g=l||c&&!e?.getState("paused")||f;s?.classList.toggle("sp-buffering--visible",!!g),o?.update(),u?.update(),Ut()},ve=()=>{J===null&&(J=requestAnimationFrame(()=>{J=null,De()}))},Se=()=>r?.isTimelineEditing()?!0:d.some(l=>{let c=l;return typeof c.isMenuOpen=="function"&&c.isMenuOpen()}),le=()=>{if(x){Le();return}x=!0,t?.classList.add("sp-controls--visible"),t?.classList.remove("sp-controls--hidden"),n?.classList.add("sp-gradient--visible"),r?.show(),e?.setState("controlsVisible",!0),Le()},ye=()=>{if(!e?.getState("paused")){if(Se()){Le();return}x=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),n?.classList.remove("sp-gradient--visible"),r?.hide(),e?.setState("controlsVisible",!1)}},Le=()=>{y&&clearTimeout(y),y=setTimeout(ye,ee)},wt=null,Ie=l=>{wt=l.pointerType},ue=l=>{wt==="touch"&&!kt(l)&&e?.getPlugin("gestures")?.ownsTapInteraction()||le()},kt=l=>{let c=l?.target;return c instanceof Node?!!t?.contains(c)||!!r?.render().contains(c):!1},$e=()=>{ye()},St=l=>l.key.length===1&&l.key>="0"&&l.key<="9"&&!l.shiftKey&&!(typeof l.getModifierState=="function"&&l.getModifierState("AltGraph")),gn=(l,c)=>{let h=e.getState("live"),f=e.getState("seekableRange");if(h){if(!f)return null;let{start:k,end:B}=f;return!Number.isFinite(k)||!Number.isFinite(B)||B<=k?null:Math.min(B,Math.max(k,k+l/10*(B-k)))}let g=Number(e.getState("duration")),v=c.duration,L=Number.isFinite(g)&&g>0?g:Number.isFinite(v)&&v>0?v:null;return L===null?null:Math.min(L,Math.max(0,l/10*L))},p=l=>{if(!e.container.contains(document.activeElement)||l.defaultPrevented||l.metaKey||l.ctrlKey||l.altKey)return;let c=document.activeElement;if(c instanceof HTMLInputElement||c instanceof HTMLTextAreaElement||c instanceof HTMLSelectElement||c?.isContentEditable)return;let h=c?.getAttribute("role");if((c instanceof HTMLButtonElement||h==="button"||h==="menuitem")&&fi.has(l.key)||h==="slider"&&mi.has(l.key)||re?.isOpen())return;if(l.key==="?"){bt()&&l.preventDefault();return}if(l.key==="c"||l.key==="C"){Nt(e)&&l.preventDefault();return}let g=e.container.querySelector("video");if(!g)return;if(St(l)){let k=gn(Number(l.key),g);if(k===null)return;l.preventDefault(),g.currentTime=k,e.emit("playback:seeking",{time:g.currentTime}),le();return}let v=e.getState("live"),L=e.getState("seekableRange");switch(l.key){case" ":case"k":l.preventDefault(),g.paused?g.play().catch(()=>{}):g.pause();break;case"m":l.preventDefault(),g.muted=!g.muted;break;case"f":l.preventDefault(),Te(e.container)?Me(e.container).catch(()=>{}):Pe(e.container).catch(()=>{});break;case"ArrowLeft":l.preventDefault(),v&&L?g.currentTime=Math.max(L.start,g.currentTime-5):g.currentTime=Math.max(0,g.currentTime-5),e.emit("playback:seeking",{time:g.currentTime}),le();break;case"ArrowRight":l.preventDefault(),v&&L?g.currentTime=Math.min(L.end,g.currentTime+5):g.currentTime=Math.min(g.duration||0,g.currentTime+5),e.emit("playback:seeking",{time:g.currentTime}),le();break;case"ArrowUp":l.preventDefault(),g.volume=Math.min(1,g.volume+.1),le();break;case"ArrowDown":l.preventDefault(),g.volume=Math.max(0,g.volume-.1),le();break}};return{id:"ui-controls",name:"UI Controls",type:"ui",version:Wn,async init(l){e=l,a=Jt(hi,ln),i.theme&&this.setTheme(i.theme);let c=e.container;if(!c){e.logger.error("UI plugin: container not found");return}getComputedStyle(c).position==="static"&&(c.style.position="relative"),c.classList.contains("sp-container")||(c.classList.add("sp-container"),A=!0);let f=e.getState("playing");n=document.createElement("div"),n.className=f?"sp-gradient":"sp-gradient sp-gradient--visible",c.appendChild(n),s=document.createElement("div"),s.className="sp-buffering",s.innerHTML=E.spinner,s.setAttribute("aria-hidden","true"),c.appendChild(s),o=new pt(e),c.appendChild(o.render()),M=e.on("error",g=>{if(g?.fatal){let v=e.getState("error")||g;o?.show(v),ve()}}),w=e.on("error:reconnecting",()=>{o?.showReconnecting(),ve()}),q=e.on("error:recovered",()=>{o?.hide(),ve()}),U=e.on("media:loaded",()=>{o?.hide(),ve()}),ae&&(u=new nt(e,()=>o?.isVisible()??!1),c.appendChild(u.render())),re=new mt(e),r=new it(e,{onEditingChange:g=>{g?le():Le()}}),c.appendChild(r.render()),f||r.show(),t=document.createElement("div"),t.className=f?"sp-controls sp-controls--hidden":"sp-controls sp-controls--visible",t.setAttribute("role","toolbar"),t.setAttribute("aria-label","Video controls"),Ue(),Q.size>0&&(te=setTimeout(Et,nr)),c.appendChild(t),ie&&typeof ResizeObserver=="function"?(m=new ResizeObserver(g=>{Ke(g[0]?.contentRect.height??c.clientHeight),I=!0,ve()}),m.observe(c)):ie&&typeof window<"u"&&(W=()=>{F&&clearTimeout(F),F=setTimeout(()=>{F=null,Ke(c.clientHeight),I=!0,ve()},bi)},window.addEventListener("resize",W)),R=qn((g,v)=>{oe.includes(g)&&(v&&v!==e.container||(e.logger.debug(`Control "${g}" registered after init, queuing a control bar rebuild`),Kt()))}),c.addEventListener("pointerdown",Ie,{passive:!0}),c.addEventListener("pointermove",Ie,{passive:!0}),c.addEventListener("mousemove",ue),c.addEventListener("mouseenter",ue),c.addEventListener("mouseleave",$e),c.addEventListener("touchstart",ue,{passive:!0}),c.addEventListener("click",ue),ge&&document.addEventListener("keydown",p),P=e.subscribeToState(ve),De(),c.hasAttribute("tabindex")||c.setAttribute("tabindex","0"),x=!f,e.setState("controlsVisible",x),f&&Le(),e.logger.debug("UI controls plugin initialized")},async destroy(){y&&(clearTimeout(y),y=null),J!==null&&(cancelAnimationFrame(J),J=null),m?.disconnect(),m=null,W&&(window.removeEventListener("resize",W),W=null),F&&(clearTimeout(F),F=null),e?.container?.style.removeProperty("--sp-menu-max-height"),P?.(),P=null,re?.destroy(),re=null,M?.(),M=null,w?.(),w=null,q?.(),q=null,U?.(),U=null,e?.container&&(e.container.removeEventListener("pointerdown",Ie),e.container.removeEventListener("pointermove",Ie),e.container.removeEventListener("mousemove",ue),e.container.removeEventListener("mouseenter",ue),e.container.removeEventListener("mouseleave",$e),e.container.removeEventListener("touchstart",ue),e.container.removeEventListener("click",ue)),ge&&document.removeEventListener("keydown",p),R?.(),R=null,V=!1,te&&(clearTimeout(te),te=null),Q.clear(),d.forEach(l=>l.destroy()),d=[],H=[],N=null,_=null,r?.destroy(),r=null,o?.destroy(),o=null,u?.destroy(),u=null,t?.remove(),t=null,n?.remove(),n=null,s?.remove(),s=null,a?.(),a=null,A&&(e?.container?.classList.remove("sp-container"),A=!1),e?.logger.debug("UI controls plugin destroyed")},show(){le()},hide(){x=!1,t?.classList.remove("sp-controls--visible"),t?.classList.add("sp-controls--hidden"),n?.classList.remove("sp-gradient--visible"),r?.hide(),e?.setState("controlsVisible",!1)},setTheme(l){let c=e?.container||document.documentElement;l.primaryColor&&c.style.setProperty("--sp-color",l.primaryColor),l.accentColor&&c.style.setProperty("--sp-accent",l.accentColor),l.accentTextColor&&c.style.setProperty("--sp-accent-text",l.accentTextColor),l.backgroundColor&&c.style.setProperty("--sp-bg",l.backgroundColor),l.controlBarHeight&&c.style.setProperty("--sp-control-height",`${l.controlBarHeight}px`),l.iconSize&&c.style.setProperty("--sp-icon-size",`${l.iconSize}px`)},getControlBar(){return t}}}async function hl(i,e){let t=e.accentColor??"#e50914",n=await Yt({container:i,src:e.src,poster:e.poster,plugins:[On(),Vn(),rr({theme:{accentColor:t,accentTextColor:hn(t)}})]});if(n.getState().error)throw await n.destroy(),new Error("The sample failed to load");return{async play(){let r=i.querySelector("video");if(!r)throw new Error("The player has no media element");await r.play()},onFirstPlaying(r){if(n.playing){r();return}let s=n.subscribeToState(o=>{o.key==="playing"&&o.value===!0&&(s(),r())})},destroy(){return n.destroy()}}}export{hl as mountHomePlayer};
