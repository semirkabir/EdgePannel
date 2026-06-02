/**
 * Defer Sentry SDK init off the critical path.
 *
 * The @sentry/browser bundle (~81 KiB) used to be eagerly imported at the top
 * of `main.ts` and `Sentry.init({...})` ran synchronously before LCP. Defer
 * moves the import + init to a requestIdleCallback so first paint is not
 * blocked.
 *
 * Two pieces keep error coverage during the deferred-load window:
 *   1. `installPreInitErrorQueue()` — buffers `error` + `unhandledrejection`
 *      events until Sentry.init() resolves, then drains them.
 *   2. `enqueueSentryCall(fn)` — public API for explicit Sentry calls before
 *      the SDK is ready.
 */

type SentryNs = typeof import('@sentry/browser');
type SentryCall = (s: SentryNs) => void;

let sentryNs: SentryNs | null = null;
let initPromise: Promise<void> | null = null;
let scheduled = false;
let queueInstalled = false;
let loadFailed = false;
const pendingCalls: SentryCall[] = [];
const pendingErrors: ErrorEvent[] = [];
const pendingRejections: PromiseRejectionEvent[] = [];

const MAX_QUEUE = 50;

function onError(e: ErrorEvent): void {
  if (pendingErrors.length >= MAX_QUEUE) return;
  pendingErrors.push(e);
}

function onUnhandledRejection(e: PromiseRejectionEvent): void {
  if (pendingRejections.length >= MAX_QUEUE) return;
  pendingRejections.push(e);
}

/**
 * Install eager error listeners that buffer events until Sentry initializes.
 * Safe to call synchronously at the top of the entry point. Idempotent.
 */
export function installPreInitErrorQueue(): void {
  if (queueInstalled || typeof window === 'undefined') return;
  queueInstalled = true;
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
}

/**
 * Queue an explicit Sentry API call. Fires synchronously if the SDK is
 * already loaded; otherwise queued until init completes.
 */
export function enqueueSentryCall(fn: SentryCall): void {
  if (sentryNs) {
    try { fn(sentryNs); } catch { /* user-supplied closure; never break the caller */ }
    return;
  }
  if (loadFailed) return;
  if (pendingCalls.length >= MAX_QUEUE) return;
  pendingCalls.push(fn);
}

function teardownPreInitState(): void {
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onUnhandledRejection);
  pendingCalls.length = 0;
  pendingErrors.length = 0;
  pendingRejections.length = 0;
}

function buildSentryInitOptions(): Parameters<SentryNs['init']>[0] {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  return {
    dsn: sentryDsn || undefined,
    release: `edgepannel@${__APP_VERSION__}`,
    environment: location.hostname === 'edgepannel.app' ? 'production'
      : location.hostname.includes('vercel.app') ? 'preview'
      : 'development',
    enabled: Boolean(sentryDsn) && !location.hostname.startsWith('localhost') && !('__TAURI_INTERNALS__' in window),
    sendDefaultPii: true,
    tracesSampleRate: 0.1,
    ignoreErrors: [
      'Invalid WebGL2RenderingContext',
      'WebGL context lost',
      /imageManager/,
      /ResizeObserver loop/,
      /NotAllowedError/,
      /InvalidAccessError/,
      /importScripts/,
      /^TypeError: Load failed( \(.*\))?$/,
      /^TypeError: Failed to fetch( \(.*\))?$/,
      /^TypeError: cancelled$/,
      /^TypeError: NetworkError/,
      /runtime\.sendMessage\(\)/,
      /Java object is gone/,
      /^Object captured as promise rejection with keys:/,
      /Unable to load image/,
      /Non-Error promise rejection captured with value:/,
      /Connection to Indexed Database server lost/,
      /webkit\.messageHandlers/,
      /(?:unsafe-eval.*Content Security Policy|Content Security Policy.*unsafe-eval)/,
      /Fullscreen request denied/,
      /requestFullscreen/,
      /webkitEnterFullscreen/,
      /vc_text_indicators_context/,
      /Program failed to link/,
      /too much recursion/,
      /zaloJSV2/,
      /Java bridge method invocation error/,
      /Could not compile fragment shader/,
      /can't redefine non-configurable property/,
      /Can.t find variable: (CONFIG|currentInset|NP|webkit|EmptyRanges|logMutedMessage|UTItemActionController|DarkReader|Readability|onPageLoaded|Game|frappe|getPercent|ucConfig|\$a)/,
      /invalid origin/,
      /\.data\.split is not a function/,
      /signal is aborted without reason/,
      /Failed to fetch dynamically imported module/,
      /Importing a module script failed/,
      /error loading dynamically imported module/,
      /contentWindow\.postMessage/,
      /Could not compile vertex shader/,
      /objectStoreNames/,
      /Unexpected identifier 'https'/,
      /Can't find variable: _0x/,
      /WKWebView was deallocated/,
      /Unexpected end of(?: JSON)? input/,
      /window\.android\.\w+ is not a function/,
      /Attempted to assign to readonly property/,
      /Cannot assign to read only property/,
      /FetchEvent\.respondWith/,
      /e\.toLowerCase is not a function/,
      /\.trim is not a function/,
      /\.(indexOf|findIndex) is not a function/,
      /QuotaExceededError/,
      /^TypeError: 已取消$/,
      /Maximum call stack size exceeded/,
      /^fetchError: Network request failed$/,
      /window\.ethereum/,
      /^SyntaxError: Unexpected token/,
      /^Operation timed out\.?$/,
      /setting 'luma'/,
      /ML request .* timed out/,
      /^Element not found$/,
      /(?:AbortError: )?The operation was aborted\.?\s*$/,
      /Unexpected end of script/,
      /Style is not done loading/,
      /Event `CustomEvent`.*captured as promise rejection/,
      /getProgramInfoLog/,
      /__firefox__/,
      /ifameElement\.contentDocument/,
      /Invalid video id/,
      /Fetch is aborted/,
      /Stylesheet append timeout/,
      /Worker is not a constructor/,
      /_pcmBridgeCallbackHandler/,
      /UCShellJava/,
      /Cannot define multiple custom elements/,
      /maxTextureDimension2D/,
      /Container app not found/,
      /this\.St\.unref/,
      /Invalid or unexpected token/,
      /evaluating 'elemFound\.value'/,
      /[Cc]an(?:'t|not) access (?:'\w+'|lexical declaration '\w+') before initialization/,
      /^Uint8Array$/,
      /createObjectStore/,
      /The database connection is closing/,
      /shortcut icon/,
      /Attempting to change value of a readonly property/,
      /reading 'nodeType'/,
      /feature named .\w+. was not found/,
      /a2z\.onStatusUpdate/,
      /Attempting to run\(\), but is already running/,
      /this\.player\.destroy is not a function/,
      /isReCreate is not defined/,
      /reading 'style'.*HTMLImageElement/,
      /can't access property "write", \w+ is undefined/,
      /AbortError: The user aborted a request/,
      /\w+ is not a function.*\/uv\/service\//,
      /__isInQueue__/,
      /^(?:LIDNotify(?:Id)?|onWebViewAppeared|onGetWiFiBSSID) is not defined$/,
      /signal timed out/,
      /Se requiere plan premium/,
      /hybridExecute is not defined/,
      /reading 'postMessage'/,
      /NotSupportedError/,
      /appendChild.*Unexpected token/,
      /\bmag is not defined\b/,
      /evaluating '[^']*\.luma/,
      /translateNotifyError/,
      /GM_getValue/,
      /^InvalidStateError:|The object is in an invalid state/,
      /Could not establish connection\. Receiving end does not exist/,
      /webkitCurrentPlaybackTargetIsWireless/,
      /webkit(?:Supports)?PresentationMode/,
      /Cannot redefine property: webdriver/,
      /null is not an object \(evaluating '\w+\.theme'\)/,
      /this\.player\.\w+ is not a function/,
      /videoTrack\.configuration/,
      /evaluating 'v\.setProps'/,
      /button\[aria-label/,
      /The fetching process for the media resource was aborted/,
      /Invalid regular expression: missing/,
      /WeixinJSBridge/,
      /evaluating '\w+\.type'/,
      /Policy with name .* already exists/,
      /[sx]wbrowser is not defined/,
      /browser\.storage\.local/,
      /The play\(\) request was interrupted/,
      /MutationEvent is not defined/,
      /Cannot redefine property: userAgent/,
      /st_framedeep|ucbrowser_script/,
      /iabjs_unified_bridge/,
      /DarkReader/,
      /window\.receiveMessage/,
      /Cross-origin script load denied/,
      /orgSetInterval is not a function/,
      /Blocked a frame with origin.*accessing a cross-origin frame/,
      /SnapTube/,
      /sortedTrackListForMenu/,
      /isWhiteToBlack/,
      /window\.videoSniffer/,
      /closeTabMediaModal/,
      /missing \) after argument list/,
      /Error invoking postMessage: Java exception/,
      /IndexSizeError/,
      /Cannot add property \w+, object is not extensible/,
      /Failed to construct 'Worker'.*cannot be accessed from origin/,
      /undefined is not an object \(evaluating '(?:this\.)?media(?:Controller)?\.(?:duration|videoTracks|readyState|audioTracks|media)/,
      /\$ is not defined/,
      /Qt\(\) is not a function/,
      /out of memory/,
      /Could not connect to the server/,
      /shaderSource must be an instance of WebGLShader/,
      /Failed to initialize WebGL/,
      /opacityVertexArray\.length/,
      /Length of new data is \d+, which doesn't match current length of/,
      /^AJAXError:.*(?:Load failed|Unauthorized|\(401\))/,
      /^NetworkError: Load failed$/,
      /^A network error occurred\.?$/,
      /nmhCrx is not defined/,
      /navigationPerformanceLoggerJavascriptInterface/,
      /jQuery is not defined/,
      /illegal UTF-16 sequence/,
      /detectIncognito/,
      /Cannot read properties of null \(reading '__uv'\)/,
      /Can't find variable: p\d+/,
      /^timeout$/,
      /Can't find variable: caches/,
      /crypto\.randomUUID is not a function/,
      /ucapi is not defined/,
      /Identifier '(?:script|reportPage)' has already been declared/,
      /getAttribute is not a function.*getAttribute\("role"\)/,
      /^TypeError: Internal error$/,
      /SCDynimacBridge/,
      /errTimes is not defined/,
      /Failed to get ServiceWorkerRegistration/,
      /^ReferenceError: Cannot access uninitialized variable\.?$/,
      /Failed writing data to the file system/,
      /Error invoking initializeCallbackHandler/,
      /releasePointerCapture.*Invalid pointer/,
      /Array buffer allocation failed/,
      /Client can't handle this message/,
      /Invalid LngLat object/,
      /autoReset/,
      /webkitExitFullScreen/,
      /downProgCallback/,
      /syncDownloadState/,
      /^ReferenceError: HTMLOUT is not defined$/,
      /^ReferenceError: xbrowser is not defined$/,
      /LibraryDetectorTests_detect/,
      /contentBoxSize\[0\] is undefined/,
      /Out of range source coordinates for DEM data/,
      /Invalid character: '\\0'/,
      /Failed to execute 'unobserve' on 'IntersectionObserver'/,
      /WKErrorDomain/,
      /doesn't provide an export named/,
      /^(?:Error: )?Request timeout: \//,
      /^(?:TypeError: )?Failed to fetch$/,
      /^(?:SyntaxError: )?Unexpected EOF$/,
    ],
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value ?? '';
      if (msg.length <= 3 && /^[a-zA-Z_$]+$/.test(msg)) return null;
      const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
      const excType = event.exception?.values?.[0]?.type ?? '';

      const vendorChunk = /\/(maplibre|deck-stack|d3|topojson|i18n|sentry|transformers|onnxruntime)-[A-Za-z0-9_-]+\.js/;
      const firstPartyFile = (filename: string): boolean => {
        if (/\.(ts|tsx)$/.test(filename) || /^src\//.test(filename)) return true;
        if (/\/assets\/[A-Za-z0-9_-]+(-[A-Za-z0-9_-]+)*\.js/.test(filename)) return !vendorChunk.test(filename);
        return false;
      };
      const nonInfraFrames = frames.filter(f => f.filename && f.filename !== '<anonymous>' && f.filename !== '[native code]' && !/\/sentry-[A-Za-z0-9_-]+\.js/.test(f.filename));
      const hasFirstParty = nonInfraFrames.some(f => firstPartyFile(f.filename ?? ''));
      const hasAnyStack = nonInfraFrames.length > 0;

      // Suppress maplibre internal null-access crashes
      if (/this\.style\._layers|reading '_layers'|this\.(light|sky) is null|can't access property "(id|type|setFilter)"[,] ?\w+ is (null|undefined)|can't access property "(id|type)" of null|Cannot read properties of null \(reading '(id|type|setFilter|_layers)'\)|null is not an object \(evaluating '\w{1,3}\.(id|style)|^\w{1,2} is null$/.test(msg)) {
        if (frames.some(f => /\/(map|maplibre|deck-stack)-[A-Za-z0-9_-]+\.js/.test(f.filename ?? ''))) return null;
      }
      // Suppress TypeError/RangeError entirely within maplibre or deck.gl internals
      const isHostScopedFetchFailure = excType === 'TypeError' && /^Failed to fetch \([^)]+\)$/.test(msg);
      if (!isHostScopedFetchFailure && (excType === 'TypeError' || excType === 'RangeError') && frames.length > 0) {
        if (nonInfraFrames.length > 0 && nonInfraFrames.every(f => /\/(map|maplibre|deck-stack)-[A-Za-z0-9_-]+\.js/.test(f.filename ?? ''))) return null;
      }
      // Suppress Three.js/globe.gl crashes in main bundle
      if (/reading '__globeObjType'|__globeObjType/.test(msg)) return null;
      if (/reading '(?:type|pathType|count)'|can't access property "(?:type|pathType|count)",? \w+ is (?:undefined|null)|undefined is not an object \(evaluating '\w+\.(?:pathType|count)'\)/.test(msg)) {
        if (!hasFirstParty) return null;
      }
      if (/undefined is not an object \(evaluating '\w{1,3}\.isHidden'\)|Cannot read properties of undefined \(reading 'isHidden'\)/.test(msg)) {
        if (!hasFirstParty) return null;
      }
      // OrbitControls touch crash
      if (/undefined is not an object \(evaluating 't\.x'\)|Cannot read properties of undefined \(reading 'x'\)/.test(msg)) {
        if (!hasFirstParty || frames.some(f => /\b_handleTouch\w*Dolly|OrbitControls/.test(f.function ?? ''))) return null;
      }
      // deck.gl/maplibre null-access crashes with no usable stack
      if (/null is not an object \(evaluating '\w{1,3}\.(id|type|style)'\)/.test(msg) && frames.length === 0) return null;
      // TypeErrors from anonymous/injected scripts
      if ((excType === 'TypeError' || /^TypeError:/.test(msg)) && frames.length > 0 && frames.every(f => !f.filename || f.filename === '<anonymous>' || /^blob:/.test(f.filename) || /^https?:\/\/[^/]+\/?$/.test(f.filename))) return null;
      // parentNode.insertBefore from injected scripts
      if (/parentNode\.insertBefore/.test(msg) && frames.every(f => !f.filename || f.filename === '<anonymous>' || f.filename === '[native code]' || /^blob:/.test(f.filename) || /^https?:\/\/[^/]+\/?$/.test(f.filename))) return null;
      // Errors entirely from blob: URLs
      if (frames.length > 0 && frames.every(f => /^blob:/.test(f.filename ?? ''))) return null;
      // Errors from extensions when no first-party frames
      if (!hasFirstParty && frames.some(f => /^(?:chrome|moz|safari(?:-web)?)-extension:\/\//.test(f.filename ?? ''))) return null;
      // UV proxy errors
      if (frames.some(f => /\/uv\/service\//.test(f.filename ?? '') || /uv\.handler/.test(f.filename ?? ''))) return null;
      // YouTube IFrame errors
      if (frames.some(f => /www-widgetapi\.js/.test(f.filename ?? ''))) return null;
      // Stale chunk errors
      if (!hasFirstParty && /(?:Failed to fetch|error loading) dynamically imported module|Importing a module script failed/i.test(msg)) return null;
      // Zero-frame async patterns
      if (!hasFirstParty && (/signal timed out/.test(msg) || /NotSupportedError/.test(msg) || /out of memory/i.test(msg) || /^(?:TypeError: )?Failed to fetch$/.test(msg) || /^(?:SyntaxError: )?Unexpected EOF$/.test(msg))) return null;
      if (hasAnyStack && !hasFirstParty && (
        /Maximum call stack size exceeded/.test(msg)
        || /^\w{1,2} is not a (?:function|constructor)/.test(msg)
        || /Cannot add property \w+, object is not extensible/.test(msg)
        || /^TypeError: Internal error$/.test(msg)
        || /^Key not found$/.test(msg)
        || /^Element not found$/.test(msg)
        || /^TypeError: NetworkError/.test(msg)
        || /Could not connect to the server/.test(msg)
        || (excType === 'SyntaxError' && /^Unexpected (?:token|keyword)/.test(msg))
        || /Invalid or unexpected token/.test(msg)
        || /^Operation timed out/.test(msg)
      )) return null;
      return event;
    },
  };
}

async function loadAndInit(): Promise<void> {
  const ns = await import('@sentry/browser');
  ns.init(buildSentryInitOptions());
  sentryNs = ns;

  const calls = pendingCalls.splice(0, pendingCalls.length);
  for (const fn of calls) {
    try { fn(ns); } catch { /* user-supplied closure */ }
  }

  const errs = pendingErrors.splice(0, pendingErrors.length);
  for (const ev of errs) {
    const err = ev.error instanceof Error ? ev.error : new Error(ev.message || 'Unknown error');
    ns.captureException(err, { mechanism: { type: 'onerror', handled: false } });
  }

  const rejs = pendingRejections.splice(0, pendingRejections.length);
  for (const ev of rejs) {
    ns.captureException(ev.reason ?? new Error('Unhandled promise rejection'), { mechanism: { type: 'onunhandledrejection', handled: false } });
  }

  teardownPreInitState();
}

/**
 * Schedule the deferred Sentry SDK load + init. Idempotent.
 * Returns a promise that resolves once init completes (failures are swallowed).
 */
export function scheduleSentryInit(): Promise<void> {
  if (initPromise) return initPromise;
  if (typeof window === 'undefined') return Promise.resolve();
  if (scheduled) return Promise.resolve();
  scheduled = true;

  initPromise = new Promise<void>((resolve) => {
    const start = (): void => {
      void loadAndInit()
        .catch((err) => {
          console.warn('[sentry] deferred init failed', err);
          loadFailed = true;
          teardownPreInitState();
        })
        .finally(() => resolve());
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(start, { timeout: 4000 });
      return;
    }
    if (document.readyState === 'complete') {
      setTimeout(start, 0);
    } else {
      window.addEventListener('load', () => setTimeout(start, 0), { once: true });
    }
  });
  return initPromise;
}

/** Test-only: reset module state between unit tests. */
export function _resetSentryDeferStateForTests(): void {
  sentryNs = null;
  initPromise = null;
  scheduled = false;
  queueInstalled = false;
  loadFailed = false;
  pendingCalls.length = 0;
  pendingErrors.length = 0;
  pendingRejections.length = 0;
}
